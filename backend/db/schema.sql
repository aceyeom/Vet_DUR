-- ============================================================
-- Veterinary DUR System — Complete Database Schema v2.0
-- 32 tables across 6 layers
-- Architecture reference: docs/DUR_DATABASE_아키텍쳐_v2.md
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- LAYER 6 — data_sources (defined first; referenced by all layers)
-- ============================================================

CREATE TABLE data_sources (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type      VARCHAR NOT NULL
                     CHECK (source_type IN ('korean_db', 'pmc', 'plumbs', 'bsava', 'manual')),
    source_name      VARCHAR NOT NULL,
    pmc_id           VARCHAR,
    doi              VARCHAR,
    url              TEXT,
    reliability_tier INT CHECK (reliability_tier IN (1, 2, 3)),
    -- 1 = RCT/guideline, 2 = case series, 3 = theoretical
    accessed_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- LAYER 2 — SUBSTANCES
-- The master entity. Every DUR engine analysis traces back here.
-- ============================================================

CREATE TABLE substances (
    id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inn_name                  VARCHAR NOT NULL UNIQUE,   -- International Nonproprietary Name
    korean_name               VARCHAR,
    cas_number                VARCHAR,
    drug_class                VARCHAR,                   -- Top-level therapeutic class
    subclass                  VARCHAR,                   -- Sub-classification
    classification_code       VARCHAR,                   -- Korean DB classification code
    substance_category        VARCHAR NOT NULL DEFAULT 'pharmaceutical'
                              CHECK (substance_category IN (
                                  'pharmaceutical',      -- Full DUR; all 5 engines
                                  'vitamin_active',      -- Pharmacologically active at therapeutic doses; all 5 engines
                                  'nutraceutical',       -- Limited DUR; Engines 1 and 4 only
                                  'vitamin_inert'        -- Auto-pass; no DUR engines run
                              )),
    is_controlled             BOOLEAN DEFAULT FALSE,
    controlled_schedule       VARCHAR,
    formulary_status          VARCHAR NOT NULL DEFAULT 'active'
                              CHECK (formulary_status IN ('active', 'pending', 'out_of_scope', 'deprecated')),
    -- Data completeness per engine (0.0–1.0)
    data_completeness_e1      DECIMAL(4,3) CHECK (data_completeness_e1 BETWEEN 0.0 AND 1.0),
    data_completeness_e2      DECIMAL(4,3) CHECK (data_completeness_e2 BETWEEN 0.0 AND 1.0),
    data_completeness_e3      DECIMAL(4,3) CHECK (data_completeness_e3 BETWEEN 0.0 AND 1.0),
    data_completeness_e4      DECIMAL(4,3) CHECK (data_completeness_e4 BETWEEN 0.0 AND 1.0),
    data_completeness_e5      DECIMAL(4,3) CHECK (data_completeness_e5 BETWEEN 0.0 AND 1.0),
    overall_completeness      DECIMAL(4,3) CHECK (overall_completeness BETWEEN 0.0 AND 1.0),
    pharmacist_reviewed       BOOLEAN DEFAULT FALSE,
    last_reviewed_at          TIMESTAMP,
    review_notes              TEXT,
    created_at                TIMESTAMP DEFAULT NOW(),
    updated_at                TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_substances_inn_name_trgm    ON substances USING gin(inn_name gin_trgm_ops);
CREATE INDEX idx_substances_korean_name_trgm ON substances USING gin(korean_name gin_trgm_ops);
CREATE INDEX idx_substances_formulary_status ON substances(formulary_status);

-- Maps all name variants (brand, generic, salt forms, abbreviations) to the canonical substance
CREATE TABLE substance_synonyms (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id UUID NOT NULL REFERENCES substances(id) ON DELETE CASCADE,
    synonym      VARCHAR NOT NULL,
    language     VARCHAR NOT NULL CHECK (language IN ('ko', 'en', 'la')),
    synonym_type VARCHAR NOT NULL
                 CHECK (synonym_type IN ('brand', 'inn', 'generic', 'abbreviation', 'salt_form'))
);

CREATE INDEX idx_substance_synonyms_substance_id  ON substance_synonyms(substance_id);
CREATE INDEX idx_substance_synonyms_synonym_trgm  ON substance_synonyms USING gin(synonym gin_trgm_ops);
CREATE UNIQUE INDEX idx_substance_synonyms_unique ON substance_synonyms(substance_id, synonym);

-- ============================================================
-- LAYER 1 — PRODUCTS, VARIANTS & COMPONENTS
-- What vets prescribe. Korean DB is the primary source.
-- ============================================================

-- One row per substance + route combination.
-- Different routes (oral vs SC) = different products even for the same substance.
CREATE TABLE products (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id            UUID NOT NULL REFERENCES substances(id),
    korean_name_base        VARCHAR,               -- Name without strength e.g. "아포퀠 정"
    english_name_base       VARCHAR,
    route_of_administration VARCHAR NOT NULL
                            CHECK (route_of_administration IN (
                                'oral', 'IV', 'IM', 'SC', 'topical',
                                'ophthalmic', 'otic', 'intranasal',
                                'intramammary', 'intrauterine'
                            )),
    dosage_form             VARCHAR,               -- "정제", "산제", "주사제", "액제", "연고"
    approved_species        TEXT[],                -- e.g. {dog,cat}
    is_combination_product  BOOLEAN DEFAULT FALSE,
    substance_category      VARCHAR
                            CHECK (substance_category IN (
                                'pharmaceutical', 'vitamin_active', 'nutraceutical', 'vitamin_inert'
                            )),
    formulary_status        VARCHAR NOT NULL DEFAULT 'active'
                            CHECK (formulary_status IN ('active', 'pending', 'out_of_scope', 'deprecated')),
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW(),
    UNIQUE (substance_id, route_of_administration)
);

CREATE INDEX idx_products_substance_id ON products(substance_id);
CREATE INDEX idx_products_formulary_status ON products(formulary_status);

-- One row per Korean DB entry of the same product (different SKU / strength)
CREATE TABLE product_variants (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    korean_db_index      INT UNIQUE,              -- Index from scraped Korean DB
    korean_name_full     VARCHAR,                 -- Full name as in Korean DB including strength
    -- Canonical strength triplet: (strength_value, strength_unit, strength_per)
    strength_value       DECIMAL,
    strength_unit        VARCHAR
                         CHECK (strength_unit IN ('mg', 'ml', 'g', '%', 'IU', 'CFU', 'mcg', 'mg/ml')),
    strength_per         VARCHAR
                         CHECK (strength_per IN (
                             'per_tablet', 'per_mL', 'per_capsule',
                             'per_sachet', 'per_dose', 'per_vial', 'per_g'
                         )),
    manufacturer         VARCHAR,
    license_number       VARCHAR,
    license_date         DATE,
    license_status       VARCHAR CHECK (license_status IN ('정상', '취소', 'active', 'revoked')),
    is_prescription_only BOOLEAN DEFAULT FALSE,
    package_sizes        TEXT[],
    storage_conditions   TEXT,
    shelf_life_months    INT,
    split_shelf_life_days INT,
    -- Withdrawal periods for food animal species (days)
    withdrawal_period_meat_days INT,
    withdrawal_period_milk_days INT,
    withdrawal_period_egg_days  INT,
    source_type          VARCHAR NOT NULL DEFAULT 'korean_db'
                         CHECK (source_type IN ('korean_db', 'imported', 'human_label', 'compounded'))
);

CREATE INDEX idx_product_variants_product_id      ON product_variants(product_id);
CREATE INDEX idx_product_variants_korean_db_index ON product_variants(korean_db_index);

-- Resolves combination products to their active substances.
-- Only pharmacologically active ingredients, not excipients.
CREATE TABLE product_components (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    substance_id      UUID NOT NULL REFERENCES substances(id),
    amount_per_unit   DECIMAL,
    unit              VARCHAR CHECK (unit IN ('MG', 'GM', 'ML', 'MCG', 'IU')),
    is_primary_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_product_components_product_id   ON product_components(product_id);
CREATE INDEX idx_product_components_substance_id ON product_components(substance_id);

-- Maps Korean DB entries with multiple listed routes to individual products rows.
-- 45.7% of products specify 2+ routes; each route becomes its own products row.
CREATE TABLE product_multi_routes (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    korean_db_index      INT NOT NULL,             -- Source Korean DB entry
    korean_name          VARCHAR,
    product_id           UUID NOT NULL REFERENCES products(id),
    route                VARCHAR NOT NULL,
    is_primary_route     BOOLEAN DEFAULT FALSE,    -- Mark the clinically primary route
    source_documentation TEXT                      -- Route as documented in raw_content
);

CREATE INDEX idx_product_multi_routes_korean_db_index ON product_multi_routes(korean_db_index);
CREATE INDEX idx_product_multi_routes_product_id      ON product_multi_routes(product_id);

-- ============================================================
-- LAYER 3 — DUR ENGINE DATA
-- Pharmacological knowledge powering the five analysis engines.
-- All tables link to substances via substance_id.
-- ============================================================

-- ---- Engine 1: CYP Metabolism ----
-- One row per CYP isoform per role per substance. Route-independent.
-- Canine-specific isoforms: CYP2B11 (≈ human CYP2B6), CYP2D15 (≈ human CYP2D6).
CREATE TABLE cyp_profiles (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id           UUID NOT NULL REFERENCES substances(id),
    cyp_isoenzyme          VARCHAR NOT NULL
                           CHECK (cyp_isoenzyme IN (
                               'CYP3A4', 'CYP2D6', 'CYP1A2', 'CYP2C9', 'CYP2C19',
                               'CYP2B11',  -- Canine equivalent of human CYP2B6
                               'CYP2D15',  -- Canine equivalent of human CYP2D6
                               'CYP2E1', 'CYP1A1'
                           )),
    role                   VARCHAR NOT NULL CHECK (role IN ('substrate', 'inhibitor', 'inducer')),
    inhibition_strength    VARCHAR CHECK (inhibition_strength IN ('weak', 'moderate', 'strong')),
    induction_onset_days   INT,                    -- Days until induction effect established
    induction_washout_days INT,                    -- Days until induction clears after stopping
    clinical_relevance     VARCHAR CHECK (clinical_relevance IN ('high', 'moderate', 'low')),
    species                TEXT[],                 -- NULL = applies to all approved species
    source_quote           TEXT,                   -- Exact quote from source paper
    extraction_confidence  VARCHAR CHECK (extraction_confidence IN ('high', 'medium', 'low')),
    data_source_id         UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_cyp_profiles_substance_id   ON cyp_profiles(substance_id);
CREATE INDEX idx_cyp_profiles_isoenzyme_role ON cyp_profiles(cyp_isoenzyme, role);

-- ---- Engine 1: Pharmacokinetic Parameters ----
-- One row per substance per species per route.
-- route = 'all' for route-independent parameters (half-life, protein binding).
-- Specific route for route-specific parameters (bioavailability, time-to-peak).
CREATE TABLE pk_parameters (
    id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id                    UUID NOT NULL REFERENCES substances(id),
    species                         VARCHAR NOT NULL
                                    CHECK (species IN ('dog', 'cat', 'horse', 'cattle', 'pig', 'rabbit')),
    route                           VARCHAR NOT NULL,   -- 'all' or specific route
    half_life_hr                    DECIMAL,
    bioavailability_pct             DECIMAL CHECK (bioavailability_pct BETWEEN 0.0 AND 1.0),
    time_to_peak_hr                 DECIMAL,
    protein_binding_pct             DECIMAL CHECK (protein_binding_pct BETWEEN 0.0 AND 1.0),
    primary_protein                 VARCHAR CHECK (primary_protein IN ('albumin', 'alpha1-AGP', 'mixed', 'unknown')),
    binding_site                    VARCHAR
                                    CHECK (binding_site IN (
                                        'albumin_site_I', 'albumin_site_II',
                                        'alpha1-AGP_site', 'mixed', 'unknown'
                                    )),
    renal_elimination_pct           DECIMAL CHECK (renal_elimination_pct BETWEEN 0.0 AND 1.0),
    hepatic_elimination_pct         DECIMAL CHECK (hepatic_elimination_pct BETWEEN 0.0 AND 1.0),
    primary_elimination             VARCHAR CHECK (primary_elimination IN ('renal', 'hepatic', 'biliary', 'mixed')),
    volume_of_distribution_l_per_kg DECIMAL,
    pk_confidence                   VARCHAR CHECK (pk_confidence IN ('high', 'medium', 'low')),
    pk_source_conflict              BOOLEAN DEFAULT FALSE,  -- Multiple sources gave conflicting values
    data_source_id                  UUID REFERENCES data_sources(id),
    UNIQUE (substance_id, species, route)
);

CREATE INDEX idx_pk_parameters_substance_id ON pk_parameters(substance_id);

-- ---- Engine 1: Pharmacodynamic Risk Flags ----
-- One row per substance. Route-independent.
CREATE TABLE pd_risk_flags (
    id                               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id                     UUID NOT NULL UNIQUE REFERENCES substances(id),
    narrow_therapeutic_index         BOOLEAN DEFAULT FALSE,
    -- Toxicity risk profile
    nephrotoxicity                   VARCHAR DEFAULT 'none' CHECK (nephrotoxicity    IN ('none', 'low', 'moderate', 'high')),
    hepatotoxicity                   VARCHAR DEFAULT 'none' CHECK (hepatotoxicity    IN ('none', 'low', 'moderate', 'high')),
    qt_prolongation                  VARCHAR DEFAULT 'none' CHECK (qt_prolongation   IN ('none', 'low', 'moderate', 'high')),
    myelosuppression                 VARCHAR DEFAULT 'none' CHECK (myelosuppression  IN ('none', 'low', 'moderate', 'high')),
    cns_depression                   VARCHAR DEFAULT 'none' CHECK (cns_depression    IN ('none', 'low', 'moderate', 'high')),
    respiratory_depression           VARCHAR DEFAULT 'none' CHECK (respiratory_depression IN ('none', 'low', 'moderate', 'high')),
    hypotension                      VARCHAR DEFAULT 'none' CHECK (hypotension       IN ('none', 'low', 'moderate', 'high')),
    seizure_threshold_effect         VARCHAR DEFAULT 'none' CHECK (seizure_threshold_effect IN ('lower', 'raise', 'none')),
    gi_ulcer_risk                    VARCHAR DEFAULT 'none' CHECK (gi_ulcer_risk     IN ('none', 'low', 'moderate', 'high')),
    bleeding_risk                    VARCHAR DEFAULT 'none' CHECK (bleeding_risk     IN ('none', 'low', 'moderate', 'high')),
    serotonin_syndrome_risk          BOOLEAN DEFAULT FALSE,  -- tramadol, trazodone, MAOIs, SSRIs, mirtazapine
    mdr1_mutation_risk               BOOLEAN DEFAULT FALSE,  -- Safety altered in MDR1/ABCB1-deficient patients
    -- Electrolyte effects (for electrolyte-mediated DDI rule)
    electrolyte_k                    VARCHAR DEFAULT 'none' CHECK (electrolyte_k IN ('deplete', 'elevate', 'none')),
    electrolyte_mg                   VARCHAR DEFAULT 'none' CHECK (electrolyte_mg IN ('deplete', 'elevate', 'none')),
    electrolyte_na                   VARCHAR DEFAULT 'none' CHECK (electrolyte_na IN ('deplete', 'elevate', 'none')),
    electrolyte_ca                   VARCHAR DEFAULT 'none' CHECK (electrolyte_ca IN ('deplete', 'elevate', 'none')),
    absorption_affected_by_ph        BOOLEAN DEFAULT FALSE,  -- Antacids/PPIs significantly alter absorption
    chelation_risk                   BOOLEAN DEFAULT FALSE,  -- Binds divalent metals (e.g. fluoroquinolones + calcium)
    -- Species-specific adverse effects (narrative from Plumb's)
    adverse_effects_dog              TEXT,
    adverse_effects_cat              TEXT,
    -- Veterinary reproductive safety (Papich 1989 classification — NOT FDA human categories)
    -- A=safe, B=safe if cautious, C=risk vs benefit, D=documented fetal risk
    reproductive_safety_class_papich VARCHAR CHECK (reproductive_safety_class_papich IN ('A', 'B', 'C', 'D')),
    reproductive_safety_note         TEXT,
    -- Overdose data from Plumb's Overdosage section
    overdose_ld50_mg_per_kg          DECIMAL,
    overdose_ld50_species            VARCHAR,
    overdose_ld50_route              VARCHAR CHECK (overdose_ld50_route IN ('IV', 'oral', 'SC', 'IM')),
    overdose_toxic_dose_mg_per_kg    DECIMAL,   -- Lowest observed toxic dose in target species
    overdose_signs                   TEXT,      -- Clinical signs of overdose
    overdose_treatment               TEXT,      -- Treatment summary
    pd_confidence                    VARCHAR CHECK (pd_confidence IN ('high', 'medium', 'low')),
    data_source_id                   UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_pd_risk_flags_substance_id ON pd_risk_flags(substance_id);

-- ---- Engine 1: P-glycoprotein / Transporter Profiles ----
-- One row per substance. Route-independent.
CREATE TABLE transporter_profiles (
    id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id                  UUID NOT NULL UNIQUE REFERENCES substances(id),
    pgp_substrate_affinity        VARCHAR CHECK (pgp_substrate_affinity IN ('high', 'moderate', 'low', 'none')),
    pgp_inhibitor_strength        VARCHAR CHECK (pgp_inhibitor_strength IN ('strong', 'moderate', 'weak', 'none')),
    cns_penetration_pgp_dependent BOOLEAN DEFAULT FALSE,  -- P-gp is primary CNS barrier for this drug
    other_transporters            TEXT[],                 -- e.g. {OATP1B1, OATP1B3}
    data_source_id                UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_transporter_profiles_substance_id ON transporter_profiles(substance_id);

-- ---- Engine 1: Explicit Drug-Drug Interaction Pairs ----
-- One row per explicitly documented pairwise DDI.
-- Always store substance_a alphabetically before substance_b.
-- CYP-based transitive inferences are NOT pre-stored here — computed at scan time
-- and logged to ddi_inference_log to avoid combinatorial explosion.
CREATE TABLE ddi_pairs (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_a_id           UUID NOT NULL REFERENCES substances(id),   -- Alphabetically first
    substance_b_id           UUID NOT NULL REFERENCES substances(id),   -- Alphabetically second
    is_checked               BOOLEAN DEFAULT FALSE,
    no_interaction_confirmed BOOLEAN DEFAULT FALSE,
    interaction_type         VARCHAR
                             CHECK (interaction_type IN (
                                 'cyp_metabolic', 'transporter_pgp', 'protein_binding',
                                 'pharmacodynamic_additive', 'pharmacodynamic_antagonism',
                                 'electrolyte_mediated'
                             )),
    mechanism_detail         TEXT,
    severity                 VARCHAR CHECK (severity IN ('contraindicated', 'major', 'moderate', 'minor')),
    -- Score scale: contraindicated=100, major=75, moderate=40, minor=15
    severity_score           INT CHECK (severity_score BETWEEN 0 AND 100),
    clinical_effect          TEXT,
    management               TEXT,
    species                  TEXT[],         -- NULL = all species
    breed_specific           TEXT[],
    evidence_level           VARCHAR CHECK (evidence_level IN ('A', 'B', 'C', 'D')),
    -- inferred=TRUE: pair generated by RAG pipeline (requires pharmacist review + confidence >= 0.70)
    -- inferred=FALSE: empirical source (PMC, Plumb's, Korean DB 상호작용)
    inferred                 BOOLEAN DEFAULT FALSE,
    inferred_confidence      DECIMAL(4,3) CHECK (inferred_confidence BETWEEN 0.0 AND 1.0),
    reviewed_by_pharmacist   BOOLEAN DEFAULT FALSE,
    checked_by               VARCHAR,
    checked_at               TIMESTAMP,
    source_refs              TEXT[],
    rag_chunk_ids            UUID[],
    UNIQUE (substance_a_id, substance_b_id)
);

CREATE INDEX idx_ddi_pairs_substance_a ON ddi_pairs(substance_a_id);
CREATE INDEX idx_ddi_pairs_substance_b ON ddi_pairs(substance_b_id);
CREATE INDEX idx_ddi_pairs_pair        ON ddi_pairs(substance_a_id, substance_b_id);

-- ---- Engine 2: Dosing Rules ----
-- One row per substance per species per route.
-- Always filter on ALL THREE: substance + species + route.
-- Supports 6 dosing formats to handle Korean veterinary data variability.
CREATE TABLE dosing_rules (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id             UUID NOT NULL REFERENCES substances(id),
    species                  VARCHAR NOT NULL
                             CHECK (species IN ('dog', 'cat', 'horse', 'cattle', 'pig', 'rabbit')),
    indication               VARCHAR,
    route                    VARCHAR NOT NULL
                             CHECK (route IN (
                                 'oral', 'IV', 'IM', 'SC', 'topical',
                                 'ophthalmic', 'otic', 'intranasal',
                                 'intramammary', 'intrauterine'
                             )),
    route_approved           BOOLEAN DEFAULT TRUE,    -- FALSE = alert "route not approved"
    -- Dosing format (6 types to cover Korean veterinary data)
    dosing_type              VARCHAR NOT NULL DEFAULT 'mg_per_kg'
                             CHECK (dosing_type IN (
                                 'mg_per_kg',       -- Standard weight-based dosing
                                 'ml_per_kg',       -- Liquid formulation volume-based
                                 'ml_per_animal',   -- Fixed volume injection (no weight calc)
                                 'tablet_per_day',  -- Tablet count → infer mg from variant strength
                                 'iU_based',        -- Vaccines and biologics
                                 'feed_based'       -- Feed additives; excluded from DUR checks
                             )),
    dose_unit                VARCHAR,                -- Unit matching dosing_type
    min_dose                 DECIMAL,
    max_dose                 DECIMAL,
    loading_dose             DECIMAL,
    loading_duration_days    INT,
    maintenance_interval_hr  INT,
    loading_interval_hr      INT,
    is_feed_additive         BOOLEAN DEFAULT FALSE,  -- TRUE = skip dosing check
    per_ton_feed_kg          DECIMAL,               -- Only if is_feed_additive = TRUE
    requires_dilution        BOOLEAN DEFAULT FALSE,
    dilution_instructions    TEXT,
    narrow_therapeutic_index BOOLEAN DEFAULT FALSE,
    pediatric_min_age_months INT,
    pediatric_min_weight_kg  DECIMAL,
    -- Geriatric: both threshold and adjustment must be set for Engine 2 to apply
    geriatric_min_age_months INT,                   -- Trigger age (e.g. dog >= 84, cat >= 120 months)
    geriatric_adjustment_pct DECIMAL,               -- Dose multiplier (e.g. 0.75 = 25% reduction)
    administration_timing    VARCHAR
                             CHECK (administration_timing IN (
                                 'with_meal', 'before_meal', 'after_meal', 'regardless_of_food'
                             )),
    food_interaction_note    TEXT,
    monitoring_required      TEXT[],                -- Clinical/lab parameters to monitor
    -- Evidence grade (A=RCT, B=case series, C=case report, D=theoretical)
    -- Applies score modifier: A=±0, B=−5, C=−15, D=−25 (floor 5)
    evidence_level           VARCHAR DEFAULT 'B' CHECK (evidence_level IN ('A', 'B', 'C', 'D')),
    data_source_id           UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_dosing_rules_substance_id   ON dosing_rules(substance_id);
CREATE INDEX idx_dosing_rules_species_route  ON dosing_rules(substance_id, species, route);

-- ---- Engine 2: Renal Dose Adjustments ----
-- Species-specific creatinine thresholds aligned with IRIS CKD staging:
--   Dog: Stage 2 = 1.4–2.0 mg/dL, Stage 3 = 2.1–5.0, Stage 4 = >5.0
--   Cat: Stage 2 = 1.6–2.8 mg/dL, Stage 3 = 2.9–5.0, Stage 4 = >5.0
CREATE TABLE renal_dose_adjustments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id            UUID NOT NULL REFERENCES substances(id),
    species                 VARCHAR NOT NULL CHECK (species IN ('dog', 'cat')),
    creatinine_mild_max     DECIMAL,   -- Upper mg/dL threshold for mild impairment
    mild_factor             DECIMAL,   -- Dose multiplier (0.75 = 25% reduction)
    creatinine_moderate_max DECIMAL,   -- Upper threshold for moderate impairment
    moderate_factor         DECIMAL,
    severe_contraindicated  BOOLEAN DEFAULT FALSE,
    severe_factor           DECIMAL,   -- NULL when severe_contraindicated = TRUE
    renal_elimination_pct   DECIMAL CHECK (renal_elimination_pct BETWEEN 0.0 AND 1.0),
    data_source_id          UUID REFERENCES data_sources(id),
    UNIQUE (substance_id, species)
);

CREATE INDEX idx_renal_dose_adjustments_substance_id ON renal_dose_adjustments(substance_id);

-- ---- Engine 3: Allergy Class Membership ----
-- One row per substance-class membership. A substance can belong to multiple classes.
-- Cross-reactivity rules live in class_cross_reactivity, not here.
CREATE TABLE allergy_class_members (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id   UUID NOT NULL REFERENCES substances(id),
    allergy_class  VARCHAR NOT NULL
                   CHECK (allergy_class IN (
                       'beta-lactam', 'macrolide', 'sulfonamide', 'fluoroquinolone',
                       'aminoglycoside', 'lincosamide', 'tetracycline', 'opioid', 'nsaid',
                       'corticosteroid', 'antifungal_azole', 'antiparasitic_avermectin'
                   )),
    data_source_id UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_allergy_class_members_substance_id ON allergy_class_members(substance_id);
CREATE INDEX idx_allergy_class_members_class        ON allergy_class_members(allergy_class);

-- ---- Engine 3: Class Cross-Reactivity Rules ----
-- One row per class pair with a known cross-reactivity relationship.
-- Directional: class_a is what the patient is allergic to; class_b is the prescribed drug class.
-- Store both directions if symmetric (two rows).
CREATE TABLE class_cross_reactivity (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_a                VARCHAR NOT NULL,   -- Patient is allergic to this class
    class_b                VARCHAR NOT NULL,   -- Prescribed drug belongs to this class
    mechanism              VARCHAR
                           CHECK (mechanism IN (
                               'shared_macrocyclic_ring_structure', 'shared_beta_lactam_ring',
                               'common_sulfonamide_moiety', 'cross_sensitization', 'unknown'
                           )),
    estimated_rate_pct     DECIMAL CHECK (estimated_rate_pct BETWEEN 0.0 AND 100.0),
    strength               VARCHAR CHECK (strength IN ('high', 'moderate', 'low', 'theoretical')),
    species_data_available BOOLEAN DEFAULT FALSE,   -- TRUE = rate from veterinary data (not human)
    alert_on_cross_react   BOOLEAN DEFAULT TRUE,    -- FALSE = informational note only
    note                   TEXT,
    data_source_id         UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_class_cross_reactivity_class_a ON class_cross_reactivity(class_a);
CREATE INDEX idx_class_cross_reactivity_class_b ON class_cross_reactivity(class_b);

-- ---- Engine 4: Contraindications ----
-- One row per substance-condition pair. Route-independent.
-- Two axes: contraindication_type (severity) and clinical_category (what triggers the check).
-- Reproductive categories bypass free-text matching — checked against structured patient fields.
CREATE TABLE contraindications (
    id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id              UUID NOT NULL REFERENCES substances(id),
    condition_name            VARCHAR NOT NULL,   -- Normalised condition string
    condition_tags            TEXT[],             -- Searchable tags in KO and EN
    -- clinical_category routes the check:
    --   'disease'                  → conditions[] text-matching via condition_synonyms
    --   'reproductive_pregnancy'   → patients.is_pregnant = TRUE
    --   'reproductive_lactation'   → patients.is_lactating = TRUE
    --   'reproductive_intact_female' → patients.reproductive_status IN (...)
    --   'reproductive_intact_male'   → patients.reproductive_status = 'intact_male'
    --   'age_pediatric'            → patients.age_months < min_age_months
    clinical_category         VARCHAR NOT NULL DEFAULT 'disease'
                              CHECK (clinical_category IN (
                                  'disease',
                                  'reproductive_pregnancy',
                                  'reproductive_lactation',
                                  'reproductive_intact_female',
                                  'reproductive_intact_male',
                                  'age_pediatric'
                              )),
    contraindication_type     VARCHAR NOT NULL
                              CHECK (contraindication_type IN ('absolute', 'relative', 'caution')),
    severity                  VARCHAR CHECK (severity IN ('critical', 'major', 'moderate', 'minor')),
    mechanism                 TEXT,
    species                   TEXT[],             -- NULL = all species
    breed_specific            TEXT[],
    min_age_months            INT,
    min_weight_kg             DECIMAL,
    alternative_substance_ids UUID[],             -- Safer alternatives
    rag_chunk_ids             UUID[],
    data_source_id            UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_contraindications_substance_id      ON contraindications(substance_id);
CREATE INDEX idx_contraindications_condition_tags    ON contraindications USING gin(condition_tags);
CREATE INDEX idx_contraindications_clinical_category ON contraindications(clinical_category);

-- ---- Engine 4: Breed Pharmacogenomics ----
-- Genetic mutation breed sensitivity. Distinct from breed_dosing_modifiers.
-- MDR1/ABCB1 delta: 70% prevalence in Collies/herding breeds; ivermectin → CNS toxicity.
CREATE TABLE breed_pharmacogenomics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id    UUID NOT NULL REFERENCES substances(id),
    applies_to_drug BOOLEAN DEFAULT TRUE,
    mutation        VARCHAR NOT NULL,           -- e.g. 'MDR1/ABCB1 delta', 'CYP2D15'
    affected_breeds TEXT[],
    prevalence_pct  DECIMAL,
    effect          TEXT,
    -- Which engines apply this multiplier (typically {1,2,4})
    affected_engines INT[],
    risk_multiplier DECIMAL DEFAULT 1.0,
    data_source_id  UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_breed_pharmacogenomics_substance_id ON breed_pharmacogenomics(substance_id);
CREATE INDEX idx_breed_pharmacogenomics_mutation     ON breed_pharmacogenomics(mutation);

-- ---- Engines 2 & 4: Breed Dosing Modifiers ----
-- Non-mutation breed PK/PD variability (phenotypic/physiologic differences).
-- e.g. sighthound sensitivity to acepromazine (low body fat → high lipophilic drug distribution).
-- Distinct from breed_pharmacogenomics which covers genetic mutations.
CREATE TABLE breed_dosing_modifiers (
    id                             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id                   UUID NOT NULL REFERENCES substances(id),
    species                        VARCHAR NOT NULL CHECK (species IN ('dog', 'cat')),
    affected_breeds                TEXT[],
    breed_group                    VARCHAR
                                   CHECK (breed_group IN (
                                       'sighthound', 'giant_breed', 'terrier',
                                       'herding', 'brachycephalic', 'other'
                                   )),
    sensitivity_direction          VARCHAR NOT NULL
                                   CHECK (sensitivity_direction IN (
                                       'increased_sensitivity', 'decreased_sensitivity'
                                   )),
    effect                         TEXT,
    mechanism                      TEXT,
    dose_adjustment_recommendation TEXT,
    affects_engine                 INT[],
    evidence_level                 VARCHAR CHECK (evidence_level IN ('A', 'B', 'C', 'D')),
    data_source_id                 UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_breed_dosing_modifiers_substance_id ON breed_dosing_modifiers(substance_id);

-- ---- Lab Test Interference Advisories ----
-- Drugs that cause false/misleading lab readings (not DDIs).
-- Surfaced as info-level advisories alongside Engine 2 outputs.
-- e.g. cephalosporins interfering with Jaffé colorimetric creatinine assay.
CREATE TABLE lab_test_interactions (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id          UUID NOT NULL REFERENCES substances(id),
    lab_test              VARCHAR NOT NULL
                          CHECK (lab_test IN (
                              'serum_creatinine', 'ALT', 'AST', 'glucose', 'BUN',
                              'bilirubin', 'urinary_glucose', 'urinary_protein',
                              'CBC_neutrophils', 'total_protein', 'cholesterol', 'SDMA'
                          )),
    effect_direction      VARCHAR NOT NULL
                          CHECK (effect_direction IN ('falsely_elevate', 'falsely_decrease', 'method_interference')),
    mechanism             TEXT,
    clinical_significance VARCHAR CHECK (clinical_significance IN ('high', 'moderate', 'low')),
    species               TEXT[],                     -- NULL = all species
    data_source_id        UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_lab_test_interactions_substance_id ON lab_test_interactions(substance_id);
CREATE INDEX idx_lab_test_interactions_lab_test     ON lab_test_interactions(lab_test);

-- ---- Engine 4: Condition Synonyms ----
-- Normalises free-text patient history to canonical condition names.
-- Supports Korean and English synonyms; used for Engine 4 disease contraindication lookup.
CREATE TABLE condition_synonyms (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_name VARCHAR NOT NULL,   -- Matches condition_name in contraindications
    synonym        VARCHAR NOT NULL,
    language       VARCHAR NOT NULL CHECK (language IN ('ko', 'en')),
    match_type     VARCHAR NOT NULL CHECK (match_type IN ('exact', 'contains', 'regex'))
);

CREATE INDEX idx_condition_synonyms_canonical      ON condition_synonyms(canonical_name);
CREATE INDEX idx_condition_synonyms_synonym_trgm   ON condition_synonyms USING gin(synonym gin_trgm_ops);

-- ---- Engine 5: Therapeutic Classes ----
-- One row per substance. Used to detect therapeutic duplicates.
CREATE TABLE therapeutic_classes (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id           UUID NOT NULL UNIQUE REFERENCES substances(id),
    primary_class          VARCHAR NOT NULL,          -- e.g. 'NSAID', 'Immunosuppressant'
    subclass               VARCHAR,                   -- e.g. 'JAK inhibitor'
    active_ingredient_inn  VARCHAR,                   -- INN — catches brand/generic duplicates
    duplication_exceptions JSONB DEFAULT '[]',        -- Intentional same-class combinations
    data_source_id         UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_therapeutic_classes_substance_id  ON therapeutic_classes(substance_id);
CREATE INDEX idx_therapeutic_classes_primary_class ON therapeutic_classes(primary_class);

-- ============================================================
-- LAYER 4 — RAG VECTOR STORE
-- pgvector similarity search over scientific literature chunks.
-- ============================================================

-- Each row is one ~500-token chunk from a scientific paper.
-- embedding dimension: 1536 (OpenAI text-embedding-3-small)
CREATE TABLE literature_chunks (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id       UUID REFERENCES substances(id),  -- NULL for multi-drug papers
    pmc_id             VARCHAR,                         -- PubMed Central article ID
    chunk_index        INT,                             -- Position within article
    chunk_text         TEXT,
    embedding          vector(1536),
    field_group        VARCHAR
                       CHECK (field_group IN ('cyp', 'pk', 'pd', 'dosing', 'contraindication', 'ddi')),
    used_in_extraction BOOLEAN DEFAULT FALSE,
    data_source_id     UUID REFERENCES data_sources(id)
);

CREATE INDEX idx_literature_chunks_substance_id ON literature_chunks(substance_id);
CREATE INDEX idx_literature_chunks_pmc_id       ON literature_chunks(pmc_id);
-- IVFFlat index for ANN cosine similarity search
CREATE INDEX idx_literature_chunks_embedding
    ON literature_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ============================================================
-- LAYER 5 — PATIENTS & PRESCRIPTIONS
-- Runtime data from the pharmacy system.
-- ============================================================

CREATE TABLE patients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR NOT NULL,
    species             VARCHAR NOT NULL
                        CHECK (species IN ('dog', 'cat', 'horse', 'cattle', 'pig', 'rabbit')),
    breed               VARCHAR,                        -- Checked against breed_pharmacogenomics
    weight_kg           DECIMAL CHECK (weight_kg > 0),
    age_months          INT CHECK (age_months >= 0),
    conditions          TEXT[],                         -- Free-text; normalised via condition_synonyms at scan time
    allergies           TEXT[],                         -- Drug/class names; matched via allergy_class_members
    -- Lab values with timestamps (timestamp required for clinical validity)
    lab_creatinine      DECIMAL,                        -- mg/dL; drives renal_dose_adjustments
    lab_creatinine_at   TIMESTAMP,                      -- When the sample was taken
    lab_alt             DECIMAL,                        -- U/L; drives hepatic risk escalation
    lab_alt_at          TIMESTAMP,
    lab_bun             DECIMAL,                        -- mg/dL; supplementary renal marker
    lab_bun_at          TIMESTAMP,
    lab_sdma            DECIMAL,                        -- μg/dL; early renal marker (more sensitive than creatinine in cats)
    lab_sdma_at         TIMESTAMP,
    -- Reproductive status (structured — bypasses free-text for safety-critical reproductive checks)
    reproductive_status VARCHAR DEFAULT 'unknown'
                        CHECK (reproductive_status IN (
                            'intact_female', 'intact_male', 'spayed',
                            'neutered', 'pregnant', 'lactating', 'unknown'
                        )),
    is_pregnant         BOOLEAN DEFAULT FALSE,          -- Explicit flag; checked directly by Engine 4
    is_lactating        BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE prescriptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id),
    prescribing_vet VARCHAR,
    clinic          VARCHAR,
    status          VARCHAR NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'dur_pending', 'approved', 'dispensed')),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);

-- One row per drug line item on a prescription.
-- match_type tracks how the item was resolved during drug resolution pipeline.
CREATE TABLE prescription_items (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id        UUID NOT NULL REFERENCES prescriptions(id),
    product_id             UUID REFERENCES products(id),          -- NULL for off-label/substance-only
    variant_id             UUID REFERENCES product_variants(id),  -- NULL for off-label/substance-only
    substance_id           UUID REFERENCES substances(id),        -- Direct substance ref when no product match
    resolved_substance_ids UUID[],      -- Populated at scan time; covers combination products
    dose_mg_per_kg         DECIMAL,
    dose_raw_input         VARCHAR,     -- Dose as entered by vet — audit field
    frequency_hr           INT,
    duration_days          INT,
    route                  VARCHAR
                           CHECK (route IN (
                               'oral', 'IV', 'IM', 'SC', 'topical',
                               'ophthalmic', 'otic', 'intranasal',
                               'intramammary', 'intrauterine'
                           )),
    -- Resolution outcome from the drug resolution pipeline (Section 18)
    match_type             VARCHAR CHECK (match_type IN ('product_match', 'substance_match', 'unmatched')),
    match_confidence       VARCHAR CHECK (match_confidence IN ('exact', 'fuzzy', 'manual'))
);

CREATE INDEX idx_prescription_items_prescription_id ON prescription_items(prescription_id);
CREATE INDEX idx_prescription_items_substance_id    ON prescription_items(substance_id);
CREATE INDEX idx_prescription_items_product_id      ON prescription_items(product_id);

-- ============================================================
-- LAYER 6 — AUDIT & QUALITY
-- ============================================================

CREATE TABLE extraction_log (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id            UUID NOT NULL REFERENCES substances(id),
    field_group             VARCHAR,
    queries_run             TEXT[],
    pmc_ids_retrieved       TEXT[],
    chunks_processed        INT DEFAULT 0,
    fields_extracted        INT DEFAULT 0,
    confidence_high_count   INT DEFAULT 0,
    confidence_medium_count INT DEFAULT 0,
    confidence_low_count    INT DEFAULT 0,
    ran_at                  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_extraction_log_substance_id ON extraction_log(substance_id);

-- Every low/medium confidence RAG extraction queued for pharmacist review.
CREATE TABLE review_queue (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    substance_id          UUID NOT NULL REFERENCES substances(id),
    table_name            VARCHAR NOT NULL,
    field_name            VARCHAR NOT NULL,
    extracted_value       TEXT,
    extraction_confidence VARCHAR NOT NULL CHECK (extraction_confidence IN ('low', 'medium')),
    source_quote          TEXT,
    status                VARCHAR NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected', 'edited')),
    reviewed_by           VARCHAR,
    reviewed_at           TIMESTAMP,
    reviewer_notes        TEXT,
    created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_queue_substance_id ON review_queue(substance_id);
CREATE INDEX idx_review_queue_status       ON review_queue(status);

-- Every DUR scan stored permanently for audit and future model improvement.
-- alerts JSONB = full alert array for replay; dur_alert_events = structured analytics.
CREATE TABLE dur_scan_results (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id   UUID NOT NULL REFERENCES prescriptions(id),
    alerts            JSONB NOT NULL DEFAULT '[]',
    final_score       INT CHECK (final_score BETWEEN 0 AND 100),
    -- Per-engine scores: {"e1": 45, "e2": 0, "e3": 100, "e4": 20, "e5": 0}
    engine_scores     JSONB,
    -- Hard override: if any alert = 'contraindicated' → final_score = 100 regardless
    pharmacist_action VARCHAR CHECK (pharmacist_action IN ('approved', 'modified', 'rejected')),
    action_notes      TEXT,
    scanned_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dur_scan_results_prescription_id ON dur_scan_results(prescription_id);

-- One row per individual alert per scan. Enables aggregate analytics without JSONB parsing.
-- Written atomically with dur_scan_results.
--
-- Composite score weights:
--   E1 (DDI)       35%  |  E2 (Dosage)     25%  |  E3 (Allergy)  20%
--   E4 (Disease)   15%  |  E5 (Duplicate)   5%
-- Severity → score: contraindicated=100, major=75, moderate=40, minor=15, info=5
CREATE TABLE dur_alert_events (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id                UUID NOT NULL REFERENCES dur_scan_results(id),
    engine                 INT NOT NULL CHECK (engine BETWEEN 1 AND 5),
    alert_type             VARCHAR NOT NULL
                           CHECK (alert_type IN (
                               'ddi_explicit',
                               'ddi_inferred',
                               'dose_over',
                               'dose_under',
                               'dose_route_not_approved',
                               'allergy_direct',
                               'allergy_cross_react',
                               'contraindication',
                               'breed_risk',
                               'therapeutic_duplicate',
                               'renal_risk',
                               'hepatic_risk',
                               'electrolyte_mediated_ddi',
                               'nephrotoxicity_renal_patient',
                               'lab_interference'
                           )),
    substance_a_id         UUID REFERENCES substances(id),
    substance_b_id         UUID REFERENCES substances(id),   -- NULL for single-substance alerts
    severity               VARCHAR NOT NULL
                           CHECK (severity IN ('contraindicated', 'major', 'moderate', 'minor', 'info')),
    severity_score         INT CHECK (severity_score BETWEEN 0 AND 100),
    source_row_id          UUID,      -- FK to the specific row that fired this alert
    source_table           VARCHAR,   -- Which table source_row_id points to
    pharmacist_disposition VARCHAR DEFAULT 'pending'
                           CHECK (pharmacist_disposition IN ('accepted', 'overridden', 'modified', 'pending')),
    override_reason        TEXT,
    created_at             TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dur_alert_events_scan_id      ON dur_alert_events(scan_id);
CREATE INDEX idx_dur_alert_events_alert_type   ON dur_alert_events(alert_type);
CREATE INDEX idx_dur_alert_events_substance_a  ON dur_alert_events(substance_a_id);
CREATE INDEX idx_dur_alert_events_severity     ON dur_alert_events(severity);

-- ---- Engine 1: DDI Inference Log ----
-- Per-scan audit log of CYP-based transitive inferences computed at runtime.
-- These are NOT pre-stored in ddi_pairs — computed on demand to avoid combinatorial explosion.
-- Inference severity derivation:
--   strong inhibitor + substrate  → major   (score 65)
--   moderate inhibitor + substrate → moderate (score 35)
--   weak inhibitor + substrate    → minor   (score 15)
--   inducer (any strength)        → moderate (score 30)
CREATE TABLE ddi_inference_log (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id                     UUID NOT NULL REFERENCES dur_scan_results(id),
    substance_a_id              UUID NOT NULL REFERENCES substances(id),
    substance_b_id              UUID NOT NULL REFERENCES substances(id),
    inference_type              VARCHAR NOT NULL
                                CHECK (inference_type IN (
                                    'cyp_substrate_inhibitor',
                                    'cyp_substrate_inducer',
                                    'protein_binding_displacement',
                                    'pd_additive',
                                    'transporter_pgp',
                                    'electrolyte_mediated'
                                )),
    shared_cyp_isoform          VARCHAR,   -- CYP isoform that triggered; NULL for non-CYP types
    substance_a_role            VARCHAR CHECK (substance_a_role IN ('substrate', 'inhibitor', 'inducer')),
    substance_b_role            VARCHAR CHECK (substance_b_role IN ('substrate', 'inhibitor', 'inducer')),
    inhibition_strength         VARCHAR CHECK (inhibition_strength IN ('weak', 'moderate', 'strong')),
    inferred_severity           VARCHAR
                                CHECK (inferred_severity IN ('contraindicated', 'major', 'moderate', 'minor', 'info')),
    inferred_severity_score     INT CHECK (inferred_severity_score BETWEEN 0 AND 100),
    overridden_by_explicit_pair BOOLEAN DEFAULT FALSE,   -- TRUE if ddi_pairs row was used instead
    explicit_pair_id            UUID REFERENCES ddi_pairs(id),
    alert_suppressed            BOOLEAN DEFAULT FALSE,   -- TRUE if below alert threshold
    created_at                  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ddi_inference_log_scan_id    ON ddi_inference_log(scan_id);
CREATE INDEX idx_ddi_inference_log_substances ON ddi_inference_log(substance_a_id, substance_b_id);

-- Every prescription item that failed drug resolution.
-- Permanent audit record — not purged after resolution.
-- Resolution outcomes: resolved_existing (links to existing substance + adds synonym),
--                      added_new (creates new substance + queues RAG),
--                      dismissed (removes item from prescription).
CREATE TABLE unmatched_drug_log (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_item_id  UUID NOT NULL REFERENCES prescription_items(id),
    raw_input             VARCHAR NOT NULL,
    -- Top 3 fuzzy matches surfaced to user: [{"substance_id": "...", "name": "...", "score": 0.42}]
    fuzzy_candidates      JSONB,
    pharmacist_action     VARCHAR NOT NULL DEFAULT 'pending'
                          CHECK (pharmacist_action IN ('pending', 'resolved_existing', 'added_new', 'dismissed')),
    resolved_substance_id UUID REFERENCES substances(id),
    new_synonym_added     BOOLEAN DEFAULT FALSE,   -- TRUE if synonym added to substance_synonyms
    notes                 TEXT,
    created_at            TIMESTAMP DEFAULT NOW(),
    resolved_at           TIMESTAMP
);

CREATE INDEX idx_unmatched_drug_log_prescription_item_id ON unmatched_drug_log(prescription_item_id);
CREATE INDEX idx_unmatched_drug_log_pharmacist_action    ON unmatched_drug_log(pharmacist_action);
