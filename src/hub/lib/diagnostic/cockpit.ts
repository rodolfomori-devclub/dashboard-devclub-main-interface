/**
 * Cockpit da call (tela privada do consultor): regras puras do roteiro ao vivo e
 * as transicoes do workspace que ele grava. Blocos, cronometros, modo curto,
 * captura minima, variaveis dos roteiros e atalhos. "Agora" chega por parametro.
 */
import type {
  CallBlock,
  CallBlockId,
  CallScript,
  DiagnosisInput,
  DiagnosisModel,
  DiagnosticContent,
  Graduation,
  NeedPriorityId,
  NewsItem,
  OfferSettings,
  PillarId,
  ScriptVarName,
  TemplateVars,
} from '@diag/types.ts';
import { suggestNews } from '@diag/archetype.ts';
import { findNews } from '@diag/content.ts';
import { isValidYmd } from '@diag/dates.ts';
import { normalizeText } from '@diag/guardrails.ts';
import { seatsClause } from '@diag/offer.ts';
import { fillTemplate, scriptVars } from '@diag/texts.ts';
import { hasOfferShown, MAX_NEWS_SHOWN } from '@/lib/diagnostic/presentationEffects';
import { isTypingTarget } from '@/lib/diagnostic/sceneShortcuts';
import {
  patchCallData,
  patchDiagnosis,
  patchSession,
  scoresOf,
  type CallData,
  type DiagnosisFields,
  type PrepConfig,
  type Workspace,
} from '@/lib/diagnostic/workspace';

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

type BlockLike = Pick<CallBlock, 'id'>;

/** Blocos na ordem da call (campo `ordem`). */
export function orderedBlocks(content: Pick<DiagnosticContent, 'call'>): CallBlock[] {
  return [...(content.call?.blocos ?? [])].sort((a, b) => a.ordem - b.ordem);
}

export function blockIndex(blocks: readonly BlockLike[], id: string | null | undefined): number {
  return blocks.findIndex((b) => b.id === id);
}

/** Modo curto: devolutiva (com o compromisso) e proximo passo (encerramento). */
export const SHORT_MODE_BLOCKS: readonly CallBlockId[] = ['devolutiva', 'proximo'];

export const isShortModeBlock = (id: string): boolean => (SHORT_MODE_BLOCKS as readonly string[]).includes(id);

/** Bloco seguinte; no modo curto so os blocos do modo curto. null no fim. */
export function nextBlock(blocks: readonly BlockLike[], id: string | null | undefined, shortMode = false): CallBlockId | null {
  for (let i = blockIndex(blocks, id) + 1; i < blocks.length; i++) {
    if (!shortMode || isShortModeBlock(blocks[i].id)) return blocks[i].id;
  }
  return null;
}

/** "Título: complemento" -> "Título" (faixa de blocos na coluna estreita). */
export function shortTitle(block: Pick<CallBlock, 'titulo'>): string {
  return block.titulo.split(':')[0].trim() || block.titulo;
}

/** Pilares do bloco sem pergunta propria: a nota fica depois das perguntas. */
export function uncoveredPillars(block: Pick<CallBlock, 'pilares' | 'perguntas'>): PillarId[] {
  const asked = new Set((block.perguntas ?? []).map((q) => q.pilar).filter(Boolean));
  return (block.pilares ?? []).filter((p) => !asked.has(p));
}

// ---------------------------------------------------------------------------
// Perguntas e checklist
// ---------------------------------------------------------------------------

type SyncedFlag = 'costStated' | 'pathPermitted';

/** Itens do checklist que sao o mesmo fato de um switch do cockpit: andam juntos. */
export const CHECKLIST_FLAGS: Readonly<Record<string, SyncedFlag>> = {
  custo: 'costStated',
  permissao_caminho: 'pathPermitted',
};

function flagOf(id: string): SyncedFlag | null {
  return Object.prototype.hasOwnProperty.call(CHECKLIST_FLAGS, id) ? CHECKLIST_FLAGS[id] : null;
}

/** Pergunta ou item marcado. Nos itens espelhados vale o campo da ficha (destrava cenas). */
export function isChecked(callData: CallData, id: string): boolean {
  const flag = flagOf(id);
  return flag ? callData[flag] === true : !!callData.ticks?.[id];
}

/** Visitado durante a call e com o checklist completo. */
export function isBlockDone(block: Pick<CallBlock, 'id' | 'checklist'>, callData: CallData): boolean {
  return !!callData.blockStartedAt?.[block.id] && (block.checklist ?? []).every((item) => isChecked(callData, item.id));
}

/** Marca (guardando a hora da primeira marcacao) ou desmarca, sincronizando o switch espelhado. */
export function setChecked(ws: Workspace, id: string, checked: boolean, nowIso: string): Workspace {
  const cd = ws.diagnosis.call_data;
  const ticks = { ...cd.ticks };
  if (checked) ticks[id] = cd.ticks[id] || nowIso;
  else delete ticks[id];
  const patch: Partial<CallData> = { ticks };
  const flag = flagOf(id);
  if (flag) patch[flag] = checked;
  return patchCallData(ws, patch);
}

// ---------------------------------------------------------------------------
// Tempo da call
// ---------------------------------------------------------------------------

/** Segundos entre o inicio e o fim (ou agora). null sem inicio valido. */
export function elapsedSeconds(startIso: string | null | undefined, nowMs: number, endIso?: string | null): number | null {
  const start = startIso ? Date.parse(startIso) : NaN;
  if (!Number.isFinite(start)) return null;
  const parsedEnd = endIso ? Date.parse(endIso) : NaN;
  const end = Number.isFinite(parsedEnd) ? parsedEnd : nowMs;
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** 754 -> '12:34'; 3725 -> '1:02:05'. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export type TimerTone = 'idle' | 'ok' | 'warn' | 'over';

/** Tolerancia ambar antes do vermelho. */
export const TIMER_GRACE_SEC = 120;

/**
 * Cor do cronometro (so informa, nunca muda bloco nem cena): dentro da janela
 * do roteiro, ate 2 min acima, ou alem. 'block' mede o tempo no bloco contra a
 * duracao prevista (min_fim - min_inicio); 'call' mede o tempo de call contra o
 * fim previsto do bloco atual (min_fim).
 */
export function timerTone(
  elapsedSec: number | null,
  block: Pick<CallBlock, 'min_inicio' | 'min_fim'> | null | undefined,
  scope: 'block' | 'call' = 'block',
): TimerTone {
  if (elapsedSec == null || !Number.isFinite(elapsedSec) || !block) return 'idle';
  const limitMin = scope === 'call' ? block.min_fim : block.min_fim - block.min_inicio;
  if (!Number.isFinite(limitMin) || limitMin < 0) return 'idle';
  const limit = limitMin * 60;
  if (elapsedSec <= limit) return 'ok';
  return elapsedSec <= limit + TIMER_GRACE_SEC ? 'warn' : 'over';
}

/** Passou do limite (30 min) antes da devolutiva e ainda nao esta no modo curto. */
export function shouldOfferShortMode(
  elapsedMin: number | null,
  callData: CallData,
  content: Pick<DiagnosticContent, 'call'>,
): boolean {
  if (elapsedMin == null || !Number.isFinite(elapsedMin) || callData.shortMode) return false;
  const limit = content.call?.minutos_modo_curto;
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0 || elapsedMin < limit) return false;
  const blocks = orderedBlocks(content);
  const devolutiva = blockIndex(blocks, 'devolutiva');
  return devolutiva >= 0 && blockIndex(blocks, callData.currentBlock) < devolutiva;
}

// ---------------------------------------------------------------------------
// Captura minima: 1 frase, 5 notas, compromisso e data
// ---------------------------------------------------------------------------

export interface CaptureStatus {
  quotes: number;
  scores: number;
  commitment: boolean;
  dueDate: boolean;
  complete: boolean;
}

const isScore = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;

export function captureStatus(ws: Workspace): CaptureStatus {
  const quotes = ws.diagnosis.quotes.filter((q) => q.text.trim()).length;
  const scores = Object.values(scoresOf(ws)).filter(isScore).length;
  const commitment = ws.diagnosis.commitment_text.trim() !== '';
  const dueDate = isValidYmd(ws.diagnosis.commitment_due_date ?? '');
  return { quotes, scores, commitment, dueDate, complete: quotes >= 1 && scores === 5 && commitment && dueDate };
}

// ---------------------------------------------------------------------------
// Roteiros e variaveis
// ---------------------------------------------------------------------------

/**
 * Roteiros do bloco para esta graduacao (sem `quando`: vale para todos). Turma
 * sem bolsas, ou pitch e proximo passo com a graduacao a confirmar: o roteiro de
 * quem esta cursando (sem pos e sem bolsa), como na tela do lead.
 */
export function scriptsForBlock(
  block: Pick<CallBlock, 'id' | 'roteiros'>,
  graduation: Graduation,
  opts: { soldOut?: boolean } = {},
): CallScript[] {
  const singlePath = graduation === 'cursando' || graduationPending(block.id, graduation) || (opts.soldOut === true && block.id === 'proximo');
  const when = singlePath ? 'cursando' : 'nao_cursando';
  return (block.roteiros ?? []).filter((r) => !r.quando || r.quando === when);
}

/** Mesmo motivo da tela do lead: caminho e bolsa travam ate a graduacao ser confirmada. */
export const GRADUATION_FIRST = 'Confirme a graduação antes: ela define o que pode ser mostrado.';

/** Blocos que falam da pos ou da bolsa. */
const GRADUATION_GATED: readonly CallBlockId[] = ['pitch', 'proximo'];

/** Graduacao ainda nao confirmada num bloco que fala da pos ou da bolsa. */
export function graduationPending(blockId: string, graduation: Graduation): boolean {
  return graduation === '' && (GRADUATION_GATED as readonly string[]).includes(blockId);
}

const VAR_HINTS: Record<ScriptVarName, string> = {
  nome: 'preencha o nome na preparação',
  consultor: 'seu nome na preparação',
  sdr: 'nome do SDR na preparação',
  tempo_cargo: 'tempo no cargo na preparação',
  gatilho: 'o que o fez aplicar, na preparação',
  como_usa_ia: 'anote como ele usa IA (Situação)',
  nota_decisao: 'nota de decisão dada ao SDR',
  pilar_forte: 'dê as 5 notas',
  pilar_fraco: 'dê as 5 notas',
  frase: 'guarde uma frase dele',
  causa_raiz: 'escreva a causa raiz',
  movimento_1: 'dê as 5 notas',
  area: 'área na preparação',
  material: 'área na preparação',
  material_curto: 'área na preparação',
  objetivo: 'objetivo de 12 meses na preparação',
  data_compromisso: 'defina o compromisso',
  trava: 'dê as 5 notas',
  clausula_vagas: 'bolsas da turma',
};

/** O que preencher para a variavel aparecer no roteiro (chip no lugar dela). */
export function missingVarHint(name: string, opts: { scoresComplete?: boolean } = {}): string {
  if (opts.scoresComplete && (name === 'pilar_forte' || name === 'pilar_fraco' || name === 'trava')) {
    return 'notas iguais: fale dos 5 pontos juntos';
  }
  const hint = Object.prototype.hasOwnProperty.call(VAR_HINTS, name) ? VAR_HINTS[name as ScriptVarName] : '';
  return hint || `preencha ${name.replace(/_/g, ' ')}`;
}

/** Resposta da primeira pergunta da Situacao que revela o Dominio de IA ({{como_usa_ia}}). */
export function aiUseAnswer(content: Pick<DiagnosticContent, 'call'>, callData: CallData): string | null {
  const block = (content.call?.blocos ?? []).find((b) => b.id === 'situacao');
  const question = block?.perguntas.find((q) => q.pilar === 'uso');
  const answer = question ? callData.answers?.[question.id] : undefined;
  return typeof answer === 'string' && answer.trim() ? answer.trim() : null;
}

export function featuredQuoteText(ws: Workspace): string | null {
  const id = ws.diagnosis.call_data.featuredQuoteId;
  const quote = id ? ws.diagnosis.quotes.find((q) => q.id === id) : undefined;
  return quote && quote.text.trim() ? quote.text.trim() : null;
}

/** Minusculas mantendo siglas ('Domínio prático de IA' -> 'domínio prático de IA'), como texts.ts. */
export function lowerKeepAcronyms(s: string): string {
  return s
    .split(' ')
    .map((word) => {
      const letters = word.replace(/[^\p{L}]/gu, '');
      const acronym = letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
      return acronym ? word : word.toLowerCase();
    })
    .join(' ');
}

/** Nome do pilar para o meio da frase; null para 'confianca' ou id desconhecido. */
export function pillarPhrase(content: Pick<DiagnosticContent, 'pilares'>, id: string): string | null {
  const pillar = (content.pilares ?? []).find((p) => p.id === id);
  return pillar ? lowerKeepAcronyms(pillar.nome) : null;
}

/** {{trava}}: a trava dele que bate com o que pesa mais; sem isso, o padrao de scriptVars. */
export function travaLabel(
  content: Pick<DiagnosticContent, 'necessidade_prioridades'>,
  model: DiagnosisModel,
  needPriority: NeedPriorityId | null,
): string | null {
  if (!needPriority || !model.complete) return null;
  const priority = (content.necessidade_prioridades ?? []).find((p) => p.id === needPriority);
  const hit = model.blockers.find((p) => priority?.pilares.includes(p.id));
  return hit ? lowerKeepAcronyms(hit.nome) : null;
}

export function cockpitScriptVars(args: {
  ws: Workspace;
  input: DiagnosisInput;
  model: DiagnosisModel;
  content: DiagnosticContent;
  settings: OfferSettings;
  nowMs: number;
}): TemplateVars {
  const { ws, input, model, content, settings, nowMs } = args;
  const cd = ws.diagnosis.call_data;
  return scriptVars(input, model, {
    featuredQuote: featuredQuoteText(ws),
    aiUseAnswer: aiUseAnswer(content, cd),
    seatsClause: seatsClause(settings, nowMs),
    trava: travaLabel(content, model, cd.needPriority),
  });
}

export type TemplatePart = { kind: 'text'; text: string } | { kind: 'missing'; name: string };

const VAR_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * O template em pedacos para a tela: texto preenchido (mesma regra de
 * fillTemplate) e as variaveis sem valor, que viram chips.
 */
export function templateParts(tpl: string, vars: TemplateVars): TemplatePart[] {
  const parts: TemplatePart[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last && last.kind === 'text') last.text += text;
    else parts.push({ kind: 'text', text });
  };
  const source = String(tpl ?? '');
  let cursor = 0;
  for (const match of source.matchAll(VAR_RE)) {
    const at = match.index ?? 0;
    pushText(source.slice(cursor, at));
    const filled = fillTemplate(`{{${match[1]}}}`, vars);
    if (filled.missing.length) parts.push({ kind: 'missing', name: match[1] });
    else pushText(filled.text);
    cursor = at + match[0].length;
  }
  pushText(source.slice(cursor));
  return parts;
}

// ---------------------------------------------------------------------------
// Reportagens, preco e oferta
// ---------------------------------------------------------------------------

export interface PlannedNews {
  item: NewsItem;
  /** 'screen': tem link e pode ir para a Tela do lead. 'spoken': so citar falando. */
  mode: 'screen' | 'spoken';
  /** Nada planejado na preparacao: sugestao pelo perfil. */
  suggested: boolean;
}

/** As planejadas (tela e depois falar); sem plano, a sugestao do perfil. */
export function plannedNews(
  content: DiagnosticContent,
  prep: Pick<PrepConfig, 'newsScreen' | 'newsSpoken' | 'fearful'>,
  archetypeId: string,
): PlannedNews[] {
  const out: PlannedNews[] = [];
  const push = (id: string, wanted: 'screen' | 'spoken', suggested: boolean) => {
    const item = findNews(content, id);
    if (!item || out.some((o) => o.item.id === id)) return;
    const canScreen = item.na_tela && !!item.url;
    out.push({ item, mode: wanted === 'screen' && canScreen ? 'screen' : 'spoken', suggested });
  };
  prep.newsScreen.forEach((id) => push(id, 'screen', false));
  prep.newsSpoken.forEach((id) => push(id, 'spoken', false));
  if (!out.length) {
    const suggestion = suggestNews(content, archetypeId, prep.fearful);
    suggestion.screen.forEach((id) => push(id, 'screen', true));
    suggestion.spoken.forEach((id) => push(id, 'spoken', true));
  }
  return out;
}

/** "Citei"/"Mostrei": entra ou sai de news_shown_ids, no maximo 2 por call. */
export function toggleNewsShown(ws: Workspace, newsId: string): Workspace {
  const ids = ws.diagnosis.news_shown_ids;
  if (ids.includes(newsId)) return patchDiagnosis(ws, { news_shown_ids: ids.filter((id) => id !== newsId) });
  if (ids.length >= MAX_NEWS_SHOWN) return ws;
  return patchDiagnosis(ws, { news_shown_ids: [...ids, newsId] });
}

export const BOLSA_RULE = 'A bolsa só entra quando ele pedir, e depois de ele dizer o custo de ficar como está.';
const PRICE_FALLBACK = 'Volte para a Implicação antes de falar de preço.';

/** Lembrete do playbook quando ele pergunta o preco antes da hora. */
export function priceReminder(content: Pick<DiagnosticContent, 'call'>): string[] {
  const block = (content.call?.blocos ?? []).find((b) => b.id === 'proximo');
  const tips = (block?.dicas ?? []).filter((d) => /preco|implicacao/.test(normalizeText(d)));
  return [...(tips.length ? tips : [PRICE_FALLBACK]), BOLSA_RULE];
}

/** Por que "Ele pediu para ver a bolsa" nao pode ser registrado agora; null quando pode. */
export function offerRequestBlocked(graduation: Graduation, soldOut: boolean): string | null {
  if (graduation === 'cursando') return 'Quem está cursando graduação não entra na bolsa.';
  if (graduation === '') return GRADUATION_FIRST;
  return soldOut ? 'Sem bolsas restantes nesta turma.' : null;
}

/** "Ele pediu para ver a bolsa": registra o pedido uma vez, so quando a bolsa pode entrar. */
export function requestOffer(ws: Workspace, nowIso: string, soldOut = false): Workspace {
  if (offerRequestBlocked(ws.lead.graduation_status, soldOut)) return ws;
  const chosen = ws.diagnosis.call_data.nextStepChoice === 'bolsa' ? ws : patchCallData(ws, { nextStepChoice: 'bolsa' });
  return ws.diagnosis.offer_requested_at ? chosen : patchDiagnosis(chosen, { offer_requested_at: nowIso });
}

/** Pedido registrado por engano: desfaz enquanto a tela do lead nao mostrou a oferta. */
export function cancelOfferRequest(ws: Workspace): Workspace {
  if (!ws.diagnosis.offer_requested_at || hasOfferShown(ws.diagnosis.offer_shown)) return ws;
  const cleared = ws.diagnosis.call_data.nextStepChoice === 'bolsa' ? patchCallData(ws, { nextStepChoice: null }) : ws;
  return patchDiagnosis(cleared, { offer_requested_at: null });
}

// ---------------------------------------------------------------------------
// Inicio da call e troca de bloco
// ---------------------------------------------------------------------------

const callRunning = (ws: Workspace): boolean => !!ws.session.call_started_at && !ws.session.call_ended_at;

/** Liga o cronometro. Sem bloco iniciado ainda, a call comeca pela abertura. */
export function startCall(ws: Workspace, nowIso: string): Workspace {
  if (ws.session.call_started_at) return ws;
  const cd = ws.diagnosis.call_data;
  const fresh = Object.keys(cd.blockStartedAt ?? {}).length === 0;
  const started = patchSession(ws, { call_started_at: nowIso, call_ended_at: null });
  return patchCallData(started, {
    currentBlock: fresh ? 'abertura' : cd.currentBlock,
    blockStartedAt: { ...cd.blockStartedAt, abertura: cd.blockStartedAt?.abertura ?? nowIso },
  });
}

/**
 * Vai para o bloco. O inicio do bloco so e marcado com a call rodando (e so na
 * primeira vez): navegar antes de "Iniciar call" nao liga cronometro de bloco.
 */
export function enterBlock(ws: Workspace, id: CallBlockId, nowIso: string): Workspace {
  const cd = ws.diagnosis.call_data;
  const stamp = callRunning(ws) && !cd.blockStartedAt?.[id];
  if (cd.currentBlock === id && !stamp) return ws;
  return patchCallData(ws, {
    currentBlock: id,
    ...(stamp ? { blockStartedAt: { ...cd.blockStartedAt, [id]: nowIso } } : {}),
  });
}

export function enterShortMode(ws: Workspace, nowIso: string): Workspace {
  return enterBlock(patchCallData(ws, { shortMode: true }), 'devolutiva', nowIso);
}

/** Patch do CommitmentEditor -> colunas do diagnostico. */
export function commitmentPatch(p: { text?: string; dueDate?: string | null; movement?: string }): Partial<DiagnosisFields> {
  const out: Partial<DiagnosisFields> = {};
  if (p.text !== undefined) out.commitment_text = p.text;
  if (p.dueDate !== undefined) out.commitment_due_date = p.dueDate || null;
  if (p.movement !== undefined) out.commitment_movement = p.movement;
  return out;
}

// ---------------------------------------------------------------------------
// Atalhos de bloco: Alt+1..9 vai ao bloco N, Alt+N ao proximo
// ---------------------------------------------------------------------------

export type BlockShortcut = { kind: 'jump'; index: number } | { kind: 'next' };

export interface BlockKeyLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
  target: EventTarget | null;
}

/**
 * Pela posicao da tecla (`code`): no Mac, Alt+1 vira outro caractere. Mesma
 * regra dos atalhos de cena: nada com a tecla segurada nem digitando.
 */
export function blockShortcutFor(e: BlockKeyLike): BlockShortcut | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return null;
  if (isTypingTarget(e.target)) return null;
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (digit) return { kind: 'jump', index: Number(digit[1]) - 1 };
  return e.code === 'KeyN' ? { kind: 'next' } : null;
}
