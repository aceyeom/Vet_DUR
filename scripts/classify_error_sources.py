#!/usr/bin/env python3
"""Classify error.txt warnings by likely root cause per ingredient.

Outputs:
- JSON rows with per-ingredient classification and supporting reasons
- Markdown table for quick review

Usage:
  python3 scripts/classify_error_sources.py
  python3 scripts/classify_error_sources.py --output-json reports/error_source_classification.json --output-md reports/error_source_classification.md
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

from check_dosage_false_positives import build_report_row, load_monographs


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ERROR_LOG = WORKSPACE_ROOT / "error.txt"
DEFAULT_MONOGRAPH_DIR = WORKSPACE_ROOT / "plumbs_output"
DEFAULT_JSON_OUTPUT = WORKSPACE_ROOT / "reports" / "error_source_classification.json"
DEFAULT_MD_OUTPUT = WORKSPACE_ROOT / "reports" / "error_source_classification.md"

WARN_RE = re.compile(r"^\[WARN\]\s+(.*?):\s+(.*)$")
RETRY_RE = re.compile(r"^\[RETRY\]\s+(.*?):\s+(.*)$")
INCONSISTENCY_RE = re.compile(r"Inconsistency:\s+([^;]+)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--error-log", type=Path, default=DEFAULT_ERROR_LOG)
    parser.add_argument("--monograph-dir", type=Path, default=DEFAULT_MONOGRAPH_DIR)
    parser.add_argument("--output-json", type=Path, default=DEFAULT_JSON_OUTPUT)
    parser.add_argument("--output-md", type=Path, default=DEFAULT_MD_OUTPUT)
    return parser.parse_args()


def parse_error_log(error_log: Path) -> dict[str, dict]:
    entries: dict[str, dict] = defaultdict(lambda: {"warn_messages": [], "retry_messages": []})

    with error_log.open(encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue

            warn_match = WARN_RE.match(line)
            if warn_match:
                ingredient, message = warn_match.groups()
                entries[ingredient]["warn_messages"].extend(part.strip() for part in message.split(";") if part.strip())
                continue

            retry_match = RETRY_RE.match(line)
            if retry_match:
                ingredient, message = retry_match.groups()
                entries[ingredient]["retry_messages"].append(message.strip())

    return dict(entries)


def dosage_classification(ingredient: str, monographs: dict[str, dict]) -> tuple[str, str | None]:
    row = build_report_row(ingredient, monographs.get(ingredient))
    if row["status"] == "candidate_false_positive":
        species = []
        if row.get("dog_evidence"):
            species.append("dog")
        if row.get("cat_evidence"):
            species.append("cat")
        species_text = ", ".join(species) if species else "dog/cat"
        return (
            "LLM 오류 가능성 높음",
            f"원문 Dosages 섹션에 {species_text} 용량 흔적이 있어 dosage_list 추출 누락 가능성이 큼",
        )

    if row["status"] == "likely_true_missing":
        return (
            "데이터 부재 가능성 높음",
            "원문 Dosages 섹션에서 dog/cat 용량 흔적을 찾지 못함",
        )

    if row["status"] == "no_dosage_section":
        return ("데이터 부재 가능성 높음", "원문에 Dosages/Doses 섹션이 없음")

    return ("LLM 오류 가능성 높음", "원문 monograph를 찾지 못해 추출/매핑 오류 가능성이 있음")


def classify_ingredient(ingredient: str, payload: dict, monographs: dict[str, dict]) -> dict:
    warn_messages = payload["warn_messages"]
    retry_messages = payload["retry_messages"]

    reasons: list[str] = []
    evidence_types: list[str] = []
    classification = "데이터 부재 가능성 높음"

    for message in warn_messages:
        if message == "dosage_list empty for both dog and cat":
            dosage_class, reason = dosage_classification(ingredient, monographs)
            evidence_types.append("dosage_empty")
            reasons.append(reason)
            if dosage_class == "LLM 오류 가능성 높음":
                classification = "LLM 오류 가능성 높음"
        elif message.startswith("Inconsistency:"):
            evidence_types.append("logical_inconsistency")
            reasons.append(f"출력 필드 간 논리 불일치: {message.replace('Inconsistency: ', '', 1)}")
            classification = "LLM 오류 가능성 높음"
        else:
            evidence_types.append("other_warning")
            reasons.append(f"검토 필요 경고: {message}")

    for message in retry_messages:
        evidence_types.append("retry")
        reasons.append(f"모델 응답 재시도 발생: {message}")
        classification = "LLM 오류 가능성 높음"

    unique_reasons: list[str] = []
    for reason in reasons:
        if reason and reason not in unique_reasons:
            unique_reasons.append(reason)

    return {
        "ingredient": ingredient,
        "classification": classification,
        "warn_messages": warn_messages,
        "retry_messages": retry_messages,
        "evidence_types": evidence_types,
        "reasons": unique_reasons,
    }


def write_markdown(rows: list[dict], output_path: Path) -> None:
    lines = [
        "| 약물 | 분류 | 근거 |",
        "| --- | --- | --- |",
    ]

    for row in rows:
        reason_text = " / ".join(row["reasons"]) if row["reasons"] else "-"
        lines.append(f"| {row['ingredient']} | {row['classification']} | {reason_text} |")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    parsed = parse_error_log(args.error_log)
    monographs = load_monographs(args.monograph_dir)

    rows = [classify_ingredient(ingredient, payload, monographs) for ingredient, payload in sorted(parsed.items())]

    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    with args.output_json.open("w", encoding="utf-8") as handle:
        json.dump(rows, handle, ensure_ascii=False, indent=2)

    write_markdown(rows, args.output_md)

    data_missing = sum(1 for row in rows if row["classification"] == "데이터 부재 가능성 높음")
    llm_error = sum(1 for row in rows if row["classification"] == "LLM 오류 가능성 높음")

    print(f"classified: {len(rows)}")
    print(f"data_missing_likely: {data_missing}")
    print(f"llm_error_likely: {llm_error}")
    print(f"json_output: {args.output_json}")
    print(f"markdown_output: {args.output_md}")


if __name__ == "__main__":
    main()