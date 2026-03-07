import json
import anthropic

client = anthropic.Anthropic(api_key="")
file_path = 'dog_drugs_prescription_only.jsonl' # 파일 경로 확인

# 1. JSONL 파일 읽기
data_list = []
with open(file_path, 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip():
            data_list.append(json.loads(line))

print(f"총 {len(data_list)}개의 데이터를 불러왔습니다.")

# 2. 텍스트 길이순으로 상위 5개 추출
# json.dumps를 사용해 실제 API로 전송될 문자열 길이를 기준으로 측정합니다.
top_5_longest = sorted(data_list, key=lambda x: len(json.dumps(x, ensure_ascii=False)), reverse=True)[:5]

print(f"\n--- 최장 데이터 5종 토큰 측정 시작 ---")
token_results = []

for i, sample in enumerate(top_5_longest):
    # 실제 전송될 문자열로 변환
    sample_str = json.dumps(sample, ensure_ascii=False)
    
    response = client.messages.count_tokens(
        model="claude-opus-4-6",
        system="당신은 반려견 영양 및 약물 전문가입니다.",
        messages=[{"role": "user", "content": sample_str}],
    )
    
    tokens = response.input_tokens
    token_results.append(tokens)
    print(f"샘플 {i+1} | 글자수: {len(sample_str):>5}자 | 토큰 수: {tokens:>5}")

# 3. 평균 및 예상치 계산
avg_tokens = sum(token_results) / len(token_results)
print(f"\n✅ 상위 5개 평균 토큰: {avg_tokens:.1f}")
print(f"💡 전체 1,100개 처리 시 예상 입력 토큰: {int(avg_tokens * 1100):,}")