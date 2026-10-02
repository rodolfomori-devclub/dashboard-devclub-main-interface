/**
 * PDF do diagnostico no navegador: o mesmo HTML do servidor, com as fontes
 * servidas pelo proprio Hub (public/fonts/diagnostic). Usado pela previa e pela
 * impressao de reserva (quando o PDF do servidor nao esta disponivel).
 */
import type { DiagnosisModel, FontUrls } from '@diag/types.ts';
import { fontFaceCss } from '@diag/pdfCss.ts';
import { pdfTitle, renderPdfDocument } from '@diag/pdfHtml.ts';

const FONT_DIR = '/fonts/diagnostic/';

const FONT_FILES: FontUrls = {
  bricolage: 'bricolage-grotesque-opsz.woff2',
  plexSans400: 'ibm-plex-sans-400.woff2',
  plexSans400Italic: 'ibm-plex-sans-400-italic.woff2',
  plexSans500: 'ibm-plex-sans-500.woff2',
  plexSans600: 'ibm-plex-sans-600.woff2',
  plexMono400: 'ibm-plex-mono-400.woff2',
  plexMono500: 'ibm-plex-mono-500.woff2',
  plexMono600: 'ibm-plex-mono-600.woff2',
};

/** Tempo maximo esperando as fontes antes de imprimir mesmo assim. */
const FONT_WAIT_MS = 6000;

/**
 * URLs absolutas: a janela de impressao nasce em about:blank, entao um caminho
 * relativo nao serviria.
 */
export function browserFontUrls(origin: string = window.location.origin): FontUrls {
  const base = `${origin.replace(/\/+$/, '')}${FONT_DIR}`;
  const urls = {} as FontUrls;
  for (const key of Object.keys(FONT_FILES) as (keyof FontUrls)[]) {
    urls[key] = base + FONT_FILES[key];
  }
  return urls;
}

/** Documento completo do PDF com as fontes deste Hub. */
export function browserPdfDocument(model: DiagnosisModel): string {
  return renderPdfDocument(model, { fontFaceCss: fontFaceCss(browserFontUrls()) });
}

/** Carrega todas as fontes declaradas (ready sozinho resolve antes de a fonte ser pedida). */
function waitForFonts(doc: Document): Promise<void> {
  const fonts = doc.fonts;
  if (!fonts) return Promise.resolve();
  const loads: Promise<unknown>[] = [];
  fonts.forEach((font) => {
    loads.push(font.load().catch(() => undefined));
  });
  const loaded = Promise.all(loads)
    .then(() => fonts.ready)
    .then(() => undefined);
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, FONT_WAIT_MS));
  return Promise.race([loaded, timeout]);
}

/**
 * Abre o PDF numa janela nova e chama a impressao ("Salvar como PDF").
 * Precisa ser chamada direto do clique. Devolve false se o navegador bloqueou
 * a janela.
 */
export function openPrintWindow(model: DiagnosisModel): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  try {
    const doc = win.document;
    doc.open();
    doc.write(browserPdfDocument(model));
    doc.close();
    // O Chrome sugere o nome do arquivo a partir do titulo.
    doc.title = pdfTitle(model);
  } catch {
    win.close();
    return false;
  }

  let printed = false;
  const print = () => {
    if (printed || win.closed) return;
    printed = true;
    win.focus();
    win.print();
  };
  void waitForFonts(win.document).then(() => {
    if (win.closed) return;
    // Um quadro desenhado com as fontes antes de imprimir.
    win.requestAnimationFrame(() => win.requestAnimationFrame(print));
    // Janela em segundo plano pode nao desenhar quadros.
    window.setTimeout(print, 600);
  });
  return true;
}
