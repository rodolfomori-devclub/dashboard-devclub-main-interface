/**
 * Pecas comuns do modelo da tela do lead: contexto, plano de passos de cada
 * cena e textos montados a partir dos dados (nomes, datas, material, numeros).
 * Nada aqui devolve marcadores como "[Nome]": sem dado, a linha some.
 */
import type {
  DiagnosisModel,
  DiagnosticContent,
  MaterialInfo,
  OfferEvaluation,
  OfferView,
  Quote,
  QuoteTag,
} from '@diag/types.ts';
import { areaPhrase } from '@diag/content.ts';
import { ymdToBR as ymdToBRStrict } from '@diag/dates.ts';
import type { Workspace } from '@/lib/diagnostic/workspace';
import type { SceneVM } from '@/lib/diagnostic/presentation';

export interface LeadViewContext {
  ws: Workspace;
  model: DiagnosisModel;
  content: DiagnosticContent;
  offer: OfferEvaluation;
}

export interface ScenePlan {
  /** Por que a cena ainda nao abre (texto para o cockpit). null = pronta. */
  reason: string | null;
  /** Chaves dos passos, na ordem. Vazio quando travada. */
  steps: string[];
}

export interface SceneDef<V extends SceneVM = SceneVM> {
  plan(ctx: LeadViewContext): ScenePlan;
  /** `step` ja vem limitado a 0..steps-1. */
  build(ctx: LeadViewContext, plan: ScenePlan, step: number): V;
}

export const ready = (steps: string[]): ScenePlan => ({ reason: null, steps });
export const locked = (reason: string): ScenePlan => ({ reason, steps: [] });

/** Chaves ja reveladas ate o passo atual (inclusive). */
export function revealedKeys(plan: ScenePlan, step: number): Set<string> {
  return new Set(plan.steps.slice(0, step + 1));
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

export const WEEKS_PER_YEAR = 48;

export function firstNameOf(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/** 'YYYY-MM-DD' -> 'dd/mm/aaaa' ('' se vazio ou invalido). Mesma regra do PDF. */
export function ymdToBR(ymd: string | null | undefined): string {
  return ymdToBRStrict((ymd || '').trim());
}

/** A frase mais recente com a marca pedida (empate: a capturada por ultimo). */
export function latestQuote(quotes: Quote[], tag: QuoteTag): Quote | null {
  let best: Quote | null = null;
  for (const q of quotes) {
    if (q.tag !== tag || !q.text.trim()) continue;
    if (!best || (q.at || '') >= (best.at || '')) best = q;
  }
  return best;
}

/** Quebra por palavras em linhas de ate `n` caracteres (mesma regra do gerador). */
export function wrapWords(text: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (`${line} ${word}`.trim().length > n) {
      if (line.trim()) out.push(line.trim());
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

export interface GiftText {
  /** "Kit de 3 prompts para financeiro" / "Aula: <titulo>". */
  title: string;
  /** Para o meio de uma frase: "o kit de 3 prompts para financeiro". */
  phrase: string;
  detail: string | null;
  /** Titulos dos prompts do kit. */
  items: string[];
}

/** Material de presente: aula so quando tem link, senao o kit de 3 prompts. */
export function giftOf(material: MaterialInfo): GiftText {
  if (material.type === 'aula') {
    const t = (material.lessonTitle || '').trim();
    const detail = 'Para aplicar no seu trabalho.';
    return t
      ? { title: `Aula: ${t}`, phrase: `a aula “${t}”`, detail, items: [] }
      : { title: 'Aula de IA aplicada à sua área', phrase: 'a aula de IA aplicada à sua área', detail, items: [] };
  }
  // A mesma frase do PDF e das mensagens ("financeiro", "o seu negócio", "a sua área").
  const area = material.areaPhrase || areaPhrase(material.areaLabel === 'sua área' ? '' : material.areaLabel);
  return {
    title: `Kit de 3 prompts para ${area}`,
    phrase: `o kit de 3 prompts para ${area}`,
    detail: 'Para testar no seu trabalho ainda esta semana.',
    items: (material.kit ?? []).map((k) => k.titulo.trim()).filter(Boolean).slice(0, 3),
  };
}

/** Credencial pela graduacao: nunca as duas juntas. */
export function credentialOf(ctx: LeadViewContext): string {
  if (ctx.model.credential) return ctx.model.credential;
  const t = ctx.content.texto_credencial;
  return ctx.ws.lead.graduation_status === 'nao' ? t.sem_graduacao : t.graduacao_concluida;
}

export function programLine(credential: string): string {
  return (
    `Pós-graduação em IA aplicada a negócios do Rodolfo Mori, embaixador da OpenAI no Brasil: ${credential}, ` +
    'extensão pela Arizona State University e mais de 30 certificações internacionais. ' +
    'Sem precisar programar, 6 a 10 horas por semana, com aulas gravadas.'
  );
}

/** "(11) 99999-0001"; formato desconhecido volta como veio. */
export function formatPhoneBR(raw: string): string {
  const trimmed = (raw || '').trim();
  let d = trimmed.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return trimmed;
}

/** Linha de bolsas restantes: so com numero confirmado pela Head. */
export function seatsLineOf(view: OfferView): string | null {
  if (view.seatsLeft == null || view.seatsLeft <= 0) return null;
  const n = new Intl.NumberFormat('pt-BR').format(view.seatsLeft);
  return view.seatsConfirmedOnBR
    ? `Bolsas restantes nesta turma: ${n} (confirmado em ${view.seatsConfirmedOnBR})`
    : `Bolsas restantes nesta turma: ${n}`;
}

export function commitmentOf(ws: Workspace): { text: string; due: string } {
  return { text: ws.diagnosis.commitment_text.trim(), due: ymdToBR(ws.diagnosis.commitment_due_date) };
}

export function missingScoresReason(model: DiagnosisModel, content: DiagnosticContent): string {
  const names = model.missingScores.map((id) => content.pilares.find((p) => p.id === id)?.nome_curto ?? id);
  return names.length ? `Faltam notas: ${names.join(', ')}.` : 'Dê as 5 notas antes da devolutiva.';
}
