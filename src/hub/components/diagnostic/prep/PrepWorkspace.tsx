import { useMemo } from 'react';
import { WorkspaceHeader, type ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { prepChecklist } from '@/lib/diagnostic/prepChecklist';
import { LeadCard } from './LeadCard';
import { OfferCard } from './OfferCard';
import { PrecallCard } from './PrecallCard';
import { PrepChecklistPanel } from './PrepChecklistPanel';
import { ScenesCard } from './ScenesCard';
import { ScriptCard } from './ScriptCard';
import { SdrCard } from './SdrCard';
import { SellerCard } from './SellerCard';
import { StartCallButton } from './StartCallButton';

/** Preparacao (antes da call): cartoes a esquerda, checklist fixo a direita no desktop. */
export function PrepWorkspace({ api }: { api: ReadyWorkspace }) {
  const { ws, model, offer, content } = api;
  const items = useMemo(() => prepChecklist(ws, model, offer, content), [ws, model, offer, content]);

  return (
    <div className="page-container space-y-5">
      <WorkspaceHeader api={api} actions={<StartCallButton api={api} items={items} />} />
      <div className="grid gap-5 items-start lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 min-w-0">
          <LeadCard api={api} />
          <SdrCard api={api} />
          <PrecallCard api={api} />
          <ScriptCard api={api} />
          <ScenesCard api={api} />
          <OfferCard api={api} />
          <SellerCard api={api} />
        </div>
        {/* A pagina rola dentro do <main> do Layout, abaixo do cabecalho de 56px. */}
        <aside
          aria-label="Checklist da preparação"
          className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <PrepChecklistPanel api={api} items={items} />
        </aside>
      </div>
    </div>
  );
}
