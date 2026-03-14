/**
 * Common Drugs Frequency List
 *
 * Drugs commonly prescribed in Korean small animal veterinary clinics.
 * Used as a ranking boost in drug search — drugs on this list appear above
 * equally-matching drugs not on the list.
 *
 * Search ranking order:
 *  1. Exact name match (top)
 *  2. Common drugs list + partial name match
 *  3. Non-common drugs + partial name match
 *  4. Class or ingredient match (bottom)
 */

export const COMMON_DRUG_IDS: ReadonlyArray<string> = [
  // NSAIDs
  'meloxicam',
  'carprofen',
  'robenacoxib',
  'tolfenamic_acid',

  // Antibiotics
  'amoxicillin',
  'amoxicillin_clavulanate',
  'doxycycline',
  'enrofloxacin',
  'metronidazole',
  'trimethoprim_sulfamethoxazole',
  'marbofloxacin',

  // GI
  'metoclopramide',
  'maropitant',
  'omeprazole',
  'sucralfate',
  'famotidine',

  // Corticosteroids
  'prednisolone',
  'dexamethasone',
  'methylprednisolone',

  // Antiparasitics
  'ivermectin',
  'milbemycin',
  'fenbendazole',

  // Cardiac
  'enalapril',
  'benazepril',
  'furosemide',
  'atenolol',
  'pimobendan',
  'spironolactone',

  // Sedation / anesthesia
  'acepromazine',
  'medetomidine',
  'ketamine',
  'propofol',
  'butorphanol',

  // Anticonvulsants
  'phenobarbital',
  'potassium_bromide',
  'levetiracetam',

  // Thyroid
  'methimazole',
  'levothyroxine',

  // Other common
  'tramadol',
  'gabapentin',
  'cyclosporine',
  'oclacitinib',
] as const;

/** Quick lookup set for O(1) membership tests */
export const COMMON_DRUG_SET = new Set<string>(COMMON_DRUG_IDS);

/** Top 15 common drugs for the "Frequently prescribed" empty-state chips */
export const TOP_15_COMMON: ReadonlyArray<string> = COMMON_DRUG_IDS.slice(0, 15);

/**
 * Sort a list of Drug objects using the frequency-tier ranking:
 *  1. exact name match  (score 100)
 *  2. common list match (score 50)
 *  3. other drugs       (score 0)
 *
 * @param drugs     Array of drug objects (must have .id, .name, .nameKr)
 * @param query     The current search string (may be empty)
 */
export function rankDrugs<T extends { id: string; name: string; nameKr?: string }>(
  drugs: ReadonlyArray<T>,
  query: string,
): T[] {
  const q = query.trim().toLowerCase();

  const score = (d: T): number => {
    const nameEn = d.name?.toLowerCase() ?? '';
    const nameKo = d.nameKr?.toLowerCase() ?? '';
    const id = d.id?.toLowerCase() ?? '';

    if (q && (nameEn === q || nameKo === q || id === q)) return 100;
    if (COMMON_DRUG_SET.has(id)) return 50;
    return 0;
  };

  return [...drugs].sort((a, b) => score(b) - score(a));
}
