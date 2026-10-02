/**
 * Padroes e leitura das linhas do banco para o Workspace do diagnostico.
 * Separado de workspace.ts so por tamanho; importe sempre de
 * '@/lib/diagnostic/workspace', que reexporta tudo daqui.
 */
import type { CallBlockId, DiagnosisModel, Graduation, InvestmentAnswer, NeedPriorityId, OfferConfig, Quote, WeeklyTask } from '@diag/types.ts';
import type { CallData, DiagnosisOrigin, PrepConfig, SessionStatus, Workspace } from '@/lib/diagnostic/workspace';
// ---------------------------------------------------------------------------
// Padroes
// ---------------------------------------------------------------------------

export function defaultOfferConfig(): OfferConfig {
  return {
    showAnchor: true,
    finalPrice: null,
    paths: [],
    validUntil: null,
    showSeats: true,
    showValidity: true,
  };
}

export function defaultCallData(): CallData {
  return {
    currentBlock: 'abertura',
    blockStartedAt: {},
    answers: {},
    ticks: {},
    scoreNotes: {},
    needPriority: null,
    costStated: false,
    pathPermitted: false,
    differentialsResolve: {},
    shortMode: false,
    nextStepChoice: null,
    featuredQuoteId: null,
    privateNotes: '',
    presentation: null,
  };
}

/** `scenes` vazio = a tela do lead usa a sequencia padrao. */
export function defaultPrepConfig(): PrepConfig {
  return {
    v: 1,
    archetypeConfirmed: false,
    fearful: false,
    newsScreen: [],
    newsSpoken: [],
    differentials: [],
    scenes: [],
    offer: defaultOfferConfig(),
    readyAt: null,
  };
}

// ---------------------------------------------------------------------------
// Normalizacao do que vem do banco
// ---------------------------------------------------------------------------

type Json = unknown;

const str = (v: Json): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: Json): string | null => (typeof v === 'string' && v !== '' ? v : null);
const numOrNull = (v: Json): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const boolOrNull = (v: Json): boolean | null => (typeof v === 'boolean' ? v : null);
const strArray = (v: Json): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const obj = (v: Json): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const GRADUATIONS: Graduation[] = ['', 'concluida', 'nao', 'cursando'];
const INVESTMENTS: InvestmentAnswer[] = ['', 'sim', 'organizar', 'nao'];
const asGraduation = (v: Json): Graduation => (GRADUATIONS.includes(v as Graduation) ? (v as Graduation) : '');
const asInvestment = (v: Json): InvestmentAnswer => (INVESTMENTS.includes(v as InvestmentAnswer) ? (v as InvestmentAnswer) : '');

function normalizeQuotes(v: Json): Quote[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(obj)
    .filter((q) => typeof q.id === 'string' && typeof q.text === 'string')
    .map((q) => ({
      id: q.id as string,
      text: q.text as string,
      tag: (typeof q.tag === 'string' ? q.tag : 'outro') as Quote['tag'],
      inPdf: q.inPdf === true,
      at: str(q.at),
    }));
}

function normalizeTasks(v: Json): WeeklyTask[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(obj)
    .filter((t) => typeof t.label === 'string')
    .map((t, i) => ({
      id: typeof t.id === 'string' ? t.id : `t${i}`,
      label: t.label as string,
      hoursPerWeek: numOrNull(t.hoursPerWeek),
    }));
}

export function normalizeCallData(v: Json): CallData {
  const o = obj(v);
  const base = defaultCallData();
  const presentation = obj(o.presentation);
  return {
    currentBlock: (typeof o.currentBlock === 'string' ? o.currentBlock : base.currentBlock) as CallBlockId,
    blockStartedAt: obj(o.blockStartedAt) as CallData['blockStartedAt'],
    answers: obj(o.answers) as Record<string, string>,
    ticks: obj(o.ticks) as Record<string, string>,
    scoreNotes: obj(o.scoreNotes) as CallData['scoreNotes'],
    needPriority: (['aprender', 'provar', 'formacao'].includes(o.needPriority as string)
      ? o.needPriority
      : null) as NeedPriorityId | null,
    costStated: o.costStated === true,
    pathPermitted: o.pathPermitted === true,
    differentialsResolve: obj(o.differentialsResolve) as CallData['differentialsResolve'],
    shortMode: o.shortMode === true,
    nextStepChoice: o.nextStepChoice === 'bolsa' || o.nextStepChoice === 'esperar' ? o.nextStepChoice : null,
    featuredQuoteId: strOrNull(o.featuredQuoteId),
    privateNotes: str(o.privateNotes),
    presentation: o.presentation
      ? {
          sceneId: strOrNull(presentation.sceneId),
          step: numOrNull(presentation.step) ?? 0,
          curtain: presentation.curtain === true,
        }
      : null,
  };
}

export function normalizePrepConfig(v: Json): PrepConfig {
  const o = obj(v);
  const base = defaultPrepConfig();
  const offer = obj(o.offer);
  const paths = Array.isArray(offer.paths) ? offer.paths.map(obj) : [];
  return {
    v: 1,
    archetypeConfirmed: o.archetypeConfirmed === true,
    fearful: o.fearful === true,
    newsScreen: strArray(o.newsScreen),
    newsSpoken: strArray(o.newsSpoken),
    differentials: strArray(o.differentials),
    scenes: Array.isArray(o.scenes)
      ? o.scenes.map(obj).filter((s) => typeof s.id === 'string').map((s) => ({ id: s.id as string, enabled: s.enabled !== false }))
      : base.scenes,
    offer: {
      showAnchor: offer.showAnchor !== false,
      finalPrice: numOrNull(offer.finalPrice),
      paths: paths
        .filter((p) => typeof p.label === 'string')
        .slice(0, 3)
        .map((p, i) => ({
          id: typeof p.id === 'string' ? p.id : `p${i}`,
          label: p.label as string,
          installments: numOrNull(p.installments) ?? 1,
          installmentValue: numOrNull(p.installmentValue) ?? 0,
          total: numOrNull(p.total) ?? 0,
        })),
      validUntil: strOrNull(offer.validUntil),
      showSeats: offer.showSeats !== false,
      showValidity: offer.showValidity !== false,
    },
    readyAt: strOrNull(o.readyAt),
  };
}

/** Linhas como o PostgREST devolve (ver fetchWorkspaceRows no hook). */
export interface WorkspaceRows {
  session: Record<string, unknown>;
  lead: Record<string, unknown>;
  diagnosis: Record<string, unknown>;
  qualification: Record<string, unknown> | null;
}

export function workspaceFromRows(rows: WorkspaceRows): Workspace {
  const { session: s, lead: l, diagnosis: d } = rows;
  const q = rows.qualification ?? {};
  const precall = obj(s.precall_answers);
  return {
    ids: { diagnosisId: str(d.id), sessionId: str(s.id), leadId: str(l.id) },
    rev: numOrNull(d.rev) ?? 0,
    status: d.status === 'sent' ? 'sent' : 'draft',
    consultantId: strOrNull(d.consultant_id),
    contentVersionId: strOrNull(d.content_version_id),
    origin: (['manual', 'legacy_meeting', 'sdr', 'exemplo'].includes(s.origin as string) ? s.origin : 'manual') as DiagnosisOrigin,
    currentMeetingId: strOrNull(s.current_meeting_id),
    createdAt: str(d.created_at),
    sentAt: strOrNull(d.sent_at),
    firstSentAt: strOrNull(d.first_sent_at),
    renderSnapshot: d.render_snapshot && typeof d.render_snapshot === 'object' ? (d.render_snapshot as DiagnosisModel) : null,
    leadScore: l.lead_score === 'A' || l.lead_score === 'B' || l.lead_score === 'C' ? l.lead_score : null,
    lead: {
      name: str(l.name),
      whatsapp: str(l.whatsapp),
      email: str(l.email),
      linkedin_url: str(l.linkedin_url),
      job_title: str(l.job_title),
      time_in_role_text: str(l.time_in_role_text),
      area: str(l.area),
      career_moment: str(l.career_moment),
      time_in_role: str(l.time_in_role),
      last_promotion: str(l.last_promotion),
      trigger_event: str(l.trigger_event),
      ai_frequency: str(l.ai_frequency),
      ai_uses: strArray(l.ai_uses),
      goal_12m: str(l.goal_12m),
      graduation_status: asGraduation(l.graduation_status),
      investment_answer: asInvestment(l.investment_answer),
      free_phrase: str(l.free_phrase),
    },
    qualification: {
      sdr_name: str(q.sdr_name),
      pain_text: str(q.pain_text),
      accepts_status_quo: boolOrNull(q.accepts_status_quo),
      decision_score: numOrNull(q.decision_score),
      commits_to_apply: boolOrNull(q.commits_to_apply),
      graduation_confirmed: asGraduation(q.graduation_confirmed),
    },
    session: {
      scheduled_date: strOrNull(s.scheduled_date),
      scheduled_time: strOrNull(s.scheduled_time),
      room_url: str(s.room_url),
      status: (['scheduled', 'completed', 'no_show', 'cancelled'].includes(s.status as string) ? s.status : 'scheduled') as SessionStatus,
      precall_answers: {
        tasks: normalizeTasks(precall.tasks),
        tools: strArray(precall.tools),
        source: precall.source === 'lead' ? 'lead' : precall.source === 'consultor' ? 'consultor' : undefined,
      },
      call_started_at: strOrNull(s.call_started_at),
      call_ended_at: strOrNull(s.call_ended_at),
    },
    diagnosis: {
      score_uso: numOrNull(d.score_uso),
      score_aplic: numOrNull(d.score_aplic),
      score_prova: numOrNull(d.score_prova),
      score_cred: numOrNull(d.score_cred),
      score_metodo: numOrNull(d.score_metodo),
      archetype_id: str(d.archetype_id),
      root_cause_override: str(d.root_cause_override),
      quotes: normalizeQuotes(d.quotes),
      news_shown_ids: strArray(d.news_shown_ids),
      commitment_text: str(d.commitment_text),
      commitment_due_date: strOrNull(d.commitment_due_date),
      commitment_movement: str(d.commitment_movement),
      lesson_url_override: str(d.lesson_url_override),
      consultant_name: str(d.consultant_name),
      consultant_whatsapp: str(d.consultant_whatsapp),
      scholarship_status: d.scholarship_status === 'presented' || d.scholarship_status === 'closed' ? d.scholarship_status : 'none',
      offer_requested_at: strOrNull(d.offer_requested_at),
      offer_shown: obj(d.offer_shown),
      call_data: normalizeCallData(d.call_data),
      prep_config: normalizePrepConfig(d.prep_config),
      crm_note_copied_at: strOrNull(d.crm_note_copied_at),
    },
  };
}
