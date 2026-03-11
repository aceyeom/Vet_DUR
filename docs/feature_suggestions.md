# NuvoVet — Feature Suggestions

---

## Tier 1 — High value, low implementation effort (schema already supports it)

### 1. Allergy Class Cross-Reactivity Alert

**Clinical problem:** When a patient has a documented drug allergy (e.g., to sulfonamides), the
clinician may not know that a structurally related drug in the same chemical class carries
cross-reactivity risk. Prescribing trimethoprim-sulfamethoxazole to a patient already on a
sulfonamide-containing compound risks type I or type IV hypersensitivity reactions that can be
severe.

**Schema fields used:**
- `drug_identity.allergy_class` (populated for 50+ drugs including `sulfonamide`, `aminoglycoside`,
  `fluoroquinolone`, `beta-lactam`, `NSAID`, `macrolide`, `opioid`, `benzodiazepine`, etc.)

**Implementation complexity:** The frontend collects each drug's `allergy_class` from the regimen,
then checks every added drug against a static cross-reactivity map (e.g., sulfonamide → sulfonamide
members). Requires one new UI field for patient-reported allergy class and a small lookup table.

**Data gaps:** `allergy_class` is `null` for roughly half the dataset, primarily drugs with no
established chemical class cross-reactivity risk. No gap for the drug classes most clinically
relevant to cross-reactivity.

---

### 2. Narrow Therapeutic Index (NTI) Regimen Flag

**Clinical problem:** Drugs with a narrow therapeutic index — including digoxin, phenobarbital,
cyclosporine, theophylline, insulin formulations, aminoglycosides, and most chemotherapy agents —
require tighter-than-usual monitoring when co-prescribed with CYP inhibitors, inducers, or
protein-displacing agents. Without a visible NTI warning, a clinician may miss that adding a CYP
inhibitor to a phenobarbital regimen is more hazardous than usual.

**Schema fields used:**
- `species_flags.narrow_therapeutic_index` (boolean, populated for 160+ drugs including digoxin,
  phenobarbital, theophylline, cyclosporine, all insulins, all aminoglycosides)
- `metabolism_and_clearance.cyp_profile.substrates` (to identify which NTI drugs are CYP substrates
  that could be affected by co-administered inhibitors)

**Implementation complexity:** When any drug in the active regimen has
`narrow_therapeutic_index = true`, render a persistent banner advising more frequent monitoring
(TDM, lab recheck). Cross-reference against other drugs' CYP inhibitor/inducer fields to escalate
severity. No new data fields needed.

**Data gaps:** None for the implemented feature. TDM frequency recommendations could be added to
`dosage_and_kinetics` in a future schema revision, but the flag itself is sufficient for an alert.

---

### 3. Potassium Conflict Detection (K-Sparing vs. K-Depleting Stacking)

**Clinical problem:** Co-prescribing a potassium-depleting drug (e.g., furosemide, corticosteroids,
insulin) with a potassium-sparing drug (e.g., spironolactone, ACE inhibitors, trilostane) produces
unpredictable serum potassium levels — either additive depletion causing hypokalemia and cardiac
arrhythmia, or antagonistic effects causing hyperkalemia in animals already on ACE inhibitors.
This is particularly dangerous in cats with concurrent cardiac disease and hypertension.

**Schema fields used:**
- `species_flags.electrolyte_effect` — values: `"k_depleting"` (52 drugs) or `"k_sparing"` (22
  drugs)

**Implementation complexity:** Extend the existing additive risk stacking logic to scan the regimen
for any combination of `k_depleting` + `k_depleting` (flag hypokalemia risk) and `k_depleting` +
`k_sparing` (flag unpredictable potassium, recommend electrolyte panel). Two new stacking rules in
the DUR engine.

**Data gaps:** The `electrolyte_effect` field currently captures only potassium effects. Drugs with
calcium or sodium effects are not tagged. A future schema extension could add
`electrolyte_effect_secondary`.

---

### 4. Reversal Agent Lookup

**Clinical problem:** In an emergency — opioid respiratory depression, benzodiazepine over-sedation,
neuromuscular blockade — the clinician needs to instantly know which reversal agent to reach for and
whether one exists at all. Delays caused by consulting a handbook cost time when the patient is
apneic.

**Schema fields used:**
- `drug_identity.has_reversal` (boolean)
- `drug_identity.reversal_agent` (free text, e.g., `"Naloxone"`, `"Flumazenil"`,
  `"Protamine sulfate"`, `"Atropine"`)
- `drug_identity.reversal_evidence` (evidence quality note)

**Implementation complexity:** Display a "Reversal available" badge on each drug card in the regimen
view if `has_reversal = true`, expanding to show `reversal_agent` and `reversal_evidence` on click.
Requires only frontend rendering logic against already-populated fields. No new backend work.

**Data gaps:** `reversal_agent` is populated for ~20 drugs with well-established reversal agents.
For many drugs (e.g., most NSAIDs, chemotherapy), `has_reversal = false` is correct and complete.

---

### 5. Client Discharge Instruction Generator

**Clinical problem:** Owners managing outpatient drug regimens need plain-language instructions
covering administration timing, what to watch for, and when to call the clinic. Clinicians often
write these manually from memory, introducing inconsistency and omissions.

**Schema fields used:**
- `section_1_2_10.client_info` (populated for all 877 drugs — structured Plumb's-derived
  client-facing text covering timing, side effects to observe, food interactions, and storage)
- `dosage_and_kinetics.[species].dosage_list[].frequency` (for dosing schedule)
- `dosage_and_kinetics.[species].dosage_list[].route`
- `timing_profile.onset_min` and `timing_profile.t_max_hr` (for timing guidance)

**Implementation complexity:** Add a "Generate Discharge Notes" button to the regimen view that
concatenates `client_info` blocks for each prescribed drug, filtered by species, and renders a
printable or PDF-exportable page. Requires a print stylesheet and a simple template. No new data
needed.

**Data gaps:** `client_info` is present for all drugs but is in Korean for most entries. If the
system needs bilingual output, English versions would require translation or a secondary field.

---

## Tier 2 — High value, moderate effort (needs new data fields or routes)

### 1. Therapeutic Duplication Detection

**Clinical problem:** A regimen containing two NSAIDs (e.g., meloxicam + carprofen), two
corticosteroids, or two opioids represents therapeutic duplication — not a drug-drug interaction in
the classical sense, but a clinical error with serious consequences including GI ulceration, adrenal
suppression, and respiratory depression. Korean veterinary practices with multiple prescribers in
one clinic are particularly at risk.

**Schema fields used:**
- `drug_identity.class` (e.g., `"NSAID"`, `"Corticosteroid"`, `"Opioid"`, `"Antibiotic"`)
- `additive_risks.gi_ulcer` (would escalate severity for dual-NSAID detection)
- `risk_flags.gi_ulcer` (risk level per drug)
- `effects_and_mechanisms.common_mechanism` (confirm pharmacological overlap)

**Implementation complexity:** Requires building a class-equivalence map (which `class` values
constitute duplication) and a new DUR rule that fires when two drugs share a therapeutically
duplicating class. The `drug_identity.class` field is free text and inconsistently populated (~15%
"Unknown"), so a normalization pass or a secondary controlled-vocabulary field would be needed first.

**Data gaps:** `drug_identity.class` uses inconsistent strings (e.g., `"Antibiotic"` vs.
`"Antiretroviral"` for overlapping aminoglycosides). A new `drug_identity.pharmacological_class`
field with a controlled vocabulary (ATC-style) would make this robust.

---

### 2. Dose Interval Conflict Checker (Timing Overlap Safety)

**Clinical problem:** Drugs administered at the same frequency but with dangerous additive effects
at peak concentration — for example, two CNS depressants both dosed BID at the same time — are
safer if staggered. Conversely, some combination therapies require synchronized dosing for efficacy
(e.g., amoxicillin + clavulanate). The current system calculates dose amounts but does not reason
about simultaneous peak concentration overlap.

**Schema fields used:**
- `dosage_and_kinetics.[species].dosage_list[].frequency` (SID/BID/TID/QID)
- `timing_profile.t_max_hr` (time to peak concentration)
- `timing_profile.half_life_hr.mean` (for overlap duration estimate)
- `additive_risks` (sedation, qt_prolongation — to identify which overlaps matter)

**Implementation complexity:** Requires a new scheduling module that takes the patient's actual
dosing times as input (a new UI component), calculates peak concentration windows for each drug,
and checks for overlap against the `additive_risks` flags. Moderate complexity: new frontend time
input, new backend overlap calculation logic, and a staggering recommendation output.

**Data gaps:** `timing_profile.onset_min` and `t_max_hr` are null for approximately 30% of drugs.
A data enrichment pass would be needed before coverage is clinically meaningful.

---

### 3. Pediatric and Geriatric Dosing Flags

**Clinical problem:** Neonatal, pediatric, and geriatric animals have significantly different
pharmacokinetics — immature hepatic CYP enzymes in neonates, reduced GFR in geriatric patients,
and altered protein binding in both groups. A 12-week-old puppy receiving a standard adult dose
of acepromazine or phenobarbital can be dangerously over-dosed. The current weight-adjusted dosing
does not account for age-related kinetic changes.

**Schema fields used:**
- `hepatic_dose_adjustment.applies` and `hepatic_dose_adjustment.adjustment_type` (as a proxy for
  reduced hepatic metabolism, which characterizes neonatal pharmacokinetics)
- `renal_dose_adjustment.adjustment_factor` (relevant for geriatric patients with reduced GFR)
- `species_notes.[species]` (often contains explicit age-related notes, e.g., acepromazine's note
  mentions "일부 노령 및 소아 환자 포함" under hepatic adjustment)
- `timing_profile.half_life_hr` (extended in patients with reduced clearance)

**Implementation complexity:** Requires adding an `age_group` field to the patient input form
(neonate / pediatric / adult / geriatric), plus a new schema field
`dosage_and_kinetics.[species].age_adjustment` with pediatric/geriatric modifiers. Without that
new field, the system could display a non-specific caution banner based on hepatic/renal adjustment
flags, but precise dose modification recommendations would require structured data not yet present.

**Data gaps:** Age-specific kinetic data exists in `species_notes` as free text for many drugs but
is not structured. A schema addition of `dosage_and_kinetics.[species].pediatric_note` and
`dosage_and_kinetics.[species].geriatric_note` fields would be required for rule-based alerts.

---

### 4. Pregnancy and Lactation Safety Tier Display

**Clinical problem:** Veterinary patients that are pregnant or nursing require a separate safety
evaluation. Drugs like metronidazole are contraindicated in the first trimester (teratogenic in
rodent models), misoprostol is an abortifacient, and many NSAIDs impair fetal renal development.
Currently there is no pregnancy status input and no pregnancy-specific warning tier in the UI.

**Schema fields used:**
- `contraindications[].condition` — many entries contain terms like `"pregnancy"`,
  `"임신"`, `"first trimester"`, `"lactation"`, `"nursing"`
- `contraindications[].severity` (`"absolute"` vs. `"relative"`)
- `contraindications[].action`
- `section_1_2_10.indications` (sometimes contains reproductive safety notes)

**Implementation complexity:** Requires adding a `reproductive_status` field to the patient input
(pregnant / lactating / intact female / intact male / neutered). The DUR engine then filters
`contraindications[]` for pregnancy/lactation-related `match_terms` and surfaces them as a
dedicated reproductive safety panel. The `match_terms` arrays are keyword-based, so the filter is
straightforward. Medium effort for UI redesign; low effort for the rule logic itself.

**Data gaps:** Reproductive safety information is embedded in `contraindications[].condition` as
free text rather than a structured boolean field. A new `contraindications[].reproductive_flag`
field (`"pregnancy"` / `"lactation"` / `"breeding_males"`) would enable cleaner filtering without
relying on keyword matching.

---

### 5. TPMT / Azathioprine Genetic Screening Prompt

**Clinical problem:** Azathioprine is myelosuppressive in cats due to deficiency of thiopurine
methyltransferase (TPMT), making it effectively contraindicated in cats. In dogs, individual TPMT
activity varies and low-TPMT dogs are at risk of severe bone marrow toxicity from standard doses.
A TPMT screening prompt before initiating azathioprine (or thioguanine) would reduce avoidable
myelosuppression cases.

**Schema fields used:**
- `genetic_sensitivity.has_genetic_risk` (true for azathioprine)
- `genetic_sensitivity.gene` — value: `"TPMT (Thiopurine Methyltransferase)"`
- `genetic_sensitivity.evidence` (contains clinical guidance on cat vs. dog risk)
- `species_flags.species_contraindicated` (cats listed for azathioprine)

**Implementation complexity:** Extend the genetic sensitivity warning panel (currently focused on
MDR1) to recognize non-MDR1 genes from `genetic_sensitivity.gene`. For TPMT specifically, display
a pre-prescribing prompt suggesting TPMT activity testing before initiation, and apply a cat
species hard-stop based on `species_contraindicated`. Requires a gene-specific message template
system rather than MDR1-hardcoded strings.

**Data gaps:** TPMT is currently the only non-MDR1 genetic marker with clinical action data. The
feature is low-risk to build now and positions the system for future pharmacogenomic expansion.

---

## Tier 3 — Speculative / requires external data sources

### 1. Culture-Guided Antibiotic De-escalation Advisor

**Clinical problem:** Empirical broad-spectrum antibiotic therapy (e.g., enrofloxacin + amoxicillin-
clavulanate) is common in Korean veterinary practices while awaiting culture results. Once culture
and sensitivity (C&S) results return, clinicians should de-escalate to the narrowest effective
agent to reduce antimicrobial resistance pressure. Currently there is no system support for this
clinical decision step.

**Schema fields used:**
- `drug_identity.class` (`"Antibiotic"`)
- `section_1_2_10.indications` (spectrum information)
- `effects_and_mechanisms.common_mechanism` (bacteriostatic vs. bactericidal classification)

**Implementation complexity:** Requires integration with an external C&S result feed (lab API) or
manual C&S result entry. A bacterial susceptibility database (e.g., WHONET-compatible format or
CLSI veterinary breakpoints) would be needed to map organism + drug to susceptibility prediction.
Significant new data infrastructure is required; the NuvoVet schema alone is insufficient.

**Data gaps:** The drug schema has no antibiotic spectrum or MIC breakpoint fields. A new
`antibacterial_spectrum` section per drug would be needed, plus external pathogen-drug susceptibility
data.

---

### 2. Pain Score Integration and Analgesic Protocol Recommendation

**Clinical problem:** Veterinary patients cannot self-report pain. Standardized pain scoring tools
(Glasgow Composite Pain Scale, Colorado State University pain scale) produce numeric scores that
should drive analgesic selection and dose titration. A pain score of 8/10 warrants a different
opioid choice and dose than a score of 3/10. Currently the system has no pain score input and
cannot recommend analgesic escalation based on clinical severity.

**Schema fields used:**
- `drug_identity.class` (`"Opioid"`, `"NSAID"`, `"Analgesic"`)
- `dosage_and_kinetics.[species].dosage_list[].context` (many entries distinguish acute pain vs.
  chronic pain vs. procedural sedation contexts)
- `dosage_and_kinetics.[species].dosage_list[].value` and `max_dose_mg_kg`
- `timing_profile.half_life_hr` (for dosing interval recommendation)
- `effects_and_mechanisms.common_mechanism` (mu-opioid agonist vs. partial vs. mixed)

**Implementation complexity:** Requires building a structured pain ladder (WHO analgesic ladder
adapted for veterinary medicine) and integrating a validated pain scale as a UI input. The mapping
from pain score to recommended drug class and dose range must be authored by a veterinary pain
specialist and validated clinically. The schema supports the dose retrieval but not the protocol
logic itself.

**Data gaps:** The `dosage_and_kinetics` context strings are free text and not machine-readable pain
tier labels. A new `dosage_and_kinetics.[species].dosage_list[].pain_severity_tier` field
(`mild` / `moderate` / `severe` / `procedural`) would enable structured protocol lookup.

---

### 3. Antimicrobial Resistance (AMR) Stewardship Scoring

**Clinical problem:** South Korea's Ministry of Agriculture, Food and Rural Affairs (MAFRA) and the
Korea Animal Health Products Association are expanding veterinary AMR surveillance requirements.
Clinics that disproportionately prescribe critically important antimicrobials (CIAs — fluoroquinolones,
third-generation cephalosporins, carbapenems) without appropriate indication documentation face
increasing regulatory scrutiny. A regimen-level AMR stewardship score would provide actionable
feedback and support audit documentation.

**Schema fields used:**
- `drug_identity.class` (`"Antibiotic"`)
- `drug_identity.source` (`"kr_vet"` vs. `"foreign"` — foreign-sourced antibiotics carry higher
  resistance concern)
- `drug_identity.off_label_note` (off-label antibiotic use is a stewardship concern)
- `section_1_2_10.indications` (to assess whether indication matches the prescribing context)

**Implementation complexity:** Requires a CIA classification table (WHO CIA list adapted for
veterinary use) and a scoring algorithm that weighs drug class, spectrum, indication match, and
culture-guided vs. empirical use. This cannot be built reliably from the current schema alone;
it needs a national veterinary CIA reference dataset and ideally integration with MAFRA reporting
APIs.

**Data gaps:** The schema has no WHO CIA tier field, no indication-appropriateness scoring, and no
culture-guided use flag. All of these would need to be added. MAFRA or KAHPA data sharing
agreements would be required for regulatory integration.

---

### 4. Drug Cost and Availability Optimization

**Clinical problem:** In Korean veterinary practice, drug availability varies significantly between
clinic types (general practice vs. specialty hospital vs. emergency clinic) and by region. A
clinician may select an optimal drug based on safety data only to find it unavailable in their
formulary. Real-time formulary checking and therapeutically equivalent substitution suggestions
would reduce delays and prevent improvised substitutions that may be less safe.

**Schema fields used:**
- `drug_identity.formulary_status` (`"active"` / `"inactive"` / `"discontinued"`)
- `drug_identity.brand_names` (to match against a pharmacy inventory system)
- `drug_identity.available_strengths` (to confirm a suitable concentration is stocked)
- `drug_identity.dosage_form` (to verify the required route of administration is available)

**Implementation complexity:** The schema fields support formulary status in principle, but
`formulary_status` is currently a static field set at data ingestion time, not a live inventory
query. Integrating with a real-time Korean veterinary pharmacy inventory API (e.g., KAHPA or a
national drug registry) would be required. Substitution logic would need a therapeutic equivalence
table maintained by a pharmacist.

**Data gaps:** There is no Korean national veterinary drug inventory API currently available for
integration. The `formulary_status` field would need to become a dynamic field updated via
periodic sync with a drug registry, not a static schema value.

---

### 5. Post-Discharge Adverse Event Monitoring (Pharmacovigilance Pipeline)

**Clinical problem:** Adverse drug events in veterinary patients are significantly underreported in
Korea. When a patient on a newly prescribed drug returns with symptoms consistent with a drug
reaction (e.g., elevated creatinine after an aminoglycoside course, thrombocytopenia after
chloramphenicol), there is no structured mechanism to capture this as a potential adverse event,
attribute it to the drug, and contribute to population-level signal detection.

**Schema fields used:**
- `risk_flags.nephrotoxic`, `risk_flags.hepatotoxic`, `risk_flags.gi_ulcer` (predicted risk profile
  for comparison with observed events)
- `_data_quality.overall_confidence` (to weight case reports against lower-confidence drugs)
- `contraindications[].lab_trigger.marker` and `.threshold` (define the labs that would confirm
  an adverse event)
- `renal_dose_adjustment.creatinine_threshold_dog_mg_dL` / `creatinine_threshold_cat_mg_dL`

**Implementation complexity:** Requires building a separate pharmacovigilance data collection module
(a follow-up visit form linked to the original prescription record), a case narrative generator,
and a reporting pathway to the Korean Ministry of Food and Drug Safety (MFDS) or the manufacturer.
Signal detection (disproportionality analysis) would require aggregated multi-clinic data, which
needs a cloud data infrastructure and data sharing agreements.

**Data gaps:** The current system is session-based with no persistent patient record storage. A
patient identity and prescription history database — with appropriate personal data protections
under Korea's Personal Information Protection Act (PIPA) — is a prerequisite.
