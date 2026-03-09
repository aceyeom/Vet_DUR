#!/usr/bin/env python3
"""
plumbs_output/*.jsonl → backend/data/converted/{drug}.jsonl 변환 스크립트

Claude API를 사용하여 raw monograph 텍스트를 structured JSON schema로 변환.
Usage:
  export CLAUDE_API_KEY=<your_claude_api_key>
  python3 실험실.py --test 10
  python3 실험실.py
  python3 실험실.py --api-key <your_claude_api_key>
"""

import json
import re
import asyncio
import argparse
import time
from datetime import datetime, timezone
from pathlib import Path
from getpass import getpass

import anthropic
import os
from anthropic import AsyncAnthropic


def log(msg):
    print(msg, flush=True)


def extract_claude_text(response) -> str:
    """Claude Messages API 응답에서 텍스트 블록만 추출"""
    text_parts = []
    for block in getattr(response, "content", []) or []:
        if getattr(block, "type", None) != "text":
            continue
        text_parts.append(getattr(block, "text", ""))

    result = "".join(text_parts).strip()
    if not result:
        raise ValueError("Empty Claude response content")
    return result


# ─── 설정 ───────────────────────────────────────────────
INPUT_DIR = Path("plumbs_output")
OUTPUT_DIR = Path("backend/data/converted")
ERROR_LOG = Path("conversion_errors.log")
MODEL = "claude-sonnet-4-6"  # Sonnet: higher accuracy for safety-critical fields
MAX_CONCURRENT = 1           # API rate limit 대응
MAX_RETRIES = 7
REQUEST_DELAY = 8            # 요청 간 최소 대기(초)

# ─── few-shot 예시 (schema v2.1.0) ──────────────────────
EXAMPLE_OUTPUT = """
{
  "id": "string — unique slug, snake_case e.g. 'meloxicam'",

  "drug_identity": {
    "name_ko": "string — Korean INN name e.g. '멜록시캄'",
    "name_en": "string — English INN name e.g. 'Meloxicam'",
    "active_ingredient": "string — canonical active ingredient INN (may differ from brand)",
    "brand_names": ["string — known brand names e.g. 'Metacam'"],
    "allergy_class": "string | null — cross-reactivity class e.g. 'beta-lactam' | 'sulfonamide' | null",
    "class": "string — enum: NSAID | Corticosteroid | Antibiotic | Antiparasitic | Antifungal | Analgesic | Cardiac | Diuretic | Sedative | Antiemetic | GI Protectant | Anticonvulsant | Antidepressant | ACE Inhibitor | Bronchodilator | Immunosuppressant | Thyroid | Hormone | Antineoplastic Agent | Antiretroviral | Opioid | Muscle Relaxant | Reversal Agent | Unknown",
    "source": "string — enum: kr_vet | human_offlabel | foreign | unknown",
    "formulary_status": "string — enum: active | discontinued | restricted | unknown",
    "has_reversal": "boolean",
    "reversal_agent": "string | null",
    "reversal_evidence": "string | null",
    "off_label_note": "string | null — only for human_offlabel source",
    "dosage_form": ["string — array, each from enum: Tab | Inj | Cap | Susp | Drop | Oint | Topical | Ophthalmic | Patch | Oral Liquid | Chewable"],
    "available_strengths": [
      { "value": "float", "unit": "string — enum: mg | mcg | IU | mg/mL | mcg/mL | IU/mL | mg/kg | mcg/kg | IU/kg | ml/kg | % | EA" }
    ]
  },

  "metabolism_and_clearance": {
    "primary_metabolic_organ": "string — enum: Liver | Kidney | Mixed | Unknown",
    "clearance_organ": "string — enum: Kidney | Liver | Biliary | Mixed | Unknown",
    "renal_elimination_fraction": "float 0–1 | null — e.g. 0.15 means 15% renally eliminated. null if not quantified.",
    "cyp_profile": {
      "substrates": ["string — CYP enzyme e.g. 'CYP2C9'. Leave [] if not in Plumb's."],
      "inhibitors": ["string — CYP enzyme this drug inhibits. Leave [] if not in Plumb's."],
      "inducers": ["string — CYP enzyme this drug induces. Leave [] if not in Plumb's."],
      "pathway_evidence": "string | null — note on metabolic pathway from source text"
    },
    "extra_information": "string | null — dog & cat specific PK notes from Plumb's"
  },

  "organ_burden_logic": {
    "note": "string — scoring note e.g. 'Score = sum of weights from triggered_keywords. Human data only; no veterinary PK studies.'",
    "dog": {
      "brain":  { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer — -1 if not directly cited", "evidence": "string" },
      "blood":  { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" },
      "kidney": { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" },
      "liver":  { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" },
      "heart":  { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" }
    },
    "cat": {
      "brain":  { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" },
      "blood":  { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" },
      "kidney": { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" },
      "liver":  { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" },
      "heart":  { "calculated_score": "integer 0–100", "triggered_keywords": ["string"], "index": "integer", "evidence": "string" }
    }
  },

  "timing_profile": {
    "onset_min": "integer | null — minutes to onset. null if not reported in source.",
    "t_max_hr": "float | null — hours to peak plasma concentration",
    "half_life_hr": {
      "min": "float | null — lower end of reported range (hours)",
      "max": "float | null — upper end of reported range (hours)",
      "mean": "float | null — mean or midpoint; use when only a single value is reported",
      "species": "string — enum: dog | cat | human | unknown — species these values apply to"
    },
    "f_percent": "integer 0–100 | null — oral bioavailability %",
    "protein_binding_percent": "integer 0–100 | null",
    "evidence": "string | null"
  },

  "_ddi_note": "string | null — DDI extraction methodology note e.g. 'Extracted from Plumb\\'s Drug Interactions section. Severity: contraindicated→3, major→3, moderate→2, minor→1.'",

  "drug_interactions": [
    {
      "drug": "string — interacting drug name or class e.g. 'Corticosteroids'",
      "severity": "integer — 1=minor | 2=moderate | 3=critical/avoid",
      "keywords": ["string — mechanism keyword e.g. 'GI ulceration'"],
      "evidence": "string — English evidence note"
    }
  ],

  "additive_risks": {
    "nephrotoxic": "boolean — additive renal load",
    "hepatotoxic": "boolean — additive hepatic load",
    "gi_ulcer": "boolean — additive GI ulceration risk",
    "bleeding": "boolean — additive bleeding risk",
    "sedation": "boolean — true if somnolence or sedation is a reported adverse effect",
    "qt_prolongation": "boolean — additive QT interval risk"
  },

  "risk_flags": {
    "nephrotoxic": "string — enum: none | low | moderate | high",
    "hepatotoxic": "string — enum: none | low | moderate | high",
    "gi_ulcer": "string — enum: none | low | moderate | high",
    "bleeding": "string — enum: none | low | moderate | high",
    "qt_prolongation": "string — enum: none | low | moderate | high"
  },

  "species_flags": {
    "species_contraindicated": ["string — e.g. 'cat_all' | 'dog_collie'"],
    "mdr1_sensitive": "boolean — P-gp substrate, dangerous in MDR1-mutant breeds",
    "serotonin_syndrome_risk": "boolean",
    "electrolyte_effect": "string | null — e.g. 'k_depleting' | 'k_sparing' | null",
    "narrow_therapeutic_index": "boolean — TDM required",
    "washout_period_days": "float | null — compute as round(5 × half_life_hr.mean / 24, 1). null if half_life unknown."
  },

  "dosage_and_kinetics": {
    "dog": {
      "is_approved": "boolean",
      "dosage_list": [
        {
          "logic_type": "string — enum: linear | weight_band | fixed | max_capped | tiered",
          "context": "string — clinical indication e.g. 'Anti-inflammatory dose'",
          "value": "string — dose as string to support ranges e.g. '0.1 - 0.2'",
          "unit": "string — enum: mg/kg | mcg/kg | IU/kg | ml/kg | mg | EA",
          "route": "string — enum: PO | IV | SC | IM | Eye | Ear | Top | Inh | CRI",
          "frequency": "string — enum: SID | BID | TID | QID | q8h | q12h | q24h | q48h | Monthly | PRN | Once",
          "max_dose_mg_kg": "float | null",
          "duration_note": "string | null — e.g. 'max 5 days' | 'taper after 7 days'",
          "evidence": "string | null"
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
          "duration_note": "string | null",
          "evidence": "string | null"
        }
      ]
    }
  },

  "renal_dose_adjustment": {
    "creatinine_threshold_dog_mg_dL": "float | null",
    "creatinine_threshold_cat_mg_dL": "float | null",
    "adjustment_type": "string — enum: reduce_dose | extend_interval | avoid | none | unknown",
    "adjustment_factor": "float 0–1 | null",
    "note": "string | null"
  },

  "hepatic_dose_adjustment": {
    "applies": "boolean",
    "alt_threshold_multiplier": "float | null",
    "adjustment_type": "string — enum: reduce_dose | monitor | avoid | none | unknown",
    "note": "string | null"
  },

  "contraindications": [
    {
      "condition": "string — condition name e.g. 'Renal disease'",
      "match_terms": ["string — EMR condition strings e.g. 'CKD'"],
      "severity": "string — enum: absolute | relative | caution",
      "action": "string — enum: contraindicated | reduce_dose | monitor | avoid",
      "lab_trigger": {
        "marker": "string | null — e.g. 'creatinine' | 'alt' | 'alp' | 'bun' | 'hct' | 'plt'",
        "threshold": "float | null",
        "unit": "string | null — e.g. 'mg/dL' | 'U/L' | '%' | 'x10^3/uL'"
      }
    }
  ],

  "genetic_sensitivity": {
    "has_genetic_risk": "boolean",
    "affected_breeds": ["string — e.g. 'Shetland Sheepdog'"],
    "gene": "string | null — e.g. 'ABCB1 (MDR1)' | 'CYP2D6'",
    "evidence": "string | null"
  },

  "effects_and_mechanisms": {
    "common_mechanism": "string — pharmacological mechanism of action",
    "common_extra_effects": ["string — known adverse effects"],
    "dog_mechanism": "string | null",
    "dog_extra_effects": ["string"],
    "cat_mechanism": "string | null",
    "cat_extra_effects": ["string"]
  },

  "species_notes": {
    "dog": "string — clinical note for dogs",
    "cat": "string — clinical note for cats"
  },

  "precautions": {
    "dog": { "status": "integer — 0=none | 1=caution | 2=contraindicated", "evidence": "string" },
    "cat": { "status": "integer — 0=none | 1=caution | 2=contraindicated", "evidence": "string" }
  },

  "storage_and_forms": {
    "storage": "string | null",
    "forms": ["string"]
  },

  "section_1_2_10": {
    "highlights": "string — key clinical highlights (Korean preferred)",
    "indications": "string — approved and off-label indications",
    "client_info": "string — owner-facing communication note (Korean preferred)"
  },

  "_data_quality": {
    "overall_confidence": "integer 0–100 — weighted: dosage 40% + DDI 30% + PK 20% + organ_burden 10%",
    "renal_adjustment_confidence": "string — enum: high | medium | low | none. Use 'high' ONLY if source explicitly states a dose adjustment recommendation.",
    "hepatic_adjustment_confidence": "string — enum: high | medium | low | none. Use 'high' ONLY if source explicitly states a dose adjustment recommendation.",
    "organ_burden_confidence": "string — enum: high | medium | low | none. Use 'high' only if veterinary species-specific data is present.",
    "ddi_source": "string — enum: plumbs_direct | additive_class | cyp_derived | pmc_rag | unknown",
    "plumbs_sections_found": ["string — Plumb's sections that were populated e.g. 'Pharmacokinetics'"],
    "missing_sections": ["string — Plumb's sections that were absent or empty"],
    "requires_pmc_rag": "boolean — true if any critical field is null/unknown",
    "pmc_rag_fields": ["string — field paths needing PMC RAG e.g. 'cyp_profile.substrates'"]
  }
}
"""

# ─── System prompt ──────────────────────────────────────
SYSTEM_PROMPT = """You are a veterinary clinical pharmacologist and Korean medical translator.
Convert a raw Plumb's Veterinary Drug Handbook monograph into a single JSON object matching the provided schema exactly.

CRITICAL RULES:
1. Return exactly one valid JSON object. No markdown, no commentary, no code fences.
2. Follow the example output's top-level keys and nested structure exactly.
3. Keep every required section even when data is missing. Use type-appropriate defaults: null, [], false, 0, or "Unknown".
4. All evidence, note, highlights, indications, client_info, species_notes, and other clinician-facing narrative fields must be written in Korean.
5. Keep controlled enum values, drug names, routes, frequencies, organ names, and CYP enzyme names in the format shown by the schema.
6. Extract dosage values exactly as written in the source. Do not round, normalize away ranges, or invent missing doses.
7. dosage_and_kinetics.dog and dosage_and_kinetics.cat are mandatory. If a species has no stated dose, set dosage_list to [] and is_approved to false.
8. organ_burden_logic.*.*.calculated_score must be an integer 0–100. If the text does not support a score, use 0, empty triggered_keywords, index -1, and a short Korean evidence note.
9. drug_interactions must contain ONLY actual extracted drug/class interactions. Do NOT include any object with a "note" key — that is a schema error. Use _ddi_note for methodology notes.
10. Do not hallucinate reversal agents, approval status, contraindications, dose adjustments, kinetics, genetic risks, or interaction mechanisms.
11. Use _data_quality to reflect uncertainty when the monograph lacks support.
12. name_ko should be the standard Korean drug name; otherwise provide the most established Korean transliteration.

SCHEMA-SPECIFIC ENFORCEMENT (fixes for known extraction errors):
A. dosage_form MUST be a JSON array e.g. ["Tab", "Inj"]. NEVER use pipe-separated strings like "Tab | Inj".
B. half_life_hr MUST be a JSON object: {"min": float|null, "max": float|null, "mean": float|null, "species": "dog"|"cat"|"human"|"unknown"}. NEVER a plain float.
C. MAOI interactions involving any serotonergic drug MUST have severity: 3 (critical/avoid). Not 2.
D. washout_period_days = round(5 × half_life_hr.mean / 24, 1). If half_life_hr.mean is null, set washout_period_days to null. NEVER output 0 unless the drug has a confirmed zero half-life.
E. renal_adjustment_confidence and hepatic_adjustment_confidence: use "high" ONLY when the source text explicitly states a dose adjustment recommendation or explicitly states no adjustment is needed. Use "medium" when the text implies adjustment by class. Use "low" when no relevant text exists.
F. risk_flags must be populated with graduated severity (none/low/moderate/high). Must be logically consistent with additive_risks booleans: if additive_risks.nephrotoxic=true then risk_flags.nephrotoxic must be "moderate" or "high".
G. additive_risks.sedation: set true if somnolence, sedation, drowsiness, or CNS depression is listed as an adverse effect of this drug, even if it is not primarily a sedative.
H. drug_identity.brand_names: populate with any brand names mentioned in the source text. Use [] if none found.
I. formulary_status: use "active" for drugs currently in use, "discontinued" if text states withdrawn/banned, "restricted" if controlled substance, "unknown" otherwise.
J. _data_quality.pmc_rag_fields: list every field that remains null or [] due to insufficient source data (e.g. "cyp_profile.substrates", "timing_profile.onset_min")."""

# ─── User prompt template ──────────────────────────────
USER_PROMPT_TEMPLATE = """Convert this monograph into the target JSON schema.

Requirements:
- Match the example output's structure exactly, including every top-level section.
- Use the example as a schema guide only, not as literal content.
- Preserve all enumerated field formats shown in the example.
- Return JSON only.

## Example Output Schema
{example}

## Drug name
{ingredient}

## Raw monograph
{raw_content}
"""

# ─── 핵심 함수들 ────────────────────────────────────────

def load_all_drugs() -> list[dict]:
    """plumbs_output/*.jsonl에서 모든 약물 로드. source_file 필드 포함."""
    drugs = []
    for f in sorted(INPUT_DIR.glob("*.jsonl"), key=lambda x: int(x.stem)):
        with open(f, encoding="utf-8") as fh:
            for line_num, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    entry["_source_file"] = str(f)
                    drugs.append(entry)
                except json.JSONDecodeError as e:
                    log(f"  [SKIP] {f.name} line {line_num}: JSON 파싱 에러 - {e}")
    return drugs


def get_output_path(ingredient: str) -> Path:
    """약물명 → 출력 파일 경로 (알파벳 폴더 구조)"""
    safe_name = re.sub(r"[^\w\-]", "_", ingredient.lower()).strip("_")
    first_letter = ingredient[0].upper()
    if not first_letter.isalpha():
        first_letter = "_"
    folder = OUTPUT_DIR / first_letter
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{safe_name}.jsonl"


_RISK_FLAG_VALUES = {"none", "low", "moderate", "high"}

def validate_result(data: dict, ingredient: str) -> list[str]:
    """변환 결과 유효성 검증. 문제가 있으면 에러 메시지 리스트 반환."""
    errors = []
    required_keys = [
        "id", "drug_identity", "metabolism_and_clearance",
        "organ_burden_logic", "timing_profile", "drug_interactions",
        "additive_risks", "risk_flags", "species_flags", "dosage_and_kinetics",
        "renal_dose_adjustment", "hepatic_dose_adjustment",
        "contraindications", "genetic_sensitivity",
        "effects_and_mechanisms", "species_notes", "precautions",
        "storage_and_forms", "section_1_2_10", "_data_quality",
    ]
    for key in required_keys:
        if key not in data:
            errors.append(f"Missing top-level key: {key}")

    # dosage_form must be a list
    di = data.get("drug_identity", {})
    dosage_form = di.get("dosage_form")
    if dosage_form is not None and not isinstance(dosage_form, list):
        errors.append(f"drug_identity.dosage_form must be an array, got: {type(dosage_form).__name__}")

    # half_life_hr must be an object
    tp = data.get("timing_profile", {})
    hl = tp.get("half_life_hr")
    if hl is not None and not isinstance(hl, dict):
        errors.append(f"timing_profile.half_life_hr must be an object, got: {type(hl).__name__}")
    elif isinstance(hl, dict) and "mean" not in hl:
        errors.append("timing_profile.half_life_hr missing 'mean' key")

    # drug_interactions must not contain a {note: ...} object
    for i, item in enumerate(data.get("drug_interactions", [])):
        if isinstance(item, dict) and "note" in item and "drug" not in item:
            errors.append(f"drug_interactions[{i}] is a stray note object — move to _ddi_note")

    # risk_flags graduated severity
    rf = data.get("risk_flags", {})
    for field in ("nephrotoxic", "hepatotoxic", "gi_ulcer", "bleeding", "qt_prolongation"):
        val = rf.get(field)
        if val not in _RISK_FLAG_VALUES:
            errors.append(f"risk_flags.{field} = {val!r} (must be none|low|moderate|high)")

    # additive_risks / risk_flags consistency
    ar = data.get("additive_risks", {})
    for field in ("nephrotoxic", "hepatotoxic"):
        if ar.get(field) is True and rf.get(field) in (None, "none", "low"):
            errors.append(
                f"Inconsistency: additive_risks.{field}=true but risk_flags.{field}={rf.get(field)!r}"
            )

    # dosage completeness
    dk = data.get("dosage_and_kinetics", {})
    has_any_dosage = False
    for species in ("dog", "cat"):
        if species not in dk:
            errors.append(f"Missing dosage_and_kinetics.{species}")
            continue
        dl = dk[species].get("dosage_list")
        if not isinstance(dl, list):
            errors.append(f"dosage_and_kinetics.{species}.dosage_list is not a list")
        elif dl:
            has_any_dosage = True
    if not has_any_dosage:
        errors.append("dosage_list empty for both dog and cat")

    # organ burden scores
    obl = data.get("organ_burden_logic", {})
    for species in ("dog", "cat"):
        sp = obl.get(species, {})
        for organ in ("brain", "blood", "kidney", "liver", "heart"):
            organ_data = sp.get(organ)
            if not isinstance(organ_data, dict):
                errors.append(f"organ_burden_logic.{species}.{organ} missing or not an object")
                continue
            score = organ_data.get("calculated_score")
            if not isinstance(score, int) or not (0 <= score <= 100):
                errors.append(
                    f"organ_burden_logic.{species}.{organ}.calculated_score = {score!r} (not int 0-100)"
                )

    return errors


async def convert_one(
    client: AsyncAnthropic,
    drug: dict,
    semaphore: asyncio.Semaphore,
    model: str,
) -> tuple[str, bool, str]:
    """단일 약물 변환. Returns (ingredient, success, message)"""
    ingredient = drug["ingredient"]
    source_file = drug.get("_source_file", "unknown")
    output_path = get_output_path(ingredient)

    if output_path.exists():
        return (ingredient, True, "already exists")

    user_prompt = USER_PROMPT_TEMPLATE.format(
        example=EXAMPLE_OUTPUT,
        ingredient=ingredient,
        raw_content=drug["raw_content"][:40000],
    )

    async with semaphore:
        for attempt in range(1, MAX_RETRIES + 1):
            rate_retries = 0

            while True:
                try:
                    await asyncio.sleep(REQUEST_DELAY)
                    response = await client.messages.create(
                        model=model,
                        max_tokens=16384,
                        system=SYSTEM_PROMPT,
                        messages=[{"role": "user", "content": user_prompt}],
                        temperature=0,
                    )
                    break
                except anthropic.RateLimitError:
                    rate_retries += 1
                    wait = min(rate_retries * 30, 300)
                    log(f"  [RATE] {ingredient}: rate limited, waiting {wait}s (rate retry {rate_retries})")
                    await asyncio.sleep(wait)
                except anthropic.NotFoundError as e:
                    return (ingredient, False, f"Model not found: {model}. 원본 오류: {e}")

            try:
                raw_text = extract_claude_text(response)

                # Strip accidental markdown fences
                if raw_text.startswith("```"):
                    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                    raw_text = re.sub(r"\s*```$", "", raw_text)

                data = json.loads(raw_text)

                # Inject extraction metadata before writing
                data["_extraction_metadata"] = {
                    "model_used": model,
                    "extraction_pass": 1,
                    "source_file": source_file,
                    "extracted_at": datetime.now(timezone.utc).isoformat(),
                    "reviewer": None,
                }

                validation_errors = validate_result(data, ingredient)
                if validation_errors:
                    log(f"  [WARN] {ingredient}: {'; '.join(validation_errors)}")

                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                log(f"  [OK] {ingredient}")
                return (ingredient, True, "converted")

            except (json.JSONDecodeError, ValueError) as e:
                if attempt == MAX_RETRIES:
                    return (ingredient, False, f"Parse error: {e}")
                log(f"  [RETRY] {ingredient}: JSON parse error, attempt {attempt}/{MAX_RETRIES}")
                await asyncio.sleep(5 * attempt)

            except anthropic.APIError as e:
                if attempt == MAX_RETRIES:
                    return (ingredient, False, f"API error: {e}")
                await asyncio.sleep(2 ** attempt)

    return (ingredient, False, "max retries exceeded")


def resolve_api_key(cli_api_key: str | None) -> str:
    """CLI 인자 우선, 없으면 환경변수, 둘 다 없으면 프롬프트에서 입력받는다."""
    if cli_api_key:
        return cli_api_key.strip()

    env_api_key = os.environ.get("CLAUDE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if env_api_key:
        return env_api_key.strip()

    entered_api_key = getpass("Anthropic API key: ").strip()
    if not entered_api_key:
        raise ValueError(
            "Anthropic API key가 필요합니다. --api-key 인자 또는 CLAUDE_API_KEY/ANTHROPIC_API_KEY 환경변수를 사용하세요."
        )
    return entered_api_key


async def main(api_key: str, model: str, test_count: int | None = None):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    log("소스 데이터 로드 중...")
    drugs = load_all_drugs()
    log(f"총 {len(drugs)}개 약물 로드됨\n")

    if test_count:
        drugs = drugs[:test_count]
        log(f"테스트 모드: 처음 {test_count}개만 변환\n")

    client = AsyncAnthropic(api_key=api_key)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    start_time = time.time()
    tasks = [convert_one(client, drug, semaphore, model) for drug in drugs]
    results = await asyncio.gather(*tasks)

    success   = [r for r in results if r[1]]
    failed    = [r for r in results if not r[1]]
    skipped   = [r for r in results if r[1] and r[2] == "already exists"]
    converted = [r for r in results if r[1] and r[2] == "converted"]

    elapsed = time.time() - start_time

    log(f"\n{'='*60}")
    log(f"완료! ({elapsed:.1f}초)")
    log(f"  성공: {len(success)}개 (새로 변환: {len(converted)}, 기존: {len(skipped)})")
    log(f"  실패: {len(failed)}개")

    if failed:
        log("\n실패 목록:")
        with open(ERROR_LOG, "w", encoding="utf-8") as f:
            for ingredient, _, msg in failed:
                line = f"  {ingredient}: {msg}"
                log(line)
                f.write(line + "\n")
        log(f"\n에러 로그: {ERROR_LOG}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", type=str, default=None, help="Anthropic API key")
    parser.add_argument("--model", type=str, default=MODEL, help=f"사용할 모델명 (기본값: {MODEL})")
    parser.add_argument("--test", type=int, default=None, help="테스트할 약물 수 (예: --test 10)")
    args = parser.parse_args()

    api_key = resolve_api_key(args.api_key)
    asyncio.run(main(api_key=api_key, model=args.model, test_count=args.test))
