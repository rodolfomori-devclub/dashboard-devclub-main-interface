import type { ReactNode } from 'react';
import './theme.css';

/** Raiz das telas do Apoio Vendas: cores de alerta e sucesso nos temas do Dashboard. */
export function DiagnosticScope({ children }: { children: ReactNode }) {
  return <div className="diagnostic-scope contents">{children}</div>;
}
