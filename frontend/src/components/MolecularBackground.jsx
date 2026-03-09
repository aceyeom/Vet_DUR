import React from 'react';

// ──────────────────────────────────────────────────────────────────
// Analytical PK-chart background — three pharmacokinetic curves
// on chart-paper grid lines, with frame marks and a slow scan bar.
//
// Key behaviours:
//  • The wrapper starts at opacity:0 and CSS-fades to opacity:1 over
//    1.8 s — prevents any dark flash on initial render before SMIL
//    animations kick in.
//  • Every SVG element carries an explicit presentational opacity
//    matching its animation start value, so the first animation frame
//    is always correct (no jump from default opacity:1).
//  • Left-side mask extends to 48 % — keeps the text column clean.
// ──────────────────────────────────────────────────────────────────

const GRID_Y = [22, 36, 50, 64, 78];

export function MolecularBackground({ className = '' }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      style={{ animation: 'mbFadeIn 1.8s ease-out forwards', opacity: 0 }}
    >
      <svg
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* CSS keyframe lives here so it doesn't pollute the global sheet */}
          <style>{`@keyframes mbFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

          {/* Mask: invisible on the left (text column), solid on the right */}
          <linearGradient id="mbFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="white" stopOpacity="0"    />
            <stop offset="48%"  stopColor="white" stopOpacity="0.55" />
            <stop offset="80%"  stopColor="white" stopOpacity="0.97" />
            <stop offset="100%" stopColor="white" stopOpacity="1"    />
          </linearGradient>
          <mask id="mbMask">
            <rect x="0" y="0" width="200" height="100" fill="url(#mbFade)" />
          </mask>
        </defs>

        <g mask="url(#mbMask)">

          {/* ── Chart-paper horizontal grid lines ─────────────── */}
          {GRID_Y.map((y, i) => (
            <line
              key={`g${i}`}
              x1="0" y1={y} x2="198" y2={y}
              stroke="#0f172a" strokeWidth="0.18"
              opacity="0.04"
            >
              <animate
                attributeName="opacity"
                values="0.04;0.08;0.04"
                dur={`${5.5 + i * 0.9}s`}
                begin={`${i * 0.5}s`}
                repeatCount="indefinite"
              />
            </line>
          ))}

          {/* ── Y-axis bar + tick marks ───────────────────────── */}
          <line x1="13" y1="15" x2="13" y2="85"
            stroke="#0f172a" strokeWidth="0.22" opacity="0.07" />
          {GRID_Y.map((y, i) => (
            <line key={`t${i}`}
              x1="11" y1={y} x2="15" y2={y}
              stroke="#0f172a" strokeWidth="0.22" opacity="0.08" />
          ))}

          {/* ── Drug A — fast absorb, high peak ─────────────────── */}
          <path
            d="M 13,80 C 55,80 105,18 150,18 C 168,18 188,66 198,70"
            fill="none" stroke="#0f172a" strokeWidth="0.28" strokeLinecap="round"
            opacity="0.10"
          >
            <animate attributeName="opacity"
              values="0.10;0.17;0.10" dur="7s" begin="0s" repeatCount="indefinite" />
          </path>
          <line x1="150" y1="19" x2="150" y2="80"
            stroke="#0f172a" strokeWidth="0.15"
            strokeDasharray="0.7 0.9" opacity="0.05" />
          <circle cx="150" cy="18" r="1.2" fill="#0f172a" opacity="0.15">
            <animate attributeName="opacity"
              values="0.15;0.36;0.15" dur="4s" begin="0.2s" repeatCount="indefinite" />
            <animate attributeName="r"
              values="1.0;1.52;1.0" dur="4s" begin="0.2s" repeatCount="indefinite" />
          </circle>

          {/* ── Drug B — medium absorb, moderate peak ───────────── */}
          <path
            d="M 13,80 C 62,80 118,33 160,33 C 176,33 190,63 198,67"
            fill="none" stroke="#0f172a" strokeWidth="0.28" strokeLinecap="round"
            opacity="0.08"
          >
            <animate attributeName="opacity"
              values="0.08;0.14;0.08" dur="8.5s" begin="1.2s" repeatCount="indefinite" />
          </path>
          <line x1="160" y1="34" x2="160" y2="80"
            stroke="#0f172a" strokeWidth="0.15"
            strokeDasharray="0.7 0.9" opacity="0.04" />
          <circle cx="160" cy="33" r="1.2" fill="#0f172a" opacity="0.13">
            <animate attributeName="opacity"
              values="0.13;0.30;0.13" dur="5s" begin="1.4s" repeatCount="indefinite" />
            <animate attributeName="r"
              values="1.0;1.46;1.0" dur="5s" begin="1.4s" repeatCount="indefinite" />
          </circle>

          {/* ── Drug C — slow absorb, broad peak ────────────────── */}
          <path
            d="M 13,80 C 72,80 132,41 170,41 C 183,41 192,61 198,65"
            fill="none" stroke="#0f172a" strokeWidth="0.28" strokeLinecap="round"
            opacity="0.07"
          >
            <animate attributeName="opacity"
              values="0.07;0.12;0.07" dur="10s" begin="0.6s" repeatCount="indefinite" />
          </path>
          <line x1="170" y1="42" x2="170" y2="80"
            stroke="#0f172a" strokeWidth="0.15"
            strokeDasharray="0.7 0.9" opacity="0.04" />
          <circle cx="170" cy="41" r="1.2" fill="#0f172a" opacity="0.11">
            <animate attributeName="opacity"
              values="0.11;0.27;0.11" dur="6s" begin="0.8s" repeatCount="indefinite" />
            <animate attributeName="r"
              values="0.9;1.40;0.9" dur="6s" begin="0.8s" repeatCount="indefinite" />
          </circle>

          {/* ── Scan bar — sweeps left → right, starts at opacity 0 ─ */}
          <line x1="0" y1="14" x2="0" y2="86"
            stroke="#0f172a" strokeWidth="0.25" opacity="0">
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="200 0"
              dur="12s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.13;0.13;0"
              keyTimes="0;0.04;0.92;1"
              dur="12s"
              repeatCount="indefinite"
            />
          </line>

          {/* ── Corner frame marks ───────────────────────────────── */}
          <path d="M 3,11 L 3,5 L 9,5"
            stroke="#0f172a" strokeWidth="0.32" fill="none"
            opacity="0.07" strokeLinecap="square" />
          <path d="M 191,5 L 197,5 L 197,11"
            stroke="#0f172a" strokeWidth="0.32" fill="none"
            opacity="0.07" strokeLinecap="square" />
          <path d="M 3,89 L 3,95 L 9,95"
            stroke="#0f172a" strokeWidth="0.32" fill="none"
            opacity="0.07" strokeLinecap="square" />
          <path d="M 191,95 L 197,95 L 197,89"
            stroke="#0f172a" strokeWidth="0.32" fill="none"
            opacity="0.07" strokeLinecap="square" />

        </g>
      </svg>
    </div>
  );
}
