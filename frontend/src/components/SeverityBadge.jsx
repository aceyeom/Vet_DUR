import React from 'react';
import { useI18n } from '../i18n';

const SEVERITY_STYLES = {
  Critical: 'bg-red-50 text-red-700 border-red-200',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  Minor: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  None: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Unknown: 'bg-slate-100 text-slate-600 border-slate-200',
};

const SEVERITY_DOT = {
  Critical: 'bg-red-500',
  Moderate: 'bg-amber-500',
  Minor: 'bg-yellow-500',
  None: 'bg-emerald-500',
  Unknown: 'bg-slate-400',
};

export function SeverityBadge({ severity, size = 'sm' }) {
  const { t } = useI18n();
  const label = severity?.label || severity || 'Unknown';
  const style = SEVERITY_STYLES[label] || SEVERITY_STYLES.Unknown;
  const dot = SEVERITY_DOT[label] || SEVERITY_DOT.Unknown;
  const translatedLabel =
    label === 'Critical'
      ? t.results.critical
      : label === 'Moderate'
      ? t.results.moderate
      : label === 'Minor'
      ? t.results.minor
      : label === 'None'
      ? t.results.none
      : label === 'Unknown'
      ? t.results.unknown
      : label;

  const sizeClasses = size === 'lg'
    ? 'px-3 py-1.5 text-sm'
    : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium border rounded-full ${style} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {translatedLabel}
    </span>
  );
}
