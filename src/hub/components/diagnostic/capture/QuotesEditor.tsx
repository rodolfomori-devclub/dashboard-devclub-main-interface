import { useState } from 'react';
import { Quote as QuoteIcon, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { addQuote, EMPTY_QUOTE_DRAFT, MAX_PDF_QUOTES, QUOTE_TAG_LABEL, type QuoteDraft } from '@/lib/diagnostic/capture';
import type { Quote, QuoteTag } from '@diag/types.ts';

const TAGS = Object.keys(QUOTE_TAG_LABEL) as QuoteTag[];

interface Props {
  quotes: Quote[];
  onChange: (quotes: Quote[]) => void;
  /** Marca da frase nova (o bloco atual da call). */
  defaultTag: QuoteTag;
  readOnly?: boolean;
  /** Frase usada no roteiro da devolutiva ({{frase}}). */
  featuredQuoteId?: string | null;
  onFeature?: (id: string | null) => void;
  hideAdd?: boolean;
  className?: string;
  /**
   * Frase sendo digitada, guardada por quem usa o editor (o cockpit monta o
   * editor em lugares diferentes conforme a largura: a frase nao pode sumir).
   */
  draft?: QuoteDraft;
  onDraftChange?: (draft: QuoteDraft) => void;
}

/**
 * Frases do lead, nas palavras dele. Nunca passam pelo verificador de palavras:
 * vao sempre entre aspas. Ate 3 vao para o PDF e para a devolutiva.
 */
export function QuotesEditor({
  quotes,
  onChange,
  defaultTag,
  readOnly,
  featuredQuoteId,
  onFeature,
  hideAdd,
  className,
  draft: outerDraft,
  onDraftChange,
}: Props) {
  const [localDraft, setLocalDraft] = useState<QuoteDraft>(EMPTY_QUOTE_DRAFT);
  const controlled = outerDraft !== undefined && onDraftChange !== undefined;
  const current = controlled ? outerDraft : localDraft;
  const setCurrent = (next: QuoteDraft) => (controlled ? onDraftChange(next) : setLocalDraft(next));
  const draft = current.text;
  const currentTag = current.tag ?? defaultTag;
  const inPdfCount = quotes.filter((q) => q.inPdf).length;

  const save = () => {
    if (!draft.trim()) return;
    onChange(addQuote(quotes, draft, currentTag));
    setCurrent(EMPTY_QUOTE_DRAFT);
  };

  const patch = (id: string, p: Partial<Quote>) => onChange(quotes.map((q) => (q.id === id ? { ...q, ...p } : q)));

  return (
    <div className={cn('space-y-3', className)}>
      {!hideAdd && !readOnly && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setCurrent({ ...current, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                save();
              }
            }}
            rows={2}
            placeholder='Frase dele, do jeito que ele falou (Enter guarda)'
            className="text-sm"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={currentTag}
              onChange={(e) => setCurrent({ ...current, tag: e.target.value as QuoteTag })}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
              aria-label="Momento da frase"
            >
              {TAGS.map((t) => (
                <option key={t} value={t}>
                  {QUOTE_TAG_LABEL[t]}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" className="h-8 gap-1.5 ml-auto" onClick={save} disabled={!draft.trim()}>
              <QuoteIcon className="h-3.5 w-3.5" /> Guardar frase
            </Button>
          </div>
        </div>
      )}

      {quotes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma frase ainda. O diagnóstico precisa de pelo menos uma.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {inPdfCount} de {MAX_PDF_QUOTES} no diagnóstico
          </p>
          <ul className="space-y-2">
            {quotes.map((q) => {
              const featured = featuredQuoteId === q.id;
              const canAddToPdf = q.inPdf || inPdfCount < MAX_PDF_QUOTES;
              return (
                <li key={q.id} className="rounded-md border border-border/60 p-2.5 space-y-1.5">
                  <p className="text-sm text-foreground leading-snug">"{q.text}"</p>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    <span>{QUOTE_TAG_LABEL[q.tag] ?? 'Outro'}</span>
                    <label className={cn('flex items-center gap-1.5', !canAddToPdf && 'opacity-50')}>
                      <Checkbox
                        checked={q.inPdf}
                        disabled={readOnly || !canAddToPdf}
                        onCheckedChange={(v) => patch(q.id, { inPdf: v === true })}
                      />
                      No diagnóstico
                    </label>
                    {onFeature && (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => onFeature(featured ? null : q.id)}
                        className={cn('flex items-center gap-1', featured ? 'text-primary' : 'hover:text-foreground')}
                        title="Usar esta frase na devolutiva"
                      >
                        <Star className={cn('h-3.5 w-3.5', featured && 'fill-current')} />
                        {featured ? 'Na devolutiva' : 'Usar na devolutiva'}
                      </button>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          onChange(quotes.filter((x) => x.id !== q.id));
                          if (featured) onFeature?.(null);
                        }}
                        className="ml-auto hover:text-red-400"
                        aria-label="Apagar frase"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
