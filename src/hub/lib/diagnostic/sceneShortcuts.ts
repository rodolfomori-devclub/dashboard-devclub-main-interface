/**
 * Atalhos do controle de cenas no cockpit (janela inteira enquanto montado):
 * Alt+L proximo passo, Alt+K passo anterior, Alt+. proxima cena pronta,
 * Alt+, cena anterior pronta, Alt+B pausar. Valem pela posicao da tecla
 * (e.code): o mesmo em ABNT2, US e no Mac, onde Option muda o caractere.
 * Nenhum Alt dispara com a tecla segurada nem com o foco num campo de texto
 * (no Mac, Option digita aspas e outros sinais).
 *
 * Espaco e seta para a direita revelam o proximo passo, menos digitando ou num
 * controle que usa a tecla. Num botao do proprio controle de cenas (raiz com
 * data-scene-control), o Espaco tambem revela: o clique deixa o foco no botao,
 * e quem chama faz preventDefault para o botao nao disparar de novo.
 */
export type SceneShortcut = 'next' | 'prev' | 'nextScene' | 'prevScene' | 'curtain';

export interface KeyLike {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  target: EventTarget | null;
}

/** Atributo da raiz do controle de cenas. */
export const SCENE_CONTROL_ATTR = 'data-scene-control';

const ALT_KEYS = new Map<string, SceneShortcut>([
  ['KeyL', 'next'],
  ['KeyK', 'prev'],
  ['Period', 'nextScene'],
  ['Comma', 'prevScene'],
  ['KeyB', 'curtain'],
]);

const TEXT_ENTRY = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const NOT_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'range', 'color', 'file']);
// Alvos em que Espaco ou setas ja fazem outra coisa.
const USES_KEYS =
  `${TEXT_ENTRY}, [role="textbox"], [role="combobox"], [role="spinbutton"], [role="slider"], [role="listbox"], ` +
  '[role="option"], [role="radio"], [role="tab"], [role="menu"], [role="menuitem"], [role="grid"]';
const SPACE_ACTIVATES = 'button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="link"]';
const PANEL_BUTTON = `[${SCENE_CONTROL_ATTR}] button, [${SCENE_CONTROL_ATTR}] [role="button"]`;

function closest(target: EventTarget | null, selector: string): Element | null {
  if (!target || typeof (target as Element).closest !== 'function') return null;
  return (target as Element).closest(selector);
}

const isEditable = (target: EventTarget | null) => !!target && (target as HTMLElement).isContentEditable === true;

/** Foco num campo de digitacao: input de texto, textarea, select ou area editavel. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (isEditable(target)) return true;
  const field = closest(target, TEXT_ENTRY);
  if (!field) return false;
  return field.tagName !== 'INPUT' || !NOT_TEXT_INPUTS.has((field as HTMLInputElement).type);
}

export function shortcutFor(e: KeyLike): SceneShortcut | null {
  if (e.repeat) return null;
  if (e.altKey) {
    // AltGr chega como Ctrl+Alt; Alt+Shift troca o idioma do teclado no Windows.
    if (e.ctrlKey || e.metaKey || e.shiftKey || isTypingTarget(e.target)) return null;
    return ALT_KEYS.get(e.code) ?? null;
  }
  if (e.ctrlKey || e.metaKey || e.shiftKey) return null;
  const space = e.key === ' ' || e.code === 'Space';
  if (!space && e.key !== 'ArrowRight') return null;
  if (isEditable(e.target) || closest(e.target, USES_KEYS)) return null;
  if (space && closest(e.target, SPACE_ACTIVATES) && !closest(e.target, PANEL_BUTTON)) return null;
  return 'next';
}
