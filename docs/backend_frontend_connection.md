# Backend–Frontend Connection

## Overview

NuvoVet's frontend (React/Vite) connects to a FastAPI backend that serves drug data loaded from 641+ JSONL files. The frontend also runs a complete client-side DUR engine for low-latency interaction checking. The backend provides drug search, lookup, and a server-side mirror of the DUR engine.

---

## Architecture Diagram

```
Browser (React/Vite)
  ├── /demo route          → local static data only (drugDatabase.js, breedProfiles.js)
  └── /system route        → backend API (lib/api.js → FastAPI backend)
        ├── Drug search     → GET /api/drugs/search
        ├── Drug lookup     → GET /api/drugs/{id}
        └── DUR analysis    → POST /api/dur/analyze (optional; client engine is primary)

FastAPI (backend/main.py)
  └── Loads data from backend/data/converted/**/*.jsonl (641 drugs)
  └── Maps JSONL schema → frontend Drug contract on every request
```

---

## API Route Table

| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| `GET` | `/api/health` | Backend health check | — |
| `GET` | `/api/drugs/search` | Search drugs by name / Korean name / active ingredient / brand | `q` (string), `species` (dog\|cat), `limit` (int, max 100) |
| `GET` | `/api/drugs/{drug_id}` | Full drug record by slug ID | — |
| `GET` | `/api/drugs` | Paginated drug list with optional filters | `drug_class`, `source`, `limit`, `offset` |
| `POST` | `/api/dur/analyze` | Server-side DUR analysis (mirrors client engine) | Body: `{ drugs, species, weightKg, patientInfo }` |

---

## Data Flow

### Full System Drug Search

1. User types in `DrugInput.jsx` search box
2. `handleSearch()` calls `searchFn` prop (injected by `FullSystem.jsx`)
3. `searchFn` = `searchDrugsApi` from `frontend/src/lib/api.js`
4. `searchDrugsApi` → `GET /api/drugs/search?q={query}&species={species}`
5. Backend searches the in-memory JSONL index, maps results to Drug contract
6. Frontend renders results; user selects drug → added to prescription list

### Demo Route Drug Search

1. Same `DrugInput.jsx` component, but no `searchFn` prop passed
2. Falls back to synchronous `searchDrugs()` from `drugDatabase.js` (local static data)
3. No network request — works offline

### DUR Analysis

1. User clicks "Run Scan" in `FullSystem.jsx`
2. `runFullDURAnalysis(drugs, species, weightKg)` from `durEngine.js` is called **client-side**
3. Returns interactions, drug flags, overall severity, confidence score
4. Results rendered by `ResultsDisplay.jsx` + `OrganLoadIndicator.jsx` + `DrugTimeline.jsx`

The `/api/dur/analyze` endpoint exists for server-side validation but is not the primary path. Client-side execution gives sub-100ms response times.

---

## Drug Data Contract

The backend maps each JSONL file to the following frontend Drug object:

```typescript
interface Drug {
  // Identity
  id: string;              // Unique snake_case slug (from JSONL "id" field)
  name: string;            // English INN name
  nameKr: string | null;   // Korean INN name
  activeSubstance: string; // Active ingredient
  class: string;           // Drug class (NSAID, Corticosteroid, etc.)
  source: 'kr_vet' | 'human_offlabel' | 'foreign' | 'unknown';
  allergyClass: string | null;

  // DUR Engine inputs
  renalElimination: number;   // 0–1 fraction renally eliminated
  cypProfile: {
    substrate: string[];      // CYP enzymes this drug is a substrate of
    inhibitor: string[];      // CYP enzymes this drug inhibits
    inducer: string[];        // CYP enzymes this drug induces
  };
  riskFlags: {
    nephrotoxic: 'none' | 'low' | 'moderate' | 'high';
    hepatotoxic: 'none' | 'low' | 'moderate' | 'high';
    bleedingRisk: 'none' | 'low' | 'moderate' | 'high';
    giUlcer: 'none' | 'low' | 'moderate' | 'high';
    qtProlongation: 'none' | 'low' | 'moderate' | 'high';
  };
  mdr1Sensitive: boolean;
  serotoninSyndromeRisk: boolean;
  narrowTherapeuticIndex: boolean;
  electrolyteEffect: string | null;   // 'k_depleting' | 'k_sparing' | null
  washoutPeriodDays: number | null;   // 5× half-life rule

  // PK
  pk: {
    halfLife: number | null;        // hours
    timeToPeak: number | null;      // hours
    bioavailability: number | null; // 0–1
    proteinBinding: number | null;  // 0–1
    primaryElimination: 'hepatic' | 'renal' | 'mixed';
  };

  // Dosing
  defaultDose: { dog: number | null; cat: number | null };
  doseRange: { dog: [number, number] | null; cat: [number, number] | null };
  unit: string;   // 'mg/kg', etc.
  freq: string;   // 'SID', 'BID', etc.
  route: string;  // 'PO', 'SC', etc.

  // Clinical context
  speciesNotes: { dog: string | null; cat: string | null };
  contraindications: string[];
  organBurden: { dog: OrganScores; cat: OrganScores };
  renalDoseAdjustment: ReналAdjustment;
  hepaticDoseAdjustment: HePaticAdjustment;
  dataQuality: DataQuality;
}
```

---

## JSONL Schema → Drug Contract Mapping

| Frontend Field | JSONL Path | Notes |
|---|---|---|
| `id` | `$.id` | Slug from filename |
| `name` | `$.drug_identity.name_en` | English INN |
| `nameKr` | `$.drug_identity.name_ko` | Korean name |
| `activeSubstance` | `$.drug_identity.active_ingredient` | |
| `class` | `$.drug_identity.class` | |
| `source` | `$.drug_identity.source` | `kr_vet → kr_vet`, etc. |
| `renalElimination` | `$.metabolism_and_clearance.renal_elimination_fraction` | Float 0–1 |
| `cypProfile.substrate` | `$.metabolism_and_clearance.cyp_profile.substrates` | Array |
| `cypProfile.inhibitor` | `$.metabolism_and_clearance.cyp_profile.inhibitors` | Array |
| `cypProfile.inducer` | `$.metabolism_and_clearance.cyp_profile.inducers` | Array |
| `riskFlags.*` | `$.organ_burden_logic.dog.{organ}.calculated_score` + `$.additive_risks.*` | Derived |
| `mdr1Sensitive` | `$.species_flags.mdr1_sensitive` | Boolean |
| `serotoninSyndromeRisk` | `$.species_flags.serotonin_syndrome_risk` | Boolean |
| `narrowTherapeuticIndex` | `$.species_flags.narrow_therapeutic_index` | Boolean |
| `electrolyteEffect` | `$.species_flags.electrolyte_effect` | String or null |
| `washoutPeriodDays` | `$.species_flags.washout_period_days` | Integer |
| `pk.halfLife` | `$.timing_profile.half_life_hr` | May be `{min, max, mean}` — backend extracts `mean` |
| `pk.timeToPeak` | `$.timing_profile.t_max_hr` | Float (hours) |
| `pk.bioavailability` | `$.timing_profile.f_percent / 100` | Normalized to 0–1 |
| `pk.proteinBinding` | `$.timing_profile.protein_binding_percent / 100` | Normalized to 0–1 |
| `defaultDose.dog` | `$.dosage_and_kinetics.dog.dosage_list[0].value` | Range strings parsed to midpoint |
| `defaultDose.cat` | `$.dosage_and_kinetics.cat.dosage_list[0].value` | Range strings parsed to midpoint |
| `speciesNotes.dog` | `$.species_notes.dog` | String |
| `speciesNotes.cat` | `$.species_notes.cat` | String |
| `organBurden.dog.*` | `$.organ_burden_logic.dog.{brain,blood,kidney,liver,heart}.calculated_score` | Integer 0–100 |
| `renalDoseAdjustment` | `$.renal_dose_adjustment` | Mapped to camelCase |
| `contraindications` | `$.contraindications[].condition` | String array |
| `dataQuality` | `$._data_quality` | Confidence, ddi_source |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL (frontend `.env.local`) |
| `DB_HOST` | `localhost` | PostgreSQL host (backend `main.py`, unused in current file-based mode) |
| `DB_NAME` | `vet_dur` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `` | PostgreSQL password |
| `DB_PORT` | `5432` | PostgreSQL port |

---

## Running Locally

```bash
# Start backend (from repo root)
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Start frontend (from repo root)
cd frontend
cp .env.example .env.local   # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

The frontend dev server starts on `http://localhost:5173` by default.

---

## Confidence & Fallback Behavior

- `lib/api.js` wraps all fetch calls in `try/catch`.
- If the backend is unreachable, `apiFetch()` returns `null` and logs a warning in dev mode.
- `DrugInput.jsx` falls back to the local static `searchDrugs()` from `drugDatabase.js` if the API call throws.
- The Demo route (`/demo`) never calls the backend — it uses local data exclusively.
- DUR analysis is always run client-side via `durEngine.js` regardless of backend availability.

---

## Files

| File | Role |
|---|---|
| `backend/main.py` | FastAPI server — loads JSONL, maps to Drug contract, serves REST API |
| `backend/data/converted/**/*.jsonl` | 641 drug JSONL files (Plumb's-derived, schema in `drug_data_schema_final.json`) |
| `frontend/src/lib/api.js` | Async API client — wraps all backend calls with fallback |
| `frontend/src/pages/FullSystem.jsx` | Full system UI — passes `searchDrugsApi` to DrugInput |
| `frontend/src/components/DrugInput.jsx` | Drug search UI — accepts optional async `searchFn` prop |
| `frontend/src/pages/Demo.jsx` | Demo UI — local data only, no API calls |
| `frontend/src/utils/durEngine.js` | Client-side DUR rule engine — 9 rule types, pairwise matching |
| `frontend/src/data/drugDatabase.js` | Static drug DB — used by Demo; 28 curated drugs |
