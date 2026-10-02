/**
 * Workspace do diagnostico: o estado editavel de uma sessao (lead, qualificacao,
 * sessao e diagnostico), espelhando as colunas do banco em snake_case. O
 * autosave (src/hooks/useDiagnosticWorkspace.ts) compara o ultimo estado salvo
 * com o atual e manda so as colunas que mudaram para diagnostic_save.
 */
import type {
  CallBlockId,
  DiagnosisInput,
  DiagnosisModel,
  Graduation,
  InvestmentAnswer,
  NeedPriorityId,
  OfferConfig,
  PillarId,
  Quote,
  WeeklyTask,
} from '@diag/types.ts';

// ---------------------------------------------------------------------------
// Secoes (nomes = colunas do banco)
// ---------------------------------------------------------------------------

export interface LeadFields {
  name: string;
  whatsapp: string;
  email: string;
  linkedin_url: string;
  job_title: string;
  time_in_role_text: string;
  area: string;
  career_moment: string;
  time_in_role: string;
  last_promotion: string;
  trigger_event: string;
  ai_frequency: string;
  ai_uses: string[];
  goal_12m: string;
  graduation_status: Graduation;
  investment_answer: InvestmentAnswer;
  free_phrase: string;
}

export interface QualificationFields {
  sdr_name: string;
  pain_text: string;
  accepts_status_quo: boolean | null;
  decision_score: number | null;
  commits_to_apply: boolean | null;
  graduation_confirmed: Graduation;
}

export interface PrecallAnswers {
  tasks: WeeklyTask[];
  tools: string[];
  /** Quem preencheu: o lead pelo link (Fase 3) ou o consultor. */
  source?: 'lead' | 'consultor';
}

export type SessionStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

export interface SessionFields {
  scheduled_date: string | null;
  scheduled_time: string | null;
  room_url: string;
  status: SessionStatus;
  precall_answers: PrecallAnswers;
  call_started_at: string | null;
  call_ended_at: string | null;
}

/** Ultimo estado da tela do lead, para voltar a mesma cena depois de recarregar. */
export interface PresentationSnapshot {
  sceneId: string | null;
  step: number;
  curtain: boolean;
}

/** Tudo o que o consultor registra durante a call e nao vira coluna propria. */
export interface CallData {
  currentBlock: CallBlockId;
  /** ISO de quando cada bloco comecou. */
  blockStartedAt: Partial<Record<CallBlockId, string>>;
  /** Anotacoes por pergunta (id da pergunta no conteudo). */
  answers: Record<string, string>;
  /** Perguntas e itens de checklist marcados: id -> ISO. */
  ticks: Record<string, string>;
  /** Evidencia curta de cada nota. */
  scoreNotes: Partial<Record<PillarId, string>>;
  /** Resposta a "o que pesa mais" (bloco Necessidade). */
  needPriority: NeedPriorityId | null;
  /** O lead disse o custo de ficar como esta (bloco Implicacao). Destrava a bolsa. */
  costStated: boolean;
  /** O lead topou ver o caminho completo (bloco Pitch). Destrava a cena. */
  pathPermitted: boolean;
  /** Diferencial -> o lead disse que resolve? */
  differentialsResolve: Record<string, 'sim' | 'nao'>;
  /** Passou de 30 min sem devolutiva e o consultor encurtou a call. */
  shortMode: boolean;
  /** Bloco Proximo passo: o lead quis ver a bolsa ou preferiu esperar. */
  nextStepChoice: 'bolsa' | 'esperar' | null;
  /** Frase usada no roteiro da devolutiva ({{frase}}). */
  featuredQuoteId: string | null;
  /** Anotacoes livres do consultor. Nunca vao para o lead. */
  privateNotes: string;
  presentation: PresentationSnapshot | null;
}

export interface SceneToggle {
  id: string;
  enabled: boolean;
}

export interface PrepConfig {
  v: 1;
  archetypeConfirmed: boolean;
  /** Lead com medo ou na defensiva: reportagens mais leves. */
  fearful: boolean;
  /** Reportagens planejadas para a tela (precisam de URL). */
  newsScreen: string[];
  /** Reportagens planejadas so para citar falando. Tela + falar <= 2. */
  newsSpoken: string[];
  /** Diferenciais a mostrar primeiro (no maximo 3). */
  differentials: string[];
  /** Cenas da tela do lead, na ordem da sequencia. */
  scenes: SceneToggle[];
  offer: OfferConfig;
  /** ISO de quando o consultor terminou a preparacao. */
  readyAt: string | null;
}

export type ScholarshipStatus = 'none' | 'presented' | 'closed';

export interface DiagnosisFields {
  score_uso: number | null;
  score_aplic: number | null;
  score_prova: number | null;
  score_cred: number | null;
  score_metodo: number | null;
  archetype_id: string;
  root_cause_override: string;
  quotes: Quote[];
  news_shown_ids: string[];
  commitment_text: string;
  commitment_due_date: string | null;
  commitment_movement: string;
  lesson_url_override: string;
  consultant_name: string;
  consultant_whatsapp: string;
  scholarship_status: ScholarshipStatus;
  offer_requested_at: string | null;
  offer_shown: Record<string, unknown>;
  call_data: CallData;
  prep_config: PrepConfig;
  crm_note_copied_at: string | null;
}

export type DiagnosisOrigin = 'manual' | 'legacy_meeting' | 'sdr' | 'exemplo';

export interface Workspace {
  ids: { diagnosisId: string; sessionId: string; leadId: string };
  /** Versao no servidor (controle de concorrencia). */
  rev: number;
  status: 'draft' | 'sent';
  consultantId: string | null;
  contentVersionId: string | null;
  origin: DiagnosisOrigin;
  currentMeetingId: string | null;
  createdAt: string;
  sentAt: string | null;
  firstSentAt: string | null;
  /** O modelo exato que foi enviado (para reimprimir igual). */
  renderSnapshot: DiagnosisModel | null;
  leadScore: 'A' | 'B' | 'C' | null;
  lead: LeadFields;
  qualification: QualificationFields;
  session: SessionFields;
  diagnosis: DiagnosisFields;
}

/** Secoes que o autosave grava, na ordem dos parametros de diagnostic_save. */
export type WorkspaceSection = 'diagnosis' | 'lead' | 'session' | 'qualification';

export const SCORE_COLUMNS: Record<PillarId, keyof DiagnosisFields> = {
  uso: 'score_uso',
  aplic: 'score_aplic',
  prova: 'score_prova',
  cred: 'score_cred',
  metodo: 'score_metodo',
};

// Padroes e leitura do banco ficam em workspaceRows.ts (tamanho do arquivo).
export {
  defaultCallData,
  defaultOfferConfig,
  defaultPrepConfig,
  normalizeCallData,
  normalizePrepConfig,
  workspaceFromRows,
} from '@/lib/diagnostic/workspaceRows';
export type { WorkspaceRows } from '@/lib/diagnostic/workspaceRows';

// ---------------------------------------------------------------------------
// Atualizacoes imutaveis (para usar dentro de update(fn) do hook)
// ---------------------------------------------------------------------------

export const patchLead = (ws: Workspace, p: Partial<LeadFields>): Workspace => ({
  ...ws,
  lead: { ...ws.lead, ...p },
  // All graduation editors (preparation, SDR import and delivery) must revoke
  // an ineligible scholarship in the same save, including its seat count.
  diagnosis: p.graduation_status === 'cursando' && ws.diagnosis.scholarship_status !== 'none'
    ? { ...ws.diagnosis, scholarship_status: 'none' }
    : ws.diagnosis,
});

export const patchQualification = (ws: Workspace, p: Partial<QualificationFields>): Workspace => ({
  ...ws,
  qualification: { ...ws.qualification, ...p },
});

export const patchSession = (ws: Workspace, p: Partial<SessionFields>): Workspace => ({
  ...ws,
  session: { ...ws.session, ...p },
});

export const patchDiagnosis = (ws: Workspace, p: Partial<DiagnosisFields>): Workspace => ({
  ...ws,
  diagnosis: { ...ws.diagnosis, ...p },
});

export const patchCallData = (ws: Workspace, p: Partial<CallData>): Workspace =>
  patchDiagnosis(ws, { call_data: { ...ws.diagnosis.call_data, ...p } });

export const patchPrepConfig = (ws: Workspace, p: Partial<PrepConfig>): Workspace =>
  patchDiagnosis(ws, { prep_config: { ...ws.diagnosis.prep_config, ...p } });

export const patchOfferConfig = (ws: Workspace, p: Partial<OfferConfig>): Workspace =>
  patchPrepConfig(ws, { offer: { ...ws.diagnosis.prep_config.offer, ...p } });

/**
 * Colunas do diagnostico que o lead recebeu: o banco recusa mudanca nelas
 * depois de enviado (DIAG_SENT_FROZEN). A tela trava estes campos e os do lead.
 */
export const FROZEN_DIAGNOSIS_FIELDS: readonly (keyof DiagnosisFields)[] = [
  'score_uso',
  'score_aplic',
  'score_prova',
  'score_cred',
  'score_metodo',
  'archetype_id',
  'root_cause_override',
  'quotes',
  'news_shown_ids',
  'commitment_text',
  'commitment_due_date',
  'commitment_movement',
  'lesson_url_override',
  'consultant_name',
  'consultant_whatsapp',
];

// ---------------------------------------------------------------------------
// Patches para diagnostic_save
// ---------------------------------------------------------------------------

export type SectionPatch = Record<string, unknown>;

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function diffSection<T extends object>(saved: T, current: T): SectionPatch {
  const patch: SectionPatch = {};
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (!same(saved[key], current[key])) patch[key as string] = current[key];
  }
  return patch;
}

export interface WorkspacePatch {
  diagnosis: SectionPatch;
  lead: SectionPatch;
  session: SectionPatch;
  qualification: SectionPatch;
}

/** Colunas que mudaram entre o ultimo estado salvo e o atual. */
export function diffWorkspace(saved: Workspace, current: Workspace): WorkspacePatch {
  return {
    diagnosis: diffSection(saved.diagnosis, current.diagnosis),
    lead: diffSection(saved.lead, current.lead),
    session: diffSection(saved.session, current.session),
    qualification: diffSection(saved.qualification, current.qualification),
  };
}

/** Patch com tudo (usado em "manter a minha versao" depois de um conflito). */
export function fullPatch(ws: Workspace): WorkspacePatch {
  return {
    diagnosis: { ...ws.diagnosis },
    lead: { ...ws.lead },
    session: { ...ws.session },
    qualification: { ...ws.qualification },
  };
}

export function isEmptyPatch(p: WorkspacePatch): boolean {
  return (
    Object.keys(p.diagnosis).length === 0 &&
    Object.keys(p.lead).length === 0 &&
    Object.keys(p.session).length === 0 &&
    Object.keys(p.qualification).length === 0
  );
}

// ---------------------------------------------------------------------------
// Entrada das derivacoes
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' de um ISO, no fuso de Sao Paulo. */
function isoToSaoPauloYmd(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts;
}

/** Dia que vai impresso no diagnostico: o da sessao ou o da criacao. */
export function diagnosisDateYmd(ws: Workspace): string {
  return ws.session.scheduled_date || isoToSaoPauloYmd(ws.createdAt);
}

export function scoresOf(ws: Workspace): Record<PillarId, number | null> {
  return {
    uso: ws.diagnosis.score_uso,
    aplic: ws.diagnosis.score_aplic,
    prova: ws.diagnosis.score_prova,
    cred: ws.diagnosis.score_cred,
    metodo: ws.diagnosis.score_metodo,
  };
}

export function toDiagnosisInput(ws: Workspace, conditionLine: string | null): DiagnosisInput {
  const { lead, qualification: q, diagnosis: d } = ws;
  return {
    lead: {
      name: lead.name,
      jobTitle: lead.job_title,
      timeInRoleText: lead.time_in_role_text,
      timeInRoleBucket: lead.time_in_role,
      lastPromotion: lead.last_promotion,
      area: lead.area,
      goal: lead.goal_12m,
      graduation: lead.graduation_status,
      trigger: lead.trigger_event,
      careerMoment: lead.career_moment,
      aiFrequency: lead.ai_frequency,
      aiUses: lead.ai_uses,
      freePhrase: lead.free_phrase,
      whatsapp: lead.whatsapp,
    },
    sdr: {
      name: q.sdr_name,
      painText: q.pain_text,
      decisionScore: q.decision_score,
      acceptsStatusQuo: q.accepts_status_quo,
      commitsToApply: q.commits_to_apply,
    },
    scores: scoresOf(ws),
    archetypeId: d.archetype_id,
    rootCauseOverride: d.root_cause_override,
    quotes: d.quotes,
    newsShownIds: d.news_shown_ids,
    commitment: {
      text: d.commitment_text,
      dueDate: d.commitment_due_date ?? '',
      movement: d.commitment_movement,
    },
    lessonUrlOverride: d.lesson_url_override,
    consultant: { name: d.consultant_name, whatsapp: d.consultant_whatsapp },
    dateYmd: diagnosisDateYmd(ws),
    conditionLine,
  };
}
