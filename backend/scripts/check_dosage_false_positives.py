#!/usr/bin/env python3
"""Identify likely false positives among `dosage_list empty for both dog and cat` warnings.

The script reads the warning log, locates the matching raw Plumb's monographs,
extracts the Dosages/Doses section, and flags entries that appear to contain
dog/cat dosing text in the source.

Usage:
  python3 scripts/check_dosage_false_positives.py
  python3 scripts/check_dosage_false_positives.py --ingredient "Pergolide"
  python3 scripts/check_dosage_false_positives.py --output reports/dosage_false_positives.json
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Iterable


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ERROR_LOG = WORKSPACE_ROOT / "error.txt"
DEFAULT_MONOGRAPH_DIR = WORKSPACE_ROOT / "plumbs_output"
DEFAULT_OUTPUT = WORKSPACE_ROOT / "reports" / "dosage_false_positive_candidates.json"

WARNING_TEXT = "dosage_list empty for both dog and cat"

SECTION_START_RE = re.compile(r"(?:^|\n)(Dosages|Doses)\s*\n", re.IGNORECASE)
SECTION_END_RE = re.compile(
    r"\n(?:Monitoring|Client Information|Chemistry/Synonyms|Storage/Stability|"
    r"Compatibility/Compounding Considerations|Dosage Forms/Regulatory Status|"
    r"Laboratory Considerations|References)\s*\n",
    re.IGNORECASE,
)
SPECIES_HEADING_RE = re.compile(
    r"(?im)^(DOGS/CATS|CATS/DOGS|DOGS\s*&\s*CATS|DOGS\s+AND\s+CATS|DOGS|CATS|DOG|CAT)\s*:\s*$"
)
DOSE_SIGNAL_RE = re.compile(
    r"(?ix)"
    r"(?:\b\d+(?:\.\d+)?\s*(?:-|–|to)?\s*\d*(?:\.\d+)?\s*"
    r"(?:mg/kg|mcg/kg|μg/kg|µg/kg|g/kg|mg/dog|mg/cat|mg/horse|mg|mcg|μg|µg|"
    r"units/kg|unit/kg|iu/kg|mL/kg|ml/kg|mEq/kg|%|tablets?|capsules?|teaspoons?/cat)\b)"
    r"|(?:\b(?:PO|IV|SC|IM|Top|CRI|oral|topically)\b.*?\b(?:every|once|twice|daily|hours?)\b)"
    r"|(?:\bbody weight\b)"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--error-log", type=Path, default=DEFAULT_ERROR_LOG)
    parser.add_argument("--monograph-dir", type=Path, default=DEFAULT_MONOGRAPH_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ingredient", action="append", default=[])
    parser.add_argument("--print-all", action="store_true", help="Print all checked ingredients, not only candidates")
    return parser.parse_args()


def extract_warned_ingredients(error_log: Path) -> list[str]:
    ingredients: list[str] = []
    with error_log.open(encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if WARNING_TEXT not in line or not line.startswith("[WARN]"):
                continue

            prefix, _ = line.split(":", 1)
            ingredient = prefix.replace("[WARN]", "", 1).strip()
            if ingredient:
                ingredients.append(ingredient)

    return ingredients


def load_monographs(monograph_dir: Path) -> dict[str, dict]:
    monographs: dict[str, dict] = {}
    for jsonl_path in sorted(monograph_dir.glob("*.jsonl"), key=lambda path: int(path.stem)):
        with jsonl_path.open(encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"JSON parse error in {jsonl_path} line {line_number}: {exc}") from exc

                ingredient = entry.get("ingredient")
                if ingredient and ingredient not in monographs:
                    monographs[ingredient] = entry

    return monographs


def extract_dosage_section(raw_content: str) -> str | None:
    start_match = SECTION_START_RE.search(raw_content)
    if not start_match:
        return None

    section_start = start_match.end()
    remainder = raw_content[section_start:]
    end_match = SECTION_END_RE.search(remainder)
    if end_match:
        return remainder[: end_match.start()].strip()
    return remainder.strip()


def normalize_heading(raw_heading: str) -> tuple[str, ...]:
    heading = re.sub(r"\s+", " ", raw_heading.upper()).strip()
    if heading in {"DOGS/CATS", "CATS/DOGS", "DOGS & CATS", "DOGS AND CATS"}:
        return ("dog", "cat")
    if heading in {"DOGS", "DOG"}:
        return ("dog",)
    if heading in {"CATS", "CAT"}:
        return ("cat",)
    return ()


def compact_snippet(text: str, limit: int = 320) -> str:
    snippet = re.sub(r"\s+", " ", text).strip()
    if len(snippet) <= limit:
        return snippet
    return snippet[: limit - 3].rstrip() + "..."


def species_hits_from_section(section: str) -> dict[str, list[str]]:
    hits = {"dog": [], "cat": []}
    matches = list(SPECIES_HEADING_RE.finditer(section))
    if not matches:
        return hits

    for index, match in enumerate(matches):
        block_start = match.end()
        block_end = matches[index + 1].start() if index + 1 < len(matches) else len(section)
        block = section[block_start:block_end].strip()
        if not block:
            continue
        if not DOSE_SIGNAL_RE.search(block):
            continue

        snippet = compact_snippet(block)
        for species in normalize_heading(match.group(1)):
            hits[species].append(snippet)

    return hits


def build_report_row(ingredient: str, monograph: dict | None) -> dict:
    if monograph is None:
        return {
            "ingredient": ingredient,
            "status": "missing_monograph",
            "source_file": None,
            "section_found": False,
            "dog_evidence": [],
            "cat_evidence": [],
        }

    raw_content = monograph.get("raw_content", "")
    dosage_section = extract_dosage_section(raw_content)
    if dosage_section is None:
        return {
            "ingredient": ingredient,
            "status": "no_dosage_section",
            "source_file": monograph.get("source_file"),
            "section_found": False,
            "dog_evidence": [],
            "cat_evidence": [],
        }

    hits = species_hits_from_section(dosage_section)
    status = "candidate_false_positive" if hits["dog"] or hits["cat"] else "likely_true_missing"
    return {
        "ingredient": ingredient,
        "status": status,
        "source_file": monograph.get("source_file"),
        "section_found": True,
        "dog_evidence": hits["dog"],
        "cat_evidence": hits["cat"],
        "section_preview": compact_snippet(dosage_section, limit=500),
    }


def filter_ingredients(ingredients: Iterable[str], requested: list[str]) -> list[str]:
    if not requested:
        return list(ingredients)

    requested_set = set(requested)
    return [ingredient for ingredient in ingredients if ingredient in requested_set]


def print_summary(rows: list[dict], print_all: bool) -> None:
    candidates = [row for row in rows if row["status"] == "candidate_false_positive"]
    likely_missing = [row for row in rows if row["status"] == "likely_true_missing"]
    missing_monograph = [row for row in rows if row["status"] == "missing_monograph"]
    no_section = [row for row in rows if row["status"] == "no_dosage_section"]

    print(f"checked: {len(rows)}")
    print(f"candidate_false_positive: {len(candidates)}")
    print(f"likely_true_missing: {len(likely_missing)}")
    print(f"missing_monograph: {len(missing_monograph)}")
    print(f"no_dosage_section: {len(no_section)}")

    rows_to_print = rows if print_all else candidates
    for row in rows_to_print:
        species = []
        if row.get("dog_evidence"):
            species.append("dog")
        if row.get("cat_evidence"):
            species.append("cat")
        species_label = ",".join(species) if species else "none"
        print(f"- {row['ingredient']} [{row['status']}] species={species_label} source={row.get('source_file')}")


def main() -> None:
    args = parse_args()

    warned_ingredients = extract_warned_ingredients(args.error_log)
    warned_ingredients = filter_ingredients(warned_ingredients, args.ingredient)
    monographs = load_monographs(args.monograph_dir)

    rows = [build_report_row(ingredient, monographs.get(ingredient)) for ingredient in warned_ingredients]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        json.dump(rows, handle, ensure_ascii=False, indent=2)

    print_summary(rows, print_all=args.print_all)
    print(f"output: {args.output}")


if __name__ == "__main__":
    main()