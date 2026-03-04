# VetDUR Frontend Architecture

## Product Overview

VetDUR is a veterinary Drug Utilization Review system that screens multi-drug prescriptions for interactions in companion animals (dogs and cats). The frontend is a mobile-first web application designed to feel like clinical-grade medical software — not a consumer product.

---

## Design Philosophy

**Clinical, not consumer.** White backgrounds, minimal color, clean typography. Color is reserved strictly for severity indicators:

| Color | Meaning |
|-------|---------|
| Red | Critical — absolute contraindication |
| Amber/Orange | Moderate — dose adjustment or monitoring required |
| Yellow | Minor — awareness, generally safe |
| Green | None — no interaction detected / confidence indicators |

Everything else is grayscale. No gradients, no decorative color, no emoji in the UI (except species selectors in the demo). The goal is to feel like software a vet would trust in a clinical setting.

**Mobile-first.** Every layout is designed for phones first and scales up to desktop. Sticky headers, full-width cards, touch-friendly tap targets. The app works well on a tablet in a clinic exam room.

---

## User Flows

### 1. Landing Page (`/`)

A scrollable product page with five sections:

- **Hero** — Product name, tagline, and a live-animated result preview card that cycles through severity levels. Two CTAs: "Try Demo" and "Request Full Access."
- **Stats Bar** — Animated counters showing database scale (877+ drugs, 8 DUR engines, 10 interaction rules, 2 species).
- **Feature Grid** — Six cards explaining the DUR capabilities: CYP enzyme profiling, pairwise DDI screening, species-specific dosing, off-label drug support, foreign drug handling, and unknown drug fallback.
- **Pipeline Section** — Visual breakdown of the six-case drug resolution pipeline with a severity classification reference.
- **CTA Sections** — Dark demo launch block and a bottom access request area.

All sections use scroll-reveal animations (IntersectionObserver). The nav is sticky with backdrop blur.

### 2. Demo Mode (`/demo`)

A guided 4-step flow accessible to anyone with no login:

**Step 1 — Species Selection**
Choose dog or cat. Large selection cards with hover effects.

**Step 2 — Breed Selection**
Choose from realistic breed profiles (4 dog, 3 cat). Each card shows the breed name, patient name, and key conditions at a glance.

**Step 3 — Patient Chart (EMR)**
A full electronic medical record view auto-filled from the selected breed profile:

- **Header** — Patient name, species, sex, demo label
- **Vitals grid** — Age, weight (editable inline), heart rate, temperature
- **Body condition score** and respiratory rate
- **Active conditions** — Tag chips, removable, with "Add" option
- **Known allergies** — Tag chips (red), removable, with "Add" option
- **Lab results** — Grid with values, units, and high/low status indicators
- **Clinical history** — Narrative text

All fields that make clinical sense are editable. The profile is a starting point, not a locked state.

**Step 4 — Medications**
Pre-filled drug list from the breed profile. The user can:
- Search and add any drug from the database
- Remove existing drugs
- Add unknown drugs (with optional active ingredient input)

Then "Run DUR Scan" triggers the analysis.

**Analysis → Results**
Loading screen with sequential database-search animation, then the full results page.

### 3. Full System Mode (`/system`)

Password-protected (`vetdur2025`). Same drug input and results UI but:
- No guided flow — starts with an empty patient form
- Species selector and weight input
- Full drug search against the entire database
- Intended for real clinical use (once backend is connected)

### 4. Request Full Access (Modal)

Simple lead capture form (name, clinic name, email/phone) submitted via Formspree. Shows a success confirmation on submit.

---

## Drug Pipeline — Six Cases

Every drug entered into the system is classified before interaction analysis:

1. **Korean Approved Veterinary Drugs** — Full pharmacological profiles, maximum confidence. Examples: Meloxicam, Enrofloxacin, Amoxicillin, Prednisolone.

2. **Human Drugs Used Off-Label** — Flagged with an off-label advisory badge. Confidence reduced by 5%. Examples: Trazodone, Fluoxetine, Amlodipine, Cyclosporine, Methimazole.

3. **Foreign Drugs** — Not in the Korean formulary. Flagged with a foreign drug badge. Confidence reduced by 8%. Examples: Firocoxib (Previcox), Pimobendan (Vetmedin), Oclacitinib (Apoquel).

4. **Unknown Drugs** — Not found in any database. The system never returns blank. Instead it:
   - Offers to add the drug with a low-confidence flag
   - Prompts for the active ingredient for partial matching
   - Returns interaction results with clear "Insufficient Data" labels
   - Confidence reduced by 25%

5. **Multi-Drug Combinations** — Every drug pair is checked against the interaction matrix. With N drugs, the system evaluates N×(N-1)/2 pairs.

6. **Species-Specific Adjustments** — Dose availability per species, pharmacokinetic differences (e.g., cats lack glucuronidation), breed-specific flags (MDR1 mutation in herding breeds).

---

## DUR Interaction Engine

The frontend runs a client-side interaction engine with 10 rules (mirroring the backend's 8-rule engine):

| Rule | Severity | Example |
|------|----------|---------|
| Duplicate NSAID | Critical | Meloxicam + Carprofen |
| NSAID + Corticosteroid GI Risk | Critical | Meloxicam + Prednisolone |
| Serotonin Syndrome Risk | Critical | Tramadol + Trazodone |
| QT Prolongation Stacking | Critical | Digoxin + Enrofloxacin |
| Electrolyte-Mediated DDI | Critical | Furosemide + Digoxin |
| CYP3A4 Inhibition | Moderate | Ketoconazole + Cyclosporine |
| CYP2D6 Inhibition | Moderate | Fluoxetine + Tramadol |
| Renal Elimination Stacking | Moderate | Amoxicillin + Gabapentin |
| Bleeding Risk Stacking | Moderate | Meloxicam + Dexamethasone |
| CYP Enzyme Induction | Minor | Phenobarbital + Prednisolone |

Each interaction includes: mechanism explanation, clinical recommendation, and cited literature references.

---

## Results Page

The DUR report displays:

- **Overall severity banner** — Color-coded (red/amber/yellow/green) with interaction count
- **Confidence score** — Percentage bar reflecting data quality across all drugs
- **Interaction cards** — Ranked by severity, expandable with:
  - Mechanism of interaction
  - Clinical recommendation
  - Literature references with source citations
- **Drug advisory flags** — Off-label, foreign, unknown, species-warning, MDR1 sensitivity, narrow therapeutic index
- **Species-specific notes** — Per-drug clinical notes for the selected species

---

## Demo Breed Profiles

Seven pre-built clinical cases:

### Dogs
| Breed | Patient | Key Conditions | Default Drugs |
|-------|---------|---------------|---------------|
| Golden Retriever | Buddy, 7y | Hip dysplasia, seasonal allergies | Meloxicam, Gabapentin, Omeprazole |
| Shetland Sheepdog | Max, 4y | MDR1 deficient, early CKD | Prednisolone, Metronidazole, Enalapril |
| French Bulldog | Coco, 3y | Brachycephalic syndrome, atopic dermatitis | Prednisolone, Amoxicillin, Ketoconazole |
| Dachshund | Oscar, 9y | IVDD, chronic pain | Meloxicam, Gabapentin, Tramadol |

### Cats
| Breed | Patient | Key Conditions | Default Drugs |
|-------|---------|---------------|---------------|
| Domestic Shorthair | Mochi, 11y | Hyperthyroidism, early CKD | Methimazole, Amlodipine, Maropitant |
| Persian | Luna, 6y | Hypertrophic cardiomyopathy | Enalapril, Furosemide, Pimobendan |
| Siamese | Nabi, 8y | FLUTD, anxiety | Gabapentin, Trazodone, Meloxicam |

Each profile includes complete vitals, body condition score, lab results with normal/abnormal flags, allergy history, condition list, and clinical narrative.

---

## Loading Experience

When the DUR scan runs, a 6-step sequential animation plays:

1. Resolving drug identifiers (matching products → active substances)
2. Querying Korean Veterinary DB (scanning 877 products)
3. CYP enzyme interaction analysis (CYP3A4, CYP2D6, CYP1A2, CYP2C9)
4. Pairwise DDI screening (evaluating drug pairs)
5. Species-specific dose verification (canine/feline PK parameters)
6. Cross-referencing literature (PMC, Plumb's, BSAVA)

Each step shows a spinner → checkmark progression. The overall effect is of a system actively searching real databases, not just spinning.

---

## Drug Database

25+ drugs with full pharmacological profiles:

- Active substance, drug class, Korean name
- CYP enzyme profiles (substrate, inhibitor, inducer)
- Risk flags (nephrotoxic, hepatotoxic, QT prolongation, bleeding, GI ulcer)
- Species-specific default doses and clinical notes
- Renal elimination percentage
- Special flags (narrow therapeutic index, MDR1 sensitivity, serotonin syndrome risk, electrolyte effects)
- Contraindication lists

Searchable by English name, Korean name, or active substance. Filtered by species (excludes drugs with no approved dose).

---

## Technical Stack

- **React 18** with functional components and hooks
- **Vite 5** for build tooling
- **Tailwind CSS 3** for styling (no component library)
- **React Router v7** for client-side routing
- **Lucide React** for icons
- **Formspree** for lead capture form submission
- **Vercel** for deployment (SPA rewrites configured)

No external UI framework. No state management library — local state with React hooks is sufficient for the current scope. The interaction engine runs entirely client-side for the demo; the full system will connect to the backend PostgreSQL + Python DDI engine.
