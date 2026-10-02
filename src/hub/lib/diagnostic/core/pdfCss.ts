/**
 * CSS do PDF do diagnostico (papel claro, tinta escura, ocre), portado de
 * 03_referencia_gerador.html. O mesmo CSS serve a previa, a impressao do
 * navegador e o Chromium do servidor.
 *
 * Os espacamentos sao os da impressao em todos os meios: na tela a folha tem
 * 210 mm com margem interna de 10 mm, entao o texto quebra igual ao papel e a
 * previa consegue medir se cada folha cabe no A4.
 */
import type { FontUrls } from './types.ts';

/** Largura de uma folha A4 na tela (210 mm a 96 dpi). */
export const PDF_SHEET_WIDTH_PX = (210 * 96) / 25.4;

/** Altura util de uma folha A4 com margem de 10 mm (297 - 20 mm a 96 dpi). */
export const PDF_PRINTABLE_HEIGHT_PX = (277 * 96) / 25.4;

/** Respiro lateral do body na tela, de cada lado da folha. */
export const PDF_SCREEN_GUTTER_PX = 16;

export const PDF_CSS = `
:root{
  --p-bg:#FFFFFF;--p-ink:#131B26;--p-ink-2:#4A5666;--p-line:#D5DCE4;--p-soft:#EEF1F4;
  --p-acc:#8A5A0B;--p-acc-soft:#F6EAD2;--p-red:#B3261E;--p-amber:#B7791F;--p-green:#2F6B3A;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  --sans:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
  --display:'Bricolage Grotesque','IBM Plex Sans',system-ui,sans-serif;
  color-scheme:light;
}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:#FFFFFF;color:var(--p-ink);font:13px/1.5 var(--sans)}
h1,h2,h3,h4{font-family:var(--display);line-height:1.15;margin:0;text-wrap:balance}
p{margin:0}
.eyebrow{font:500 .7rem/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--p-ink-2)}
.muted{color:var(--p-ink-2)}

.sheet{background:var(--p-bg);color:var(--p-ink);font-size:13px;line-height:1.5;overflow-wrap:anywhere}
.sheet .hd{background:var(--p-ink);color:#FFFFFF;padding:20px 34px 18px;display:grid;gap:6px}
.sheet .hd .eyebrow{color:#C9D1DB}
.sheet .hd h2{font-size:26px;color:#FFFFFF}
.sheet .hd p{color:#DDE3EA;font-size:12.5px}
.sheet .bd{padding:18px 34px 20px;display:grid;gap:14px}
.sheet .mini{padding:14px 34px;border-bottom:1px solid var(--p-line);display:flex;justify-content:space-between;gap:10px;font:500 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--p-ink-2)}
.sheet .mini span:last-child{flex-shrink:0;white-space:nowrap}
.sheet h3{font-size:20px}
.sec{display:grid;gap:8px;break-inside:avoid}
.sec > .eyebrow{color:var(--p-acc)}
.quote{font-style:italic;border-left:2px solid var(--p-line);padding-left:12px;color:var(--p-ink-2)}
.idx{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.idx b{font:700 38px var(--display)}
.bars{display:grid;gap:8px}
.brow{display:grid;grid-template-columns:190px 1fr 34px;gap:10px;align-items:center}
.track{height:9px;background:var(--p-soft);border-radius:99px;overflow:hidden}
.fill{height:100%;border-radius:99px}
.l-low{background:var(--p-red)}
.l-mid{background:var(--p-amber)}
.l-high{background:var(--p-green)}
.brow .n{font:600 12px var(--mono);text-align:right}
.mapwrap{width:100%;max-width:560px;margin:0 auto}
.mapwrap svg{display:block;width:100%;height:auto}
.mv{display:grid;gap:8px;margin:0;padding:0;counter-reset:m}
.mv li{list-style:none;display:grid;grid-template-columns:28px 1fr;gap:8px;counter-increment:m}
.mv li::before{content:counter(m);font:700 13px var(--display);background:var(--p-acc-soft);color:var(--p-acc);border-radius:50%;width:24px;height:24px;display:grid;place-items:center}
.note{font-size:12px}
.pact{border:1.5px dashed var(--p-acc);border-radius:10px;padding:12px 14px;display:grid;gap:4px}
.pact b{font-family:var(--display);font-size:15px}
.link{word-break:break-all}
.tri{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.tri div{border:1px solid var(--p-line);border-radius:8px;padding:9px 10px;display:grid;gap:3px;font-size:11.5px;align-content:start}
.tri b{font-family:var(--display);font-size:13px}
.tri .eyebrow{color:var(--p-ink-2)}
ul.cl{margin:0;padding-left:1.1em;display:grid;gap:4px}
.reads li{word-break:break-word}
.reads .url{font-size:11px}
.prompt{background:var(--p-soft);border-radius:8px;padding:12px 14px;display:grid;gap:4px;break-inside:avoid}
.prompt b{font-family:var(--display);font-size:13.5px}
.prompt span{font:400 12px/1.55 var(--mono);color:var(--p-ink)}
.disc{font-size:10.5px;color:var(--p-ink-2);border-top:1px solid var(--p-line);padding-top:10px}

@media screen{
  html,body{background:#E9EDF1}
  body{padding:24px ${PDF_SCREEN_GUTTER_PX}px}
  .sheet{width:210mm;min-height:297mm;margin:0 auto 24px;padding:10mm;box-shadow:0 1px 2px rgba(19,27,38,.10),0 8px 24px rgba(19,27,38,.08)}
  .sheet:last-child{margin-bottom:0}
}

@media print{
  @page{size:A4;margin:10mm}
  html,body{background:#FFFFFF}
  .sheet{break-after:page}
  .sheet:last-child{break-after:auto}
}
`;

/** url('...') seguro dentro de um <style> (aspas, barras e "<" escapados). */
function cssUrl(url: string): string {
  const safe = String(url ?? '')
    .replace(/[\\'"]/g, '\\$&')
    .replace(/[\n\r\f]/g, '')
    .replace(/</g, '\\3c ')
    .replace(/>/g, '\\3e ');
  return `url('${safe}')`;
}

function face(family: string, url: string, weight: string, style: 'normal' | 'italic' = 'normal'): string {
  return `@font-face{font-family:'${family}';src:${cssUrl(url)} format('woff2');font-weight:${weight};font-style:${style};font-display:block}`;
}

/**
 * Regras @font-face das fontes do PDF. `font-display:block` faz a impressao
 * esperar a fonte em vez de sair com a fonte do sistema.
 */
export function fontFaceCss(urls: FontUrls): string {
  return [
    // Fonte variavel (opsz 12-96, wght 200-800): um arquivo cobre todos os pesos.
    face('Bricolage Grotesque', urls.bricolage, '200 800'),
    face('IBM Plex Sans', urls.plexSans400, '400'),
    face('IBM Plex Sans', urls.plexSans400Italic, '400', 'italic'),
    face('IBM Plex Sans', urls.plexSans500, '500'),
    face('IBM Plex Sans', urls.plexSans600, '600'),
    face('IBM Plex Mono', urls.plexMono400, '400'),
    face('IBM Plex Mono', urls.plexMono500, '500'),
    face('IBM Plex Mono', urls.plexMono600, '600'),
  ].join('\n');
}
