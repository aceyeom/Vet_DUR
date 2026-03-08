#!/usr/bin/env python3
"""
plumbs_output/*.jsonl → backend/data/converted/{drug}.jsonl 변환 스크립트

OpenAI API를 사용하여 raw monograph 텍스트를 structured JSON schema로 변환.
Usage:
  python3 실험실.py --api-key <OPENAI_API_KEY> --test 10
  python3 실험실.py --api-key <OPENAI_API_KEY>
"""

import json
import re
import asyncio
import argparse
import time
from pathlib import Path
from getpass import getpass

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
MODEL = "gpt-5.4"
MAX_CONCURRENT = 1   # API rate limit 대응
MAX_RETRIES = 7
REQUEST_DELAY = 8    # 요청 간 최소 대기(초)

# ─── few-shot 예시 (Acepromazine) ───────────────────────
EXAMPLE_OUTPUT = """
{
  "id": "string — unique slug, snake_case e.g. 'meloxicam'",

  "drug_identity": {
    "name_ko": "string — Korean INN name e.g. '멜록시캄'",
    "name_en": "string — English INN name e.g. 'Meloxicam'",
    "class": "string — enum: NSAID | Corticosteroid | Antibiotic | Antiparasitic | Antifungal | Analgesic | Cardiac | Diuretic | Sedative | Antiemetic | GI Protectant | Anticonvulsant | Antidepressant | ACE Inhibitor | Bronchodilator | Immunosuppressant | Thyroid | Hormone | Antineoplastic Agent | Antiretroviral",
    "source": "string — enum: kr_vet | human_offlabel | foreign | unknown",
    "has_reversal": "boolean",
    "reversal_evidence": "string | null",
    "off_label_note": "string | null — only for human_offlabel source",
    "dosage_form": "string — enum: Tab | Inj | Cap | Susp | Drop | Oint | Topical | Ophthalmic",
    "available_strengths": [
      { "value": "float", "unit": "string — e.g. mg | mg/kg | IU/kg | mcg/kg | EA" }
    ]
  },

  "metabolism_and_clearance": {
    "primary_metabolic_organ": "string — enum: Liver | Kidney | Mixed | Unknown",
    "clearance_organ": "string — enum: Kidney | Liver | Biliary | Mixed",
    "renal_elimination_fraction": "float 0–1 — e.g. 0.15 means 15% renally eliminated",
    "cyp_profile": {
      "substrates": ["string — CYP enzyme e.g. 'CYP2C9'"],
      "inhibitors": ["string — CYP enzyme this drug inhibits"],
      "inducers": ["string — CYP enzyme this drug induces"],
      "pathway_evidence": "string | null — note on metabolic pathway"
    },
    "extra_information": "string | add dog & cats specific information in here"
  },

  "organ_burden_logic": {
    "note": "string — scoring methodology e.g. 'Score = sum of weights from triggered_keywords'",
    "dog": {
      "brain": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string — Paper's keyword that set this score"],
        "index": "integer — Paper's section index, -1 if not directly cited",
        "evidence": "string — Korean or English evidence note"
      },
      "blood": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      },
      "kidney": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      },
      "liver": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      },
      "heart": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      }
    },
    "cat": {
      "brain": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      },
      "blood": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      },
      "kidney": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      },
      "liver": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      },
      "heart": {
        "calculated_score": "integer 0–100",
        "triggered_keywords": ["string"],
        "index": "integer",
        "evidence": "string"
      }
    }
  },

  "timing_profile": {
    "onset_min": "integer — minutes to onset",
    "t_max_hr": "float — hours to peak plasma concentration",
    "half_life_hr": "float — elimination half-life in hours",
    "f_percent": "integer 0–100 — oral bioavailability %",
    "protein_binding_percent": "integer 0–100",
    "evidence": "string | null"
  },

  "drug_interactions": [
    {"note": "append more drug interactions as needed, each with drug name, severity (minor/moderate/major), mechanism keywords, and evidence note"},
    {
      "drug": "string — interacting drug name or class e.g. 'Corticosteroids'",
      "severity": "integer — 1=minor | 2=moderate | 3=critical/avoid",
      "keywords": ["string — mechanism keyword e.g. 'GI ulceration'"],
      "evidence": "string — English evidence note"
    },
    {
      "drug": "string — interacting drug name or class e.g. 'Corticosteroids'",
      "severity": "integer — 1=minor | 2=moderate | 3=critical/avoid",
      "keywords": ["string — mechanism keyword e.g. 'GI ulceration'"],
      "evidence": "string — English evidence note"
    } 
    
  ],

  "additive_risks": {
    "nephrotoxic": "boolean — additive renal load (triple whammy etc.)",
    "hepatotoxic": "boolean — additive hepatic load",
    "gi_ulcer": "boolean — additive GI ulceration risk",
    "bleeding": "boolean — additive bleeding risk",
    "sedation": "boolean — additive CNS sedation",
    "qt_prolongation": "boolean — additive QT interval risk"
  },

  "species_flags": {
    "species_contraindicated": ["string — e.g. 'cat_breed','dog_breed"],
    "mdr1_sensitive": "boolean — P-gp substrate, dangerous in MDR1-mutant breeds",
    "serotonin_syndrome_risk": "boolean",
    "electrolyte_effect": "string | null — e.g. 'k_depleting' | 'k_sparing'",
    "narrow_therapeutic_index": "boolean — TDM required",
    "washout_period_days": "integer — minimum days before switching (5 × half-life rule)"
  },

  "dosage_and_kinetics": {
    "dog": {
      "is_approved": "boolean — species-level regulatory approval",
      "dosage_list": [
        {
          "logic_type": "string — enum: linear | weight_band | fixed | max_capped",
          "context": "string — clinical indication e.g. 'Anti-inflammatory dose'",
          "value": "string — dose as string to support ranges e.g. '0.1 - 0.2'",
          "unit": "string — enum: mg/kg | mcg/kg | IU/kg | ml/kg | mg | EA",
          "route": "string — enum: PO | IV | SC | IM | Eye | Ear | Top | Inh",
          "frequency": "string — enum: SID | BID | TID | QID | q8h | q12h | Monthly | PRN",
          "max_dose_mg_kg": "float | null — safety ceiling",
          "evidence": "string | null <reference>"
        }
      ]
    },
    "cat": {
      "is_approved": "boolean",
      "dosage_list": [
        {
          "logic_type": "string",
          "context": "string",
          "value": "string",
          "unit": "string",
          "route": "string",
          "frequency": "string",
          "max_dose_mg_kg": "float | null",
          "evidence": "string | null"
        }
      ]
    }
  },

  "renal_dose_adjustment": {
    "creatinine_threshold_dog_mg_dL": "float | null — trigger creatinine for dogs",
    "creatinine_threshold_cat_mg_dL": "float | null — trigger creatinine for cats",
    "adjustment_type": "string — enum: reduce_dose | extend_interval | avoid | none",
    "adjustment_factor": "float 0–1 | null — multiplier e.g. 0.5 = half normal dose",
    "note": "string | null"
  },

  "hepatic_dose_adjustment": {
    "applies": "boolean — true only for NTI drugs with primary hepatic elimination",
    "alt_threshold_multiplier": "float | null — e.g. 3.0 = ALT > 3× upper normal triggers this",
    "adjustment_type": "string — enum: reduce_dose | monitor | avoid | none",
    "note": "string | null"
  },

  "contraindications": [
    {
      "condition": "string — condition name e.g. 'Renal disease'",
      "match_terms": ["string — EMR condition strings that auto-trigger this e.g. 'CKD'", "string — 'IRIS Stage'"],
      "severity": "string — enum: absolute | relative | caution",
      "action": "string — enum: contraindicated | reduce_dose | monitor | avoid",
      "lab_trigger": {
        "marker": "string | null — e.g. 'creatinine' | 'alt' | 'alp' | 'bun' | 'hct'",
        "threshold": "float | null",
        "unit": "string | null — e.g. 'mg/dL' | 'U/L' | '%'"
      }
    }
  ],

  "genetic_sensitivity": {
    "has_genetic_risk": "boolean",
    "affected_breeds": ["string — e.g. 'Shetland Sheepdog'"],
    "evidence": "string | null"
  },

  "effects_and_mechanisms": {
    "common_mechanism": "string — pharmacological mechanism of action",
    "common_extra_effects": ["string — known adverse effects"],
    "dog_mechanism": "string | null — dog-specific mechanism notes",
    "dog_extra_effects": ["string — dog-specific adverse effects"],
    "cat_mechanism": "string | null — cat-specific mechanism notes",
    "cat_extra_effects": ["string — cat-specific adverse effects"]
  },

  "species_notes": {
    "dog": "string — clinical note for dogs",
    "cat": "string — clinical note for cats"
  },

  "precautions": {
    "dog": {
      "status": "integer — 1=use with caution | 2=contraindicated",
      "evidence": "string"
    },
    "cat": {
      "status": "integer — 1=use with caution | 2=contraindicated",
      "evidence": "string"
    }
  },

  "storage_and_forms": {
    "storage": "string — storage conditions",
    "forms": ["string — available formulations"]
  },

  "section_1_2_10": {
    "highlights": "string — key clinical highlights (Korean preferred for EMR display)",
    "indications": "string — approved and off-label indications",
    "client_info": "string — owner-facing communication note"
  },

  "_data_quality": {
    "overall_confidence": "integer 0–100",
    "renal_adjustment_confidence": "string — enum: high | medium | low | none",
    "hepatic_adjustment_confidence": "string — enum: high | medium | low | none",
    "organ_burden_confidence": "string — enum: high | medium | low | none",
    "ddi_source": "string — enum: plumbs_direct | additive_class | cyp_derived | unknown"
  }
}
"""

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
            # rate limit은 attempt를 소비하지 않고 무한 재시도
            rate_retries = 0
            while True:
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
                    break  # 성공하면 while 루프 탈출
                except openai.RateLimitError:
                    rate_retries += 1
                    wait = min(rate_retries * 30, 300)  # 30초씩 증가, 최대 5분
                    log(f"  [RATE] {ingredient}: rate limited, waiting {wait}s... (rate retry {rate_retries})")
                    await asyncio.sleep(wait)

            try:
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

            except openai.APIError as e:
                if attempt == MAX_RETRIES:
                    return (ingredient, False, f"API error: {e}")
                await asyncio.sleep(2 ** attempt)

    return (ingredient, False, "max retries exceeded")


def resolve_api_key(cli_api_key: str | None) -> str:
    """CLI 인자 우선, 없으면 환경변수, 둘 다 없으면 프롬프트에서 입력받는다."""
    if cli_api_key:
        return cli_api_key.strip()

    env_api_key = os.environ.get("OPENAI_API_KEY")
    if env_api_key:
        return env_api_key.strip()

    entered_api_key = getpass("OpenAI API key: ").strip()
    if not entered_api_key:
        raise ValueError("OpenAI API key가 필요합니다. --api-key 인자 또는 OPENAI_API_KEY 환경변수를 사용하세요.")
    return entered_api_key


async def main(api_key: str, model: str, test_count: int | None = None):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    log("소스 데이터 로드 중...")
    drugs = load_all_drugs()
    log(f"총 {len(drugs)}개 약물 로드됨\n")

    if test_count:
        drugs = drugs[:test_count]
        log(f"테스트 모드: 처음 {test_count}개만 변환\n")

    global MODEL
    MODEL = model

    client = AsyncOpenAI(api_key=api_key)
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
    parser.add_argument("--api-key", type=str, default=None, help="OpenAI API key")
    parser.add_argument("--model", type=str, default=MODEL, help=f"사용할 모델명 (기본값: {MODEL})")
    parser.add_argument("--test", type=int, default=None, help="테스트할 약물 수 (예: --test 10)")
    args = parser.parse_args()

    api_key = resolve_api_key(args.api_key)
    asyncio.run(main(api_key=api_key, model=args.model, test_count=args.test))
