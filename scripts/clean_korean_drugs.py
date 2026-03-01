#!/usr/bin/env python3
"""
Clean dog_drugs_filtered.jsonl by removing problematic entries.

Removes:
- Products marked as 수출용 (export-only, not permitted for domestic use in Korea)
- Products with no active ingredients (empty 원료약품 section)
- Non-pharmaceutical topicals (shampoos, creams, sprays)
- Products with unclear/procedural dosing only
- Products marked as 의약외품 (quasi-drugs)

Output:
- dog_drugs_cleaned.jsonl: filtered data suitable for MVP
- cleaning_report.txt: detailed report of removed entries
"""

import json
import re
from pathlib import Path
from collections import defaultdict

def analyze_entry(data):
    """
    Analyze entry and determine if it should be kept.

    Returns:
        tuple: (should_keep: bool, reason: str)
    """
    product_name = data.get('product_name', '')
    raw_content = data.get('raw_content', '')

    # Check 0: Is it an export-only product? (수출용 = not permitted for domestic use in Korea)
    if '수출용' in product_name:
        return False, 'export_only_product'

    # Check 1: Is it marked as 의약외품 (quasi-drug)?
    if '동물용의약외품' in raw_content:
        return False, 'marked_as_quasi_drug'

    # Check 2: Does it have active ingredients?
    # Look for "원료약품" or "성분" section
    has_ingredient_section = '원료약품' in raw_content or '성분명' in raw_content

    if not has_ingredient_section:
        return False, 'no_ingredient_section'

    # Extract the ingredient section to check if it's empty
    lines = raw_content.split('\n')
    ingredient_found = False
    for i, line in enumerate(lines):
        if '원료약품' in line or '성분' in line:
            # Look at next 10 lines for actual ingredient entries
            for j in range(i, min(i+15, len(lines))):
                # Check for component patterns: numbers, units (mg, ml, IU, CFU), or specific naming
                if any(pattern in lines[j] for pattern in ['성분명', 'MG', 'ML', 'mg', 'ml', 'IU', 'CFU', '적량', '%']):
                    # Make sure it's not just headers
                    if re.search(r'\d+[\.\d]*\s*(mg|ml|g|%|IU|CFU)', lines[j], re.IGNORECASE):
                        ingredient_found = True
                        break
            break

    if not ingredient_found:
        return False, 'no_active_ingredients'

    # Check 3: Is it a procedural topical (shampoo, cream, spray)?
    # These have no pharmacological DUR value
    topical_keywords = {
        'shampoo': ['샴푸', 'shampoo', 'lotion', '로션', '린스', 'rinse', 'conditioner'],
        'cream': ['크림', 'cream', '연고', 'ointment', '검사', '골', '겔', '젤', 'gel', 'paste'],
        'spray': ['스프레이', 'spray', 'mist', '분무'],
        'powder': ['산제', 'powder', '파우더', 'dust'],
        'topical_oral': ['스프레이', 'spray', '구강', 'oral care', '치아'],
    }

    for topical_type, keywords in topical_keywords.items():
        for keyword in keywords:
            if keyword.lower() in product_name.lower():
                # Double-check: if it has route explicitly stated as non-topical, might be okay
                if not any(route in raw_content for route in ['경구', 'oral', '주사', 'injection']):
                    return False, f'procedural_topical_{topical_type}'

    # Check 4: Classification code check for known problematic categories
    # Extract classification code (분류코드)
    for i, line in enumerate(lines):
        if '분류코드' in line:
            # Look at this line and next for the actual code
            for j in range(i, min(i+3, len(lines))):
                code_line = lines[j]
                # 10810 = 샴푸류 (shampoos)
                # 10820 = 로션류 (lotions)
                # These are cosmetic classifications, not pharmaceutical
                if any(cosmetic_code in code_line for cosmetic_code in ['10810', '10820', '10830', '10840']):
                    return False, 'cosmetic_classification'
            break

    # Check 5: Has route of administration (needed for DUR)
    routes = ['경구', 'oral', '주사', 'injection', 'IV', 'IM', 'SC', '피하', '근육', '정맥']
    has_route = any(route in raw_content for route in routes)

    # Special case: "급여" without explicit route might be feed-based
    if '급여' in raw_content and not has_route:
        # Check if it's clearly a feed supplement
        if '사료' in raw_content or 'feed' in raw_content.lower():
            return False, 'feed_based_with_no_animal_route'

    # If we got here, keep it
    return True, 'passed_all_checks'

def clean_drugs(input_file, output_file, report_file):
    """
    Clean drug dataset and generate report.

    Args:
        input_file: dog_drugs_filtered.jsonl
        output_file: dog_drugs_cleaned.jsonl
        report_file: cleaning_report.txt
    """
    stats = {
        'total': 0,
        'kept': 0,
        'removed': 0,
        'removal_reasons': defaultdict(list),
    }

    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8') as outfile, \
         open(report_file, 'w', encoding='utf-8') as reportfile:

        reportfile.write("=" * 80 + "\n")
        reportfile.write("DATA CLEANING REPORT\n")
        reportfile.write("=" * 80 + "\n\n")

        for line_num, line in enumerate(infile, 1):
            stats['total'] += 1

            data = json.loads(line.strip())
            should_keep, reason = analyze_entry(data)

            if should_keep:
                stats['kept'] += 1
                outfile.write(json.dumps(data, ensure_ascii=False) + '\n')
            else:
                stats['removed'] += 1
                product_name = data.get('product_name', 'UNKNOWN')
                stats['removal_reasons'][reason].append((line_num, product_name))

            # Progress
            if line_num % 200 == 0:
                print(f"Processed {line_num} entries...")

        # Write report
        reportfile.write(f"SUMMARY\n")
        reportfile.write(f"{'=' * 80}\n")
        reportfile.write(f"Total entries processed: {stats['total']:,}\n")
        reportfile.write(f"Entries kept: {stats['kept']:,} ({100*stats['kept']/stats['total']:.1f}%)\n")
        reportfile.write(f"Entries removed: {stats['removed']:,} ({100*stats['removed']/stats['total']:.1f}%)\n\n")

        reportfile.write(f"REMOVAL REASONS\n")
        reportfile.write(f"{'=' * 80}\n")
        for reason in sorted(stats['removal_reasons'].keys()):
            entries = stats['removal_reasons'][reason]
            reportfile.write(f"\n{reason}: {len(entries)} entries\n")
            reportfile.write(f"{'-' * 80}\n")
            for line_num, product_name in entries[:10]:  # Show first 10
                reportfile.write(f"  Line {line_num:4d}: {product_name}\n")
            if len(entries) > 10:
                reportfile.write(f"  ... and {len(entries) - 10} more\n")

    return stats

def main():
    """Main entry point."""
    input_file = Path('/workspaces/FullStackDemoPractice/dog_drugs_filtered.jsonl')
    output_file = Path('/workspaces/FullStackDemoPractice/dog_drugs_cleaned.jsonl')
    report_file = Path('/workspaces/FullStackDemoPractice/cleaning_report.txt')

    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}")
        return

    print(f"Cleaning Korean veterinary drug data...")
    print(f"Input: {input_file}")
    print(f"Output: {output_file}")
    print()

    stats = clean_drugs(str(input_file), str(output_file), str(report_file))

    # Console output
    print("=" * 80)
    print("DATA CLEANING RESULTS")
    print("=" * 80)
    print(f"Total entries processed:    {stats['total']:,}")
    print(f"Entries kept (MVP-ready):   {stats['kept']:,} ({100*stats['kept']/stats['total']:.1f}%)")
    print(f"Entries removed:            {stats['removed']:,} ({100*stats['removed']/stats['total']:.1f}%)")
    print()

    print("Removal Breakdown:")
    print("-" * 80)
    for reason in sorted(stats['removal_reasons'].keys(),
                        key=lambda x: len(stats['removal_reasons'][x]),
                        reverse=True):
        count = len(stats['removal_reasons'][reason])
        print(f"  {reason:40s}: {count:4,} entries")

    print()
    print(f"Report saved to: {report_file}")
    print(f"Cleaned dataset saved to: {output_file}")
    print("=" * 80)

if __name__ == '__main__':
    main()
