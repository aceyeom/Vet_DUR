#!/usr/bin/env python3
"""
Analyze target animals from filtered prescription drugs.
Extracts animal types from 효능효과 and 대상동물 sections.
"""

import json
import re
from collections import Counter
from pathlib import Path

# Animal type patterns
ANIMAL_KEYWORDS = {
    "개": "Dog",
    "고양이": "Cat",
    "소": "Cattle",
    "돼지": "Pig",
    "말": "Horse",
    "양": "Sheep",
    "닭": "Chicken",
    "오리": "Duck",
    "칠면조": "Turkey",
    "송아지": "Calf",
    "자돈": "Piglet",
    "자돈": "Piglet",
    "망아지": "Foal",
    "염소": "Goat",
    "명금": "Mink",
    "사슴": "Deer",
    "토끼": "Rabbit",
    "애완견": "Pet dog",
    "애완동물": "Pet",
    "애견": "Dog",
    "견": "Dog/Canine",
}

def extract_target_animals(raw_content: str) -> set:
    """
    Extract target animals from raw content.
    Looks for 대상동물 sections and general animal mentions.
    """
    animals = set()
    
    # Convert to lowercase for matching
    content_lower = raw_content.lower()
    
    # Look for explicit 대상동물 (target animal) sections
    target_pattern = r"대상동물[:\s]*([^\n]+)"
    target_matches = re.findall(target_pattern, raw_content)
    
    # Also look in efficacy section
    efficacy_pattern = r"효능효과[:\s]*([^\n]+)"
    efficacy_matches = re.findall(efficacy_pattern, raw_content)
    
    all_text_to_check = target_matches + efficacy_matches
    
    # Check first 500 lines of raw content for animal mentions
    first_lines = " ".join(raw_content.split("\n")[:50])
    
    for korean, english in ANIMAL_KEYWORDS.items():
        if korean in first_lines:
            animals.add(english)
        for text in all_text_to_check:
            if korean in text:
                animals.add(english)
    
    # If no animals found, try broader check
    if not animals:
        if "대장균" in raw_content or "세균" in raw_content:
            # Generic indicators suggest multiple animals
            if "개" in raw_content:
                animals.add("Dog")
            if "고양이" in raw_content:
                animals.add("Cat")
            if "소" in raw_content:
                animals.add("Cattle")
    
    return animals


def analyze_target_animals(input_path: str) -> dict:
    """
    Analyze target animals across all prescription drugs.
    """
    input_file = Path(input_path)
    
    animal_counts = Counter()
    animal_drug_map = {}
    drug_by_animal = {animal: [] for animal in ANIMAL_KEYWORDS.values()}
    
    total_drugs = 0
    drugs_with_animals = 0
    multi_animal_drugs = 0
    
    with open(input_file, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            try:
                record = json.loads(line.strip())
                total_drugs += 1
                
                raw_content = record.get("raw_content", "")
                product_name = record.get("product_name", "Unknown")
                
                animals = extract_target_animals(raw_content)
                
                if animals:
                    drugs_with_animals += 1
                    if len(animals) > 1:
                        multi_animal_drugs += 1
                    
                    for animal in animals:
                        animal_counts[animal] += 1
                        drug_by_animal[animal].append(product_name)
            
            except json.JSONDecodeError:
                pass
    
    return {
        "total_drugs": total_drugs,
        "drugs_with_animals": drugs_with_animals,
        "multi_animal_drugs": multi_animal_drugs,
        "animal_counts": animal_counts,
        "drug_by_animal": drug_by_animal,
    }


def print_animal_analysis(analysis: dict):
    """Print formatted animal analysis report."""
    
    print("\n" + "=" * 80)
    print("TARGET ANIMAL ANALYSIS - PRESCRIPTION DOGS DRUGS")
    print("=" * 80)
    
    print(f"\nTotal Prescription Drugs Analyzed: {analysis['total_drugs']:,}")
    print(f"Drugs with Identifiable Target Animals: {analysis['drugs_with_animals']:,}")
    print(f"  -> Coverage: {(analysis['drugs_with_animals']/analysis['total_drugs']*100):.1f}%")
    print(f"Multi-species Drugs: {analysis['multi_animal_drugs']:,}")
    print(f"  -> {(analysis['multi_animal_drugs']/analysis['drugs_with_animals']*100):.1f}% of identified drugs")
    
    print("\n" + "-" * 80)
    print("PRESCRIPTION DRUGS BY TARGET ANIMAL")
    print("-" * 80)
    
    # Sort by count descending
    sorted_animals = sorted(
        analysis["animal_counts"].items(), 
        key=lambda x: x[1], 
        reverse=True
    )
    
    total_count = sum(count for _, count in sorted_animals)
    
    for animal, count in sorted_animals:
        percentage = (count / total_count * 100) if total_count > 0 else 0
        bar_length = int(percentage / 2)
        bar = "█" * bar_length
        print(f"{animal:20} {count:4} drugs  {percentage:5.1f}%  {bar}")
    
    # Show some sample drugs for major animal types
    print("\n" + "-" * 80)
    print("SAMPLE DRUGS BY ANIMAL (First 5 each)")
    print("-" * 80)
    
    for animal, count in sorted_animals[:5]:
        drugs = analysis["drug_by_animal"].get(animal, [])[:5]
        print(f"\n{animal} - {count} total products:")
        for drug_name in drugs:
            print(f"  • {drug_name}")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    input_file = "/workspaces/FullStackDemoPractice/backend/data/dog_drugs_prescription_only.jsonl"
    
    print("Analyzing target animals...")
    analysis = analyze_target_animals(input_file)
    print_animal_analysis(analysis)
    
    # Save analysis to JSON
    output_file = Path(input_file).parent / "animal_analysis.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "total_drugs": analysis["total_drugs"],
                "drugs_with_animals": analysis["drugs_with_animals"],
                "multi_animal_drugs": analysis["multi_animal_drugs"],
                "animal_counts": dict(analysis["animal_counts"]),
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"\n✓ Analysis saved to: {output_file}")
