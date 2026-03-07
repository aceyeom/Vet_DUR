import json
import re
import os
import glob

def refined_filter_all_jsonl(input_dir, output_file):
    # 1. 정밀한 반려견 식별 패턴 정의
    dog_keywords = ['강아지', '반려견', '애완견', '견용', '자견', '성견', 'Canine']
    
    # 사용자 제안 ': 개' 및 문서 양식 패턴 (: 개, 개:, 가. 개, (개), 개 및 고양이)
    dog_patterns = [
        re.compile(r':\s?개'),          # 사용자 제안 패턴
        re.compile(r'개\s?:'),          # 항목 구분 패턴
        re.compile(r'[가-힣]\.\s?개'),   # 리스트 번호 패턴 (가. 개)
        re.compile(r'\(개\)'),          # 괄호 표기 패턴
        re.compile(r'개\s?및\s?고양이'), # 병기 패턴
        re.compile(r'(^|\s)개($|\s|/|,|\.)') # 단독 단어 패턴
    ]
    
    total_count = 0
    dog_count = 0
    
    # 2. 모든 jsonl 파일 찾기
    jsonl_files = glob.glob(os.path.join(input_dir, "*.jsonl"))
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for file_path in jsonl_files:
            print(f"🔍 {os.path.basename(file_path)} 검사 중...")
            
            with open(file_path, 'r', encoding='utf-8') as infile:
                for line in infile:
                    total_count += 1
                    item = json.loads(line)
                    content = item.get('raw_content', '')
                    
                    is_dog = any(kw in content for kw in dog_keywords)
                    
                    if not is_dog:
                        for pattern in dog_patterns:
                            if pattern.search(content):
                                is_dog = True
                                break
                    
                    if is_dog:
                        outfile.write(json.dumps(item, ensure_ascii=False) + "\n")
                        dog_count += 1
                        
    print("-" * 30)
    print(f"✅ 필터링 완료!")
    print(f"📊 총 검사 데이터: {total_count}건")
    print(f"🐕 추출된 반려견 데이터: {dog_count}건")
    print(f"📂 저장 경로: {output_file}")

# 실행 (파일들이 있는 폴더 경로와 결과 파일명을 지정하세요)
refined_filter_all_jsonl('./', 'dog_drugs_only_final.jsonl')