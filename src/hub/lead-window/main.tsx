/**
 * Entrada de sessao.html: a tela do lead. Pagina separada do Hub, sem login,
 * sem banco, sem toasts e sem o tema escuro (nao importa src/index.css).
 */
import { createRoot } from 'react-dom/client';
import { LeadWindowApp } from './LeadWindowApp';

const root = document.getElementById('root');
if (root) createRoot(root).render(<LeadWindowApp />);
