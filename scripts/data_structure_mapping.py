#!/usr/bin/env python3
"""
Data Structure Mapping Example
JSONL → Database Schema

Shows how one Plumb's JSONL record maps to multiple normalized DB tables
"""

import json

# ============================================================
# BEFORE: Current JSONL structure (raw Plumb's extract)
# ============================================================
JSONL_EXAMPLE = {
    "ingredient": "Granisetron",
    "source_file": "7.pdf",
    "sections": {
        "General Information": "(gran-iss-eh-tron) Kytril®\n5-HT3 Antagonist Antiemetic\n...",
        "Uses/Indications": "Granisetron is an alternative to other 5-HT3 receptor antagonists...",
        "Pharmacology/Actions": "Granisetron, like ondansetron or dolasetron, exerts its antinausea...",
        "Pharmacokinetics": "No pharmacokinetic data for dogs or cats were located. In humans, granisetron is rapidly absorbed...",
        "Adverse Effects": "Because of limited use in dogs and cats, a comprehensive adverse effect profile...",
        "Drug Interactions": "The following drug interactions have either been reported...",
        "Dosages": "DOGS/CATS:\nAntiemetic (extra-label): Little is published...",
        # ... other sections
    }
}

# ============================================================
# AFTER: Normalized DB structure (multiple INSERT statements)
# ============================================================

DB_INSERTS = {
    # 1. data_sources - document metadata
    "data_sources": {
        "source_type": "plumbs",
        "source_name": "Plumb's Veterinary Drug Handbook",
        "source_file": "7.pdf",
        "reliability_tier": 2,
        "accessed_at": "2024-03-05T10:00:00Z"
    },

    # 2. substances - active ingredient
    "substances": {
        "inn_name": "Granisetron",
        "korean_name": None,  # Would be extracted separately
        "drug_class": "Antiemetic",
        "subclass": "5-HT3 Antagonist",
        "formulary_status": "active",
        "data_completeness_e1": 0.8,  # PK confidence
        "data_completeness_e4": 0.6,  # Disease/contraindication confidence
    },

    # 3. substance_synonyms - brand names & alternative names
    "substance_synonyms": [
        {
            "substance_id": "{{granisetron_id}}",
            "synonym": "Kytril",
            "language": "en",
            "synonym_type": "brand"
        },
        {
            "substance_id": "{{granisetron_id}}",
            "synonym": "BRL-43694A",
            "language": "en",
            "synonym_type": "abbreviation"
        },
        {
            "substance_id": "{{granisetron_id}}",
            "synonym": "Aludal",
            "language": "en",
            "synonym_type": "brand"
        }
    ],

    # 4. pk_parameters - extracted from Pharmacokinetics section
    "pk_parameters": [
        {
            "substance_id": "{{granisetron_id}}",
            "species": "dog",
            "route": "all",
            "extraction_confidence": "low",  # "No pharmacokinetic data for dogs..."
            "note": "Data extracted from human pharmacokinetics"
        },
        {
            "substance_id": "{{granisetron_id}}",
            "species": "cat",
            "route": "all",
            "extraction_confidence": "low"
        }
    ],

    # 5. pd_risk_flags - adverse effects, safety info
    "pd_risk_flags": {
        "substance_id": "{{granisetron_id}}",
        "narrow_therapeutic_index": False,
        "cns_depression": "low",  # Somnolence reported in humans
        "adverse_effects_dog": "Limited use in dogs and cats; appears tolerated well",
        "adverse_effects_cat": "Limited use in dogs and cats; appears tolerated well",
        "serotonin_syndrome_risk": True,  # "Buprenorphine: risk for serotonin syndrome"
        "mdr1_mutation_risk": False,  # Not mentioned
        "reproductive_safety_class_papich": "B",  # High-dose rodent/rabbit studies ok
        "reproductive_safety_note": "Safety not clearly established; high-dose studies showed no fetal toxicity"
    },

    # 6. ddi_pairs - drug interactions
    "ddi_pairs": [
        {
            "substance_a_id": "{{apomorphine_id}}",
            "substance_b_id": "{{granisetron_id}}",
            "interaction_type": "pharmacodynamic",
            "severity": "contraindicated",
            "mechanism_detail": "Profound hypotension can occur",
            "chemical_effect": "Hypotensive shock"
        },
        {
            "substance_a_id": "{{buprenorphine_id}}",
            "substance_b_id": "{{granisetron_id}}",
            "interaction_type": "pharmacodynamic",
            "severity": "major",
            "mechanism_detail": "Concurrent use may increase risk for serotonin syndrome"
        },
        {
            "substance_a_id": "{{cisapride_id}}",
            "substance_b_id": "{{granisetron_id}}",
            "interaction_type": "pharmacodynamic",
            "severity": "major",
            "mechanism_detail": "Concurrent use may result in increased risk for QT-interval prolongation"
        }
    ],

    # 7. dosing_rules - extracted from Dosages section
    "dosing_rules": [
        {
            "substance_id": "{{granisetron_id}}",
            "species": "dog",
            "route": "IV",
            "indication": "Antiemetic",
            "dosing_type": "mg_per_kg",
            "min_dose": 0.02,
            "max_dose": 0.4,
            "dose_unit": "mg/kg",
            "maintenance_interval_hr": 12,  # IV single doses
            "evidence_level": "C"  # Extra-label use
        },
        {
            "substance_id": "{{granisetron_id}}",
            "species": "dog",
            "route": "PO",
            "indication": "Antiemetic",
            "min_dose": 0.1,
            "max_dose": 0.5,
            "maintenance_interval_hr": 12
        },
        {
            "substance_id": "{{granisetron_id}}",
            "species": "cat",
            "route": "IM",
            "indication": "Antiemetic",
            "min_dose": 1.0,  # mg/kg
            "maintenance_interval_hr": (8 * 24),  # 3 times daily = every 8 hours
        }
    ],

    # 8. contraindications - from Contraindications section
    "contraindications": {
        "substance_id": "{{granisetron_id}}",
        "condition_name": "Hypersensitivity",
        "clinical_category": "allergy",
        "contraindication_type": "absolute",
        "severity": "contraindicated",
        "mechanism": "Allergic reaction to granisetron or related compounds"
    },

    # 9. therapeutic_classes
    "therapeutic_classes": {
        "substance_id": "{{granisetron_id}}",
        "primary_class": "Antiemetic",
        "subclass": "5-HT3 Receptor Antagonist"
    },

    # 10. literature_chunks - preserve original text for RAG
    "literature_chunks": [
        {
            "substance_id": "{{granisetron_id}}",
            "pmc_id": None,  # Plumb's is not PMC
            "chunk_index": 0,
            "chunk_text": "(gran-iss-eh-tron) Kytril®\n5-HT3 Antagonist Antiemetic\nPrescriber Highlights\n▶Used for the treatment of severe vomiting or emesis prophylaxis before chemotherapy.",
            "field_group": "general_information",
            "embedding": None  # To be generated by model
        },
        {
            "substance_id": "{{granisetron_id}}",
            "chunk_index": 1,
            "chunk_text": "Granisetron is an alternative to other 5-HT3 receptor antagonists (eg, ondansetron or dolasetron) for the treatment of severe vomiting or prophylaxis before administering antineoplastic drugs...",
            "field_group": "uses_indications"
        },
        # ... more chunks for each section
    ]
}

# ============================================================
# COMPARISON
# ============================================================

COMPARISON = {
    "JSONL_structure": {
        "total_top_level_fields": 3,
        "total_sections": 17,
        "typical_size": "~50-100 KB per ingredient",
        "normalization": "Heavily denormalized"
    },
    
    "DB_structure": {
        "tables_populated": 10,
        "total_rows": "1 substance + 3 synonyms + 3 pk_params + 1 pd_flags + 3 ddi_pairs + 4 dosing_rules + 1 contra + 1 therapeutic + 8 lit_chunks = ~25 rows",
        "typical_size": "~5-10 KB total across all tables",
        "normalization": "Fully normalized (3NF)"
    }
}

if __name__ == "__main__":
    print("=" * 70)
    print("DATA STRUCTURE MAPPING: JSONL → Database")
    print("=" * 70)
    
    print("\n### BEFORE (JSONL) ###")
    print(json.dumps(JSONL_EXAMPLE, indent=2, ensure_ascii=False)[:500] + "\n...")
    
    print("\n### AFTER (Normalized DB) ###")
    for table, data in DB_INSERTS.items():
        print(f"\n{table}:")
        if isinstance(data, list):
            print(f"  [{len(data)} records]")
            print(f"  {json.dumps(data[0], indent=2, ensure_ascii=False)[:200]}...")
        else:
            print(f"  {json.dumps(data, indent=2, ensure_ascii=False)[:200]}...")
    
    print("\n### COMPARISON ###")
    print(json.dumps(COMPARISON, indent=2, ensure_ascii=False))
    
    print("\n### KEY POINTS ###")
    print("""
    ✅ 같은 데이터를 다르게 표현
       - JSONL: 원본 텍스트 그대로 (RAW)
       - DB: 구조화된 정보 (PROCESSED)
    
    ✅ 1개 JSONL 레코드 → 여러 DB 테이블로 분산
       - Granisetron 1개 = 25개 정규화된 행
    
    ❌ 구조가 같지 않음 (의도적 차이)
       - JSONL: 임시 저장 형식
       - DB: 최종 분석 엔진용 형식
    
    📊 마이그레이션 필요
       - ETL 파이프라인으로 변환
       - 텍스트 파싱 + 구조화
       - 임베딩 생성 + 검증
    """)
