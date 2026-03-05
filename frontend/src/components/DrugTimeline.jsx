import React from 'react';
import { Clock } from 'lucide-react';

const HOUR_MARKERS = [0, 6, 12, 18, 24];

function getDrugBarStyle(pk, color) {
  if (!pk || !pk.timeToPeak || !pk.halfLife) return null;

  // Start: absorption begins (0h), peak at timeToPeak, then decay over ~3 half-lives
  const peakHour = Math.min(pk.timeToPeak, 24);
  const decayEnd = Math.min(peakHour + pk.halfLife * 2, 24);
  const startPct = 0;
  const peakPct = (peakHour / 24) * 100;
  const endPct = (decayEnd / 24) * 100;
  const widthPct = endPct - startPct;

  return { startPct, peakPct, endPct, widthPct, peakHour, decayEnd };
}

export function DrugTimeline({ drugA, drugB }) {
  const pkA = drugA?.pk;
  const pkB = drugB?.pk;

  const barA = getDrugBarStyle(pkA, 'blue');
  const barB = getDrugBarStyle(pkB, 'red');

  if (!barA && !barB) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
        <Clock size={11} className="shrink-0" />
        <span>PK timeline data not available for these drugs</span>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={10} className="text-slate-400" />
        <span className="text-xs font-medium text-slate-500">24h Pharmacokinetic Window</span>
      </div>

      <div className="space-y-1.5">
        {/* Drug A bar */}
        {barA && (
          <TimelineBar
            name={drugA.name}
            bar={barA}
            pk={pkA}
            colorClass="bg-blue-400"
            peakColorClass="bg-blue-600"
            textColorClass="text-blue-700"
            bgColorClass="bg-blue-50"
          />
        )}
        {!barA && drugA && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-20 truncate font-medium text-slate-500">{drugA.name}</span>
            <span className="italic">No PK data</span>
          </div>
        )}

        {/* Drug B bar */}
        {barB && (
          <TimelineBar
            name={drugB.name}
            bar={barB}
            pk={pkB}
            colorClass="bg-amber-400"
            peakColorClass="bg-amber-600"
            textColorClass="text-amber-700"
            bgColorClass="bg-amber-50"
          />
        )}
        {!barB && drugB && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-20 truncate font-medium text-slate-500">{drugB.name}</span>
            <span className="italic">No PK data</span>
          </div>
        )}
      </div>

      {/* Hour axis */}
      <div className="relative h-4 mt-1 ml-[84px]">
        {HOUR_MARKERS.map((h) => (
          <span
            key={h}
            className="absolute text-[9px] text-slate-400 -translate-x-1/2"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {h}h
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineBar({ name, bar, pk, colorClass, peakColorClass, textColorClass, bgColorClass }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-20 text-xs font-medium truncate ${textColorClass}`}>{name}</span>
      <div className={`flex-1 relative h-5 ${bgColorClass} rounded overflow-hidden`}>
        {/* Concentration bar - gradient from absorption through peak to decay */}
        <div
          className={`absolute top-0 h-full rounded ${colorClass} opacity-60`}
          style={{
            left: `${bar.startPct}%`,
            width: `${bar.widthPct}%`,
          }}
        />
        {/* Peak marker */}
        <div
          className={`absolute top-0 h-full w-1 ${peakColorClass} rounded-sm`}
          style={{ left: `${bar.peakPct}%` }}
          title={`Peak: ${pk.timeToPeak}h`}
        />
        {/* Peak label */}
        <span
          className={`absolute top-0.5 text-[8px] font-semibold ${textColorClass}`}
          style={{ left: `${Math.min(bar.peakPct + 1.5, 85)}%` }}
        >
          peak {pk.timeToPeak}h
        </span>
        {/* Half-life trough marker */}
        {bar.endPct < 98 && (
          <span
            className="absolute top-0.5 text-[8px] text-slate-400"
            style={{ left: `${Math.min(bar.endPct + 1, 88)}%` }}
          >
            t½ {pk.halfLife}h
          </span>
        )}
      </div>
    </div>
  );
}
