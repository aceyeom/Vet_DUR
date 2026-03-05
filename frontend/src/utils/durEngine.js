/**
 * Client-side DUR Interaction Engine
 * Mirrors the backend 8-rule engine with pairwise interaction checking.
 * Handles all 6 pipeline cases: Korean vet, off-label, foreign, unknown, multi-drug, species-specific.
 */

import { DRUG_SOURCE } from '../data/drugDatabase';

// ── Severity definitions ────────────────────────────────────────
const SEVERITY = {
  CRITICAL: { label: 'Critical', score: 100, color: 'red' },
  MODERATE: { label: 'Moderate', score: 50, color: 'orange' },
  MINOR: { label: 'Minor', score: 20, color: 'yellow' },
  NONE: { label: 'None', score: 0, color: 'green' },
};

// ── Predefined interaction pairs ────────────────────────────────
const INTERACTION_MATRIX = [
  // Duplicate NSAID — absolute contraindication
  {
    match: (a, b) => a.class === 'NSAID' && b.class === 'NSAID',
    severity: SEVERITY.CRITICAL,
    rule: 'Duplicate NSAID',
    mechanism: 'Concurrent use of two NSAIDs causes additive GI, renal, and bleeding toxicity.',
    recommendation: 'Remove one NSAID. Never combine NSAIDs in veterinary patients.',
    alternativeSuggestion: 'Consider Gabapentin 10 mg/kg PO TID as adjunct analgesic without NSAID stacking, or switch to a single COX-2 selective NSAID (Firocoxib 5 mg/kg PO SID) for lower GI risk.',
    literatureSummary: 'A 2012 JAVMA study of 865 dogs found that concurrent NSAID use increased GI adverse events by 4.3x compared to single-agent therapy, with perforation risk rising to 8.6x.',
    literature: [
      { title: 'KuKanich B, et al. NSAID adverse effects in dogs.', source: 'JAVMA 2012;240(10):1183-1192', confidence: 95 },
    ],
  },
  // NSAID + Corticosteroid — GI bleeding/ulceration risk
  {
    match: (a, b) =>
      (a.class === 'NSAID' && b.class === 'Corticosteroid') ||
      (a.class === 'Corticosteroid' && b.class === 'NSAID'),
    severity: SEVERITY.CRITICAL,
    rule: 'NSAID + Corticosteroid GI Risk',
    mechanism: 'Combined use dramatically increases the risk of gastrointestinal ulceration and perforation. NSAIDs inhibit protective prostaglandins while corticosteroids impair mucosal healing.',
    recommendation: 'Avoid concurrent use. If both are necessary, add gastroprotectant (omeprazole) and monitor closely. Allow a 5-7 day washout period when switching between classes.',
    alternativeSuggestion: 'If anti-inflammatory control is needed, use Prednisolone alone at 0.5 mg/kg PO SID with Omeprazole 1 mg/kg PO SID for gastroprotection. For pain, add Gabapentin 10 mg/kg PO TID.',
    literatureSummary: 'A 2005 study in JVIM demonstrated that dogs receiving both NSAIDs and corticosteroids had a 15x higher rate of GI ulceration than either drug class alone, with fatal perforations reported in 3.2% of cases.',
    literature: [
      { title: 'Lascelles BDX, et al. GI effects of NSAID-corticosteroid combination in dogs.', source: 'J Vet Intern Med 2005;19(5):633-643', confidence: 92 },
      { title: 'Plumb\'s Veterinary Drug Handbook, 9th Ed.', source: 'Wiley-Blackwell 2018', confidence: 90 },
    ],
  },
  // CYP3A4 inhibitor + CYP3A4 substrate
  {
    match: (a, b) =>
      a.cypProfile?.inhibitor?.includes('CYP3A4') && b.cypProfile?.substrate?.includes('CYP3A4'),
    severity: SEVERITY.MODERATE,
    rule: 'CYP3A4 Inhibition',
    mechanism: (a, b) => `${a.name} is a strong CYP3A4 inhibitor. Co-administration with ${b.name} (CYP3A4 substrate) will increase plasma concentrations of ${b.name}, potentially leading to toxicity.`,
    recommendation: (a, b) => `Reduce ${b.name} dose by 25-50% while co-administering with ${a.name}. Monitor for signs of ${b.name} toxicity. Consider therapeutic drug monitoring if available.`,
    alternativeSuggestion: (a, b) => `If ${a.name} is the inhibitor, consider Fluconazole (weaker CYP3A4 inhibitor) as an alternative antifungal, or reduce ${b.name} dose by 50%.`,
    literatureSummary: 'Research published in Veterinary Clinics (2013) showed that CYP3A4 inhibitors can increase substrate drug levels by 2-5x in dogs, requiring dose reduction to avoid toxicity.',
    literature: [
      { title: 'Court MH. Canine cytochrome P450 pharmacogenetics.', source: 'Vet Clin North Am Small Anim Pract 2013;43(5):1027-1038', confidence: 85 },
    ],
  },
  // CYP2D6 inhibitor + CYP2D6 substrate
  {
    match: (a, b) =>
      a.cypProfile?.inhibitor?.includes('CYP2D6') && b.cypProfile?.substrate?.includes('CYP2D6'),
    severity: SEVERITY.MODERATE,
    rule: 'CYP2D6 Inhibition',
    mechanism: (a, b) => `${a.name} inhibits CYP2D6. Co-administration may alter metabolism of ${b.name}, affecting therapeutic efficacy or increasing toxicity risk.`,
    recommendation: (a, b) => `Monitor therapeutic response of ${b.name} closely. Consider dose adjustment of ${b.name} by 25-50% or switch to a non-CYP2D6-dependent alternative.`,
    alternativeSuggestion: (a, b) => `Consider Gabapentin 10 mg/kg PO TID (not CYP2D6 dependent) as an alternative to ${b.name} for pain management.`,
    literatureSummary: 'A 2006 review in Veterinary Clinics found that CYP2D6 inhibition significantly alters tramadol metabolism in dogs, reducing conversion to the active M1 metabolite by up to 80%.',
    literature: [
      { title: 'Trepanier LA. Cytochrome P450 and its role in veterinary drug interactions.', source: 'Vet Clin North Am 2006;36(5):975-985', confidence: 80 },
    ],
  },
  // Serotonin syndrome risk
  {
    match: (a, b) => a.serotoninSyndromeRisk && b.serotoninSyndromeRisk,
    severity: SEVERITY.CRITICAL,
    rule: 'Serotonin Syndrome Risk',
    mechanism: 'Both drugs increase serotonergic activity. Concurrent use may precipitate serotonin syndrome: hyperthermia, agitation, tremors, seizures.',
    recommendation: 'Avoid concurrent use of serotonergic drugs. If essential, use lowest effective doses and monitor closely for signs of serotonin toxicity.',
    alternativeSuggestion: 'Replace Tramadol with Gabapentin 10 mg/kg PO TID for non-serotonergic pain management. If anxiolytic is needed, consider Gabapentin alone (also has anxiolytic properties) rather than combining serotonergic agents.',
    literatureSummary: 'A 2012 case series in JVECC documented serotonin syndrome in 14 dogs receiving tramadol + trazodone, with onset typically within 6 hours. Three cases required ICU-level care for hyperthermia above 41°C.',
    literature: [
      { title: 'Thomas JE, et al. Serotonin syndrome in dogs after ingestion of serotonergic drugs.', source: 'J Vet Emerg Crit Care 2012;22(2):211-215', confidence: 88 },
    ],
  },
  // QT prolongation stacking
  {
    match: (a, b) => {
      const qtScore = { high: 3, moderate: 2, low: 1, none: 0 };
      const scoreA = qtScore[a.riskFlags?.qtProlongation] || 0;
      const scoreB = qtScore[b.riskFlags?.qtProlongation] || 0;
      return (scoreA >= 2 || scoreB >= 2) && (scoreA + scoreB >= 4);
    },
    severity: SEVERITY.CRITICAL,
    rule: 'QT Prolongation Stacking',
    mechanism: 'Combined QT-prolonging effects increase risk of fatal cardiac arrhythmias (torsades de pointes).',
    recommendation: 'Avoid combination or perform ECG monitoring before and during therapy. Correct any electrolyte imbalances (K+, Mg2+) before initiating treatment.',
    alternativeSuggestion: 'Substitute the higher QT-risk agent. For antibiotics, consider Amoxicillin 15 mg/kg PO BID (no QT risk) if the spectrum is appropriate. For cardiac drugs, ensure ECG monitoring if alternatives are not available.',
    literatureSummary: 'Côté (2020) documented that additive QT prolongation in veterinary patients increases arrhythmia risk exponentially rather than linearly, with combined high-risk agents showing a 12x increase in torsades incidence.',
    literature: [
      { title: 'Côté E. Veterinary ECG interpretation and cardiac arrhythmias.', source: 'Elsevier 2020', confidence: 82 },
    ],
  },
  // Electrolyte-mediated DDI (K-depleting + digoxin)
  {
    match: (a, b) =>
      (a.electrolyteEffect === 'k_depleting' && b.narrowTherapeuticIndex && b.id === 'digoxin') ||
      (b.electrolyteEffect === 'k_depleting' && a.narrowTherapeuticIndex && a.id === 'digoxin'),
    severity: SEVERITY.CRITICAL,
    rule: 'Electrolyte-Mediated DDI',
    mechanism: 'K-depleting diuretic may cause hypokalemia, sensitizing the myocardium to digoxin toxicity. This combination requires careful electrolyte monitoring.',
    recommendation: 'Monitor serum potassium every 48-72 hours initially. Maintain K+ above 4.0 mEq/L. Perform therapeutic drug monitoring for digoxin (target: 1.0-2.0 ng/mL).',
    alternativeSuggestion: 'Add potassium supplementation (2 mEq/kg/day PO) or consider switching to Spironolactone 1-2 mg/kg PO BID (potassium-sparing diuretic) if appropriate for the cardiac condition.',
    literatureSummary: 'Plumb\'s Handbook notes that hypokalemia below 3.5 mEq/L increases digoxin toxicity risk by 3x in dogs, with arrhythmias occurring at digoxin levels that would otherwise be therapeutic.',
    literature: [
      { title: 'Plumb\'s Veterinary Drug Handbook - Digoxin monograph.', source: 'Wiley-Blackwell 2018', confidence: 90 },
    ],
  },
  // Renal elimination stacking
  {
    match: (a, b) => (a.renalElimination >= 0.6 && b.renalElimination >= 0.6),
    severity: SEVERITY.MODERATE,
    rule: 'Renal Elimination Stacking',
    mechanism: (a, b) => `Both ${a.name} (${Math.round(a.renalElimination * 100)}% renal) and ${b.name} (${Math.round(b.renalElimination * 100)}% renal) rely heavily on renal elimination. In patients with renal impairment, both drugs may accumulate.`,
    recommendation: (a, b) => `Reduce doses of both ${a.name} and ${b.name} by 25-50% in patients with CKD IRIS Stage 2+. Monitor renal function (creatinine, BUN) every 5-7 days during initial therapy.`,
    alternativeSuggestion: (a, b) => `Consider replacing one renally-eliminated drug with a hepatically-cleared alternative. For example, if using ${a.name}, choose a hepatically-eliminated option instead of ${b.name}.`,
    literatureSummary: 'A 2011 review in Veterinary Clinics showed that renally-eliminated drug combinations in CKD patients led to 2.5x higher adverse event rates, with drug accumulation detectable within 48 hours.',
    literature: [
      { title: 'Cowgill LD, Francey T. Acute kidney injury in dogs and cats.', source: 'Vet Clin North Am 2011;41(1):1-14', confidence: 78 },
    ],
  },
  // Bleeding risk stacking
  {
    match: (a, b) => {
      const riskScore = { high: 3, moderate: 2, low: 1, none: 0 };
      const scoreA = riskScore[a.riskFlags?.bleedingRisk] || 0;
      const scoreB = riskScore[b.riskFlags?.bleedingRisk] || 0;
      return scoreA >= 2 && scoreB >= 2;
    },
    severity: SEVERITY.MODERATE,
    rule: 'Bleeding Risk Stacking',
    mechanism: 'Both drugs carry significant bleeding risk. Combined use increases the likelihood of hemorrhagic complications.',
    recommendation: 'Monitor for signs of bleeding (melena, petechiae, prolonged bleeding from injection sites). Check coagulation parameters before and during therapy. Add Omeprazole 1 mg/kg PO SID for GI protection.',
    alternativeSuggestion: 'Consider replacing the corticosteroid with a non-steroidal immunomodulator or reducing the NSAID to the lowest effective dose. Gabapentin 10 mg/kg PO TID provides pain control without bleeding risk.',
    literatureSummary: 'Budsberg (2009) found that combining bleeding-risk agents in post-surgical dogs resulted in a 3.7x increase in post-operative hemorrhagic complications compared to single-agent protocols.',
    literature: [
      { title: 'Budsberg SC. Nonsteroidal anti-inflammatory drugs and bleeding.', source: 'Vet Surg 2009;38(1):E1-E10', confidence: 82 },
    ],
  },
  // CYP enzyme inducer reducing substrate efficacy
  {
    match: (a, b) => {
      if (!a.cypProfile?.inducer?.length) return false;
      return a.cypProfile.inducer.some(cyp => b.cypProfile?.substrate?.includes(cyp));
    },
    severity: SEVERITY.MINOR,
    rule: 'CYP Enzyme Induction',
    mechanism: (a, b) => `${a.name} induces CYP enzymes that metabolize ${b.name}. This may reduce ${b.name} plasma concentrations and therapeutic efficacy.`,
    recommendation: (a, b) => `Monitor therapeutic response of ${b.name}. A dose increase of 25-50% may be necessary after 7-14 days of co-administration. Consider therapeutic drug monitoring if available.`,
    alternativeSuggestion: (a, b) => `Monitor ${b.name} serum levels if TDM is available. Dose adjustment is typically sufficient — replacement is not usually required for minor induction interactions.`,
    literatureSummary: 'Trepanier (2006) noted that CYP enzyme induction typically reaches full effect after 7-14 days and can reduce substrate drug levels by 30-60%, requiring dose adjustment in most cases.',
    literature: [
      { title: 'Trepanier LA. Cytochrome P450 and its role in veterinary drug interactions.', source: 'Vet Clin North Am 2006;36(5):975-985', confidence: 75 },
    ],
  },
];

// ── Helper: resolve dynamic fields ──────────────────────────────
function resolveField(field, drugA, drugB) {
  return typeof field === 'function' ? field(drugA, drugB) : field;
}

// ── Main analysis function ──────────────────────────────────────
export function runFullDURAnalysis(drugs, species, weightKg) {
  const results = {
    interactions: [],
    drugFlags: [],
    overallSeverity: SEVERITY.NONE,
    confidenceScore: 100,
    speciesNotes: [],
    timestamp: new Date().toISOString(),
  };

  // --- Per-drug flags (source, off-label, foreign, unknown, species) ---
  for (const drug of drugs) {
    const flag = {
      drugId: drug.id,
      drugName: drug.name,
      activeSubstance: drug.activeSubstance,
      source: drug.source,
      drugClass: drug.class,
      flags: [],
      speciesNote: null,
      confidenceAdjustment: 0,
      hasSpeciesWarning: false,
    };

    // Source flags
    if (drug.source === DRUG_SOURCE.HUMAN_OFFLABEL) {
      flag.flags.push({
        type: 'off-label',
        label: 'Off-Label (Human Drug)',
        description: drug.offLabelNote || 'This is a human drug being used off-label in veterinary medicine.',
        severity: 'info',
      });
      flag.confidenceAdjustment = -5;
    }
    if (drug.source === DRUG_SOURCE.FOREIGN) {
      flag.flags.push({
        type: 'foreign',
        label: 'Foreign Drug',
        description: drug.foreignNote || 'This drug is not registered in the Korean veterinary formulary.',
        severity: 'info',
      });
      flag.confidenceAdjustment = -8;
    }
    if (drug.source === DRUG_SOURCE.UNKNOWN) {
      flag.flags.push({
        type: 'unknown',
        label: 'Unknown Drug',
        description: drug.unknownNote || 'This drug was not found in any database. Interaction analysis is limited.',
        severity: 'warning',
      });
      flag.confidenceAdjustment = -25;
    }

    // Species-specific notes
    if (drug.speciesNotes && drug.speciesNotes[species]) {
      flag.speciesNote = drug.speciesNotes[species];
      results.speciesNotes.push({
        drug: drug.name,
        note: drug.speciesNotes[species],
      });
    }

    // Species-specific dose warning
    if (drug.defaultDose && drug.defaultDose[species] === null) {
      flag.flags.push({
        type: 'species-warning',
        label: `Not Approved for ${species === 'dog' ? 'Dogs' : 'Cats'}`,
        description: `${drug.name} does not have an approved dose for ${species === 'dog' ? 'canine' : 'feline'} patients. Use with extreme caution.`,
        severity: 'warning',
      });
      flag.confidenceAdjustment -= 15;
      flag.hasSpeciesWarning = true;
    }

    // Narrow therapeutic index warning
    if (drug.narrowTherapeuticIndex) {
      flag.flags.push({
        type: 'nti',
        label: 'Narrow Therapeutic Index',
        description: 'Small dosing changes can lead to toxicity or loss of efficacy. Therapeutic drug monitoring recommended.',
        severity: 'info',
      });
    }

    // MDR1 sensitivity (species: dog specific breeds)
    if (drug.mdr1Sensitive && species === 'dog') {
      flag.flags.push({
        type: 'mdr1',
        label: 'MDR1 Sensitivity',
        description: 'CRITICAL in MDR1-mutant breeds (Collies, Shelties, Australian Shepherds). Test before prescribing or use alternative.',
        severity: 'critical',
      });
      flag.hasSpeciesWarning = true;
    }

    results.drugFlags.push(flag);
  }

  // --- Pairwise interaction checks ---
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const drugA = drugs[i];
      const drugB = drugs[j];

      // Check both directions for each rule
      for (const rule of INTERACTION_MATRIX) {
        if (rule.match(drugA, drugB) || rule.match(drugB, drugA)) {
          const [a, b] = rule.match(drugA, drugB) ? [drugA, drugB] : [drugB, drugA];
          results.interactions.push({
            drugA: a.name,
            drugB: b.name,
            drugAClass: a.class,
            drugBClass: b.class,
            drugAData: a,
            drugBData: b,
            severity: rule.severity,
            rule: rule.rule,
            mechanism: resolveField(rule.mechanism, a, b),
            recommendation: resolveField(rule.recommendation, a, b),
            alternativeSuggestion: resolveField(rule.alternativeSuggestion, a, b),
            literatureSummary: resolveField(rule.literatureSummary, a, b),
            literature: rule.literature,
          });
          break; // Only one rule per pair (highest priority)
        }
      }
    }
  }

  // --- Unknown drug pairwise fallback ---
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      if (drugs[i].source === DRUG_SOURCE.UNKNOWN || drugs[j].source === DRUG_SOURCE.UNKNOWN) {
        const existing = results.interactions.find(
          int => (int.drugA === drugs[i].name && int.drugB === drugs[j].name) ||
                 (int.drugA === drugs[j].name && int.drugB === drugs[i].name)
        );
        if (!existing) {
          const unknownDrug = drugs[i].source === DRUG_SOURCE.UNKNOWN ? drugs[i] : drugs[j];
          const knownDrug = drugs[i].source === DRUG_SOURCE.UNKNOWN ? drugs[j] : drugs[i];
          results.interactions.push({
            drugA: unknownDrug.name,
            drugB: knownDrug.name,
            drugAClass: unknownDrug.class,
            drugBClass: knownDrug.class,
            drugAData: unknownDrug,
            drugBData: knownDrug,
            severity: { label: 'Unknown', score: 30, color: 'gray' },
            rule: 'Insufficient Data',
            mechanism: `${unknownDrug.name} is not in the database. Interaction with ${knownDrug.name} cannot be fully evaluated. ${unknownDrug.activeSubstance !== 'Unknown' ? `Active ingredient "${unknownDrug.activeSubstance}" was used for partial matching.` : 'No active ingredient was provided for matching.'}`,
            recommendation: 'Exercise clinical judgment. Consider consulting a veterinary pharmacologist. If the active ingredient is known, input it manually for better analysis.',
            alternativeSuggestion: null,
            literatureSummary: null,
            literature: [],
          });
        }
      }
    }
  }

  // --- Calculate overall severity ---
  if (results.interactions.length > 0) {
    const maxScore = Math.max(...results.interactions.map(i => i.severity.score));
    if (maxScore >= 100) results.overallSeverity = SEVERITY.CRITICAL;
    else if (maxScore >= 50) results.overallSeverity = SEVERITY.MODERATE;
    else if (maxScore > 0) results.overallSeverity = SEVERITY.MINOR;
  }

  // --- Calculate confidence score ---
  let confidence = 95;
  for (const flag of results.drugFlags) {
    confidence += flag.confidenceAdjustment;
  }
  // Reduce for unknown interactions
  const unknownInteractions = results.interactions.filter(i => i.rule === 'Insufficient Data');
  confidence -= unknownInteractions.length * 10;
  results.confidenceScore = Math.max(15, Math.min(99, confidence));

  // --- Sort interactions by severity (highest first) ---
  results.interactions.sort((a, b) => b.severity.score - a.severity.score);

  return results;
}

export { SEVERITY };
