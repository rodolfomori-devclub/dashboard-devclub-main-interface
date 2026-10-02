/**
 * Tela do lead (sessao.html): cenas, estado da apresentacao e o modelo que o
 * cockpit transmite para a janela compartilhada.
 *
 * O LeadViewModel so carrega o que ja foi revelado ate o passo atual. Roteiro,
 * anotacoes, respostas, notas internas e pontuacoes ainda nao reveladas nunca
 * entram nele (ver leadView.ts, que monta o modelo).
 *
 * Este arquivo e importado pela janela do lead: so tipos e dados puros, nada do
 * app do Hub.
 */
import type { CallBlockId, Level } from '@diag/types.ts';
import type { PrepConfig, PresentationSnapshot } from '@/lib/diagnostic/workspace';

/** Titulo neutro da janela compartilhada (aparece no seletor de compartilhamento). */
export const LEAD_WINDOW_TITLE = 'Diagnóstico de Carreira com IA';

export type SceneId =
  | 'abertura'
  | 'momento'
  | 'tempo'
  | 'mercado'
  | 'montando'
  | 'palavras'
  | 'objetivo'
  | 'devolutiva'
  | 'plano'
  | 'caminho'
  | 'proximo'
  | 'bolsa'
  | 'encerramento';

export interface SceneMeta {
  id: SceneId;
  /** Nome no cockpit. */
  label: string;
  /** Bloco da call em que a cena costuma entrar. */
  block: CallBlockId;
  defaultEnabled: boolean;
  /** Devolutiva, plano e encerramento: nunca saem da sequencia. */
  alwaysOn: boolean;
  /** Cena de resultado: mostra o aviso legal. */
  result: boolean;
}

export const SCENES: readonly SceneMeta[] = [
  { id: 'abertura', label: 'Abertura', block: 'abertura', defaultEnabled: false, alwaysOn: false, result: false },
  { id: 'momento', label: 'Seu momento', block: 'situacao', defaultEnabled: false, alwaysOn: false, result: false },
  { id: 'tempo', label: 'Onde seu tempo vai', block: 'situacao', defaultEnabled: false, alwaysOn: false, result: false },
  { id: 'mercado', label: 'O mercado', block: 'reportagem', defaultEnabled: true, alwaysOn: false, result: false },
  { id: 'montando', label: 'Montando seu diagnóstico', block: 'problema', defaultEnabled: true, alwaysOn: false, result: false },
  { id: 'palavras', label: 'Nas suas palavras', block: 'implicacao', defaultEnabled: false, alwaysOn: false, result: false },
  { id: 'objetivo', label: 'Onde você quer chegar', block: 'necessidade', defaultEnabled: false, alwaysOn: false, result: false },
  { id: 'devolutiva', label: 'Devolutiva', block: 'devolutiva', defaultEnabled: true, alwaysOn: true, result: true },
  { id: 'plano', label: 'Plano, compromisso e material', block: 'devolutiva', defaultEnabled: true, alwaysOn: true, result: true },
  { id: 'caminho', label: 'Caminho completo', block: 'pitch', defaultEnabled: true, alwaysOn: false, result: true },
  { id: 'proximo', label: 'Próximo passo', block: 'proximo', defaultEnabled: true, alwaysOn: false, result: false },
  { id: 'bolsa', label: 'Bolsa', block: 'proximo', defaultEnabled: true, alwaysOn: false, result: true },
  { id: 'encerramento', label: 'Encerramento', block: 'proximo', defaultEnabled: true, alwaysOn: true, result: true },
];

export const SCENE_IDS: readonly SceneId[] = SCENES.map((s) => s.id);

export function isSceneId(v: unknown): v is SceneId {
  return typeof v === 'string' && (SCENE_IDS as readonly string[]).includes(v);
}

export function sceneMeta(id: SceneId): SceneMeta {
  return SCENES.find((s) => s.id === id) as SceneMeta;
}

export interface SceneEntry {
  id: SceneId;
  enabled: boolean;
}

/**
 * Todas as cenas na ordem da preparacao, com o estado ligado/desligado.
 * Sem `prep.scenes`: ordem e padroes de SCENES. Cena que faltar na lista
 * (conteudo novo) entra depois da vizinha anterior da ordem padrao, com o
 * padrao dela. Cenas sempre ligadas nunca saem.
 */
export function sceneOrder(prep: Pick<PrepConfig, 'scenes'> | null | undefined): SceneEntry[] {
  const order: SceneEntry[] = [];
  for (const s of prep?.scenes ?? []) {
    if (!isSceneId(s.id) || order.some((o) => o.id === s.id)) continue;
    order.push({ id: s.id, enabled: s.enabled !== false });
  }
  for (const meta of SCENES) {
    if (order.some((o) => o.id === meta.id)) continue;
    const canon = SCENE_IDS.indexOf(meta.id);
    let at = 0;
    order.forEach((o, i) => {
      if (SCENE_IDS.indexOf(o.id) < canon) at = i + 1;
    });
    order.splice(at, 0, { id: meta.id, enabled: meta.defaultEnabled });
  }
  return order.map((o) => (sceneMeta(o.id).alwaysOn ? { id: o.id, enabled: true } : o));
}

/** Cenas ligadas, na ordem em que entram na call. */
export function sceneSequence(prep: Pick<PrepConfig, 'scenes'> | null | undefined): SceneId[] {
  return sceneOrder(prep)
    .filter((s) => s.enabled)
    .map((s) => s.id);
}

// ---------------------------------------------------------------------------
// Estado da apresentacao (cockpit)
// ---------------------------------------------------------------------------

export interface PresentationState {
  sceneId: SceneId | null;
  /** Indice do passo na lista de passos do momento do comando. */
  step: number;
  /**
   * Chaves dos passos ja mostrados por comando nesta cena, ate o atual. Se a
   * lista de passos mudar com a cena aberta (dado editado), a tela fica no
   * mesmo passo (leadView.resolveStep). Vazio depois de recarregar: vale o indice.
   */
  shown: string[];
  /** "Pausar tela": a janela do lead mostra a tela neutra. */
  curtain: boolean;
  /** Conta os comandos do cockpit (o seq do transporte e outro, ver presentationTransport). */
  seq: number;
}

export const INITIAL_PRESENTATION: PresentationState = { sceneId: null, step: 0, shown: [], curtain: false, seq: 0 };

/** Volta a mesma cena depois de recarregar o cockpit. */
export function presentationFromSnapshot(snap: PresentationSnapshot | null | undefined): PresentationState {
  if (!snap) return { ...INITIAL_PRESENTATION, shown: [] };
  const step = typeof snap.step === 'number' && Number.isFinite(snap.step) ? Math.max(0, Math.floor(snap.step)) : 0;
  return {
    sceneId: isSceneId(snap.sceneId) ? snap.sceneId : null,
    step,
    shown: [],
    curtain: snap.curtain === true,
    seq: 0,
  };
}

export function snapshotOf(state: Pick<PresentationState, 'sceneId' | 'step' | 'curtain'>): PresentationSnapshot {
  return { sceneId: state.sceneId, step: state.step, curtain: state.curtain };
}

// ---------------------------------------------------------------------------
// Modelo da tela do lead. Campos ainda nao revelados ficam null.
// ---------------------------------------------------------------------------

interface SceneStepInfo {
  /** Passo atual (0..steps-1). */
  step: number;
  steps: number;
}

export interface AberturaVM extends SceneStepInfo {
  id: 'abertura';
  greeting: string;
  consultantLine: string | null;
  agenda: string[] | null;
  takeaways: string[] | null;
}

export interface MomentoFact {
  label: string;
  value: string;
}

export interface MomentoVM extends SceneStepInfo {
  id: 'momento';
  facts: MomentoFact[];
  trigger: string | null;
  freePhrase: string | null;
  goal: string | null;
  decision: number | null;
}

export interface TempoVM extends SceneStepInfo {
  id: 'tempo';
  tasks: { label: string; hours: number }[];
  weeklyHours: number | null;
  yearlyHours: number | null;
  weeksPerYear: number | null;
}

export interface MercadoArticleVM {
  outlet: string;
  date: string;
  headline: string;
  seal: string | null;
  data: string | null;
  url: string | null;
}

export interface MercadoVM extends SceneStepInfo {
  id: 'mercado';
  /** Reportagem na tela (0 ou 1). */
  index: number;
  count: number;
  article: MercadoArticleVM | null;
  closing: string | null;
}

export interface MontandoVM extends SceneStepInfo {
  id: 'montando';
  pillars: { name: string; done: boolean }[];
}

export interface PalavrasVM extends SceneStepInfo {
  id: 'palavras';
  quote: string;
}

export interface ObjetivoVM extends SceneStepInfo {
  id: 'objetivo';
  goal: string;
  quote: string | null;
  priorities: { label: string; chosen: boolean }[] | null;
}

export type DevolutivaView = 'frases' | 'forte' | 'travando' | 'indice' | 'mapa' | 'retrato';

export interface PillarBarVM {
  name: string;
  short: string;
  score: number;
  level: Level;
}

export interface MapNodeVM {
  short: string;
  score: number;
  level: Level;
  /** Linha curta abaixo do nivel (o movimento, ou "Manter e mostrar"). */
  hint: string;
}

export interface DevolutivaVM extends SceneStepInfo {
  id: 'devolutiva';
  view: DevolutivaView;
  quotes: string[] | null;
  strong: string | null;
  weighs: string | null;
  rootCause: string | null;
  blockers: { name: string; text: string }[] | null;
  total: number | null;
  bars: PillarBarVM[] | null;
  /** Nos na ordem fixa dos pilares (mesma geometria do mapa do PDF). */
  map: { goal: string; nodes: MapNodeVM[] } | null;
}

export interface GiftVM {
  title: string;
  detail: string | null;
  /** Titulos dos 3 prompts do kit (vazio quando vai a aula). */
  items: string[];
}

export type PlanoView = 'movimentos' | 'compromisso' | 'material';

export interface PlanoVM extends SceneStepInfo {
  id: 'plano';
  view: PlanoView;
  movements: string[];
  ownLine: string | null;
  commitment: { text: string; due: string; contactLine: string } | null;
  gift: GiftVM | null;
}

export type CaminhoView = 'trilha' | 'pares' | 'programa';

export interface PathPairVM {
  /** "Sua trava", "O que pesa mais para você" ou "Para fortalecer". */
  caption: string;
  label: string;
  resolves: string;
}

export interface CaminhoVM extends SceneStepInfo {
  id: 'caminho';
  view: CaminhoView;
  goal: string | null;
  quarters: { period: string; title: string; description: string }[];
  pairs: PathPairVM[] | null;
  program: string | null;
}

export interface ProximoVM extends SceneStepInfo {
  id: 'proximo';
  options: { label: string; chosen: boolean }[];
  /** Caminho unico (cursando graduacao ou sem bolsas): a frase inteira. */
  single: string | null;
  seatsLine: string | null;
}

export interface PaymentPathVM {
  label: string;
  installments: number;
  installmentValue: number;
  total: number;
}

export interface BolsaVM extends SceneStepInfo {
  id: 'bolsa';
  anchor: number | null;
  finalPrice: number | null;
  discount: number | null;
  paths: PaymentPathVM[] | null;
  seatsLine: string | null;
  validityLine: string | null;
}

export interface EncerramentoVM extends SceneStepInfo {
  id: 'encerramento';
  commitment: { text: string; due: string | null } | null;
  delivery: string;
  consultant: { name: string; whatsapp: string | null } | null;
}

export type SceneVM =
  | AberturaVM
  | MomentoVM
  | TempoVM
  | MercadoVM
  | MontandoVM
  | PalavrasVM
  | ObjetivoVM
  | DevolutivaVM
  | PlanoVM
  | CaminhoVM
  | ProximoVM
  | BolsaVM
  | EncerramentoVM;

export interface LeadViewModel {
  v: 1;
  /** Primeiro nome, ou '' (nunca um marcador como "[Nome]"). */
  firstName: string;
  /** Tela neutra ("Voltamos em instantes."). */
  curtain: boolean;
  /** Aviso legal, so nas cenas de resultado. */
  disclaimer: string | null;
  /** null: tela de espera. */
  scene: SceneVM | null;
}

/** Validacao minima do que chega pela janela compartilhada (fronteira). */
export function isLeadViewModel(v: unknown): v is LeadViewModel {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.v !== 1 || typeof o.firstName !== 'string' || typeof o.curtain !== 'boolean') return false;
  if (o.disclaimer !== null && typeof o.disclaimer !== 'string') return false;
  if (o.scene === null) return true;
  if (!o.scene || typeof o.scene !== 'object') return false;
  const s = o.scene as Record<string, unknown>;
  return isSceneId(s.id) && typeof s.step === 'number' && typeof s.steps === 'number';
}
