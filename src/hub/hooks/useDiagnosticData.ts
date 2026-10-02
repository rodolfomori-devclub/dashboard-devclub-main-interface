import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { offerSettingsFromRow, type DiagnosticSettingsRow } from '@/lib/diagnostic/settings';
import { diagnosticErrorMessage } from '@/lib/diagnostic/errors';
import { validateContentShape } from '@diag/content.ts';
import type { DiagnosticContent, OfferSettings } from '@diag/types.ts';

// ---------------------------------------------------------------------------
// Conteudo
// ---------------------------------------------------------------------------

export interface LoadedContent {
  id: string;
  version: number;
  content: DiagnosticContent;
}

/**
 * Conteudo de uma versao especifica (a fixada no diagnostico) ou o publicado.
 * O conteudo do Time MBA e interno: vive so no banco, nunca no codigo da
 * interface. Sem ele a tela mostra o erro com "tentar de novo".
 */
export function useDiagnosticContent(versionId?: string | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['diagnostic_content', versionId ?? 'published'],
    enabled: options.enabled ?? true,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<LoadedContent> => {
      let query = supabase.from('diagnostic_content_versions').select('id, version, content');
      query = versionId ? query.eq('id', versionId) : query.eq('status', 'published');
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('DIAG_CONTENT_MISSING');
      const problems = validateContentShape(data.content);
      if (problems.length > 0) {
        console.warn('[diagnostico] conteudo do banco com problemas:', problems);
        throw new Error('DIAG_CONTENT_INVALID');
      }
      return { id: data.id, version: data.version, content: data.content as unknown as DiagnosticContent };
    },
  });
}

// ---------------------------------------------------------------------------
// Configuracoes da Head (fatos da turma)
// ---------------------------------------------------------------------------

export function useDiagnosticSettings() {
  return useQuery({
    queryKey: ['diagnostic_settings'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{ row: DiagnosticSettingsRow | null; offer: OfferSettings }> => {
      const { data, error } = await supabase.from('diagnostic_settings').select('*').maybeSingle();
      if (error) throw error;
      return { row: data, offer: offerSettingsFromRow(data) };
    },
  });
}

export type DiagnosticSettingsPatch = Partial<
  Pick<
    DiagnosticSettingsRow,
    | 'cohort_name'
    | 'list_price'
    | 'scholarship_max'
    | 'seats_total'
    | 'seats_granted'
    | 'seats_fresh_days'
    | 'reservation_max_days'
  >
> & { confirmSeats?: boolean };

export function useUpdateDiagnosticSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ confirmSeats, ...patch }: DiagnosticSettingsPatch) => {
      const row: Record<string, unknown> = { ...patch, updated_by: user?.id ?? null };
      if (confirmSeats) {
        row.seats_confirmed_at = new Date().toISOString();
        row.seats_confirmed_by = user?.id ?? null;
      }
      // Sem permissao o RLS devolve 0 linhas e nenhum erro: conferir o retorno.
      const { data, error } = await supabase.from('diagnostic_settings').update(row).eq('id', true).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('DIAG_FORBIDDEN');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diagnostic_settings'] });
      toast.success('Configurações salvas');
    },
    onError: (err) => toast.error(diagnosticErrorMessage(err)),
  });
}

// ---------------------------------------------------------------------------
// Preferencias do vendedor (nome e WhatsApp do PDF, padroes da preparacao)
// ---------------------------------------------------------------------------

export function useSellerPreset() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['diagnostic_seller_presets', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diagnostic_seller_presets')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveSellerPreset() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (preset: { display_name?: string; whatsapp?: string; prep_config?: Json }) => {
      if (!user) throw new Error('Sem usuário');
      const { error } = await supabase
        .from('diagnostic_seller_presets')
        .upsert({ user_id: user.id, ...preset }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diagnostic_seller_presets'] });
      toast.success('Padrão salvo');
    },
    onError: (err) => toast.error(diagnosticErrorMessage(err)),
  });
}

// ---------------------------------------------------------------------------
// Lista de sessoes
// ---------------------------------------------------------------------------

export interface DiagnosticSessionItem {
  sessionId: string;
  diagnosisId: string | null;
  leadId: string;
  leadName: string;
  area: string;
  jobTitle: string;
  origin: string;
  consultantId: string | null;
  consultantName: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  sessionStatus: string;
  callStartedAt: string | null;
  callEndedAt: string | null;
  diagnosisStatus: 'draft' | 'sent';
  sentAt: string | null;
  indexTotal: number | null;
  commitmentDueDate: string | null;
  scholarshipStatus: string;
  createdAt: string;
  updatedAt: string;
}

const SESSION_COLUMNS = 'id, lead_id, scheduled_date, scheduled_time, status, origin, consultant_id, call_started_at, call_ended_at, created_at';
const LEAD_COLUMNS = 'id, name, area, job_title';
const DIAGNOSIS_COLUMNS = 'id, session_id, status, sent_at, index_total, commitment_due_date, scholarship_status, updated_at';
/** ids por pedido: mantem o endereco curto (o proxy do Dashboard recusa selects relacionais). */
const IDS_PER_REQUEST = 80;

type Row = Record<string, unknown>;

/** Linhas de `table` cujo `column` esta em `ids`, em lotes. */
async function rowsWhereIn(table: string, columns: string, column: string, ids: string[]): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += IDS_PER_REQUEST) batches.push(unique.slice(i, i + IDS_PER_REQUEST));
  // As tabelas do diagnostico ficam fora dos tipos gerados do Dashboard.
  const db = supabase as any;
  const results: { data: Row[] | null; error: unknown }[] = await Promise.all(
    batches.map((batch) => db.from(table).select(columns).in(column, batch)),
  );
  return results.flatMap(({ data, error }) => {
    if (error) throw error;
    return data ?? [];
  });
}

const byKey = (rows: Row[], key: string) => new Map(rows.map((row) => [String(row[key]), row]));

export function useDiagnosticSessions(scope: 'mine' | 'all', limit = 200) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['diagnostic_sessions', scope, user?.id, limit],
    enabled: !!user,
    queryFn: async (): Promise<DiagnosticSessionItem[]> => {
      let query = supabase
        .from('diagnostic_sessions')
        .select(SESSION_COLUMNS)
        .order('scheduled_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (scope === 'mine') query = query.eq('consultant_id', user!.id);
      const { data, error } = await query;
      if (error) throw error;
      const sessions = (data ?? []) as unknown as Row[];
      const [leads, diagnoses, consultants] = await Promise.all([
        rowsWhereIn('diagnostic_leads', LEAD_COLUMNS, 'id', sessions.map((s) => String(s.lead_id ?? ''))),
        rowsWhereIn('diagnostic_diagnoses', DIAGNOSIS_COLUMNS, 'session_id', sessions.map((s) => String(s.id))),
        rowsWhereIn('profiles', 'id, name', 'id', sessions.map((s) => String(s.consultant_id ?? ''))),
      ]);
      const leadById = byKey(leads, 'id');
      const diagnosisBySession = byKey(diagnoses, 'session_id');
      const consultantById = byKey(consultants, 'id');
      return sessions.map((r) => {
        const lead: Row = leadById.get(String(r.lead_id)) ?? {};
        const diag = diagnosisBySession.get(String(r.id)) ?? null;
        const consultant = r.consultant_id ? consultantById.get(String(r.consultant_id)) ?? null : null;
        return {
          sessionId: String(r.id),
          diagnosisId: diag ? String(diag.id) : null,
          leadId: String(lead.id ?? ''),
          leadName: String(lead.name ?? ''),
          area: String(lead.area ?? ''),
          jobTitle: String(lead.job_title ?? ''),
          origin: String(r.origin ?? ''),
          consultantId: (r.consultant_id as string | null) ?? null,
          consultantName: String(consultant?.name ?? ''),
          scheduledDate: (r.scheduled_date as string | null) ?? null,
          scheduledTime: (r.scheduled_time as string | null) ?? null,
          sessionStatus: String(r.status ?? ''),
          callStartedAt: (r.call_started_at as string | null) ?? null,
          callEndedAt: (r.call_ended_at as string | null) ?? null,
          diagnosisStatus: diag?.status === 'sent' ? 'sent' : 'draft',
          sentAt: (diag?.sent_at as string | null) ?? null,
          indexTotal: (diag?.index_total as number | null) ?? null,
          commitmentDueDate: (diag?.commitment_due_date as string | null) ?? null,
          scholarshipStatus: String(diag?.scholarship_status ?? 'none'),
          createdAt: String(r.created_at ?? ''),
          updatedAt: String(diag?.updated_at ?? r.created_at ?? ''),
        };
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Criacao
// ---------------------------------------------------------------------------

export interface CreateDiagnosticArgs {
  lead: Record<string, unknown>;
  session?: Record<string, unknown>;
  qualification?: Record<string, unknown>;
  diagnosis?: Record<string, unknown>;
  origin?: 'manual' | 'exemplo';
}

/** Cria lead + sessao + diagnostico. Devolve o id da sessao. */
export function useCreateDiagnostic() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: CreateDiagnosticArgs): Promise<string> => {
      const { data, error } = await supabase.rpc('diagnostic_create', {
        _lead: args.lead as Json,
        _session: (args.session ?? {}) as Json,
        _qualification: (args.qualification ?? {}) as Json,
        _diagnosis: (args.diagnosis ?? {}) as Json,
        _origin: args.origin ?? 'manual',
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (sessionId, args) => {
      qc.invalidateQueries({ queryKey: ['diagnostic_sessions'] });
      if (user) {
        logActivity({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: 'DIAGNOSIS_CREATED',
          details: String(args.lead.name ?? ''),
          entityType: 'diagnostic_session',
          entityId: sessionId,
        });
      }
    },
    onError: (err) => toast.error(diagnosticErrorMessage(err)),
  });
}
