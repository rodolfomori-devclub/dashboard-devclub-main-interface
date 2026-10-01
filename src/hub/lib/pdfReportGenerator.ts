import { jsPDF } from 'jspdf';

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface PdfState {
  doc: jsPDF;
  y: number;
  page: number;
  monthLabel: string;
}

function addHeader(state: PdfState) {
  const { doc, monthLabel } = state;
  doc.setFillColor(20, 31, 32);
  doc.rect(0, 0, PAGE_WIDTH, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO DE RESULTADOS COMERCIAIS', MARGIN, 9);
  doc.setFont('helvetica', 'normal');
  doc.text(monthLabel, PAGE_WIDTH - MARGIN, 9, { align: 'right' });
  // Fio de marca DevClub (#39d353) — acento fino, nunca superficie
  doc.setDrawColor(57, 211, 83);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 16, PAGE_WIDTH - MARGIN, 16);
}

function addFooter(state: PdfState) {
  const { doc, page } = state;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('DevClub · Sistema de Gestão Comercial', MARGIN, PAGE_HEIGHT - 7);
  doc.text(`Página ${page}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: 'right' });
}

function ensureSpace(state: PdfState, needed: number) {
  if (state.y + needed > PAGE_HEIGHT - 18) {
    addFooter(state);
    state.doc.addPage();
    state.page++;
    addHeader(state);
    state.y = 22;
  }
}

function sectionTitle(state: PdfState, title: string) {
  ensureSpace(state, 14);
  state.y += 4;
  const { doc } = state;
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(MARGIN, state.y - 4, CONTENT_WIDTH, 9, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 31, 32);
  doc.text(title.toUpperCase(), MARGIN + 3, state.y + 2.5);
  state.y += 10;
}

function kpiRow(state: PdfState, items: { label: string; value: string }[]) {
  ensureSpace(state, 12);
  const { doc } = state;
  const colW = CONTENT_WIDTH / items.length;
  items.forEach((item, i) => {
    const x = MARGIN + i * colW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(item.label, x + 2, state.y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 31, 32);
    doc.text(item.value, x + 2, state.y + 5);
  });
  state.y += 10;
}

function drawTable(
  state: PdfState,
  headers: string[],
  rows: string[][],
  colWidths?: number[],
) {
  const { doc } = state;
  const cols = headers.length;
  const widths = colWidths || headers.map(() => CONTENT_WIDTH / cols);
  const rowH = 6;

  ensureSpace(state, rowH * 2 + 2);

  // Header
  doc.setFillColor(243, 244, 246);
  doc.rect(MARGIN, state.y - 3.5, CONTENT_WIDTH, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  let xPos = MARGIN;
  headers.forEach((h, i) => {
    const align = i === 0 ? 'left' : 'right';
    const textX = i === 0 ? xPos + 2 : xPos + widths[i] - 2;
    doc.text(h, textX, state.y, { align });
    xPos += widths[i];
  });
  state.y += rowH;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  rows.forEach((row) => {
    ensureSpace(state, rowH + 1);
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, state.y - 3, PAGE_WIDTH - MARGIN, state.y - 3);

    xPos = MARGIN;
    doc.setTextColor(40, 40, 40);
    row.forEach((cell, i) => {
      const align = i === 0 ? 'left' : 'right';
      const textX = i === 0 ? xPos + 2 : xPos + widths[i] - 2;
      // Bold first column
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.text(cell, textX, state.y, { align });
      xPos += widths[i];
    });
    state.y += rowH;
  });
  state.y += 2;
}

function bulletList(state: PdfState, items: { label: string; detail: string }[]) {
  const { doc } = state;
  items.forEach((item) => {
    ensureSpace(state, 6);
    doc.setFillColor(20, 31, 32);
    doc.circle(MARGIN + 2, state.y - 1, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text(item.label, MARGIN + 5, state.y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(` — ${item.detail}`, MARGIN + 5 + doc.getTextWidth(item.label), state.y);
    state.y += 5;
  });
  state.y += 2;
}

export function generateResultsPdf(metrics: any, month: number, year: number, options: { includeFinancial?: boolean } = {}) {
  const includeFinancial = options.includeFinancial !== false;
  const doc = new jsPDF('p', 'mm', 'a4');
  const monthLabel = `${monthNames[month]} ${year}`;
  const state: PdfState = { doc, y: 22, page: 1, monthLabel };

  addHeader(state);

  // ── Cover title ──
  state.y = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(20, 31, 32);
  doc.text('Relatório de Resultados', PAGE_WIDTH / 2, state.y, { align: 'center' });
  state.y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(100, 100, 100);
  doc.text(monthLabel, PAGE_WIDTH / 2, state.y, { align: 'center' });
  state.y += 6;
  doc.setFontSize(9);
  doc.text('DevClub · Gestão Comercial', PAGE_WIDTH / 2, state.y, { align: 'center' });
  state.y += 14;

  // Regua de capa em verde de marca — acento fino sob o titulo
  doc.setDrawColor(57, 211, 83);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, state.y, PAGE_WIDTH - MARGIN, state.y);
  state.y += 8;

  // ── 1. Performance Geral ──
  sectionTitle(state, '1. Performance Geral');
  kpiRow(state, [
    { label: 'Meta Mensal', value: fmt(metrics.teamGoal) },
    { label: 'Receita Total', value: fmt(metrics.totalRevenue) },
    { label: 'Atingimento', value: fmtPct(metrics.achievement) },
    { label: 'Total Vendas', value: String(metrics.salesCount) },
  ]);

  if (metrics.revenueGrowth !== null) {
    kpiRow(state, [
      { label: 'Receita Mês Anterior', value: fmt(metrics.prevRevenue) },
      { label: 'Variação', value: `${metrics.revenueGrowth > 0 ? '+' : ''}${fmtPct(metrics.revenueGrowth)}` },
    ]);
  }

  // ── 2. Análise de Ritmo ──
  sectionTitle(state, '2. Análise de Ritmo (Pace)');
  kpiRow(state, [
    { label: 'Pace Esperado/dia', value: fmt(metrics.expectedDailyPace) },
    { label: 'Pace Real/dia', value: fmt(metrics.actualDailyPace) },
    { label: 'Dias Úteis', value: String(metrics.workingDays) },
  ]);

  const paceHeaders = ['Vendedor', 'Meta', 'Receita', 'Pace Esp.', 'Pace Real', 'Ating.'];
  const paceWidths = [35, 30, 30, 28, 28, 19];
  const paceRows = metrics.sellerPerformance.map((sp: any) => [
    sp.name, fmt(sp.goal), fmt(sp.revenue), fmt(sp.expectedPace), fmt(sp.actualPace), fmtPct(sp.achievementPct),
  ]);
  drawTable(state, paceHeaders, paceRows, paceWidths);

  // ── 2.5 Histórico de Vendas Diárias ──
  if (metrics.dailyHistory && metrics.dailyHistory.length > 0) {
    sectionTitle(state, '2.5. Histórico de Vendas Diárias');
    const sellersList = metrics.sellerPerformance;
    // Compact currency: shows "1,2k" / "12k" / "—"
    const fmtCompact = (v: number) => {
      if (!v) return '—';
      if (v >= 1000) {
        const k = v / 1000;
        return `${k.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
      }
      return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    };
    const firstName = (n: string) => (n || '').split(' ')[0];

    // Split sellers in chunks if too many for one A4 page width
    const MAX_SELLERS_PER_TABLE = 8;
    const chunks: any[][] = [];
    for (let i = 0; i < sellersList.length; i += MAX_SELLERS_PER_TABLE) {
      chunks.push(sellersList.slice(i, i + MAX_SELLERS_PER_TABLE));
    }

    chunks.forEach((chunk, chunkIdx) => {
      if (chunkIdx > 0) {
        ensureSpace(state, 10);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(`(continuação — vendedores ${chunkIdx * MAX_SELLERS_PER_TABLE + 1} em diante)`, MARGIN, state.y);
        state.y += 4;
      }

      const headers = ['Dia', ...chunk.map((sp: any) => firstName(sp.name)), 'Total'];
      const dayColW = 16;
      const totalColW = 22;
      const remaining = CONTENT_WIDTH - dayColW - totalColW;
      const sellerColW = chunk.length > 0 ? remaining / chunk.length : remaining;
      const widths = [dayColW, ...chunk.map(() => sellerColW), totalColW];

      const rows = metrics.dailyHistory.map((d: any) => {
        const dayLabel = `${String(d.day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`;
        const cells = chunk.map((sp: any) => fmtCompact(d.perSeller[sp.id] || 0));
        return [dayLabel, ...cells, fmtCompact(d.teamTotal)];
      });

      // Footer row: monthly totals per seller in chunk
      const totalRow = ['Total', ...chunk.map((sp: any) => fmtCompact(sp.revenue)), fmtCompact(metrics.totalRevenue)];
      rows.push(totalRow);

      drawTable(state, headers, rows, widths);
    });

    ensureSpace(state, 6);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    doc.text('Valores em formato compacto (k = mil). "—" indica dia sem vendas.', MARGIN, state.y);
    state.y += 5;
  }

  // ── 3. Vendas por Produto ──
  sectionTitle(state, '3. Vendas por Produto');
  bulletList(state, metrics.productBreakdown.map((p: any) => ({
    label: p.name,
    detail: `${p.count} vendas · ${fmt(p.revenue)} (${fmtPct(p.pct)})`,
  })));

  // ── 4. Mix de Produtos por Vendedor ──
  sectionTitle(state, '4. Mix de Produtos por Vendedor');
  metrics.sellerPerformance
    .filter((sp: any) => sp.revenue > 0)
    .forEach((sp: any) => {
      ensureSpace(state, 10 + sp.productMix.length * 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(20, 31, 32);
      doc.text(`${sp.name}  (Total: ${fmt(sp.revenue)} · ${sp.salesCount} vendas)`, MARGIN + 2, state.y);
      state.y += 5;
      bulletList(state, sp.productMix.map((pm: any) => ({
        label: pm.name,
        detail: `${fmt(pm.revenue)} (${fmtPct(pm.pct)})`,
      })));
    });

  // ── 5. Receita por Plataforma ──
  sectionTitle(state, '5. Receita por Plataforma');
  kpiRow(state, [
    { label: 'Receita Total', value: fmt(metrics.totalRevenue) },
    { label: 'Cash Collected', value: fmt(metrics.cashCollected) },
  ]);
  kpiRow(state, [
    { label: 'Hubla', value: fmt(metrics.hubla) },
    { label: 'TMB', value: fmt(metrics.tmb) },
    { label: 'Hubla + TMB', value: fmt(metrics.both) },
  ]);

  // ── 6. Análise por Origem ──
  sectionTitle(state, '6. Análise por Origem');
  bulletList(state, metrics.originBreakdown.map((o: any) => ({
    label: o.name,
    detail: `${o.count} vendas · ${fmt(o.revenue)}`,
  })));

  // ── 7. Performance de KPIs ──
  sectionTitle(state, '7. Performance de KPIs');
  kpiRow(state, [
    { label: 'Total Calls', value: String(metrics.totalCalls) },
    { label: 'Total Leads', value: String(metrics.totalLeads) },
    { label: 'Conversão', value: fmtPct(metrics.teamConversion) },
    { label: 'Ticket Médio', value: fmt(metrics.avgTicket) },
  ]);

  const kpiHeaders = ['Vendedor', 'Calls', 'Leads', 'Conversão', 'Vendas', 'Receita', 'Ticket'];
  const kpiWidths = [32, 18, 18, 22, 18, 30, 32];
  const kpiRows = metrics.sellerPerformance.map((sp: any) => [
    sp.name, String(sp.totalCalls), String(sp.totalLeads), fmtPct(sp.conversion),
    String(sp.salesCount), fmt(sp.revenue), fmt(sp.avgTicket),
  ]);
  drawTable(state, kpiHeaders, kpiRows, kpiWidths);

  // ── 8. Funil de Vendas ──
  sectionTitle(state, '8. Funil de Vendas');
  const leadsToCallsPct = metrics.totalLeads > 0 ? fmtPct((metrics.totalCalls / metrics.totalLeads) * 100) : '-';
  const callsToSalesPct = metrics.totalCalls > 0 ? fmtPct((metrics.salesCount / metrics.totalCalls) * 100) : '-';
  kpiRow(state, [
    { label: 'Leads', value: String(metrics.totalLeads) },
    { label: 'Leads → Calls', value: leadsToCallsPct },
    { label: 'Calls', value: String(metrics.totalCalls) },
    { label: 'Calls → Vendas', value: callsToSalesPct },
  ]);
  kpiRow(state, [
    { label: 'Vendas Fechadas', value: String(metrics.salesCount) },
    { label: 'Conversão Geral', value: fmtPct(metrics.teamConversion) },
  ]);

  // ── 9. Performance de Checklist ──
  sectionTitle(state, '9. Performance de Checklist');
  kpiRow(state, [
    { label: 'Taxa Média de Execução', value: fmtPct(metrics.checklistAvg) },
  ]);

  const checkHeaders = ['Vendedor', 'Taxa de Execução'];
  const checkWidths = [80, 90];
  const checkRows = metrics.sellerPerformance.map((sp: any) => [
    sp.name, fmtPct(sp.checklistRate),
  ]);
  drawTable(state, checkHeaders, checkRows, checkWidths);

  // ── 10. Destaques do Mês ──
  sectionTitle(state, '10. Destaques do Mês');
  const highlights: { label: string; detail: string }[] = [];
  if (metrics.topSeller) highlights.push({ label: '🏆 Top Vendedor', detail: `${metrics.topSeller.name} — ${fmt(metrics.topSeller.revenue)}` });
  if (metrics.bestConversion) highlights.push({ label: '🎯 Melhor Conversão', detail: `${metrics.bestConversion.name} — ${fmtPct(metrics.bestConversion.conversion)}` });
  if (metrics.mostConsistent) highlights.push({ label: '✅ Mais Consistente', detail: `${metrics.mostConsistent.name} — ${fmtPct(metrics.mostConsistent.checklistRate)}` });
  bulletList(state, highlights);

  // ── 11. Alertas & Insights ──
  if (metrics.insights && metrics.insights.length > 0) {
    sectionTitle(state, '11. Alertas & Insights');
    bulletList(state, metrics.insights.map((i: any) => ({
      label: i.type === 'warning' ? '⚠' : '✓',
      detail: i.message,
    })));
  }

  // ── 12. Métricas Avançadas ──
  sectionTitle(state, '12. Métricas Avançadas');
  kpiRow(state, [
    { label: 'Vendas/Dia', value: metrics.salesPerDay.toFixed(1) },
    { label: 'Melhor Dia', value: metrics.bestDay ? `${metrics.bestDay[0].split('-').reverse().join('/')} (${fmt(metrics.bestDay[1])})` : '-' },
    { label: 'Pior Dia', value: metrics.worstDay ? `${metrics.worstDay[0].split('-').reverse().join('/')} (${fmt(metrics.worstDay[1])})` : '-' },
  ]);

  // ── 13. Resumo Financeiro (apenas gestores/financeiro) ──
  if (includeFinancial) {
    sectionTitle(state, '13. Resumo Financeiro');
    kpiRow(state, [
      { label: 'Salários Fixos', value: fmt(metrics.totalFixed) },
      { label: 'Comissões', value: fmt(metrics.totalCommissions) },
      { label: 'Bônus', value: fmt(metrics.totalBonuses) },
    ]);
    kpiRow(state, [
      { label: 'Custo Comercial Total', value: fmt(metrics.totalCost) },
      { label: 'Custo sobre Receita', value: fmtPct(metrics.costPct) },
      { label: 'Margem de Contribuição', value: fmt(metrics.margin) },
    ]);
    kpiRow(state, [
      { label: 'ROI Comercial', value: fmtPct(metrics.roi) },
      { label: 'Cash Collected', value: `${fmt(metrics.cashCollected)} (${fmtPct(metrics.cashCollectedPct)})` },
      { label: 'Margem s/ Cash Collected', value: fmt(metrics.marginOnCash) },
    ]);
    kpiRow(state, [
      { label: 'ROI s/ Cash Collected', value: fmtPct(metrics.roiOnCash) },
    ]);

    // Seller financial table
    const finHeaders = ['Vendedor', 'Salário', 'Comissão', 'Bônus', 'Total'];
    const finWidths = [35, 35, 35, 30, 35];
    const finRows = metrics.sellerPerformance.map((sp: any) => [
      sp.name, fmt(sp.fixedSalary), fmt(sp.commission), fmt(sp.bonuses),
      fmt(sp.fixedSalary + sp.commission + sp.bonuses),
    ]);
    drawTable(state, finHeaders, finRows, finWidths);
  }

  // Add footer to last page
  addFooter(state);

  doc.save(`Relatorio_${monthNames[month]}_${year}.pdf`);
}
