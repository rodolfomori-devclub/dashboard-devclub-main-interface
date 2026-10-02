/**
 * Preparacao da sessao (antes da call): o checklist "Antes de comecar" e as
 * regras pequenas das telas de preparo (aplicacao, reportagens, cenas, tarefas,
 * oferta e padrao do vendedor). Puro: as telas chamam e gravam com api.update.
 */
import type { ApplicationAnswers, DiagnosisModel, DiagnosticContent, Graduation, InvestmentAnswer, NewsItem } from '@diag/types.ts';
import type { OfferConfig, OfferEvaluation, OfferProblem, OfferSettings, PaymentPath } from '@diag/types.ts';
import { normalizeText } from '@diag/guardrails.ts';
import { evaluateOffer } from '@diag/offer.ts';
import { hasNewsSource } from '@diag/content.ts';
import { sanitizePhone } from '@/lib/whatsapp';
import { buildLeadView, screenArticles, type LeadViewContext } from '@/lib/diagnostic/leadView';
import { WEEKS_PER_YEAR } from '@/lib/diagnostic/leadViewShared';
import { sceneMeta, sceneOrder, type SceneEntry, type SceneId } from '@/lib/diagnostic/presentation';
import { normalizePrepConfig, patchDiagnosis, patchOfferConfig, patchPrepConfig } from '@/lib/diagnostic/workspace';
import type { DiagnosisFields, LeadFields, PrepConfig, SceneToggle, Workspace } from '@/lib/diagnostic/workspace';

const filled = (s: string | null | undefined): boolean => typeof s === 'string' && s.trim() !== '';
const squash = (s: string): string => normalizeText(s ?? '').replace(/\s+/g, ' ').trim();

const MIN_PHONE_DIGITS = 10;
export const hasPhone = (raw: string): boolean => sanitizePhone(raw).length >= MIN_PHONE_DIGITS;

// --- Checklist "Antes de comecar" ---

export type ChecklistSeverity = 'block' | 'warn' | 'info';

export interface PrepChecklistItem {
  id: string;
  label: string;
  done: boolean;
  severity: ChecklistSeverity;
  /** O que falta ou por que importa (so nos itens em aberto). */
  hint?: string;
}

export const GRADUATION_LABEL: Record<Exclude<Graduation, ''>, string> = {
  concluida: 'concluída',
  cursando: 'cursando',
  nao: 'não tem',
};

/** Id do item manual da preparacao (content.call.preparacao) em call_data.ticks. */
export const prepTickId = (index: number): string => `prep_${index}`;

function graduationHint(lead: Graduation, sdr: Graduation): string | undefined {
  if (!lead && sdr) return `O SDR anotou "${GRADUATION_LABEL[sdr]}". Confirme na ficha do lead.`;
  if (!lead) return 'Muda a credencial do PDF e o que você pode mostrar no fim da call.';
  if (sdr && sdr !== lead) {
    return `A ficha diz "${GRADUATION_LABEL[lead]}" e o SDR anotou "${GRADUATION_LABEL[sdr]}". Confira com ele.`;
  }
  return undefined;
}

const missingList = (parts: string[]): string =>
  parts.length > 1 ? `Faltam ${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}.` : `Falta ${parts[0]}.`;

/** Caminho sem nome, sem valor ou com parcelas invalidas (aparece mal na tela da bolsa). */
export const isIncompletePath = (p: PaymentPath): boolean =>
  !filled(p.label) || !(p.total > 0) || !(Number.isInteger(p.installments) && p.installments >= 1);

/**
 * O que conferir antes de abrir a call. 'block' pede confirmacao para comecar
 * (a call funciona assim mesmo), 'warn' avisa, 'info' sao os itens manuais
 * do playbook que o consultor marca.
 */
export function prepChecklist(
  ws: Workspace,
  model: DiagnosisModel,
  offer: OfferEvaluation,
  content: DiagnosticContent,
): PrepChecklistItem[] {
  const { lead, qualification: q, diagnosis: d } = ws;
  const enabled = new Map(sceneOrder(d.prep_config).map((s) => [s.id, s.enabled]));
  const items: PrepChecklistItem[] = [];
  const push = (id: string, label: string, severity: ChecklistSeverity, done: boolean, hint?: string) => {
    items.push(done || !hint ? { id, label, severity, done } : { id, label, severity, done, hint });
  };

  push('lead_name', 'Nome do lead', 'block', filled(lead.name), 'Vai no diagnóstico e na tela dele.');

  push(
    'lead_whatsapp',
    'WhatsApp para a entrega',
    'warn',
    hasPhone(lead.whatsapp),
    filled(lead.whatsapp) ? 'Confira o número: DDD e número.' : 'É por onde o diagnóstico chega depois da call.',
  );

  const roleMissing = [!filled(lead.job_title) && 'cargo', !filled(lead.area) && 'área'].filter(Boolean) as string[];
  push('role_area', 'Cargo e área', 'warn', roleMissing.length === 0, roleMissing.length ? missingList(roleMissing) : undefined);

  push('goal', 'Objetivo de 12 meses', 'warn', filled(lead.goal_12m), 'Fica no centro do mapa do diagnóstico.');

  const gradHint = graduationHint(lead.graduation_status, q.graduation_confirmed);
  push('graduation', 'Graduação confirmada', 'block', !gradHint, gradHint);

  push(
    'profile',
    'Perfil confirmado',
    'warn',
    d.prep_config.archetypeConfirmed && filled(d.archetype_id),
    'Define a causa raiz e as reportagens sugeridas.',
  );

  if (enabled.get('mercado')) {
    const ctx: LeadViewContext = { ws, model, content, offer };
    push(
      'news_screen',
      'Reportagem para a tela',
      'warn',
      screenArticles(ctx).length > 0,
      'A cena "O mercado" está ligada: marque ao menos 1 reportagem com link como "Na tela".',
    );
  }

  // Sem bolsas restantes a cena nao abre: nao ha oferta a montar. "Montada" olha
  // o que o vendedor digitou; a vista (offer.view) esconde valores fora das regras.
  if (enabled.get('bolsa') && model.eligible && !offer.view.soldOut) {
    const config = d.prep_config.offer;
    const built = (typeof config.finalPrice === 'number' && config.finalPrice > 0) || config.paths.length > 0;
    const incomplete = config.paths.some(isIncompletePath);
    const problems = offer.problems.filter((p) => p.code !== 'seats_stale');
    const hint = !built
      ? 'Valor com bolsa ou um caminho de pagamento, para o caso de ele pedir.'
      : incomplete
        ? 'Complete os caminhos de pagamento: nome e valor.'
        : problems[0]?.message;
    push('offer', 'Oferta da bolsa montada', 'warn', built && !incomplete && problems.length === 0, hint);
  }

  const sellerMissing = [!filled(d.consultant_name) && 'seu nome', !hasPhone(d.consultant_whatsapp) && 'seu WhatsApp'].filter(
    Boolean,
  ) as string[];
  push(
    'consultant',
    'Seu nome e WhatsApp',
    'warn',
    sellerMissing.length === 0,
    sellerMissing.length ? `${missingList(sellerMissing)} Vão no diagnóstico e no encerramento.` : undefined,
  );

  (content.call?.preparacao ?? []).forEach((text, i) => {
    const id = prepTickId(i);
    items.push({ id, label: text, severity: 'info', done: !!d.call_data.ticks[id] });
  });

  return items;
}

/** Itens 'block' em aberto: pedem confirmacao antes de comecar a call. */
export const openBlockers = (items: PrepChecklistItem[]): PrepChecklistItem[] =>
  items.filter((i) => i.severity === 'block' && !i.done);

/** Marca ou desmarca um item (id -> ISO de quando foi marcado). */
export function toggleTick(ticks: Record<string, string>, id: string, nowIso: string): Record<string, string> {
  const next = { ...ticks };
  if (next[id]) delete next[id];
  else next[id] = nowIso;
  return next;
}

// --- Aplicacao ---

/** Respostas da aplicacao no formato da sugestao de perfil. */
export function applicationAnswersOf(lead: LeadFields): ApplicationAnswers {
  return {
    area: lead.area,
    momento: lead.career_moment,
    tempo_cargo: lead.time_in_role,
    ultima_promocao: lead.last_promotion,
    gatilho: lead.trigger_event,
    objetivo: lead.goal_12m,
    frequencia_ia: lead.ai_frequency,
    usos_ia: lead.ai_uses,
    cargo: lead.job_title,
  };
}

const FEARFUL_TRIGGER = 'Tenho medo de perder espaço para quem usa IA';

/** Gatilho da aplicacao que sugere ligar "lead com medo" (nunca liga sozinho). */
export const triggerSuggestsFearful = (trigger: string): boolean => squash(trigger) === squash(FEARFUL_TRIGGER);

export function applicationOptions(content: DiagnosticContent, questionId: string): string[] {
  const q = (content.aplicacao?.perguntas ?? []).find((p) => p.id === questionId);
  return (q?.opcoes ?? []).filter((o) => typeof o === 'string' && o.trim() !== '');
}

export interface ValueOption<V extends string> {
  value: V;
  label: string;
}

/** Rotulos da aplicacao para valores fixos do banco; o que faltar no conteudo usa o padrao. */
function mappedOptions<V extends string>(
  options: string[],
  byAnswer: Record<string, V>,
  fallback: ValueOption<V>[],
): ValueOption<V>[] {
  const out: ValueOption<V>[] = [];
  for (const label of options) {
    const value = byAnswer[squash(label)];
    if (value && !out.some((o) => o.value === value)) out.push({ value, label });
  }
  for (const f of fallback) if (!out.some((o) => o.value === f.value)) out.push(f);
  return out;
}

export function graduationOptions(content: DiagnosticContent): ValueOption<Exclude<Graduation, ''>>[] {
  return mappedOptions(
    applicationOptions(content, 'graduacao'),
    { sim: 'concluida', 'estou cursando': 'cursando', nao: 'nao' },
    [
      { value: 'concluida', label: 'Sim' },
      { value: 'cursando', label: 'Estou cursando' },
      { value: 'nao', label: 'Não' },
    ],
  );
}

export function investmentOptions(content: DiagnosticContent): ValueOption<Exclude<InvestmentAnswer, ''>>[] {
  return mappedOptions(
    applicationOptions(content, 'investimento'),
    { sim: 'sim', 'preciso me organizar': 'organizar', 'nao no momento': 'nao' },
    [
      { value: 'sim', label: 'Sim' },
      { value: 'organizar', label: 'Preciso me organizar' },
      { value: 'nao', label: 'Não no momento' },
    ],
  );
}

// --- Reportagens: na tela + so falar <= 2 ---

export const MAX_PREP_NEWS = 2;
export type NewsMode = 'tela' | 'falar' | 'fora';
type NewsLists = Pick<PrepConfig, 'newsScreen' | 'newsSpoken'>;

/** So reportagem marcada para a tela e com link pode aparecer na tela do lead. */
export const canGoOnScreen = (item: Pick<NewsItem, 'na_tela' | 'url'>): boolean => item.na_tela === true && hasNewsSource(item);

export function newsModeOf(prep: NewsLists, id: string): NewsMode {
  if (prep.newsScreen.includes(id)) return 'tela';
  if (prep.newsSpoken.includes(id)) return 'falar';
  return 'fora';
}

export const newsCount = (prep: NewsLists): number => new Set([...prep.newsScreen, ...prep.newsSpoken]).size;

/** Novo par de listas, ou null quando nada muda (sem vaga, ou "na tela" sem link). */
export function setNewsMode(prep: NewsLists, item: Pick<NewsItem, 'id' | 'na_tela' | 'url'>, mode: NewsMode): NewsLists | null {
  if (newsModeOf(prep, item.id) === mode) return null;
  if (mode !== 'fora' && !hasNewsSource(item)) return null;
  if (mode === 'tela' && !canGoOnScreen(item)) return null;
  const screen = prep.newsScreen.filter((x) => x !== item.id);
  const spoken = prep.newsSpoken.filter((x) => x !== item.id);
  if (mode === 'fora') return { newsScreen: screen, newsSpoken: spoken };
  if (new Set([...screen, ...spoken]).size >= MAX_PREP_NEWS) return null;
  return mode === 'tela'
    ? { newsScreen: [...screen, item.id], newsSpoken: spoken }
    : { newsScreen: screen, newsSpoken: [...spoken, item.id] };
}

// --- Diferenciais e listas com limite ---

export const MAX_PREP_DIFFERENTIALS = 3;

/** Liga/desliga um id; na lotacao, devolve a mesma lista. */
export function toggleLimited(list: string[], id: string, max: number): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length >= max ? list : [...list, id];
}

/** Acrescenta um texto sem repetir (sem acento e sem caixa); na lotacao, a mesma lista. */
export function addUnique(list: string[], text: string, max: number): string[] {
  const clean = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!clean || list.length >= max) return list;
  return list.some((x) => squash(x) === squash(clean)) ? list : [...list, clean];
}

// --- Cenas da tela do lead ---

export function moveScene(entries: SceneEntry[], index: number, delta: number): SceneEntry[] {
  const to = index + delta;
  if (!Number.isInteger(index) || index < 0 || index >= entries.length || to < 0 || to >= entries.length || to === index) {
    return entries;
  }
  const next = entries.slice();
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

/** Cenas sempre ligadas (devolutiva, plano, encerramento) nao desligam. */
export function setSceneEnabled(entries: SceneEntry[], id: SceneId, enabled: boolean): SceneEntry[] {
  if (sceneMeta(id)?.alwaysOn) return entries;
  return entries.map((e) => (e.id === id ? { id: e.id, enabled } : e));
}

export const scenesForConfig = (entries: SceneEntry[]): SceneToggle[] => entries.map(({ id, enabled }) => ({ id, enabled }));

// --- Pre-diagnostico (tarefas da semana) ---

export const MAX_PRECALL_TASKS = 6;
export const MAX_PRECALL_TOOLS = 10;
export const MAX_HOURS_PER_WEEK = 168;

export interface PrecallTotals {
  /** Tarefas que entram na conta (com nome e horas). */
  tasks: number;
  weekly: number;
  yearly: number;
  weeks: number;
}

/** Total como a cena "Onde seu tempo vai" mostra: a propria cena faz a conta. */
export function precallTotals(ctx: LeadViewContext): PrecallTotals | null {
  const vm = buildLeadView(ctx, { sceneId: 'tempo', step: Number.MAX_SAFE_INTEGER, curtain: false });
  const s = vm.scene;
  if (!s || s.id !== 'tempo' || s.weeklyHours == null || s.yearlyHours == null) return null;
  return { tasks: s.tasks.length, weekly: s.weeklyHours, yearly: s.yearlyHours, weeks: s.weeksPerYear ?? WEEKS_PER_YEAR };
}

export function newLocalId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${random}`;
}

// --- Oferta: caminhos de pagamento ---

export const MAX_PAYMENT_PATHS = 3;
export const CASH_LABEL = 'À vista';

export const pathTotal = (installments: number, value: number): number => Math.round(installments * value * 100) / 100;

/** Parcelas ou valor mudaram: o total acompanha (o vendedor ainda pode editar o total). */
export function updatePath(path: PaymentPath, patch: Partial<Omit<PaymentPath, 'id'>>): PaymentPath {
  const next = { ...path, ...patch };
  if (patch.installments !== undefined || patch.installmentValue !== undefined) {
    next.total = pathTotal(next.installments, next.installmentValue);
  }
  return next;
}

export function cashPath(finalPrice: number | null, id: string): PaymentPath {
  const value = typeof finalPrice === 'number' && finalPrice > 0 ? finalPrice : 0;
  return { id, label: CASH_LABEL, installments: 1, installmentValue: value, total: value };
}

export interface OfferProblemGroups {
  /** Valor com bolsa fora das regras da Head. */
  price: OfferProblem[];
  /** Por caminho (id). */
  paths: Record<string, OfferProblem[]>;
  /** Mais de 3 caminhos. */
  pathCount: OfferProblem[];
  validity: OfferProblem[];
  seats: OfferProblem[];
}

/**
 * Os problemas da oferta, cada um junto do campo que o causa. Reavalia cada
 * parte sozinha com evaluateOffer (mesma regra, sem depender do texto).
 */
export function groupOfferProblems(
  config: OfferConfig,
  settings: OfferSettings,
  ctx: { todayYmd: string; sessionYmd: string; nowMs: number },
): OfferProblemGroups {
  const all = evaluateOffer(config, settings, ctx).problems;
  const isolated = { paths: [], validUntil: null, showSeats: false, finalPrice: null };
  const price = evaluateOffer({ ...config, ...isolated, finalPrice: config.finalPrice }, settings, ctx).problems;
  const paths: Record<string, OfferProblem[]> = {};
  for (const p of config.paths.slice(0, MAX_PAYMENT_PATHS)) {
    paths[p.id] = evaluateOffer({ ...config, ...isolated, paths: [p] }, settings, ctx).problems;
  }
  return {
    price,
    paths,
    pathCount: all.filter((p) => p.code === 'too_many_paths'),
    validity: all.filter((p) => p.code.startsWith('validity_')),
    seats: all.filter((p) => p.code === 'seats_stale'),
  };
}

// --- Numeros e links digitados ---

/** "20.000,00", "20000", "R$ 19.900", "2,5" -> numero; '' -> null; invalido -> NaN. */
export function parseDecimalBR(raw: string): number | null {
  let s = String(raw ?? '').replace(/R\$|\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const CENTS = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatDecimalBR(n: number | null, cents = false): string {
  if (n === null || typeof n !== 'number' || !Number.isFinite(n)) return '';
  return (cents ? CENTS : DECIMAL).format(n);
}

/** Link publico http(s) com dominio (o PDF leva o link como esta). */
export function isHttpUrl(raw: string): boolean {
  const s = (raw ?? '').trim();
  if (!/^https?:\/\//i.test(s) || /\s/.test(s)) return false;
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

// --- Padrao do vendedor (diagnostic_seller_presets) ---

export interface SellerPresetData {
  display_name?: string | null;
  whatsapp?: string | null;
  prep_config?: unknown;
}

/** O que "Salvar como meu padrao" guarda: cenas e o que se repete na oferta. */
export function sellerPresetPayload(ws: Workspace) {
  const p = ws.diagnosis.prep_config;
  return {
    display_name: ws.diagnosis.consultant_name.trim(),
    whatsapp: ws.diagnosis.consultant_whatsapp.trim(),
    prep_config: {
      scenes: p.scenes.map(({ id, enabled }) => ({ id, enabled })),
      offer: {
        paths: p.offer.paths.map((x) => ({ ...x })),
        showAnchor: p.offer.showAnchor,
        showSeats: p.offer.showSeats,
        showValidity: p.offer.showValidity,
      },
    },
  };
}

/**
 * "Usar meu padrao": cenas, caminhos de pagamento e o que aparece na bolsa.
 * Nunca o valor com bolsa nem a validade (sao desta sessao). Nome e WhatsApp
 * so antes de enviar (depois ficam travados com o que o lead recebeu).
 */
export function applySellerPreset(ws: Workspace, preset: SellerPresetData, opts: { frozen: boolean }): Workspace {
  const raw =
    preset.prep_config && typeof preset.prep_config === 'object' && !Array.isArray(preset.prep_config)
      ? (preset.prep_config as Record<string, unknown>)
      : {};
  const saved = normalizePrepConfig(raw);
  let next = ws;
  if (Array.isArray(raw.scenes)) next = patchPrepConfig(next, { scenes: saved.scenes });
  if (raw.offer && typeof raw.offer === 'object') {
    next = patchOfferConfig(next, {
      paths: saved.offer.paths,
      showAnchor: saved.offer.showAnchor,
      showSeats: saved.offer.showSeats,
      showValidity: saved.offer.showValidity,
    });
  }
  if (!opts.frozen) {
    const patch: Partial<DiagnosisFields> = {};
    const name = (preset.display_name ?? '').trim();
    const phone = (preset.whatsapp ?? '').trim();
    if (name) patch.consultant_name = name;
    if (phone) patch.consultant_whatsapp = phone;
    if (Object.keys(patch).length) next = patchDiagnosis(next, patch);
  }
  return next;
}
