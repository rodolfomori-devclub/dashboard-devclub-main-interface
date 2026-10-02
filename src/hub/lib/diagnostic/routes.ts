/** Rotas da secao Apoio Vendas e do Diagnostico de Carreira com IA. */
export const SALES_SUPPORT_PATH = '/apoio-vendas';
export const DIAGNOSTIC_PATH = '/apoio-vendas/diagnostico';

export const diagnosticPaths = {
  root: DIAGNOSTIC_PATH,
  sessions: `${DIAGNOSTIC_PATH}/sessoes`,
  settings: `${DIAGNOSTIC_PATH}/configuracoes`,
  prep: (sessionId: string) => `${DIAGNOSTIC_PATH}/sessoes/${sessionId}/preparo`,
  cockpit: (sessionId: string) => `${DIAGNOSTIC_PATH}/sessoes/${sessionId}/cockpit`,
  send: (sessionId: string) => `${DIAGNOSTIC_PATH}/sessoes/${sessionId}/envio`,
  /** Tela do lead: pagina separada (sessao.html), sem o app do Hub. */
  leadWindow: (sessionId: string) => `/sessao.html?id=${encodeURIComponent(sessionId)}`,
};
