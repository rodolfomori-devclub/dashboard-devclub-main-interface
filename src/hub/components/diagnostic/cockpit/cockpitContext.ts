import { createContext, useContext } from 'react';
import type { CallBlock, CallBlockId, TemplateVars } from '@diag/types.ts';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import type { QuoteDraft } from '@/lib/diagnostic/capture';
import type { Workspace } from '@/lib/diagnostic/workspace';

export interface CockpitContextValue {
  api: ReadyWorkspace;
  /**
   * Sem permissao, a call aberta em outra janela ou gestor so acompanhando a
   * sessao de outro consultor: nada grava, nem as notas privadas.
   */
  locked: boolean;
  /** `locked` ou ja enviado: so as notas privadas continuam editaveis. */
  readOnly: boolean;
  /** Grava pelo autosave; ignorado quando readOnly. */
  write: (fn: (ws: Workspace) => Workspace) => void;
  blocks: CallBlock[];
  /** Bloco na tela (em so leitura a navegacao e local e nao grava). */
  block: CallBlock;
  goToBlock: (id: CallBlockId) => void;
  /** Variaveis dos roteiros ja montadas para o lead desta sessao. */
  vars: TemplateVars;
  /** Frase sendo digitada (ainda nao guardada): a mesma em todos os campos de frases. */
  quoteDraft: QuoteDraft;
  setQuoteDraft: (draft: QuoteDraft) => void;
}

export const CockpitContext = createContext<CockpitContextValue | null>(null);

export function useCockpit(): CockpitContextValue {
  const value = useContext(CockpitContext);
  if (!value) throw new Error('useCockpit fora do Cockpit');
  return value;
}

export const nowIso = (): string => new Date().toISOString();
