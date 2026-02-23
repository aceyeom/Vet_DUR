# Vet DUR DDI Engine

Rule-based Drug-Drug Interaction (DDI) engine for veterinary medicine, focused on dogs.

## File Structure

```
ddi_engine/
├── README.md          # This file
├── engine.py          # Main DDI engine code
├── data/
│   └── drugs.json     # All drug data in JSON format
└── db/
    ├── setup.py       # Database setup script
    └── schema.sql     # Database schema
```

## Setup

1. Ensure Docker is installed and running.
2. From project root: `./run.sh`

This will:
- Start the PostgreSQL database container
- Create tables and load seed data from JSON
- Run test cases

## Data Input

All drug data is in `data/drugs.json` as a JSON array of drug objects.

Each drug object contains all attributes:

```json
{
  "id": "D1",
  "inn_name": "enrofloxacin",
  "korean_name": "엔로플록사신",
  "drug_class": "fluoroquinolone",
  "narrow_therapeutic_index": false,
  "metabolism": [
    {
      "cyp_isoenzyme": "1A",
      "role": "substrate",
      "inhibition_strength": null
    }
  ],
  "risk_flags": {
    "qt_prolongation_risk": "moderate",
    "bleeding_risk": "low",
    ...
  },
  "elimination": {
    "renal_percent": 30,
    "hepatic_percent": 70,
    "half_life_dog_hr": 4.5
  },
  "dosing": [
    {
      "species": "dog",
      "min_mg_per_kg": 5,
      "max_mg_per_kg": 20,
      "interval_hr": 24
    }
  ]
}
```

**To add more drugs:**
1. Copy `data/drug_template.json` as a template
2. Fill in the drug data
3. Add the object to the `drugs.json` array
4. Run `./run.sh` to reload the database
5. The engine will automatically use the new data

## Usage

```python
from ddi_engine.engine import check_interaction

result = check_interaction('D2', 'D3', {"species": "dog", "renal_disease": False})
print(result)
```

Returns:
```json
{
  "severity": "moderate",
  "score": 5,
  "triggered_rules": [
    {
      "rule": "CYP_INHIBITION",
      "mechanism": "ketoconazole inhibits CYP3A, increasing levels of prednisolone.",
      "recommendation": "Consider dose reduction or close monitoring."
    }
  ]
}
```

## Rules

1. **CYP Inhibition**: Strong CYP inhibitor + substrate
2. **QT Stacking**: Additive QT prolongation risk
3. **Bleeding Stacking**: High bleeding risk combination
4. **Duplicate NSAID**: Same NSAID class
5. **Renal Risk**: High renal elimination in renal disease patients