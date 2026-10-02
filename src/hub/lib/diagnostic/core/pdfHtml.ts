/**
 * HTML do PDF do diagnostico (port do render() de 03_referencia_gerador.html).
 * A mesma funcao alimenta a previa, a impressao do navegador e o Chromium do
 * servidor. Toda regra ja vem resolvida no DiagnosisModel: aqui so formatacao.
 */
import type { DiagnosisModel, Level, PillarResult } from './types.ts';
import { escapeHtml } from './html.ts';
import { PDF_CSS } from './pdfCss.ts';
import { mindMapSvg } from './mindMap.ts';

export interface PdfDocumentOptions {
  /** Regras @font-face (ver fontFaceCss em pdfCss.ts). */
  fontFaceCss: string;
}

const BRAND_LINE = 'Diagnóstico de Carreira com IA';

const LEVEL_CLASS: Record<Level, string> = {
  trava: 'l-low',
  em_construcao: 'l-mid',
  ponto_forte: 'l-high',
};

const PROGRAM_LEAD = 'Pós-graduação em IA aplicada a negócios do Rodolfo Mori, embaixador da OpenAI no Brasil: ';
const PROGRAM_TAIL =
  'extensão pela Arizona State University e mais de 30 certificações internacionais. Sem precisar programar, 6 a 10 horas por semana, com aulas gravadas.';

const KIT_TIPS = [
  'Comece pelo prompt que conversa com o seu compromisso.',
  'Anote quanto tempo a tarefa levava antes e quanto levou com IA. Esse número é o seu primeiro case.',
  'Não cole dados sensíveis de clientes ou da empresa sem conferir a política interna. Confira os números antes de usar.',
];

// ---------------------------------------------------------------------------
// Formatacao
// ---------------------------------------------------------------------------

/** Texto aparado; null/undefined (snapshot antigo) vira ''. */
const txt = (v: unknown): string => (v == null ? '' : String(v).trim());

/** Siglas (IA, TI, RH) ficam em maiusculas quando a frase vai para o meio do texto. */
function isAcronym(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, '');
  return letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

function lowerInline(s: string): string {
  return s
    .split(' ')
    .map((w) => (isAcronym(w) ? w : w.toLocaleLowerCase('pt-BR')))
    .join(' ');
}

/** Tira aspas que o consultor tenha digitado: o PDF ja poe as suas. */
const unquote = (s: string): string => s.replace(/^["“”]+|["“”]+$/g, '').trim();

const promptCount = (count: number): string => (count === 1 ? '1 prompt' : `${count} prompts`);

const sec = (eyebrowHtml: string, innerHtml: string): string =>
  `<div class="sec"><span class="eyebrow">${eyebrowHtml}</span>${innerHtml}</div>`;

const mini = (m: DiagnosisModel, page: number, pages: number): string =>
  `<div class="mini"><span>${BRAND_LINE} · ${escapeHtml(m.displayName)}</span><span>${page} de ${pages}</span></div>`;

const disclaimer = (m: DiagnosisModel): string =>
  txt(m.disclaimer) ? `<p class="disc">${escapeHtml(txt(m.disclaimer))}</p>` : '';

// ---------------------------------------------------------------------------
// Pagina 1: ponto de partida, Indice, mapa e travas
// ---------------------------------------------------------------------------

function headerLine(m: DiagnosisModel): string {
  const time = txt(m.timeInRole);
  return [txt(m.jobTitle), time ? `${time} no cargo` : '', txt(m.area), txt(m.dateBR), `consultor: ${txt(m.consultantName)}`]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
}

function quotesSection(m: DiagnosisModel): string {
  const quotes = (m.pdfQuotes ?? []).map((q) => unquote(txt(q))).filter(Boolean);
  if (!quotes.length) return '';
  return sec('Seu ponto de partida', quotes.map((q) => `<p class="quote">"${escapeHtml(q)}"</p>`).join(''));
}

function barRow(r: PillarResult): string {
  const score = typeof r.score === 'number' ? r.score : null;
  const width = score === null ? 0 : Math.min(5, Math.max(0, score)) * 20;
  const level = r.level ? ` ${LEVEL_CLASS[r.level]}` : '';
  return (
    `<div class="brow"><span>${escapeHtml(r.pillar.nome)}</span>` +
    `<div class="track"><div class="fill${level}" style="width:${width}%"></div></div>` +
    `<span class="n">${score === null ? '—' : score}/5</span></div>`
  );
}

function indexSection(m: DiagnosisModel): string {
  const ready = m.complete && typeof m.total === 'number';
  const parts = ['de 25'];
  if (!ready) {
    parts.push('a avaliar');
  } else {
    if (m.strongest) parts.push(`ponto forte: ${lowerInline(m.strongest.nome)}`);
    if (m.weakest) parts.push(`o que mais pesa hoje: ${lowerInline(m.weakest.nome)}`);
  }
  const idx = `<div class="idx"><b>${ready ? m.total : '—'}</b><span class="muted">${parts.map(escapeHtml).join(' · ')}</span></div>`;
  const bars = `<div class="bars">${(m.pillars ?? []).map(barRow).join('')}</div>`;
  return sec('Seu Índice de Carreira com IA', idx + bars);
}

function rootCauseSection(m: DiagnosisModel): string {
  const cause = txt(m.rootCause);
  const blockers = m.blockers ?? [];
  if (!cause && !blockers.length) return '';
  const list = blockers.length
    ? `<ul class="cl">${blockers.map((p) => `<li><b>${escapeHtml(p.nome)}:</b> ${escapeHtml(p.texto_trava)}</li>`).join('')}</ul>`
    : '';
  return sec('O que está te travando', (cause ? `<p>${escapeHtml(cause)}</p>` : '') + list);
}

function page1(m: DiagnosisModel): string {
  const header =
    `<div class="hd"><span class="eyebrow">${BRAND_LINE} · Time Rodolfo Mori</span>` +
    `<h2>${escapeHtml(m.displayName)}</h2><p>${headerLine(m)}</p></div>`;
  const body = [
    quotesSection(m),
    indexSection(m),
    sec('Seu mapa', `<div class="mapwrap">${mindMapSvg(m)}</div>`),
    rootCauseSection(m),
  ].filter(Boolean);
  return `<section class="sheet">${header}\n<div class="bd">\n${body.join('\n')}\n</div></section>`;
}

// ---------------------------------------------------------------------------
// Pagina 2: plano, compromisso, material, leituras, caminho e proximo passo
// ---------------------------------------------------------------------------

function planSection(m: DiagnosisModel): string {
  const plan = m.plan ?? [];
  if (!plan.length) {
    return sec('Seu plano de 90 dias', '<p class="muted">O plano aparece aqui quando as 5 notas forem dadas.</p>');
  }
  const items = plan.map((p) => `<li><span>${escapeHtml(p.movimento_90_dias)}</span></li>`).join('');
  // Quem esta cursando nao pode entrar na pos (regra 10): igual a tela, sem cita-la.
  const own = m.eligible ? 'Esse plano é seu e funciona com ou sem a pós.' : 'Esse plano é seu.';
  return sec('Seu plano de 90 dias', `<ol class="mv">${items}</ol><p class="muted note">${own}</p>`);
}

function commitmentSection(m: DiagnosisModel): string {
  const text = txt(m.commitmentText);
  if (!text) return '';
  const due = txt(m.commitmentDueBR) || '[data]';
  return sec(
    'Seu compromisso',
    `<div class="pact"><b>${escapeHtml(text)}</b><span class="muted">Até ${escapeHtml(due)}. ` +
      `${escapeHtml(txt(m.consultantName))} vai falar com você nesse dia para saber como foi.</span></div>`,
  );
}

function materialSection(m: DiagnosisModel): string {
  const mat = m.material;
  const lesson = txt(mat?.lessonTitle);
  if (mat?.type === 'aula') {
    const url = txt(mat.lessonUrl);
    return sec(
      'Seu material de presente',
      `<p><b>Aula: ${escapeHtml(lesson || 'IA aplicada à sua área')}</b></p>` +
        (url ? `<p class="muted link">${escapeHtml(url)}</p>` : ''),
    );
  }
  if (mat?.type !== 'kit') return '';
  const area = txt(mat.areaLabel);
  const forArea = txt(mat.areaPhrase) || (area ? lowerInline(area) : 'a sua área');
  const soon = lesson ? ` A aula completa, <i>${escapeHtml(lesson)}</i>, chega em breve.` : '';
  return sec(
    'Seu material de presente',
    `<p><b>Kit de ${promptCount(mat.kit?.length ?? 0)} para ${escapeHtml(forArea)}</b>, na página 3. ` +
      `Para testar no seu trabalho ainda esta semana.${soon}</p>`,
  );
}

function readLaterSection(m: DiagnosisModel): string {
  const reads = (m.readLater ?? []).filter((r) => txt(r.titulo) || txt(r.url));
  if (!reads.length) return '';
  const items = reads
    .map((r) => {
      const url = txt(r.url);
      return `<li>${escapeHtml(txt(r.titulo))}${url ? `<br><span class="muted url">${escapeHtml(url)}</span>` : ''}</li>`;
    })
    .join('');
  return sec('Para ler depois', `<ul class="cl reads">${items}</ul>`);
}

/** O caminho de 12 meses e a pos so aparecem para quem pode entrar (regra 10). */
function pathSection(m: DiagnosisModel): string {
  if (!m.eligible) return '';
  const goal = txt(m.goal);
  const title = goal
    ? `Se quiser ir além: 12 meses até "${escapeHtml(lowerInline(goal))}"`
    : 'Se quiser ir além: 12 meses';
  const steps = (m.path ?? [])
    .map(
      (t) =>
        `<div><span class="eyebrow">${escapeHtml(t.periodo)}</span><b>${escapeHtml(t.titulo)}</b>` +
        `<span class="muted">${escapeHtml(t.descricao)}</span></div>`,
    )
    .join('');
  const credential = txt(m.credential);
  const program = PROGRAM_LEAD + (credential ? `${escapeHtml(credential)}, ` : '') + PROGRAM_TAIL;
  return sec(title, (steps ? `<div class="tri">${steps}</div>` : '') + `<p class="note">${program}</p>`);
}

function nextStepSection(m: DiagnosisModel): string {
  // Regra 10 tambem para fotos antigas do modelo: cursando nunca recebe condicao de bolsa.
  const condition = m.eligible ? txt(m.conditionLine).replace(/\.+$/, '') : '';
  const whatsapp = txt(m.consultantWhatsapp);
  const text =
    (condition ? `${condition}. ` : '') +
    `Falamos no dia ${txt(m.commitmentDueBR) || 'combinado'}. ` +
    `Qualquer dúvida antes disso, fale com ${txt(m.consultantName)}${whatsapp ? ` no WhatsApp ${whatsapp}` : ''}.`;
  return sec('Próximo passo', `<p>${escapeHtml(text)}</p>`);
}

function page2(m: DiagnosisModel, pages: number): string {
  const body = [
    planSection(m),
    commitmentSection(m),
    materialSection(m),
    readLaterSection(m),
    pathSection(m),
    nextStepSection(m),
    disclaimer(m),
  ].filter(Boolean);
  return `<section class="sheet">${mini(m, 2, pages)}\n<div class="bd">\n${body.join('\n')}\n</div></section>`;
}

// ---------------------------------------------------------------------------
// Pagina 3 (so com kit): os prompts da area
// ---------------------------------------------------------------------------

function page3(m: DiagnosisModel, pages: number): string {
  const area = txt(m.material?.areaLabel);
  const kit = m.material?.kit ?? [];
  const intro =
    `<div class="sec"><span class="eyebrow">Seu kit de prompts${area ? ` · ${escapeHtml(area)}` : ''}</span>` +
    `<h3>${promptCount(kit.length)} para testar esta semana</h3>` +
    '<p class="muted">Copie, troque o que está entre colchetes pelos seus dados e cole no ChatGPT, Gemini, Copilot ou Claude.</p></div>';
  const prompts = kit.map(
    (k, i) => `<div class="prompt"><b>${i + 1}. ${escapeHtml(k.titulo)}</b><span>${escapeHtml(k.prompt)}</span></div>`,
  );
  const tips = sec('Como tirar o máximo', `<ul class="cl">${KIT_TIPS.map((t) => `<li>${t}</li>`).join('')}</ul>`);
  const body = [intro, ...prompts, tips, disclaimer(m)].filter(Boolean);
  return `<section class="sheet">${mini(m, 3, pages)}\n<div class="bd">\n${body.join('\n')}\n</div></section>`;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** As folhas A4 (2, ou 3 quando o material e o kit de prompts). */
export function renderPdfBody(model: DiagnosisModel): string {
  const withKit = model.material?.type === 'kit';
  const pages = withKit ? 3 : 2;
  const sheets = [page1(model), page2(model, pages)];
  if (withKit) sheets.push(page3(model, pages));
  return sheets.join('\n');
}

/** Documento completo, sem scripts. So carrega as fontes passadas em `opts`. */
export function renderPdfDocument(model: DiagnosisModel, opts: PdfDocumentOptions): string {
  const fonts = String(opts?.fontFaceCss ?? '').replace(/<\/style/gi, '<\\/style');
  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(pdfTitle(model))}</title>`,
    `<style>\n${fonts}\n${PDF_CSS}</style>`,
    '</head>',
    '<body>',
    renderPdfBody(model),
    '</body>',
    '</html>',
  ].join('\n');
}

/** Titulo do documento (o Chrome sugere o nome do arquivo a partir dele). */
export function pdfTitle(model: DiagnosisModel): string {
  return `Diagnostico de Carreira com IA - ${txt(model.displayName)}`;
}

const FILE_NAME_UNSAFE = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);

/** `Diagnostico de Carreira com IA - <Nome>.pdf`, sem caracteres proibidos em nome de arquivo. */
export function pdfFileName(model: DiagnosisModel): string {
  const safe = Array.from(pdfTitle(model), (ch) => (ch.charCodeAt(0) < 32 || FILE_NAME_UNSAFE.has(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return `${safe}.pdf`;
}
