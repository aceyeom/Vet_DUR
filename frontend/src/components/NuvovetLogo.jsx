import React from 'react';
import brandLogo from '../assets/branding/brand-logo.png';

export function NuvovetLogo({ size = 28, className = '' }) {
  return (
    <img
      src={brandLogo}
      alt="nuvovet logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}

export function NuvovetWordmark({ className = '' }) {
  return (
    <span className={`text-[22px] font-black tracking-[-0.045em] text-slate-900 leading-none select-none ${className}`}>
      nuvovet
    </span>
  );
}

export function NuvovetBrand({ size = 28, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <NuvovetLogo size={size} />
      <NuvovetWordmark />
    </div>
  );
}
