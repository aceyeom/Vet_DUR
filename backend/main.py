"""
NuvoVet DUR Backend API
FastAPI server serving drug data from JSONL files at backend/data/converted/.
Maps the JSONL schema to the frontend Drug contract consumed by durEngine.js.
"""

import os
import json
import re
import base64
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nuvovet")

app = FastAPI(title="NuvoVet DUR API", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data" / "converted"

# ── Drug loading ──────────────────────────────────────────────────
_DRUG_CACHE: Optional[Dict[str, Any]] = None
_SEARCH_INDEX: Optional[List[Dict[str, Any]]] = None


def _load_all_drugs() -> Dict[str, Any]:
    drugs: Dict[str, Any] = {}
    loaded = skipped = 0
    for path in DATA_DIR.rglob("*.jsonl"):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and "id" in data:
                drugs[data["id"]] = data
                loaded += 1
        except Exception as e:
            skipped += 1
    logger.info(f"Loaded {loaded} drugs ({skipped} skipped)")
    return drugs


def get_drug_db() -> Dict[str, Any]:
    global _DRUG_CACHE, _SEARCH_INDEX
    if _DRUG_CACHE is None:
        _DRUG_CACHE = _load_all_drugs()
        _SEARCH_INDEX = _build_search_index(_DRUG_CACHE)
    return _DRUG_CACHE


def _build_search_index(db: Dict[str, Any]) -> List[Dict[str, Any]]:
    index = []
    for drug_id, raw in db.items():
        identity = raw.get("drug_identity") or {}
        name_en = (identity.get("name_en") or "").lower()
        name_ko = (identity.get("name_ko") or "").lower()
        active = (identity.get("active_ingredient") or "").lower()
        brands = [b.lower() for b in (identity.get("brand_names") or [])]
        index.append({
            "id": drug_id,
            "name_en": name_en,
            "name_ko": name_ko,
            "active": active,
            "brands": brands,
            "class": identity.get("class", ""),
        })
    return index


# ── Mapping utilities ─────────────────────────────────────────────

def _risk_score_to_level(score: Any) -> str:
    try:
        s = int(score or 0)
    except (ValueError, TypeError):
        return "none"
    if s >= 60:
        return "high"
    elif s >= 35:
        return "moderate"
    elif s > 5:
        return "low"
    return "none"


def _map_source(source_str: Optional[str]) -> str:
    mapping = {
        "kr_vet": "kr_vet",
        "human_offlabel": "human_offlabel",
        "foreign": "foreign",
    }
    return mapping.get(source_str or "", "unknown")


def _map_primary_elimination(organ: Optional[str]) -> str:
    organ = (organ or "").lower()
    if "liver" in organ or "hepat" in organ:
        return "hepatic"
    elif "kidney" in organ or "renal" in organ:
        return "renal"
    elif "mixed" in organ:
        return "mixed"
    return "hepatic"


def _extract_half_life(raw_hl: Any) -> Optional[float]:
    """Handle half_life_hr as number or dict {min, max, mean}."""
    if raw_hl is None:
        return None
    if isinstance(raw_hl, (int, float)):
        return float(raw_hl)
    if isinstance(raw_hl, dict):
        if raw_hl.get("mean") is not None:
            return float(raw_hl["mean"])
        lo = raw_hl.get("min")
        hi = raw_hl.get("max")
        if lo is not None and hi is not None:
            return (float(lo) + float(hi)) / 2
        v = lo or hi
        return float(v) if v is not None else None
    return None


def _parse_dose_value(val: Any) -> Optional[float]:
    """Parse dose value string or number to float; handles ranges."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        val_str = str(val).strip()
        # Range like "0.1 - 0.2" or "0.1–0.2"
        parts = re.split(r"\s*[-–]\s*", val_str)
        if len(parts) == 2:
            try:
                return (float(parts[0]) + float(parts[1])) / 2
            except ValueError:
                pass
        return None


def _get_default_dose(dosage_kinetics: Optional[dict], species: str) -> Optional[float]:
    if not dosage_kinetics:
        return None
    sp = dosage_kinetics.get(species) or {}
    dl = sp.get("dosage_list") or []
    if not dl:
        return None
    return _parse_dose_value(dl[0].get("value"))


def _get_dose_range(dosage_kinetics: Optional[dict], species: str) -> Optional[List[float]]:
    """Return [min, max] dose range for a species, or None."""
    if not dosage_kinetics:
        return None
    sp = dosage_kinetics.get(species) or {}
    dl = sp.get("dosage_list") or []
    if not dl:
        return None
    val_str = str(dl[0].get("value", "")).strip()
    parts = re.split(r"\s*[-–]\s*", val_str)
    if len(parts) == 2:
        try:
            return [float(parts[0]), float(parts[1])]
        except ValueError:
            pass
    v = _parse_dose_value(val_str)
    return [v, v] if v is not None else None


def _map_drug(raw: dict) -> dict:
    """Map JSONL drug record → frontend Drug contract."""
    identity = raw.get("drug_identity") or {}
    meta = raw.get("metabolism_and_clearance") or {}
    cyp = meta.get("cyp_profile") or {}
    organ = raw.get("organ_burden_logic") or {}
    timing = raw.get("timing_profile") or {}
    sp_flags = raw.get("species_flags") or {}
    dosage = raw.get("dosage_and_kinetics") or {}
    additive = raw.get("additive_risks") or {}
    species_notes_raw = raw.get("species_notes") or {}
    renal_adj = raw.get("renal_dose_adjustment") or {}
    hepatic_adj = raw.get("hepatic_dose_adjustment") or {}
    section = raw.get("section_1_2_10") or {}
    data_quality = raw.get("_data_quality") or {}
    genetic = raw.get("genetic_sensitivity") or {}
    effects = raw.get("effects_and_mechanisms") or {}

    # Organ burden scores
    dog_organ = organ.get("dog") or {}
    cat_organ = organ.get("cat") or {}
    dog_kidney = (dog_organ.get("kidney") or {}).get("calculated_score", 0) or 0
    dog_liver  = (dog_organ.get("liver")  or {}).get("calculated_score", 0) or 0
    dog_blood  = (dog_organ.get("blood")  or {}).get("calculated_score", 0) or 0

    # Risk flags — derived from additive_risks booleans + organ burden scores
    nephrotoxic_level = _risk_score_to_level(dog_kidney) if additive.get("nephrotoxic") else (
        _risk_score_to_level(dog_kidney // 2)
    )
    hepatotoxic_level = _risk_score_to_level(dog_liver) if additive.get("hepatotoxic") else (
        _risk_score_to_level(dog_liver // 2)
    )
    bleeding_level = "high" if additive.get("bleeding") else (
        "low" if dog_blood > 20 else "none"
    )
    gi_ulcer_level  = "high" if additive.get("gi_ulcer") else "low"
    qt_level        = "high" if additive.get("qt_prolongation") else "none"
    sedation_flag   = bool(additive.get("sedation"))

    # PK
    f_pct = timing.get("f_percent")
    bioavail = (f_pct / 100.0) if f_pct is not None else None
    pb_pct = timing.get("protein_binding_percent")
    protein_binding = (pb_pct / 100.0) if pb_pct is not None else None

    # Default doses
    dog_dose = _get_default_dose(dosage, "dog")
    cat_dose = _get_default_dose(dosage, "cat")

    # First dog dosage row for unit/freq/route defaults
    dog_dl = (dosage.get("dog") or {}).get("dosage_list") or []
    first_dog = dog_dl[0] if dog_dl else {}

    # Contraindications
    contras = raw.get("contraindications") or []
    contra_conditions = [c.get("condition", "") for c in contras if isinstance(c, dict) and c.get("condition")]

    # Species notes — may be dict or plain string in some records
    def _species_note(sp: str) -> Optional[str]:
        val = species_notes_raw.get(sp)
        if isinstance(val, str):
            return val
        if isinstance(val, dict):
            return val.get("note") or val.get("text")
        return None

    # Affected breeds from genetic sensitivity
    affected_breeds = genetic.get("affected_breeds") or []

    return {
        # Identity
        "id": raw.get("id", ""),
        "name": identity.get("name_en") or "",
        "nameKr": identity.get("name_ko"),
        "activeSubstance": identity.get("active_ingredient") or identity.get("name_en") or "",
        "class": identity.get("class") or "Unknown",
        "source": _map_source(identity.get("source")),
        "allergyClass": identity.get("allergy_class"),
        "offLabelNote": identity.get("off_label_note"),
        "hasReversal": bool(identity.get("has_reversal")),
        "reversalAgent": identity.get("reversal_agent"),
        "formularyStatus": identity.get("formulary_status", "active"),
        "brandNames": identity.get("brand_names") or [],
        "dosageForms": identity.get("dosage_form") or [],
        "availableStrengths": identity.get("available_strengths") or [],

        # Engine input fields (must match durEngine.js expectations)
        "renalElimination": meta.get("renal_elimination_fraction") or 0.0,
        "cypProfile": {
            "substrate": cyp.get("substrates") or [],
            "inhibitor": cyp.get("inhibitors") or [],
            "inducer": cyp.get("inducers") or [],
        },
        "riskFlags": {
            "nephrotoxic": nephrotoxic_level,
            "hepatotoxic": hepatotoxic_level,
            "bleedingRisk": bleeding_level,
            "giUlcer": gi_ulcer_level,
            "qtProlongation": qt_level,
        },
        "additiveRisks": {
            "nephrotoxic": bool(additive.get("nephrotoxic")),
            "hepatotoxic": bool(additive.get("hepatotoxic")),
            "giUlcer": bool(additive.get("gi_ulcer")),
            "bleeding": bool(additive.get("bleeding")),
            "sedation": sedation_flag,
            "qtProlongation": bool(additive.get("qt_prolongation")),
        },
        "mdr1Sensitive": bool(sp_flags.get("mdr1_sensitive")),
        "serotoninSyndromeRisk": bool(sp_flags.get("serotonin_syndrome_risk")),
        "narrowTherapeuticIndex": bool(sp_flags.get("narrow_therapeutic_index")),
        "electrolyteEffect": sp_flags.get("electrolyte_effect"),
        "washoutPeriodDays": sp_flags.get("washout_period_days"),
        "speciesContraindicated": sp_flags.get("species_contraindicated") or [],

        # PK
        "pk": {
            "halfLife": _extract_half_life(timing.get("half_life_hr")),
            "timeToPeak": timing.get("t_max_hr"),
            "bioavailability": bioavail,
            "proteinBinding": protein_binding,
            "primaryElimination": _map_primary_elimination(meta.get("primary_metabolic_organ")),
        },

        # Dosing
        "defaultDose": {
            "dog": dog_dose,
            "cat": cat_dose,
        },
        "doseRange": {
            "dog": _get_dose_range(dosage, "dog"),
            "cat": _get_dose_range(dosage, "cat"),
        },
        "unit": first_dog.get("unit", "mg/kg"),
        "freq": first_dog.get("frequency", "SID"),
        "route": first_dog.get("route", "PO"),
        "isApproved": {
            "dog": bool((dosage.get("dog") or {}).get("is_approved")),
            "cat": bool((dosage.get("cat") or {}).get("is_approved")),
        },

        # Clinical
        "speciesNotes": {
            "dog": _species_note("dog"),
            "cat": _species_note("cat"),
        },
        "contraindications": contra_conditions,
        "highlights": section.get("highlights"),
        "indications": section.get("indications"),
        "clientInfo": section.get("client_info"),
        "commonMechanism": effects.get("common_mechanism"),
        "commonAdverseEffects": effects.get("common_extra_effects") or [],

        # Organ burden
        "organBurden": {
            "dog": {
                "brain":  (dog_organ.get("brain")  or {}).get("calculated_score", 0) or 0,
                "blood":  dog_blood,
                "kidney": dog_kidney,
                "liver":  dog_liver,
                "heart":  (dog_organ.get("heart")  or {}).get("calculated_score", 0) or 0,
            },
            "cat": {
                "brain":  (cat_organ.get("brain")  or {}).get("calculated_score", 0) or 0,
                "blood":  (cat_organ.get("blood")  or {}).get("calculated_score", 0) or 0,
                "kidney": (cat_organ.get("kidney") or {}).get("calculated_score", 0) or 0,
                "liver":  (cat_organ.get("liver")  or {}).get("calculated_score", 0) or 0,
                "heart":  (cat_organ.get("heart")  or {}).get("calculated_score", 0) or 0,
            },
        },

        # Dose adjustments
        "renalDoseAdjustment": {
            "creatinineThresholdDog": renal_adj.get("creatinine_threshold_dog_mg_dL"),
            "creatinineThresholdCat": renal_adj.get("creatinine_threshold_cat_mg_dL"),
            "adjustmentType": renal_adj.get("adjustment_type", "none"),
            "adjustmentFactor": renal_adj.get("adjustment_factor"),
            "note": renal_adj.get("note"),
        },
        "hepaticDoseAdjustment": {
            "applies": bool(hepatic_adj.get("applies")),
            "altThresholdMultiplier": hepatic_adj.get("alt_threshold_multiplier"),
            "adjustmentType": hepatic_adj.get("adjustment_type", "none"),
            "note": hepatic_adj.get("note"),
        },

        # Genetic sensitivity
        "geneticSensitivity": {
            "hasGeneticRisk": bool(genetic.get("has_genetic_risk")),
            "affectedBreeds": affected_breeds,
            "evidence": genetic.get("evidence"),
        },

        # Raw interactions from JSONL for display
        "rawInteractions": raw.get("drug_interactions") or [],

        # Data quality
        "dataQuality": {
            "overallConfidence": data_quality.get("overall_confidence") or 75,
            "renalConfidence": data_quality.get("renal_adjustment_confidence", "medium"),
            "hepaticConfidence": data_quality.get("hepatic_adjustment_confidence", "medium"),
            "organBurdenConfidence": data_quality.get("organ_burden_confidence", "medium"),
            "ddiSource": data_quality.get("ddi_source", "unknown"),
        },
    }


# ── Startup ───────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    logger.info("Loading drug database...")
    get_drug_db()
    logger.info("Drug database ready.")
    if not _ANTHROPIC_API_KEY:
        logger.warning(
            "ANTHROPIC_API_KEY is not set — the /api/ocr/extract-patient endpoint will return 503. "
            "Set ANTHROPIC_API_KEY in your environment to enable EMR screenshot import."
        )


# ── Endpoints ─────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    db = get_drug_db()
    return {"status": "ok", "drug_count": len(db)}


@app.get("/api/drugs/search")
def search_drugs(
    q: str = Query(default="", description="Search query"),
    species: Optional[str] = Query(default=None, description="Filter species: dog | cat"),
    limit: int = Query(default=20, le=100),
):
    """Search drugs by name, Korean name, active ingredient, or brand name."""
    db = get_drug_db()
    if not q or len(q.strip()) < 1:
        return {"results": [], "total": 0}

    query = q.strip().lower()
    results = []

    for entry in (_SEARCH_INDEX or []):
        score = 0
        if entry["name_en"].startswith(query):
            score = 100
        elif entry["active"].startswith(query):
            score = 90
        elif query in entry["name_en"]:
            score = 70
        elif query in entry["name_ko"]:
            score = 70
        elif query in entry["active"]:
            score = 60
        elif any(query in b for b in entry["brands"]):
            score = 50

        if score > 0:
            results.append((score, entry["id"]))

    results.sort(key=lambda x: x[0], reverse=True)
    result_ids = [r[1] for r in results[:limit]]

    mapped = []
    for drug_id in result_ids:
        raw = db.get(drug_id)
        if not raw:
            continue
        try:
            drug = _map_drug(raw)
            # Apply species filter: exclude if no approved dose for species
            if species and drug["defaultDose"].get(species) is None:
                continue
            mapped.append(drug)
        except Exception as e:
            logger.warning(f"Error mapping {drug_id}: {e}")

    return {"results": mapped, "total": len(mapped)}


@app.get("/api/drugs/{drug_id}")
def get_drug(drug_id: str):
    """Get full drug record by ID."""
    db = get_drug_db()
    raw = db.get(drug_id)
    if not raw:
        raise HTTPException(status_code=404, detail=f"Drug '{drug_id}' not found")
    try:
        return _map_drug(raw)
    except Exception as e:
        logger.error(f"Error mapping drug {drug_id}: {e}")
        raise HTTPException(status_code=500, detail="Error mapping drug data")


@app.get("/api/drugs")
def list_drugs(
    drug_class: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
):
    """List drugs with optional class/source filters."""
    db = get_drug_db()
    items = list(db.values())

    if drug_class:
        items = [d for d in items if (d.get("drug_identity") or {}).get("class") == drug_class]
    if source:
        items = [d for d in items if (d.get("drug_identity") or {}).get("source") == source]

    total = len(items)
    page = items[offset: offset + limit]
    results = []
    for raw in page:
        try:
            results.append(_map_drug(raw))
        except Exception as e:
            logger.warning(f"Skipping {raw.get('id')}: {e}")

    return {"results": results, "total": total, "offset": offset, "limit": limit}


@app.get("/api/breeds")
def list_breeds(
    species: Optional[str] = Query(default=None, description="Filter by species: dog | cat"),
):
    """
    Return all breeds found in genetic_sensitivity.affected_breeds across the drug database,
    deduplicated and sorted alphabetically.  Each entry includes an mdr1 flag if the breed
    appears in a drug where mdr1_sensitive is true.
    """
    db = get_drug_db()
    breed_mdr1: Dict[str, bool] = {}

    for raw in db.values():
        genetic = raw.get("genetic_sensitivity") or {}
        sp_flags = raw.get("species_flags") or {}
        is_mdr1 = bool(sp_flags.get("mdr1_sensitive"))
        affected = genetic.get("affected_breeds") or []

        # Species filter: skip if this drug only applies to the other species
        if species:
            dosage = raw.get("dosage_and_kinetics") or {}
            has_species = bool(dosage.get(species))
            if not has_species:
                pass  # Still include breeds since breed list is species-agnostic

        for breed in affected:
            if not isinstance(breed, str) or not breed.strip():
                continue
            breed = breed.strip()
            if breed not in breed_mdr1:
                breed_mdr1[breed] = False
            if is_mdr1:
                breed_mdr1[breed] = True

    results = sorted(
        [{"breed": b, "mdr1": m} for b, m in breed_mdr1.items()],
        key=lambda x: x["breed"].lower(),
    )
    return {"breeds": results, "total": len(results)}


@app.get("/api/conditions")
def list_conditions():
    """
    Return all unique match_terms from contraindications[] across the drug database.
    These are the exact strings the DUR engine matches against patient conditions.
    """
    db = get_drug_db()
    terms: set[str] = set()

    for raw in db.values():
        contras = raw.get("contraindications") or []
        for c in contras:
            if not isinstance(c, dict):
                continue
            for term in (c.get("match_terms") or []):
                if isinstance(term, str) and term.strip():
                    terms.add(term.strip())

    sorted_terms = sorted(terms, key=str.lower)
    return {"conditions": sorted_terms, "total": len(sorted_terms)}


@app.get("/api/allergies")
def list_allergies():
    """
    Return all unique allergy_class values from drug_identity across the drug database.
    """
    db = get_drug_db()
    classes: set[str] = set()

    for raw in db.values():
        identity = raw.get("drug_identity") or {}
        allergy_class = identity.get("allergy_class")
        if isinstance(allergy_class, str) and allergy_class.strip():
            classes.add(allergy_class.strip())

    sorted_classes = sorted(classes, key=str.lower)
    return {"allergies": sorted_classes, "total": len(sorted_classes)}


# ── OCR Patient Extraction ────────────────────────────────────────

_ANTHROPIC_API_KEY: Optional[str] = os.environ.get("ANTHROPIC_API_KEY")

_OCR_EXTRACTION_PROMPT = """You are extracting structured patient data from a veterinary EMR screenshot. Return a JSON object with exactly these fields and no others. If a field cannot be found in the image, return null for that field. Do not guess or infer values that are not visible in the image.

{
  "patient_name": "string | null",
  "species": "dog | cat | null",
  "breed": "string | null",
  "weight_kg": "float | null",
  "sex": "string | null",
  "age_years": "float | null",
  "conditions": ["string"] | [],
  "allergies": ["string"] | [],
  "current_drugs": ["string"] | [],
  "creatinine_mg_dL": "float | null",
  "alt_u_L": "float | null",
  "owner_phone": "string | null"
}

Return only valid JSON. No explanation, no markdown, no commentary."""


@app.post("/api/ocr/extract-patient")
async def ocr_extract_patient(image: UploadFile = File(...)):
    """
    Accept a PNG/JPG/WEBP image, pass it to the Claude claude-haiku-4-5-20251001 vision model
    for structured patient data extraction, and return the parsed JSON.
    The image is not stored anywhere — processed and discarded immediately.
    """
    if not _ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OCR feature unavailable: ANTHROPIC_API_KEY not configured on the server.",
        )

    # Validate file type
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    content_type = image.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{content_type}'. Use PNG, JPEG, or WEBP.",
        )

    # Read image bytes
    image_bytes = await image.read()
    if len(image_bytes) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(status_code=413, detail="Image too large. Maximum 20 MB.")

    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    # Map content type to Anthropic media_type
    media_type_map = {
        "image/png": "image/png",
        "image/jpeg": "image/jpeg",
        "image/webp": "image/webp",
    }
    media_type = media_type_map.get(content_type, "image/jpeg")

    try:
        import anthropic as anthropic_sdk
        client = anthropic_sdk.Anthropic(api_key=_ANTHROPIC_API_KEY)

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": _OCR_EXTRACTION_PROMPT,
                        },
                    ],
                }
            ],
        )

        raw_text = message.content[0].text.strip()

        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            raw_text = "\n".join(
                l for l in lines
                if not l.startswith("```")
            ).strip()

        extracted = json.loads(raw_text)
        return {"ok": True, "data": extracted}

    except json.JSONDecodeError as e:
        logger.warning(f"OCR JSON parse error: {e}")
        raise HTTPException(
            status_code=422,
            detail="Could not parse extracted data from image. Please fill in the form manually.",
        )
    except Exception as e:
        logger.error(f"OCR extraction error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Could not extract data from this screenshot. Please fill in the form manually.",
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
