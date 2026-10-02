import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Loader2, Plus, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateDiagnostic, useDiagnosticSessions } from '@/hooks/useDiagnosticData';
import { NewDiagnosisDialog } from '@/components/diagnostic/sessions/NewDiagnosisDialog';
import { SessionRow } from '@/components/diagnostic/sessions/SessionRow';
import { bucketSessions, type SessionBucket } from '@/lib/diagnostic/sessionBuckets';
import { diagnosticErrorMessage } from '@/lib/diagnostic/errors';
import { examplePayload } from '@/lib/diagnostic/example';
import { diagnosticPaths, SALES_SUPPORT_PATH } from '@/lib/diagnostic/routes';
import { todayYmd } from '@diag/dates.ts';
import { normalizeText } from '@diag/guardrails.ts';
import { DiagnosticScope } from '@/components/diagnostic/DiagnosticScope';

/** A lista vem do banco ja cortada nas mais recentes (sem paginacao). */
const SESSION_LIMIT = 200;

const TABS: { id: SessionBucket; label: string; empty: string }[] = [
  { id: 'toDeliver', label: 'Para entregar', empty: 'Nada para entregar. Quando a call termina, o diagnóstico fica aqui até ser enviado.' },
  { id: 'today', label: 'Hoje', empty: 'Nenhuma sessão marcada para hoje.' },
  { id: 'drafts', label: 'Rascunhos', empty: 'Nenhum rascunho. Crie um diagnóstico novo ou um exemplo para ensaiar a call.' },
  { id: 'sent', label: 'Enviados', empty: 'Nenhum diagnóstico enviado ainda.' },
];

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

function DiagnosticSessionsScreen() {
  const { isManager, isPreSales } = useAuth();
  const [scope, setScope] = useState<'mine' | 'all'>(isManager || isPreSales ? 'all' : 'mine');
  const [tab, setTab] = useState<SessionBucket | null>(null);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const { data = [], isLoading, error, refetch } = useDiagnosticSessions(scope, SESSION_LIMIT);
  const create = useCreateDiagnostic();
  const navigate = useNavigate();
  const now = useNow(30_000);
  const today = todayYmd(now);

  const query = normalizeText(search.trim());
  const filtered = query ? data.filter((i) => normalizeText(i.leadName).includes(query)) : data;
  const buckets = bucketSessions(filtered, today);
  // Sem escolha do vendedor: o que tem prazo primeiro, depois o dia.
  const activeTab: SessionBucket =
    tab ?? (buckets.toDeliver.length ? 'toDeliver' : buckets.today.length ? 'today' : 'drafts');
  const items = buckets[activeTab];
  const current = TABS.find((t) => t.id === activeTab)!;

  const createExample = () => {
    if (create.isPending) return;
    const p = examplePayload(today);
    create.mutate(
      { lead: p.lead, session: p.session, qualification: p.qualification, diagnosis: p.diagnosis, origin: 'exemplo' },
      { onSuccess: (sessionId) => navigate(diagnosticPaths.prep(sessionId)) },
    );
  };

  return (
    <div className="page-container space-y-5">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon" className="hover:bg-accent/50 shrink-0">
            <Link to={SALES_SUPPORT_PATH} aria-label="Voltar para Apoio Vendas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h2 className="page-title">Diagnóstico de Carreira com IA</h2>
            <p className="page-subtitle">Sessões do MBA: preparar, conduzir a call e entregar o diagnóstico</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:ml-auto flex-wrap">
          {isManager && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Link to={diagnosticPaths.settings}>
                <Settings className="h-4 w-4" /> Configurações
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={createExample} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Criar exemplo
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Novo diagnóstico
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex rounded-md border border-border p-0.5 self-start">
          {(['mine', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 text-sm rounded ${scope === s ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'mine' ? 'Minhas' : 'Do time'}
            </button>
          ))}
        </div>
        <div className="relative sm:max-w-xs w-full">
          <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pelo nome" className="pl-8" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setTab(v as SessionBucket)}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              {t.label}
              <span className="text-xs tabular-nums text-muted-foreground">{buckets[t.id].length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!isLoading && !error && data.length >= SESSION_LIMIT && (
        <p className="text-xs text-muted-foreground">
          Mostrando só as {SESSION_LIMIT} sessões mais recentes. As mais antigas ficam fora das abas, das contagens e da busca.
        </p>
      )}

      {isLoading ? (
        <div className="glass-card p-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="glass-card p-6 text-sm space-y-3">
          <p className="text-red-400">Não deu para carregar as sessões: {diagnosticErrorMessage(error)}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          {query ? 'Nenhuma sessão com esse nome nesta aba.' : current.empty}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <SessionRow key={item.sessionId} item={item} now={now} todayYmd={today} showConsultant={scope === 'all'} />
          ))}
        </div>
      )}

      <NewDiagnosisDialog open={newOpen} onOpenChange={setNewOpen} defaultDate={today} />
    </div>
  );
}

export default function DiagnosticSessions() {
  return (
    <DiagnosticScope>
      <DiagnosticSessionsScreen />
    </DiagnosticScope>
  );
}
