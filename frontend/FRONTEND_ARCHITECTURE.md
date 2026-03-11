# NuvoVet Frontend Architecture

## Product Overview

NuvoVet is a veterinary Drug Utilization Review (DUR) system that screens multi-drug prescriptions for interactions in companion animals (dogs and cats). The frontend is a mobile-first React/Vite web application designed to feel like clinical-grade medical software — not a consumer product.

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

Password-protected (`vetdur2025`). Same drug input and results UI without the guided flow. Drug search is backed by the FastAPI backend (`GET /api/drugs/search`), which searches the full 641-drug JSONL database. Falls back to local static data if the backend is unreachable.

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

28 curated drugs in `drugDatabase.js` for the demo and API fallback. The backend serves 641 drugs loaded from JSONL files. Both use the same frontend Drug contract (see `docs/backend_frontend_connection.md`).

Key fields:

**Core fields:** Active substance, drug class, Korean name, CYP enzyme profiles, risk flags, renal elimination, species notes, contraindications, dose/route/frequency, doseRange, organBurden, washoutPeriodDays.

**PK parameters (`pk` sub-object):**
- `halfLife` (hours) — drug elimination half-life
- `timeToPeak` (hours) — time to peak plasma concentration
- `bioavailability` (0-1) — fraction absorbed
- `proteinBinding` (0-1) — plasma protein binding
- `primaryElimination` — `'hepatic' | 'renal' | 'mixed'`

These fields power the Drug Timeline feature and match the JSONL → Drug contract served by the backend.

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

6-step sequential animation with optimized timing (~2.9s total, down from ~4.8s):

| Step | Duration | Description |
|------|----------|-------------|
| Initial delay | 200ms | — |
| Resolve drug identifiers | 350ms | Database lookup |
| Query Korean Veterinary DB | 450ms | 877 products |
| CYP enzyme interaction analysis | 400ms | Enzyme profiling |
| Pairwise DDI screening | 500ms | Interaction matrix |
| Species-specific dose verification | 350ms | Dose/weight check |
| Cross-reference literature | 400ms | PMC, Plumb's, BSAVA |
| Final transition | 250ms | — |

Visual progress bar at the bottom tracks completion percentage. Uses `useRef` for the `onComplete` callback to avoid stale closure issues.

---

## Internationalization (i18n)

### Architecture

React Context-based system (`I18nProvider`) with no external dependencies. Files:

```
src/i18n/
├── index.jsx    # Provider, useI18n hook, LangToggle component
├── en.js        # English translations (~250 keys)
└── ko.js        # Korean translations (~250 keys)
```

### Hook API

```jsx
const { t, lang, setLang, toggleLang } = useI18n();
```

- `t` — translation object, accessed as `t.demo.step1`, `t.results.title`, etc.
- `lang` — current language code (`'ko'` or `'en'`)
- `setLang(code)` — set language explicitly
- `toggleLang()` — toggle between ko/en

### LangToggle Component

Compact pill button (`한/EN`) that fits in any navbar. Renders inline with no layout shift.

### Design Decisions

- **Default language: Korean (`ko`)**. Korean veterinarians are the primary users. The Korean translation is the most complete and clinically accurate.
- **localStorage persistence** under key `nuvovet-lang`. Sets `document.documentElement.lang` for accessibility.
- **No library dependency** — React Context is sufficient for two languages with static translation objects.
- **Medical terminology**: Korean translations use proper clinical terms (e.g., `혈중농도-시간곡선하면적` for AUC, `최고혈중농도 도달시간` for Tmax, `치료역` for therapeutic window).

### Translation Key Namespaces

| Namespace | Coverage |
|-----------|----------|
| Global | `appName`, `back`, `close`, `search`, `loading`, etc. |
| `species` | Dog/cat labels in both forms |
| `landing` | Hero, features, stats, CTA sections |
| `demo` | All 4 demo steps, patient chart labels, vitals, conditions |
| `drugInput` | Search, category browsing, route filters, drug class labels |
| `analysis` | 6-step loading labels and subtitles |
| `results` | Summary band, interaction cards, acknowledgment, scan summary |
| `pk` | Pharmacokinetic chart labels and annotations |
| `drugClasses` | 11 drug class labels (NSAID, corticosteroid, antibiotic, etc.) |
| `routes` | Administration route labels (PO, SC, IV, Topical) |
| `requestAccess` | Modal form fields, success/error messages |
| `fullSystem` | Password gate, connected status |

---

## Drug Timeline — Clinical PK Visualization

### Pharmacokinetic Model

One-compartment Bateman equation with first-order absorption:

```
C(t) = F × (ka / (ka - ke)) × (e^(-ke·t) - e^(-ka·t))
```

Where:
- `F` = bioavailability
- `ka` = absorption rate constant (derived from Tmax)
- `ke` = elimination rate constant (`ln(2) / t½`)

### Multi-Dose Superposition

For BID/TID dosing schedules, concentrations are calculated by summing contributions from each dose administration time:

```
C_total(t) = Σ C_single(t - t_dose_i)  for all t_dose_i ≤ t
```

### Clinical Annotations

- **Cmax** — peak concentration marker (dot + label)
- **Tmax** — time to peak annotation
- **Cmin** — trough concentration at end of dosing interval
- **Therapeutic window** — green shaded band between `therapMin` and `therapMax`
- **Dose arrows** — vertical markers at each administration time

### PK Parameter Table

Rendered below the chart showing: Drug name, t½, Tmax, F%, and dosing schedule for each drug in the interaction pair.

### Visual Design

- SVG-based rendering (no external chart library)
- Drug A: solid slate-800 line with gradient fill
- Drug B: dashed indigo line with gradient fill
- Y-axis: `Cp (relative)` / `Cp (상대 농도)` with percentage ticks
- X-axis: 0–24h with 4h interval markers
- Gradient fills (SVG `linearGradient`) under concentration curves
- Graceful fallback message when PK data is unavailable

---

## Drug Search & Prescription Input

### Search Modes

1. **Text search** — type-ahead matching against drug name, generic name, Korean name, and drug class from both `drugDatabase.js` and `drugSearchData.js` catalogs.
2. **Category browsing** — when search text is empty, shows the full `DRUG_SEARCH_CATALOG` filtered by active class and route. Organized by `CLASS_GROUPS` (11 categories).

### Filter UI

Collapsible filter bar with two chip rows:
- **Class filter:** All, NSAID, Corticosteroid, Antibiotic, Antifungal, Antiemetic, Cardiac, Diuretic, Anxiolytic/Sedative, Anticonvulsant, GI Protectant
- **Route filter:** All, PO (Oral), SC (Subcutaneous), IV (Intravenous), Topical

Filters are pill-shaped chips with active state styling. All labels are translated via `t.drugClasses` and `t.routes`.

### Doctor Workflow Optimization

- Browse mode shows all available drugs organized by category, matching how doctors think about prescribing (by drug class, then route)
- Drug names display Korean names when `lang === 'ko'`
- Unknown drug flow with active ingredient entry for off-formulary medications
- Pre-populated drug lists from breed profiles in demo mode

---

## Typography System

CSS custom property hierarchy using Google Fonts (DM Sans, DM Mono):

| Class | Usage |
|-------|-------|
| `typo-page-title` | Page/section headings |
| `typo-section-header` | Step labels, card headers |
| `typo-body` | Body text, descriptions |
| `typo-label` | Field labels, metadata |
| `typo-mono` | Drug names, clinical data |
| `typo-stat` | Large statistics/counters |

---

## Print Optimization

CSS `@media print` styles for clinical report output:
- Hidden navigation, backgrounds, and interactive elements
- `print-color-adjust: exact` for severity color preservation
- Clean layout optimized for A4/Letter paper

---

## Technical Stack

- **React 18** with functional components and hooks
- **Vite 5** for build tooling
- **Tailwind CSS 3** for styling (no component library)
- **React Router v7** for client-side routing
- **Lucide React** for icons
- **Google Fonts** — DM Sans (UI), DM Mono (clinical data)
- **Formspree** for lead capture form submission
- **Vercel** for deployment (SPA rewrites configured)

No external UI framework. No state management library. No chart library — PK visualizations use pure SVG. The DUR engine runs client-side (`durEngine.js`) for sub-100ms response times in both demo and full system modes.

---

## Backend Connection

The `/system` route connects to a FastAPI backend. See `docs/backend_frontend_connection.md` for the full API contract.

```
Browser (React/Vite)
  ├── /demo route    → local static data only (drugDatabase.js, breedProfiles.js)
  └── /system route  → backend API (lib/api.js → FastAPI)
        ├── Drug search    → GET /api/drugs/search?q=&species=&limit=
        ├── Drug lookup    → GET /api/drugs/{id}
        └── DUR analysis   → POST /api/dur/analyze (optional mirror)

FastAPI (backend/main.py)
  └── Loads 641 drugs from backend/data/converted/**/*.jsonl at startup
  └── Maps JSONL schema → frontend Drug contract on every request
```

### API Client (`src/lib/api.js`)

All backend requests go through `apiFetch()`, which:
- Reads `VITE_API_URL` (default: `http://localhost:8000`)
- Wraps every call in `try/catch` — returns `null` on network failure
- Logs warnings in dev mode only

### Fallback Behavior

- `DrugInput.jsx` falls back to local `searchDrugs()` from `drugDatabase.js` if the API throws
- DUR analysis always runs client-side via `durEngine.js` regardless of backend availability
- `/demo` never calls the backend

---

## File Tree (`src/`)

```
src/
├── App.jsx                          # Router: /, /demo, /system
├── main.jsx
├── index.css
│
├── pages/
│   ├── Landing.jsx                  # Marketing page with 5 live mini-demos
│   ├── Demo.jsx                     # 4-step guided demo (local data)
│   └── FullSystem.jsx               # Full clinical UI (API-backed search)
│
├── components/
│   ├── Layout/
│   │   └── Header.jsx               # Sticky nav with lang toggle
│   ├── DrugInput.jsx                # Drug search + add (accepts optional async searchFn)
│   ├── ResultsDisplay.jsx           # DUR results — interaction cards, flags
│   ├── OrganLoadIndicator.jsx       # Radar/bar organ burden visualization
│   ├── SeverityBadge.jsx            # Critical/Moderate/Minor/None badge
│   ├── DrugTimeline.jsx             # SVG pharmacokinetic timeline
│   ├── AnalysisScreen.jsx           # Loading animation (6 steps)
│   ├── ConfidenceProvenance.jsx     # Confidence score + source breakdown
│   ├── ScanExportPDF.jsx            # Scan export button (browser print)
│   ├── MolecularBackground.jsx      # Animated SVG hero background
│   ├── RequestAccessModal.jsx       # Lead capture modal (Formspree)
│   └── NuvovetLogo.jsx              # SVG logo component
│
├── data/
│   ├── drugDatabase.js              # 28 curated drugs (demo + fallback)
│   ├── drugSearchData.js            # Full search catalog for DrugInput browse mode
│   ├── breedProfiles.js             # 7 breed clinical cases for demo
│   └── emrSchema.js                 # EMR field enums (sex, patient status)
│
├── utils/
│   └── durEngine.js                 # Client-side DUR rule engine (9 rules)
│
├── lib/
│   └── api.js                       # Async API client for FastAPI backend
│
└── i18n/
    ├── index.jsx                    # I18nProvider, useI18n hook, LangToggle
    ├── en.js                        # English translations
    └── ko.js                        # Korean translations (primary)
```
