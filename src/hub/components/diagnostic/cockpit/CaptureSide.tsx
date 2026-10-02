import { useId, useState, type ReactNode } from 'react';
import { ChevronUp, Quote as QuoteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { QuotesEditor } from '@/components/diagnostic/capture/QuotesEditor';
import { cn } from '@/lib/utils';
import { quoteTagForBlock } from '@/lib/diagnostic/capture';
import { captureStatus } from '@/lib/diagnostic/cockpit';
import { patchCallData, patchDiagnosis } from '@/lib/diagnostic/workspace';
import { useCockpit } from './cockpitContext';
import { SectionLabel } from './parts';

function Mark({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <span className={ok ? 'text-emerald-400' : 'text-red-400'}>{children}</span>;
}

/** Captura minima da call: 1 frase, 5 notas, compromisso e data. Sempre a vista; em destaque no modo curto. */
export function CaptureStatusLine({ className, compact }: { className?: string; compact?: boolean }) {
  const { api } = useCockpit();
  const s = captureStatus(api.ws);
  const shortMode = api.ws.diagnosis.call_data.shortMode;
  return (
    <p
      role="status"
      aria-label="Captura mínima da call"
      className={cn(
        'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums',
        shortMode && 'rounded-md border border-amber-400/50 bg-amber-500/10 px-2 py-1 font-semibold',
        shortMode && !compact ? 'text-sm' : 'text-xs',
        className,
      )}
    >
      {/* Os espacos entre os itens nao aparecem no flex, mas mantem o texto legivel para leitor de tela. */}
      <Mark ok={s.quotes >= 1}>Frases {s.quotes}</Mark> <span className="text-muted-foreground">·</span>{' '}
      <Mark ok={s.scores === 5}>Notas {s.scores}/5</Mark> <span className="text-muted-foreground">·</span>{' '}
      <Mark ok={s.commitment}>Compromisso {s.commitment ? '✓' : '✗'}</Mark>{' '}
      <span className="text-muted-foreground">·</span> <Mark ok={s.dueDate}>Data {s.dueDate ? '✓' : '✗'}</Mark>
    </p>
  );
}

/**
 * Frases dele, sempre a mao. A marca da frase nova segue o bloco atual. A frase
 * sendo digitada e do cockpit: todos os campos de frases mostram a mesma.
 */
export function QuotesPanel() {
  const { api, block, readOnly, write, quoteDraft, setQuoteDraft } = useCockpit();
  const d = api.ws.diagnosis;
  return (
    <QuotesEditor
      quotes={d.quotes}
      onChange={(quotes) => write((w) => patchDiagnosis(w, { quotes }))}
      defaultTag={quoteTagForBlock(block.id)}
      readOnly={readOnly}
      featuredQuoteId={d.call_data.featuredQuoteId}
      onFeature={(id) => write((w) => patchCallData(w, { featuredQuoteId: id }))}
      draft={quoteDraft}
      onDraftChange={setQuoteDraft}
    />
  );
}

/** "Só você vê": a unica coisa editavel depois de enviado. */
export function PrivateNotes() {
  const { api, locked } = useCockpit();
  // A coluna de captura monta duas vezes na tela larga (Call e Tela do lead).
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Só você vê
      </label>
      <Textarea
        id={id}
        value={api.ws.diagnosis.call_data.privateNotes}
        onChange={(e) => {
          if (locked) return;
          const value = e.target.value;
          api.update((w) => patchCallData(w, { privateNotes: value }));
        }}
        disabled={locked}
        rows={4}
        placeholder="Anotações suas. Nunca vão para o lead nem para o PDF."
        className="text-sm"
      />
    </div>
  );
}

/** Coluna da direita na tela larga. */
export function CaptureSide() {
  return (
    <aside aria-label="Captura" className="space-y-4">
      <div className="glass-card space-y-3 p-4">
        <CaptureStatusLine />
        <SectionLabel>Frases dele</SectionLabel>
        <QuotesPanel />
      </div>
      <div className="glass-card p-4">
        <PrivateNotes />
      </div>
    </aside>
  );
}

/**
 * Coluna estreita: frases num painel fixo embaixo, com a captura minima sempre
 * a vista. A frase sendo digitada fica no cockpit: fechar o painel, trocar de
 * aba ou de largura nao a perde.
 */
export function QuoteDock({ hidden }: { hidden?: boolean }) {
  const { api } = useCockpit();
  const [open, setOpen] = useState(false);
  const count = api.ws.diagnosis.quotes.length;
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 border-t border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85',
        hidden && 'hidden',
      )}
    >
      <div className="flex items-center gap-2">
        <CaptureStatusLine compact className="min-w-0 flex-1" />
        <Button
          type="button"
          size="sm"
          variant={open ? 'default' : 'outline'}
          className="h-8 shrink-0 gap-1 px-2.5"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="cockpit-quote-dock"
          aria-label="Frases dele"
          title="Frases dele"
        >
          {open ? <ChevronUp className="rotate-180" /> : <QuoteIcon />}
          <span className="tabular-nums">{count}</span>
        </Button>
      </div>
      <div id="cockpit-quote-dock" className={cn('mt-2 max-h-[55vh] overflow-y-auto pb-1', !open && 'hidden')}>
        <QuotesPanel />
      </div>
    </div>
  );
}
