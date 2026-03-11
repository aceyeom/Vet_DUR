/**
 * Comprehensive Veterinary Drug Database
 * Covers 6 pipeline cases:
 *   1. Korean approved vet drugs
 *   2. Human drugs used off-label in veterinary medicine
 *   3. Foreign drugs (not Korean-approved)
 *   4. Unknown drugs (placeholder entries)
 *   5. Multi-drug combination support (via pairwise interaction matrix)
 *   6. Species-specific adjustments (dog vs cat)
 */

// Drug classification flags
export const DRUG_SOURCE = {
  KR_VET: 'kr_vet',           // Korean-approved veterinary drug
  HUMAN_OFFLABEL: 'human_offlabel', // Human drug used off-label
  FOREIGN: 'foreign',         // Foreign-approved, not in Korean DB
  UNKNOWN: 'unknown',         // Not in any database
};

export const DRUG_CLASS = {
  NSAID: 'NSAID',
  CORTICOSTEROID: 'Corticosteroid',
  ANTIBIOTIC: 'Antibiotic',
  ANTIPARASITIC: 'Antiparasitic',
  ANTIFUNGAL: 'Antifungal',
  ANALGESIC: 'Analgesic',
  CARDIAC: 'Cardiac',
  DIURETIC: 'Diuretic',
  SEDATIVE: 'Sedative',
  ANTIEMETIC: 'Antiemetic',
  GI_PROTECTANT: 'GI Protectant',
  ANTICONVULSANT: 'Anticonvulsant',
  ANTIDEPRESSANT: 'Antidepressant',
  ACE_INHIBITOR: 'ACE Inhibitor',
  BRONCHODILATOR: 'Bronchodilator',
  IMMUNOSUPPRESSANT: 'Immunosuppressant',
  THYROID: 'Thyroid',
  HORMONE: 'Hormone',
};

const RAW_DRUG_DATABASE = [
  // ── Korean Approved Veterinary Drugs ──────────────────────────
  {
    id: 'meloxicam',
    name: 'Meloxicam',
    nameKr: '멜록시캄',
    activeSubstance: 'Meloxicam',
    class: DRUG_CLASS.NSAID,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 0.1, cat: 0.05 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP2C9'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'moderate', hepatotoxic: 'low', qtProlongation: 'none', bleedingRisk: 'high', giUlcer: 'high' },
    renalElimination: 0.15,
    pk: { halfLife: 24, timeToPeak: 7.5, bioavailability: 0.89, proteinBinding: 0.97, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Standard NSAID for canine use. Monitor renal function.',
      cat: 'Use with extreme caution. Single dose only unless chronic low-dose protocol. Cats have limited glucuronidation capacity.'
    },
    contraindications: ['Renal disease', 'GI ulceration', 'Coagulopathy'],
  },
  {
    id: 'carprofen',
    name: 'Carprofen',
    nameKr: '카프로펜',
    activeSubstance: 'Carprofen',
    class: DRUG_CLASS.NSAID,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 4.4, cat: null },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'moderate', hepatotoxic: 'moderate', qtProlongation: 'none', bleedingRisk: 'high', giUlcer: 'high' },
    renalElimination: 0.10,
    pk: { halfLife: 8, timeToPeak: 3, bioavailability: 0.90, proteinBinding: 0.99, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Well-tolerated NSAID in dogs. Periodic hepatic monitoring recommended.',
      cat: 'Not recommended for cats. Limited safety data.'
    },
    contraindications: ['Renal disease', 'Hepatic disease', 'GI ulceration'],
  },
  {
    id: 'prednisolone',
    name: 'Prednisolone',
    nameKr: '프레드니솔론',
    activeSubstance: 'Prednisolone',
    class: DRUG_CLASS.CORTICOSTEROID,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 1.0, cat: 1.0 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'low', hepatotoxic: 'low', qtProlongation: 'none', bleedingRisk: 'moderate', giUlcer: 'moderate' },
    renalElimination: 0.20,
    pk: { halfLife: 3, timeToPeak: 1.5, bioavailability: 0.82, proteinBinding: 0.90, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Widely used anti-inflammatory/immunosuppressive. Taper dose gradually.',
      cat: 'Preferred over prednisone in cats due to limited hepatic conversion.'
    },
    contraindications: ['Diabetes mellitus', 'Active infection', 'GI ulceration'],
  },
  {
    id: 'metronidazole',
    name: 'Metronidazole',
    nameKr: '메트로니다졸',
    activeSubstance: 'Metronidazole',
    class: DRUG_CLASS.ANTIBIOTIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 15, cat: 10 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: true,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: ['CYP2C9'], inducer: [] },
    riskFlags: { nephrotoxic: 'low', hepatotoxic: 'moderate', qtProlongation: 'none', bleedingRisk: 'low', giUlcer: 'low' },
    renalElimination: 0.20,
    pk: { halfLife: 4.5, timeToPeak: 1, bioavailability: 0.80, proteinBinding: 0.20, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Effective against anaerobic infections and Giardia. Neurotoxicity at high doses.',
      cat: 'Use lower doses in cats. Risk of neurotoxicity — monitor for ataxia, nystagmus.'
    },
    contraindications: ['Hepatic disease', 'Pregnancy', 'Neurological disorders'],
  },
  {
    id: 'amoxicillin',
    name: 'Amoxicillin',
    nameKr: '아목시실린',
    activeSubstance: 'Amoxicillin',
    class: DRUG_CLASS.ANTIBIOTIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 15, cat: 15 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'none', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'low' },
    renalElimination: 0.60,
    pk: { halfLife: 1.2, timeToPeak: 1, bioavailability: 0.80, proteinBinding: 0.17, primaryElimination: 'renal' },
    speciesNotes: {
      dog: 'Broad-spectrum beta-lactam. Adjust dose in renal impairment.',
      cat: 'Well tolerated. Common choice for upper respiratory infections.'
    },
    contraindications: ['Penicillin allergy'],
    allergyClass: 'beta-lactam',
  },
  {
    id: 'enrofloxacin',
    name: 'Enrofloxacin',
    nameKr: '엔로플록사신',
    activeSubstance: 'Enrofloxacin',
    class: DRUG_CLASS.ANTIBIOTIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 5, cat: 5 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP1A2'], inhibitor: ['CYP1A2'], inducer: [] },
    riskFlags: { nephrotoxic: 'low', hepatotoxic: 'low', qtProlongation: 'moderate', bleedingRisk: 'none', giUlcer: 'low' },
    renalElimination: 0.30,
    pk: { halfLife: 4, timeToPeak: 2, bioavailability: 0.80, proteinBinding: 0.27, primaryElimination: 'mixed' },
    speciesNotes: {
      dog: 'Fluoroquinolone antibiotic. Avoid in growing animals — cartilage damage risk.',
      cat: 'Do NOT exceed 5 mg/kg/day in cats — risk of acute retinal degeneration and blindness.'
    },
    contraindications: ['Growing animals', 'Seizure disorders'],
  },
  {
    id: 'ivermectin',
    name: 'Ivermectin',
    nameKr: '이버멕틴',
    activeSubstance: 'Ivermectin',
    class: DRUG_CLASS.ANTIPARASITIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 0.006, cat: 0.024 },
    unit: 'mg/kg',
    freq: 'Monthly',
    route: 'PO',
    narrowTherapeuticIndex: true,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.02,
    pk: { halfLife: 25, timeToPeak: 4, bioavailability: 0.95, proteinBinding: 0.93, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'CRITICAL: Contraindicated in MDR1-mutant breeds (Collies, Shelties, Australian Shepherds). Use selamectin instead.',
      cat: 'Use with caution. Narrow margin of safety in cats.'
    },
    contraindications: ['MDR1 mutation'],
    mdr1Sensitive: true,
  },
  {
    id: 'selamectin',
    name: 'Selamectin',
    nameKr: '셀라멕틴',
    activeSubstance: 'Selamectin',
    class: DRUG_CLASS.ANTIPARASITIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 6, cat: 6 },
    unit: 'mg/kg',
    freq: 'Monthly',
    route: 'Topical',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'none', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.01,
    pk: { halfLife: 264, timeToPeak: 72, bioavailability: 0.62, proteinBinding: 0.98, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Safe alternative for MDR1-mutant breeds. Broad-spectrum parasite coverage.',
      cat: 'Well-tolerated topical parasiticide for cats.'
    },
    contraindications: [],
  },
  {
    id: 'ketoconazole',
    name: 'Ketoconazole',
    nameKr: '케토코나졸',
    activeSubstance: 'Ketoconazole',
    class: DRUG_CLASS.ANTIFUNGAL,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 10, cat: 5 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: ['CYP3A4'], inducer: [] },
    riskFlags: { nephrotoxic: 'low', hepatotoxic: 'high', qtProlongation: 'moderate', bleedingRisk: 'none', giUlcer: 'moderate' },
    renalElimination: 0.10,
    pk: { halfLife: 6, timeToPeak: 2, bioavailability: 0.50, proteinBinding: 0.99, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Potent CYP3A4 inhibitor. Monitor hepatic enzymes monthly.',
      cat: 'Use with caution in cats. Higher risk of hepatotoxicity.'
    },
    contraindications: ['Hepatic disease'],
  },
  {
    id: 'furosemide',
    name: 'Furosemide',
    nameKr: '푸로세미드',
    activeSubstance: 'Furosemide',
    class: DRUG_CLASS.DIURETIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 2, cat: 1 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'moderate', hepatotoxic: 'none', qtProlongation: 'low', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.80,
    pk: { halfLife: 1.5, timeToPeak: 1, bioavailability: 0.77, proteinBinding: 0.91, primaryElimination: 'renal' },
    electrolyteEffect: 'k_depleting',
    speciesNotes: {
      dog: 'Loop diuretic for CHF and edema. Monitor electrolytes and hydration.',
      cat: 'Effective in feline CHF. Watch for dehydration and hypokalemia.'
    },
    contraindications: ['Severe dehydration', 'Anuria'],
  },
  {
    id: 'digoxin',
    name: 'Digoxin',
    nameKr: '디곡신',
    activeSubstance: 'Digoxin',
    class: DRUG_CLASS.CARDIAC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 0.005, cat: 0.005 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: true,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'low', hepatotoxic: 'low', qtProlongation: 'high', bleedingRisk: 'none', giUlcer: 'low' },
    renalElimination: 0.70,
    pk: { halfLife: 27, timeToPeak: 2, bioavailability: 0.60, proteinBinding: 0.25, primaryElimination: 'renal' },
    speciesNotes: {
      dog: 'Narrow therapeutic index. Therapeutic drug monitoring essential. Toxicity risk with hypokalemia.',
      cat: 'Rarely used in cats. Very narrow margin of safety.'
    },
    contraindications: ['Hypokalemia', 'Renal disease', 'AV block'],
  },
  {
    id: 'enalapril',
    name: 'Enalapril',
    nameKr: '에날라프릴',
    activeSubstance: 'Enalapril',
    class: DRUG_CLASS.ACE_INHIBITOR,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 0.5, cat: 0.5 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'low', hepatotoxic: 'none', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.60,
    pk: { halfLife: 11, timeToPeak: 4, bioavailability: 0.60, proteinBinding: 0.50, primaryElimination: 'renal' },
    speciesNotes: {
      dog: 'First-line for canine CHF and proteinuria. Monitor renal values.',
      cat: 'Used for feline hypertension and cardiac disease.'
    },
    contraindications: ['Bilateral renal artery stenosis'],
  },
  {
    id: 'gabapentin',
    name: 'Gabapentin',
    nameKr: '가바펜틴',
    activeSubstance: 'Gabapentin',
    class: DRUG_CLASS.ANALGESIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 10, cat: 5 },
    unit: 'mg/kg',
    freq: 'TID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'none', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.80,
    pk: { halfLife: 3.5, timeToPeak: 2, bioavailability: 0.80, proteinBinding: 0.03, primaryElimination: 'renal' },
    speciesNotes: {
      dog: 'Adjunct analgesic for neuropathic pain. Sedation common at higher doses.',
      cat: 'Effective anxiolytic and analgesic. Commonly used pre-visit. Adjust dose in renal impairment.'
    },
    contraindications: [],
  },
  {
    id: 'tramadol',
    name: 'Tramadol',
    nameKr: '트라마돌',
    activeSubstance: 'Tramadol',
    class: DRUG_CLASS.ANALGESIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 5, cat: 2 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP2D6', 'CYP3A4'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'low', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.30,
    pk: { halfLife: 1.8, timeToPeak: 1.5, bioavailability: 0.65, proteinBinding: 0.20, primaryElimination: 'hepatic' },
    serotoninSyndromeRisk: true,
    speciesNotes: {
      dog: 'Weak opioid analgesic. Dogs poorly metabolize to active M1 metabolite — limited efficacy.',
      cat: 'More effective in cats than dogs due to better CYP2D6 metabolism.'
    },
    contraindications: ['Seizure disorders', 'MAO inhibitor use'],
  },
  {
    id: 'maropitant',
    name: 'Maropitant (Cerenia)',
    nameKr: '마로피탄트',
    activeSubstance: 'Maropitant',
    class: DRUG_CLASS.ANTIEMETIC,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 2, cat: 1 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP3A4', 'CYP2D6'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.10,
    pk: { halfLife: 7.5, timeToPeak: 2, bioavailability: 0.37, proteinBinding: 0.99, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'NK1 receptor antagonist. Effective for motion sickness and chemotherapy-induced vomiting.',
      cat: 'Approved for cats. Effective antiemetic for various causes.'
    },
    contraindications: [],
  },
  {
    id: 'omeprazole',
    name: 'Omeprazole',
    nameKr: '오메프라졸',
    activeSubstance: 'Omeprazole',
    class: DRUG_CLASS.GI_PROTECTANT,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 1, cat: 1 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP2C19', 'CYP3A4'], inhibitor: ['CYP2C19'], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.20,
    pk: { halfLife: 1, timeToPeak: 0.5, bioavailability: 0.50, proteinBinding: 0.95, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Proton pump inhibitor. Effective gastroprotection when using NSAIDs.',
      cat: 'Effective in cats. Give 30 min before food for optimal absorption.'
    },
    contraindications: [],
  },

  // ── Human Drugs Used Off-Label ────────────────────────────────
  {
    id: 'trazodone',
    name: 'Trazodone',
    nameKr: '트라조돈',
    activeSubstance: 'Trazodone',
    class: DRUG_CLASS.SEDATIVE,
    source: DRUG_SOURCE.HUMAN_OFFLABEL,
    offLabelNote: 'Human antidepressant used off-label as veterinary anxiolytic/sedative.',
    defaultDose: { dog: 5, cat: 3 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'moderate', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.10,
    pk: { halfLife: 7, timeToPeak: 1.5, bioavailability: 0.65, proteinBinding: 0.92, primaryElimination: 'hepatic' },
    serotoninSyndromeRisk: true,
    speciesNotes: {
      dog: 'Off-label sedative. Effective for anxiety and post-surgical rest. Serotonin syndrome risk with tramadol.',
      cat: 'Off-label use. Limited safety data in cats. Start with low dose.'
    },
    contraindications: ['MAO inhibitor use', 'Serotonergic drugs'],
  },
  {
    id: 'amlodipine',
    name: 'Amlodipine',
    nameKr: '암로디핀',
    activeSubstance: 'Amlodipine',
    class: DRUG_CLASS.CARDIAC,
    source: DRUG_SOURCE.HUMAN_OFFLABEL,
    offLabelNote: 'Human calcium channel blocker used off-label for feline hypertension.',
    defaultDose: { dog: 0.1, cat: 0.625 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'low', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.10,
    pk: { halfLife: 30, timeToPeak: 6, bioavailability: 0.88, proteinBinding: 0.93, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Off-label for systemic hypertension. Less commonly used in dogs.',
      cat: 'First-line antihypertensive for cats. Effective and well-tolerated.'
    },
    contraindications: ['Severe aortic stenosis'],
  },
  {
    id: 'fluoxetine',
    name: 'Fluoxetine',
    nameKr: '플루옥세틴',
    activeSubstance: 'Fluoxetine',
    class: DRUG_CLASS.ANTIDEPRESSANT,
    source: DRUG_SOURCE.HUMAN_OFFLABEL,
    offLabelNote: 'Human SSRI used off-label for behavioral disorders in dogs and cats.',
    defaultDose: { dog: 1, cat: 0.5 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP2D6'], inhibitor: ['CYP2D6', 'CYP3A4'], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'low', bleedingRisk: 'low', giUlcer: 'none' },
    renalElimination: 0.15,
    pk: { halfLife: 48, timeToPeak: 6, bioavailability: 0.72, proteinBinding: 0.95, primaryElimination: 'hepatic' },
    serotoninSyndromeRisk: true,
    speciesNotes: {
      dog: 'Off-label for separation anxiety, compulsive disorders. Takes 4-6 weeks for full effect.',
      cat: 'Off-label for urine marking and anxiety disorders. Start low.'
    },
    contraindications: ['MAO inhibitor use', 'Seizure disorders'],
  },
  {
    id: 'methimazole',
    name: 'Methimazole',
    nameKr: '메티마졸',
    activeSubstance: 'Methimazole',
    class: DRUG_CLASS.THYROID,
    source: DRUG_SOURCE.HUMAN_OFFLABEL,
    offLabelNote: 'Human antithyroid drug. Standard treatment for feline hyperthyroidism.',
    defaultDose: { dog: null, cat: 2.5 },
    unit: 'mg (total)',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: true,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'low', hepatotoxic: 'moderate', qtProlongation: 'none', bleedingRisk: 'low', giUlcer: 'moderate' },
    renalElimination: 0.50,
    pk: { halfLife: 5, timeToPeak: 1, bioavailability: 0.93, proteinBinding: 0.0, primaryElimination: 'mixed' },
    speciesNotes: {
      dog: 'Not typically used in dogs.',
      cat: 'Standard therapy for feline hyperthyroidism. Monitor CBC and liver enzymes biweekly initially.'
    },
    contraindications: ['Hepatic disease', 'Thrombocytopenia'],
  },
  {
    id: 'cyclosporine',
    name: 'Cyclosporine (Atopica)',
    nameKr: '사이클로스포린',
    activeSubstance: 'Cyclosporine',
    class: DRUG_CLASS.IMMUNOSUPPRESSANT,
    source: DRUG_SOURCE.HUMAN_OFFLABEL,
    offLabelNote: 'Human immunosuppressant used off-label for atopic dermatitis and immune-mediated diseases.',
    defaultDose: { dog: 5, cat: 7 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: true,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'moderate', hepatotoxic: 'moderate', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'moderate' },
    renalElimination: 0.05,
    pk: { halfLife: 18, timeToPeak: 2, bioavailability: 0.35, proteinBinding: 0.98, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Off-label for atopic dermatitis and IMHA. GI side effects common initially. Ketoconazole often co-administered to reduce dose.',
      cat: 'Off-label for feline allergic dermatitis and stomatitis. Test for FeLV/FIV before use.'
    },
    contraindications: ['Active infection', 'Neoplasia'],
  },

  // ── Foreign Drugs ─────────────────────────────────────────────
  {
    id: 'firocoxib',
    name: 'Firocoxib (Previcox)',
    nameKr: null,
    activeSubstance: 'Firocoxib',
    class: DRUG_CLASS.NSAID,
    source: DRUG_SOURCE.FOREIGN,
    foreignNote: 'FDA-approved (USA). Not registered in Korean veterinary formulary.',
    defaultDose: { dog: 5, cat: null },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP2C9'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'moderate', hepatotoxic: 'low', qtProlongation: 'none', bleedingRisk: 'moderate', giUlcer: 'moderate' },
    renalElimination: 0.15,
    pk: { halfLife: 7.8, timeToPeak: 1.5, bioavailability: 0.37, proteinBinding: 0.96, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'COX-2 selective NSAID. Lower GI risk than non-selective NSAIDs.',
      cat: 'Not approved for cats. Insufficient safety data.'
    },
    contraindications: ['Renal disease', 'GI ulceration'],
  },
  {
    id: 'pimobendan',
    name: 'Pimobendan (Vetmedin)',
    nameKr: null,
    activeSubstance: 'Pimobendan',
    class: DRUG_CLASS.CARDIAC,
    source: DRUG_SOURCE.FOREIGN,
    foreignNote: 'Widely used globally. Limited availability in Korean veterinary market.',
    defaultDose: { dog: 0.25, cat: 0.25 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'moderate', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.05,
    pk: { halfLife: 0.5, timeToPeak: 1, bioavailability: 0.60, proteinBinding: 0.93, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Inodilator for CHF. Administer on empty stomach, 1 hour before food.',
      cat: 'Increasingly used in feline HCM with CHF. Limited data but promising.'
    },
    contraindications: ['Hypertrophic obstructive cardiomyopathy (without CHF)'],
  },
  {
    id: 'oclacitinib',
    name: 'Oclacitinib (Apoquel)',
    nameKr: null,
    activeSubstance: 'Oclacitinib',
    class: DRUG_CLASS.IMMUNOSUPPRESSANT,
    source: DRUG_SOURCE.FOREIGN,
    foreignNote: 'Manufactured by Zoetis (USA). Approved in multiple countries but limited in Korea.',
    defaultDose: { dog: 0.6, cat: null },
    unit: 'mg/kg',
    freq: 'BID (14d) then SID',
    route: 'PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'low', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'low' },
    renalElimination: 0.30,
    pk: { halfLife: 4.1, timeToPeak: 1, bioavailability: 0.89, proteinBinding: 0.70, primaryElimination: 'mixed' },
    speciesNotes: {
      dog: 'JAK inhibitor for allergic pruritus. Do not use in dogs <12 months or with serious infections.',
      cat: 'Not approved for cats. Limited safety data.'
    },
    contraindications: ['Dogs under 12 months', 'Serious infections', 'Neoplasia'],
  },
  {
    id: 'phenobarbital',
    name: 'Phenobarbital',
    nameKr: '페노바르비탈',
    activeSubstance: 'Phenobarbital',
    class: DRUG_CLASS.ANTICONVULSANT,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 2.5, cat: 2 },
    unit: 'mg/kg',
    freq: 'BID',
    route: 'PO',
    narrowTherapeuticIndex: true,
    cypProfile: { substrate: ['CYP2C19'], inhibitor: [], inducer: ['CYP3A4', 'CYP2C9'] },
    riskFlags: { nephrotoxic: 'none', hepatotoxic: 'high', qtProlongation: 'none', bleedingRisk: 'none', giUlcer: 'none' },
    renalElimination: 0.25,
    pk: { halfLife: 52, timeToPeak: 4, bioavailability: 0.86, proteinBinding: 0.45, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'First-line anticonvulsant. Therapeutic drug monitoring required. Monitor liver enzymes.',
      cat: 'Effective in cats but shorter half-life — may need higher frequency.'
    },
    contraindications: ['Severe hepatic disease'],
  },
  {
    id: 'dexamethasone',
    name: 'Dexamethasone',
    nameKr: '덱사메타손',
    activeSubstance: 'Dexamethasone',
    class: DRUG_CLASS.CORTICOSTEROID,
    source: DRUG_SOURCE.KR_VET,
    defaultDose: { dog: 0.1, cat: 0.1 },
    unit: 'mg/kg',
    freq: 'SID',
    route: 'IV/PO',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: ['CYP3A4'], inhibitor: [], inducer: ['CYP3A4'] },
    riskFlags: { nephrotoxic: 'low', hepatotoxic: 'low', qtProlongation: 'none', bleedingRisk: 'moderate', giUlcer: 'high' },
    renalElimination: 0.10,
    pk: { halfLife: 2, timeToPeak: 1, bioavailability: 0.78, proteinBinding: 0.77, primaryElimination: 'hepatic' },
    speciesNotes: {
      dog: 'Potent glucocorticoid (7x prednisolone). Short-term use preferred. GI ulceration risk.',
      cat: 'Effective but immunosuppressive. Risk of diabetes with chronic use.'
    },
    contraindications: ['Diabetes mellitus', 'Active GI ulceration', 'Systemic fungal infection'],
  },
];

function inferDosageForm(route) {
  const r = String(route || '').toUpperCase();
  if (r.includes('IV') || r.includes('SC') || r.includes('IM')) return 'Inj';
  if (r.includes('TOP')) return 'Oint';
  return 'Tab';
}

function inferSeverityFromText(term) {
  const value = String(term || '').toLowerCase();
  if (value.includes('anuria') || value.includes('mdr1') || value.includes('fungal')) return 'absolute';
  if (value.includes('renal') || value.includes('hepatic') || value.includes('pregnancy')) return 'relative';
  return 'caution';
}

function inferActionFromSeverity(severity) {
  if (severity === 'absolute') return 'contraindicated';
  if (severity === 'relative') return 'reduce_dose';
  return 'monitor';
}

function buildContraindicationRules(terms = []) {
  return terms.map((term) => {
    const severity = inferSeverityFromText(term);
    return {
      condition: term,
      matchTerms: [String(term).toLowerCase()],
      severity,
      action: inferActionFromSeverity(severity),
      labTrigger: null,
    };
  });
}

function normalizeDrugEntry(drug) {
  const contraindicationTerms = Array.isArray(drug.contraindications) ? drug.contraindications : [];
  const renal = Number(drug.renalElimination) || 0;
  const hepatic = Number(drug.hepaticElimination ?? Math.max(1 - renal, 0));

  // Build doseRange from DOSE_RANGES constant defined in DrugInput,
  // or fall back to single-point defaultDose. This mirrors the backend's doseRange field.
  const EMBEDDED_DOSE_RANGES = {
    carprofen:    { dog: [2.2, 4.4], cat: null },
    meloxicam:    { dog: [0.1, 0.2], cat: [0.05, 0.05] },
    prednisolone: { dog: [0.5, 2.0], cat: [0.5, 2.0] },
    metronidazole:{ dog: [10, 25],   cat: [8, 15] },
    amoxicillin:  { dog: [10, 20],   cat: [10, 20] },
    enrofloxacin: { dog: [5, 10],    cat: [5, 5] },
    gabapentin:   { dog: [5, 10],    cat: [5, 10] },
    tramadol:     { dog: [2, 5],     cat: [2, 4] },
    phenobarbital:{ dog: [2, 5],     cat: [2, 4] },
    cyclosporine: { dog: [5, 10],    cat: [5, 7.5] },
    furosemide:   { dog: [1, 4],     cat: [1, 2] },
    ketoconazole: { dog: [5, 10],    cat: [5, 10] },
    maropitant:   { dog: [1, 2],     cat: [1, 1] },
    omeprazole:   { dog: [0.7, 1],   cat: [0.7, 1] },
  };
  const doseRangeEntry = EMBEDDED_DOSE_RANGES[drug.id] || {};
  const doseRange = {
    dog: doseRangeEntry.dog ?? (drug.defaultDose?.dog != null ? [drug.defaultDose.dog, drug.defaultDose.dog] : null),
    cat: doseRangeEntry.cat ?? (drug.defaultDose?.cat != null ? [drug.defaultDose.cat, drug.defaultDose.cat] : null),
  };

  return {
    ...drug,
    doseRange,
    brandNames: drug.brandNames || [drug.nameKr, drug.name].filter(Boolean),
    dosageForm: drug.dosageForm || inferDosageForm(drug.route),
    availableStrengths: drug.availableStrengths || [],
    washoutPeriod_days: drug.washoutPeriod_days || Math.max(1, Math.round((drug.pk?.halfLife || 24) * 5 / 24)),
    speciesContraindicated: drug.speciesContraindicated || [],
    organBurdenWeight: drug.organBurdenWeight || { renal, hepatic },
    additiveRiskWith: drug.additiveRiskWith || {
      nephrotoxic: ['high', 'moderate'].includes(drug.riskFlags?.nephrotoxic),
      hepatotoxic: ['high', 'moderate'].includes(drug.riskFlags?.hepatotoxic),
      gi_ulcer: ['high', 'moderate'].includes(drug.riskFlags?.giUlcer),
      sedation: drug.class === DRUG_CLASS.SEDATIVE,
      bleeding: ['high', 'moderate'].includes(drug.riskFlags?.bleedingRisk),
      qt_prolongation: ['high', 'moderate'].includes(drug.riskFlags?.qtProlongation),
    },
    renalDoseAdjustment: drug.renalDoseAdjustment || {
      creatinine_threshold_dog: 2.5,
      creatinine_threshold_cat: 1.8,
      adjustment_type: renal >= 0.6 ? 'reduce_dose' : 'monitor',
      adjustment_factor: renal >= 0.6 ? 0.5 : 1,
      note: renal >= 0.6 ? 'Renal elimination burden is high. Consider dose reduction or interval extension.' : 'Standard renal monitoring advised.',
    },
    hepaticDoseAdjustment: drug.hepaticDoseAdjustment || {
      applies: Boolean(drug.narrowTherapeuticIndex && drug.pk?.primaryElimination === 'hepatic'),
      alt_threshold_multiplier: 3,
      adjustment_type: drug.narrowTherapeuticIndex ? 'monitor' : 'reduce_dose',
      note: 'If ALT rises above threshold, consider dose reduction and closer hepatic monitoring.',
    },
    contraindicationTerms,
    contraindications: buildContraindicationRules(contraindicationTerms),
  };
}

export const DRUG_DATABASE = RAW_DRUG_DATABASE.map(normalizeDrugEntry);

// Search function for drug lookup
export function searchDrugs(query, species = null) {
  if (!query || query.trim().length < 1) return [];
  const q = query.toLowerCase().trim();

  return DRUG_DATABASE.filter(drug => {
    const nameMatch = drug.name.toLowerCase().includes(q) ||
      drug.activeSubstance.toLowerCase().includes(q) ||
      (drug.nameKr && drug.nameKr.includes(q));

    if (!nameMatch) return false;

    // If species filter is applied, exclude drugs with null dose for that species
    if (species && drug.defaultDose[species] === null) return false;

    return true;
  });
}

// Get drug by ID
export function getDrugById(id) {
  return DRUG_DATABASE.find(d => d.id === id);
}

// Build an "unknown drug" placeholder
export function createUnknownDrug(name, activeIngredient = null) {
  return normalizeDrugEntry({
    id: `unknown_${Date.now()}`,
    name: name,
    nameKr: null,
    activeSubstance: activeIngredient || 'Unknown',
    class: 'Unknown',
    source: DRUG_SOURCE.UNKNOWN,
    unknownNote: 'This drug was not found in any database. Interaction data is limited. Results are based on the active ingredient if provided, or general pharmacological class matching.',
    defaultDose: { dog: null, cat: null },
    unit: 'mg/kg',
    freq: 'Unknown',
    route: 'Unknown',
    narrowTherapeuticIndex: false,
    cypProfile: { substrate: [], inhibitor: [], inducer: [] },
    riskFlags: { nephrotoxic: 'unknown', hepatotoxic: 'unknown', qtProlongation: 'unknown', bleedingRisk: 'unknown', giUlcer: 'unknown' },
    renalElimination: null,
    pk: null,
    speciesNotes: {
      dog: 'No veterinary data available for this drug.',
      cat: 'No veterinary data available for this drug.'
    },
    contraindications: [],
  });
}
