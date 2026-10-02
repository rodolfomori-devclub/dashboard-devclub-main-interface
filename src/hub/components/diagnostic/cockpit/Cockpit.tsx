import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
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
import { WorkspaceBanners, type ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { cn } from '@/lib/utils';
import type { CallBlockId } from '@diag/types.ts';
import { cockpitScriptVars, enterBlock, orderedBlocks } from '@/lib/diagnostic/cockpit';
import type { Workspace } from '@/lib/diagnostic/workspace';
import { CockpitContext, nowIso, type CockpitContextValue } from './cockpitContext';
import { useBlockShortcuts, useMinWidth, useQuoteDraft, useTakeover, type CockpitLock } from './hooks';
import { CockpitTopBar, type CockpitView } from './CockpitTopBar';
import { CallView } from './CallView';
import { LeadScreenSlot } from './LeadScreenSlot';
import { PdfView } from './PdfView';
import { QuoteDock } from './CaptureSide';
import { Note } from './parts';

/** A partir daqui: tres colunas e a Tela do lead numa aba propria. */
const WIDE_PX = 1024;

/** O aviso de que outra janela conduz a call vem do WorkspaceBanners; aqui so o caminho de volta. */
function ReloadHint() {
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1">Fechou a outra janela? Recarregue para conduzir a call aqui.</span>
      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => window.location.reload()}>
        <RefreshCw />
        Recarregar
      </Button>
    </div>
  );
}

/** Gestor na sessao de outro consultor: acompanha sem gravar nada ate assumir a call. */
function ObserverBanner({ consultant, onTakeOver }: { consultant: string; onTakeOver: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        Você está acompanhando a sessão de {consultant}. Nada do que você fizer aqui é gravado.
      </span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" size="sm" variant="outline" className="h-8">
            Assumir a call
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assumir a call?</AlertDialogTitle>
            <AlertDialogDescription>
              Só assuma se for conduzir a call no lugar de {consultant}. Daqui em diante o que você mudar é gravado. Se a
              call também estiver aberta com {consultant}, o salvamento de um de vocês para e pede para escolher qual versão
              fica valendo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar só acompanhando</AlertDialogCancel>
            <AlertDialogAction onClick={onTakeOver}>Assumir a call</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CockpitProps {
  api: ReadyWorkspace;
  /** Trava da pagina: 'denied' quando outra janela conduz esta call. */
  lock: CockpitLock;
  /** Quem esta vendo: o gestor fora da propria sessao so acompanha. */
  viewerId: string | null;
}

/**
 * Cockpit da call (privado): os 9 blocos do playbook com os dados do lead
 * encaixados, a captura (respostas, notas, frases, compromisso) e o controle
 * da tela do lead. Cabe numa coluna estreita ao lado do video e usa a tela
 * larga em tres colunas.
 */
export function Cockpit({ api, lock, viewerId }: CockpitProps) {
  const { ws, content, update } = api;
  const wide = useMinWidth(WIDE_PX);
  const [view, setView] = useState<CockpitView>('call');
  const [pdfMounted, setPdfMounted] = useState(false);
  const [localBlock, setLocalBlock] = useState<CallBlockId | null>(null);
  const [quoteDraft, setQuoteDraft] = useQuoteDraft(ws.ids.diagnosisId);
  const [tookOver, takeOver] = useTakeover(ws.ids.diagnosisId, viewerId);

  const lockDenied = lock === 'denied' || api.passive;
  // Gestor na sessao de outro consultor: um clique num bloco ou uma tecla gravaria e pararia o autosave de quem conduz.
  const observer = api.canEdit && !!ws.consultantId && ws.consultantId !== viewerId && !tookOver;
  const locked = !api.canEdit || lockDenied || observer;
  // Depois de enviado so as notas privadas mudam (reabrir fica na Entrega).
  const readOnly = locked || api.frozen;

  const write = useCallback(
    (fn: (w: Workspace) => Workspace) => {
      if (!readOnly) update(fn);
    },
    [readOnly, update],
  );

  const blocks = useMemo(() => orderedBlocks(content), [content]);
  const persisted = ws.diagnosis.call_data.currentBlock;
  // Em so leitura da para navegar pelos blocos, sem gravar.
  const block = blocks.find((b) => b.id === (readOnly ? localBlock ?? persisted : persisted)) ?? blocks[0];

  const goToBlock = useCallback(
    (id: CallBlockId) => {
      if (readOnly) setLocalBlock(id);
      else update((w) => enterBlock(w, id, nowIso()));
    },
    [readOnly, update],
  );
  useBlockShortcuts(blocks, block?.id ?? persisted, ws.diagnosis.call_data.shortMode, goToBlock);

  const vars = useMemo(
    () => cockpitScriptVars({ ws, input: api.input, model: api.model, content, settings: api.settings, nowMs: Date.now() }),
    [ws, api.input, api.model, content, api.settings],
  );

  const activeView: CockpitView = !wide && view === 'lead' ? 'call' : view;
  useEffect(() => {
    if (activeView === 'pdf') setPdfMounted(true);
  }, [activeView]);

  // Titulo da janela: deixa claro qual NAO compartilhar na call.
  const firstName = ws.lead.name.trim().split(/\s+/)[0] ?? '';
  useEffect(() => {
    const previous = document.title;
    document.title = `Cockpit privado · ${firstName || 'Diagnóstico'}`;
    return () => {
      document.title = previous;
    };
  }, [firstName]);

  if (!block) {
    return (
      <div className="page-container">
        <Note tone="warn">O roteiro da call não está no conteúdo publicado. Fale com a Head.</Note>
      </div>
    );
  }

  const ctx: CockpitContextValue = { api, locked, readOnly, write, blocks, block, goToBlock, vars, quoteDraft, setQuoteDraft };

  return (
    <CockpitContext.Provider value={ctx}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <CockpitTopBar view={activeView} onView={setView} wide={wide} />
        <div className="space-y-2 px-3 pt-3 empty:hidden sm:px-4">
          <WorkspaceBanners api={api} compact />
          {lockDenied && <ReloadHint />}
          {observer && (
            <ObserverBanner consultant={ws.diagnosis.consultant_name.trim() || 'outro consultor'} onTakeOver={takeOver} />
          )}
        </div>
        <main className="flex-1 px-3 py-3 sm:px-4">
          <LeadScreenSlot
            visible={wide ? activeView === 'lead' : activeView === 'call'}
            narrow={!wide}
            ready={lock !== 'pending'}
            lockDenied={lockDenied}
          />
          <div className={cn(activeView !== 'call' && 'hidden')}>
            <CallView wide={wide} />
          </div>
          {pdfMounted && (
            <div className={cn(activeView !== 'pdf' && 'hidden')}>
              <PdfView />
            </div>
          )}
        </main>
        {!wide && <QuoteDock hidden={activeView !== 'call'} />}
      </div>
    </CockpitContext.Provider>
  );
}
