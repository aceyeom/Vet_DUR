# Frontend Cleanup Log

Performed as part of Task 4 — Frontend File Organization.
All files below were confirmed to have **zero active imports** from any page or live component before deletion.

---

## Deleted Files

| File | Reason |
|------|--------|
| `frontend/src/components/Workflow/AnalysisLoader.jsx` | Unused workflow step component; no imports in any page or active component. The `AnalysisScreen.jsx` in `FullSystem.jsx` and `Demo.jsx` covers the same UX. |
| `frontend/src/components/Workflow/PrescriptionEntry.jsx` | Unused workflow step; superseded by inline drug entry in `FullSystem.jsx`. |
| `frontend/src/components/Workflow/PrescriptionSummary.jsx` | Unused workflow step; superseded by inline results in `ResultsDisplay.jsx`. |
| `frontend/src/components/Workflow/SafetyReview.jsx` | Unused workflow step; DUR results are rendered directly by `ResultsDisplay.jsx`. |
| `frontend/src/components/Sidebar/Sidebar.jsx` | Stub component, never imported. `FullSystem.jsx` defines its own `PatientSidebar` internally. |
| `frontend/src/components/PatientPanel/PatientPanel.jsx` | Unused panel component; patient data entry is handled inline in `FullSystem.jsx`. |
| `frontend/src/components/PatientConfig.jsx` | Unused configuration component; superseded by inline patient form in `FullSystem.jsx`. |
| `frontend/src/components/Modals/DrugDictionaryModal.jsx` | Unused modal that referenced `drugDictionary.js`; drug search now handled by `DrugInput.jsx` + backend API. |
| `frontend/src/components/ConfidenceIndicator.jsx` | Unused indicator; confidence display is part of `ConfidenceProvenance.jsx` which is imported by `ResultsDisplay.jsx`. |
| `frontend/src/data/drugDictionary.js` | Only imported by `DrugDictionaryModal.jsx` and `usePrescriptionManager.js`, both of which are themselves unused. |
| `frontend/src/data/patientData.js` | Static patient seed data; no active import. Patient state is initialized inline in `FullSystem.jsx`. |
| `frontend/src/utils/durAnalysis.js` | Duplicate/older DUR utility; the canonical engine is `utils/durEngine.js`. No active imports of this file. |
| `frontend/src/hooks/usePrescriptionManager.js` | Unused hook from prior workflow architecture; prescription state is managed directly in `FullSystem.jsx`. |
| `frontend/src/hooks/useWorkflowState.js` | Unused hook from prior multi-step workflow; the current UI is a single-screen design with no step state. |

---

## Directory Changes

| Directory | Status | Reason |
|-----------|--------|--------|
| `frontend/src/components/Workflow/` | Removed (empty after deletions) | All 4 workflow step components deleted |
| `frontend/src/components/Modals/` | Removed (empty after deletions) | Only file was `DrugDictionaryModal.jsx` |
| `frontend/src/components/Sidebar/` | Removed (empty after deletions) | Only file was `Sidebar.jsx` |
| `frontend/src/components/PatientPanel/` | Removed (empty after deletions) | Only file was `PatientPanel.jsx` |
| `frontend/src/hooks/` | Removed (empty after deletions) | Both hook files deleted |

---

## Files Retained

All remaining files in `frontend/src/` have at least one active import from a page or live component:

| File | Used by |
|------|---------|
| `components/DrugInput.jsx` | `FullSystem.jsx`, `Demo.jsx` |
| `components/ResultsDisplay.jsx` | `FullSystem.jsx`, `Demo.jsx` |
| `components/OrganLoadIndicator.jsx` | `ResultsDisplay.jsx`, `Landing.jsx` |
| `components/SeverityBadge.jsx` | `ResultsDisplay.jsx`, `Landing.jsx` |
| `components/DrugTimeline.jsx` | `ResultsDisplay.jsx` |
| `components/AnalysisScreen.jsx` | `FullSystem.jsx`, `Demo.jsx` |
| `components/ConfidenceProvenance.jsx` | `ResultsDisplay.jsx` |
| `components/ScanExportPDF.jsx` | `ResultsDisplay.jsx` |
| `components/MolecularBackground.jsx` | `AnalysisScreen.jsx`, `Landing.jsx` |
| `components/RequestAccessModal.jsx` | `Landing.jsx` |
| `components/NuvovetLogo.jsx` | `Layout/Header.jsx` |
| `components/Layout/Header.jsx` | `App.jsx` |
| `data/drugDatabase.js` | `DrugInput.jsx`, `Demo.jsx` |
| `data/drugSearchData.js` | `DrugInput.jsx` |
| `data/breedProfiles.js` | `FullSystem.jsx`, `Demo.jsx` |
| `data/emrSchema.js` | `DrugInput.jsx`, `FullSystem.jsx` |
| `utils/durEngine.js` | `FullSystem.jsx`, `Demo.jsx` |
| `lib/api.js` | `FullSystem.jsx` |
| `hooks/` | (directory removed; no hooks remain) |
| `i18n/en.js`, `i18n/ko.js`, `i18n/index.jsx` | `App.jsx`, all pages |
| `pages/Landing.jsx` | `App.jsx` |
| `pages/FullSystem.jsx` | `App.jsx` |
| `pages/Demo.jsx` | `App.jsx` |

---

*Cleanup performed: 2026-03-11*

---

## Integration Repair — 2026-03-11

### Deleted Files

| File | Reason |
|------|--------|
| `frontend/src/data/drugSearchData.js` | Removed as part of Task 3. `DrugInput.jsx` previously imported `searchDrugCatalog` and `DRUG_SEARCH_CATALOG` for browse mode and search augmentation. Both replaced by backend API calls (`GET /api/drugs` and `GET /api/drugs/search`). Zero remaining imports confirmed before deletion. |

### Removed API Exports

| Export | File | Reason |
|--------|------|--------|
| `analyzeDurApi` | `frontend/src/lib/api.js` | Removed as part of Task 7. The `/api/dur/analyze` backend endpoint was removed (Task 5, Option B decision). The client-side `runFullDURAnalysis()` in `durEngine.js` is the single DUR engine. Zero import references in the frontend. |

### Removed Backend Code

| Code | File | Reason |
|------|------|--------|
| `POST /api/dur/analyze` endpoint + helpers (`DrugInput`, `AnalyzeRequest`, `_check_interactions`, etc.) | `backend/main.py` | Removed as part of Task 5, Option B. Client engine is more complete (9 rules vs 8; CYP2D6, CYP induction, unknown drug fallback, richer per-drug flags). See `docs/engine_diff.md`. |
