import fitz  # PyMuPDF
import json
import re
from pathlib import Path

# 1. 트리거 문구 (References...)
TRIGGER_PATTERN = re.compile(r'References\s*For the complete list of references, see wiley\.com/go/budde/plumb', re.IGNORECASE)

# 2. 발음 기호 정규식
PRONUNCIATION_PATTERN = re.compile(r'^\s*\([a-z]+-[a-z\-\s]+\)', re.IGNORECASE | re.MULTILINE)

def extract_data_from_pdf(pdf_path):
    results = []
    full_text_blocks = []

    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            page_content = page.get_text("text") or ""

            # 표(Table) 추출 및 표준 마크다운 형식으로 변환
            tabs = page.find_tables()
            if tabs and tabs.tables:
                for tab in tabs.tables:
                    parsed_table = tab.extract()
                    if not parsed_table: continue

                    headers = parsed_table[0]
                    col_count = len(headers)
                    markdown_separator = "|" + "|".join(["---"] * col_count) + "|"

                    table_rows = []
                    for row in parsed_table:
                        safe_row = [str(cell).replace('\n', ' ') if cell else "" for cell in row]
                        table_rows.append("| " + " | ".join(safe_row) + " |")

                    table_str = "\n" + table_rows[0] + "\n" + markdown_separator + "\n" + "\n".join(table_rows[1:]) + "\n"
                    page_content += f"\n\n[TABLE_START]\n{table_str}\n[TABLE_END]\n"

            full_text_blocks.append(page_content)

        doc.close()

    except Exception as e:
        print(f"  [오류] '{pdf_path.name}' 파일을 읽는 중 문제 발생: {e}")
        return []

    all_text = "\n".join(full_text_blocks)
    blocks = TRIGGER_PATTERN.split(all_text)

    for block in blocks:
        block = block.strip()
        if not block: continue

        match = PRONUNCIATION_PATTERN.search(block)
        if match:
            pre_text = block[:match.start()].strip()
            lines = [line.strip() for line in pre_text.split('\n') if line.strip()]

            # 단독으로 존재하는 숫자(페이지 번호) 제거
            lines = [line for line in lines if not line.isdigit()]

            if lines:
                ingredient = lines[0]
                raw_content_start = block[match.start():].strip()
                if len(lines) > 1:
                    extra_synonyms = "\n".join(lines[1:])
                    raw_content = f"{extra_synonyms}\n\n{raw_content_start}"
                else:
                    raw_content = raw_content_start
            else:
                ingredient = "Unknown"
                raw_content = block[match.start():].strip()

            # 페이지 헤더/푸터 잡음 제거
            header_pattern = re.compile(rf'^\s*(\d+\s+{re.escape(ingredient)}|{re.escape(ingredient)}\s+\d+)\s*$', re.IGNORECASE | re.MULTILINE)
            raw_content = header_pattern.sub('', raw_content)
            raw_content = re.sub(r'\n{3,}', '\n\n', raw_content).strip()

            # 약물명 + raw_content 그대로 저장
            results.append({
                "ingredient": ingredient,
                "source_file": pdf_path.name,
                "raw_content": raw_content
            })

    return results


def process_directory(input_dir, output_dir):
    base_dir = Path(input_dir)
    out_dir = Path(output_dir)

    if not base_dir.exists() or not base_dir.is_dir():
        print(f"경로를 찾을 수 없습니다: {base_dir.resolve()}")
        return

    out_dir.mkdir(parents=True, exist_ok=True)

    pdf_files = list(base_dir.rglob('*.pdf'))
    print(f"총 {len(pdf_files)}개의 PDF 파일을 구조화합니다...\n")

    all_data = []
    for i, pdf_path in enumerate(pdf_files, 1):
        print(f"[{i}/{len(pdf_files)}] {pdf_path.name} 처리 중...")
        all_data.extend(extract_data_from_pdf(pdf_path))

    # 10개씩 끊어서 n.jsonl로 저장
    chunk_size = 10
    file_index = 0
    for start in range(0, len(all_data), chunk_size):
        chunk = all_data[start:start + chunk_size]
        out_path = out_dir / f"{file_index}.jsonl"
        with open(out_path, 'w', encoding='utf-8') as f:
            for entry in chunk:
                f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        print(f"  💾 {out_path.name} 저장 ({len(chunk)}개 약물)")
        file_index += 1

    print(f"\n✅ 완료! 총 {len(all_data)}개의 약물이 {file_index}개 파일로 저장되었습니다.")


# ----------------- 실행부 -----------------
INPUT_FOLDER = "plumbs_pdf"
OUTPUT_DIR = "plumbs_output"
process_directory(INPUT_FOLDER, OUTPUT_DIR)
