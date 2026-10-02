import { cn } from '@/lib/utils';
import { formatBRL, ymdToBR } from '@diag/dates.ts';
import { seatsInfo } from '@diag/offer.ts';
import type { OfferSettings } from '@diag/types.ts';

interface Fact {
  label: string;
  value: string | null;
  note: string | null;
  /** O que nao vai aparecer para o lead por causa deste fato. */
  warn: boolean;
}

const dayCount = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

function factsOf(settings: OfferSettings, nowMs: number): Fact[] {
  const seats = seatsInfo(settings, nowMs);
  const { listPrice, scholarshipMax, reservationMaxDays } = settings;

  let seatsNote: string | null;
  if (seats.left === null) seatsNote = 'Sem número de bolsas: a tela não fala de bolsas limitadas.';
  else if (!seats.confirmedOnYmd) seatsNote = 'Nunca confirmado pela Head: o número não aparece.';
  else if (!seats.fresh) {
    seatsNote = `Confirmado em ${ymdToBR(seats.confirmedOnYmd)}, há mais de ${dayCount(settings.seatsFreshDays)}: o número não aparece até a Head confirmar de novo.`;
  } else if (seats.left === 0) seatsNote = `Confirmado em ${ymdToBR(seats.confirmedOnYmd)}. Sem bolsas restantes: a cena da bolsa não abre.`;
  else seatsNote = `Confirmado em ${ymdToBR(seats.confirmedOnYmd)}.`;

  return [
    {
      label: 'Preço de tabela',
      value: listPrice !== null ? formatBRL(listPrice) : null,
      note: listPrice !== null ? null : 'Sem preço de tabela: a âncora não aparece.',
      warn: listPrice === null,
    },
    {
      label: 'Bolsa máxima (desconto)',
      value: scholarshipMax !== null ? formatBRL(scholarshipMax) : null,
      note:
        scholarshipMax === null
          ? 'Sem limite cadastrado: o valor com bolsa não é conferido.'
          : listPrice !== null
            ? `Menor valor com bolsa: ${formatBRL(Math.max(listPrice - scholarshipMax, 0))}.`
            : null,
      warn: scholarshipMax === null,
    },
    {
      label: 'Bolsas restantes',
      value: seats.left !== null ? String(seats.left) : null,
      note: seatsNote,
      warn: seats.left === null || !seats.fresh || seats.left === 0,
    },
    {
      label: 'Prazo máximo de reserva',
      value: reservationMaxDays !== null ? `${dayCount(reservationMaxDays)} da sessão` : null,
      note: reservationMaxDays !== null ? null : 'Sem prazo cadastrado: nada cita validade.',
      warn: reservationMaxDays === null,
    },
  ];
}

/** Numeros da Head (so leitura): a tela do lead so cita o que esta aqui. */
export function OfferFacts({ settings, nowMs }: { settings: OfferSettings; nowMs: number }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Da Head{settings.cohortName ? ` · ${settings.cohortName}` : ''}. Você não edita: a tela do lead só cita o que está aqui.
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {factsOf(settings, nowMs).map((f) => (
          <div key={f.label} className="rounded-md border border-border/60 p-2.5">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{f.label}</dt>
            <dd className="text-sm font-medium text-foreground tabular-nums">{f.value ?? 'Não cadastrado'}</dd>
            {f.note && <dd className={cn('text-xs mt-0.5', f.warn ? 'text-amber-400' : 'text-muted-foreground')}>{f.note}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
