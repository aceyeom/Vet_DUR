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

## Drug search — cap removal (2026-03-13)

The browse-mode drug list was previously limited to 50 drugs via a hard-coded
`limit: 50` call in `DrugInput.jsx` and `api.js`. This has been changed to:
- Initial load: top 20 results ranked by relevance + common-drug boost
- "Show more" button loads the next 20
- Hard cap removed from `listDrugsApi` (now accepts `limit` parameter correctly)
