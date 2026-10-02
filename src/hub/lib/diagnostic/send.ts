/**
 * Entrega do diagnostico depois da call (tela de envio): o estado de cada
 * passo, o prazo de 2 horas e as checagens antes de abrir o WhatsApp.
 * Funcoes puras: "agora" sempre chega por parametro. Horarios no fuso de Sao Paulo.
 */
import type { DeliveryField, DiagnosisModel, ValidationIssue } from '@diag/types.ts';
import { diffDaysYmd, todayYmd, ymdToBR } from '@diag/dates.ts';
import { sanitizePhone } from '@/lib/whatsapp';
import { fingerprint, jsonFingerprint } from '@/lib/diagnostic/fingerprint';
import { DELIVERY_WINDOW_MS, deliveryClock, formatMinutes } from '@/lib/diagnostic/sessionBuckets';
import { offerShownInfo, scholarshipBlocked } from '@/lib/diagnostic/sendScholarship';
import { patchCallData, patchDiagnosis, patchSession, type Workspace } from '@/lib/diagnostic/workspace';

const SAO_PAULO = 'America/Sao_Paulo';
const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
/** Horario prometido no agradecimento: arredondado para baixo de 5 em 5 minutos. */
const PROMISE_STEP_MS = 5 * MINUTE_MS;

const TIME_FMT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SAO_PAULO });

const isoMs = (iso: string | null | undefined): number => (typeof iso === 'string' && iso ? Date.parse(iso) : NaN);
const hhmm = (ms: number): string => TIME_FMT.format(new Date(ms));

// ---------------------------------------------------------------------------
// Ancoras e marcas (call_data.ticks)
// ---------------------------------------------------------------------------

export type DeliveryStepId = 'deadline' | 'complete' | 'thanks' | 'scholarship' | 'pdf' | 'message' | 'crm' | 'sent';

export const SEND_ANCHOR: Record<DeliveryStepId, string> = {
  deadline: 'send-deadline',
  complete: 'send-complete',
  thanks: 'send-thanks',
  scholarship: 'send-scholarship',
  pdf: 'send-pdf',
  message: 'send-message',
  crm: 'send-crm',
  sent: 'send-sent',
};

/** Onde corrigir cada pendencia de validateForDelivery. */
export const ISSUE_ANCHOR: Record<DeliveryField, string> = {
  name: 'send-lead',
  graduation: 'send-lead',
  scores: 'send-scores',
  commitmentText: 'send-commitment',
  commitmentDueDate: 'send-commitment',
  rootCause: 'send-root-cause',
  consultant: 'send-consultant',
  lessonUrl: 'send-lesson',
};

/** Marcas da entrega em call_data.ticks (id -> ISO do ultimo uso). */
export const SEND_TICK = {
  thanks: 'send_thanks',
  pdf: 'send_pdf',
  message: 'send_message',
  /** Reabertura: PDF, mensagem e nota feitos antes dela valiam para a versao anterior. */
  reopened: 'send_reopened',
} as const;

export type SendTickKey = (typeof SEND_TICK)[keyof typeof SEND_TICK];

export function withSendTick(ws: Workspace, key: SendTickKey, iso: string): Workspace {
  return patchCallData(ws, { ticks: { ...ws.diagnosis.call_data.ticks, [key]: iso } });
}

/**
 * Textos do agradecimento e impressoes do PDF e da nota copiada em
 * call_data.answers, para nao se perderem ao recarregar. Os ids das perguntas
 * do conteudo nunca tem ':'.
 */
export const SEND_ANSWER = {
  recognition: 'send:recognition',
  deliverBy: 'send:deliverBy',
  /** Impressao do modelo com que o PDF foi gerado. */
  pdf: 'send:pdf',
  /** Impressao do texto da nota do CRM copiada. */
  crmCopied: 'send:crmCopied',
} as const;

export type SendAnswerKey = (typeof SEND_ANSWER)[keyof typeof SEND_ANSWER];

/** O texto guardado; null quando nunca foi escrito. */
export function sendAnswer(ws: Workspace, key: SendAnswerKey): string | null {
  const answers = ws.diagnosis.call_data?.answers ?? {};
  const value = Object.prototype.hasOwnProperty.call(answers, key) ? answers[key] : undefined;
  return typeof value === 'string' ? value : null;
}

export function withSendAnswer(ws: Workspace, key: SendAnswerKey, value: string): Workspace {
  return patchCallData(ws, { answers: { ...ws.diagnosis.call_data.answers, [key]: value } });
}

/** PDF gerado agora com este modelo: se o diagnostico mudar depois, o passo volta a pendente. */
export function withPdfGenerated(ws: Workspace, model: DiagnosisModel, iso: string): Workspace {
  return withSendAnswer(withSendTick(ws, SEND_TICK.pdf, iso), SEND_ANSWER.pdf, jsonFingerprint(model));
}

/** Nota do CRM copiada agora com este texto. */
export function withCrmCopied(ws: Workspace, note: string, iso: string): Workspace {
  return withSendAnswer(patchDiagnosis(ws, { crm_note_copied_at: iso }), SEND_ANSWER.crmCopied, fingerprint(note));
}

/**
 * "Marcar a call como encerrada agora". Sem inicio registrado, a call tambem
 * comeca agora: senao o cockpit pede um "Iniciar call" que nao aparece mais.
 */
export function withCallEnded(ws: Workspace, iso: string): Workspace {
  if (ws.session.call_ended_at) return ws;
  return patchSession(ws, { call_started_at: ws.session.call_started_at || iso, call_ended_at: iso });
}

/** O ISO, se for uma data valida feita depois da ultima reabertura; senao null. */
function sinceReopen(iso: string | null | undefined, ticks: Record<string, string>): string | null {
  const at = isoMs(iso);
  if (!Number.isFinite(at)) return null;
  const reopened = isoMs(ticks[SEND_TICK.reopened]);
  return !Number.isFinite(reopened) || at >= reopened ? (iso as string) : null;
}

// ---------------------------------------------------------------------------
// Datas para a tela
// ---------------------------------------------------------------------------

/** 'às 14:00' (hoje), 'ontem às 14:00', 'amanhã às 14:00' ou 'em 29/09 às 14:00'. */
export function whenLabel(ms: number, nowMs: number): string {
  if (!Number.isFinite(ms)) return '';
  const time = `às ${hhmm(ms)}`;
  const day = todayYmd(ms);
  const today = todayYmd(nowMs);
  const diff = diffDaysYmd(today, day);
  if (diff === 0) return time;
  if (diff === -1) return `ontem ${time}`;
  if (diff === 1) return `amanhã ${time}`;
  const br = ymdToBR(day);
  return `em ${day.slice(0, 4) === today.slice(0, 4) ? br.slice(0, 5) : br} ${time}`;
}

/** '01/10/2026 às 15:10'. Invalido -> ''. */
export function dateTimeLabel(iso: string | null | undefined): string {
  const ms = isoMs(iso);
  return Number.isFinite(ms) ? `${ymdToBR(todayYmd(ms))} às ${hhmm(ms)}` : '';
}

/** 'Feito às 12:20' (ou so 'Feito' sem horario valido). */
export function doneLabel(prefix: string, at: string | null | undefined, nowMs: number): string {
  const ms = isoMs(at);
  return Number.isFinite(ms) ? `${prefix} ${whenLabel(ms, nowMs)}` : prefix;
}

// ---------------------------------------------------------------------------
// Prazo de 2 horas
// ---------------------------------------------------------------------------

function lateLabel(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  if (m < DAY_MINUTES) return formatMinutes(m);
  const days = Math.floor(m / DAY_MINUTES);
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/** Hoje: '14:00'; outro dia: 'amanhã às 00:30'. */
function untilLabel(ms: number, nowMs: number): string {
  return diffDaysYmd(todayYmd(nowMs), todayYmd(ms)) === 0 ? hhmm(ms) : whenLabel(ms, nowMs);
}

export type DeadlineTone = 'idle' | 'pending' | 'late' | 'onTime' | 'sentLate';

export interface DeadlineStatus {
  tone: DeadlineTone;
  text: string;
  /** Linha de apoio: quando a call terminou, qual era o prazo. */
  detail: string | null;
}

/**
 * Playbook: diagnostico por escrito ate 2 horas depois da call. Depois da
 * primeira entrega mostra se ela saiu no prazo (a reabertura nao muda isso).
 */
export function deadlineStatus(callEndedAt: string | null, firstSentAt: string | null, nowMs: number): DeadlineStatus {
  const clock = deliveryClock(callEndedAt, nowMs);
  const sentMs = isoMs(firstSentAt);
  if (Number.isFinite(sentMs)) {
    const when = whenLabel(sentMs, nowMs);
    if (!clock) return { tone: 'onTime', text: `Entregue ${when}.`, detail: null };
    const lateMin = Math.round((sentMs - clock.deadlineMs) / MINUTE_MS);
    return lateMin <= 0
      ? { tone: 'onTime', text: `Entregue ${when}, dentro das 2 horas.`, detail: null }
      : { tone: 'sentLate', text: `Entregue ${when}, ${lateLabel(lateMin)} depois do prazo de 2 horas.`, detail: null };
  }
  if (!clock) {
    return {
      tone: 'idle',
      text: 'A call ainda não foi encerrada no cockpit.',
      detail: 'O prazo de 2 horas conta a partir do fim da call.',
    };
  }
  const ended = `A call terminou ${whenLabel(isoMs(callEndedAt), nowMs)}.`;
  if (clock.late) {
    return {
      tone: 'late',
      text: `Atrasado ${lateLabel(-clock.minutesLeft)}`,
      detail: `O prazo era ${whenLabel(clock.deadlineMs, nowMs)}. ${ended}`,
    };
  }
  return {
    tone: 'pending',
    text: `Entregar até ${untilLabel(clock.deadlineMs, nowMs)} · faltam ${formatMinutes(clock.minutesLeft)}`,
    detail: ended,
  };
}

/**
 * "Te mando até {{hora}}" do agradecimento: o prazo de 2 horas arredondado
 * para baixo ('às 14:05', 'amanhã às 00:30'). Sem fim de call registrado,
 * conta de agora. Prazo vencido: '' (o consultor escreve um horario que cumpre).
 */
export function deliverByLabel(callEndedAt: string | null, nowMs: number): string {
  if (!Number.isFinite(nowMs)) return '';
  const clock = deliveryClock(callEndedAt, nowMs);
  const deadline = clock ? clock.deadlineMs : nowMs + DELIVERY_WINDOW_MS;
  const promised = Math.floor(deadline / PROMISE_STEP_MS) * PROMISE_STEP_MS;
  if (!(promised > nowMs)) return '';
  const time = `às ${hhmm(promised)}`;
  const diff = diffDaysYmd(todayYmd(nowMs), todayYmd(promised));
  if (diff === 0) return time;
  if (diff === 1) return `amanhã ${time}`;
  return `${ymdToBR(todayYmd(promised)).slice(0, 5)} ${time}`;
}

/** Minutos desde o fim da call (null sem fim registrado). */
export function minutesSinceCall(callEndedAt: string | null, nowMs: number): number | null {
  const ended = isoMs(callEndedAt);
  return Number.isFinite(ended) && Number.isFinite(nowMs) ? Math.floor((nowMs - ended) / MINUTE_MS) : null;
}

// ---------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /\[[^\]\n]+\]/g;

/** Marcadores que sobraram no texto ('[nome]', '[data]'), sem repetir. */
export function placeholdersIn(text: string): string[] {
  const found: string[] = String(text ?? '').match(PLACEHOLDER_RE) ?? [];
  return found.filter((p, i) => found.indexOf(p) === i);
}

/** Texto em pedacos, marcando os marcadores que sobraram (para destacar na previa). */
export function splitPlaceholders(text: string): { text: string; placeholder: boolean }[] {
  const parts: { text: string; placeholder: boolean }[] = [];
  const s = String(text ?? '');
  let last = 0;
  for (const match of s.matchAll(PLACEHOLDER_RE)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: s.slice(last, at), placeholder: false });
    parts.push({ text: match[0], placeholder: true });
    last = at + match[0].length;
  }
  if (last < s.length) parts.push({ text: s.slice(last), placeholder: false });
  return parts;
}

/** 'A', 'A e B', 'A, B e C'. */
function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/**
 * Numero com DDD (10 ou 11 digitos) ou com DDI (ate 15, padrao E.164). O 0 de
 * discagem antes do DDD quebra o link: com 12 digitos ou mais, openWhatsApp
 * acha que o numero ja tem DDI e nao poe o 55.
 */
function phoneProblem(phone: string | null | undefined): string | null {
  const digits = sanitizePhone(phone);
  if (digits.length < 10 || digits.length > 15) {
    return 'O lead está sem um WhatsApp válido. Copie o texto e mande pelo celular.';
  }
  const national = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (national.startsWith('0')) {
    return 'O WhatsApp do lead tem um 0 antes do DDD e o link não abre assim. Tire o 0 ou copie o texto e mande pelo celular.';
  }
  return null;
}

export function usablePhone(phone: string | null | undefined): boolean {
  return phoneProblem(phone) === null;
}

export interface WhatsappCheck {
  ok: boolean;
  reason: string | null;
}

/** Pode abrir o WhatsApp: texto sem marcador sobrando e numero utilizavel. */
export function whatsappReady(text: string, phone: string | null | undefined): WhatsappCheck {
  const missing = placeholdersIn(text);
  if (missing.length) return { ok: false, reason: `Complete o texto: falta ${joinPt(missing)}.` };
  if (!String(text ?? '').trim()) return { ok: false, reason: 'O texto está vazio.' };
  const problem = phoneProblem(phone);
  return problem ? { ok: false, reason: problem } : { ok: true, reason: null };
}

/**
 * Reconhecimento do agradecimento ("Deu pra ver que você ..."): tira o comeco
 * repetido, a pontuacao final (o modelo ja poe o ponto) e a maiuscula inicial.
 */
export function cleanRecognition(text: string): string {
  let s = String(text ?? '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(?:deu pra ver\s+)?(?:que\s+)?voc[eê]\s+/i, '');
  s = s.replace(/[\s.!;,]+$/, '');
  if (/^\p{Lu}\p{Ll}/u.test(s)) s = s.charAt(0).toLowerCase() + s.slice(1);
  return s;
}

/** null quando vazio ou um endereco http(s) completo; senao, o que corrigir. */
export function lessonUrlProblem(url: string): string | null {
  const s = String(url ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if ((u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') && !/\s/.test(s)) return null;
  } catch {
    // nao e URL
  }
  return 'Link inválido: cole o endereço completo da aula, começando com https://.';
}

// ---------------------------------------------------------------------------
// Passos da entrega
// ---------------------------------------------------------------------------

export const STALE_PDF =
  'O diagnóstico mudou depois que o PDF foi gerado. Gere de novo e, se o lead já recebeu o anterior, mande a versão nova.';
export const STALE_CRM = 'A nota mudou depois da cópia. Copie de novo e troque a que está no card do lead no Nold.';

export interface DeliveryStep {
  id: DeliveryStepId;
  done: boolean;
  /** A acao do passo nao pode ser feita agora (ver reason). */
  blocked: boolean;
  /** Por que esta travado ou o que falta; null quando nada. */
  reason: string | null;
  /** ISO de quando foi feito, quando se sabe. */
  at: string | null;
  /** Feito, mas com uma versao que ja mudou (PDF e nota do CRM). */
  stale?: boolean;
}

/**
 * Feito depois da ultima reabertura e com a mesma impressao de agora. Sem
 * impressao guardada (feito antes desta checagem existir), vale a marca.
 */
function freshness(
  iso: string | null | undefined,
  ticks: Record<string, string>,
  saved: string | null,
  current: () => string,
): { at: string | null; stale: boolean } {
  const at = sinceReopen(iso, ticks);
  return { at, stale: !!at && saved !== null && saved !== current() };
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** "Complete o passo 1 para gerar o PDF: falta a data do compromisso. E mais 1 item." */
function incomplete(issues: ValidationIssue[], action: string): string {
  const more = issues.length - 1;
  const tail = more > 0 ? ` E mais ${more} ${more === 1 ? 'item' : 'itens'}.` : '';
  // So o que falta: o "como corrigir" depois dos dois-pontos ja aparece na lista do passo 1.
  const message = issues[0].message;
  const colon = message.indexOf(':');
  const what = colon > 0 ? `${message.slice(0, colon).trim()}.` : message;
  return `Complete o passo 1 para ${action}: ${lowerFirst(what)}${tail}`;
}

/**
 * Estado de cada passo da tela de envio, na ordem da tela. `issues` vem de
 * validateForDelivery (o que falta para gerar o PDF e marcar como enviado);
 * `note` e a nota do CRM como sai agora (crmNoteFor). Depois de uma reabertura,
 * PDF, mensagem e nota do CRM voltam a ficar pendentes ate serem refeitos com a
 * versao corrigida; PDF e nota tambem quando o que eles mostram mudou depois.
 */
export function deliverySteps(ws: Workspace, model: DiagnosisModel, issues: ValidationIssue[], note: string): DeliveryStep[] {
  const d = ws.diagnosis;
  const ticks = d.call_data?.ticks ?? {};
  const sent = ws.status === 'sent';
  const delivered = sent || !!ws.firstSentAt;
  const ready = issues.length === 0;
  // O agradecimento nao depende da versao do diagnostico: a reabertura nao o desfaz.
  const thanksAt = sinceReopen(ticks[SEND_TICK.thanks], {});
  const pdf = freshness(ticks[SEND_TICK.pdf], ticks, sendAnswer(ws, SEND_ANSWER.pdf), () => jsonFingerprint(model));
  const messageAt = sinceReopen(ticks[SEND_TICK.message], ticks);
  const crm = freshness(d.crm_note_copied_at, ticks, sendAnswer(ws, SEND_ANSWER.crmCopied), () => fingerprint(note));
  const shownButNone = !!offerShownInfo(d.offer_shown) && d.scholarship_status === 'none';
  const cursando = ws.lead.graduation_status === 'cursando';
  const bolsaBlocked = scholarshipBlocked(ws.lead.graduation_status);
  const blockedBy = (action: string) => (ready ? null : incomplete(issues, action));

  return [
    {
      id: 'deadline',
      done: delivered,
      blocked: false,
      reason: !delivered && !ws.session.call_ended_at ? 'A call ainda não foi encerrada no cockpit.' : null,
      at: ws.firstSentAt,
    },
    {
      id: 'complete',
      done: ready,
      blocked: false,
      reason: ready ? null : issues.length === 1 ? 'Falta 1 item' : `Faltam ${issues.length} itens`,
      at: null,
    },
    {
      id: 'thanks',
      done: !!thanksAt,
      blocked: !thanksAt && delivered,
      reason: !thanksAt && delivered ? 'O diagnóstico já foi entregue: o agradecimento era para antes da entrega.' : null,
      at: thanksAt,
    },
    {
      id: 'scholarship',
      // Cursando: nada a registrar. Graduacao em branco: espera o passo 1.
      done: cursando || (!bolsaBlocked && !shownButNone),
      blocked: !!bolsaBlocked,
      reason:
        bolsaBlocked ?? (shownButNone ? 'A tela do lead mostrou a bolsa, mas o status está "Não apresentada".' : null),
      at: null,
    },
    {
      id: 'pdf',
      done: !!pdf.at && !pdf.stale,
      blocked: !ready,
      reason: blockedBy('gerar o PDF') ?? (pdf.stale ? STALE_PDF : null),
      at: pdf.at,
      stale: pdf.stale,
    },
    { id: 'message', done: !!messageAt, blocked: !ready, reason: blockedBy('mandar a mensagem'), at: messageAt },
    {
      id: 'crm',
      done: !!crm.at && !crm.stale,
      blocked: !ready,
      reason: blockedBy('a nota sair inteira') ?? (crm.stale ? STALE_CRM : null),
      at: crm.at,
      stale: crm.stale,
    },
    {
      id: 'sent',
      done: sent,
      blocked: !sent && !ready,
      reason: !sent && !ready ? incomplete(issues, 'marcar como enviado') : null,
      at: sent ? ws.sentAt : null,
    },
  ];
}

export function stepById(steps: DeliveryStep[], id: DeliveryStepId): DeliveryStep {
  return steps.find((s) => s.id === id) ?? { id, done: false, blocked: false, reason: null, at: null };
}
