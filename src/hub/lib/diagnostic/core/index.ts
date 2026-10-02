/**
 * Ponto de entrada do modulo do diagnostico (TypeScript puro, sem React).
 * `import { deriveDiagnosis } from '@diag/index.ts'`. O mesmo modulo vive no
 * Hub original em supabase/functions/_shared/diagnostic.
 */
export * from './types.ts';
export * from './dates.ts';
export * from './content.ts';
export * from './derive.ts';
export * from './texts.ts';
export * from './guardrails.ts';
export * from './archetype.ts';
export * from './offer.ts';
export * from './html.ts';
export * from './pdfCss.ts';
export * from './mindMap.ts';
export * from './pdfHtml.ts';
