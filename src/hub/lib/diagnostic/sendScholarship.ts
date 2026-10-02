/**
 * Bolsa na tela de entrega: o que pode ser registrado (regra 10), a oferta que
 * a tela do lead mostrou e a nota do CRM, onde a bolsa e a condicao ficam.
 * Funcoes puras, para usar dentro de update(fn) do hook.
 */
import type {
  DiagnosisInput,
  DiagnosisModel,
  DiagnosticContent,
  Graduation,
  OfferView,
  PaymentPath,
} from '@diag/types.ts';
import { findNews } from '@diag/content.ts';
import { formatBRL, isValidYmd, ymdToBR } from '@diag/dates.ts';
import { offerSummary } from '@diag/offer.ts';
import { crmNote } from '@diag/texts.ts';
import { patchDiagnosis, patchLead, type ScholarshipStatus, type Workspace } from '@/lib/diagnostic/workspace';

export const SCHOLARSHIP_OPTIONS: { value: ScholarshipStatus; label: string }[] = [
  { value: 'none', label: 'Não apresentada' },
  { value: 'presented', label: 'Apresentada na call' },
  { value: 'closed', label: 'Fechou' },
];

export const NOT_ELIGIBLE_REASON =
  'Quem está cursando graduação não entra no MBA nem na Extensão, então não há bolsa. O banco recusa outro status.';

export const GRADUATION_UNKNOWN_REASON = 'Confirme a graduação no passo 1 antes de registrar a bolsa.';

/** Por que a bolsa nao pode sair de "Nao apresentada" agora; null quando pode. */
export function scholarshipBlocked(graduation: Graduation): string | null {
  if (graduation === 'cursando') return NOT_ELIGIBLE_REASON;
  return graduation === 'concluida' || graduation === 'nao' ? null : GRADUATION_UNKNOWN_REASON;
}

/** Status escolhido na entrega. Com a bolsa travada pela graduacao, so "Nao apresentada" passa. */
export function withScholarshipStatus(ws: Workspace, status: ScholarshipStatus): Workspace {
  if (status !== 'none' && scholarshipBlocked(ws.lead.graduation_status)) return ws;
  return patchDiagnosis(ws, { scholarship_status: status });
}

/**
 * Graduacao escolhida na entrega. "Cursando" volta a bolsa para "Nao apresentada"
 * no mesmo salvamento: o banco recusaria o par e o autosave pararia.
 */
export function withGraduation(ws: Workspace, graduation: Graduation): Workspace {
  const next = patchLead(ws, { graduation_status: graduation });
  return graduation === 'cursando' && next.diagnosis.scholarship_status !== 'none'
    ? patchDiagnosis(next, { scholarship_status: 'none' })
    : next;
}

// ---------------------------------------------------------------------------
// Oferta que a tela do lead mostrou (diagnosis.offer_shown)
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

const asObj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const asText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function asPaths(v: unknown): PaymentPath[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(asObj)
    .filter((p): p is Obj => !!p && !!asText(p.label))
    .slice(0, 3)
    .map((p, i) => ({
      id: asText(p.id) ?? `p${i}`,
      label: asText(p.label) as string,
      installments: asNum(p.installments) ?? 1,
      installmentValue: asNum(p.installmentValue) ?? 0,
      total: asNum(p.total) ?? 0,
    }));
}

/**
 * Gravado pelo controle de cenas quando a tela do lead confirma a bolsa. Le com
 * cuidado: os valores podem vir soltos ou em `view`. null sem a confirmacao.
 */
function readOfferShown(raw: unknown): { shownAt: string; view: OfferView } | null {
  const o = asObj(raw);
  const shownAt = o ? asText(o.shownAt) : null;
  if (!o || !shownAt || !Number.isFinite(Date.parse(shownAt))) return null;
  const src = asObj(o.view) ?? asObj(o.offer) ?? o;
  const validUntil = asText(src.validUntil);
  const view: OfferView = {
    anchor: asNum(src.anchor),
    finalPrice: asNum(src.finalPrice),
    discount: asNum(src.discount),
    paths: asPaths(src.paths),
    seatsLeft: asNum(src.seatsLeft),
    seatsConfirmedOnBR: asText(src.seatsConfirmedOnBR),
    validUntil,
    validUntilBR: asText(src.validUntilBR) ?? (validUntil && isValidYmd(validUntil) ? ymdToBR(validUntil) : null),
    soldOut: src.soldOut === true,
  };
  return { shownAt, view };
}

const hasOfferValues = (v: OfferView): boolean =>
  v.anchor !== null || v.finalPrice !== null || v.paths.length > 0 || v.validUntil !== null || v.seatsLeft !== null;

export interface OfferShownInfo {
  /** ISO de quando a tela do lead confirmou a cena da bolsa. */
  shownAt: string;
  /** Uma linha com o que apareceu, ou null quando nao da para saber. */
  summary: string | null;
}

export function offerShownInfo(raw: unknown): OfferShownInfo | null {
  const shown = readOfferShown(raw);
  if (!shown) return null;
  const { view } = shown;
  const parts: string[] = [];
  if (view.anchor !== null) parts.push(`tabela ${formatBRL(view.anchor)}`);
  const summary = offerSummary(view);
  if (summary) parts.push(summary);
  if (view.seatsLeft !== null) parts.push(`${view.seatsLeft} ${view.seatsLeft === 1 ? 'bolsa restante' : 'bolsas restantes'}`);
  return { shownAt: shown.shownAt, summary: parts.length ? parts.join(' · ') : null };
}

/**
 * "Condicao" da nota do CRM: a que a tela do lead mostrou. Sem tela, a oferta
 * de agora, e so com a bolsa apresentada ou fechada (a de agora pode ter perdido
 * a validade ou mudado com os limites da Head).
 */
export function crmCondition(ws: Workspace, liveOffer: OfferView): string | null {
  const shown = readOfferShown(ws.diagnosis.offer_shown);
  if (shown && hasOfferValues(shown.view)) return offerSummary(shown.view);
  return ws.diagnosis.scholarship_status !== 'none' ? offerSummary(liveOffer) : null;
}

/** Veiculo de cada reportagem mostrada (para a nota do CRM). */
export function newsNamesOf(ids: string[], content: DiagnosticContent): string[] {
  return (ids ?? []).map((id) => findNews(content, id)?.veiculo?.trim() || id);
}

export interface CrmNoteSource {
  ws: Workspace;
  input: DiagnosisInput;
  model: DiagnosisModel;
  content: DiagnosticContent;
  /** A oferta de agora (so entra sem a confirmacao da tela do lead). */
  offer: { view: OfferView };
}

/** A nota do CRM como ela sai agora. */
export function crmNoteFor({ ws, input, model, content, offer }: CrmNoteSource): string {
  return crmNote(input, model, {
    scholarshipStatus: ws.diagnosis.scholarship_status,
    offerSummary: crmCondition(ws, offer.view),
    newsNames: newsNamesOf(ws.diagnosis.news_shown_ids, content),
  });
}
