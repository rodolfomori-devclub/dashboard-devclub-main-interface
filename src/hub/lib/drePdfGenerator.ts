import type { jsPDF } from 'jspdf';

interface CostLine { label: string; value: number | string; }

interface DreData {
  month: number;
  year: number;
  revenueHubla: number;
  revenueTmb: number;
  revenueTotal: number;
  ccHubla: number;
  ccTmb: number;
  ccTotal: number;
  costsTime: CostLine[];
  costsMarketing: CostLine[];
  costsFerramentas: CostLine[];
  costsComissoes: CostLine[];
  totalTime: number;
  totalMarketing: number;
  totalFerramentas: number;
  totalComissoes: number;
  totalSaidas: number;
  impostos: number;
  overheadFixo: number;
  lucroLiquido: number;
  margemLiquida: number | null;
  sales: { date: string; seller: string; client: string; product: string; platform: string; origin: string; commissionValue: number; totalValue: number; note: string }[];
}

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MARGIN = 20;
const PW = 210;
const PH = 297;
const CW = PW - MARGIN * 2;

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function header(doc: jsPDF, label: string) {
  doc.setFillColor(20, 31, 32);
  doc.rect(0, 0, PW, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DRE GLOBAL', MARGIN, 9);
  doc.setFont('helvetica', 'normal');
  doc.text(label, PW - MARGIN, 9, { align: 'right' });
  // Fio de marca DevClub (#39d353) — acento fino, nunca superficie
  doc.setDrawColor(57, 211, 83);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 16, PW - MARGIN, 16);
}

function footer(doc: jsPDF, page: number) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PH - 12, PW - MARGIN, PH - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('DevClub · DRE Global', MARGIN, PH - 7);
  doc.text(`Página ${page}`, PW - MARGIN, PH - 7, { align: 'right' });
}

export async function generateDrePdf(data: DreData) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const label = `${months[data.month - 1]} ${data.year}`;
  let y = 22;
  let page = 1;

  header(doc, label);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 31, 32);
  doc.text('DRE Global', PW / 2, 32, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(label, PW / 2, 39, { align: 'center' });
  y = 48;

  const ensureSpace = (needed: number) => {
    if (y + needed > PH - 18) {
      footer(doc, page);
      doc.addPage();
      page++;
      header(doc, label);
      y = 22;
    }
  };

  const sectionHeader = (title: string, color: [number, number, number] = [20, 31, 32]) => {
    ensureSpace(12);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(MARGIN, y, CW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(title, MARGIN + 3, y + 5.5);
    y += 10;
  };

  const row = (label: string, value: string, bold = false, indent = 0, color?: [number, number, number]) => {
    ensureSpace(7);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.setTextColor(color ? color[0] : 40, color ? color[1] : 40, color ? color[2] : 40);
    doc.text(label, MARGIN + 3 + indent, y);
    doc.text(value, PW - MARGIN - 3, y, { align: 'right' });
    y += 6;
  };

  const separator = () => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y - 2, PW - MARGIN, y - 2);
  };

  // RECEITA
  sectionHeader('RECEITA', [22, 163, 74]);
  row('VENDAS', fmt(data.revenueTotal), true);
  row('Hubla', fmt(data.revenueHubla), false, 6);
  row('TMB', fmt(data.revenueTmb), false, 6);
  separator();
  row('CASH COLLECTED', fmt(data.ccTotal), true);
  row('Hubla CC', fmt(data.ccHubla), false, 6);
  row('TMB CC', fmt(data.ccTmb), false, 6);
  y += 2;

  // SAÍDAS
  sectionHeader('SAÍDAS', [220, 38, 38]);

  const renderCostSection = (title: string, lines: CostLine[], total: number) => {
    row(title, fmt(total), true);
    lines.forEach(l => {
      row(String(l.label), fmt(Number(l.value) || 0), false, 6);
    });
    separator();
  };

  renderCostSection('Time', data.costsTime, data.totalTime);
  renderCostSection('Marketing', data.costsMarketing, data.totalMarketing);
  renderCostSection('Ferramentas', data.costsFerramentas, data.totalFerramentas);
  renderCostSection('Comissões', data.costsComissoes, data.totalComissoes);

  row('TOTAL SAÍDAS', fmt(data.totalSaidas), true, 0, [220, 38, 38]);
  y += 2;

  // RESULTADO
  sectionHeader('RESULTADO', [20, 31, 32]);
  row('Entrada (Cash Collected)', fmt(data.ccTotal), true, 0, [22, 163, 74]);
  row('Saídas', fmt(data.totalSaidas), true, 0, [220, 38, 38]);
  row('Impostos (5%)', fmt(data.impostos));
  row('Overhead Fixo', fmt(data.overheadFixo));
  separator();

  const profitColor: [number, number, number] = data.lucroLiquido >= 0 ? [22, 163, 74] : [220, 38, 38];
  ensureSpace(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(profitColor[0], profitColor[1], profitColor[2]);
  doc.text('LUCRO LÍQUIDO', MARGIN + 3, y);
  doc.text(fmt(data.lucroLiquido), PW - MARGIN - 3, y, { align: 'right' });
  y += 7;

  if (data.margemLiquida !== null) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Margem Líquida', MARGIN + 3, y);
    doc.text(`${data.margemLiquida.toFixed(1)}%`, PW - MARGIN - 3, y, { align: 'right' });
    y += 8;
  }

  // Sales detail
  if (data.sales.length > 0) {
    y += 4;
    sectionHeader(`DETALHAMENTO DE VENDAS (${data.sales.length})`, [20, 31, 32]);

    const colWidths = [18, 25, 28, 25, 20, 20, 20, 20];
    const headers = ['Data', 'Vendedor', 'Cliente', 'Produto', 'Plataf.', 'Origem', 'Comissão', 'Total'];

    ensureSpace(12);
    doc.setFillColor(243, 244, 246);
    doc.rect(MARGIN, y - 3.5, CW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    let xPos = MARGIN;
    headers.forEach((h, i) => {
      const align = i >= 6 ? 'right' : 'left';
      const tx = align === 'right' ? xPos + colWidths[i] - 1 : xPos + 1;
      doc.text(h, tx, y, { align });
      xPos += colWidths[i];
    });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    data.sales.forEach(s => {
      ensureSpace(6);
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, y - 3, PW - MARGIN, y - 3);

      const cells = [
        s.date.split('-').reverse().join('/'),
        s.seller.substring(0, 14),
        s.client.substring(0, 16) || '—',
        s.product.substring(0, 14),
        s.platform || '—',
        s.origin.substring(0, 10) || '—',
        fmt(s.commissionValue),
        fmt(s.totalValue),
      ];

      xPos = MARGIN;
      doc.setTextColor(40, 40, 40);
      cells.forEach((cell, i) => {
        const align = i >= 6 ? 'right' : 'left';
        const tx = align === 'right' ? xPos + colWidths[i] - 1 : xPos + 1;
        doc.text(cell, tx, y, { align });
        xPos += colWidths[i];
      });
      y += 5;
    });
  }

  footer(doc, page);
  doc.save(`DRE_Global_${months[data.month - 1]}_${data.year}.pdf`);
}
