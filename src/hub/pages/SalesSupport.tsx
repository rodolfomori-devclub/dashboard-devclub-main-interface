import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Settings, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useDiagnosticSessions } from '@/hooks/useDiagnosticData';
import { bucketSessions, deliveryClock } from '@/lib/diagnostic/sessionBuckets';
import { diagnosticPaths } from '@/lib/diagnostic/routes';
import { todayYmd } from '@diag/dates.ts';
import { DiagnosticScope } from '@/components/diagnostic/DiagnosticScope';

interface Tool {
  id: string;
  icon: LucideIcon;
  title: string;
  tag: string;
  description: string;
  path: string;
  settingsPath?: string;
}

// Ferramentas da secao. Uma nova ferramenta entra aqui e ganha a propria rota.
const TOOLS: Tool[] = [
  {
    id: 'diagnostico',
    icon: Compass,
    title: 'Diagnóstico de Carreira com IA',
    tag: 'MBA',
    description:
      'Sessão gratuita para quem aplicou ao MBA: as perguntas da call em ordem, a tela para compartilhar com o lead e o diagnóstico em PDF com os próximos passos.',
    path: diagnosticPaths.sessions,
    settingsPath: diagnosticPaths.settings,
  },
];

function Stat({ label, value, tone = 'default' }: { label: string; value: number | string; tone?: 'default' | 'warn' | 'late' }) {
  const color = tone === 'late' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-foreground';
  return (
    <div className="rounded-md border border-border/60 px-3 py-2">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function SalesSupportScreen() {
  const { isManager, isPreSales } = useAuth();
  const scope = isManager || isPreSales ? 'all' : 'mine';
  const { data: sessions = [], isLoading } = useDiagnosticSessions(scope);
  const now = Date.now();
  const buckets = bucketSessions(sessions, todayYmd(now));
  const late = buckets.toDeliver.some((s) => deliveryClock(s.callEndedAt, now)?.late);

  return (
    <div className="page-container space-y-6">
      <div>
        <h2 className="page-title">Apoio Vendas</h2>
        <p className="page-subtitle">Ferramentas para usar com o lead durante a call</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {TOOLS.map((tool) => (
          <div key={tool.id} className="glass-card p-5 flex flex-col gap-4 transition-colors hover:border-primary/40">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <tool.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{tool.title}</h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider rounded border border-primary/30 text-primary px-1.5 py-0.5">
                    {tool.tag}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
              </div>
            </div>

            {tool.id === 'diagnostico' && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Hoje" value={isLoading ? '–' : buckets.today.length} />
                  <Stat
                    label="Para entregar"
                    value={isLoading ? '–' : buckets.toDeliver.length}
                    tone={late ? 'late' : buckets.toDeliver.length > 0 ? 'warn' : 'default'}
                  />
                  <Stat label="Rascunhos" value={isLoading ? '–' : buckets.drafts.length} />
                </div>
                <p className="text-xs text-muted-foreground">{scope === 'mine' ? 'Suas sessões' : 'Sessões do time'}</p>
              </div>
            )}

            <div className="flex items-center gap-2 mt-auto">
              <Button asChild className="gap-2">
                <Link to={tool.path}>
                  Abrir <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {isManager && tool.settingsPath && (
                <Button asChild variant="ghost" className="gap-2 text-muted-foreground">
                  <Link to={tool.settingsPath}>
                    <Settings className="h-4 w-4" /> Configurações
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SalesSupport() {
  return (
    <DiagnosticScope>
      <SalesSupportScreen />
    </DiagnosticScope>
  );
}
