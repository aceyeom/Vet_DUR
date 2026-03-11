# DUR Engine Comparison & Decision

## Decision

**Option B selected — Client engine (`durEngine.js`) is the single DUR source of truth.**

The `/api/dur/analyze` endpoint has been removed from `backend/main.py`. The backend is responsible only for data (drug lookup, search) — not computation.

Rationale: The client engine is more complete, already wired in `FullSystem.jsx`, and produces the richer result contract that `ResultsDisplay.jsx` depends on. Switching to the backend engine would require porting 5+ missing features to Python and extending the response contract to include `drugAData`/`drugBData` (required by `DrugTimeline.jsx`).

---

## Engine Diff

### Rules present in `durEngine.js` but MISSING from the removed backend endpoint

| Rule | `durEngine.js` | Backend (removed) |
|------|---------------|-------------------|
| Duplicate NSAID | ✅ | ✅ |
| NSAID + Corticosteroid | ✅ | ✅ |
| CYP3A4 Inhibition | ✅ | ✅ |
| **CYP2D6 Inhibition** | ✅ | ❌ Missing |
| Serotonin Syndrome | ✅ | ✅ |
| QT Prolongation Stacking | ✅ | ✅ |
| Electrolyte-Mediated DDI | ✅ | ✅ |
| Renal Elimination Stacking | ✅ | ✅ |
| Bleeding Risk Stacking | ✅ | ✅ |
| **CYP Enzyme Induction** | ✅ | ❌ Missing |
| **Unknown Drug Fallback** | ✅ | ❌ Missing |

### Per-drug flags present in `durEngine.js` but MISSING from the removed backend endpoint

| Flag | `durEngine.js` | Backend (removed) |
|------|---------------|-------------------|
| Off-label (human drug) | ✅ | ✅ |
| **Foreign drug flag** (−8 confidence) | ✅ | ❌ Missing |
| **Unknown drug flag** (−25 confidence) | ✅ | ❌ Missing |
| MDR1 sensitivity | ✅ | ✅ |
| Narrow therapeutic index | ✅ | ✅ |
| **Species dose warning** (no approved dose) | ✅ | ❌ Missing |

### Result fields present in `durEngine.js` but MISSING from the removed backend endpoint

| Field | `durEngine.js` | Backend (removed) |
|-------|---------------|-------------------|
| `timestamp` | ✅ ISO 8601 string | ❌ Missing |
| `speciesNotes` | ✅ Array of `{drug, note}` | ❌ Missing |
| `interactions[].drugAData` | ✅ Full Drug object | ❌ Missing |
| `interactions[].drugBData` | ✅ Full Drug object | ❌ Missing |
| `interactions[].alternativeSuggestion` | ✅ | ❌ Missing |
| `interactions[].literatureSummary` | ✅ | ❌ Missing |
| `interactions[].literature` | ✅ Array of refs | ❌ Missing |
| `drugFlags[].activeSubstance` | ✅ | ❌ Missing |
| `drugFlags[].drugClass` | ✅ | ❌ Missing |
| `drugFlags[].speciesNote` | ✅ | ❌ Missing |
| `drugFlags[].hasSpeciesWarning` | ✅ | ❌ Missing |

### Result contract already satisfied by client engine (Task 6)

- `timestamp`: ✅ `new Date().toISOString()` on every call
- `speciesNotes`: ✅ Array of `{ drug: string, note: string }` objects, empty if none
- Both are always present in the object returned by `runFullDURAnalysis()`

---

## Files changed as a result of this decision

| File | Change |
|------|--------|
| `backend/main.py` | Removed `DrugInput`, `AnalyzeRequest`, `SEVERITY_SCORE`, `RISK_LEVELS`, `QT_LEVELS`, `_check_interactions()`, and `POST /api/dur/analyze` endpoint |
| `frontend/src/lib/api.js` | Removed `analyzeDurApi` export (no longer needed; logged in `cleanup_log.md`) |
| `frontend/src/pages/FullSystem.jsx` | No change — already uses `runFullDURAnalysis` from `durEngine.js` |
| `frontend/src/pages/Demo.jsx` | No change — already uses `runFullDURAnalysis` from `durEngine.js` |
