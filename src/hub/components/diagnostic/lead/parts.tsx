/** Pecas pequenas da tela do lead. */
import type { ReactNode } from 'react';
import type { Level } from '@diag/types.ts';
import { LEVEL_LABEL } from './format';

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="lead-eyebrow">{children}</p>;
}

export function LevelChip({ level }: { level: Level }) {
  return <span className={`lead-lv lead-lv-${level}`}>{LEVEL_LABEL[level]}</span>;
}

export function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DotIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill="currentColor" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" fill="none" aria-hidden="true">
      <path d="M2 12h28M22 4l9 8-9 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Numerada com o circulo ocre do plano do PDF. */
export function NumberedItem({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="lead-list-item lead-reveal">
      <span className="lead-num">{n}</span>
      <span>{children}</span>
    </li>
  );
}

export function ChosenTag() {
  return <span className="lead-tag">Sua escolha</span>;
}
