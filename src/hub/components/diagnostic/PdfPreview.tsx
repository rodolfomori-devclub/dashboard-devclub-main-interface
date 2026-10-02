import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DiagnosisModel } from '@diag/types.ts';
import { PDF_PRINTABLE_HEIGHT_PX, PDF_SCREEN_GUTTER_PX, PDF_SHEET_WIDTH_PX } from '@diag/pdfCss.ts';
import { pdfTitle, renderPdfBody } from '@diag/pdfHtml.ts';
import { browserPdfDocument } from '@/lib/diagnostic/pdfBrowser';
import { cn } from '@/lib/utils';

export interface PdfPreviewProps {
  model: DiagnosisModel;
  className?: string;
  /** Paginas (1, 2, 3) que passaram de uma folha A4; [] quando todas cabem. */
  onOverflow?: (pages: number[]) => void;
}

const DEBOUNCE_MS = 250;

/** Largura natural do documento na tela: folha, respiros e barra de rolagem. */
const NATURAL_WIDTH_PX = Math.ceil(PDF_SHEET_WIDTH_PX) + 2 * PDF_SCREEN_GUTTER_PX + 18;

/**
 * Paginas cujo conteudo passa da altura util do A4. Na tela a folha tem a
 * mesma largura util do papel, entao a altura medida e a altura impressa.
 */
function overflowingPages(doc: Document): number[] {
  const pages: number[] = [];
  doc.querySelectorAll('.sheet').forEach((sheet, i) => {
    const parts = Array.from(sheet.children);
    if (!parts.length) return;
    const top = parts[0].getBoundingClientRect().top;
    const bottom = Math.max(...parts.map((p) => p.getBoundingClientRect().bottom));
    if (bottom - top > PDF_PRINTABLE_HEIGHT_PX) pages.push(i + 1);
  });
  return pages;
}

/**
 * Previa do PDF num iframe sem scripts. O documento entra uma vez; cada
 * atualizacao troca so o <body>, entao a rolagem nao volta para o topo.
 */
export function PdfPreview({ model, className, onOverflow }: PdfPreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [initial] = useState(() => ({ doc: browserPdfDocument(model), body: renderPdfBody(model) }));
  const appliedBodyRef = useRef(initial.body);
  const latestModelRef = useRef(model);
  const onOverflowRef = useRef(onOverflow);
  const reportedRef = useRef<string | null>(null);
  const [overflow, setOverflow] = useState<number[]>([]);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    onOverflowRef.current = onOverflow;
  }, [onOverflow]);

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.querySelector('.sheet')) return;
    const pages = overflowingPages(doc);
    const key = pages.join(',');
    if (key === reportedRef.current) return;
    reportedRef.current = key;
    setOverflow(pages);
    onOverflowRef.current?.(pages);
  }, []);

  const apply = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    // Antes do load o iframe ainda mostra about:blank.
    if (!doc?.body || !doc.querySelector('.sheet')) return;
    const current = latestModelRef.current;
    const body = renderPdfBody(current);
    if (body !== appliedBodyRef.current) {
      doc.body.innerHTML = body;
      doc.title = pdfTitle(current);
      appliedBodyRef.current = body;
    }
    measure();
    // Uma fonte que ainda nao tinha sido usada (o italico das frases) muda as alturas.
    doc.fonts?.ready.then(measure, () => undefined);
  }, [measure]);

  useEffect(() => {
    latestModelRef.current = model;
    const timer = window.setTimeout(apply, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [model, apply]);

  const handleLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    doc?.fonts?.forEach((font) => {
      font.load().catch(() => undefined);
    });
    apply();
  }, [apply]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Escondido (aba inativa) o iframe nao tem layout: mede de novo quando aparece.
  useEffect(() => {
    if (box) measure();
  }, [box, measure]);

  let frameStyle: CSSProperties = { width: '100%', height: '100%' };
  if (box && box.w > 0 && box.h > 0) {
    const scale = Math.min(1, box.w / NATURAL_WIDTH_PX);
    frameStyle = {
      width: box.w / scale,
      height: box.h / scale,
      transform: scale < 1 ? `scale(${scale})` : undefined,
    };
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      {overflow.length > 0 && (
        <div role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          {overflow.map((page) => (
            <p key={page}>Página {page} passou do tamanho de uma folha A4: encurte as frases.</p>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">É exatamente isto que a pessoa recebe.</p>
      <div
        ref={boxRef}
        className="relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-border bg-[#E9EDF1]"
      >
        <iframe
          ref={frameRef}
          title="Prévia do PDF"
          sandbox="allow-same-origin"
          srcDoc={initial.doc}
          onLoad={handleLoad}
          className="absolute left-0 top-0 origin-top-left border-0"
          style={frameStyle}
        />
      </div>
    </div>
  );
}
