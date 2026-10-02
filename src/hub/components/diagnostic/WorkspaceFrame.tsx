import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncStatusChip } from '@/components/SyncStatusBanner';
import { cn } from '@/lib/utils';
import type { DiagnosticWorkspaceApi } from '@/hooks/useDiagnosticWorkspace';
import { diagnosticPaths } from '@/lib/diagnostic/routes';
import type { Workspace } from '@/lib/diagnostic/workspace';
import type { DiagnosisInput, DiagnosisModel, DiagnosticContent, OfferEvaluation } from '@diag/types.ts';

/** O hook depois de carregar: tudo o que as telas usam ja existe. */
export interface ReadyWorkspace extends DiagnosticWorkspaceApi {
  ws: Workspace;
  content: DiagnosticContent;
  offer: OfferEvaluation;
  input: DiagnosisInput;
  model: DiagnosisModel;
}

function isReady(api: DiagnosticWorkspaceApi): api is ReadyWorkspace {
  return !!api.ws && !!api.content && !!api.offer && !!api.input && !!api.model;
}

/** Carregando, nao encontrado ou erro; com tudo pronto, entrega o workspace tipado. */
export function WorkspaceGate({ api, children }: { api: DiagnosticWorkspaceApi; children: (ready: ReadyWorkspace) => ReactNode }) {
  if (api.loadError) {
    const retry = api.retryLoad ?? (() => window.location.reload());
    return (
      <div className="page-container">
        <div className="glass-card p-6 max-w-lg space-y-3" role="alert">
          <p className="text-sm text-red-400">Não deu para abrir este diagnóstico: {api.loadError}</p>
          <Button variant="outline" size="sm" onClick={retry} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </Button>
        </div>
      </div>
    );
  }
  if (api.notFound) {
    return (
      <div className="page-container">
        <div className="glass-card p-6 max-w-lg space-y-3">
          <p className="text-sm text-foreground">Diagnóstico não encontrado.</p>
          <Button asChild variant="outline" size="sm">
            <Link to={diagnosticPaths.sessions}>Voltar para as sessões</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (api.loading || !isReady(api)) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children(api)}</>;
}

const DATE_SP = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });

function sessionLabel(ws: Workspace): string {
  const { scheduled_date: d, scheduled_time: t } = ws.session;
  if (!d) return 'Sem data marcada';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}${t ? `, ${t.slice(0, 5)}` : ''}`;
}

const STAGES = [
  { id: 'prep', label: 'Preparação', path: diagnosticPaths.prep },
  { id: 'cockpit', label: 'Call', path: diagnosticPaths.cockpit },
  { id: 'send', label: 'Entrega', path: diagnosticPaths.send },
] as const;

/** Cabecalho da preparacao e da entrega: lead, etapas e estado do salvamento. */
export function WorkspaceHeader({ api, actions }: { api: ReadyWorkspace; actions?: ReactNode }) {
  const { ws } = api;
  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon" className="hover:bg-accent/50 shrink-0">
            <Link to={diagnosticPaths.sessions} aria-label="Voltar para as sessões">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="page-title truncate">{ws.lead.name || 'Sem nome'}</h2>
              {ws.origin === 'exemplo' && (
                <span className="text-[10px] uppercase tracking-wider rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                  Exemplo
                </span>
              )}
              <SyncStatusChip state={api.sync} />
            </div>
            <p className="page-subtitle">
              Diagnóstico de Carreira com IA · {sessionLabel(ws)}
              {ws.status === 'sent' && ws.sentAt ? ` · enviado em ${DATE_SP.format(new Date(ws.sentAt))}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:ml-auto flex-wrap">
          <nav className="inline-flex rounded-md border border-border p-0.5" aria-label="Etapas do diagnóstico">
            {STAGES.map((s) => (
              <NavLink
                key={s.id}
                to={s.path(ws.ids.sessionId)}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 text-sm rounded',
                    isActive ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {s.label}
              </NavLink>
            ))}
          </nav>
          {actions}
        </div>
      </div>
      <WorkspaceBanners api={api} />
    </div>
  );
}

/** Conflito entre janelas, erro que parou o salvamento, so leitura e enviado. */
export function WorkspaceBanners({ api, compact }: { api: ReadyWorkspace; compact?: boolean }) {
  const pad = compact ? 'px-3 py-2' : 'p-3';
  return (
    <>
      {api.conflict && (
        <div className={cn('rounded-md border border-red-400/40 bg-red-500/10 text-sm flex flex-col sm:flex-row sm:items-center gap-2', pad)}>
          <span className="flex items-center gap-2 text-red-300 flex-1">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Este diagnóstico foi salvo em outra janela. Qual versão fica valendo?
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void api.resolveConflict('theirs')}>
              Usar a outra janela
            </Button>
            <Button size="sm" onClick={() => void api.resolveConflict('mine')}>
              Manter esta
            </Button>
          </div>
        </div>
      )}
      {api.saveError && !api.conflict && (
        <div className={cn('rounded-md border border-red-400/40 bg-red-500/10 text-sm text-red-300 flex items-center gap-2', pad)}>
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span className="flex-1">Salvamento parado: {api.saveError} O que você digitou está guardado neste navegador.</span>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        </div>
      )}
      {!api.canEdit && (
        <div className={cn('rounded-md border border-border bg-muted/30 text-sm text-muted-foreground flex items-center gap-2', pad)}>
          <Lock className="h-4 w-4 shrink-0" />
          {api.passive
            ? 'Esta call já está aberta em outra janela. Esta fica só para leitura.'
            : 'Só leitura: só quem conduz a sessão ou o gestor editam este diagnóstico.'}
        </div>
      )}
      {api.canEdit && api.frozen && (
        <div className={cn('rounded-md border border-emerald-400/30 bg-emerald-500/10 text-sm text-emerald-300 flex items-center gap-2', pad)}>
          <Lock className="h-4 w-4 shrink-0" />
          Enviado. O que o lead recebeu fica travado; para corrigir, reabra na Entrega.
        </div>
      )}
    </>
  );
}
