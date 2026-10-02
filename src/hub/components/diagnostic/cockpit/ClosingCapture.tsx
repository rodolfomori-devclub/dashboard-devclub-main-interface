import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { HandCoins, Lock, Undo2, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { pathPairs } from '@diag/archetype.ts';
import { formatBRL } from '@diag/dates.ts';
import type { Graduation } from '@diag/types.ts';
import { cancelOfferRequest, graduationPending, offerRequestBlocked, requestOffer, setChecked } from '@/lib/diagnostic/cockpit';
import { sceneStatus } from '@/lib/diagnostic/leadView';
import { hasOfferShown } from '@/lib/diagnostic/presentationEffects';
import { diagnosticPaths } from '@/lib/diagnostic/routes';
import { patchCallData, patchLead } from '@/lib/diagnostic/workspace';
import { nowIso, useCockpit } from './cockpitContext';
import { DifferentialsList } from './NeedCapture';
import { ChoiceButton, Note, SectionLabel } from './parts';

const TIME_SP = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

const GRADUATION_CHOICES: { value: Exclude<Graduation, ''>; label: string }[] = [
  { value: 'concluida', label: 'Concluída' },
  { value: 'nao', label: 'Não tem' },
  { value: 'cursando', label: 'Cursando' },
];

/** Pitch e proximo passo sem graduacao confirmada: perguntar e marcar aqui, sem sair da call. */
export function GraduationGate() {
  const { api, block, readOnly, write } = useCockpit();
  if (!graduationPending(block.id, api.ws.lead.graduation_status)) return null;
  return (
    <Note tone="warn" className="space-y-2">
      <p className="font-medium">Confirme a graduação antes de falar da pós ou da bolsa: ela define o que pode ser mostrado.</p>
      <div role="radiogroup" aria-label="Graduação dele" className="flex flex-wrap gap-2">
        {GRADUATION_CHOICES.map((o) => (
          <ChoiceButton
            key={o.value}
            selected={false}
            disabled={readOnly}
            onClick={() => write((w) => patchLead(w, { graduation_status: o.value }))}
            className="px-3 py-1 text-xs"
          >
            {o.label}
          </ChoiceButton>
        ))}
      </div>
    </Note>
  );
}

function FlagSwitch({ id, itemId, checked, label }: { id: string; itemId: string; checked: boolean; label: string }) {
  const { readOnly, write } = useCockpit();
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={readOnly}
        onCheckedChange={(v) => write((w) => setChecked(w, itemId, v, nowIso()))}
      />
    </div>
  );
}

/** Implicacao: o custo de ficar como esta, dito por ele (destrava a bolsa). */
export function CostCapture() {
  const { api } = useCockpit();
  return (
    <div className="space-y-2">
      <FlagSwitch
        id="cockpit-cost-stated"
        itemId="custo"
        checked={api.ws.diagnosis.call_data.costStated}
        label="Ele disse o custo de ficar como está"
      />
      <p className="text-xs text-muted-foreground">
        Guarde a frase dele sobre daqui a um ano no campo de frases (marca "Custo de ficar parado"): ela abre a cena "Nas suas
        palavras".
      </p>
    </div>
  );
}

/** Pitch leve: permissao para o caminho completo e a previa dos pares trava -> como a pos resolve. */
export function PitchCapture() {
  const { api } = useCockpit();
  const { ws, model, content } = api;
  const cd = ws.diagnosis.call_data;
  const pairs = useMemo(
    () => pathPairs(content, model, cd.needPriority, ws.lead.graduation_status),
    [content, model, cd.needPriority, ws.lead.graduation_status],
  );
  if (!model.eligible) return <Note tone="warn">Não apresente a pós para quem está cursando graduação.</Note>;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <FlagSwitch
          id="cockpit-path-permitted"
          itemId="permissao_caminho"
          checked={cd.pathPermitted}
          label="Ele topou ver o caminho completo"
        />
        <p className="text-xs text-muted-foreground">Com a permissão, a cena "Caminho completo" abre na Tela do lead.</p>
      </div>
      <div className="space-y-2">
        <SectionLabel>Prévia do caminho: a trava dele e como a pós resolve</SectionLabel>
        {pairs.length ? (
          <ul className="space-y-1.5">
            {pairs.map((p) => (
              <li key={p.pillarId ?? p.label} className="rounded-md bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{p.label}:</span> {p.resolves}
              </li>
            ))}
          </ul>
        ) : (
          <Note>Os pares aparecem quando as 5 notas estiverem dadas.</Note>
        )}
      </div>
      <DifferentialsList title="Diferenciais ligados às travas dele" />
    </div>
  );
}

function OfferSummary() {
  const { api } = useCockpit();
  const { view, problems } = api.offer;
  const rows: [string, string][] = [];
  if (view.anchor != null) rows.push(['Preço de tabela', formatBRL(view.anchor)]);
  if (view.finalPrice != null) rows.push(['Valor com bolsa', formatBRL(view.finalPrice)]);
  if (view.discount != null) rows.push(['Bolsa', formatBRL(view.discount)]);
  for (const p of view.paths) {
    rows.push([p.label, p.installments > 1 ? `${p.installments}x de ${formatBRL(p.installmentValue)}` : formatBRL(p.total)]);
  }
  if (view.seatsLeft != null) {
    rows.push(['Bolsas restantes', `${view.seatsLeft}${view.seatsConfirmedOnBR ? ` (confirmado em ${view.seatsConfirmedOnBR})` : ''}`]);
  }
  if (view.validUntilBR) rows.push(['Condição válida até', view.validUntilBR]);

  return (
    <div className="space-y-2">
      <SectionLabel>Oferta montada na preparação</SectionLabel>
      {rows.length ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/30 px-3 py-2 text-sm">
          {rows.map(([label, value], i) => (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Note>
          Nenhuma condição montada.{' '}
          <Link to={diagnosticPaths.prep(api.ws.ids.sessionId)} className="text-primary underline-offset-2 hover:underline">
            Montar na preparação
          </Link>
        </Note>
      )}
      {problems.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-400">
          {problems.map((p, i) => (
            <li key={`${p.code}-${i}`}>{p.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Proximo passo com permissao: bolsa so se ele pedir, depois de dizer o custo. */
export function NextStepCapture() {
  const { api, readOnly, write } = useCockpit();
  const { ws, model, content, offer } = api;
  const d = ws.diagnosis;
  const choice = d.call_data.nextStepChoice;
  const soldOut = offer.view.soldOut;
  const bolsa = useMemo(() => sceneStatus({ ws, model, content, offer }).bolsa, [ws, model, content, offer]);
  const bolsaOpen = bolsa.enabled && bolsa.ready;
  const requestBlocked = offerRequestBlocked(ws.lead.graduation_status, soldOut);

  if (!model.eligible) {
    return <Note>Cursando graduação: caminho único, sem pós e sem bolsa. Feche com a data do compromisso.</Note>;
  }
  // Mesmo caminho unico que a tela do lead mostra ate a graduacao ser confirmada.
  if (graduationPending('proximo', ws.lead.graduation_status)) {
    return <Note>Graduação não confirmada: caminho único, sem bolsa. Confirme a graduação para ver as opções do próximo passo.</Note>;
  }
  if (soldOut) {
    return <Note tone="warn">Sem bolsas restantes nesta turma: caminho único, sem bolsa. Feche com a data do compromisso.</Note>;
  }
  // Desfazer o pedido so vale ate a oferta aparecer na tela do lead.
  const canUndoRequest = !!d.offer_requested_at && !hasOfferShown(d.offer_shown) && !readOnly;
  const options = [
    { id: 'bolsa' as const, label: 'Quer ver a bolsa agora' },
    { id: 'esperar' as const, label: 'Prefere conversar no dia do compromisso' },
  ];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SectionLabel>O que ele preferiu</SectionLabel>
        <div role="radiogroup" aria-label="O que ele preferiu" className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <ChoiceButton
              key={o.id}
              selected={choice === o.id}
              disabled={readOnly}
              onClick={() => write((w) => patchCallData(w, { nextStepChoice: choice === o.id ? null : o.id }))}
            >
              {o.label}
            </ChoiceButton>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={d.offer_requested_at ? 'outline' : 'default'}
            disabled={readOnly || !!d.offer_requested_at || requestBlocked !== null}
            onClick={() => write((w) => requestOffer(w, nowIso(), soldOut))}
          >
            <HandCoins />
            {d.offer_requested_at
              ? `Pedido registrado às ${TIME_SP.format(new Date(d.offer_requested_at))}`
              : 'Ele pediu para ver a bolsa'}
          </Button>
          {canUndoRequest && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              title="Registrou por engano? Dá para desfazer até a bolsa aparecer na tela do lead."
              onClick={() => write(cancelOfferRequest)}
            >
              <Undo2 />
              Desfazer pedido
            </Button>
          )}
        </div>
        <p className={cn('flex items-start gap-1.5 text-xs', bolsaOpen ? 'text-emerald-400' : 'text-muted-foreground')}>
          {bolsaOpen ? <Unlock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {bolsaOpen
            ? 'Cena da bolsa liberada na Tela do lead.'
            : requestBlocked ??
              (bolsa.enabled ? bolsa.reason : 'A cena da bolsa está desligada na preparação.')}
        </p>
      </div>
      <OfferSummary />
    </div>
  );
}
