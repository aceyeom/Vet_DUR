# Database Accuracy Scope and Holistic Completeness Analysis

- Generated: 2026-03-11
- Population considered: 632 drug files in `backend/data/converted/**/*.jsonl`
- Current pilot sample: 4 drugs (edrophonium, ivermectin, oxacillin, tacrolimus_ophthalmic)

## What "Accuracy" Means Here

This report treats "accuracy" as **data completeness quality** (field fill status), not clinical truth validation against external references.

- Filled: non-empty string, non-null scalar, non-empty list/dict
- Missing: `null`, empty string, empty list, empty object
- Unit: leaf fields across nested structures

## Current Pilot Status (Holistic)

| Metric | Value |
|---|---:|
| Population (N) | 632 |
| Sampled drugs (n) | 4 |
| Sampling coverage | 0.63% |
| Overall fill rate in pilot | 87.03% |
| Overall missing rate in pilot | 12.97% |
| Critical-field missing rate in pilot | 24.70% |

Interpretation:
- The 4-drug pilot is useful for directional diagnostics.
- It is **not enough** to claim database-level accuracy with statistical confidence.

## Valid Scope: How Many Samples Are Needed?

Assumption for sizing:
- 95% confidence level
- Conservative variability (`p = 0.5`)
- Finite population correction with `N = 632`

| Target Margin of Error | Required Sample Size |
|---|---:|
| +/-10% | 84 |
| +/-8% | 122 |
| +/-7% | 150 |
| +/-6% | 188 |
| +/-5% | 240 |

Recommended practical target:
- **Minimum defensible scope**: 122 drugs (+/-8%)
- **Stronger quality claim scope**: 150 to 188 drugs (+/-7% to +/-6%)

## Holistic Risk View (from current pilot)

High-priority missing domains (safety impact likely higher):
- `renal_dose_adjustment` (60.00% missing in pilot domain counts)
- `metabolism_and_clearance` (41.18% missing)
- `timing_profile` (38.89% missing)
- `contraindications[]` lab-trigger details (35.93% missing)

Lower-priority relative to above:
- `drug_identity` metadata-level gaps
- reviewer/extraction metadata gaps

## Recommended Adjustment Plan

1. Expand sample from 4 to at least **122** drugs immediately.
2. Use stratified sampling (by initial letter bucket and route/class where possible), not pure random only.
3. Track two KPIs separately:
   - Overall fill rate
   - Critical-field fill rate
4. Define acceptance gates before full-db claim, for example:
   - Overall fill rate >= 92%
   - Critical-field fill rate >= 90%
   - No critical domain below 85%
5. After reaching `n >= 122`, recompute confidence interval and decide whether to extend to 150-188 for stronger certainty.

## Priority Execution Plan (P0/P1/P2)

### P0 - Immediate Safety Coverage (must do first)

Goal:
- Reduce safety-critical blind spots before scaling analysis.

Scope:
- `contraindications[].lab_trigger.*` (`marker`, `threshold`, `unit`)
- `renal_dose_adjustment.*` (`adjustment_factor`, `creatinine_threshold_*`)
- Missing `dosage_and_kinetics.*.max_dose_mg_kg`
- Empty species dosage lists

Exit criteria:
- Critical-field fill rate >= 85% in the next expanded sample.
- No empty dosage list for target species in sampled records.

### P1 - Clinical Robustness Upgrade

Goal:
- Improve interaction and onset/kinetics decision quality.

Scope:
- `metabolism_and_clearance.*`
- `timing_profile.*`
- Species-specific burden trigger keywords when used by rules

Exit criteria:
- Domain fill rate >= 85% for `metabolism_and_clearance` and `timing_profile`.
- No rule-breaking nulls in fields actively used by risk logic.

### P2 - Metadata and Non-blocking Quality

Goal:
- Standardize documentation quality after clinical/safety priorities are stable.

Scope:
- `drug_identity` non-safety metadata gaps
- reviewer/extraction metadata and annotation consistency fields

Exit criteria:
- Metadata completeness >= 95%.
- No unresolved schema-format inconsistencies in sampled records.

### Suggested Rollout Size by Priority

| Phase | Suggested Additional Sample | Purpose |
|---|---:|---|
| P0 | +40 to +60 (total 44-64) | Fast risk reduction and safety gate validation |
| P1 | Expand to total 122 | Reach minimum defensible statistical scope |
| P2 | Expand to total 150-188 | Strengthen confidence and stabilize reporting |

## Additional QA Check: Iron Dextran, Exenatide, Succimer

### Result Summary

- JSON structure is valid in all 3 files (parse succeeds, no hard corruption).
- Main issue is completeness, not schema breakage.
- All 3 files explicitly indicate partial extraction risk via `_data_quality.requires_pmc_rag = true` and non-empty `missing_sections`.

### File-Level Findings

- Iron Dextran: 80.60% fill, critical-field missing 28.40%.
  - Risk points: renal thresholds and adjustment factor are null; lab-trigger subfields are frequently null.
- Exenatide: 76.81% fill, critical-field missing 29.81%.
  - Risk points: dog dosage list is empty; cat dose value is `Unknown`; renal thresholds are null.
- Succimer: 77.53% fill, critical-field missing 47.62% (highest among the 3).
  - Risk points: both dog/cat dosage lists are empty; renal adjustment values are null; contraindications are very sparse.

### Interpretation

- These records are consistent with your note about page/batch cutoffs.
- They should be treated as partial records and prioritized in P0 remediation before using them for high-confidence clinical logic.

## Bottom Line

With 4 samples, you have an early signal but not a valid database-wide accuracy claim.
A statistically valid scope starts around **84** (coarse) and is more credible at **122+** (recommended), with **150-188** preferred for stronger confidence.
