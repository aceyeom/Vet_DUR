#!/usr/bin/env python3
"""
plumbs_output/*.jsonl → backend/data/converted/{drug}.jsonl 변환 스크립트

Anthropic Claude API를 사용하여 raw monograph 텍스트를 structured JSON schema로 변환.
Usage:
  python3 실험실.py --test 10    # 테스트: 처음 10개만
  python3 실험실.py              # 전체 변환
"""

import json
import re
import asyncio
import argparse
import sys
import time
from pathlib import Path

import os
import openai
from openai import AsyncOpenAI


def log(msg):
    print(msg, flush=True)

def parse_sse_response(raw) -> str:
    """API 프록시가 SSE 스트림을 raw string으로 반환할 때 텍스트 추출"""
    if hasattr(raw, 'content') and not isinstance(raw, str):
        # 정상적인 Message 객체
        return raw.content[0].text
    # SSE 스트림 파싱
    text_parts = []
    raw_str = str(raw)
    for line in raw_str.split('\n'):
        if not line.startswith('data: '):
            continue
        payload = line[6:]
        if payload.strip() == '[DONE]':
            continue
        try:
            data = json.loads(payload)
            msg_type = data.get('type', '')
            if msg_type == 'content_block_delta':
                delta = data.get('delta', {})
                if delta.get('type') == 'text_delta':
                    text_parts.append(delta.get('text', ''))
            elif msg_type == 'message_delta':
                # 에러 체크
                stop = data.get('delta', {}).get('stop_reason')
                if stop == 'max_tokens':
                    log("  [WARN] max_tokens reached")
        except json.JSONDecodeError:
            continue
    result = ''.join(text_parts)
    if not result:
        # 디버그: 전체 응답의 처음 500자 출력
        log(f"  [DEBUG] Empty parse. Raw response start: {raw_str[:300]}")
    return result

# ─── 설정 ───────────────────────────────────────────────
INPUT_DIR = Path("plumbs_output")
OUTPUT_DIR = Path("backend/data/converted")
ERROR_LOG = Path("conversion_errors.log")
MODEL = "gpt-4.1"  # GitHub Models 모델명 (https://github.com/marketplace/models 에서 확인)
MAX_CONCURRENT = 1   # GitHub Models 무료 티어 rate limit 대응
MAX_RETRIES = 7
REQUEST_DELAY = 8    # 요청 간 최소 대기(초)

# ─── few-shot 예시 (Acepromazine) ───────────────────────
EXAMPLE_OUTPUT = """{
  "drug_identity": {
    "name_ko": "아세프로마진",
    "name_en": "Acepromazine",
    "class": "Phenothiazine Sedative/Tranquilizer",
    "has_reversal": false,
    "reversal_evidence": "전용 역전제(해독제)가 없으며, 저혈압 등 부작용 발생 시 수액 및 승압제(노르에피네프린)를 통한 지지 요법 필요."
  },
  "section_1_2_10": {
    "highlights": "가장 흔한 전마취 진정제. 라벨보다 낮은 용량 권장. 진통 효과 없음. 혈관 확장으로 인한 저혈압 및 저체온 주의.",
    "indications": "진정 및 안정, 마취 전 처치, 멀미 예방(항구토), 고양이 요도 폐쇄 보조 치료, 말 제엽염 치료.",
    "client_info": "투약 후 소리에 민감해져 갑자기 놀랄 수 있음. 환경을 어둡고 조용하게 유지. 소변이 분홍색/적갈색으로 보일 수 있으나 정상임."
  },
  "organ_systems_impact": {
    "note": "-1: 부작용, 0: 정보없음, 1: 치료적, 2: 기타",
    "dog": {
      "brain": 1, "brain_evidence": "중추 도파민 차단으로 효과적인 진정. 단, 일부 공격적 개체에서 역설적 흥분(-1) 가능.",
      "heart": 2, "heart_evidence": "직접적 억제는 적으나 혈압 저하에 따른 반사성 빈맥 가능성.",
      "cardiovascular": -1, "cardiovascular_evidence": "알파-1 수용체 차단으로 강력한 혈관 확장 및 저혈압 유발.",
      "blood": -1, "blood_evidence": "비장 적혈구 격리로 헤마토크릿(PCV) 수치 일시적 감소.",
      "metabolism": 2, "metabolism_evidence": "간 대사 의존적. 간부전 시 효과가 매우 길게 지속될 수 있음.",
      "respiratory": 1, "respiratory_evidence": "호흡 억제 효과 미미. 상부 기도 폐쇄 환자 진정에 유용.",
      "eye": -1, "eye_evidence": "제3안검(순막) 돌출 유발 및 눈물량 감소 가능."
    },
    "cat": {
      "brain": 1, "brain_evidence": "우수한 진정 및 안정 효과.",
      "heart": 2, "heart_evidence": "심박수 변화 가능하나 일반적으로 안정적임.",
      "cardiovascular": -1, "cardiovascular_evidence": "개와 마찬가지로 저혈압 위험 존재.",
      "blood": -1, "blood_evidence": "비장 비대 및 일시적 빈혈 수치(PCV 감소) 발생.",
      "metabolism": 2, "metabolism_evidence": "간 대사 의존.",
      "respiratory": 1, "respiratory_evidence": "호흡 수치에 미치는 영향이 매우 적어 안전함.",
      "eye": -1, "eye_evidence": "제3안검 돌출 보고됨."
    }
  },
  "genetic_sensitivity": {
    "has_genetic_risk": true,
    "affected_breeds": ["Collie", "Australian Shepherd", "Shetland Sheepdog", "Old English Sheepdog"],
    "evidence": "MDR1 유전자 변이종은 약물 배출이 느려 진정 효과가 극도로 강해짐. 25-50% 감량 필수."
  },
  "timing_profile": {
    "onset_min": 15,
    "peak_min": 30,
    "duration_hr_min": 3,
    "duration_hr_max": 8,
    "evidence": "정맥 주사 시 15분, 경구 시 30-60분 내 발현. 개체에 따라 최대 8시간까지 지속 가능."
  },
  "precautions": {
    "dog": { "status": 1, "evidence": "MDR1 변이종, 심장 질환, 저혈압, 간부전 환자 주의. 단두종(복서 등) 실신 주의." },
    "cat": { "status": 1, "evidence": "탈수, 쇼크, 중증 간질환 시 사용 지양." }
  },
  "drug_interactions": [
    { "drug": "Epinephrine", "severity": 3, "evidence": "에피네프린 역전 현상으로 치명적 저혈압 유발. 절대 금기." },
    { "drug": "Organophosphates", "severity": 3, "evidence": "유기인제 독성 강화. 살충제 노출 전후 1개월 사용 금지." },
    { "drug": "Opioids", "severity": 1, "evidence": "신경이완진통 시너지(진정 강화). 용량 조절 권장." },
    { "drug": "Alpha-2 Agonists", "severity": 2, "evidence": "중추신경 억제 가중. 저혈압 및 서맥 모니터링 필수." }
  ],
  "dosage_and_kinetics": {
    "dog": {
      "is_approved": true,
      "qt_prolongation": true,
      "half_life": "7.1 - 16 hours",
      "dosage_list": [
        {
          "logic_type": "linear",
          "context": "Standard Sedation / Premedication",
          "value": "0.01 - 0.05",
          "unit": "mg/kg",
          "route": "IV, IM, SC",
          "frequency": "Single dose",
          "evidence": "임상적으로 라벨(0.5-1.1mg/kg)보다 훨씬 낮은 이 용량이 권장됨."
        },
        {
          "logic_type": "capped",
          "context": "Large Breed Maximum Dose",
          "value": "3.0",
          "unit": "mg/animal",
          "route": "Any",
          "frequency": "Max total",
          "evidence": "대형견의 경우 체중당 계산 시 과용량 위험이 있어 총량을 3~4mg으로 제한함."
        },
        {
          "logic_type": "linear",
          "context": "Oral Sedation",
          "value": "0.55 - 2.2",
          "unit": "mg/kg",
          "route": "PO",
          "frequency": "q6h - q12h",
          "evidence": "여행이나 스트레스 상황에서 사용되는 경구 용량 범위."
        }
      ]
    },
    "cat": {
      "is_approved": true,
      "qt_prolongation": true,
      "half_life": "Generally long",
      "dosage_list": [
        {
          "logic_type": "linear",
          "context": "Standard Sedation",
          "value": "0.01 - 0.1",
          "unit": "mg/kg",
          "route": "IV, IM, SC",
          "frequency": "Single dose",
          "evidence": "고양이 진정을 위한 표준 체중당 용량."
        },
        {
          "logic_type": "fixed",
          "context": "Urethral Obstruction Adjunctive",
          "value": "0.25",
          "unit": "mg/animal",
          "route": "IM",
          "frequency": "q8h",
          "evidence": "요도 폐쇄 보조 치료 시 체중과 무관하게 낮은 고정 용량 사용."
        }
      ]
    }
  },
  "effects_and_mechanisms": {
    "common_extra_effects": ["근이완", "항구토", "부정맥 방지"],
    "common_mechanism": "뇌 내 도파민(D2) 수용체 길항 및 말초 알파-1 아드레날린 수용체 차단.",
    "dog_extra_effects": ["가려움증 완화"],
    "dog_mechanism": "망상활성계 억제 및 항히스타민 작용 보조.",
    "cat_extra_effects": ["요도 평활근 이완"],
    "cat_mechanism": "알파 차단 효과를 통한 요도 내압 감소 도움."
  },
  "storage_and_forms": {
    "storage": "20°C-25°C 차광 보관. 정제는 밀폐 용기.",
    "forms": ["10mg/mL 주사제", "10mg 정제", "25mg 정제"]
  }
}"""

# ─── System prompt ──────────────────────────────────────
SYSTEM_PROMPT = """You are a veterinary clinical pharmacologist and Korean translator.
Convert the raw Plumb's Veterinary Drug Handbook monograph into a structured JSON object following the EXACT schema below.

CRITICAL RULES:
1. All "evidence" fields and Korean text fields (highlights, indications, client_info, name_ko) MUST be in Korean (한국어).
2. Extract EXACT dosage numbers from the text. Do NOT hallucinate or round values.
3. dosage_list is the MOST IMPORTANT field. Include ALL dosages for dogs and cats from the Dosages section.
4. logic_type: "linear" = mg/kg dose, "capped" = total dose cap (mg/animal max), "fixed" = fixed mg/animal dose
5. organ_systems_impact scores: -1 = adverse, 0 = no info, 1 = therapeutic, 2 = other/indirect
6. precautions.status: 0 = safe, 1 = caution, 2 = contraindicated
7. drug_interactions.severity: 1 = minor, 2 = moderate, 3 = severe/contraindicated
8. If info for cats is not available, still include the cat field with appropriate defaults (0 scores, empty dosage_list).
9. Include dosages for ALL species mentioned (dogs, cats, horses, etc. if present) but dog and cat are the minimum required keys.
10. name_ko should be the standard Korean pharmaceutical name for the drug.
11. For timing_profile, extract onset, peak and duration from the Pharmacokinetics section. Use 0 if not stated.
12. Return ONLY valid JSON. No markdown, no explanation, no wrapping."""

# ─── User prompt template ──────────────────────────────
USER_PROMPT_TEMPLATE = """Convert this monograph into the target JSON schema.

## Target Schema (field definitions):
- drug_identity: {{name_ko(한국어), name_en, class(drug class from monograph header), has_reversal(bool), reversal_evidence(한국어)}}
- section_1_2_10: {{highlights(한국어 요약), indications(한국어), client_info(한국어)}}
- organ_systems_impact: {{note, dog/cat: {{brain,heart,cardiovascular,blood,metabolism,respiratory,eye (each int + _evidence 한국어)}}}}
- genetic_sensitivity: {{has_genetic_risk(bool), affected_breeds([]), evidence(한국어)}}
- timing_profile: {{onset_min(int), peak_min(int), duration_hr_min(int), duration_hr_max(int), evidence(한국어)}}
- precautions: {{dog/cat: {{status(int 0-2), evidence(한국어)}}}}
- drug_interactions: [{{drug(str), severity(int 1-3), evidence(한국어)}}]
- dosage_and_kinetics: {{dog/cat: {{is_approved(bool), qt_prolongation(bool), half_life(str), dosage_list:[{{logic_type, context, value, unit, route, frequency, evidence(한국어)}}]}}}}
- effects_and_mechanisms: {{common_extra_effects([한국어]), common_mechanism(한국어), dog_extra_effects([한국어]), dog_mechanism(한국어), cat_extra_effects([한국어]), cat_mechanism(한국어)}}
- storage_and_forms: {{storage(한국어), forms([한국어])}}

## Example Output (Acepromazine):
{example}

## Now convert this drug:
Drug name: {ingredient}

---RAW MONOGRAPH---
{raw_content}
---END MONOGRAPH---

Return ONLY the JSON object."""

# ─── 핵심 함수들 ────────────────────────────────────────

def load_all_drugs():
    """plumbs_output/*.jsonl에서 모든 약물 로드"""
    drugs = []
    for f in sorted(INPUT_DIR.glob("*.jsonl"), key=lambda x: int(x.stem)):
        for line_num, line in enumerate(open(f, encoding="utf-8"), 1):
            line = line.strip()
            if not line:
                continue
            try:
                drugs.append(json.loads(line))
            except json.JSONDecodeError as e:
                log(f"  [SKIP] {f.name} line {line_num}: JSON 파싱 에러 - {e}")
    return drugs


def get_output_path(ingredient: str) -> Path:
    """약물명 → 출력 파일 경로 (알파벳 폴더 구조)"""
    safe_name = re.sub(r'[^\w\-]', '_', ingredient.lower()).strip('_')
    first_letter = ingredient[0].upper()
    if not first_letter.isalpha():
        first_letter = "_"
    folder = OUTPUT_DIR / first_letter
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{safe_name}.jsonl"


def validate_result(data: dict, ingredient: str) -> list[str]:
    """변환 결과 유효성 검증. 문제가 있으면 에러 메시지 리스트 반환."""
    errors = []
    required_keys = [
        "drug_identity", "section_1_2_10", "organ_systems_impact",
        "genetic_sensitivity", "timing_profile", "precautions",
        "drug_interactions", "dosage_and_kinetics",
        "effects_and_mechanisms", "storage_and_forms"
    ]
    for key in required_keys:
        if key not in data:
            errors.append(f"Missing top-level key: {key}")

    # dosage 검증
    dk = data.get("dosage_and_kinetics", {})
    for species in ("dog", "cat"):
        sp = dk.get(species, {})
        dl = sp.get("dosage_list", [])
        if not dl:
            errors.append(f"dosage_list empty for {species}")

    # organ score 범위 검증
    osi = data.get("organ_systems_impact", {})
    for species in ("dog", "cat"):
        sp = osi.get(species, {})
        for organ in ("brain", "heart", "cardiovascular", "blood", "metabolism", "respiratory", "eye"):
            val = sp.get(organ)
            if val is not None and val not in (-1, 0, 1, 2):
                errors.append(f"organ_systems_impact.{species}.{organ} = {val} (not in -1,0,1,2)")

    return errors


async def convert_one(client: AsyncOpenAI, drug: dict, semaphore: asyncio.Semaphore) -> tuple[str, bool, str]:
    """단일 약물 변환. Returns (ingredient, success, message)"""
    ingredient = drug["ingredient"]
    output_path = get_output_path(ingredient)

    # 이미 변환됨 → 건너뛰기
    if output_path.exists():
        return (ingredient, True, "already exists")

    user_prompt = USER_PROMPT_TEMPLATE.format(
        example=EXAMPLE_OUTPUT,
        ingredient=ingredient,
        raw_content=drug["raw_content"][:40000]  # 컨텍스트 초과 방지
    )

    async with semaphore:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                await asyncio.sleep(REQUEST_DELAY)  # rate limit 방지 딜레이
                response = await client.chat.completions.create(
                    model=MODEL,
                    max_tokens=16384,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                )
                content = response.choices[0].message.content
                if not content:
                    raise ValueError("Empty response content")
                raw_text = content.strip()

                # JSON 파싱 (마크다운 블록 제거)
                if raw_text.startswith("```"):
                    raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
                    raw_text = re.sub(r'\s*```$', '', raw_text)

                data = json.loads(raw_text)

                # 유효성 검증
                validation_errors = validate_result(data, ingredient)
                if validation_errors:
                    warn_msg = "; ".join(validation_errors)
                    log(f"  [WARN] {ingredient}: {warn_msg}")

                # 저장
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                log(f"  [OK] {ingredient}")
                return (ingredient, True, "converted")

            except (json.JSONDecodeError, ValueError) as e:
                if attempt == MAX_RETRIES:
                    return (ingredient, False, f"Parse error: {e}")
                log(f"  [RETRY] {ingredient}: JSON parse error, attempt {attempt}/{MAX_RETRIES}")
                await asyncio.sleep(5 * attempt)

            except openai.RateLimitError:
                wait = min(2 ** attempt * 10, 300)  # 최대 5분
                log(f"  [RATE] {ingredient}: rate limited, waiting {wait}s... (attempt {attempt}/{MAX_RETRIES})")
                await asyncio.sleep(wait)

            except openai.APIError as e:
                if attempt == MAX_RETRIES:
                    return (ingredient, False, f"API error: {e}")
                await asyncio.sleep(2 ** attempt)

    return (ingredient, False, "max retries exceeded")


async def main(test_count: int | None = None):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    log("소스 데이터 로드 중...")
    drugs = load_all_drugs()
    log(f"총 {len(drugs)}개 약물 로드됨\n")

    if test_count:
        drugs = drugs[:test_count]
        log(f"테스트 모드: 처음 {test_count}개만 변환\n")

    client = AsyncOpenAI(
        base_url="https://models.inference.ai.azure.com",
        api_key=os.environ["GITHUB_TOKEN"],
    )
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    start_time = time.time()
    tasks = [convert_one(client, drug, semaphore) for drug in drugs]
    results = await asyncio.gather(*tasks)

    # 결과 집계
    success = [r for r in results if r[1]]
    failed = [r for r in results if not r[1]]
    skipped = [r for r in results if r[1] and r[2] == "already exists"]
    converted = [r for r in results if r[1] and r[2] == "converted"]

    elapsed = time.time() - start_time

    log(f"\n{'='*60}")
    log(f"완료! ({elapsed:.1f}초)")
    log(f"  성공: {len(success)}개 (새로 변환: {len(converted)}, 기존: {len(skipped)})")
    log(f"  실패: {len(failed)}개")

    if failed:
        log(f"\n실패 목록:")
        with open(ERROR_LOG, 'w', encoding='utf-8') as f:
            for ingredient, _, msg in failed:
                line = f"  {ingredient}: {msg}"
                log(line)
                f.write(line + '\n')
        log(f"\n에러 로그: {ERROR_LOG}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", type=int, default=None, help="테스트할 약물 수 (예: --test 10)")
    args = parser.parse_args()
    asyncio.run(main(test_count=args.test))
