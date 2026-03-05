# VetDUR Frontend Architecture

## Product Overview

VetDUR is a veterinary Drug Utilization Review system that screens multi-drug prescriptions for interactions in companion animals (dogs and cats). The frontend is a mobile-first web application designed to feel like clinical-grade medical software — not a consumer product.

---

## Design Philosophy

**Clinical, not consumer.** White backgrounds, minimal color, clean typography. Color is reserved strictly for severity indicators:

| Color | Meaning | Visual Treatment |
|-------|---------|-----------------|
| Red | Critical — absolute contraindication | Full card background tint (`bg-red-50`), red borders. The entire card visually signals "stop" before any text is read. |
| Amber/Orange | Moderate — dose adjustment or monitoring required | Medium amber background tint (`bg-amber-50/60`), amber borders. Moderate visual weight. |
| Yellow/Gray | Minor — awareness, generally safe | Collapsed to a single compact line by default. Expandable on tap. Minimal visual footprint. |
| Green | None — no interaction detected / confidence indicators | Used for confidence bars and "no interaction" states. |

**Severity = visual weight.** The card's visual intensity signals severity before any text is read. Critical interactions dominate the page; minor ones compress to a single line.

**Mobile-first.** Every layout is designed for phones first and scales up to desktop. Sticky headers, full-width cards, touch-friendly tap targets. The app works well on a tablet in a clinic exam room.

---

## User Flows

### 1. Landing Page (`/`)

A scrollable product page with five sections:

- **Hero** — Headline: "Every prescription reviewed. Every interaction caught." Subtle background image of dogs (Unsplash, white overlay at 92% opacity). Live-animated result preview card cycling through severity levels. Two CTAs: "Try Demo" and "Request Full Access."
- **Stats Bar** — Animated counters: 877+ drugs, 8 DUR engines, 10 interaction rules, 2 species.
- **Feature Grid** — Six cards: CYP enzyme profiling, pairwise DDI screening, species-specific dosing, off-label drug support, foreign drug handling, unknown drug fallback.
- **Pipeline Section** — Six-case drug resolution pipeline with severity classification reference.
- **CTA Sections** — Dark demo launch block and bottom access request area.

All sections use scroll-reveal animations (IntersectionObserver). Nav is sticky with backdrop blur.

### 2. Demo Mode (`/demo`)

A guided 4-step flow accessible to anyone with no login:

**Step 1 — Species Selection**
Choose dog or cat. Professional photography (Unsplash images) replaces emoji for a clean, clinical look. Large selection cards with hover effects.

**Step 2 — Breed Selection**
Choose from realistic breed profiles (4 dog, 3 cat). Each card shows:
- Breed name, patient name, age, and conditions
- **"Demonstrates: [clinical scenario]"** descriptor — helps demo audiences choose the most relevant case

**Step 3 — Patient Chart (Collapsed Summary)**
A streamlined view replacing the full scrollable EMR:

- **Summary card (default view):** Patient name, breed, species, sex, age, weight (editable inline), body condition score, active conditions as chips (removable, with "Add" button), and abnormal lab values auto-surfaced.
- **"Edit details" expand:** Reveals full vitals, body condition, respiratory rate, all lab results with normal/high/low indicators, allergies (add/remove), and clinical history.
- **Condition autocomplete:** When adding conditions, a searchable list of 30+ common veterinary conditions appears as suggestions.
- One tap "Continue to Medications" always visible.

**Step 4 — Medications**
Pre-filled drug list from the breed profile. Search, add, remove drugs. "Run DUR Scan" triggers analysis.

**Analysis → Results**
Loading screen with sequential 6-step database-search animation, then the full results page.

### 3. Full System Mode (`/system`)

Password-protected (`vetdur2025`). Same drug input and results UI without the guided flow. Intended for real clinical use once the backend is connected.

### 4. Request Full Access (Modal)

Lead capture form (name, clinic, email/phone) via Formspree.

---

## Results Page

The DUR report is the core deliverable. It is structured for clinical decision-making:

### Summary Band
Full-width card at the top combining:
- Overall severity indicator with icon
- Drug count and interaction count
- **Severity breakdown chips:** Red "2 Critical", amber "1 Moderate", gray "1 Minor"
- **Confidence score** with a prominent labeled progress bar — not a footer afterthought

### Interaction Cards — Three-Zone Layout

Each interaction card has three visually distinct zones:

1. **Zone 1 — Header:** Drug pair in bold + drug class chips (small pill badges like "NSAID", "Corticosteroid"). Severity badge and rule name.
2. **Zone 2 — Mechanism:** Readable body text explaining the pharmacological interaction.
3. **Zone 3 — Action Box:** Visually distinct tinted box with:
   - Specific, dosable clinical recommendation
   - **Alternative drug suggestion** (for Critical interactions) — a named drug with dose, not "consider alternatives"
   - Example: "Consider Gabapentin 10 mg/kg PO TID for non-serotonergic pain management."

### Drug Timeline Strip
Each interaction card includes a 24-hour pharmacokinetic timeline:
- Horizontal bar chart showing drug concentration windows
- Peak marked with a colored indicator and time label
- Half-life labeled at the trough
- Graceful fallback: "PK timeline data not available" for drugs without data
- All demo breed profile drugs have complete PK data

### Literature References
One-tap expandable section with:
- **Plain English summary** — e.g., "A 2012 JAVMA study found that concurrent NSAID use in dogs increased GI bleeding risk by 4.3x."
- Full academic citations below

### Acknowledgment Flow
- Each interaction has an "Acknowledged" button (never "Override")
- Framing: "you've reviewed this" — not "you're ignoring a warning"
- Acknowledged cards become visually muted (reduced opacity)
- Never language that implies the doctor is wrong

### Species Badge
Drug flag cards with species-specific warnings show a 🐕/🐈 badge with colored border, visible before expanding.

### Drug Advisory Flags
Per-drug cards showing: source (Korean vet, off-label, foreign, unknown), species warnings, MDR1 sensitivity, narrow therapeutic index.

### Scan Summary Card
Clean single-card summary after all results:
- Patient name, species, date
- Drugs screened, interactions found, severity breakdown
- Acknowledgment status (X of Y reviewed)
- Formatted cleanly enough to screenshot for a patient file

---

## Drug Pipeline — Six Cases

1. **Korean Approved Veterinary Drugs** — Full profiles, maximum confidence
2. **Human Drugs Used Off-Label** — Off-label advisory, confidence -5%
3. **Foreign Drugs** — Foreign drug badge, confidence -8%
4. **Unknown Drugs** — Prompts for active ingredient, confidence -25%, "Insufficient Data" labels
5. **Multi-Drug Combinations** — N×(N-1)/2 pairwise checks
6. **Species-Specific Adjustments** — Per-species dosing, pharmacokinetic differences, breed flags

---

## DUR Interaction Engine — 10 Rules

| Rule | Severity | Example | Alternative Suggestion |
|------|----------|---------|----------------------|
| Duplicate NSAID | Critical | Meloxicam + Carprofen | Gabapentin 10 mg/kg PO TID |
| NSAID + Corticosteroid GI Risk | Critical | Meloxicam + Prednisolone | Prednisolone alone + Omeprazole |
| Serotonin Syndrome Risk | Critical | Tramadol + Trazodone | Gabapentin 10 mg/kg PO TID |
| QT Prolongation Stacking | Critical | Digoxin + Enrofloxacin | Amoxicillin if spectrum allows |
| Electrolyte-Mediated DDI | Critical | Furosemide + Digoxin | Spironolactone + K+ supplementation |
| CYP3A4 Inhibition | Moderate | Ketoconazole + Cyclosporine | Fluconazole or 50% dose reduction |
| CYP2D6 Inhibition | Moderate | Fluoxetine + Tramadol | Gabapentin (non-CYP2D6) |
| Renal Elimination Stacking | Moderate | Amoxicillin + Gabapentin | Hepatically-cleared alternative |
| Bleeding Risk Stacking | Moderate | Meloxicam + Dexamethasone | Gabapentin + gastroprotection |
| CYP Enzyme Induction | Minor | Phenobarbital + Prednisolone | TDM and dose adjustment |

Each interaction includes: mechanism, clinical recommendation, alternative suggestion, plain-English literature summary, and academic citations.

---

## Drug Database — Pharmacokinetic Data

25+ drugs with full pharmacological profiles aligned with the backend PostgreSQL schema:

**Core fields:** Active substance, drug class, Korean name, CYP enzyme profiles, risk flags, renal elimination, species notes, contraindications, dose/route/frequency.

**PK parameters (new — aligned with backend `pk_parameters` table):**
- `halfLife` (hours) — drug elimination half-life
- `timeToPeak` (hours) — time to peak plasma concentration
- `bioavailability` (0-1) — fraction absorbed
- `proteinBinding` (0-1) — plasma protein binding
- `primaryElimination` — renal, hepatic, biliary, or mixed

These fields power the Drug Timeline feature and ensure the frontend data model aligns with the backend schema without requiring a live connection.

---

## Demo Breed Profiles

Seven pre-built clinical cases, each with a `demonstrates` descriptor:

### Dogs
| Breed | Patient | Demonstrates | Default Drugs |
|-------|---------|-------------|---------------|
| Golden Retriever | Buddy, 7y | NSAID gastroprotection in chronic pain | Meloxicam, Gabapentin, Omeprazole |
| Shetland Sheepdog | Max, 4y | MDR1 mutation + renal compromise | Prednisolone, Metronidazole, Enalapril |
| French Bulldog | Coco, 3y | Corticosteroid + antifungal CYP3A4 interaction | Prednisolone, Amoxicillin, Ketoconazole |
| Dachshund | Oscar, 9y | Serotonin syndrome risk in multimodal pain | Meloxicam, Gabapentin, Tramadol |

### Cats
| Breed | Patient | Demonstrates | Default Drugs |
|-------|---------|-------------|---------------|
| Domestic Shorthair | Mochi, 11y | Thyroid + renal drug management in senior cats | Methimazole, Amlodipine, Maropitant |
| Persian | Luna, 6y | Cardiac polypharmacy with electrolyte risk | Enalapril, Furosemide, Pimobendan |
| Siamese | Nabi, 8y | Serotonin risk + NSAID in anxious cats | Gabapentin, Trazodone, Meloxicam |

---

## Loading Experience

6-step sequential animation (unchanged):
1. Resolving drug identifiers
2. Querying Korean Veterinary DB (877 products)
3. CYP enzyme interaction analysis
4. Pairwise DDI screening
5. Species-specific dose verification
6. Cross-referencing literature (PMC, Plumb's, BSAVA)

---

## Technical Stack

- **React 18** with functional components and hooks
- **Vite 5** for build tooling
- **Tailwind CSS 3** for styling (no component library)
- **React Router v7** for client-side routing
- **Lucide React** for icons
- **Formspree** for lead capture form submission
- **Vercel** for deployment (SPA rewrites configured)

No external UI framework. No state management library. The interaction engine runs entirely client-side for the demo; the full system will connect to the backend PostgreSQL + Python DDI engine.
