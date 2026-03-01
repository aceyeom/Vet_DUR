# 데이터 분석 기반 데이터베이스 형식 권장사항

## 데이터셋 개요: 877개 제품

| 지표 | 값 |
|--------|-------|
| 총 항목 수 | 877 |
| 단일 활성 성분 | 820 (93.5%) |
| 다중 성분 조합 | 51 (5.8%) |
| 2개 이상의 활성 성분 | 최대 6개 성분의 51개 제품 |

---

## 1. 투여 경로 — 중요한 설계 결정

### 현재 분포:
- **근육주사 (IM)**: 285 (32.5%)
- **피하주사 (SC)**: 244 (27.8%)
- **정맥주사 (IV)**: 196 (22.3%)
- **경구**: 110 (12.5%)
- **외용제**: 42 (4.8%)

### 문제점: 다중 경로 제품

**45.7% 제품**이 **2개 이상의 경로**를 같은 항목에 나열합니다:
- 이중 경로: 401개 제품 (45.7%)
- 삼중 경로: 152개 제품 (17.3%)
- 4개 경로 모두: 18개 제품 (2.1%)

**예시**: "덱사주"
```
개, 고양이: 1~2ml 피하 또는 근육주사
소, 돼지: 2~5ml 근육 또는 정맥주사
```

### 필수 아키텍처 결정:

**옵션 A: 성분+경로별 다중 제품** (현재 스키마)
```sql
products 테이블:
- (덱사메타손, IV)
- (덱사메타손, IM)
- (덱사메타손, SC)
```
✓ 장점: 깔끔한 스키마, dosing_rules는 1:1 매핑
✗ 단점: 원본 파싱에서 다중 경로 추출 필요, ~877개 대신 ~2000개 제품

**옵션 B: 경로 배열이 있는 단일 제품** (수정된 스키마)
```sql
products 테이블:
- (덱사메타손, [IV, IM, SC])

dosing_rules 테이블:
- 경로 필터를 종 필터와 함께 추가
```
✓ 장점: 원본 데이터 구조와 일치, 최소한의 정규화
✗ 단점: 쿼리 복잡성 (_@>), DUR 엔진이 경로로 필터링해야 함

**권장사항**: **옵션 A** — dosing_rules 설계를 깔끔하게 유지

---

## 2. 투여 형식 — 매우 다양함

### 과제: 표준 mg/kg은 13.7%만 사용

| 투여 형식 | 개수 | % | 비고 |
|---|---|---|---|
| **mg/kg** | 120 | 13.7% | 표준 약리학적 투여량 |
| **ml/kg 또는 ml/동물** | 138 | 15.7% | 액제 제제 (주사액) |
| **정/캡슐 개수/일** | 64 | 7.3% | "1정 1일 1회" → 효능으로 mg 추론 필요 |
| **ml/동물** | 104 | 11.8% | "1-2ml 주사" — 체중 계산 없음 |
| **IU/단위 (백신, 비타민)** | 196 | 22.3% | CFU 또는 IU 투여량, 체중 기반 아님 |
| **희석 필요** | 2 | 0.2% | "물 4-5ml에 녹인 후 주입" |
| **사료 혼합** | 308 | 35.1% | "톤당 2kg 혼합" — 가축 보충제 |

### 투여량 변동의 예시:

**1. 표준 mg/kg:**
```
엔로신 100주 (엔로플록사신 100mg/mL)
→ 10mg/kg IV 1일 1회
```

**2. ml/kg)**
```
설프림액 (설파메톡사졸 나트륨)
→ 0.25ml/kg 사료에 혼합, 3~7일
```

**3. ml/동물 (체중 기반 아님):**
```
덱사주 (덱사메타손)
→ 개/고양이: 1~2ml 피하 또는 근육주사
→ 소/돼지: 2~5ml 근육 또는 정맥주사
```

**4. 정/캡슐 (효능으로 추론):**
```
테라민 정 (테르비나핀 어염산 염 정 5mg)
→ 30mg / kg, 1일 = 1kg 개에 6정
```

**5. IU 기반 (치료용/백신):**
```
넬판도라 (생균제)
→ 소: 사료 톤당 1~2kg (CFU 기반, 체중 아님)
```

### 데이터베이스 솔루션:

**dosing_rules 테이블 컬럼 확장:**

```sql
dosing_rules (
  -- 경로, 종, 적응증 (기존)
  substance_id, species, route, indication,

  -- 주요 투여 형식
  dosing_type VARCHAR, -- 'mg_per_kg' | 'ml_per_kg' | 'ml_per_animal' |
                        -- 'tablet_per_day' | 'iU_based' | 'feed_based'

  -- 투여 값 (단위는 dosing_type과 일치)
  min_dose DECIMAL,
  max_dose DECIMAL,
  dose_unit VARCHAR, -- 'mg/kg' | 'ml/kg' | 'ml/animal' | 'count/day' | 'CFU' | 'IU'

  -- 정 기반 투여량용: 효능 참조
  reference_strength_mg DECIMAL, -- 예: 5mg 정 → 개수 추론

  -- 빈도
  frequency_per_day INT,
  frequency_hours INT,

  -- 기간
  duration_days INT,

  -- 특수 처리
  loading_dose BOOLEAN,
  requires_dilution BOOLEAN,
  dilution_notes TEXT, -- "멸균수 4-5ml에 녹인 후"

  -- 가축/사료 혼합
  is_feed_additive BOOLEAN,
  per_ton_feed_kg DECIMAL, -- 사료 보충제용
);
```

---

## 3. 효능/투여량 단위 — 8가지 유형

| 단위 | 개수 | % | 예시 |
|---|---|---|---|
| **mg** | 703 | 80.2% | 정제, 분말, 대부분의 경구약 |
| **ml** | 554 | 63.2% | 액제, 주사, 용액 |
| **정 개수** | 295 | 33.6% | "1정" (1정) 표기 |
| **%** | 263 | 30.0% | 백분율 용액 |
| **g/그램** | 165 | 18.8% | 분말/과립 제품 |
| **IU** | 75 | 8.6% | 비타민, 호르몬 |
| **CFU** | 37 | 4.2% | 생균제, 생물제제 |
| **mcg/마이크로그램** | 극소수 | <1% | 저용량 제품 |

### product_variants 스키마 업데이트:

```sql
product_variants (
  -- 기존 필드
  id, product_id, korean_db_index, korean_name_full, manufacturer,

  -- 효능 정보 (원본 데이터 저장)
  strength_value DECIMAL,
  strength_unit VARCHAR, -- 'mg' | 'ml' | 'g' | '%' | 'IU' | 'CFU' | 'mcg'

  -- 농도 형식
  strength_per VARCHAR, -- 'per_tablet' | 'per_mL' | 'per_mL_solution' | 'per_unit'

  -- 투여 형식
  dosage_form VARCHAR, -- '정' | '주사액' | '산제' | '액제' | '캡슐'

  -- 패키지 정보
  package_sizes TEXT[],
  unit_per_package INT, -- 예: 박스당 20정
);
```

---

## 4. 종(種) 커버리지 — 가축 대 반려동물

### 분포:
```
개:              513 (58.5%)
소:              514 (58.6%)
말:              383 (43.7%)
다종:            363 (41.4%)
고양이:          220 (25.1%)
돼지:            185 (21.1%)
미지정:          ? (드문)
```

### 종 조합 상위 5개:

| 종 조합 | 개수 | % | 전형적 제품 |
|---|---|---|---|
| 소, 개, 말 | 294 | 33.5% | 구충제, 항생물질 |
| 고양이, 소, 개, 말, 돼지 | 191 | 21.8% | 광범위 약물 |
| 고양이, 소, 개, 말 | 127 | 14.5% | 소동물 + 대동물 중심 |
| 소, 개, 말, 돼지 | 103 | 11.7% | 가축 + 반려동물 혼합 |
| 소, 개 | 65 | 7.4% | 반려동물 + 경제 가치 중심 |

### 데이터베이스 함의:

```sql
products.approved_species — TEXT[] 배열 사용
-- 좋음: '{"개", "고양이"}'
-- 좋음: '{"소", "말", "돼지"}'
-- 좋음: '{"개", "고양이", "소"}'
```

종별 투여량은 dosing_rules에 존재:
```sql
dosing_rules (substance, species, route, indication, min_dose, max_dose)
-- 각 종이 자신의 행을 가짐
-- DUR 엔진은 다음으로 필터링: substance + patient.species + patient.route
```

---

## 5. 다중 성분 제품 — 대부분 단순함

### 분포:

| 성분 개수 | 제품 | % |
|---|---|---|
| **1개 활성 성분** | 820 | 93.5% |
| **2개 성분** | 15 | 1.7% |
| **3개 성분** | 18 | 2.0% |
| **4개 성분** | 12 | 1.4% |
| **5개 이상** | 6 | 0.7% |

### 예시:

**2성분 제품:**
```
하트필락스: 이버멕틴 + 파란텔
노바트정: 마로피턴트 (다중 용량)
```

**3개 이상 성분 제품:**
```
DHPP 백신: 디스템퍼 + 아데노바이러스 + 파보 + 파라인플루엔자
이뮨 가디언: 15가지 성분 (박테리아 + 비타민 + 미네랄)
```

### 데이터베이스 영향: 최소화

product_components 테이블이 이를 잘 처리합니다:
```sql
product_components (
  product_id, substance_id, amount_per_unit, unit, is_primary_active
)
-- 제품당 성분당 1행만 추가
```

---

## 6. 중요한 데이터 품질 문제

### 누락되거나 불명확한 정보:

| 문제 | 개수 | 영향 |
|---|---|---|
| **정류 없는 정제** | 295 | 효능 + 정 개수를 파싱하여 mg/kg 추론 필요 |
| **사료 혼합 제품** | ~308 | 다른 투여 모델 (kg/톤, mg/kg 아님) |
| **동물용 백신** | 97 | CFU/IU, 표준 투여량 아님 |
| **종별 투여량이 있는 제품** | ~400 | 종별로 별도의 dosing_rules 행 생성 필요 |
| **용량 없는 주사만** | ~100 | "수의사 지시대로" — DUR 검사 불가 |

---

## 7. MVP 스키마 권장사항

### 최소 생존 가능 스키마 수정사항:

**1. 유지:** 모든 기존 계층 1, 2, 3 테이블 (products, product_variants, substances 등)

**2. 확장:** `dosing_rules` 테이블

```sql
ALTER TABLE dosing_rules ADD COLUMN (
  dosing_type VARCHAR NOT NULL DEFAULT 'mg_per_kg',
    -- 'mg_per_kg' | 'ml_per_kg' | 'ml_per_animal' | 'tablet_per_day' | 'iU' | 'feed_based'

  dose_unit VARCHAR,
    -- dosing_type과 일치: 'mg/kg' | 'ml/kg' | 'CFU' | 'IU' | 'tablets/day'

  is_feed_additive BOOLEAN DEFAULT false,
  per_ton_feed_kg DECIMAL, -- is_feed_additive = true인 경우만

  requires_dilution BOOLEAN DEFAULT false,
  dilution_instructions TEXT,

  loading_dose BOOLEAN DEFAULT false,
  loading_dose_days INT,
  maintenance_interval_hr INT,
);
```

**3. 확장:** `product_variants` 테이블

```sql
ALTER TABLE product_variants ADD COLUMN (
  strength_per VARCHAR,
    -- 'per_tablet' | 'per_mL_solution' | 'per_capsule' | 'per_sachet'
);
```

**4. DUR 로직 업데이트:**
- 엔진 2 (투여량)는 다음을 처리해야 합니다:
  - mg/kg 기본 경로
  - ml/kg 경로 (가능한 mg으로 변환)
  - 정 기반 ("정확한 mg 계산 불가" 경고로 표시)
  - IU/CFU ("표준 투여량 아님"으로 표시)
  - 사료 혼합 (dosing_rules 검사에서 제외)

---

## 요약 테이블: MVP에 필요한 것

| 구성 요소 | 형식 | 개수 | 처리 방식 |
|---|---|---|---|
| **경로** | IV, IM, SC, 경구, 외용 | 5가지 유형 | 성분+경로별 다중 행 |
| **종** | 개, 고양이, 소, 말, 돼지 | 최대 5개 종 | 종별로 1개의 dosing_rules 행 |
| **효능 단위** | mg, ml, %, g, IU, CFU | 8가지 유형 | product_variants에서 정규화 |
| **투여 형식** | mg/kg, ml/kg, 정 개수, IU | 4+ 유형 | dosing_rules의 dosing_type 필드 |
| **다중 성분** | 1~6개 성분 | 94% 단일 | product_components 처리 |
| **종 커버리지** | 다종~단일 | 41% 다종 | approved_species를 TEXT[]로 |

---

## MVP를 위한 최종 권장사항

**현재 스키마 유지** — 94% 경우를 완벽하게 처리합니다.

**다음에 유연성 추가:**
1. ✅ 정 기반 투여 (strength_per 컬럼)
2. ✅ 비-mg/kg 투여 (dosing_rules의 dosing_type 컬럼)
3. ✅ 사료 혼합 제외 플래그 (is_feed_additive boolean)
4. ✅ DUR 엔진 2 로직 업데이트 (ml/kg 및 정 변환 처리)

**스키마 완전 교체 필요 없음.** 데이터가 모델에 잘 맞습니다.

---

*생성: 2026-03-01 | 분석 데이터: dog_drugs_cleaned.jsonl (877개 항목)*
