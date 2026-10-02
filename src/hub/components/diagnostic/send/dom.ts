export const COPY_FAILED = 'Não deu para copiar. Selecione o texto e copie com Ctrl+C.';

/** Copia texto. Sem a API do navegador (permissao, contexto inseguro), usa o caminho antigo. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // cai no execCommand abaixo
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Leva a tela ate o campo (links "ir para" da lista de pendencias). */
export function scrollToId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const field = el.querySelector<HTMLElement>(
    'input:not([disabled]), textarea:not([disabled]), button[role="radio"]:not([disabled]), button[role="combobox"]:not([disabled])',
  );
  field?.focus({ preventScroll: true });
}
