import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhoneDisplay, openWhatsApp, sanitizePhone, WhatsAppUrlOptions } from '@/lib/whatsapp';

interface BaseProps extends WhatsAppUrlOptions {
  phone?: string | null;
  className?: string;
  /** Stop propagation — useful when nested inside a clickable row. */
  stopPropagation?: boolean;
  title?: string;
}

function handleClick(e: React.MouseEvent, phone: string | null | undefined, opts: WhatsAppUrlOptions, stopPropagation: boolean) {
  e.preventDefault();
  if (stopPropagation) e.stopPropagation();
  openWhatsApp(phone, opts);
}

/**
 * Compact icon-only button. Use inside tables, chips, lists.
 */
export function WhatsAppIconButton({ phone, message, tokens, className, stopPropagation = true, title = 'Enviar mensagem no WhatsApp' }: BaseProps) {
  if (!sanitizePhone(phone)) return null;
  return (
    <button
      type="button"
      onClick={(e) => handleClick(e, phone, { message, tokens }, stopPropagation)}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex items-center justify-center h-7 w-7 rounded-full',
        'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300',
        'border border-emerald-500/30 transition-colors',
        className,
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * Number + icon combo. Both the number and the icon open WhatsApp.
 */
export function WhatsAppContact({
  phone,
  message,
  tokens,
  className,
  showLabel = true,
  stopPropagation = true,
}: BaseProps & { showLabel?: boolean }) {
  const digits = sanitizePhone(phone);
  if (!digits) return <span className="text-muted-foreground">—</span>;
  const display = formatPhoneDisplay(phone);
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {showLabel && (
        <button
          type="button"
          onClick={(e) => handleClick(e, phone, { message, tokens }, stopPropagation)}
          className="text-foreground hover:text-emerald-400 transition-colors underline-offset-2 hover:underline"
        >
          {display}
        </button>
      )}
      <WhatsAppIconButton phone={phone} message={message} tokens={tokens} stopPropagation={stopPropagation} />
    </span>
  );
}
