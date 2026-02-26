# Attribute Presence Analysis for Prescription Drug Dataset

This document collects the methods used to analyse the contents of
`backend/data/dog_drugs_prescription_only.jsonl` and the resulting
statistics.  The goal was to determine whether information important to
a software architecture (chemical ingredients, drug interactions,
precautions, allergic cautions, disease cautions, etc.) appears
consistently.

## Data structure

Each record in the JSONL file has four fields:

```json
{
  "index": ...,                // sequential identifier
  "product_name": ...,         // drug name (Korean)
  "raw_content": "...",       // full label text from the registry
  "collected_at": "..."      // timestamp
}
```

All of the attributes we care about are embedded in the `raw_content`
string; there are no separate columns for them.

## Analysis methods

Two simple Python scripts were run to scan the file for the presence of
selected Korean keywords.  The first script counted occurrences of
sections that correspond to major headings.  The second script looked for
additional sub‑headers and related terms.

```python
import json
from collections import Counter

path = 'backend/data/dog_drugs_prescription_only.jsonl'
stats = Counter()
total = 0
keywords = ['성분명', '상호작용', '주의사항', '알러', '질병', '금기',
            'DDI', '부작용', '용법용량', '효능효과']

with open(path, encoding='utf-8') as f:
    for line in f:
        total += 1
        rec = json.loads(line)
        txt = rec['raw_content']
        for kw in keywords:
            if kw in txt:
                stats[kw] += 1

print('total records', total)
for kw in keywords:
    print(kw, stats.get(kw, 0))
```

Additional variants such as `원료약품`, `첨가제`, `알레르`, `주의`, and
`성상` were counted similarly.

## Results

The scan over 1 062 prescription‑only records produced the following
counts:

| Keyword       | Interpretation                              | Count | % of records |
|---------------|---------------------------------------------|------:|-------------:|
| 원료약품       | active-ingredient header                     | 1062 | 100 %        |
| 용법용량       | dosage instructions                          | 1062 | 100 %        |
| 효능효과       | indications / efficacy                       | 1062 | 100 %        |
| 주의사항       | precautions / warnings                       | 1062 | 100 %        |
| 성분명         | ingredient name sub‑header                   | 1033 | 97 %         |
| 첨가제         | excipients                                   | 536  | 50 %         |
| 상호작용       | drug–drug interaction                        | 366  | 34 %         |
| 부작용         | adverse effects                              | 626  | 59 %         |
| 알러           | allergy‑related terms                        | 75   | 7 %          |
| 질병           | disease‑related caution                      | 316  | 30 %         |
| 금기           | contraindications                            | 157  | 15 %         |
| DDI            | literal acronym (none were found)            | 0    | 0 %          |

A second scan for `원료약품`, `첨가제`, `알레르`, `주의`, and `성상`
yielded the counts shown above; in particular `원료약품`, `주의`, and
`성상` occur in every record, while `첨가제` appears in about half the
entries.

These frequencies indicate that high‑level sections are reliable, but
many of the finer points (interactions, allergic cautions, etc.) are
optional and vary between products.

## Implications for architecture

1. **Always parse** the `raw_content` string; there is no separate field
   for chemical or precautionary information.
2. **Use the standard headings** (`원료약품`, `효능효과`,
   `용법용량`, `주의사항`, …) as anchors to split content into
   structured blocks.
3. **Expect missing sections**.  Only the major headings appear in all
   records; treat absence of a sub‑heading as "no data provided".
4. **Interactions and allergy warnings** are present but not guaranteed,
   so design your model to handle them conditionally.
5. **DDI** is not used in the raw text; rely on the Korean term
   `상호작용` instead.

## Reproducing the analysis

You can rerun the scripts above against any updated JSONL file.  Place
these snippets into a Python file (e.g. `scripts/analyze_attributes.py`)
and execute with the virtual environment activated.

---

*Generated on 2026‑02‑26 by GitHub Copilot in workspace* `FullStackDemoPractice`.