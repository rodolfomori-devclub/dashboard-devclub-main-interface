import { Fragment, useMemo } from 'react';
import { CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { missingVarHint, templateParts } from '@/lib/diagnostic/cockpit';
import { useCockpit } from './cockpitContext';

const SIZE = {
  read: 'text-base sm:text-lg leading-relaxed text-foreground',
  question: 'text-[15px] sm:text-base leading-snug text-foreground',
  small: 'text-sm leading-snug',
} as const;

/** Variavel sem valor: chip com o que preencher. Nunca impede a leitura. */
export function MissingChip({ name }: { name: string }) {
  const { api } = useCockpit();
  return (
    <span
      className="mx-0.5 inline-flex items-center gap-1 rounded border border-dashed border-amber-400/50 bg-amber-500/10 px-1.5 py-px align-middle text-xs font-normal not-italic text-amber-300"
      title={`Falta: ${name}`}
    >
      <CircleDashed className="h-3 w-3 shrink-0" aria-hidden="true" />
      {missingVarHint(name, { scoresComplete: api.model.complete })}
    </span>
  );
}

/** Texto do roteiro com os dados do lead encaixados; quebras de linha preservadas. */
export function ScriptText({
  text,
  size = 'read',
  className,
  id,
}: {
  text: string;
  size?: keyof typeof SIZE;
  className?: string;
  id?: string;
}) {
  const { vars } = useCockpit();
  const parts = useMemo(() => templateParts(text, vars), [text, vars]);
  return (
    <p id={id} className={cn('whitespace-pre-line', SIZE[size], className)}>
      {parts.map((part, i) =>
        part.kind === 'text' ? <Fragment key={i}>{part.text}</Fragment> : <MissingChip key={i} name={part.name} />,
      )}
    </p>
  );
}
