# NuvoVet Cleanup Log

This file records fields removed from the UI and the reason for each removal.
It exists to track what was cut so future contributors can restore fields
that belong in the UI once a proper backend persistence layer is in place.

---

## DrugInput.jsx — Prescription line-item fields removed (2026-03-13)

These fields existed in the "per-drug" prescription card inside `DrugInput.jsx`
as part of the `buildPrescriptionLineItem` contract (from `emrSchema.js`).
They were audited against `durEngine.js` and no engine rule reads them.
They have been removed from the drug-add UI; the underlying schema objects
(`emrSchema.js`) are **not changed** — the data model still supports them.

| Field | Removed from | Reason |
|---|---|---|
| `folderName` | DrugCard prescription fields grid | EMR billing/admin field. Not read by any DUR rule or engine. Belongs in a full EMR billing module, not the DUR input form. |
| `treatmentCategory` | DrugCard prescription fields grid | Admin/billing classification. Not consumed by durEngine.js or organ load scorer. |
| `sellingPrice` | DrugCard prescription fields grid | Financial billing field. Not relevant to drug safety analysis. |
| `vatApplicable` | DrugCard bottom row | Financial billing flag. Not consumed by any engine. |
| `calculatedDose_mg` display | DrugCard bottom row | Removed from the inline summary row (was showing raw computed value). The DoseCalculator widget already shows a more readable formatted dose above. |
| `totalDose_mg` display | DrugCard bottom row | Same as above — billing-oriented total dose display. |

**Fields that were reviewed and kept:**

| Field | Kept because |
|---|---|
| `dosePerKg` | Used as input for dose scaling modifier in OrganLoadIndicator (Problem 3). Optional — engine runs without it. |
| `doseUnit` | Required for correct dose-scaling calculation. |
| `daysSupplied` | Clinically relevant; used for dose duration context in DoseCalculator display. |
| `timesPerDay` | Clinically relevant frequency field; shown in dose output. |
| `route` | Clinically relevant; affects species-specific dosing guidance. |

---

## FullSystem.jsx — PatientSidebar fields moved to Stage 2 (2026-03-13)

The old layout had a full-height left sidebar with many patient detail fields
visible before the vet ran any DUR check. These were **moved to Stage 2**
(the "추가 정보로 정밀도 높이기" panel that appears after the initial DUR
result), not deleted.

| Field/Section | From → To | Note |
|---|---|---|
| Breed | PatientSidebar → Stage 2 | First field in Stage 2 panel |
| Sex | PatientSidebar → Stage 2 | |
| Age / Date of birth | PatientSidebar → Stage 2 | Stage 2 shows age in years for simplicity |
| Known allergies | PatientSidebar → Stage 2 | |
| Chronic conditions | PatientSidebar → Stage 2 | |
| Creatinine (lab result) | PatientSidebar labs → Stage 2 | With IRIS threshold hint |
| ALT (lab result) | PatientSidebar labs → Stage 2 | |

The following fields were **removed from the visible form entirely** as they
are administrative/billing rather than DUR-relevant:

| Field | Removed from | Reason |
|---|---|---|
| `animalChartId` | PatientSidebar identity section | EMR chart ID. Not consumed by DUR engine. TODO: restore when backend EMR integration exists. |
| `patientStatus` (정상/사망/기타) | PatientSidebar | Administrative status. Not consumed by DUR engine. |
| `statusChangeDate` | PatientSidebar | Same as above. |
| `animalRegistrationNumber` | PatientSidebar registration section | Government microchip registration. Not DUR-relevant. |
| `registrationDate` / `lastVisitDate` | PatientSidebar | Admin dates. Not DUR-relevant. |
| `attendingVet` / `primaryVet` | PatientSidebar medical team section | Staff assignment. Not DUR-relevant. |
| `bodyCondition` (BCS) | PatientSidebar physical section | Not currently read by any DUR rule. |
| `bloodType` | PatientSidebar | Not currently read by any DUR rule. |
| `diet` | PatientSidebar | Not currently read by any DUR rule. |
| `insuranceGroup` / `privateInsuranceNumber` | PatientSidebar | Billing fields. Not DUR-relevant. |
| `temperature` / `heartRate` / `respRate` (vitals) | PatientSidebar | Vitals not currently read by DUR engine. |
| BUN, ALP, glucose, HCT, t4, bnp, phosphorus, electrolytes (labs) | PatientSidebar labs | Only creatinine and ALT are currently used by the organ load logic. Others are moved out. |
| `history` (clinical history text) | PatientSidebar | Free-text narrative. Not consumed by DUR engine. |
| Quick-load demo dropdown | PatientSidebar header | Replaced by patient search (localStorage). |

---

## TODO — Backend Persistence

Patient data is currently persisted to `localStorage` under the key pattern
`nuvovet_patient_v1`. This is a temporary measure.

**Action required (future):** Implement a proper patient record API on the
backend (FastAPI + database) to replace localStorage. When implemented:
- Wire the patient search bar in Stage 1 to the backend patient endpoint
- Remove the localStorage save/load logic from FullSystem.jsx
- Move patient chart ID, registration number, and vet assignment back into
  the UI as those fields become relevant with real record storage.

---

---

## Full System Revamp (2026-03-14)

### Task 1 — Design and Layout Overhaul

| Change | File | Reason |
|---|---|---|
| Removed emoji icons (🐕 🐈) from species toggle buttons | `FullSystem.jsx` | Task 1: No cartoon/emoji icons. Use text labels only. |
| EMR import button moved to top of patient section, styled as prominent secondary action (full-width dashed border) | `FullSystem.jsx` | Task 1: Must be visually distinct, reads as time-saving shortcut. |
| Layout restructured into 3 clear sections with dividers: Patient Details → Prescription → Run DUR | `FullSystem.jsx` | Task 1: Clear visual hierarchy between sections. |

### Task 2 — Patient Entry Form Rebuild

| Change | File | Reason |
|---|---|---|
| "Returning patient?" search field added at top of patient section (with owner_phone search) | `FullSystem.jsx` | Task 2: Returning patient lookup before animal type selection. |
| Species toggle is now text-only ("개 / Canine", "고양이 / Feline") | `FullSystem.jsx` | Task 2: Text only, no icons. |
| Breed, Weight, Sex fields revealed via CSS transition after species selection | `FullSystem.jsx` | Task 2: Smooth reveal after species select. |
| Breed selector queries backend `GET /api/breeds?species=` with MDR1 warning indicator | `FullSystem.jsx`, `api.js`, `backend/main.py` | Task 2: Backend-populated, MDR1-sensitive breeds flagged. |
| Additional details (Age, Allergies, Conditions, Creatinine, ALT) collapsed under "추가 환자 정보 입력" text link | `FullSystem.jsx` | Task 2: Not in the way for quick entries. |
| Allergy suggestions populated from `GET /api/allergies` | `FullSystem.jsx`, `api.js`, `backend/main.py` | Task 2: allergy_class values from drug_identity. |
| Condition suggestions populated from `GET /api/conditions` | `FullSystem.jsx`, `api.js`, `backend/main.py` | Task 2: match_terms from contraindications[]. |

### Task 3 — Number Input Fix

| Change | File | Reason |
|---|---|---|
| All number inputs (weight, age, creatinine, ALT) converted to `type="text" inputMode="decimal"` | `FullSystem.jsx` | Task 3: Prevents browser native snap-to-0 and "08" bug. |
| Validation on blur only — empty string stored during editing | `FullSystem.jsx`, `DrugInput.jsx` | Task 3: No coerce while mid-edit. |
| Dose input on drug cards uses same pattern | `DrugInput.jsx` | Task 3: Consistent across all number inputs. |
| `DecimalInput` helper component created | `FullSystem.jsx` | Task 3: Reusable decimal input with proper state handling. |

### Task 4 — Drug Prescription Tab Reorganization

| Change | File | Reason |
|---|---|---|
| Removed "Often Prescribed Drugs" / "Frequently Prescribed" chip section | `DrugInput.jsx` | Task 4: No local drug browsing chips. |
| Removed `COMMON_DRUG_SET`, `TOP_15_COMMON`, `rankDrugs` import from DrugInput | `DrugInput.jsx` | Task 4: No frontend drug catalog — all search is backend-only. |
| Removed `listDrugsApi`, `searchDrugs` (local) from DrugInput | `DrugInput.jsx` | Task 4: Backend-only search on every keystroke (300ms debounce). |
| Drug search is now full-width, the primary element, with a search icon | `DrugInput.jsx` | Task 4: Drug search as the clear primary element. |
| Search results in clean dropdown: drug name + Korean name + drug class | `DrugInput.jsx` | Task 4: Matches spec. |
| Selected drugs displayed as stacked drug cards (not chips) | `DrugInput.jsx` | Task 4: Each card shows name, optional dose input, remove button. |
| Dose input hint: "선택 입력 — 입력 시 정밀 분석 적용" | `DrugInput.jsx` | Task 4: Optional dose field explains its purpose. |
| `createUnknownDrug` still supported via "Add as unknown" option | `DrugInput.jsx` | Preserved unknown drug handling. |

### Task 5 — Results Page Cleanup

| Change | File | Reason |
|---|---|---|
| Removed severity breakdown (critical/moderate/minor counts) from PatientSummaryPanel | `ResultsDisplay.jsx` | Task 5: Duplicate — already shown in SeverityBanner above. |
| OrganLoadIndicator accordion removed — always fully expanded | `OrganLoadIndicator.jsx` | Task 5: Must display fully expanded at all times. |
| `WhyDangerousPanel` for Critical severity: always-expanded, no toggle button | `ResultsDisplay.jsx` | Task 5: Severity 3 alerts immediately readable without interaction. |
| `WhyDangerousPanel` for Moderate: still collapsible | `ResultsDisplay.jsx` | Task 5: Severity 2 remains toggleable. |
| OrganLoadIndicator moved before ConfidenceProvenance in sidebar | `ResultsDisplay.jsx` | Task 5: Organ load is a core differentiator — more prominent. |

### Task 6 — Patient History and Saved Profiles

| Change | File | Reason |
|---|---|---|
| `patientStorage.ts` created — localStorage under `nuvovet_patients` key | `frontend/src/lib/patientStorage.ts` | Task 6: New patient profile schema with visit_history. |
| Old `nuvovet_patients_v1` localStorage key replaced by `nuvovet_patients` | `FullSystem.jsx`, `patientStorage.ts` | Task 6: New schema with UUID, owner_phone, visit_history. |
| `Patients.jsx` page created — searchable/sortable patient list with detail view | `frontend/src/pages/Patients.jsx` | Task 6: Patient history view. |
| `/patients` route added to App.jsx | `App.jsx` | Task 6: Patient history accessible from navigation. |
| "Patients" link added to FullSystem header | `FullSystem.jsx` | Task 6: Main navigation link to patient history. |
| "Save patient profile" checkbox at bottom of patient entry form | `FullSystem.jsx` | Task 6: Unchecked by default; saves when DUR runs if checked. |
| "Update patient record" button in results page | `ResultsDisplay.jsx` | Task 6: Save visit after reviewing results. |
| Patient detail view: inline editable fields, visit history, delete with confirmation | `Patients.jsx` | Task 6: Full profile editing. |

### Task 7 — EMR Screenshot Import (Functional)

| Change | File | Reason |
|---|---|---|
| `EMRImportModal.jsx` rebuilt as functional component with drag-drop | `frontend/src/components/EMRImportModal.jsx` | Task 7: Replaced placeholder with working implementation. |
| `POST /api/ocr/extract-patient` endpoint added | `backend/main.py` | Task 7: Accepts multipart image, calls Claude vision API. |
| `anthropic` and `python-multipart` added to requirements.txt | `backend/requirements.txt` | Task 7: Required for Claude API and file uploads. |
| `extractPatientFromImageApi()` added to api.js | `frontend/src/lib/api.js` | Task 7: Frontend API client for OCR endpoint. |
| Import banner shows after successful import with field highlights | `FullSystem.jsx` | Task 7: "Data imported from screenshot — please review." |
| `current_drugs` from OCR automatically added to prescription tab | `FullSystem.jsx`, `EMRImportModal.jsx` | Task 7: Drugs from screenshot auto-added. |
| Graceful error handling: API failure shows error in modal | `EMRImportModal.jsx` | Task 7: Never crashes the form. |
| ANTHROPIC_API_KEY warning logged on startup if missing | `backend/main.py` | Task 7: Startup warning, does not prevent app from starting. |

---

## TODO — Patient profiles backend migration

Patient profiles are stored in `localStorage` under `nuvovet_patients`.
This is a temporary measure.

**Action required (future):** Migrate patient profiles from localStorage to the backend
(FastAPI + database) for persistence across devices and sessions.
See `patientStorage.ts` for the data schema.

---

## Drug search — cap removal (2026-03-13)

The browse-mode drug list was previously limited to 50 drugs via a hard-coded
`limit: 50` call in `DrugInput.jsx` and `api.js`. This has been changed to:
- Initial load: top 20 results ranked by relevance + common-drug boost
- "Show more" button loads the next 20
- Hard cap removed from `listDrugsApi` (now accepts `limit` parameter correctly)
