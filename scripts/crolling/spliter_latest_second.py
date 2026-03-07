import json
import time
import anthropic
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from anthropic import transform_schema
from pydantic import TypeAdapter

# ==========================================
# 1. Pydantic을 이용한 구조화된 출력 스키마 정의
# ==========================================
class Ingredient(BaseModel):
    E_name: str
    K_name: str
    amount: Optional[float]
    unit: str

class Dosage(BaseModel):
    value: Optional[float]
    unit: str
    frequency: str
    route: str
    duration_days: str

class Contraindication(BaseModel):
    pregnancy_safety: Literal["safe", "caution", "forbidden"]
    age_limit: str
    prohibited_conditions: List[str]

class DDI(BaseModel):
    prohibited_drugs: List[str]
    prohibited_classes: List[str]

class DURLogic(BaseModel):
    dosage: Dosage
    contraindication: Contraindication
    ddi: DDI
    allergy: List[str]
    drug_disease: List[str]

class DrugMetadata(BaseModel):
    classification: Literal["professional", "general"]
    ingredients: List[Ingredient]
    dur_logic: DURLogic

# Pydantic 모델을 Anthropic API가 이해할 수 있는 JSON 스키마로 변환
json_schema = transform_schema(TypeAdapter(DrugMetadata).json_schema())

# ==========================================
# 2. 클라이언트 초기화 및 배치 요청 생성
# ==========================================
# 환경 변수에 ANTHROPIC_API_KEY가 설정되어 있어야 합니다.
client = anthropic.Anthropic(api_key="")

input_file = "raw_drugs.jsonl"     # 가지고 계신 원본 데이터 파일명
output_file = "parsed_drugs.jsonl" # 저장될 결과 파일명

requests = []

# 시스템 프롬프트 (지시사항)
SYSTEM_PROMPT = """너는 수의학 전문 DUR 데이터 분석가야. 주어진 동물용 의약품 원문에서 정보를 추출할 때 다음 지침을 엄격히 따라:
1. 개(Dog) 데이터 전용 추출: 오직 개(Dog/Canine)와 관련된 용법, 용량, 효능 정보만 추출해. 타 축종 정보는 절대 포함하지 마. 공통사항만 있다면 개 기준으로 해석해.
2. 의약품 분류: '처방대상', '수의사 처방', '전문의약품' 등이 있으면 'professional', 위 문구가 없거나 '신고대상', '일반'이면 'general'로 분류해.
3. 데이터 표준화: dosage 수치화 및 pregnancy_safety 매핑 규칙을 철저히 지켜."""

print("1. 로컬 파일 읽기 및 배치 요청 생성 중...")
with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        idx = str(data['index'])
        product_name = data.get('product_name', '')
        raw_content = data.get('raw_content', '')
        
        user_prompt = f"제품명: {product_name}\n\n원문:\n{raw_content}"
        
        # 각 라인별로 Request 객체 생성 (custom_id로 인덱스 매핑)
        req = anthropic.types.messages.batch_create_params.Request(
            custom_id=idx,
            params=anthropic.types.MessageCreateParamsNonStreaming(
                model="claude-3-5-sonnet-20241022", # 최신 Sonnet 모델 권장
                max_tokens=2048,
                system=[{"type": "text", "text": SYSTEM_PROMPT}],
                messages=[{"role": "user", "content": user_prompt}],
                output_config={
                    "format": {
                        "type": "json_schema",
                        "schema": json_schema
                    }
                }
            )
        )
        requests.append(req)

# ==========================================
# 3. 배치 전송 및 상태 폴링 (비동기 처리)
# ==========================================
print(f"총 {len(requests)}개의 요청을 배치 API로 전송합니다...")
batch = client.messages.batches.create(requests=requests)
print(f"배치 생성 완료! Batch ID: {batch.id}")

while True:
    batch_status = client.messages.batches.retrieve(batch.id)
    if batch_status.processing_status == "ended":
        print("\n배치 처리가 모두 완료되었습니다!")
        break
    
    # 처리 현황 출력
    counts = batch_status.request_counts
    print(f"처리 중... (완료: {counts.succeeded}, 에러: {counts.errored}, 진행중: {counts.processing})")
    time.sleep(60) # 1분마다 상태 확인

# ==========================================
# 4. 결과 스트리밍 다운로드 및 100개 단위로 JSONL 저장 (Chunking)
# ==========================================
print("결과를 스트리밍하며 100개 단위로 로컬 파일에 저장합니다...")

buffer = []
chunk_count = 1

# 'w' 대신 'a'(append) 모드를 사용하여 파일이 중간에 끊겨도 기존 데이터를 보존합니다.
with open(output_file, 'a', encoding='utf-8') as out_f:
    for result in client.messages.batches.results(batch.id):
        if result.result.type == "succeeded":
            # Claude가 반환한 엄격한 JSON 텍스트 추출
            parsed_json_str = result.result.message.content[0].text
            parsed_data = json.loads(parsed_json_str)
            
            # 원본 index와 파싱된 데이터를 묶어서 딕셔너리로 구성
            final_output = {
                "index": result.custom_id,
                "parsed_data": parsed_data
            }
            # 리스트에 문자열 형태로 임시 보관
            buffer.append(json.dumps(final_output, ensure_ascii=False))
            
        elif result.result.type == "errored":
            print(f"데이터 파싱 에러 (Index: {result.custom_id}): {result.result}")

        # 버퍼에 100개가 차면 파일에 한 번에 쓰고 메모리 비우기
        if len(buffer) >= 100:
            out_f.write("\n".join(buffer) + "\n")
            print(f"> {chunk_count * 100}개 데이터 안전하게 저장 완료...")
            buffer.clear() # 메모리 확보
            chunk_count += 1

    # 반복문이 모두 끝나고 버퍼에 남아있는 나머지 데이터(예: 1100개 중 마지막 100개 이하) 처리
    if buffer:
        out_f.write("\n".join(buffer) + "\n")
        print(f"> 나머지 {len(buffer)}개 저장 완료.")

print(f"\n🎉 모든 데이터 파싱 및 저장이 완료되었습니다. '{output_file}'을 확인해 주세요.")