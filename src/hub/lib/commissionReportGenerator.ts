/**
 * Unified Commission Report generator.
 * Same data structure feeds the on-screen digital report AND the printable PDF (window.print).
 *
 * Cash Collected is the only commission base. Pending Future Value never generates commission.
 * Future TMB installments only generate commission once status='confirmed'.
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getCashCollected } from '@/lib/utils';
import type { SaleWithCommission } from '@/lib/commissionCalculator';

export interface CommissionReportInput {
  seller: { name: string; role?: string; team?: string };
  month: number; // 0-indexed
  year: number;
  seniorityLabel: string;
  modelLabel: string;
  sales: any[]; // raw sales with cash_collected/pending_future_value
  commissionRows: SaleWithCommission[]; // computed rows from calculateCommissions
  installments: any[]; // commission_installments rows for the month
  bonuses: any[];
  observations: any[]; // type extra|deduction
  fixedSalary: number;
  sellerNotes?: string;
  managerNotes?: string;
}

export interface CommissionReportSummary {
  totalSalesValue: number;
  totalCashCollected: number;
  totalPendingFuture: number;
  commissionBaseTotal: number;
  totalCommissions: number;
  totalConfirmedInstallmentCommission: number;
  totalPendingInstallmentCommission: number;
  totalBonuses: number;
  totalExtras: number;
  totalDeductions: number;
  fixedSalary: number;
  finalPayable: number;
}

export interface ValidationWarning {
  level: 'critical' | 'warning';
  message: string;
  saleId?: string;
}

function escapeHtml(s: string | number | null | undefined): string {
  const str = s == null ? '' : String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmt = (n: number) =>
  `R$ ${(isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export function computeReportSummary(input: CommissionReportInput): CommissionReportSummary {
  const totalSalesValue = input.sales.reduce(
    (s, x) => s + Number(x.total_sale_value || x.amount || 0),
    0,
  );
  const totalCashCollected = input.sales.reduce(
    (s, x) => s + getCashCollected(x),
    0,
  );
  const totalPendingFuture = input.sales.reduce(
    (s, x) =>
      s +
      Number(
        x.pending_future_value ??
          (Number(x.total_sale_value || 0) - Number(x.amount || 0) > 0
            ? Number(x.total_sale_value || 0) - Number(x.amount || 0)
            : 0) + Number(x.future_outstanding_value || 0),
      ),
    0,
  );
  const commissionBaseTotal = input.commissionRows.reduce(
    (s, r) => s + (r.installmentCommissionBase ?? r.amount),
    0,
  );
  const totalCommissions = input.commissionRows.reduce((s, r) => s + r.commissionValue, 0);
  const totalConfirmedInstallmentCommission = input.installments
    .filter((i) => i.status === 'confirmed')
    .reduce((s, i) => s + Number(i.commission_value || 0), 0);
  const totalPendingInstallmentCommission = input.installments
    .filter((i) => i.status === 'pending')
    .reduce((s, i) => s + Number(i.commission_value || 0), 0);
  const totalBonuses = input.bonuses.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalExtras = input.observations
    .filter((o) => o.type === 'extra')
    .reduce((s, o) => s + Number(o.amount || 0), 0);
  const totalDeductions = input.observations
    .filter((o) => o.type === 'deduction')
    .reduce((s, o) => s + Number(o.amount || 0), 0);

  const finalPayable =
    input.fixedSalary +
    totalCommissions +
    totalConfirmedInstallmentCommission +
    totalBonuses +
    totalExtras -
    totalDeductions;

  return {
    totalSalesValue,
    totalCashCollected,
    totalPendingFuture,
    commissionBaseTotal,
    totalCommissions,
    totalConfirmedInstallmentCommission,
    totalPendingInstallmentCommission,
    totalBonuses,
    totalExtras,
    totalDeductions,
    fixedSalary: input.fixedSalary,
    finalPayable,
  };
}

export function validateReport(input: CommissionReportInput): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  for (const s of input.sales) {
    const cash = getCashCollected(s);
    const total = Number(s.total_sale_value || s.amount || 0);
    const pending = Number(s.pending_future_value || 0);
    const platform = String(s.platform || '').toLowerCase();
    const installments = Number(s.installments || 1);

    if (total > 0 && cash > total + 0.01) {
      warnings.push({
        level: 'critical',
        message: `Venda ${s.client_name || s.id}: Cash Collected (${fmt(cash)}) maior que Valor Total (${fmt(total)}).`,
        saleId: s.id,
      });
    }
    if (pending < 0) {
      warnings.push({
        level: 'critical',
        message: `Venda ${s.client_name || s.id}: Pending Future Value negativo.`,
        saleId: s.id,
      });
    }
    if (platform.includes('hubla') && platform.includes('tmb')) {
      // For Hubla+TMB sales we currently split 50/50 inside the engine.
      // Warn the user so they can review.
      warnings.push({
        level: 'warning',
        message: `Venda ${s.client_name || s.id}: Hubla + TMB — split 50/50 aplicado automaticamente. Revise se o valor recebido por plataforma é diferente.`,
        saleId: s.id,
      });
    }
    // Vendas TMB parceladas não exigem cronograma — comportamento esperado.

  }
  return warnings;
}

/**
 * Returns a complete printable HTML document for the commission report.
 * Open with window.open and trigger print.
 */
export function buildCommissionReportHTML(input: CommissionReportInput): string {
  const summary = computeReportSummary(input);
  const warnings = validateReport(input);
  const monthName = format(new Date(input.year, input.month, 1), 'MMMM yyyy', { locale: ptBR });
  const monthCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Build sale rows (with platform breakdown when applicable)
  const salesRowsHtml = input.commissionRows
    .map((r) => {
      const raw = input.sales.find((s) => s.id === r.id) || {};
      const cash = getCashCollected(raw);
      const total = Number(raw.total_sale_value || raw.amount || cash);
      const pending = Number(raw.pending_future_value || 0);
      const installments = Number(raw.installments || 1);
      const base = r.installmentCommissionBase ?? cash;
      const isSplit = r.hublaCommission != null;
      const platformLine = isSplit
        ? `Hubla: ${fmt(r.hublaCommission!)} · TMB: ${fmt(r.tmbCommission!)}`
        : '';
      return `
        <tr>
          <td>${format(parseLocalDate(r.date), 'dd/MM/yyyy')}</td>
          <td>${escapeHtml(raw.client_name || '-')}</td>
          <td>${escapeHtml(r.product || '-')}</td>
          <td>${escapeHtml(r.platform || '-')}</td>
          <td class="right">${fmt(total)}</td>
          <td class="right cc">${fmt(cash)}</td>
          <td class="right pend">${fmt(pending)}</td>
          <td class="right">${fmt(base)}</td>
          <td class="right">${pct(r.commissionRate)}</td>
          <td class="right" style="font-weight:600">${fmt(r.commissionValue)}${platformLine ? `<div class="muted small">${escapeHtml(platformLine)}</div>` : ''}</td>
          <td class="center">${installments > 1 ? `${installments}x` : '1x'}</td>
        </tr>`;
    })
    .join('');

  // TMB installments
  const installmentsHtml = input.installments.length
    ? `
      <h2>Parcelas TMB</h2>
      <table>
        <thead><tr>
          <th>Produto</th><th>Cliente / Venda</th><th class="center">Parcela</th>
          <th class="right">Venda Original</th><th class="right">Valor Parcela</th>
          <th class="right">Base Comissão</th><th class="right">Comissão</th>
          <th>Status</th>
        </tr></thead>
        <tbody>
          ${input.installments
            .map((i) => {
              const sale = input.sales.find((s) => s.id === i.sale_id) || {};
              const statusLabel =
                i.status === 'confirmed'
                  ? '✅ Confirmado Pago'
                  : i.status === 'not_confirmed'
                  ? '❌ Não Pago'
                  : i.status === 'cancelled'
                  ? '✖ Cancelado'
                  : '⏳ Pendente';
              const commissionVal =
                i.status === 'confirmed' ? Number(i.commission_value || 0) : 0;
              return `<tr>
                <td>${escapeHtml(i.product || '-')}</td>
                <td>${escapeHtml((i as any).client_name || sale.client_name || '-')}</td>
                <td class="center">${i.installment_number}/${i.total_installments}</td>
                <td class="right">${fmt(Number(i.original_sale_value || 0))}</td>
                <td class="right">${fmt(Number(i.installment_amount || 0))}</td>
                <td class="right">${i.status === 'confirmed' ? fmt(Number(i.installment_amount || 0)) : '—'}</td>
                <td class="right" style="font-weight:600">${i.status === 'confirmed' ? fmt(commissionVal) : '—'}</td>
                <td>${escapeHtml(statusLabel)}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <p class="small muted">Apenas parcelas com status "Confirmado Pago" entram na comissão final.</p>`
    : '';

  const bonusesHtml = input.bonuses.length
    ? `
      <h2>Bônus</h2>
      <table>
        <thead><tr><th>Data</th><th>Categoria</th><th>Motivo / Descrição</th><th class="right">Valor</th></tr></thead>
        <tbody>
          ${input.bonuses
            .map(
              (b) => `<tr>
                <td>${b.bonus_date ? format(parseLocalDate(b.bonus_date), 'dd/MM/yyyy') : '-'}</td>
                <td>${escapeHtml(b.category || '-')}</td>
                <td>${escapeHtml(b.description || '-')}</td>
                <td class="right" style="font-weight:600">${fmt(Number(b.amount || 0))}</td>
              </tr>`,
            )
            .join('')}
          <tr class="totalrow"><td colspan="3">Total Bônus</td><td class="right">${fmt(summary.totalBonuses)}</td></tr>
        </tbody>
      </table>`
    : '<h2>Bônus</h2><p class="small muted">Nenhum bônus registrado.</p>';

  const extras = input.observations.filter((o) => o.type === 'extra');
  const deductions = input.observations.filter((o) => o.type === 'deduction');

  const deductionsHtml = `
    <h2>Deduções</h2>
    ${deductions.length
      ? `<table>
          <thead><tr><th>Descrição / Motivo</th><th class="right">Valor</th></tr></thead>
          <tbody>
            ${deductions
              .map(
                (o) => `<tr>
                  <td>${escapeHtml(o.description || '-')}</td>
                  <td class="right neg">- ${fmt(Number(o.amount || 0))}</td>
                </tr>`,
              )
              .join('')}
            <tr class="totalrow"><td>Total Deduções</td><td class="right neg">- ${fmt(summary.totalDeductions)}</td></tr>
          </tbody>
        </table>`
      : '<p class="small muted">Nenhuma dedução.</p>'}
    ${extras.length
      ? `<h3>Comissões Extras</h3>
         <table>
           <thead><tr><th>Descrição</th><th class="right">Valor</th></tr></thead>
           <tbody>
             ${extras
               .map(
                 (o) => `<tr>
                   <td>${escapeHtml(o.description || '-')}</td>
                   <td class="right pos">+ ${fmt(Number(o.amount || 0))}</td>
                 </tr>`,
               )
               .join('')}
             <tr class="totalrow"><td>Total Extras</td><td class="right pos">+ ${fmt(summary.totalExtras)}</td></tr>
           </tbody>
         </table>`
      : ''}
  `;

  const warningsHtml = warnings.length
    ? `<h2>⚠ Validações</h2>
       <ul class="warn">
         ${warnings
           .map(
             (w) =>
               `<li class="${w.level}"><strong>${w.level === 'critical' ? 'CRÍTICO' : 'Atenção'}:</strong> ${escapeHtml(w.message)}</li>`,
           )
           .join('')}
       </ul>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório de Comissões — ${input.seller.name} — ${monthCap}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #141f20; padding: 32px 36px; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; }
  h3 { font-size: 14px; margin: 18px 0 8px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f7; font-weight: 600; }
  .right { text-align: right; }
  .center { text-align: center; }
  .small { font-size: 11px; }
  .muted { color: #777; }
  .pos { color: #0a8a4a; }
  .neg { color: #b91c1c; }
  .cc { background: #ecfdf5; }
  .pend { background: #fef3c7; }
  .totalrow { background: #f9fafb; font-weight: 600; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0 4px; }
  .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .summary-card .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: .04em; }
  .summary-card .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
  .summary-card.primary { background: #141f20; color: #ecefef; border-color: #141f20; }
  .summary-card.primary .label { color: #9fa2a2; }
  .final { margin-top: 18px; padding: 16px 20px; background: #141f20; color: #ecefef; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #39d353; }
  .final .label { font-size: 12px; opacity: .8; }
  .final .value { font-size: 26px; font-weight: 800; color: #39d353; }
  ul.warn { padding-left: 18px; }
  ul.warn li { margin-bottom: 4px; font-size: 12px; }
  ul.warn li.critical { color: #b91c1c; }
  ul.warn li.warning { color: #b45309; }
  .notes { white-space: pre-wrap; padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 12px; }
  @media print {
    /* garante que o bloco escuro e o acento verde saiam na impressao */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { padding: 16px 18px; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    .final { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>Relatório de Comissões e Receita</h1>
  <p class="meta">
    <strong>${escapeHtml(input.seller.name)}</strong>
    ${input.seller.role ? ` · ${escapeHtml(input.seller.role)}` : ''}
    ${input.seller.team ? ` · Time: ${escapeHtml(input.seller.team)}` : ''}
    · ${escapeHtml(monthCap)}
    · Senioridade: ${escapeHtml(input.seniorityLabel)}
    · Modelo: ${escapeHtml(input.modelLabel)}
  </p>

  <h2>Resumo Executivo</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Total Vendido</div><div class="value">${fmt(summary.totalSalesValue)}</div></div>
    <div class="summary-card"><div class="label">Cash Collected</div><div class="value">${fmt(summary.totalCashCollected)}</div></div>
    <div class="summary-card"><div class="label">Pending Future</div><div class="value">${fmt(summary.totalPendingFuture)}</div></div>
    <div class="summary-card"><div class="label">Base de Comissão</div><div class="value">${fmt(summary.commissionBaseTotal)}</div></div>
    <div class="summary-card"><div class="label">Comissões</div><div class="value">${fmt(summary.totalCommissions)}</div></div>
    <div class="summary-card"><div class="label">Parcelas TMB Confirmadas</div><div class="value">${fmt(summary.totalConfirmedInstallmentCommission)}</div></div>
    <div class="summary-card"><div class="label">Bônus</div><div class="value">${fmt(summary.totalBonuses)}</div></div>
    <div class="summary-card"><div class="label">Extras (+) / Deduções (-)</div><div class="value pos">+ ${fmt(summary.totalExtras)} <span class="neg" style="font-size:13px">/ - ${fmt(summary.totalDeductions)}</span></div></div>
    <div class="summary-card"><div class="label">Salário Fixo</div><div class="value">${fmt(summary.fixedSalary)}</div></div>
  </div>

  ${warningsHtml}

  <h2>Detalhamento de Vendas</h2>
  <p class="small muted">Coluna <span class="cc" style="padding:1px 4px">Cash Collected</span> é a base de comissão. <span class="pend" style="padding:1px 4px">Pending Future</span> nunca gera comissão até confirmação.</p>
  <table>
    <thead><tr>
      <th>Data</th><th>Cliente</th><th>Produto</th><th>Plataforma</th>
      <th class="right">Valor Total</th><th class="right">Cash Collected</th>
      <th class="right">Pending Future</th><th class="right">Base Comissão</th>
      <th class="right">% Taxa</th><th class="right">Comissão</th><th class="center">Parc.</th>
    </tr></thead>
    <tbody>${salesRowsHtml || '<tr><td colspan="11" class="center muted">Sem vendas no período.</td></tr>'}</tbody>
  </table>

  ${installmentsHtml}

  ${bonusesHtml}

  ${deductionsHtml}

  ${input.sellerNotes?.trim()
    ? `<h2>Notas do Vendedor</h2><div class="notes">${escapeHtml(input.sellerNotes)}</div>`
    : ''}

  ${input.managerNotes?.trim()
    ? `<h2>Notas Gestão / Financeiro</h2><div class="notes">${escapeHtml(input.managerNotes)}</div>`
    : ''}

  <div class="final">
    <div class="label">Total Final a Pagar<br/><span style="font-size:10px;opacity:.7">Fixo + Comissões + Parcelas Confirmadas + Bônus + Extras − Deduções</span></div>
    <div class="value">${fmt(summary.finalPayable)}</div>
  </div>

  <script>setTimeout(()=>window.print(), 250);</script>
</body>
</html>`;
}


export function openCommissionReport(input: CommissionReportInput): void {
  const html = buildCommissionReportHTML(input);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
