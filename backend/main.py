"""
NuvoVet DUR Backend API
FastAPI server serving drug data from JSONL files at backend/data/converted/.
Maps the JSONL schema to the frontend Drug contract consumed by durEngine.js.
"""

import os
import json
import re
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


# ── DUR Analysis endpoint ─────────────────────────────────────────
# The client-side engine (durEngine.js) is the primary path.
# This endpoint mirrors the engine server-side for future use.

class DrugInput(BaseModel):
    id: str
    name: str
    class_: Optional[str] = None
    source: Optional[str] = None
    renalElimination: Optional[float] = 0.0
    mdr1Sensitive: Optional[bool] = False
    serotoninSyndromeRisk: Optional[bool] = False
    narrowTherapeuticIndex: Optional[bool] = False
    electrolyteEffect: Optional[str] = None
    cypProfile: Optional[dict] = None
    riskFlags: Optional[dict] = None
    speciesNotes: Optional[dict] = None
    defaultDose: Optional[dict] = None
    offLabelNote: Optional[str] = None

    class Config:
        populate_by_name = True


class AnalyzeRequest(BaseModel):
    drugs: List[dict]
    species: str = "dog"
    weightKg: Optional[float] = None
    patientInfo: Optional[dict] = None


SEVERITY_SCORE = {
    "critical": 100,
    "moderate": 50,
    "minor": 20,
    "none": 0,
}

RISK_LEVELS = {"none": 0, "low": 1, "moderate": 2, "high": 3}
QT_LEVELS   = {"none": 0, "low": 1, "moderate": 2, "high": 3}


def _check_interactions(drug_a: dict, drug_b: dict) -> Optional[dict]:
    """Run pairwise interaction checks (mirrors durEngine.js INTERACTION_MATRIX)."""
    cls_a = drug_a.get("class", "")
    cls_b = drug_b.get("class", "")
    cyp_a = drug_a.get("cypProfile") or {}
    cyp_b = drug_b.get("cypProfile") or {}
    risk_a = drug_a.get("riskFlags") or {}
    risk_b = drug_b.get("riskFlags") or {}
    add_a = drug_a.get("additiveRisks") or {}
    add_b = drug_b.get("additiveRisks") or {}

    # 1 — Duplicate NSAID
    if cls_a == "NSAID" and cls_b == "NSAID":
        return {
            "rule": "Duplicate NSAID",
            "severity": {"label": "Critical", "score": 100, "color": "red"},
            "mechanism": "Concurrent use of two NSAIDs causes additive GI, renal, and bleeding toxicity.",
            "recommendation": "Remove one NSAID. Never combine NSAIDs in veterinary patients.",
        }

    # 2 — NSAID + Corticosteroid
    if (cls_a == "NSAID" and cls_b == "Corticosteroid") or (cls_a == "Corticosteroid" and cls_b == "NSAID"):
        return {
            "rule": "NSAID + Corticosteroid GI Risk",
            "severity": {"label": "Critical", "score": 100, "color": "red"},
            "mechanism": "Combined use dramatically increases GI ulceration and perforation risk.",
            "recommendation": "Avoid concurrent use. If both are necessary, add a proton-pump inhibitor.",
        }

    # 3 — CYP3A4 inhibitor + CYP3A4 substrate
    if "CYP3A4" in (cyp_a.get("inhibitor") or []) and "CYP3A4" in (cyp_b.get("substrate") or []):
        return {
            "rule": "CYP3A4 Inhibition",
            "severity": {"label": "Moderate", "score": 50, "color": "orange"},
            "mechanism": f"{drug_a['name']} inhibits CYP3A4, increasing plasma concentration of {drug_b['name']}.",
            "recommendation": f"Reduce {drug_b['name']} dose by 25–50%. Monitor for toxicity.",
        }
    if "CYP3A4" in (cyp_b.get("inhibitor") or []) and "CYP3A4" in (cyp_a.get("substrate") or []):
        return {
            "rule": "CYP3A4 Inhibition",
            "severity": {"label": "Moderate", "score": 50, "color": "orange"},
            "mechanism": f"{drug_b['name']} inhibits CYP3A4, increasing plasma concentration of {drug_a['name']}.",
            "recommendation": f"Reduce {drug_a['name']} dose by 25–50%. Monitor for toxicity.",
        }

    # 4 — Serotonin syndrome
    if drug_a.get("serotoninSyndromeRisk") and drug_b.get("serotoninSyndromeRisk"):
        return {
            "rule": "Serotonin Syndrome Risk",
            "severity": {"label": "Critical", "score": 100, "color": "red"},
            "mechanism": "Both drugs increase serotonergic activity. Risk of serotonin syndrome.",
            "recommendation": "Avoid concurrent use. Monitor for hyperthermia, tremors, and agitation.",
        }

    # 5 — QT prolongation stacking
    qt_a = QT_LEVELS.get(risk_a.get("qtProlongation", "none"), 0)
    qt_b = QT_LEVELS.get(risk_b.get("qtProlongation", "none"), 0)
    if (qt_a >= 2 or qt_b >= 2) and (qt_a + qt_b >= 4):
        return {
            "rule": "QT Prolongation Stacking",
            "severity": {"label": "Critical", "score": 100, "color": "red"},
            "mechanism": "Combined QT-prolonging effects increase risk of fatal arrhythmias.",
            "recommendation": "Avoid combination or perform ECG monitoring. Correct electrolyte imbalances.",
        }

    # 6 — Electrolyte-mediated DDI (K-depleting + digoxin)
    if (drug_a.get("electrolyteEffect") == "k_depleting" and drug_b.get("id") == "digoxin") or \
       (drug_b.get("electrolyteEffect") == "k_depleting" and drug_a.get("id") == "digoxin"):
        return {
            "rule": "Electrolyte-Mediated DDI",
            "severity": {"label": "Critical", "score": 100, "color": "red"},
            "mechanism": "K-depleting diuretic sensitizes the myocardium to digoxin toxicity.",
            "recommendation": "Monitor serum potassium every 48–72 hours. Maintain K+ above 4.0 mEq/L.",
        }

    # 7 — Renal elimination stacking
    renal_a = drug_a.get("renalElimination") or 0
    renal_b = drug_b.get("renalElimination") or 0
    if renal_a >= 0.6 and renal_b >= 0.6:
        return {
            "rule": "Renal Elimination Stacking",
            "severity": {"label": "Moderate", "score": 50, "color": "orange"},
            "mechanism": f"Both {drug_a['name']} ({round(renal_a*100)}% renal) and {drug_b['name']} ({round(renal_b*100)}% renal) rely heavily on renal elimination.",
            "recommendation": "Reduce doses in patients with CKD IRIS Stage 2+. Monitor creatinine.",
        }

    # 8 — Bleeding risk stacking
    bleed_a = RISK_LEVELS.get(risk_a.get("bleedingRisk", "none"), 0)
    bleed_b = RISK_LEVELS.get(risk_b.get("bleedingRisk", "none"), 0)
    if bleed_a >= 2 and bleed_b >= 2:
        return {
            "rule": "Bleeding Risk Stacking",
            "severity": {"label": "Moderate", "score": 50, "color": "orange"},
            "mechanism": "Both drugs carry significant bleeding risk. Combined use increases hemorrhagic complications.",
            "recommendation": "Monitor for melena, petechiae. Add gastroprotectant if concurrent use is necessary.",
        }

    return None


@app.post("/api/dur/analyze")
def analyze_dur(request: AnalyzeRequest):
    """
    Server-side DUR analysis endpoint.
    Mirrors the client-side durEngine.js rule engine.
    """
    drugs = request.drugs
    species = request.species

    interactions = []
    drug_flags = []
    overall_score = 0

    # Per-drug flags
    for drug in drugs:
        flag = {
            "drugId": drug.get("id"),
            "drugName": drug.get("name"),
            "source": drug.get("source"),
            "flags": [],
            "confidenceAdjustment": 0,
        }
        if drug.get("source") == "human_offlabel":
            flag["flags"].append({
                "type": "off-label",
                "label": "Off-Label (Human Drug)",
                "description": drug.get("offLabelNote", "Human drug used off-label in veterinary medicine."),
                "severity": "info",
            })
            flag["confidenceAdjustment"] = -5
        if drug.get("mdr1Sensitive") and species == "dog":
            flag["flags"].append({
                "type": "mdr1",
                "label": "MDR1 Sensitivity",
                "description": "CRITICAL in MDR1-mutant breeds (Collies, Shelties, Australian Shepherds).",
                "severity": "critical",
            })
        if drug.get("narrowTherapeuticIndex"):
            flag["flags"].append({
                "type": "nti",
                "label": "Narrow Therapeutic Index",
                "description": "Small dosing changes can lead to toxicity. Therapeutic drug monitoring recommended.",
                "severity": "info",
            })
        drug_flags.append(flag)

    # Pairwise interaction checks
    for i in range(len(drugs)):
        for j in range(i + 1, len(drugs)):
            result = _check_interactions(drugs[i], drugs[j])
            if result:
                interactions.append({
                    "drugA": drugs[i].get("name"),
                    "drugB": drugs[j].get("name"),
                    "drugAClass": drugs[i].get("class"),
                    "drugBClass": drugs[j].get("class"),
                    **result,
                })
                overall_score = max(overall_score, result["severity"]["score"])

    # Overall severity
    if overall_score >= 100:
        overall = {"label": "Critical", "score": 100, "color": "red"}
    elif overall_score >= 50:
        overall = {"label": "Moderate", "score": 50, "color": "orange"}
    elif overall_score > 0:
        overall = {"label": "Minor", "score": 20, "color": "yellow"}
    else:
        overall = {"label": "None", "score": 0, "color": "green"}

    # Confidence score
    confidence = 95
    for flag in drug_flags:
        confidence += flag.get("confidenceAdjustment", 0)
    confidence = max(15, min(99, confidence))

    return {
        "interactions": sorted(interactions, key=lambda x: x["severity"]["score"], reverse=True),
        "drugFlags": drug_flags,
        "overallSeverity": overall,
        "confidenceScore": confidence,
        "species": species,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
