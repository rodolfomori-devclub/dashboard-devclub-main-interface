import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export async function exportNoteToPdf(date: Date, htmlContent: string) {
  const { default: html2pdf } = await import('html2pdf.js');
  const dateLabel = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const fileName = `daily-${format(date, 'yyyy-MM-dd')}.pdf`;

  const wrapper = document.createElement('div');
  wrapper.style.padding = '32px';
  wrapper.style.fontFamily = 'Arial, sans-serif';
  wrapper.style.color = '#111';
  wrapper.style.background = '#fff';
  wrapper.style.maxWidth = '800px';
  wrapper.innerHTML = `
    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px;">
      <h1 style="font-size: 22px; margin: 0 0 4px 0; color: #111;">Anotação de Daily</h1>
      <p style="font-size: 13px; margin: 0; color: #6b7280;">${dateLabel}</p>
    </div>
    <div class="note-content" style="font-size: 14px; line-height: 1.6; color: #111;">
      ${htmlContent || '<p><em>Sem conteúdo</em></p>'}
    </div>
  `;

  // Force readable colors in PDF (override dark theme inline styles where possible)
  wrapper.querySelectorAll('img').forEach(img => {
    (img as HTMLImageElement).style.maxWidth = '100%';
    (img as HTMLImageElement).style.height = 'auto';
    (img as HTMLImageElement).style.borderRadius = '8px';
    (img as HTMLImageElement).style.margin = '8px 0';
  });

  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    } as any)
    .from(wrapper)
    .save();
}

// Strip HTML and produce a WhatsApp-friendly text with light formatting
export function htmlToWhatsAppText(html: string): string {
  if (!html) return '';
  let text = html;

  // Convert formatting tags into WhatsApp markdown
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '*$1*');
  text = text.replace(/<b>(.*?)<\/b>/gi, '*$1*');
  text = text.replace(/<em>(.*?)<\/em>/gi, '_$1_');
  text = text.replace(/<i>(.*?)<\/i>/gi, '_$1_');
  text = text.replace(/<u>(.*?)<\/u>/gi, '$1');

  // Headings
  text = text.replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, '\n*$1*\n');

  // Lists
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  text = text.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // Paragraphs and breaks
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '');

  // Images become a marker
  text = text.replace(/<img[^>]*>/gi, '[imagem]');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

export function shareNoteOnWhatsApp(date: Date, htmlContent: string) {
  const dateLabel = format(date, "dd/MM/yyyy", { locale: ptBR });
  const body = htmlToWhatsAppText(htmlContent) || '(sem conteúdo)';
  const message = `*Anotação de Daily — ${dateLabel}*\n\n${body}`;
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
