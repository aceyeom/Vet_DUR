/**
 * NuvoVet Type Definitions (JSDoc)
 *
 * These types document the data contracts between the backend API,
 * the client-side DUR engine (durEngine.js), and the UI components.
 * The authoritative DUR engine is the client-side runFullDURAnalysis().
 */

// ── Drug contract ──────────────────────────────────────────────────────────────
// Shape returned by GET /api/drugs/{id} and GET /api/drugs/search

/**
 * @typedef {Object} CypProfile
 * @property {string[]} substrate  - CYP enzymes this drug is a substrate of
 * @property {string[]} inhibitor  - CYP enzymes this drug inhibits
 * @property {string[]} inducer    - CYP enzymes this drug induces
 */

/**
 * @typedef {Object} RiskFlags
 * @property {'none'|'low'|'moderate'|'high'} nephrotoxic
 * @property {'none'|'low'|'moderate'|'high'} hepatotoxic
 * @property {'none'|'low'|'moderate'|'high'} bleedingRisk
 * @property {'none'|'low'|'moderate'|'high'} giUlcer
 * @property {'none'|'low'|'moderate'|'high'} qtProlongation
 */

/**
 * @typedef {Object} AdditiveRisks
 * @property {boolean} nephrotoxic
 * @property {boolean} hepatotoxic
 * @property {boolean} giUlcer
 * @property {boolean} bleeding
 * @property {boolean} sedation
 * @property {boolean} qtProlongation
 */

/**
 * @typedef {Object} PkProfile
 * @property {number|null} halfLife         - hours
 * @property {number|null} timeToPeak       - hours
 * @property {number|null} bioavailability  - 0–1
 * @property {number|null} proteinBinding   - 0–1
 * @property {'hepatic'|'renal'|'mixed'} primaryElimination
 */

/**
 * @typedef {Object} OrganScores
 * @property {number} brain
 * @property {number} blood
 * @property {number} kidney
 * @property {number} liver
 * @property {number} heart
 */

/**
 * @typedef {Object} DrugStrength
 * @property {number} value
 * @property {string} unit  - e.g. 'mg', 'mcg', 'g'
 */

/**
 * @typedef {Object} Drug
 * @property {string}   id
 * @property {string}   name
 * @property {string|null} nameKr
 * @property {string}   activeSubstance
 * @property {string}   class
 * @property {'kr_vet'|'human_offlabel'|'foreign'|'unknown'} source
 * @property {string|null}  allergyClass
 * @property {string|null}  offLabelNote
 * @property {boolean}  hasReversal
 * @property {string|null}  reversalAgent
 * @property {string}   formularyStatus
 * @property {string[]} brandNames
 * @property {string[]} dosageForms
 * @property {DrugStrength[]} availableStrengths
 *
 * @property {number}   renalElimination   - 0–1
 * @property {CypProfile} cypProfile
 * @property {RiskFlags}  riskFlags
 * @property {AdditiveRisks} additiveRisks
 * @property {boolean}  mdr1Sensitive
 * @property {boolean}  serotoninSyndromeRisk
 * @property {boolean}  narrowTherapeuticIndex
 * @property {string|null}  electrolyteEffect
 * @property {number|null}  washoutPeriodDays
 * @property {string[]} speciesContraindicated
 *
 * @property {PkProfile} pk
 * @property {{ dog: number|null, cat: number|null }} defaultDose
 * @property {{ dog: [number,number]|null, cat: [number,number]|null }} doseRange
 * @property {string}   unit    - e.g. 'mg/kg'
 * @property {string}   freq    - e.g. 'SID', 'BID'
 * @property {string}   route   - e.g. 'PO', 'SC', 'IV'
 * @property {{ dog: boolean, cat: boolean }} isApproved
 *
 * @property {{ dog: string|null, cat: string|null }} speciesNotes
 * @property {string[]} contraindications
 * @property {{ dog: OrganScores, cat: OrganScores }} organBurden
 * @property {object}   renalDoseAdjustment
 * @property {object}   hepaticDoseAdjustment
 * @property {object}   geneticSensitivity
 * @property {object[]} rawInteractions
 * @property {object}   dataQuality
 *
 * // Prescription line fields (added by DrugInput / buildPrescriptionLineItem)
 * @property {string|null} [selectedVariant]
 */

// ── DUR result contract ────────────────────────────────────────────────────────
// Shape returned by runFullDURAnalysis() in durEngine.js

/**
 * @typedef {Object} SeverityLevel
 * @property {'Critical'|'Moderate'|'Minor'|'Unknown'|'None'} label
 * @property {number} score   - 100 | 50 | 20 | 30 | 0
 * @property {'red'|'orange'|'yellow'|'gray'|'green'} color
 */

/**
 * @typedef {Object} LiteratureRef
 * @property {string} title
 * @property {string} source
 * @property {number} confidence  - 0–100
 */

/**
 * @typedef {Object} Interaction
 * @property {string} drugA
 * @property {string} drugB
 * @property {string|null} drugAClass
 * @property {string|null} drugBClass
 * @property {Drug}   drugAData    - Full drug object (required by DrugTimeline)
 * @property {Drug}   drugBData    - Full drug object (required by DrugTimeline)
 * @property {SeverityLevel} severity
 * @property {string} rule
 * @property {string} mechanism
 * @property {string} recommendation
 * @property {string|null} [alternativeSuggestion]
 * @property {string|null} [literatureSummary]
 * @property {LiteratureRef[]} literature
 */

/**
 * @typedef {Object} DrugFlag
 * @property {string} drugId
 * @property {string} drugName
 * @property {string} activeSubstance
 * @property {string} source
 * @property {string} drugClass
 * @property {{ type: string, label: string, description: string, severity: string }[]} flags
 * @property {string|null} speciesNote
 * @property {number} confidenceAdjustment
 * @property {boolean} hasSpeciesWarning
 */

/**
 * @typedef {Object} SpeciesNote
 * @property {string} drug   - Drug name
 * @property {string} note   - Species-specific clinical note
 */

/**
 * @typedef {Object} DURResult
 * @property {Interaction[]}  interactions
 * @property {DrugFlag[]}     drugFlags
 * @property {SeverityLevel}  overallSeverity
 * @property {number}         confidenceScore   - 15–99
 * @property {SpeciesNote[]}  speciesNotes      - Always present; empty array if none
 * @property {string}         timestamp         - ISO 8601 string; always present
 */

export {};
