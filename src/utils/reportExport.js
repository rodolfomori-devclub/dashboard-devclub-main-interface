import * as XLSX from 'xlsx'

// Shared by the financial screens and the agent. Callers supply the current
// filtered snapshot, before UI pagination; no data is fetched or recalculated.
export function buildReportWorkbook({ title, context = [], sheets }) {
  const workbook = XLSX.utils.book_new()
  const metadata = XLSX.utils.aoa_to_sheet([[title], ...context, ['Valores ausentes', 'Células vazias indicam valores não informados; zero indica um valor confirmado.']])
  metadata['!cols'] = [{ wch: 30 }, { wch: 100 }]
  XLSX.utils.book_append_sheet(workbook, metadata, 'Contexto')
  for (const { name, headers, rows } of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    sheet['!cols'] = headers.map(() => ({ wch: 28 }))
    sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) }
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  }
  workbook.Props = { Title: title, Author: 'DevClub' }
  return workbook
}

function sheetRows(sheet) {
  if (!sheet['!ref']) return []
  const range = XLSX.utils.decode_range(sheet['!ref'])
  return Array.from({ length: range.e.r + 1 }, (_, row) => Array.from({ length: range.e.c + 1 }, (_, col) => sheet[XLSX.utils.encode_cell({ r: row, c: col })]))
}

function csvCell(cell) {
  let value = cell?.v == null ? '' : XLSX.utils.format_cell(cell)
  if (cell?.t === 'n' && !XLSX.SSF.is_date(cell.z || 'General')) value = String(cell.v).replace('.', ',')
  if (cell?.t === 's') {
    const first = [...value].find(character => character.trim() && character.charCodeAt(0) >= 32)
    // Preserve phone numbers and IDs, and never interpret source text as a formula.
    if (['=', '+', '-', '@'].includes(first) || /^\d+$/.test(value)) value = `'${value}`
  }
  return `"${value.replaceAll('"', '""')}"`
}

export function buildWorkbookCsv(workbook) {
  const sections = workbook.SheetNames.map(name => [csvCell({ t: 's', v: name }), ...sheetRows(workbook.Sheets[name]).map(row => row.map(csvCell).join(';'))].join('\r\n'))
  return `\uFEFF${sections.join('\r\n\r\n')}\r\n`
}

const pdfCell = cell => cell?.v == null ? ''
  : cell.t === 'n' && cell.z?.includes('R$') ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cell.v)
    : XLSX.utils.format_cell(cell)
const pdfText = value => String(value).normalize('NFC').replace(/[−–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replaceAll('…', '...').replaceAll('\u202f', ' ')
const needsUnicode = text => [...text].some(character => character.codePointAt(0) > 255)

export async function buildWorkbookPdf(workbook, { title = workbook.Props?.Title || 'Relatório DevClub' } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setProperties({ title, author: 'DevClub' })
  const margin = 12, width = 273, bottom = 194, lineHeight = 4
  // The built-in PDF font covers Portuguese. For names outside that alphabet,
  // preserve the browser's glyphs (including emoji) as small high-resolution images.
  const pixelsPerMm = 4 * 72 / 25.4
  const canvasForText = () => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível renderizar os caracteres do relatório.')
    context.font = `${doc.getFont().fontStyle === 'bold' ? 'bold' : 'normal'} ${doc.getFontSize() * 4}px Arial, sans-serif`
    return { canvas, context }
  }
  const wrapText = (value, maxWidth) => {
    const text = pdfText(value)
    if (!needsUnicode(text)) return doc.splitTextToSize(text, maxWidth)
    const { context } = canvasForText()
    return text.split('\n').flatMap(paragraph => {
      const lines = []; let line = ''
      for (const character of paragraph) {
        if (line && context.measureText(line + character).width > maxWidth * pixelsPerMm) { lines.push(line); line = '' }
        line += character
      }
      return [...lines, line]
    })
  }
  const drawText = (value, x, baseline) => {
    const text = pdfText(value)
    if (!text) return
    if (!needsUnicode(text)) { doc.text(text, x, baseline); return }
    const { canvas, context } = canvasForText()
    const font = context.font
    canvas.width = Math.ceil(context.measureText(text).width) + 2
    canvas.height = doc.getFontSize() * 6
    context.font = font; context.fillStyle = '#1e293b'
    context.fillText(text, 0, doc.getFontSize() * 4)
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, baseline - doc.getFontSize() * 4 / pixelsPerMm, canvas.width / pixelsPerMm, canvas.height / pixelsPerMm)
  }
  let y = 26, section = ''
  const pageHeading = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 41, 59)
    drawText(wrapText(title, width)[0], margin, 12)
    doc.setFontSize(9); drawText(section, margin, 19)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    y = 26
  }
  const nextPage = () => { doc.addPage(); pageHeading() }
  const paragraph = text => {
    for (const line of wrapText(text, width)) {
      if (y + lineHeight > bottom) nextPage()
      drawText(line, margin, y); y += lineHeight
    }
    y += 2
  }
  for (const [sheetIndex, name] of workbook.SheetNames.entries()) {
    const sheet = workbook.Sheets[name]
    const rows = sheetRows(sheet).map(row => row.map(pdfCell))
    section = name
    if (sheetIndex) doc.addPage()
    pageHeading()
    if (!rows.length) { paragraph('Nenhum registro neste recorte.'); continue }
    // Context is narrative; the commercial workbook has a preamble before its table.
    const headerRow = sheet['!exportHeaderRow'] ?? (sheet['!autofilter'] ? XLSX.utils.decode_range(sheet['!autofilter'].ref).s.r : null)
    if (headerRow === null) { for (const row of rows) paragraph(row.filter(Boolean).join(' · ')); continue }
    for (const row of rows.slice(0, headerRow)) paragraph(row.filter(Boolean).join(' · '))
    if (rows.length <= headerRow + 1) { paragraph('Nenhum registro neste recorte.'); continue }
    const headers = rows[headerRow]
    // Wide worksheets are split into bands, with the identifying first column repeated.
    const bands = headers.length <= 6 ? [headers.map((_, index) => index)]
      : Array.from({ length: Math.ceil((headers.length - 1) / 5) }, (_, band) => [0, ...headers.slice(1 + band * 5, 6 + band * 5).map((_, index) => 1 + band * 5 + index)])
    for (const [bandIndex, columns] of bands.entries()) {
      if (bandIndex) {
        y += 8
        if (y + 30 > bottom) nextPage()
      }
      if (bands.length > 1) paragraph(`Grupo de colunas ${bandIndex + 1} de ${bands.length}`)
      const cellWidth = width / columns.length
      const draw = (lines, offset, length, header) => {
        const height = length * lineHeight + 4
        if (header) { doc.setFillColor(233, 238, 244); doc.rect(margin, y - 3, width, height, 'F') }
        doc.setFont('helvetica', header ? 'bold' : 'normal')
        columns.forEach((_, index) => lines[index].slice(offset, offset + length).forEach((line, lineIndex) => drawText(line, margin + index * cellWidth + 2, y + 1 + lineIndex * lineHeight)))
        y += height
        doc.setDrawColor(218, 224, 231); doc.line(margin, y - 3, margin + width, y - 3)
      }
      const wrap = row => columns.map(column => wrapText(row[column] || '', cellWidth - 4))
      const headerLines = wrap(headers)
      const headerHeight = Math.max(...headerLines.map(lines => lines.length))
      const drawHeader = () => draw(headerLines, 0, headerHeight, true)
      if (y + headerHeight * lineHeight + 12 > bottom) nextPage()
      drawHeader()
      for (const row of rows.slice(headerRow + 1)) {
        doc.setFont('helvetica', 'normal')
        const lines = wrap(row)
        const total = Math.max(1, ...lines.map(value => value.length))
        let offset = 0
        while (offset < total) {
          const capacity = Math.floor((bottom - y - 4) / lineHeight)
          if (capacity < 1) { nextPage(); drawHeader(); continue }
          const length = Math.min(capacity, total - offset)
          draw(lines, offset, length, false); offset += length
          if (offset < total) { nextPage(); drawHeader() }
        }
      }
    }
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
    doc.text(`DevClub · ${page} / ${doc.getNumberOfPages()}`, margin, 204)
  }
  return doc
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename
  document.body.appendChild(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
}

export async function exportWorkbook(workbook, format, { filename = 'relatorio', title } = {}) {
  if (!['csv', 'xlsx', 'pdf'].includes(format)) throw new Error('Formato de exportação inválido.')
  const name = `${filename}.${format}`
  if (format === 'xlsx') return XLSX.writeFile(workbook, name, { bookType: 'xlsx', compression: true })
  if (format === 'pdf') {
    const doc = await buildWorkbookPdf(workbook, { title })
    return downloadBlob(doc.output('blob'), name)
  }
  downloadBlob(new Blob([buildWorkbookCsv(workbook)], { type: 'text/csv;charset=utf-8;' }), name)
}

export async function exportReport(report, format) {
  return exportWorkbook(buildReportWorkbook(report), format, report)
}
