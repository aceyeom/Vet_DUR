# Veterinary DUR System — Complete Database Architecture

> **Reference Document v2.0**
> Database Structure · Table Definitions · Data Sources · Normalization Rules
> For the Korean Veterinary Pharmacy Drug Utilization Review System

---

## Table of Contents

1. [The Core Concept](#1-the-core-concept)
2. [The Four-Layer Data Model](#2-the-four-layer-data-model)
3. [Complete Table Index](#3-complete-table-index)
4. [Layer 1 — Products, Variants & Components](#4-layer-1--products-variants--components)
5. [Layer 2 — Substances](#5-layer-2--substances)
6. [Layer 3 — DUR Engine Data](#6-layer-3--dur-engine-data)
7. [Layer 4 — RAG Vector Store](#7-layer-4--rag-vector-store)
8. [Layer 5 — Patients & Prescriptions](#8-layer-5--patients--prescriptions)
9. [Layer 6 — Audit & Quality](#9-layer-6--audit--quality)
10. [Korean DB Normalization Rules](#10-korean-db-normalization-rules)
11. [How Route of Administration Affects the Schema](#11-how-route-of-administration-affects-the-schema)
12. [Handling Multi-Route Products & Flexible Dosing Formats](#12-handling-multi-route-products--flexible-dosing-formats)
13. [Handling Vitamins & Supplements](#13-handling-vitamins--supplements)
14. [The Null Policy](#14-the-null-policy)
15. [Data Sources & Coverage](#15-data-sources--coverage)
16. [How a DUR Scan Uses the Database](#16-how-a-dur-scan-uses-the-database)
17. [Database Scale Estimates](#17-database-scale-estimates)
18. [Drug Resolution Pipeline](#18-drug-resolution-pipeline-input-normalization)

---

## 1. The Core Concept

The DUR system uses a hierarchical relationship between products, variants, and substances:

**Products** are what vets prescribe — brand names, Korean license numbers, manufacturers.

**Variants** are different physical SKUs of the same product — different tablet strengths, different package sizes.

**Substances** are the active chemical ingredients. The DUR engines only care about substances.

**DUR analysis always runs against substances, not products or variants.**

---

## 2. The Four-Layer Data Model

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PRODUCTS, VARIANTS & COMPONENTS                       │
│  What vets prescribe. Korean DB is the primary source.           │
│                                                                  │
│  products   product_variants   product_components                │
└──────────────────────────┬───────────────────────────────────────┘
                           │ resolves to
┌──────────────────────────▼───────────────────────────────────────┐
│  LAYER 2 — SUBSTANCES                                            │
│  Active ingredients. The master entity for all DUR logic.        │
│                                                                  │
│  substances   substance_synonyms                                 │
└──────────────────────────┬───────────────────────────────────────┘
                           │ analyzed by
┌──────────────────────────▼───────────────────────────────────────┐
│  LAYER 3 — DUR ENGINE DATA                                       │
│  Pharmacological knowledge. PMC + Plumb's are primary sources.   │
│                                                                  │
│  Engine 1: cyp_profiles, pk_parameters, pd_risk_flags,          │
│            transporter_profiles, ddi_pairs                       │
│  Engine 2: dosing_rules, renal_dose_adjustments,                │
│            breed_dosing_modifiers, lab_test_interactions         │
│  Engine 3: allergy_class_members, class_cross_reactivity         │
│  Engine 4: contraindications, breed_pharmacogenomics,           │
│            breed_dosing_modifiers, condition_synonyms            │
│  Engine 5: therapeutic_classes                                   │
└──────────────────────────────────────────────────────────────────┘

Supporting layers:
  Layer 4 — RAG vector store (literature_chunks with pgvector)
  Layer 5 — Runtime data (patients, prescriptions, prescription_items)
  Layer 6 — Audit & quality (data_sources, extraction_log,
             review_queue, dur_scan_results, dur_alert_events, ddi_inference_log,
             unmatched_drug_log)
```

---

## 3. Complete Table Index

32 tables total. Every table listed with its purpose and primary data source.

| Layer | Table | Purpose | Primary Source |
|-------|-------|---------|---------------|
| 1 | `products` | Licensed drug products — one per substance+route | Korean Vet DB |
| 1 | `product_variants` | SKU variants — different strengths of same product | Korean Vet DB |
| 1 | `product_components` | Resolves combination products to substances | Korean Vet DB |
| 1 | `product_multi_routes` | Maps multi-route products to all approved routes | Korean Vet DB |
| 2 | `substances` | Master active ingredient registry | Korean Vet DB + manual |
| 2 | `substance_synonyms` | All name variants KO/EN/LA | Korean Vet DB + manual |
| 3 | `cyp_profiles` | CYP isoform metabolism — route-independent | PMC |
| 3 | `pk_parameters` | PK data per species per route | PMC |
| 3 | `pd_risk_flags` | Toxicity risk profile, species-specific adverse effects, overdose data, Papich reproductive class — route-independent | PMC + Plumb's |
| 3 | `transporter_profiles` | P-gp / MDR1 data — route-independent | PMC |
| 3 | `ddi_pairs` | Explicitly documented drug-drug interactions — route-independent | PMC + manual |
| 3 | `dosing_rules` | Species + route specific dosing, monitoring requirements, administration timing | Korean Vet DB + Plumb's |
| 3 | `renal_dose_adjustments` | Dose reduction for renal failure | PMC + Plumb's |
| 3 | `allergy_class_members` | Substance → allergy class membership (normalized) | PMC |
| 3 | `class_cross_reactivity` | Class-to-class cross-reactivity rules (normalized) | PMC |
| 3 | `contraindications` | Disease-drug contraindications — route-independent | PMC + Plumb's |
| 3 | `breed_pharmacogenomics` | Genetic mutation breed sensitivity (MDR1, CYP2D15, etc.) — cross-engine modifier | PMC |
| 3 | `breed_dosing_modifiers` | Non-mutation breed PK/PD variability (sighthound, giant breed, terrier) — Engines 2 & 4 | Plumb's |
| 3 | `lab_test_interactions` | Drugs that falsely alter lab readings — informational advisory | Plumb's |
| 3 | `condition_synonyms` | Free-text condition normalisation (KO + EN) | Manual |
| 3 | `therapeutic_classes` | Drug class for Engine 5 duplication check | Korean Vet DB + manual |
| 4 | `literature_chunks` | RAG vector store (pgvector) | PMC |
| 5 | `patients` | Patient records | Pharmacy system |
| 5 | `prescriptions` | Prescription headers | Pharmacy system |
| 5 | `prescription_items` | Individual drug line items | Pharmacy system |
| 6 | `data_sources` | Provenance for every data point | All sources |
| 6 | `extraction_log` | RAG pipeline run history | Pipeline |
| 6 | `review_queue` | Pharmacist validation queue | Pipeline |
| 6 | `dur_scan_results` | Every DUR scan stored for audit — full alert JSONB | Runtime |
| 6 | `dur_alert_events` | One row per alert per scan — structured analytics | Runtime |
| 6 | `ddi_inference_log` | Per-scan trace of CYP-inferred interactions (not pre-stored) | Runtime |
| 6 | `unmatched_drug_log` | Prescription items that could not be resolved to a known substance | Runtime |

---

## 4. Layer 1 — Products, Variants & Components

### The Three Types of Korean DB Inconsistency

**Type 1 — Same substance, same route, different strengths**
Apoquel 3.6mg / 5.4mg / 16mg. All oral oclacitinib. Solution: one `products` row, three `product_variants` rows.

**Type 2 — Same substance, different route**
Cerenia injection (SC) vs Cerenia tablet (oral). Solution: two `products` rows (one per route), each linked to the same `substances` row.

**Type 3 — Genuinely different substances**
Product containing multiple active ingredients. Solution: one `products` row per product, multiple `product_components` rows.

---

### Normalization Decision Tree

Apply this to every Korean DB entry during ingestion:

```
New Korean DB entry arrives
          │
          ▼
Does this INN substance already exist?
          │
    ┌─────┴─────┐
   YES           NO
    │             └──→ Create new substances row
    │                  Queue for RAG pipeline
    │
    ▼
Does a product row exist for this
substance + route combination?
          │
    ┌─────┴─────┐
   YES           NO
    │             └──→ Create new products row
    │                  (different route = clinically different)
    │
    ▼
Does a variant exist for this
specific tablet strength?
          │
    ┌─────┴─────┐
   YES           NO
    │             └──→ Create product_variants row only
    │                  (same drug, just different SKU)
    ▼
Duplicate — skip
```

---

### `products`

One row per substance + route combination. All clinical data lives on the linked substance.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | Primary key | `uuid` |
| `substance_id` | UUID FK → substances | The active ingredient | `oclacitinib uuid` |
| `korean_name_base` | VARCHAR | Name without strength | `아포퀠 정` |
| `english_name_base` | VARCHAR | English base name | `Apoquel tablets` |
| `route_of_administration` | VARCHAR | `oral`, `IV`, `IM`, `SC`, `topical` | `oral` |
| `dosage_form` | VARCHAR | `정제`, `산제`, `주사제`, `액제`, `연고` | `정제` |
| `approved_species` | TEXT[] | Species with approved use | `{dog}` |
| `is_combination_product` | BOOLEAN | Contains multiple active ingredients | `false` |
| `substance_category` | VARCHAR | See Section 12 — determines DUR engine behaviour | `pharmaceutical` |
| `formulary_status` | VARCHAR | `active`, `pending`, `out_of_scope`, `deprecated` | `active` |
| `created_at` | TIMESTAMP | Record created | |
| `updated_at` | TIMESTAMP | Last updated | |

---

### `product_variants`

One row per Korean DB entry of the same product. Stores the physical SKU details.

> **Strength representation**: The canonical triplet is `(strength_value, strength_unit, strength_per)`. `strength_value` is the numeric quantity; `strength_unit` is the unit (`mg`, `ml`, `g`, `%`, `IU`, `CFU`, `mcg`); `strength_per` is what it applies to (`per_tablet`, `per_mL`, `per_capsule`, `per_sachet`, `per_dose`). For dose calculations, always use `strength_value` as the numeric source.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | Primary key | `uuid` |
| `product_id` | UUID FK → products | Parent product | `Apoquel oral uuid` |
| `korean_db_index` | INT | Index from scraped Korean DB | `11647` |
| `korean_name_full` | VARCHAR | Full name as in Korean DB | `아포퀠 정 3.6 mg (오클라시티니브 말레산염)` |
| `strength_value` | DECIMAL | Numeric strength in specified unit | `3.6` |
| `strength_unit` | VARCHAR | `mg`, `ml`, `g`, `%`, `IU`, `CFU`, `mcg` | `mg` |
| `strength_per` | VARCHAR | What the strength applies to | `per_tablet`, `per_mL`, `per_capsule`, `per_sachet`, `per_dose` |
| `manufacturer` | VARCHAR | Company name | `한국조에티스(주)` |
| `license_number` | VARCHAR | Korean license code | `동물용의약품-수입-042-170` |
| `license_date` | DATE | Approval date | `2016-11-03` |
| `license_status` | VARCHAR | `정상` or `취소` | `정상` |
| `is_prescription_only` | BOOLEAN | 처방대상의약품 | `true` |
| `package_sizes` | TEXT[] | Available pack sizes | `{20정,50정,100정}` |
| `storage_conditions` | TEXT | Storage instructions | `실온 (25℃ 이하)` |
| `shelf_life_months` | INT | From manufacturing date | `36` |
| `split_shelf_life_days` | INT | Shelf life after tablet splitting | `3` |
| `source_type` | VARCHAR | `korean_db`, `imported`, `human_label`, `compounded` | `korean_db` |

---

### `product_components`

Resolves combination products to their active substances. Only pharmacologically active ingredients, not excipients.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | Primary key | `uuid` |
| `product_id` | UUID FK → products | Parent product | `설프림액 uuid` |
| `substance_id` | UUID FK → substances | Active substance | `sulfamethoxazole uuid` |
| `amount_per_unit` | DECIMAL | Amount per dose unit | `100.000` |
| `unit` | VARCHAR | `MG`, `GM`, `ML` | `GM` |
| `is_primary_active` | BOOLEAN | TRUE for active ingredients, FALSE for preservatives | `true` |

---

### `product_multi_routes`

Maps Korean DB entries to multiple `products` rows when a single entry specifies multiple routes of administration.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | Primary key | `uuid` |
| `korean_db_index` | INT | Index from Korean DB entry | `1234` |
| `korean_name` | VARCHAR | Original Korean DB product name | `덱사주` |
| `product_id` | UUID FK → products | One of multiple products created | `dexamethasone-SC uuid` |
| `route` | VARCHAR | Route this product represents | `SC` |
| `is_primary_route` | BOOLEAN | Mark the clinically primary route | `false` |
| `source_documentation` | TEXT | Route as documented in raw_content | `피하 또는 근육주사` |

---

## 5. Layer 2 — Substances

### `substances`

The master entity. Every DUR engine analysis traces back here.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | Primary key | `uuid` |
| `inn_name` | VARCHAR UNIQUE | International Nonproprietary Name | `oclacitinib` |
| `korean_name` | VARCHAR | Korean name | `오클라시티니브` |
| `cas_number` | VARCHAR | Chemical Abstracts Service number | `1208319-26-9` |
| `drug_class` | VARCHAR | Top-level therapeutic class | `Immunosuppressant` |
| `subclass` | VARCHAR | Sub-classification | `JAK inhibitor` |
| `classification_code` | VARCHAR | Korean DB classification code | `기생성 피부질환용제(02650)` |
| `substance_category` | VARCHAR | Controls DUR engine behaviour — see Section 12 | `pharmaceutical` |
| `is_controlled` | BOOLEAN | Controlled substance | `false` |
| `controlled_schedule` | VARCHAR | Schedule if controlled | `null` |
| `formulary_status` | VARCHAR | `active`, `pending`, `out_of_scope`, `deprecated` | `active` |
| `data_completeness_e1` | DECIMAL | Engine 1 DDI field fill rate 0.0–1.0 | `0.72` |
| `data_completeness_e2` | DECIMAL | Engine 2 Dosage field fill rate | `0.90` |
| `data_completeness_e3` | DECIMAL | Engine 3 Allergy field fill rate | `0.85` |
| `data_completeness_e4` | DECIMAL | Engine 4 Disease field fill rate | `0.80` |
| `data_completeness_e5` | DECIMAL | Engine 5 Duplication field fill rate | `1.00` |
| `overall_completeness` | DECIMAL | Weighted average across all engines | `0.83` |
| `pharmacist_reviewed` | BOOLEAN | Entire substance record manually validated | `true` |
| `last_reviewed_at` | TIMESTAMP | Last pharmacist review date | `2025-11-01` |
| `review_notes` | TEXT | Free-text pharmacist notes | |
| `created_at` | TIMESTAMP | | |
| `updated_at` | TIMESTAMP | | |

---

### `substance_synonyms`

Maps all name variants to the canonical substance record.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | Primary key | `uuid` |
| `substance_id` | UUID FK → substances | Canonical substance | `oclacitinib uuid` |
| `synonym` | VARCHAR | The name variant | `오클라시티니브 말레산염` |
| `language` | VARCHAR | `ko`, `en`, `la` | `ko` |
| `synonym_type` | VARCHAR | `brand`, `inn`, `generic`, `abbreviation`, `salt_form` | `salt_form` |

---

## 6. Layer 3 — DUR Engine Data

All pharmacological knowledge that powers the five analysis engines. Every table links to `substances` via `substance_id`.

### Route-Independent vs Route-Specific Data

| Data point | Route-independent? | Where stored |
|---|---|---|
| CYP metabolism | ✅ Yes | `cyp_profiles` — no route column |
| Protein binding | ✅ Yes | `pk_parameters` — route = 'all' |
| Half-life | ✅ Yes | `pk_parameters` — route = 'all' |
| Primary elimination | ✅ Yes | `pk_parameters` — route = 'all' |
| PD risk flags | ✅ Yes | `pd_risk_flags` — no route column |
| DDI pairs | ✅ Yes | `ddi_pairs` — no route column |
| Contraindications | ✅ Yes | `contraindications` — no route column |
| Bioavailability | ❌ Route-specific | `pk_parameters` — route = 'oral' / 'SC' etc. |
| Time to peak | ❌ Route-specific | `pk_parameters` — route-specific row |
| Dosing rules | ❌ Route-specific | `dosing_rules` — always filtered by route |

---

### `cyp_profiles` — Engine 1

One row per CYP isoform per role per substance. Route-independent.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | `cyclosporine uuid` |
| `cyp_isoenzyme` | VARCHAR | `CYP3A4`, `CYP2D6`, `CYP1A2`, `CYP2C9`, `CYP2C19`, `CYP2B11` | `CYP3A4` |
| `role` | VARCHAR | `substrate`, `inhibitor`, `inducer` | `substrate` |
| `inhibition_strength` | VARCHAR | `weak`, `moderate`, `strong` — null for substrates | `null` |
| `induction_onset_days` | INT | Days until induction effect is established | `null` |
| `induction_washout_days` | INT | Days until induction clears after stopping | `null` |
| `clinical_relevance` | VARCHAR | `high`, `moderate`, `low` | `high` |
| `species` | TEXT[] | null = applies to all approved species | `null` |
| `source_quote` | TEXT | Exact quote from source paper | `"cyclosporine is primarily metabolised by CYP3A4..."` |
| `extraction_confidence` | VARCHAR | `high`, `medium`, `low` | `high` |
| `data_source_id` | UUID FK → data_sources | | |

---

### `pk_parameters` — Engine 1

One row per substance per species per route. Route = 'all' for route-independent parameters; specific route for route-specific parameters.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | |
| `species` | VARCHAR | `dog`, `cat` | `dog` |
| `route` | VARCHAR | `all` for route-independent data, specific route otherwise | `oral` |
| `half_life_hr` | DECIMAL | Elimination half-life | `9.0` |
| `bioavailability_pct` | DECIMAL | 0.0–1.0 — route-specific | `0.23` |
| `time_to_peak_hr` | DECIMAL | Route-specific | `2.0` |
| `protein_binding_pct` | DECIMAL | Route-independent | `0.98` |
| `primary_protein` | VARCHAR | `albumin`, `alpha1-AGP`, `mixed` | `albumin` |
| `binding_site` | VARCHAR | `albumin_site_I`, `albumin_site_II`, `alpha1-AGP_site`, `mixed`, `unknown` | `albumin_site_II` |
| `renal_elimination_pct` | DECIMAL | Route-independent | `0.01` |
| `primary_elimination` | VARCHAR | `renal`, `hepatic`, `biliary`, `mixed` | `hepatic` |
| `volume_of_distribution_l_per_kg` | DECIMAL | Route-independent | `3.5` |
| `pk_confidence` | VARCHAR | `high`, `medium`, `low` | `high` |
| `pk_source_conflict` | BOOLEAN | Multiple sources gave conflicting values | `false` |
| `data_source_id` | UUID FK → data_sources | | |

---

### `pd_risk_flags` — Engine 1

One row per substance. Route-independent.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | UNIQUE — one row per substance | `oclacitinib uuid` |
| `narrow_therapeutic_index` | BOOLEAN | Small margin between effective and toxic dose | `false` |
| `nephrotoxicity` | VARCHAR | `none`, `low`, `moderate`, `high` | `none` |
| `hepatotoxicity` | VARCHAR | `none`, `low`, `moderate`, `high` | `low` |
| `qt_prolongation` | VARCHAR | `none`, `low`, `moderate`, `high` | `none` |
| `myelosuppression` | VARCHAR | `none`, `low`, `moderate`, `high` | `moderate` |
| `cns_depression` | VARCHAR | `none`, `low`, `moderate`, `high` | `none` |
| `respiratory_depression` | VARCHAR | `none`, `low`, `moderate`, `high` | `none` |
| `hypotension` | VARCHAR | `none`, `low`, `moderate`, `high` | `none` |
| `seizure_threshold_effect` | VARCHAR | `lower`, `raise`, `none` | `none` |
| `gi_ulcer_risk` | VARCHAR | `none`, `low`, `moderate`, `high` | `low` |
| `bleeding_risk` | VARCHAR | `none`, `low`, `moderate`, `high` | `none` |
| `serotonin_syndrome_risk` | BOOLEAN | TRUE for tramadol, trazodone, MAOIs, SSRIs, mirtazapine | `false` |
| `mdr1_mutation_risk` | BOOLEAN | Safety altered in MDR1/ABCB1-deficient patients | `false` |
| `electrolyte_k` | VARCHAR | `deplete`, `elevate`, `none` — potassium effect | `none` |
| `electrolyte_mg` | VARCHAR | `deplete`, `elevate`, `none` | `none` |
| `electrolyte_na` | VARCHAR | `deplete`, `elevate`, `none` | `none` |
| `electrolyte_ca` | VARCHAR | `deplete`, `elevate`, `none` | `none` |
| `absorption_affected_by_ph` | BOOLEAN | Antacids/PPIs significantly alter absorption | `false` |
| `chelation_risk` | BOOLEAN | Binds divalent metals | `false` |
| `adverse_effects_dog` | TEXT | Species-specific adverse effects narrative for dogs — from Plumb's "Adverse Effects" section | `"Diarrhea and weight loss; dose-dependent"` |
| `adverse_effects_cat` | TEXT | Species-specific adverse effects narrative for cats — from Plumb's "Adverse Effects" section | `"Flatulence, soft stools, diarrhea"` |
| `reproductive_safety_class_papich` | VARCHAR | Papich 1989 veterinary pregnancy classification (dogs/cats): `A`=safe, `B`=safe if cautious, `C`=risk vs benefit, `D`=documented fetal risk — null if not evaluated. Distinct from FDA human categories. | `B` |
| `reproductive_safety_note` | TEXT | Free-text from Plumb's Reproductive/Nursing Safety section — captures nuances beyond the Papich class | `"Safe for use if used cautiously. May have some risk near term."` |
| `overdose_ld50_mg_per_kg` | DECIMAL | LD50 in mg/kg from Plumb's Overdosage section — null if not established | `61.0` |
| `overdose_ld50_species` | VARCHAR | Species the LD50 value applies to | `mouse` |
| `overdose_ld50_route` | VARCHAR | Route for LD50 value (`IV`, `oral`, `SC`, `IM`) | `IV` |
| `overdose_toxic_dose_mg_per_kg` | DECIMAL | Lowest observed toxic dose in target species (dog/cat) — null if unknown | `null` |
| `overdose_signs` | TEXT | Clinical signs of overdose from Plumb's — free text | `"Hypotension, bradycardia, cardiovascular collapse"` |
| `overdose_treatment` | TEXT | Overdose treatment summary from Plumb's — free text | `"Supportive care; IV fluids for hypotension; do not use epinephrine"` |
| `pd_confidence` | VARCHAR | `high`, `medium`, `low` | `medium` |
| `data_source_id` | UUID FK → data_sources | | |

---

### `transporter_profiles` — Engine 1

One row per substance. Route-independent.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | UNIQUE | `cyclosporine uuid` |
| `pgp_substrate_affinity` | VARCHAR | `high`, `moderate`, `low`, `none` | `high` |
| `pgp_inhibitor_strength` | VARCHAR | `strong`, `moderate`, `weak`, `none` | `moderate` |
| `cns_penetration_pgp_dependent` | BOOLEAN | P-gp is primary CNS barrier for this drug | `false` |
| `other_transporters` | TEXT[] | `{OATP1B1, OATP1B3}` | |
| `data_source_id` | UUID FK → data_sources | | |

---

### `ddi_pairs` — Engine 1

One row per **explicitly documented** pairwise drug-drug interaction. Always store substance_a alphabetically before substance_b. Route-independent.

> **Scope note**: This table covers two kinds of explicit pairs only:
> 1. **Empirical** — pairs sourced directly from PMC literature, Plumb's, or Korean DB 상호작용 sections (`inferred = FALSE`)
> 2. **RAG-pipeline pre-computed** — pairs where the RAG pipeline found strong mechanistic evidence and a pharmacist reviewed them (`inferred = TRUE`)
>
> CYP-based *transitive* inferences (e.g. "Drug A is a CYP3A4 substrate, Drug B is a CYP3A4 inhibitor → probable interaction") are **not pre-stored here**. They are computed at scan time and logged to `ddi_inference_log`. This avoids combinatorial explosion in `ddi_pairs` (600 substances × 600 = ~180,000 theoretical pairs) while keeping this table to meaningful, reviewable rows only.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_a_id` | UUID FK → substances | Alphabetically first | `cyclosporine uuid` |
| `substance_b_id` | UUID FK → substances | Alphabetically second | `ketoconazole uuid` |
| `is_checked` | BOOLEAN | Has this pair been evaluated? | `true` |
| `no_interaction_confirmed` | BOOLEAN | Checked and confirmed no interaction | `false` |
| `interaction_type` | VARCHAR | `cyp_metabolic`, `transporter_pgp`, `protein_binding`, `pharmacodynamic_additive`, `pharmacodynamic_antagonism`, `electrolyte_mediated` | `cyp_metabolic` |
| `mechanism_detail` | TEXT | Specific mechanistic explanation | `Ketoconazole strongly inhibits CYP3A4, reducing cyclosporine clearance 2–5 fold` |
| `severity` | VARCHAR | `contraindicated`, `major`, `moderate`, `minor` | `major` |
| `severity_score` | INT | 0–100: contraindicated=100, major=75, moderate=40, minor=15 | `75` |
| `clinical_effect` | TEXT | Plain-language what happens | `Cyclosporine toxicity — nephrotoxicity, neurotoxicity` |
| `management` | TEXT | Recommended clinical action | `Reduce cyclosporine dose 50%, monitor trough levels` |
| `species` | TEXT[] | null = all species | `null` |
| `breed_specific` | TEXT[] | Breed restriction | `null` |
| `evidence_level` | VARCHAR | `A` RCT, `B` case series, `C` case report, `D` theoretical | `B` |
| `inferred` | BOOLEAN | TRUE = pair generated by RAG pipeline (not from direct literature); FALSE = empirical source | `false` |
| `inferred_confidence` | DECIMAL | 0.0–1.0 — null for empirical pairs; RAG pairs require ≥0.70 before storing | `null` |
| `reviewed_by_pharmacist` | BOOLEAN | Manually validated | `true` |
| `checked_by` | VARCHAR | Who reviewed this pair | `Dr. Kim` |
| `checked_at` | TIMESTAMP | When reviewed | |
| `source_refs` | TEXT[] | Citations | `{Plumb's 10th Ed}` |
| `rag_chunk_ids` | UUID[] | Vector store chunks used | |

---

### `ddi_inference_log` — Engine 1 (Layer 6)

Per-scan audit log of CYP-based transitive inferences computed at runtime. Records are written during Engine 1 execution and linked to the parent `dur_scan_results` row. This table is the authoritative record of *why* an inferred DDI alert was raised, replacing the need to pre-populate `ddi_pairs` with speculative combinations.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `scan_id` | UUID FK → dur_scan_results | The scan that triggered this inference | `uuid` |
| `substance_a_id` | UUID FK → substances | Alphabetically first | `cyclosporine uuid` |
| `substance_b_id` | UUID FK → substances | Alphabetically second | `fluconazole uuid` |
| `inference_type` | VARCHAR | `cyp_substrate_inhibitor`, `cyp_substrate_inducer`, `protein_binding_displacement`, `pd_additive`, `transporter_pgp` | `cyp_substrate_inhibitor` |
| `shared_cyp_isoform` | VARCHAR | CYP isoform that triggered the inference — null for non-CYP types | `CYP3A4` |
| `substance_a_role` | VARCHAR | `substrate`, `inhibitor`, `inducer` — role of substance_a in the shared isoform | `substrate` |
| `substance_b_role` | VARCHAR | Role of substance_b in the shared isoform | `inhibitor` |
| `inhibition_strength` | VARCHAR | Strength of the inhibitor/inducer — from `cyp_profiles` | `strong` |
| `inferred_severity` | VARCHAR | Derived severity estimate: `strong inhibitor + substrate → major`; `weak → minor` | `major` |
| `inferred_severity_score` | INT | 0–100 — derived using same scale as `ddi_pairs.severity_score` | `65` |
| `overridden_by_explicit_pair` | BOOLEAN | TRUE if a matching `ddi_pairs` row was found and used instead | `false` |
| `explicit_pair_id` | UUID FK → ddi_pairs | The explicit pair that overrode this inference — null if not overridden | `null` |
| `alert_suppressed` | BOOLEAN | TRUE if inferred severity was below alert threshold at scan time | `false` |
| `created_at` | TIMESTAMP | When this inference was generated | |

**Inference severity derivation rules (Engine 1):**

```
shared isoform found between substrate A and inhibitor/inducer B:

  inhibition_strength = 'strong'  → inferred_severity = 'major'    (score 65)
  inhibition_strength = 'moderate' → inferred_severity = 'moderate' (score 35)
  inhibition_strength = 'weak'    → inferred_severity = 'minor'    (score 15)
  inducer (any strength)          → inferred_severity = 'moderate' (score 30)

  IF overridden_by_explicit_pair = TRUE
    → use ddi_pairs row severity instead, do not fire inferred alert
```

---

### `dosing_rules` — Engine 2

One row per substance per species per route. Always filter on BOTH species AND route. Flexible dosing format support for mg/kg, ml/kg, tablet counts, IU, and feed-based products.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | `oclacitinib uuid` |
| `species` | VARCHAR | `dog`, `cat` | `dog` |
| `indication` | VARCHAR | What condition | `Atopic Dermatitis` |
| `route` | VARCHAR | `oral`, `IV`, `IM`, `SC`, `topical` | `oral` |
| `route_approved` | BOOLEAN | FALSE = alert "route not approved" without dose comparison | `true` |
| `dosing_type` | VARCHAR | Format of dosing data | `mg_per_kg`, `ml_per_kg`, `ml_per_animal`, `tablet_per_day`, `iU_based`, `feed_based` |
| `dose_unit` | VARCHAR | Unit matching dosing_type | `mg/kg`, `ml/kg`, `tablets/day`, `IU`, `CFU`, `kg/ton_feed` |
| `min_dose` | DECIMAL | Minimum therapeutic dose | `0.4` |
| `max_dose` | DECIMAL | Maximum safe dose | `0.6` |
| `loading_dose` | DECIMAL | Loading dose if different from maintenance | `0.6` |
| `loading_duration_days` | INT | Days on loading dose before switching to maintenance | `14` |
| `maintenance_interval_hr` | INT | Dosing interval after loading phase | `24` |
| `loading_interval_hr` | INT | Dosing interval during loading phase | `12` |
| `is_feed_additive` | BOOLEAN | TRUE = exclude from standard dosing_rules checks | `false` |
| `per_ton_feed_kg` | DECIMAL | Only if is_feed_additive=true; dose per ton of feed | `2.0` |
| `requires_dilution` | BOOLEAN | Product must be diluted before use | `false` |
| `dilution_instructions` | TEXT | How to dilute (e.g., "4-5ml sterile water per 1g") | `null` |
| `narrow_therapeutic_index` | BOOLEAN | Flag any deviation immediately | `false` |
| `pediatric_min_age_months` | INT | Minimum age | `12` |
| `pediatric_min_weight_kg` | DECIMAL | Minimum weight | `3.0` |
| `geriatric_adjustment_pct` | DECIMAL | Reduction for geriatric patients | `null` |
| `administration_timing` | VARCHAR | When to give relative to food — `with_meal`, `before_meal`, `after_meal`, `regardless_of_food` — from Plumb's "Client Information" section | `with_meal` |
| `food_interaction_note` | TEXT | Free-text food or administration timing note from Plumb's (e.g. "Give immediately prior to feeding for best results") | `null` |
| `monitoring_required` | TEXT[] | Clinical/lab parameters to monitor during treatment — from Plumb's "Monitoring" section | `{serum_glucose,adverse_effects_diarrhea}` |
| `evidence_level` | VARCHAR | `A`, `B`, `C`, `D` — evidence grade; applies score modifier to Engine 2 alerts (see modifier table below) | `A` |
| `data_source_id` | UUID FK → data_sources | | |

**Engine 2 evidence_level score modifier:**

| evidence_level | Score adjustment | Additional flag added to alert |
|---|---|---|
| A | ± 0 | — |
| B | − 5 | — |
| C | − 15 | `limited_evidence` |
| D | − 25 (floor: 5) | `theoretical_basis_only`; severity capped at `minor` |

Rules:
- Applied to the per-alert `severity_score` before it feeds into the Engine 2 engine score.
- Score floor is 5 — a D-level rule still fires as an informational alert, never silently drops.
- Adjusted score maps to severity label: ≥ 75 → `major` | 40–74 → `moderate` | 15–39 → `minor` | < 15 → `info`
- Applies to Engine 2 (dosage) alerts only. Does not affect Engines 1, 3, 4, or 5.

---

### `renal_dose_adjustments` — Engine 2

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | |
| `species` | VARCHAR | | `dog` |
| `creatinine_mild_max` | DECIMAL | Upper creatinine threshold for mild impairment (mg/dL) | `2.0` |
| `mild_factor` | DECIMAL | Dose multiplier — 0.75 = 25% reduction | `0.75` |
| `creatinine_moderate_max` | DECIMAL | Upper threshold for moderate impairment | `3.5` |
| `moderate_factor` | DECIMAL | Dose multiplier for moderate | `0.50` |
| `severe_contraindicated` | BOOLEAN | Do not use in severe renal failure | `true` |
| `severe_factor` | DECIMAL | null when severe_contraindicated = TRUE | `null` |
| `renal_elimination_pct` | DECIMAL | Fraction eliminated renally | `0.01` |
| `data_source_id` | UUID FK → data_sources | | |

---

### `allergy_class_members` — Engine 3

Maps substances to allergy classes. One row per substance-class membership. A substance can belong to more than one class (e.g. amoxicillin-clavulanate is both `beta-lactam` and `beta-lactamase_inhibitor`). Cross-reactivity rules live in `class_cross_reactivity`, not here.

> **Design note**: This replaces the previous `allergy_classes` table which embedded `cross_reactive_with` as JSONB. The JSONB approach required updating every class member's row when a new cross-reactivity was discovered. The normalized design means adding one row to `class_cross_reactivity` is the only change needed.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | `tylosin uuid` |
| `allergy_class` | VARCHAR | `beta-lactam`, `macrolide`, `sulfonamide`, `fluoroquinolone`, `aminoglycoside`, `lincosamide`, `tetracycline`, `opioid`, `nsaid` | `macrolide` |
| `data_source_id` | UUID FK → data_sources | | |

---

### `class_cross_reactivity` — Engine 3

One row per class pair with a known cross-reactivity relationship. Directional: class_a reacts with class_b. Store both directions if symmetric (two rows). Engine 3 queries this table once per patient allergy class.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `class_a` | VARCHAR | The class the patient is allergic to | `macrolide` |
| `class_b` | VARCHAR | The class of the prescribed drug that cross-reacts | `lincosamide` |
| `mechanism` | VARCHAR | `shared_macrocyclic_ring_structure`, `shared_beta_lactam_ring`, `common_sulfonamide_moiety`, `cross_sensitization`, `unknown` | `shared_macrocyclic_ring_structure` |
| `estimated_rate_pct` | DECIMAL | Cross-reactivity rate 0–100 | `15.0` |
| `strength` | VARCHAR | `high`, `moderate`, `low`, `theoretical` | `moderate` |
| `species_data_available` | BOOLEAN | Rate is from veterinary data (not extrapolated from human) | `false` |
| `alert_on_cross_react` | BOOLEAN | FALSE = informational note only, do not block | `true` |
| `note` | TEXT | Caveats on the estimate | `Rate extrapolated from human data` |
| `data_source_id` | UUID FK → data_sources | | |

**Engine 3 query pattern (replaces JSONB scan):**
```sql
-- Find all cross-reactivity alerts for a prescribed substance
SELECT cr.*
FROM allergy_class_members acm_prescribed
JOIN class_cross_reactivity cr ON cr.class_b = acm_prescribed.allergy_class
JOIN allergy_class_members acm_allergic
    ON acm_allergic.allergy_class = cr.class_a
    AND acm_allergic.substance_id = ANY(:patient_allergy_substance_ids)
WHERE acm_prescribed.substance_id = :prescribed_substance_id;
```

---

### `contraindications` — Engine 4

One row per substance-condition pair. Route-independent.

> **Two axes**: `contraindication_type` describes **severity** (`absolute/relative/caution`). `clinical_category` describes **what triggers the check** — disease-based entries go through the conditions text-matching pipeline; reproductive-category entries are checked directly against the structured `patients.is_pregnant`, `patients.is_lactating`, and `patients.reproductive_status` fields, bypassing free-text normalisation entirely.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | `oclacitinib uuid` |
| `condition_name` | VARCHAR | Normalised condition string | `Active Neoplasia` |
| `condition_tags` | TEXT[] | Searchable tags — KO and EN variants | `{암,종양,neoplasia,cancer,tumor,lymphoma}` |
| `clinical_category` | VARCHAR | What triggers this check: `disease` (default), `reproductive_pregnancy`, `reproductive_lactation`, `reproductive_intact_female`, `reproductive_intact_male`, `age_pediatric` | `disease` |
| `contraindication_type` | VARCHAR | Severity: `absolute`, `relative`, `caution` | `relative` |
| `severity` | VARCHAR | `critical`, `major`, `moderate`, `minor` | `major` |
| `mechanism` | TEXT | Why this drug is dangerous in this condition | `JAK inhibition may promote tumor proliferation` |
| `species` | TEXT[] | null = all species | `{dog}` |
| `breed_specific` | TEXT[] | Breed restriction | `null` |
| `min_age_months` | INT | Minimum age | `12` |
| `min_weight_kg` | DECIMAL | Minimum weight | `3.0` |
| `alternative_substance_ids` | UUID[] | Safer alternatives | `{lokivetmab-uuid}` |
| `rag_chunk_ids` | UUID[] | Vector chunks for Engine 4 explanation generation | |
| `data_source_id` | UUID FK → data_sources | | |

**Engine 4 `clinical_category` routing:**
```
IF clinical_category = 'disease'
  → conditions[] text-matching via condition_synonyms (existing path)

IF clinical_category = 'reproductive_pregnancy'
  → check patients.is_pregnant = TRUE  (structured boolean, no text matching)

IF clinical_category = 'reproductive_lactation'
  → check patients.is_lactating = TRUE

IF clinical_category = 'reproductive_intact_female'
  → check patients.reproductive_status IN ('intact_female', 'pregnant', 'lactating')

IF clinical_category = 'reproductive_intact_male'
  → check patients.reproductive_status = 'intact_male'

IF clinical_category = 'age_pediatric'
  → check patients.age_months < contraindications.min_age_months
```

---

### `breed_pharmacogenomics` — Engine 4

One row per substance-mutation pair. Affects Engines 1, 2, and 4 simultaneously.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | `ivermectin uuid` |
| `applies_to_drug` | BOOLEAN | This drug is materially affected by this mutation | `true` |
| `mutation` | VARCHAR | `MDR1/ABCB1 delta`, `CYP2D15`, etc. | `MDR1/ABCB1 delta` |
| `affected_breeds` | TEXT[] | Breed list | `{Collie,Shetland Sheepdog,Australian Shepherd,Border Collie,McNab}` |
| `prevalence_pct` | DECIMAL | Mutation prevalence in affected breeds | `70.0` |
| `effect` | TEXT | Clinical consequence | `P-gp loss of function — CNS accumulation causing ataxia, blindness, coma, death` |
| `affected_engines` | INT[] | Which engines apply this multiplier | `{1,2,4}` |
| `risk_multiplier` | DECIMAL | Score escalation for affected animals | `2.5` |
| `data_source_id` | UUID FK → data_sources | | |

---

### `breed_dosing_modifiers` — Engines 2 & 4

Non-mutation breed pharmacokinetic/pharmacodynamic variability. Distinct from `breed_pharmacogenomics` which covers genetic mutations (MDR1, CYP2D15, etc.). This table covers breed-level population differences in drug handling that are NOT genetic mutation-based — e.g. sighthound sensitivity to acepromazine from low body fat, giant breed sensitivity from altered volume of distribution, terrier resistance. Sources: Plumb's breed-specific warnings in the Contraindications/Precautions section.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | `acepromazine uuid` |
| `species` | VARCHAR | `dog`, `cat` | `dog` |
| `affected_breeds` | TEXT[] | Specific breed list | `{Greyhound,Whippet,Italian Greyhound,Borzoi,Saluki}` |
| `breed_group` | VARCHAR | Functional grouping — `sighthound`, `giant_breed`, `terrier`, `herding`, `brachycephalic`, `other` | `sighthound` |
| `sensitivity_direction` | VARCHAR | `increased_sensitivity`, `decreased_sensitivity` | `increased_sensitivity` |
| `effect` | TEXT | Clinical manifestation of the breed difference | `Prolonged and deeper CNS depression; prolonged recovery` |
| `mechanism` | TEXT | PK/PD explanation | `Low body fat % → high volume of distribution for lipophilic drugs; pronounced CNS penetration` |
| `dose_adjustment_recommendation` | TEXT | Clinical recommendation from Plumb's | `Reduce initial dose by 25–30%; give lowest effective dose` |
| `affects_engine` | INT[] | Which engines apply this modifier | `{2,4}` |
| `evidence_level` | VARCHAR | `A`, `B`, `C`, `D` | `C` |
| `data_source_id` | UUID FK → data_sources | | |

---

### `lab_test_interactions` — Informational Advisory

Maps substances to laboratory tests they interfere with. Sourced from Plumb's "Laboratory Considerations" section. These are not DDIs — they are artifacts where the drug causes false/misleading lab readings. The DUR system surfaces these as `info`-level advisories alongside Engine 2 outputs when the patient has a relevant lab value on record.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | | `cephalexin uuid` |
| `lab_test` | VARCHAR | Standardised lab test name: `serum_creatinine`, `ALT`, `AST`, `glucose`, `BUN`, `bilirubin`, `urinary_glucose`, `urinary_protein`, `CBC_neutrophils` | `serum_creatinine` |
| `effect_direction` | VARCHAR | `falsely_elevate`, `falsely_decrease`, `method_interference` | `falsely_elevate` |
| `mechanism` | TEXT | Why the interference occurs | `Cephalosporins interfere with Jaffé colorimetric creatinine assay, producing falsely elevated readings` |
| `clinical_significance` | VARCHAR | `high` — may alter clinical decision; `moderate` — worth noting; `low` — minimal impact | `moderate` |
| `species` | TEXT[] | null = all species | `null` |
| `data_source_id` | UUID FK → data_sources | | |

---

### `condition_synonyms` — Engine 4

Normalises free-text patient history to canonical condition names.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `canonical_name` | VARCHAR | Matches `condition_name` in contraindications | `Active Neoplasia` |
| `synonym` | VARCHAR | Free-text variant | `암` |
| `language` | VARCHAR | `ko`, `en` | `ko` |
| `match_type` | VARCHAR | `exact`, `contains`, `regex` | `contains` |

---

### `therapeutic_classes` — Engine 5

One row per substance. Used to detect therapeutic duplicates.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | UNIQUE | `oclacitinib uuid` |
| `primary_class` | VARCHAR | `Immunosuppressant`, `NSAID`, `Antibiotic`, `Opioid` | `Immunosuppressant` |
| `subclass` | VARCHAR | `JAK inhibitor`, `Calcineurin inhibitor`, `Corticosteroid` | `JAK inhibitor` |
| `active_ingredient_inn` | VARCHAR | INN — catches brand/generic duplicates | `oclacitinib` |
| `duplication_exceptions` | JSONB | Intentional same-class combinations | `[]` |
| `data_source_id` | UUID FK → data_sources | | |

---

## 7. Layer 4 — RAG Vector Store

### `literature_chunks`

Each row is one ~500-token chunk from a scientific paper. Uses pgvector for similarity search.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `substance_id` | UUID FK → substances | Primary substance — nullable for multi-drug papers | `uuid` |
| `pmc_id` | VARCHAR | PubMed Central article ID | `PMC3456789` |
| `chunk_index` | INT | Position within article | `3` |
| `chunk_text` | TEXT | Raw text (~500 tokens) | |
| `embedding` | vector(1536) | OpenAI text-embedding-3-small output | |
| `field_group` | VARCHAR | `cyp`, `pk`, `pd`, `dosing`, `contraindication`, `ddi` | `contraindication` |
| `used_in_extraction` | BOOLEAN | Was this chunk used to populate a schema field | `true` |
| `data_source_id` | UUID FK → data_sources | | |

---

## 8. Layer 5 — Patients & Prescriptions

### `patients`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `name` | VARCHAR | Animal name |
| `species` | VARCHAR | `dog`, `cat` |
| `breed` | VARCHAR | Checked against `breed_pharmacogenomics` |
| `weight_kg` | DECIMAL | Current weight for dose calculation |
| `age_months` | INT | Age in months |
| `conditions` | TEXT[] | Free-text — normalised via `condition_synonyms` at scan time |
| `allergies` | TEXT[] | Drug/class names — matched via `allergy_class_members` at scan time |
| `lab_creatinine` | DECIMAL | mg/dL — drives `renal_dose_adjustments` |
| `lab_alt` | DECIMAL | U/L — drives hepatic risk escalation |
| `lab_bun` | DECIMAL | mg/dL — supplementary renal marker |
| `reproductive_status` | VARCHAR | `intact_female`, `intact_male`, `spayed`, `neutered`, `pregnant`, `lactating`, `unknown` — structured alternative to relying on free-text `conditions` for reproductive contraindications | `spayed` |
| `is_pregnant` | BOOLEAN | Explicit pregnancy flag — checked directly by Engine 4 for `reproductive_pregnancy` contraindications | `false` |
| `is_lactating` | BOOLEAN | Explicit lactation flag — checked directly by Engine 4 for `reproductive_lactation` contraindications | `false` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### `prescriptions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `patient_id` | UUID FK → patients | |
| `prescribing_vet` | VARCHAR | |
| `clinic` | VARCHAR | |
| `status` | VARCHAR | `draft`, `dur_pending`, `approved`, `dispensed` |
| `created_at` | TIMESTAMP | |

### `prescription_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `prescription_id` | UUID FK → prescriptions | |
| `product_id` | UUID FK → products | NULL for off-label/substance-only items |
| `variant_id` | UUID FK → product_variants | NULL for off-label/substance-only items |
| `substance_id` | UUID FK → substances | Direct substance reference — populated when no product match; NULL for product-matched items |
| `resolved_substance_ids` | UUID[] | Populated at scan time from `product_components` (product path) or directly from `substance_id` (substance path) |
| `dose_mg_per_kg` | DECIMAL | Prescribed dose in mg/kg |
| `dose_raw_input` | VARCHAR | Dose as entered by vet — audit field for substance-matched items (e.g. `5mg/kg BID`) |
| `frequency_hr` | INT | Dosing interval in hours |
| `duration_days` | INT | Treatment duration |
| `route` | VARCHAR | Must match `dosing_rules.route` |
| `match_type` | VARCHAR | How this item was resolved: `product_match`, `substance_match`, `unmatched` |
| `match_confidence` | VARCHAR | `exact`, `fuzzy`, `manual` — null for `unmatched` items |

---

## 9. Layer 6 — Audit & Quality

### `data_sources`

Every data point traces back here.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `source_type` | VARCHAR | `korean_db`, `pmc`, `plumbs`, `bsava`, `manual` | `pmc` |
| `source_name` | VARCHAR | Human-readable citation | `Steffan E et al. JVPT 2004` |
| `pmc_id` | VARCHAR | PMC article ID | `PMC1234567` |
| `doi` | VARCHAR | DOI | `10.1111/jvp.12345` |
| `url` | TEXT | URL for web sources | |
| `reliability_tier` | INT | 1=RCT/guideline, 2=case series, 3=theoretical | `2` |
| `accessed_at` | TIMESTAMP | When retrieved | |

### `extraction_log`

Full audit trail of RAG pipeline runs per substance.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `substance_id` | UUID FK → substances | |
| `field_group` | VARCHAR | Which schema section was targeted |
| `queries_run` | TEXT[] | All PMC queries executed |
| `pmc_ids_retrieved` | TEXT[] | Articles fetched |
| `chunks_processed` | INT | |
| `fields_extracted` | INT | |
| `confidence_high_count` | INT | |
| `confidence_medium_count` | INT | |
| `confidence_low_count` | INT | |
| `ran_at` | TIMESTAMP | |

### `review_queue`

Every low/medium confidence RAG extraction queued for pharmacist review.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `substance_id` | UUID FK → substances | |
| `table_name` | VARCHAR | Which DUR table the field belongs to |
| `field_name` | VARCHAR | Specific field |
| `extracted_value` | TEXT | What RAG extracted |
| `extraction_confidence` | VARCHAR | `low` or `medium` |
| `source_quote` | TEXT | Text that supported this extraction |
| `status` | VARCHAR | `pending`, `approved`, `rejected`, `edited` |
| `reviewed_by` | VARCHAR | Pharmacist name |
| `reviewed_at` | TIMESTAMP | |
| `reviewer_notes` | TEXT | |
| `created_at` | TIMESTAMP | |

### `dur_scan_results`

Every DUR scan stored permanently for audit and future model improvement. The `alerts` JSONB provides full replay fidelity. Structured per-alert analytics live in the companion `dur_alert_events` table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `prescription_id` | UUID FK → prescriptions | |
| `alerts` | JSONB | Full alert array from all 5 engines — for replay and display |
| `final_score` | INT | Composite safety score 0–100 |
| `engine_scores` | JSONB | `{"e1": 45, "e2": 0, "e3": 100, "e4": 20, "e5": 0}` |
| `pharmacist_action` | VARCHAR | `approved`, `modified`, `rejected` |
| `action_notes` | TEXT | What the pharmacist changed or noted |
| `scanned_at` | TIMESTAMP | |

---

### `dur_alert_events`

One row per individual alert per scan. Written atomically with `dur_scan_results`. Enables aggregate analytics without parsing JSONB — query patterns that `dur_scan_results.alerts` alone cannot support efficiently.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `scan_id` | UUID FK → dur_scan_results | Parent scan | `uuid` |
| `engine` | INT | Which engine fired: `1`–`5` | `1` |
| `alert_type` | VARCHAR | `ddi_explicit`, `ddi_inferred`, `dose_over`, `dose_under`, `dose_route_not_approved`, `allergy_direct`, `allergy_cross_react`, `contraindication`, `breed_risk`, `therapeutic_duplicate` | `ddi_explicit` |
| `substance_a_id` | UUID FK → substances | Primary substance involved | `cyclosporine uuid` |
| `substance_b_id` | UUID FK → substances | Secondary substance — null for single-substance alerts | `ketoconazole uuid` |
| `severity` | VARCHAR | `contraindicated`, `major`, `moderate`, `minor`, `info` | `major` |
| `severity_score` | INT | 0–100 | `75` |
| `source_row_id` | UUID | FK to the specific `ddi_pairs`, `contraindications`, etc. row that fired this alert | `uuid` |
| `source_table` | VARCHAR | Which table `source_row_id` points to | `ddi_pairs` |
| `pharmacist_disposition` | VARCHAR | `accepted`, `overridden`, `modified`, `pending` — updated when pharmacist acts | `accepted` |
| `override_reason` | TEXT | Free-text if pharmacist overrides | `null` |
| `created_at` | TIMESTAMP | |

**Analytics queries this enables:**
```sql
-- Most commonly triggered DDI pairs
SELECT substance_a_id, substance_b_id, COUNT(*) as trigger_count
FROM dur_alert_events WHERE alert_type = 'ddi_explicit'
GROUP BY substance_a_id, substance_b_id ORDER BY trigger_count DESC;

-- Override rate by engine
SELECT engine, COUNT(*) FILTER (WHERE pharmacist_disposition = 'overridden') * 100.0 / COUNT(*) as override_pct
FROM dur_alert_events GROUP BY engine;

-- Pharmacist override patterns
SELECT p.prescribing_vet, COUNT(*) as overrides
FROM dur_alert_events ae
JOIN dur_scan_results dsr ON dsr.id = ae.scan_id
JOIN prescriptions p ON p.id = dsr.prescription_id
WHERE ae.pharmacist_disposition = 'overridden'
GROUP BY p.prescribing_vet ORDER BY overrides DESC;
```

---

### `unmatched_drug_log`

Every prescription item that could not be resolved to a known substance at entry time. Written by the drug resolution pipeline (see Section 18). Permanent audit record — not purged after resolution.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID PK | | |
| `prescription_item_id` | UUID FK → prescription_items | The item that triggered this | `uuid` |
| `raw_input` | VARCHAR | Exact text entered by the vet | `CompoundX 혼합제` |
| `fuzzy_candidates` | JSONB | Top 3 substance matches surfaced to user, with similarity scores | `[{"substance_id": "...", "name": "metronidazole", "score": 0.42}]` |
| `pharmacist_action` | VARCHAR | `pending`, `resolved_existing`, `added_new`, `dismissed` | `pending` |
| `resolved_substance_id` | UUID FK → substances | Set when pharmacist links to an existing substance | `null` |
| `new_synonym_added` | BOOLEAN | TRUE if resolution added a row to `substance_synonyms` to prevent future misses | `false` |
| `notes` | TEXT | Free-text pharmacist notes | |
| `created_at` | TIMESTAMP | | |
| `resolved_at` | TIMESTAMP | | |

---

## 10. Korean DB Normalization Rules

### Decision Tree

```
New Korean DB entry arrives
          │
          ▼
Identify INN substance name
(normalize 오클라시티니브 말레산염 → oclacitinib)
          │
          ▼
Does this INN exist in substances?
          │
    ┌─────┴──────┐
   YES            NO
    │              └──→ INSERT substances row
    │                   Queue for RAG pipeline
    │
    ▼
Identify route
(경구 → oral, 피하 → SC, 근육 → IM, 정맥 → IV)
          │
          ▼
Does products row exist for
this substance + route?
          │
    ┌─────┴──────┐
   YES            NO
    │              └──→ INSERT products row
    │
    ▼
Extract tablet strength
          │
          ▼
Does product_variants row exist
for this strength?
          │
    ┌─────┴──────┐
   YES            NO
    │              └──→ INSERT product_variants row
    │                   Store korean_db_index here
    ▼
Duplicate — log and skip
```

### What to Extract from Each Korean DB Entry

**Always extract (directly available):**
```
products:          korean_name_base, route, dosage_form, approved_species
product_variants:  korean_db_index, korean_name_full, strength_value, strength_unit, strength_per,
                   manufacturer, license_number, license_date, license_status,
                   is_prescription_only, package_sizes, storage_conditions,
                   shelf_life_months, split_shelf_life_days,
                   withdrawal_period_*_days
dosing_rules:      Convert tablet count table to mg/kg. Store mg/kg, not tablet counts.
allergy_class_members: allergy_class from Korean classification code
therapeutic_classes: primary_class from drug class
contraindications: Any explicit contraindications in 주의사항 section.
                   임신(pregnancy)/수유(lactation)/생식(reproductive) entries
                   → set clinical_category = 'reproductive_pregnancy' / 'reproductive_lactation'
                   → do NOT rely on free-text conditions[] path for these
```

**Queue for RAG pipeline (not in Korean DB):**
```
cyp_profiles, pk_parameters, pd_risk_flags,
transporter_profiles, ddi_pairs (most of them),
renal_dose_adjustments, breed_pharmacogenomics
```

**Extractable from Korean DB 주의사항 section:**
```
상호작용 section → ddi_pairs (explicit incompatibilities)
부작용 section   → pd_risk_flags (some flags)
금기사항 section → contraindications
```

---

## 11. How Route of Administration Affects the Schema

### What Changes vs What Stays the Same

| Parameter | Route-independent? | Stored where | Note |
|---|---|---|---|
| CYP isoform roles | ✅ Yes | `cyp_profiles` — no route column | |
| Half-life | ✅ Yes | `pk_parameters` route='all' | |
| Protein binding % | ✅ Yes | `pk_parameters` route='all' | |
| Binding site | ✅ Yes | `pk_parameters` route='all' | |
| Primary elimination | ✅ Yes | `pk_parameters` route='all' | |
| PD risk flags | ✅ Yes | `pd_risk_flags` | |
| DDI pairs | ✅ Yes | `ddi_pairs` | |
| Contraindications | ✅ Yes | `contraindications` | |
| Bioavailability | ❌ Route-specific | `pk_parameters` route='oral'/'SC'/etc. | |
| Time to peak | ❌ Route-specific | `pk_parameters` route-specific row | |
| Dosing rules | ❌ Route-specific | `dosing_rules` — always filtered by route | |

### The Injection Product Pattern

For a drug with both oral and injection forms (e.g. Cerenia):

```
substances (1 row)
  inn_name: maropitant

products (2 rows)
  (maropitant, oral)  → "세레니아 정"
  (maropitant, SC)    → "세레니아 주사액"

pk_parameters (3 rows for dogs)
  (maropitant, dog, 'all')  → half_life=7hr, protein_binding=0.99
  (maropitant, dog, 'oral') → bioavailability=0.37, time_to_peak=2hr
  (maropitant, dog, 'SC')   → bioavailability=0.91, time_to_peak=0.75hr

dosing_rules (2 rows for dogs)
  (maropitant, dog, oral, 2mg/kg)
  (maropitant, dog, SC, 1mg/kg)

cyp_profiles (1 row)  ← same regardless of route
pd_risk_flags (1 row) ← same regardless of route
ddi_pairs             ← same regardless of route
contraindications     ← same regardless of route
```

---

## 12. Handling Multi-Route Products & Flexible Dosing Formats

### Multi-Route Products (45.7% of Dataset)

**Problem**: A single Korean DB entry often lists multiple routes of administration. Example:

```
덱사주 (Dexamethasone injection):
  개/고양이: 1~2ml 피하 또는 근육주사        (SC or IM)
```

**Solution**: The `products` table has ONE row per substance+route combination. For multi-route products:

1. **Parse each route separately** during Korean DB ingestion
2. **Create individual** `products` rows for each route
3. Create separate `dosing_rules` rows for each route (different mg/kg for SC vs IM)
4. Use `product_multi_routes` mapping table to track which original Korean DB entry generated multiple products

```sql
products:
  Row 1: (dexamethasone, SC)
  Row 2: (dexamethasone, IM)
  Row 3: (dexamethasone, IV)

dosing_rules:
  (dexamethasone, dog, SC, 0.5-1.0 mg/kg)
  (dexamethasone, dog, IM, 0.5-1.5 mg/kg)
  (dexamethasone, dog, IV, 0.5-1.0 mg/kg)
  (dexamethasone, cat, SC, 0.125-0.5 mg/kg)
  (dexamethasone, cat, IM, 0.125-0.5 mg/kg)
```

### Variable Dosing Formats (35% of Dataset)

Korean veterinary products use **6+ different dosing formats**, not just mg/kg:

| Dosing Format | Count | % | Handling |
|---|---|---|---|
| **mg/kg** | 120 | 13.7% | Standard — min/max dose in mg/kg |
| **ml/kg** | 138 | 15.7% | Liquid formulations — ml/kg body weight |
| **ml/animal** | 104 | 11.8% | Fixed volume per injection "1-2ml" — no weight calc |
| **IU/CFU** | 196 | 22.3% | Vaccines/probiotics — use dosing_type=`iU_based` |
| **Tablet count/day** | 64 | 7.3% | "1정 1일 1회" — infer mg from variant strength |
| **Feed-based** | 308 | 35.1% | "2kg per ton of feed" — excluded from DUR checks |

**Schema Solution**: Use `dosing_type` + `dose_unit` fields in `dosing_rules`:

```sql
-- Standard mg/kg
dosing_rules: (enrofloxacin, dog, IV, dosing_type='mg_per_kg', dose_unit='mg/kg',
               min_dose=10, max_dose=20)

-- Liquid formulation ml/kg
dosing_rules: (sulfamethoxazole, dog, oral, dosing_type='ml_per_kg',
               dose_unit='ml/kg', min_dose=0.2, max_dose=0.3)

-- Fixed volume injection
dosing_rules: (dexamethasone, dog, SC, dosing_type='ml_per_animal',
               dose_unit='ml', min_dose=1, max_dose=2)

-- Tablet-based (infer from variant strength)
dosing_rules: (terbinafine, dog, oral, dosing_type='tablet_per_day',
               dose_unit='tablets', min_dose=6, max_dose=6,
               reference_strength_mg=5)

-- IU-based vaccine
dosing_rules: (DHPP_vaccine, dog, IM, dosing_type='iU_based',
               dose_unit='dose', min_dose=1, max_dose=1)

-- Feed supplement (excluded)
dosing_rules: (immune_guardian, dog, oral, dosing_type='feed_based',
               dose_unit='kg/ton_feed', is_feed_additive=true, per_ton_feed_kg=2.0)
```

**DUR Engine 2 (Dosage) Logic Update**:

```
IF dosing_rules.is_feed_additive = true
  → Skip dosing check (not applicable to individual animals)

ELSE IF dosing_rules.dosing_type = 'mg_per_kg'
  → Standard: prescribed_mg_per_kg vs min/max_dose

ELSE IF dosing_rules.dosing_type = 'ml_per_kg'
  → Convert: (prescribed_ml × concentration_mg_per_ml) / weight_kg vs min/max_dose

ELSE IF dosing_rules.dosing_type = 'ml_per_animal'
  → Manual alert: "prescribed volume {X}ml vs recommended {Y-Z}ml"

ELSE IF dosing_rules.dosing_type = 'tablet_per_day'
  → Infer: (prescribed_tablets × reference_strength_mg) / weight_kg vs min/max_dose

ELSE IF dosing_rules.dosing_type = 'iU_based'
  → Alert: "non-standard dosing format (IU-based) — manual review recommended"
```

---

## 13. Handling Vitamins & Supplements

Vitamins and supplements fall into two categories requiring different DUR treatment.

### The `substance_category` Field

| Category | Description | DUR Engine Behaviour | Examples |
|---|---|---|---|
| `pharmaceutical` | Standard drug — full DUR | All 5 engines run | Apoquel, cyclosporine, antibiotics |
| `vitamin_active` | Pharmacologically active at therapeutic doses | All 5 engines run | Vitamin K, high-dose Vitamin D |
| `nutraceutical` | Limited DUR — flag if known interactions | Engines 1 and 4 only | Joint supplements, probiotics |
| `vitamin_inert` | No meaningful DDI at standard doses | Auto-pass | B-complex, standard multivitamins |

---

### Which Vitamins Are `vitamin_active`

| Vitamin/Supplement | Why active | Key interaction |
|---|---|---|
| Vitamin K | Directly reverses anticoagulants | Critical DDI with warfarin |
| Vitamin D (high dose) | Toxicity risk | Interacts with calcium channel blockers |
| Fish oil (therapeutic dose) | Antiplatelet effect | Bleeding risk with NSAIDs |
| Vitamin C (very high dose) | Urine acidification | Affects excretion of some drugs |
| Iron supplements | Chelation | Reduces absorption of fluoroquinolones |

---

## 14. The Null Policy

**Add everything to the database. Leave unknowns as null. Never omit a row because data is incomplete.**

Null fields are invisible to users. An injection drug with null PK data doesn't break anything — Engine 2 simply doesn't fire bioavailability-dependent alerts.

The `data_completeness` scores tell the truth. A substance with `data_completeness_e1 = 0.0` shows a banner in the pharmacist UI.

The `formulary_status` field handles scope gracefully:
- `out_of_scope` → professional out-of-scope message
- `pending` → expected support date message
- `active` with low completeness → warning banner

### What to Populate from Korean DB vs What to Leave Null

| Field group | Korean DB gives you this? | Action |
|---|---|---|
| Product name, route, form | ✅ Yes | Populate |
| Variant strength, package sizes | ✅ Yes | Populate |
| Dosing rules (mg/kg) | ✅ Partially (convert from tablet table) | Populate |
| Withdrawal periods | ✅ Yes | Populate |
| Explicit contraindications | ✅ In 주의사항 | Populate |
| Explicit DDI warnings | ✅ In 상호작용 | Populate |
| Allergy class | ✅ From classification code | Populate |
| CYP metabolism | ❌ No | Null — queue for RAG |
| PK parameters | ❌ No | Null — queue for RAG |
| PD risk flags | ❌ Partially | Partially populate, queue rest for RAG |
| Breed pharmacogenomics | ❌ No | Null — queue for RAG |
| Renal adjustments | ❌ No | Null — queue for RAG |

---

## 15. Data Sources & Coverage

| Table | Primary Source | Secondary Source | Expected Fill Rate |
|-------|---------------|-----------------|-------------------|
| `products` | Korean Vet DB | Manual | ~100% |
| `product_variants` | Korean Vet DB | Manual | ~100% |
| `product_components` | Korean Vet DB | Manual | ~100% |
| `substances` | Korean Vet DB + human list | Manual | ~100% |
| `cyp_profiles` | PMC | Plumb's | Dog: 60–75%, Cat: 30–45% |
| `pk_parameters` | PMC | Plumb's | Dog: 70–80%, Cat: 40–55% |
| `pd_risk_flags` | PMC | Plumb's | 65–75% overall |
| `transporter_profiles` | PMC | VCPL (WSU) | 50–65% |
| `ddi_pairs` | PMC + manual | Plumb's | Biggest gap — start RAG here |
| `dosing_rules` | Korean Vet DB + Plumb's | BSAVA | Dog: 80–90%, Cat: 60–70% |
| `renal_dose_adjustments` | PMC | Plumb's | 40–60% |
| `allergy_class_members` | Korean DB class codes + PMC | Manual | ~80% |
| `class_cross_reactivity` | PMC | Manual | ~15–20 class pairs initially |
| `contraindications` | Korean DB + PMC | Plumb's | 70–80% |
| `breed_pharmacogenomics` | PMC | VCPL (WSU) | 85–90% (MDR1 well documented) |
| `breed_dosing_modifiers` | Plumb's | Manual | 60–75% (well covered for dogs; sighthound/giant breed data is good) |
| `lab_test_interactions` | Plumb's | PMC | 40–60% (only drugs with known lab interference) |
| `condition_synonyms` | Manual curation | — | 100% (small table) |
| `therapeutic_classes` | Korean DB + manual | — | ~100% |

### Total Drug Coverage

| Category | Products | Unique Substances | Priority |
|----------|---------|------------------|---------|
| Korean licensed vet drugs | ~1,000 | ~400 | 1st |
| Human drugs used off-label | 0 new products | ~150 | 2nd |
| Imported vet drugs (Apoquel, etc.) | ~50 | ~30 | 3rd |
| Compounded drugs | ~20 | 0 new | 4th |
| **Total** | **~1,070** | **~580** | |

Human drugs used off-label in Korean vets have no product entries in the Korean DB but need full substance-level DUR coverage. These are added as `source_type: human_label` products.

---

## 16. How a DUR Scan Uses the Database

Exact query flow when a pharmacist clicks "Execute DUR Scan":

```
Step 0 — Drug resolution (see Section 18 for full pipeline)
  IF prescription_items.match_type = 'unmatched'
    → DUR blocked for this item; prescription stays in dur_pending
    → Row written to unmatched_drug_log; pharmacist notified

  IF prescription_items.match_type = 'substance_match'
    → resolved_substance_ids = [prescription_items.substance_id]
    → Proceed to Step 1; Engine 2 will fire off-label dosing alert

Step 1 — Resolve prescription to substances
  prescription_items
    → product_id → products → substance_id
    → variant_id → product_variants (for strength/dose calculation)
    → product_components (for combination products → multiple substances)

Step 2 — Check formulary status
  IF substance.formulary_status = 'out_of_scope'
    → Return professional out-of-scope message, skip engines

Step 3 — Check substance category
  IF substance.substance_category = 'vitamin_inert'
    → Auto-pass, skip engines

Step 4 — All engines run concurrently:

  Engine 1 (DDI — 35%):
    Pass 1 — Explicit pair lookup (O(1)):
      → ddi_pairs WHERE (substance_a_id, substance_b_id) matches
      → If found: use documented severity + management text directly

    Pass 2 — CYP transitive inference (only for pairs NOT in ddi_pairs):
      → cyp_profiles: find all CYP isoforms where Drug A and Drug B share an isoform
      → IF Drug A is substrate AND Drug B is inhibitor/inducer of same isoform:
          derive inferred_severity from inhibition_strength (see ddi_inference_log rules)
          write record to ddi_inference_log (NOT back to ddi_pairs)
      → protein_binding displacement check via pk_parameters (albumin site conflict)
      → pd_risk_flags: additive toxicity flags (e.g. both nephrotoxic)
      → transporter_profiles: P-gp substrate + inhibitor overlap
      → breed_pharmacogenomics: MDR1 risk escalation if patient.breed affected

  Engine 2 (Dosage — 25%):
    → dosing_rules (filtered: substance + species + route — ALL THREE)
    → renal_dose_adjustments (if patient.lab_creatinine elevated)
    → breed_pharmacogenomics.risk_multiplier (if patient.breed affected)
    → breed_dosing_modifiers (if patient.breed in affected_breeds AND applies_to_drug=true)
        → surface dose_adjustment_recommendation as `info` or `moderate` advisory
    → lab_test_interactions (if patient has lab values on record AND substance has known interference)
        → fire `info`-level advisory: "[drug] may falsely [elevate/decrease] [lab_test] readings"

  Engine 3 (Allergy — 20%):
    → allergy_class_members (resolve prescribed substance → allergy class)
    → class_cross_reactivity (JOIN: patient allergy class × prescribed drug class)
    → Direct match: IF prescribed substance_id IN patient.allergies → fire allergy_direct alert
    → Cross-react match: IF class_cross_reactivity row found → fire allergy_cross_react alert

  Engine 4 (Disease — 15%):
    Pass 1 — Disease-based (clinical_category = 'disease'):
      → condition_synonyms (normalise patient.conditions to canonical names)
      → contraindications WHERE clinical_category = 'disease' AND condition matches

    Pass 2 — Reproductive (direct structured check, no text matching):
      → IF patient.is_pregnant:    contraindications WHERE clinical_category = 'reproductive_pregnancy'
      → IF patient.is_lactating:   contraindications WHERE clinical_category = 'reproductive_lactation'
      → IF patient.reproductive_status IN ('intact_female','pregnant','lactating'):
           contraindications WHERE clinical_category = 'reproductive_intact_female'
      → IF patient.reproductive_status = 'intact_male':
           contraindications WHERE clinical_category = 'reproductive_intact_male'

    Pass 3 — Age and breed:
      → contraindications WHERE clinical_category = 'age_pediatric' AND patient.age_months < min_age_months
      → breed_pharmacogenomics (if patient.breed in affected_breeds)
      → literature_chunks via pgvector similarity search (RAG explanation)

  Engine 5 (Duplication — 5%):
    → therapeutic_classes (compare primary_class across all substances)
    → Check duplication_exceptions JSONB before firing alert

Step 5 — Data completeness check
  IF substance.overall_completeness < 0.60
    → Append warning banner to all alerts

Step 6 — Score aggregation and storage

  Per-engine score = highest severity_score of any alert fired by that engine
    (0 if no alerts fired)
    Severity → score mapping: contraindicated=100, major=75, moderate=40, minor=15, info=5

  Weighted composite:
    raw_score = (E1_score × 0.35) + (E2_score × 0.25) + (E3_score × 0.20)
              + (E4_score × 0.15) + (E5_score × 0.05)
    final_score = ROUND(raw_score)

  Hard override rule:
    IF any alert has severity = 'contraindicated'
      → final_score = 100  (regardless of weighted sum)
    engine_scores always records the actual per-engine scores for analytics,
    even when the hard override fires.

  → Write to dur_scan_results (alerts JSONB, final_score, engine_scores)
  → Write one row per alert to dur_alert_events (atomic with above)
```

---

## 17. Database Scale Estimates

Based on analysis of Korean Veterinary Drug Database (`dog_drugs_cleaned.jsonl` — 742 pharmaceutical products after 수출용 removal):

| Metric | Estimate |
|--------|----------|
| Total tables | 32 (includes `product_multi_routes`, `ddi_inference_log`, `allergy_class_members`, `class_cross_reactivity`, `dur_alert_events`, `unmatched_drug_log`, `breed_dosing_modifiers`, `lab_test_interactions`) |
| Products | ~900–1,000 rows (multi-route expansion from ~742 raw entries) |
| Product variants | ~2,000–2,600 rows (multiple strengths per product) |
| Product multi-routes mappings | ~500–650 rows (45.7% of products have 2+ routes) |
| Substances | ~580–630 rows |
| cyp_profiles rows | ~1,800–2,200 |
| pk_parameters rows | ~1,800–2,200 |
| pd_risk_flags rows | ~580–630 |
| transporter_profiles rows | ~580–630 |
| ddi_pairs rows | ~3,000–8,000 (explicit + RAG-reviewed pairs only; CYP-inferred pairs are NOT pre-stored) |
| dosing_rules rows | ~4,000–5,500 (multiple routes × species variations) |
| allergy_class_members rows | ~700–800 (substances × avg 1.2 classes each) |
| class_cross_reactivity rows | ~30–60 (15–20 class pairs × 2 directions) |
| contraindications rows | ~1,200–1,800 |
| condition_synonyms rows | ~300–500 |
| therapeutic_classes rows | ~580–630 |
| breed_dosing_modifiers rows | ~80–150 (breed group × substance; sighthound/giant breed/terrier patterns) |
| lab_test_interactions rows | ~100–250 (subset of ~580 substances with documented lab test interference) |
| ddi_inference_log rows | ~50–200 per scan; purge/archive after 90 days |
| unmatched_drug_log rows | ~1–5% of prescription items; permanent record |
| dur_alert_events rows | ~3–15 per scan; permanent audit record |
| literature_chunks (pgvector) | ~38,000–110,000 |
| Vector storage (1536-dim) | ~650MB |
| Total database size | ~2–5GB including indexes |
| DUR scan query time | <200ms all engines |

**Data Coverage Notes**:
- Product scope: dogs and cats only
- 45.7% of products have multiple approved routes (IM, SC, IV, oral)
- 63.2% of products have ml/concentration dosing information
- 35.1% of dataset excluded from DUR (feed-based supplements, topical procedures)
- 93.5% products have single active ingredient; 5.8% have 2+ components

---

## 18. Drug Resolution Pipeline (Input Normalization)

Runs **before** the DUR scan, at prescription item entry time. Converts whatever the vet typed into a resolvable substance or product. All three outcomes produce a valid `prescription_items` row — they differ in which fields are populated and what the scan can do.

### Resolution Steps

```
Input: raw text entered by vet (e.g. "메트로니다졸", "metronidazole 250mg", "CompoundX 혼합제")
          │
          ▼
Step 1 — Exact match (fast path)
  substance_synonyms.synonym = input  (case-insensitive, trimmed)
  OR substances.inn_name = normalize(input)
  OR substances.korean_name = input
  OR product name match → products → substance_id
          │
    match found → OUTCOME A (product_match or substance_match)
          │ no match
          ▼
Step 2 — Fuzzy match (pg_trgm trigram similarity ≥ 0.40)
  Run against: substance_synonyms.synonym, substances.inn_name, substances.korean_name
  Return top 3 candidates with scores
  Surface to vet: "Did you mean: metronidazole (0.81) / ornidazole (0.52) / tinidazole (0.44)?"
          │
    vet confirms → OUTCOME A (substance_match, match_confidence='fuzzy')
    vet rejects all → OUTCOME B (unmatched)
```

### Three Outcomes

**Outcome A — product_match** (Korean-licensed or human-label product found):
- `prescription_items.product_id` populated
- `prescription_items.substance_id` = NULL
- `match_type = 'product_match'`
- DUR scan: all 5 engines run, full data

**Outcome A — substance_match** (substance known, no product row):
- `prescription_items.product_id` = NULL
- `prescription_items.substance_id` populated
- `match_type = 'substance_match'`
- DUR scan: Engines 1, 3, 4, 5 run normally
- Engine 2: fires `dose_route_not_approved` alert (`info` severity): *"No approved veterinary dosing data — off-label use, manual dose review required"*
- `dose_raw_input` stores exactly what the vet entered

**Outcome B — unmatched** (nothing found after fuzzy):
- `prescription_items.match_type = 'unmatched'`
- `prescription_items.product_id` = NULL, `substance_id` = NULL
- DUR scan: **blocked** for this item — engines cannot run against an unknown substance
- Row written to `unmatched_drug_log` with `pharmacist_action = 'pending'`
- Pharmacist is notified; prescription stays in `dur_pending` status

### What the Pharmacist Does with `unmatched_drug_log`

| Action | What happens |
|--------|-------------|
| `resolved_existing` | Links `resolved_substance_id` to an existing substance; adds synonym to `substance_synonyms` (`new_synonym_added = TRUE`); DUR scan re-runs automatically |
| `added_new` | Creates a new `substances` row; queues it for RAG pipeline; DUR scan re-runs when data available |
| `dismissed` | Removes the item from the prescription; scan proceeds without it |

### Self-Healing Synonyms

When a pharmacist resolves an unmatched entry to an existing substance, the resolution flow **always** asks: *"Add '[raw_input]' as a synonym for [substance]?"*. If confirmed, a row is inserted into `substance_synonyms`. The next vet who types the same thing gets an exact match. The `unmatched_drug_log` table is the data source for synonym gap analysis.

---

*Vet DUR System — Database Architecture Reference*
*Version 2.0 — Simplified schema reference*
