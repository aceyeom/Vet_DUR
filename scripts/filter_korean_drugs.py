#!/usr/bin/env python3
"""
Filter Korean veterinary drug dataset to separate actual drugs from quasi-drugs.

Separates entries marked as 동물용의약품 (pharmaceutical drugs) from
동물용의약외품 (quasi-drugs/supplements) based on the 품목정보 field
in the raw_content.

Output:
- dog_drugs_filtered.jsonl: actual pharmaceutical drugs only
- dog_drugs_supplement_export.jsonl: quasi-drugs for reference
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

def categorize_entry(raw_content):
    """
    Determine if entry is a drug or quasi-drug based on raw_content.

    Uses 품목정보 (product info) field to classify:
    - 동물용의약품: pharmaceutical drugs
    - 생물의약품: biological medicines (vaccines, biologics)
    - 동물용의약외품: quasi-drugs/supplements

    Returns:
        str: 'pharmaceutical' or 'quasi_drug'
    """
    if not raw_content:
        # Default to pharmaceutical if cannot determine
        return 'pharmaceutical'

    # Extract the 품목정보 line which contains the category
    lines = raw_content.split('\n')
    for i, line in enumerate(lines):
        if '품목정보' in line:
            # Look at this line and the next 3 lines for the actual classification
            for j in range(i, min(i+4, len(lines))):
                category_line = lines[j]

                # Check for explicit quasi-drug marker
                if '동물용의약외품' in category_line:
                    return 'quasi_drug'

                # All other official categories are pharmaceutical
                # (동물용의약품, 생물의약품, etc.)
                if any(marker in category_line for marker in ['동물용의약품', '생물의약품']):
                    return 'pharmaceutical'
            break

    # Fallback: check overall content for markers
    if '동물용의약외품' in raw_content:
        return 'quasi_drug'

    # Default to pharmaceutical for entries with 품목정보 but ambiguous classification
    # (This handles vaccines and other biologics that don't use explicit markers)
    if '품목정보' in raw_content:
        return 'pharmaceutical'

    # Last resort: if we can find any drug-like indicators, assume pharmaceutical
    # Otherwise default to pharmaceutical (safer for DUR purposes)
    return 'pharmaceutical'

def filter_drugs(input_file, output_drugs, output_supplements):
    """
    Filter raw drug data into pharmaceutical and quasi-drug files.

    Args:
        input_file: path to dog_drugs_only_raw.jsonl
        output_drugs: path to output for pharmaceutical drugs
        output_supplements: path to output for quasi-drugs

    Returns:
        dict with statistics
    """
    stats = {
        'total': 0,
        'pharmaceutical': 0,
        'quasi_drug': 0,
        'errors': 0,
        'quasi_drug_categories': defaultdict(int)
    }

    quasi_drug_keywords = {
        'probiotic': ['프로바이오틱', '프로스', '이뮨', '프로바', '유산균', '젖산균', 'probiotic'],
        'vitamin': ['비타민', '비', '헬스', '토닉', 'vitamin'],
        'supplement': ['보충', '보충제', '영양', '영양식', '건강식', 'supplement'],
        'joint': ['조인트', '관절', '뼈', 'joint', 'bone'],
        'digestive': ['다이제스티브', '소화', '위장', 'digestive'],
    }

    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_drugs, 'w', encoding='utf-8') as drugs_file, \
         open(output_supplements, 'w', encoding='utf-8') as supplements_file:

        for line_num, line in enumerate(infile, 1):
            stats['total'] += 1

            try:
                entry = json.loads(line.strip())
            except json.JSONDecodeError as e:
                stats['errors'] += 1
                print(f"Error parsing line {line_num}: {e}", file=sys.stderr)
                continue

            category = categorize_entry(entry.get('raw_content', ''))
            stats[category] += 1

            if category == 'pharmaceutical':
                drugs_file.write(json.dumps(entry, ensure_ascii=False) + '\n')
            elif category == 'quasi_drug':
                supplements_file.write(json.dumps(entry, ensure_ascii=False) + '\n')

                # Categorize the type of quasi-drug for reporting
                product_name = entry.get('product_name', '').lower()
                categorized = False
                for qd_type, keywords in quasi_drug_keywords.items():
                    if any(kw.lower() in product_name or kw in entry.get('raw_content', '')
                           for kw in keywords):
                        stats['quasi_drug_categories'][qd_type] += 1
                        categorized = True
                        break
                if not categorized:
                    stats['quasi_drug_categories']['other'] += 1

            # Progress indicator
            if line_num % 500 == 0:
                print(f"Processed {line_num} entries...", file=sys.stderr)

    return stats

def main():
    """Main entry point."""
    input_path = Path('/workspaces/FullStackDemoPractice/dog_drugs_only_raw.jsonl')
    output_drugs = Path('/workspaces/FullStackDemoPractice/dog_drugs_filtered.jsonl')
    output_supplements = Path('/workspaces/FullStackDemoPractice/dog_drugs_supplement_export.jsonl')

    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Filtering Korean veterinary drug data...")
    print(f"Input: {input_path}")
    print(f"Output (drugs): {output_drugs}")
    print(f"Output (supplements): {output_supplements}")
    print()

    stats = filter_drugs(str(input_path), str(output_drugs), str(output_supplements))

    # Report results
    print("=" * 60)
    print("FILTERING RESULTS")
    print("=" * 60)
    print(f"Total entries processed:  {stats['total']:,}")
    print(f"Pharmaceutical drugs:     {stats['pharmaceutical']:,} ({100*stats['pharmaceutical']/stats['total']:.1f}%)")
    print(f"Quasi-drugs (excluded):   {stats['quasi_drug']:,} ({100*stats['quasi_drug']/stats['total']:.1f}%)")
    print(f"Parsing errors:           {stats['errors']:,}")
    print()

    if stats['quasi_drug_categories']:
        print("Quasi-drug Categories Excluded:")
        for qd_type, count in sorted(stats['quasi_drug_categories'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {qd_type:15s}: {count:5,} entries")
    print()

    # Verify counts
    total_output = stats['pharmaceutical'] + stats['quasi_drug']
    expected_total = stats['total'] - stats['errors']
    if total_output == expected_total:
        print("✓ Verification passed: all entries accounted for")
        print(f"  Input:  {expected_total:,} entries (excluding {stats['errors']} errors)")
        print(f"  Output: {stats['pharmaceutical']:,} + {stats['quasi_drug']:,} = {total_output:,}")
    else:
        print("✗ Verification warning: entry count mismatch")
        print(f"  Expected: {expected_total:,}, Got: {total_output:,}")

    print("=" * 60)

if __name__ == '__main__':
    main()
