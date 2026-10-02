/**
 * Contrato de useDiagnosticWorkspace (o que as telas de preparacao, call e
 * entrega recebem). Separado do hook so por tamanho; o hook reexporta.
 */
import type { SyncState } from '@/components/SyncStatusBanner';
import type { MarkSentResult } from '@/hooks/useWorkspaceStatusActions';
import type { Workspace } from '@/lib/diagnostic/workspace';
import type {
  DiagnosisInput,
  DiagnosisModel,
  DiagnosticContent,
  OfferEvaluation,
  OfferSettings,
  ValidationIssue,
} from '@diag/types.ts';

export interface DiagnosticWorkspaceApi {
  loading: boolean;
  notFound: boolean;
  loadError: string | null;
  /** Le o banco de novo depois de um erro ao abrir. */
  retryLoad?: () => void;
  ws: Workspace | null;
  content: DiagnosticContent | null;
  settings: OfferSettings;
  offer: OfferEvaluation | null;
  input: DiagnosisInput | null;
  /** Depois de enviado: o modelo congelado que o lead recebeu. */
  model: DiagnosisModel | null;
  /** O que falta para gerar o PDF / marcar como enviado. */
  issues: ValidationIssue[];
  /** Dono do diagnostico ou gestor (e a tela nao esta passiva). */
  canEdit: boolean;
  /** Outra janela conduz esta call: esta so le (nao salva nem mexe no rascunho). */
  passive: boolean;
  /** Enviado: so bolsa, resultado e notas internas mudam ate reabrir. */
  frozen: boolean;
  sync: SyncState;
  conflict: boolean;
  /** Erro que parou o autosave (sem permissao, regra do banco). */
  saveError: string | null;
  update: (fn: (ws: Workspace) => Workspace) => void;
  flush: () => Promise<boolean>;
  resolveConflict: (keep: 'mine' | 'theirs') => Promise<void>;
  markSent: () => Promise<MarkSentResult>;
  reopen: () => Promise<boolean>;
}

export interface DiagnosticWorkspaceOptions {
  /**
   * true: outra janela conduz a call (trava do cockpit negada) e esta so le.
   * null: a trava ainda esta sendo decidida (espera antes de ler o rascunho local).
   */
  passive?: boolean | null;
}
