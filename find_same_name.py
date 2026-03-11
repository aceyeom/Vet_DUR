import glob
import json
import os
from collections import defaultdict

def find_duplicate_ingredients(directory="plumbs_output"):
    # 약물 이름(ingredient)을 키로, 발견된 파일 경로와 줄 번호를 리스트로 저장할 딕셔너리
    ingredient_map = defaultdict(list)
    
    # plumbs_output 폴더 내의 모든 jsonl 파일 검색
    files = glob.glob(os.path.join(directory, "*.jsonl"))
    
    print(f"총 {len(files)}개의 파일을 검사 중...\n")
    
    for file_path in files:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    ingredient = data.get("ingredient")
                    if ingredient:
                        # 파일 이름과 줄 번호를 함께 기록
                        file_name = os.path.basename(file_path)
                        ingredient_map[ingredient].append(f"{file_name} (Line {line_num})")
                except json.JSONDecodeError:
                    continue
                    
    # 등장 횟수가 2번 이상인 것만 필터링
    duplicates = {ing: locs for ing, locs in ingredient_map.items() if len(locs) > 1}
    
    if not duplicates:
        print("🎉 겹치는 약물 이름(ingredient)이 하나도 없어! 데이터가 아주 깔끔해.")
    else:
        print(f"⚠️ 총 {len(duplicates)}개의 중복된 약물 이름이 발견됐어!\n")
        for ingredient, locations in duplicates.items():
            print(f"💊 약물 이름: '{ingredient}'")
            for loc in locations:
                print(f"  - 발견 위치: {loc}")
            print("-" * 40)

if __name__ == "__main__":
    find_duplicate_ingredients()