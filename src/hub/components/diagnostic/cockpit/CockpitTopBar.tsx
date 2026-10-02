import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Loader2, MoreVertical, Play, Square, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SyncStatusChip } from '@/components/SyncStatusBanner';
import { cn } from '@/lib/utils';
import { addQuote, EMPTY_QUOTE_DRAFT, quoteTagForBlock } from '@/lib/diagnostic/capture';
import { captureStatus, elapsedSeconds, formatClock, startCall, timerTone, type TimerTone } from '@/lib/diagnostic/cockpit';
import { diagnosticPaths } from '@/lib/diagnostic/routes';
import { patchDiagnosis, patchSession } from '@/lib/diagnostic/workspace';
import { nowIso, useCockpit } from './cockpitContext';
import { blockVisitStart, useBlockVisitSince, useNow } from './hooks';
import { CaptureStatusLine } from './CaptureSide';

export type CockpitView = 'call' | 'lead' | 'pdf';

const TONE_CLASS: Record<TimerTone, string> = {
  idle: 'text-muted-foreground',
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  over: 'text-red-400',
};

/** Cronometros da call e do bloco: so informam (verde, ambar ate 2 min, vermelho). */
function Clocks() {
  const { api, blocks } = useCockpit();
  const now = useNow(1000);
  const { call_started_at: started, call_ended_at: ended } = api.ws.session;
  const cd = api.ws.diagnosis.call_data;
  // O cronometro e do bloco em que a call esta (nao do que esta sendo so lido).
  const block = blocks.find((b) => b.id === cd.currentBlock) ?? null;
  const visitSince = useBlockVisitSince(api.ws.ids.diagnosisId, cd.currentBlock);
  const callSec = elapsedSeconds(started, now, ended);
  if (callSec == null) return null;
  if (ended) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Timer className="h-3.5 w-3.5" aria-hidden="true" />
        Call encerrada · {formatClock(callSec)}
      </span>
    );
  }
  // Conta desta entrada no bloco: voltar a ele (ou ter espiado antes) nao herda o tempo da primeira vez.
  const blockSec = elapsedSeconds(block ? blockVisitStart(cd, visitSince) : null, now);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums">
      <span className={cn('inline-flex items-center gap-1 font-semibold', TONE_CLASS[timerTone(callSec, block, 'call')])} title="Tempo de call">
        <Timer className="h-3.5 w-3.5" aria-hidden="true" />
        {formatClock(callSec)}
      </span>
      {block && blockSec != null && (
        <span className={TONE_CLASS[timerTone(blockSec, block)]} title="Tempo no bloco contra a janela do roteiro">
          Bloco {formatClock(blockSec)} · min {block.min_inicio}-{block.min_fim}
        </span>
      )}
    </span>
  );
}

function EndCallButton() {
  const { api, block, write, quoteDraft, setQuoteDraft } = useCockpit();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = captureStatus(api.ws);
  // Frase digitada sem Enter: so existe no rascunho do cockpit, a entrega nao a ve.
  const pendingQuote = quoteDraft.text.trim();

  const end = async (keepQuote: boolean) => {
    setBusy(true);
    if (pendingQuote) {
      if (keepQuote) {
        // Mesma marca que o campo de frases usaria (a escolhida ou a do bloco atual).
        const tag = quoteDraft.tag ?? quoteTagForBlock(block.id);
        write((w) => patchDiagnosis(w, { quotes: addQuote(w.diagnosis.quotes, pendingQuote, tag) }));
      }
      setQuoteDraft(EMPTY_QUOTE_DRAFT);
    }
    write((w) => patchSession(w, { call_ended_at: nowIso() }));
    const saved = await api.flush();
    setBusy(false);
    if (!saved) {
      setOpen(false);
      toast.error('Não deu para salvar agora. Confira o aviso no topo e tente de novo.');
      return;
    }
    navigate(diagnosticPaths.send(api.ws.ids.sessionId));
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5">
          <Square className="h-3.5 w-3.5" />
          Encerrar call
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar a call?</AlertDialogTitle>
          <AlertDialogDescription>
            O cronômetro para e você vai para a entrega. A captura mínima é 1 frase, as 5 notas, o compromisso e a data; o resto
            dá para completar antes de enviar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {pendingQuote && (
          <div className="space-y-1 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <p className="font-medium">Tem uma frase dele digitada e ainda não guardada:</p>
            <p className="break-words italic text-foreground">"{pendingQuote}"</p>
          </div>
        )}
        {!status.complete && <CaptureStatusLine className="text-sm" />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Continuar na call</AlertDialogCancel>
          {pendingQuote && (
            <Button type="button" variant="outline" className="mt-2 sm:mt-0" disabled={busy} onClick={() => void end(false)}>
              Encerrar sem a frase
            </Button>
          )}
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              // Fecha so depois de salvar (ou de falhar).
              e.preventDefault();
              void end(true);
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {pendingQuote ? 'Guardar a frase e encerrar' : 'Encerrar e ir para a entrega'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CallButtons() {
  const { api, readOnly, write } = useCockpit();
  const { call_started_at: started, call_ended_at: ended } = api.ws.session;
  if (ended) {
    return (
      <Button asChild size="sm" variant="outline" className="h-8 gap-1">
        <Link to={diagnosticPaths.send(api.ws.ids.sessionId)}>
          Ir para a entrega
          <ChevronRight />
        </Link>
      </Button>
    );
  }
  if (readOnly) return started ? null : <span className="text-xs text-muted-foreground">Call não iniciada</span>;
  if (!started) {
    return (
      <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => write((w) => startCall(w, nowIso()))}>
        <Play className="h-3.5 w-3.5" />
        Iniciar call
      </Button>
    );
  }
  return <EndCallButton />;
}

function ViewSwitch({ view, onView, wide }: { view: CockpitView; onView: (v: CockpitView) => void; wide: boolean }) {
  const views: { id: CockpitView; label: string }[] = [
    { id: 'call', label: 'Call' },
    ...(wide ? [{ id: 'lead' as const, label: 'Tela do lead' }] : []),
    { id: 'pdf', label: 'PDF' },
  ];
  return (
    <div role="group" className="inline-flex rounded-md border border-border p-0.5" aria-label="O que ver">
      {views.map((v) => (
        <button
          key={v.id}
          type="button"
          aria-pressed={view === v.id}
          onClick={() => onView(v.id)}
          className={cn(
            'rounded px-2.5 py-1 text-sm',
            view === v.id ? 'bg-primary/15 font-medium text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/** Barra compacta: volta, lead, cronometros, inicio e fim da call, salvamento e abas. */
export function CockpitTopBar({ view, onView, wide }: { view: CockpitView; onView: (v: CockpitView) => void; wide: boolean }) {
  const { api } = useCockpit();
  const { ws } = api;
  const first = ws.lead.name.trim().split(/\s+/)[0] || 'Sem nome';
  const subtitle = [ws.lead.job_title.trim(), ws.lead.area.trim()].filter(Boolean).join(' · ');
  // Estreito: lead (com o salvamento), abas e menu na 1a linha; cronometros e a call na 2a.
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:px-4 lg:h-14 lg:flex-nowrap lg:py-0">
        <Button asChild variant="ghost" size="icon" className="order-1 h-8 w-8 shrink-0">
          <Link to={diagnosticPaths.sessions} aria-label="Voltar para as sessões">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="order-2 min-w-0 flex-1 lg:max-w-[260px] lg:flex-none">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span className="truncate">{first}</span>
            {ws.origin === 'exemplo' && (
              <span className="shrink-0 rounded border border-border px-1 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                Exemplo
              </span>
            )}
          </p>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 empty:hidden lg:hidden">
              <SyncStatusChip state={api.sync} />
            </span>
            {subtitle && <p className="min-w-0 truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="order-4 flex w-full flex-wrap items-center gap-x-3 gap-y-1 lg:order-3 lg:w-auto lg:flex-nowrap">
          <Clocks />
          <div className="ml-auto lg:ml-0">
            <CallButtons />
          </div>
        </div>
        <div className="order-3 flex items-center gap-2 lg:order-4 lg:ml-auto">
          <span className="hidden empty:hidden lg:inline-flex">
            <SyncStatusChip state={api.sync} />
          </span>
          <ViewSwitch view={view} onView={onView} wide={wide} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Outras etapas">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={diagnosticPaths.prep(ws.ids.sessionId)}>Preparação</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={diagnosticPaths.send(ws.ids.sessionId)}>Entrega</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
