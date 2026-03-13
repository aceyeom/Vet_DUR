# Frontend-Backend Data Gap Analysis

## Purpose
This document explains the disconnect between:
- what the frontend currently requires to run key DUR features, and
- what the backend currently provides in its data formats.

It focuses on practical implementation readiness, not theoretical schema completeness.

## Scope Reviewed
- Frontend runtime requirements:
  - `frontend/src/data/drugDatabase.js`
  - `frontend/src/utils/durEngine.js`
  - `frontend/src/components/ResultsDisplay.jsx`
  - `frontend/src/components/DrugTimeline.jsx`
  - `frontend/src/components/DrugInput.jsx`
- Backend data formats:
  - Legacy simplified JSON: `backend/data/drugs.json`
  - Extracted section JSONL: `0.pdf_structure_for_experiment.jsonl`, `plumbs_output/*.jsonl`
  - New converted JSONL per ingredient: `backend/data/converted/**/**.jsonl`
  - Normalized DB schema target: `backend/db/schema.sql`

---

## 1) High-Level Disconnect

### Frontend expectation
The frontend is built around a denormalized, app-ready object model per drug plus pre-resolved interaction objects.

### Backend reality
Backend data exists in multiple shapes:
1. Raw and sectioned monograph text (good for extraction, not app runtime).
2. New converted ingredient JSONL (richer, semi-structured, but not normalized to frontend contract).
3. Normalized relational schema (strong long-term model, but not exposed to frontend as a single runtime payload).

### Result
The frontend cannot consume backend data directly without a mapping/aggregation layer.

---

## 2) Frontend Runtime Contract (What UI/Engine Actually Needs)

## 2.1 Drug search and card rendering requires
- `id`
- `name`, `nameKr`
- `activeSubstance`
- `class`
- `source` (`kr_vet`, `human_offlabel`, `foreign`, `unknown`)
- `route`
- `defaultDose` by species
- species flags/notes

## 2.2 DUR engine rule matching requires
- `cypProfile.substrate[]`
- `cypProfile.inhibitor[]`
- `cypProfile.inducer[]`
- `riskFlags.qtProlongation`
- `riskFlags.bleedingRisk`
- `renalElimination` (fraction)
- `narrowTherapeuticIndex` (boolean)
- `serotoninSyndromeRisk` (boolean)
- `electrolyteEffect` (for K-depleting logic)
- `mdr1Sensitive` (boolean)

## 2.3 Results page requires interaction output objects with
- `drugA`, `drugB`
- `drugAClass`, `drugBClass`
- `severity` (`label`, `score`, `color`)
- `rule`
- `mechanism`
- `recommendation`
- `alternativeSuggestion`
- optional evidence fields:
  - `literatureSummary`
  - `literature[]`

## 2.4 PK timeline requires
- `pk.halfLife`
- `pk.timeToPeak`
- `pk.bioavailability`
- optionally: `pk.proteinBinding`, `pk.primaryElimination`
- dosing frequency context (`SID/BID/TID`) or equivalent interval

---

## 3) Backend Formats vs Frontend Needs

## 3.1 Legacy `backend/data/drugs.json`
Pros:
- Already has some engine-friendly fields (`metabolism`, `risk_flags`, `elimination`, `dosing`).

Gaps:
- Too small sample set and not complete for production features.
- Field names differ from frontend contract.
- Missing many UI-specific fields (source badges, species notes, alternatives, literature references, etc.).

## 3.2 New converted JSONL (`backend/data/converted/**.jsonl`)
Pros:
- Rich clinical content with structured sections.
- Includes useful blocks such as:
  - `drug_identity`
  - `section_1_2_10`
  - `organ_systems_impact`
  - `timing_profile`
  - `drug_interactions`
  - `dosage_and_kinetics`
  - `effects_and_mechanisms`
- Better source depth than legacy `drugs.json`.

Gaps:
- Not in frontend-ready field shape.
- Many values are narrative text, not normalized enums/numbers.
- Some required rule fields are implicit in text but not explicit booleans/enums.
- Not yet a stable, versioned API contract for frontend consumption.

## 3.3 Normalized DB schema (`backend/db/schema.sql`)
Pros:
- Correct long-term architecture for scale and auditability.
- Has tables for most pharmacology concepts frontend needs (`cyp_profiles`, `pk_parameters`, `pd_risk_flags`, `ddi_pairs`, `dosing_rules`, etc.).

Gaps:
- Frontend cannot consume normalized tables directly.
- Requires joins, aggregation, and business logic to produce app-ready payloads.
- No single documented response contract currently mirrored in frontend.

---

## 4) Field-Level Gap Matrix

| Frontend Required Field | Backend Availability | Status | Notes |
|---|---|---|---|
| `id` (stable frontend drug key) | Partial | Gap | Backend has names/ids by context; needs canonical app id strategy. |
| `name`, `nameKr` | Yes | Mappable | From `drug_identity`/substance records. |
| `activeSubstance` | Partial | Gap | Present in normalized model; not always explicit in converted JSONL payloads. |
| `class` (UI class taxonomy) | Partial | Gap | Backend classes exist but need mapping to frontend class enum set. |
| `source` (`kr_vet`, `human_offlabel`, `foreign`, `unknown`) | Partial | Gap | Backend has provenance, but not exposed in frontend enum format. |
| `route` (single default route per UI drug card) | Partial | Gap | Backend supports multi-route; frontend currently assumes simplified route field. |
| `defaultDose` by species | Partial | Gap | Backend has dose rules; needs consolidation into default UI dose per species. |
| `speciesNotes` | Partial | Gap | Exists as text in sections and/or adverse notes; needs curated extraction. |
| `contraindications[]` | Partial | Gap | Exists in schema and text; needs flattened frontend list. |
| `cypProfile` arrays | Partial | Gap | Available in schema; in converted files often not normalized to array fields. |
| `riskFlags.qtProlongation` | Partial | Gap | Available conceptually; needs normalized enum mapping. |
| `riskFlags.bleedingRisk` | Partial | Gap | Available conceptually; needs normalized enum mapping. |
| `renalElimination` fraction | Partial | Gap | Present in PK model for some records; missing/variable coverage. |
| `serotoninSyndromeRisk` boolean | Partial | Gap | Exists in schema design; not consistently materialized in converted payload. |
| `electrolyteEffect` | Partial | Gap | Inferable from interactions/text but not stable per-drug enum field. |
| `mdr1Sensitive` boolean | Partial | Gap | Breed/genetic data exists in schema design; needs direct drug-level flag for UI. |
| `pk.halfLife`, `pk.timeToPeak`, `pk.bioavailability` | Partial | Gap | Some coverage in `timing_profile`/PK tables, but inconsistent and not standardized for UI model. |
| Pre-computed interaction cards (`mechanism`, `recommendation`, severity object) | Partial | Gap | Backend has ingredients and interactions but not consistently in exact frontend output shape. |
| Literature summary/citations per interaction | Partial | Gap | Source data exists; card-ready curated snippets not consistently generated. |

---

## 5) Feature Coverage Impact

## 5.1 Works with current backend data only after mapping
- Drug browsing/search (basic)
- Some dose display
- Some species warnings

## 5.2 Not reliably supported without additional transformation
- Rule engine parity for all frontend rules (CYP/QT/renal/bleeding/serotonin/electrolyte)
- PK timeline reliability across all listed drugs
- Stable confidence scoring inputs
- Card-ready, clinician-readable interaction recommendation payloads

---

## 6) Missing Data Categories (Practical)

1. Canonical app-level drug object
- No single backend output currently matches the frontend `Drug` object contract.

2. Normalized enum/boolean rule inputs
- Multiple critical frontend rule fields are present as prose but not as machine-safe flags.

3. Consistent quantitative PK coverage
- Half-life/peak/bioavailability are not uniformly present in a frontend-ready numeric format.

4. Interaction output contract
- Missing a stable backend response that matches `ResultsDisplay` card fields exactly.

5. Provenance-to-UI mapping
- Backend source richness is strong, but frontend-friendly confidence and source badges are not consistently generated.

---

## 7) Recommended Bridge Layer (Required)

Implement a backend adapter/service that produces two contracts:

## 7.1 `DrugRecord` (frontend input)
Minimum fields:
- Identity: `id`, `name`, `nameKr`, `activeSubstance`, `class`, `source`
- Clinical core: `route`, `defaultDose`, `contraindications`, `speciesNotes`
- Engine inputs: `cypProfile`, `riskFlags`, `renalElimination`, `serotoninSyndromeRisk`, `electrolyteEffect`, `mdr1Sensitive`, `narrowTherapeuticIndex`
- PK: `pk.halfLife`, `pk.timeToPeak`, `pk.bioavailability`, `pk.proteinBinding`, `pk.primaryElimination`

## 7.2 `DurScanResult` (frontend results)
Minimum fields:
- `overallSeverity`
- `confidenceScore`
- `drugFlags[]`
- `interactions[]` with full card content (`mechanism`, `recommendation`, alternatives, evidence)

Without these contracts, frontend integration will remain brittle and require heavy client-side assumptions.

---

## 8) Bottom Line

The backend has enough raw/clinical depth to support your frontend vision, but there is a format-contract gap.

The blocker is not only missing facts; it is mostly missing normalization and API shaping:
- backend data is rich but heterogeneous,
- frontend expects strict denormalized, rule-ready objects.

The next required step is a contract-first backend response layer that transforms normalized DB and converted JSON into stable frontend payloads.
