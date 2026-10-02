import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { splitPlaceholders, usablePhone } from '@/lib/diagnostic/send';
import { patchLead } from '@/lib/diagnostic/workspace';
import { useLatch } from './hooks';

/** Texto da mensagem como vai para o lead, com o que falta preencher em destaque. */
export function MessagePreview({ text, label }: { text: string; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/20 p-3 text-sm leading-relaxed text-foreground"
    >
      {splitPlaceholders(text).map((part, i) =>
        part.placeholder ? (
          <mark key={i} className="rounded bg-amber-500/20 px-0.5 text-amber-300">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </div>
  );
}

/**
 * WhatsApp do lead faltando ou invalido: corrige aqui (antes do envio, quando
 * o lead ainda nao recebeu nada). Fica na tela ate o fim, para nao sumir no meio da digitacao.
 */
export function PhoneFix({ api, id }: { api: ReadyWorkspace; id: string }) {
  const { lead } = api.ws;
  const show = useLatch(!usablePhone(lead.whatsapp));
  if (!show || !api.canEdit || api.frozen) return null;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>WhatsApp do lead</Label>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={lead.whatsapp}
        onChange={(e) => api.update((w) => patchLead(w, { whatsapp: e.target.value }))}
        placeholder="(11) 90000-0000"
        className="sm:max-w-xs"
        autoComplete="off"
      />
    </div>
  );
}
