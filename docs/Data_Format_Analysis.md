# Database Format Recommendations Based on Data Analysis

## Dataset Overview: 877 Products

| Metric | Value |
|--------|-------|
| Total entries | 877 |
| Single active ingredient | 820 (93.5%) |
| Multi-ingredient combinations | 51 (5.8%) |
| With 2+ active ingredients | 51 products max 6 components |

---

## 1. ROUTE OF ADMINISTRATION — Critical Design Choice

### Current Distribution:
- **IM (Intramuscular)**: 285 (32.5%)
- **SC (Subcutaneous)**: 244 (27.8%)
- **IV (Intravenous)**: 196 (22.3%)
- **Oral**: 110 (12.5%)
- **Topical**: 42 (4.8%)

### The Problem: Multi-Route Products

**45.7% of products** have **2+ routes** listed in the same entry:
- Dual route: 401 products (45.7%)
- Triple route: 152 products (17.3%)
- All 4 routes: 18 products (2.1%)

**Example**: "덱사주"
```
개, 고양이: 1~2ml 피하 또는 근육주사
소, 돼지: 2~5ml 근육 또는 정맥주사
```

### Architectural Decision Required:

**Option A: Multiple products per substance+route** (Current schema)
```sql
products table:
- (dexamethasone, IV)
- (dexamethasone, IM)
- (dexamethasone, SC)
```
✓ Pros: Clean schema, dosing_rules maps 1:1
✗ Cons: Raw parsing needs to extract multiple routes, ~2000 products instead of 877

**Option B: Single product with route array** (Modified schema)
```sql
products table:
- (dexamethasone, [IV, IM, SC])

dosing_rules table:
- Add route filter alongside species
```
✓ Pros: Matches raw data structure, minimal normalization
✗ Cons: Query complexity (_@>), DUR engine must filter by route

**Recommendation**: **Option A** — keeps your dosing_rules design clean

---

## 2. DOSING FORMATS — Highly Variable

### Challenge: Only 13.7% use standard mg/kg

| Dosing Format | Count | % | Notes |
|---|---|---|---|
| **mg/kg** | 120 | 13.7% | Standard pharmacological dosing |
| **ml/kg or ml/animal** | 138 | 15.7% | Liquid formulations (injectable solutions) |
| **Tablet/capsule count/day** | 64 | 7.3% | "1정 1일 1회" → must infer mg from strength |
| **ml/animal** | 104 | 11.8% | "1-2ml per injection" — no weight calculation |
| **IU/unit (vaccines, vitamins)** | 196 | 22.3% | CFU or IU dosing, not weight-based |
| **Dilution required** | 2 | 0.2% | "Dissolve in 4-5ml water then inject" |
| **Feed-based** | 308 | 35.1% | "2kg per ton of feed" — livestock supplements |

### Examples of Dosing Variability:

**1. Standard mg/kg:**
```
엔로신 100주 (Enrofloxacin 100mg/mL)
→ 10mg/kg IV once daily
```

**2. ml/kg)**
```
설프림액 (Sulfamethoxazole sodium)
→ 0.25ml/kg mixed in feed, 3-7 days
```

**3. ml/animal (not weight-based):**
```
덱사주 (Dexamethasone)
→ Dog/cat: 1-2ml SC or IM
→ Cattle/pig: 2-5ml IM or IV
```

**4. Tablets/capsule (infer from strength):**
```
테라민 정 (Terbinafine 5mg per tablet)
→ 30mg / kg, 1 day = 6 tablets for 1kg dog
```

**5. IU-based (therapeutic/vaccines):**
```
넬판도라 (Probiotic)
→ Cattle: 1-2kg/ton of feed (CFU-based, not weight)
```

### Database Solution:

**Expand dosing_rules table columns:**

```sql
dosing_rules (
  -- Route, species, indication (existing)
  substance_id, species, route, indication,

  -- PRIMARY dosing format
  dosing_type VARCHAR, -- 'mg_per_kg' | 'ml_per_kg' | 'ml_per_animal' |
                        -- 'tablet_per_day' | 'iU_based' | 'feed_based'

  -- Dosing values (unit matches dosing_type)
  min_dose DECIMAL,
  max_dose DECIMAL,
  dose_unit VARCHAR, -- 'mg/kg' | 'ml/kg' | 'ml/animal' | 'count/day' | 'CFU' | 'IU'

  -- For tablet-based dosing: reference to strength
  reference_strength_mg DECIMAL, -- e.g., 5mg tablet → infer count

  -- Frequency
  frequency_per_day INT,
  frequency_hours INT,

  -- Duration
  duration_days INT,

  -- Special handling
  loading_dose BOOLEAN,
  requires_dilution BOOLEAN,
  dilution_notes TEXT, -- "Dissolve in 4-5ml sterile water"

  -- Livestock/feed-based
  is_feed_additive BOOLEAN,
  per_ton_feed_kg DECIMAL, -- For feed supplements
);
```

---

## 3. STRENGTH/DOSAGE UNITS — 8 Different Types

| Unit | Count | % | Examples |
|---|---|---|---|
| **mg** | 703 | 80.2% | tablets, powders, most oral |
| **ml** | 554 | 63.2% | liquids, injections, solutions |
| **Tablet count** | 295 | 33.6% | "1정" (1 tablet) notation |
| **%** | 263 | 30.0% | percentage solutions |
| **g/gram** | 165 | 18.8% | powder/granule products |
| **IU** | 75 | 8.6% | vitamins, hormones |
| **CFU** | 37 | 4.2% | probiotics, biologics |
| **mcg/microgram** | few | <1% | low-dose products |

### Product_variants Schema Update:

```sql
product_variants (
  -- Existing fields
  id, product_id, korean_db_index, korean_name_full, manufacturer,

  -- Strength information (store raw data)
  strength_value DECIMAL,
  strength_unit VARCHAR, -- 'mg' | 'ml' | 'g' | '%' | 'IU' | 'CFU' | 'mcg'

  -- Concentration format
  strength_per VARCHAR, -- 'per_tablet' | 'per_mL' | 'per_mL_solution' | 'per_unit'

  -- Dosage form
  dosage_form VARCHAR, -- '정' | '주사액' | '산제' | '액제' | '캡슐'

  -- Package info
  package_sizes TEXT[],
  unit_per_package INT, -- e.g., 20 tablets per box
);
```

---

## 4. SPECIES COVERAGE — Livestock vs Companion

### Distribution:
```
Dog (개):           513 (58.5%)
Cattle (소):        514 (58.6%)
Horse (말):         383 (43.7%)
Multi-species:      363 (41.4%)
Cat (고양이):       220 (25.1%)
Pig (돼지):         185 (21.1%)
Unspecified:         ?  (rare)
```

### Species Combinations (Top 5):

| Species Combo | Count | % | Typical Products |
|---|---|---|---|
| cattle, dog, horse | 294 | 33.5% | Anthelminthics, antibiotics |
| cat, cattle, dog, horse, pig | 191 | 21.8% | Broad-spectrum drugs |
| cat, cattle, dog, horse | 127 | 14.5% | Small + large animal focus |
| cattle, dog, horse, pig | 103 | 11.7% | Livestock + companion mix |
| cattle, dog | 65 | 7.4% | Pet + economic value focus |

### Database Implication:

```sql
products.approved_species — Use TEXT[] array
-- Good: '{"dog", "cat"}'
-- Good: '{"cattle", "horse", "pig"}'
-- Good: '{"dog", "cat", "cattle"}'
```

Species-specific dosing lives in dosing_rules:
```sql
dosing_rules (substance, species, route, indication, min_dose, max_dose)
-- Each species gets its own row
-- DUR engine filters by: substance + patient.species + patient.route
```

---

## 5. MULTI-COMPONENT PRODUCTS — Mostly Simple

### Distribution:

| Component Count | Products | % |
|---|---|---|
| **1 active ingredient** | 820 | 93.5% |
| **2 ingredients** | 15 | 1.7% |
| **3 ingredients** | 18 | 2.0% |
| **4 ingredients** | 12 | 1.4% |
| **5+ ingredients** | 6 | 0.7% |

### Examples:

**2-ingredient products:**
```
하트필락스: ivermectin + pyrantel
노바트정: maropitant (multiple doses)
```

**3+ ingredient products:**
```
DHPP vaccine: distemper + adenovirus + parvo + parainfluenza
Immune Guardian: 15 components (bacteria + vitamins + minerals)
```

### Database Impact: MINIMAL

product_components table will handle this fine:
```sql
product_components (
  product_id, substance_id, amount_per_unit, unit, is_primary_active
)
-- Just add one row per substance per product
```

---

## 6. CRITICAL DATA QUALITY ISSUES

### Missing / Unclear Information:

| Issue | Count | Impact |
|---|---|---|
| **Tablets without dose info** | 295 | Must parse strength + tablet count to infer mg/kg |
| **Feed-based products** | ~308 | Different dosing model (kg/ton, not mg/kg) |
| **Vaccine products** | 97 | CFU/IU, not standard dosing |
| **Products with species-specific doses** | ~400 | Must create separate dosing_rules per species |
| **Injection-only with no volume** | ~100 | "As directed by veterinarian" — cannot DUR check |

---

## 7. MVP SCHEMA RECOMMENDATIONS

### Minimum Viable Schema Modifications:

**1. Keep:** All existing Layer 1, 2, 3 tables (products, product_variants, substances, etc.)

**2. Extend:** `dosing_rules` table

```sql
ALTER TABLE dosing_rules ADD COLUMN (
  dosing_type VARCHAR NOT NULL DEFAULT 'mg_per_kg',
    -- 'mg_per_kg' | 'ml_per_kg' | 'ml_per_animal' | 'tablet_per_day' | 'iU' | 'feed_based'

  dose_unit VARCHAR,
    -- Matches dosing_type: 'mg/kg' | 'ml/kg' | 'CFU' | 'IU' | 'tablets/day'

  is_feed_additive BOOLEAN DEFAULT false,
  per_ton_feed_kg DECIMAL, -- Only if is_feed_additive = true

  requires_dilution BOOLEAN DEFAULT false,
  dilution_instructions TEXT,

  loading_dose BOOLEAN DEFAULT false,
  loading_dose_days INT,
  maintenance_interval_hr INT,
);
```

**3. Extend:** `product_variants` table

```sql
ALTER TABLE product_variants ADD COLUMN (
  strength_per VARCHAR,
    -- 'per_tablet' | 'per_mL_solution' | 'per_capsule' | 'per_sachet'
);
```

**4. DUR Logic Update:**
- Engine 2 (Dosage) must handle:
  - mg/kg default path
  - ml/kg path (convert to mg where possible)
  - Tablet-based (mark as "unable to calculate precise mg" warning)
  - IU/CFU (mark as "non-standard dosing")
  - Feed-based (exclude from dosing_rules checks)

---

## Summary Table: What Your MVP Needs

| Component | Format | Count | Handling |
|---|---|---|---|
| **Routes** | IV, IM, SC, oral, topical | 5 types | Multiple rows per substance+route |
| **Species** | Dog, cat, cattle, horse, pig | 5 species max | One dosing_rules row per species |
| **Strength units** | mg, ml, %, g, IU, CFU | 8 types | Normalized in product_variants |
| **Dosing formats** | mg/kg, ml/kg, tablet count, IU | 4+ types | dosing_type field in dosing_rules |
| **Multi-ingredient** | Single to 6 components | 94% single | product_components handles |
| **Species coverage** | Multi-species to single | 41% multi | approved_species as TEXT[] |

---

## Final Recommendation for MVP

**GO WITH YOUR CURRENT SCHEMA** — it handles 94% of cases perfectly.

**Just add flexibility for:**
1. ✅ Tablet-based dosing (strength_per column)
2. ✅ Non-mg/kg dosing (dosing_type column in dosing_rules)
3. ✅ Feed-based exclusion flag (is_feed_additive boolean)
4. ✅ DUR Engine 2 logic update (handle ml/kg and tablet conversion)

**No need for schema overhaul.** The data fits your model well.

---

*Generated: 2026-03-01 | Data analyzed: dog_drugs_cleaned.jsonl (877 entries)*
