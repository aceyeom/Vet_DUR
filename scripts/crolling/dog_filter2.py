# 해보니까 1200개쯤 했을 떄 토큰이 200만개 정도 찍힘
# 모델 바꿔야 할 듯

import json
import os
import glob
from google import genai

# OpenAI 설정
client = genai(api_key="이건 안대지 > <") # 실제 API 키로 교체하세요
MODEL = "gpt-4o"  # 모델 업데이트해야겠음 ->  비용 최소화를 하거나, 최신 모델로 바꾸거나.

def get_system_prompt():
    return """
너는 수의학 전문 DUR 데이터 분석가야. 주어진 동물용 의약품 원문에서 정보를 추출할 때 다음 지침을 엄격히 따라:

### 1. 개(Dog) 데이터 전용 추출 (CRITICAL) ###
- 원문에 '소', '돼지', '닭' 등 여러 축종이 포함된 경우, **오직 개(Dog/Canine)와 관련된 용법, 용량, 효능 정보만 추출**해.
- 타 축종의 정보(예: 소의 휴약기간, 돼지의 용량 등)는 결과 JSON에 절대 포함하지 마.
- 만약 특정 항목이 개에 대한 내용 없이 공통사항만 있다면 그 공통사항을 개 기준으로 해석해 저장해.

### 2. 의약품 분류 (Classification) ###
- 원문에 '처방대상', '수의사 처방', '전문의약품', 'POM' 등의 문구가 있으면 'professional'로 분류해.
- 위 문구가 없거나 '신고대상', '일반' 등으로 표시되면 'general'로 분류해.

### 3. JSON 구조 및 데이터 표준화 ###
- dosage: 'kg당 5mg'인 경우 value: 5.0, unit: 'mg/kg'으로 수치화해.
- pregnancy_safety: 'safe', 'caution', 'forbidden' 중 하나로 매핑해.
- ingredients: 영문 일반명(Generic Name)을 병기해.

반드시 아래 JSON 구조로만 응답해:
{
  "classification": "professional / general",
  "ingredients": [{"name": "English Name", "amount": float, "unit": "string"}],
  "dur_logic": {
    "dosage": {"value": float, "unit": "mg/kg or ml/kg", "frequency": "string", "route": "string", "duration_days": "string"},
    "contraindication": {"pregnancy_safety": "safe/caution/forbidden", "age_limit": "string", "prohibited_conditions": ["string"]},
    "ddi": {"prohibited_drugs": ["string"], "prohibited_classes": ["string"]},
    "allergy": ["string"],
    "drug_disease": ["string"]
  }
}
"""

def enrich_dog_specific_data(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8') as outfile:
        count = 0
        for line in infile:
            count += 1
            if count > 0 and count % 10 == 0:
                print(f"📊 {count}개 제품 분석 완료...")

            item = json.loads(line)
            raw_text = item.get('raw_content', '')
            product_name = item.get('product_name', 'Unknown')

            print(f"🐕 [반려견 전용 구조화] {product_name} 분석 중...")

            try:
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": get_system_prompt()},
                        {"role": "user", "content": f"제품명: {product_name}\n원문:\n{raw_text}"}
                    ],
                    response_format={"type": "json_object"}
                )

                enriched_metadata = json.loads(response.choices[0].message.content)
                
                # 최종 데이터 구성
                final_output = {
                    "index": item.get("index"),
                    "product_name": product_name,
                    "collected_at": item.get("collected_at"),
                    "classification": enriched_metadata.get("classification"),
                    "ingredients": enriched_metadata.get("ingredients"),
                    "dur_logic": enriched_metadata.get("dur_logic")
                }

                outfile.write(json.dumps(final_output, ensure_ascii=False) + "\n")
                
            except Exception as e:
                print(f"❌ {product_name} 오류: {e}")
                continue

if __name__ == "__main__":
    enrich_dog_specific_data("dog_drugs_only_raw.jsonl", "Vet_DUR_Dog_Exclusive.jsonl")