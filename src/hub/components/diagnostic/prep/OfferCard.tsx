import { BadgePercent, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchOfferConfig } from '@/lib/diagnostic/workspace';
import { sceneOrder } from '@/lib/diagnostic/presentation';
import { groupOfferProblems } from '@/lib/diagnostic/prepChecklist';
import { addDaysYmd, formatBRL, isValidYmd, todayYmd, ymdToBR } from '@diag/dates.ts';
import type { OfferConfig } from '@diag/types.ts';
import { PREP_SECTION } from './anchors';
import { DecimalInput, Field, Notice, ProblemList } from './fields';
import { OfferFacts } from './OfferFacts';
import { OfferPreview } from './OfferPreview';
import { PaymentPathsEditor } from './PaymentPathsEditor';
import { PrepCard, PrepSubheading } from './PrepCard';

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

/** Cena da bolsa: fatos da Head (so leitura) e o que o vendedor monta dentro deles. */
export function OfferCard({ api }: { api: ReadyWorkspace }) {
  const { ws, settings } = api;
  const readOnly = !api.canEdit;
  const config = ws.diagnosis.prep_config.offer;
  const setOffer = (p: Partial<OfferConfig>) => api.update((w) => patchOfferConfig(w, p));

  const now = Date.now();
  const today = todayYmd(now);
  const sessionYmd = ws.session.scheduled_date ?? '';
  const problems = groupOfferProblems(config, settings, { todayYmd: today, sessionYmd, nowMs: now });

  const maxDays = settings.reservationMaxDays;
  const maxDate = maxDays !== null ? addDaysYmd(isValidYmd(sessionYmd) ? sessionYmd : today, maxDays) : '';
  const discount = settings.listPrice !== null && config.finalPrice ? settings.listPrice - config.finalPrice : null;
  const sceneOn = sceneOrder(ws.diagnosis.prep_config).find((s) => s.id === 'bolsa')?.enabled ?? false;

  return (
    <PrepCard
      id={PREP_SECTION.offer}
      icon={BadgePercent}
      title="Oferta (cena da bolsa)"
      description="A cena da bolsa só abre se o lead pedir, depois de dizer o custo de ficar como está, e nunca para quem está cursando."
    >
      {!api.model.eligible && <Notice tone="warn">Cursando graduação: a cena da bolsa não abre nesta call.</Notice>}
      {!sceneOn && <Notice>A cena da bolsa está desligada na tela do lead. Ligue em &quot;Tela do lead&quot; se quiser usar.</Notice>}

      <OfferFacts settings={settings} nowMs={now} />
      <ProblemList items={problems.seats} />

      <div className="space-y-3 border-t border-border/60 pt-4">
        <PrepSubheading>O que você monta</PrepSubheading>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="prep-offer-final"
            label="Valor com bolsa (R$)"
            hint={discount !== null && discount > 0 ? `Bolsa de ${formatBRL(discount)} sobre a tabela.` : 'O que ele investe com a bolsa.'}
          >
            <DecimalInput
              id="prep-offer-final"
              value={config.finalPrice}
              onCommit={(v) => setOffer({ finalPrice: v })}
              cents
              maxDecimals={2}
              min={0}
              placeholder="Ex.: 8.997,00"
              disabled={readOnly}
            />
          </Field>
          <Field
            id="prep-offer-valid"
            label="Validade da condição"
            hint={
              maxDays === null
                ? 'A Head não cadastrou prazo máximo de reserva: nenhuma validade aparece.'
                : `Até ${ymdToBR(maxDate)} (${maxDays} ${maxDays === 1 ? 'dia' : 'dias'} da sessão). Data fixa, sem contagem regressiva.`
            }
          >
            <div className="flex items-center gap-2">
              <Input
                id="prep-offer-valid"
                type="date"
                value={config.validUntil ?? ''}
                // Validade antes do dia da sessao some na call: o minimo e o dia da sessao.
                min={isValidYmd(sessionYmd) && sessionYmd > today ? sessionYmd : today}
                max={maxDate || undefined}
                onChange={(e) => setOffer({ validUntil: e.target.value || null })}
                disabled={readOnly || maxDays === null}
                className="h-9 w-[170px]"
              />
              {config.validUntil && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setOffer({ validUntil: null })}
                  disabled={readOnly}
                  aria-label="Tirar a validade"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Field>
        </div>
        <ProblemList items={problems.price} />
        <ProblemList items={problems.validity} />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Formas de pagamento (até 3)</p>
          <PaymentPathsEditor api={api} problems={problems} />
        </div>

        <div className="space-y-3 rounded-md border border-border/60 p-3">
          <SwitchRow
            id="prep-offer-anchor"
            label="Mostrar o preço de tabela"
            hint={settings.listPrice === null ? 'Sem preço de tabela cadastrado: não aparece.' : 'A âncora antes do valor com bolsa.'}
            checked={config.showAnchor}
            onChange={(v) => setOffer({ showAnchor: v })}
            disabled={readOnly}
          />
          <SwitchRow
            id="prep-offer-seats"
            label="Mostrar as bolsas restantes"
            hint="Só aparece com número confirmado pela Head."
            checked={config.showSeats}
            onChange={(v) => setOffer({ showSeats: v })}
            disabled={readOnly}
          />
          <SwitchRow
            id="prep-offer-validity"
            label="Mostrar a validade"
            hint="Só aparece com data dentro do prazo da Head."
            checked={config.showValidity}
            onChange={(v) => setOffer({ showValidity: v })}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <PrepSubheading>Como aparece para o lead</PrepSubheading>
        <OfferPreview api={api} />
      </div>
    </PrepCard>
  );
}
