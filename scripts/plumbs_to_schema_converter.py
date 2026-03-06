#!/usr/bin/env python3
"""
Convert Plumb's JSONL to normalized database schema JSONL format

Input: plumbs_structured_db.jsonl (raw Plumb's extracts)
Output: One JSONL file per ingredient with normalized table records
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

class PlumbsToSchemaConverter:
    """Convert Plumb's raw JSONL to schema-normalized JSONL"""
    
    def __init__(self):
        self.data_source_id = "{{data_source_id}}"  # Will be replaced with actual UUID during DB insert
    
    def extract_synonyms(self, sections: Dict) -> List[Dict]:
        """Extract drug synonyms from Chemistry/Synonyms section"""
        synonyms = []
        chemistry_key = None
        
        # Find the Chemistry/Synonyms section (key may have extra text)
        for key in sections.keys():
            if 'Chemistry' in key or 'Synonyms' in key:
                chemistry_key = key
                break
        
        if not chemistry_key:
            return synonyms
        
        text = sections[chemistry_key]
        
        # Extract brand names from "may also be known as" section
        pattern = r'may also be known as\s+(.+?)(?:\.|$)'
        matches = re.findall(pattern, text, re.IGNORECASE)
        
        if matches:
            names_text = matches[0]
            # Split by comma or semicolon
            names = re.split(r'[,;]', names_text)
            
            for name in names:
                name = name.strip().replace('®', '').replace('®', '').strip()
                if name and len(name) > 1:
                    # Determine synonym type
                    syn_type = 'brand'
                    if name.startswith('(') or name.startswith('['):
                        syn_type = 'abbreviation'
                    
                    synonyms.append({
                        "substance_id": "{{substance_id}}",
                        "synonym": name,
                        "language": "en",
                        "synonym_type": syn_type
                    })
        
        return synonyms
    
    def extract_pk_parameters(self, ingredient: str, sections: Dict) -> List[Dict]:
        """Extract pharmacokinetic parameters"""
        pk_list = []
        
        if 'Pharmacokinetics' not in sections:
            return pk_list
        
        text = sections['Pharmacokinetics']
        
        # Try to extract species-specific data
        species_data = {
            'dog': {'text': text, 'confidence': 'low'},
            'cat': {'text': text, 'confidence': 'low'},
        }
        
        # Check for bioavailability mentions
        for species in species_data.keys():
            if species.lower() in text.lower():
                pk_list.append({
                    "substance_id": "{{substance_id}}",
                    "species": species,
                    "route": "oral",
                    "pk_confidence": species_data[species]['confidence'],
                    "data_source_id": self.data_source_id
                })
        
        # If no species found, add generic entry
        if not pk_list:
            pk_list.append({
                "substance_id": "{{substance_id}}",
                "species": "dog",
                "route": "all",
                "pk_confidence": "low",
                "data_source_id": self.data_source_id
            })
        
        return pk_list
    
    def extract_adverse_effects(self, sections: Dict) -> Dict:
        """Extract adverse effects to pd_risk_flags"""
        flags = {
            "substance_id": "{{substance_id}}",
            "narrow_therapeutic_index": False,
            "pd_confidence": "medium",
            "data_source_id": self.data_source_id
        }
        
        if 'Adverse Effects' in sections:
            text = sections['Adverse Effects']
            flags['adverse_effects_dog'] = text[:500]  # Store first 500 chars
            flags['adverse_effects_cat'] = text[:500]
            
            # Check for specific risks
            if 'hypoglycemia' in text.lower():
                flags['hypotension'] = 'low'
            if 'gi' in text.lower() or 'diarrhea' in text.lower():
                flags['gi_ulcer_risk'] = 'moderate'
        
        return flags
    
    def extract_drug_interactions(self, sections: Dict) -> List[Dict]:
        """Extract drug-drug interactions"""
        interactions = []
        
        if 'Drug Interactions' not in sections:
            return interactions
        
        text = sections['Drug Interactions']
        
        # Extract bullet points (■ Drug: Description)
        pattern = r'■([^:]+):\s*([^■]+)'
        matches = re.findall(pattern, text)
        
        for drug_name, description in matches:
            drug_name = drug_name.strip()
            description = description.strip()[:200]  # Limit to 200 chars
            
            interactions.append({
                "substance_a_id": "{{interaction_drug_id}}",  # To find and replace
                "substance_b_id": "{{substance_id}}",
                "interaction_type": "pharmacodynamic",
                "severity": "moderate",  # Default
                "mechanism_detail": description,
                "evidence_level": "C",  # Plumb's is secondary source
                "data_source_id": self.data_source_id,
                "_raw_drug_name": drug_name  # For manual review
            })
        
        return interactions
    
    def extract_dosing_rules(self, ingredient: str, sections: Dict) -> List[Dict]:
        """Extract dosing information"""
        dosing_rules = []
        
        if 'Dosages' not in sections:
            return dosing_rules
        
        text = sections['Dosages']
        
        # Parse DOGS: and CATS: sections
        for species_block in re.split(r'(DOGS:|CATS:)', text)[1:]:
            if ':' in species_block:
                continue
            
            species = 'dog' if 'DOG' in text[max(0, text.find(species_block)-10):text.find(species_block)] else 'cat'
            
            # Extract dosing information
            dose_pattern = r'(\d+(?:\.\d+)?)\s*(?:mg/kg|mg|ml)'
            dose_matches = re.findall(dose_pattern, species_block)
            
            if dose_matches:
                for dose in dose_matches[:2]:  # Get min and max
                    dosing_rules.append({
                        "substance_id": "{{substance_id}}",
                        "species": species,
                        "route": "oral",
                        "indication": "treatment",
                        "min_dose": float(dose),
                        "dosing_type": "mg_per_kg",
                        "evidence_level": "C",
                        "data_source_id": self.data_source_id
                    })
        
        return dosing_rules
    
    def extract_contraindications(self, sections: Dict) -> List[Dict]:
        """Extract contraindications"""
        contraindications = []
        
        contra_key = None
        for key in sections.keys():
            if 'Contraindication' in key:
                contra_key = key
                break
        
        if not contra_key:
            return contraindications
        
        text = sections[contra_key]
        
        # Extract conditions (simple approach: split by comma)
        conditions = [c.strip() for c in text.split(',')[:5]]  # First 5 conditions
        
        for condition in conditions:
            if len(condition) > 3:
                contraindications.append({
                    "substance_id": "{{substance_id}}",
                    "condition_name": condition[:100],
                    "clinical_category": "disease",
                    "contraindication_type": "relative",
                    "severity": "major",
                    "data_source_id": self.data_source_id
                })
        
        return contraindications
    
    def extract_therapeutic_class(self, sections: Dict) -> Dict:
        """Extract therapeutic classification"""
        therapeutic_class = {
            "substance_id": "{{substance_id}}",
            "primary_class": "Unknown",
            "data_source_id": self.data_source_id
        }
        
        if 'General Information' in sections:
            text = sections['General Information']
            # Extract drug class from first line
            lines = text.split('\n')
            for line in lines:
                if any(keyword in line for keyword in ['Antagonist', 'Inhibitor', 'Agonist', 'Agent', 'Blocker']):
                    therapeutic_class['primary_class'] = line.strip()
                    break
        
        return therapeutic_class
    
    def extract_literature_chunks(self, ingredient: str, sections: Dict) -> List[Dict]:
        """Extract all text sections as literature chunks for RAG"""
        chunks = []
        chunk_index = 0
        
        for field_name, text in sections.items():
            if not text or len(text) < 10:
                continue
            
            # Split long text into chunks (~500 tokens ≈ 2000 chars)
            chunk_size = 2000
            for i in range(0, len(text), chunk_size):
                chunk_text = text[i:i+chunk_size]
                
                # Normalize field name
                field_group = field_name.lower().replace('/', '_').replace(' ', '_')
                
                chunks.append({
                    "substance_id": "{{substance_id}}",
                    "chunk_index": chunk_index,
                    "chunk_text": chunk_text,
                    "field_group": field_group[:50],
                    "embedding": None,  # To be generated later
                    "used_in_extraction": True,
                    "data_source_id": self.data_source_id
                })
                chunk_index += 1
        
        return chunks
    
    def convert(self, jsonl_record: Dict) -> Dict[str, List[Dict]]:
        """Convert single Plumb's JSONL record to normalized tables"""
        
        ingredient = jsonl_record['ingredient']
        source_file = jsonl_record['source_file']
        sections = jsonl_record['sections']
        
        result = {
            'data_sources': [{
                "source_type": "plumbs",
                "source_name": "Plumb's Veterinary Drug Handbook",
                "source_file": source_file,
                "reliability_tier": 2,
                "accessed_at": datetime.now().isoformat()
            }],
            'substances': [{
                "inn_name": ingredient,
                "korean_name": None,
                "drug_class": "TBD",
                "formulary_status": "active",
                "data_completeness_e1": 0.5,
                "data_completeness_e2": 0.5,
                "data_completeness_e3": 0.5,
                "data_completeness_e4": 0.5,
                "data_completeness_e5": 0.5,
                "pharmacist_reviewed": False,
                "created_at": datetime.now().isoformat()
            }],
            'substance_synonyms': self.extract_synonyms(sections),
            'pk_parameters': self.extract_pk_parameters(ingredient, sections),
            'pd_risk_flags': [self.extract_adverse_effects(sections)],
            'ddi_pairs': self.extract_drug_interactions(sections),
            'dosing_rules': self.extract_dosing_rules(ingredient, sections),
            'contraindications': self.extract_contraindications(sections),
            'therapeutic_classes': [self.extract_therapeutic_class(sections)],
            'literature_chunks': self.extract_literature_chunks(ingredient, sections)
        }
        
        return result


def write_schema_jsonl(data: Dict[str, List[Dict]], ingredient: str, output_path: Path):
    """Write converted data as schema.jsonl format (one table per line)"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        for table_name, records in data.items():
            if records:  # Only write if table has records
                table_entry = {
                    "table_name": table_name,
                    "records": records,
                    "ingredient": ingredient,
                    "record_count": len(records)
                }
                f.write(json.dumps(table_entry, ensure_ascii=False) + '\n')


if __name__ == "__main__":
    # Read source JSONL
    source_file = Path("/workspaces/Vet_DUR/backend/data/plumb_data_temp/split_by_batch_20/0.jsonl")
    output_dir = Path("/workspaces/Vet_DUR/backend/data/plumb_data_temp/converted_schema")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    converter = PlumbsToSchemaConverter()
    
    with open(source_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            try:
                record = json.loads(line.strip())
                ingredient = record['ingredient']
                
                # Convert to schema format
                schema_data = converter.convert(record)
                
                # Write to output file
                output_file = output_dir / f"{ingredient.lower().replace(' ', '_')}.jsonl"
                write_schema_jsonl(schema_data, ingredient, output_file)
                
                print(f"✓ {ingredient} (line {line_num}) → {output_file.name}")
                
                # Print summary
                total_records = sum(len(v) for v in schema_data.values())
                print(f"  Total records: {total_records}")
                for table, records in schema_data.items():
                    if records:
                        print(f"    - {table}: {len(records)} records")
                print()
                
            except json.JSONDecodeError as e:
                print(f"Error parsing line {line_num}: {e}")
            except Exception as e:
                print(f"Error processing line {line_num}: {e}")
    
    print("=" * 60)
    print("✓ Conversion completed!")
    print(f"Output directory: {output_dir}")
    print(f"Files created: {len(list(output_dir.glob('*.jsonl')))}")
