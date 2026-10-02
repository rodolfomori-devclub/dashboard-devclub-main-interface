import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEND_ANCHOR, whenLabel } from '@/lib/diagnostic/send';
import {
  offerShownInfo,
  SCHOLARSHIP_OPTIONS,
  scholarshipBlocked,
  withScholarshipStatus,
} from '@/lib/diagnostic/sendScholarship';
import type { ScholarshipStatus } from '@/lib/diagnostic/workspace';
import { BlockedNote, StepCard, WarnNote, type StepProps } from './StepCard';

/**
 * Passo 3: o que aconteceu com a bolsa (vem antes do PDF e da nota do CRM, que
 * mudam com ela). Continua editavel depois do envio.
 */
export function ScholarshipStep({ api, step, index, now }: StepProps) {
  const { ws } = api;
  const d = ws.diagnosis;
  const cursando = ws.lead.graduation_status === 'cursando';
  // Regra 10 e o cockpit: sem graduacao confirmada (ou cursando), so "Nao apresentada".
  const blocked = scholarshipBlocked(ws.lead.graduation_status);
  const shown = offerShownInfo(d.offer_shown);
  const requestedMs = d.offer_requested_at ? Date.parse(d.offer_requested_at) : NaN;
  const current = SCHOLARSHIP_OPTIONS.find((o) => o.value === d.scholarship_status);

  let status = current?.label;
  if (cursando) status = 'Não se aplica';
  else if (blocked) status = 'Travado';

  return (
    <StepCard
      id={SEND_ANCHOR.scholarship}
      index={index}
      title="Bolsa"
      hint="Só registre o que aconteceu de verdade na call."
      done={step.done}
      status={status}
      tone={step.done || blocked ? 'muted' : 'pending'}
    >
      <div className="space-y-1.5">
        <Label htmlFor="send-scholarship-status">Status da bolsa</Label>
        <Select
          value={d.scholarship_status}
          onValueChange={(v) => api.update((w) => withScholarshipStatus(w, v as ScholarshipStatus))}
          disabled={!api.canEdit}
        >
          <SelectTrigger id="send-scholarship-status" className="sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHOLARSHIP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={!!blocked && o.value !== 'none'}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {blocked && <BlockedNote>{blocked}</BlockedNote>}
      {!blocked && step.reason && <WarnNote>{step.reason}</WarnNote>}
      {Number.isFinite(requestedMs) && (
        <p className="text-xs text-muted-foreground">Ele pediu para ver a bolsa {whenLabel(requestedMs, now)}.</p>
      )}
      {shown && (
        <p className="text-xs text-muted-foreground">
          A tela do lead mostrou a oferta {whenLabel(Date.parse(shown.shownAt), now)}
          {shown.summary ? `: ${shown.summary}.` : '.'}
        </p>
      )}
      <p className="text-xs text-muted-foreground">"Fechou" desconta uma bolsa da turma nos números da Head.</p>
    </StepCard>
  );
}
