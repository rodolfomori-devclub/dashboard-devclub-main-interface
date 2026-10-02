import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDiagnosticSettings, useUpdateDiagnosticSettings, type DiagnosticSettingsPatch } from '@/hooks/useDiagnosticData';
import { errorText, isNetworkError } from '@/lib/diagnostic/errors';
import { diagnosticPaths } from '@/lib/diagnostic/routes';
import { formatBRL } from '@diag/dates.ts';
import { seatsInfo } from '@diag/offer.ts';
import type { OfferSettings } from '@diag/types.ts';
import { DiagnosticScope } from '@/components/diagnostic/DiagnosticScope';

interface Form {
  cohortName: string;
  listPrice: string;
  scholarshipMax: string;
  seatsTotal: string;
  seatsGranted: string;
  seatsFreshDays: string;
  reservationMaxDays: string;
}

type Key = keyof Form;

interface Parsed {
  cohortName: string;
  listPrice: number | null;
  scholarshipMax: number | null;
  seatsTotal: number | null;
  seatsGranted: number | null;
  seatsFreshDays: number | null;
  reservationMaxDays: number | null;
}

/** form: o que esta nos campos. base: o que o banco tinha quando a Head comecou a editar cada campo. */
interface Draft {
  form: Form;
  base: Form;
}

const KEYS: Key[] = ['cohortName', 'listPrice', 'scholarshipMax', 'seatsTotal', 'seatsGranted', 'seatsFreshDays', 'reservationMaxDays'];
const SEAT_KEYS: Key[] = ['seatsTotal', 'seatsGranted'];

/** "20.000,00", "20000", "R$ 19.900" -> numero; '' -> null; invalido -> NaN. */
function parseMoney(raw: string): number | null {
  let s = raw.replace(/R\$|\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function parseIntField(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

function parseForm(f: Form): Parsed {
  return {
    cohortName: f.cohortName.trim(),
    listPrice: parseMoney(f.listPrice),
    scholarshipMax: parseMoney(f.scholarshipMax),
    seatsTotal: parseIntField(f.seatsTotal),
    seatsGranted: parseIntField(f.seatsGranted),
    seatsFreshDays: parseIntField(f.seatsFreshDays),
    reservationMaxDays: parseIntField(f.reservationMaxDays),
  };
}

const toText = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

function formFrom(r: OfferSettings): Form {
  return {
    cohortName: r.cohortName,
    listPrice: toText(r.listPrice),
    scholarshipMax: toText(r.scholarshipMax),
    seatsTotal: toText(r.seatsTotal),
    seatsGranted: String(r.seatsGranted),
    seatsFreshDays: String(r.seatsFreshDays),
    reservationMaxDays: toText(r.reservationMaxDays),
  };
}

const seed = (r: OfferSettings): Draft => {
  const f = formFrom(r);
  return { form: f, base: f };
};

/** Campo que a Head nao mexeu acompanha o banco: um "Fechou" soma 1 nas concedidas com a pagina aberta. */
function follow(d: Draft, fresh: Form): Draft {
  const form = { ...d.form };
  const base = { ...d.base };
  let moved = false;
  for (const k of KEYS) {
    if (form[k] === base[k] && base[k] !== fresh[k]) {
      form[k] = base[k] = fresh[k];
      moved = true;
    }
  }
  return moved ? { form, base } : d;
}

/** So as colunas pedidas: o que fica de fora continua como esta no banco. */
function toPatch(keys: Key[], v: Parsed): DiagnosticSettingsPatch {
  const has = (k: Key) => keys.includes(k);
  const p: DiagnosticSettingsPatch = {};
  if (has('cohortName')) p.cohort_name = v.cohortName;
  if (has('listPrice')) p.list_price = v.listPrice;
  if (has('scholarshipMax')) p.scholarship_max = v.scholarshipMax;
  if (has('seatsTotal')) p.seats_total = v.seatsTotal;
  if (has('seatsGranted')) p.seats_granted = v.seatsGranted ?? 0;
  if (has('seatsFreshDays')) p.seats_fresh_days = v.seatsFreshDays ?? 3;
  if (has('reservationMaxDays')) p.reservation_max_days = v.reservationMaxDays;
  return p;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-400">{error}</p> : <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

function DiagnosticSettingsScreen() {
  const { data, error, isFetching, isRefetchError, refetch } = useDiagnosticSettings();
  const save = useUpdateDiagnosticSettings();
  const [draft, setDraft] = useState<Draft | null>(() => (data ? seed(data.offer) : null));
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null);

  useEffect(() => {
    if (!data) return;
    const fresh = formFrom(data.offer);
    setDraft((d) => (d ? follow(d, fresh) : { form: fresh, base: fresh }));
  }, [data]);

  if (!data || !draft) {
    return (
      <div className="page-container flex justify-center py-16">
        {!data && error ? (
          <div className="glass-card p-6 text-sm space-y-3 w-full max-w-md">
            <p className="text-red-400">Não deu para carregar as configurações.</p>
            <p className="text-xs text-muted-foreground">{isNetworkError(error) ? 'Sem conexão com o servidor.' : errorText(error)}</p>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
              {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
              Tentar de novo
            </Button>
          </div>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  const { form } = draft;
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDraft((d) => (d ? { ...d, form: { ...d.form, [k]: value } } : d));
  };

  const v = parseForm(form);
  const b = parseForm(draft.base);
  const { listPrice, scholarshipMax, seatsTotal, seatsGranted, seatsFreshDays: freshDays, reservationMaxDays } = v;

  const errors = {
    listPrice: Number.isNaN(listPrice) || (listPrice !== null && listPrice <= 0) ? 'Use um valor maior que zero, ou deixe vazio.' : null,
    scholarshipMax:
      Number.isNaN(scholarshipMax) || (scholarshipMax !== null && scholarshipMax < 0)
        ? 'Use um valor válido, ou deixe vazio.'
        : listPrice && scholarshipMax !== null && scholarshipMax >= listPrice
          ? 'A bolsa máxima precisa ser menor que o preço de tabela.'
          : null,
    seatsTotal: Number.isNaN(seatsTotal) ? 'Use um número inteiro, ou deixe vazio.' : null,
    seatsGranted:
      seatsGranted === null || Number.isNaN(seatsGranted)
        ? 'Use um número inteiro (0 se nenhuma).'
        : seatsTotal !== null && !Number.isNaN(seatsTotal) && seatsGranted > seatsTotal
          ? 'Concedidas não pode passar do total da turma.'
          : null,
    freshDays: freshDays === null || Number.isNaN(freshDays) || freshDays < 1 || freshDays > 7 ? 'Entre 1 e 7 dias.' : null,
    reservationMaxDays:
      Number.isNaN(reservationMaxDays) || (reservationMaxDays !== null && (reservationMaxDays < 1 || reservationMaxDays > 30))
        ? 'Entre 1 e 30 dias, ou vazio.'
        : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const seatsInvalid = Boolean(errors.seatsTotal || errors.seatsGranted);

  // Mudou = difere do que a Head tinha na tela ao editar; so isso vai para o banco.
  const changed = (k: Key) => v[k] !== b[k];
  const dirty = KEYS.some(changed);
  const seatsEdited = SEAT_KEYS.some(changed);

  const current = data.offer;
  const seats = seatsInfo(current, Date.now());

  const submit = async (mode: 'save' | 'confirm') => {
    const confirmOnly = mode === 'confirm';
    if (busy || (confirmOnly ? seatsInvalid || seatsTotal === null : invalid || !dirty)) return;
    // "Confirmar" leva so o bloco das bolsas; o resto do form segue em edicao.
    const scope = confirmOnly ? SEAT_KEYS : KEYS;
    const patch = toPatch(scope.filter(changed), v);
    // Quem muda os numeros de bolsa esta confirmando os numeros de agora.
    patch.confirmSeats = confirmOnly || (seatsEdited && seatsTotal !== null);
    const sent = form;
    setBusy(mode);
    try {
      await save.mutateAsync(patch);
      const savedAt = Date.now();
      // O hook so dispara o refetch: esperar o dado novo, nunca refazer o form com o cache de antes.
      const res = await refetch();
      const fresh = res.data && res.dataUpdatedAt >= savedAt ? formFrom(res.data.offer) : null;
      setDraft((d) => {
        if (!d) return d;
        const next = { form: { ...d.form }, base: { ...d.base } };
        for (const k of scope) {
          if (d.form[k] !== sent[k]) continue; // digitado durante o salvamento: segue em edicao
          // Sem o dado novo (refetch falhou), o banco tem o que acabou de ser enviado.
          next.form[k] = next.base[k] = fresh ? fresh[k] : sent[k];
        }
        return next;
      });
    } catch {
      // useUpdateDiagnosticSettings ja avisou o erro.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-container space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="hover:bg-accent/50">
          <Link to={diagnosticPaths.sessions} aria-label="Voltar para as sessões">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="page-title">Configurações do diagnóstico</h2>
          <p className="page-subtitle">Fatos da turma que a tela do lead pode citar. Sem número aqui, a tela não fala de vagas, preço ou prazo.</p>
        </div>
      </div>

      {isRefetchError && (
        <div className="rounded-md border border-amber-500/40 p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="flex-1 text-amber-400">Não deu para recarregar as configurações: os números abaixo podem estar desatualizados.</span>
          <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => refetch()} disabled={isFetching || busy !== null}>
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            Tentar de novo
          </Button>
        </div>
      )}

      <section className="glass-card p-5 space-y-4">
        <h3 className="section-title">Turma e bolsas</h3>
        <Field id="cohort" label="Turma" hint="Uso interno, para saber a que turma os números se referem.">
          <Input id="cohort" value={form.cohortName} onChange={set('cohortName')} placeholder="Ex.: Turma de novembro" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field id="seats-total" label="Bolsas da turma" hint="Vazio: a tela não fala de bolsas limitadas." error={errors.seatsTotal}>
            <Input id="seats-total" inputMode="numeric" value={form.seatsTotal} onChange={set('seatsTotal')} />
          </Field>
          <Field id="seats-granted" label="Bolsas concedidas" hint='Cada "Fechou" marcado na entrega soma 1 aqui.' error={errors.seatsGranted}>
            <Input id="seats-granted" inputMode="numeric" value={form.seatsGranted} onChange={set('seatsGranted')} />
          </Field>
        </div>
        <Field
          id="fresh-days"
          label="Validade da confirmação (dias)"
          hint="Passado esse prazo sem confirmar, o número de bolsas some da tela do lead."
          error={errors.freshDays}
        >
          <Input id="fresh-days" inputMode="numeric" value={form.seatsFreshDays} onChange={set('seatsFreshDays')} className="max-w-[120px]" />
        </Field>
        <div className="rounded-md border border-border/60 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 text-sm">
            {current.seatsTotal === null ? (
              <span className="text-muted-foreground">Total de bolsas não informado.</span>
            ) : (
              <>
                <div className="text-foreground">
                  Restantes agora: <strong>{seats.left}</strong>
                </div>
                {current.seatsConfirmedAt ? (
                  <div className={`text-xs flex items-center gap-1 mt-0.5 ${seats.fresh ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {seats.fresh ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                    Confirmado em {DATE_TIME.format(new Date(current.seatsConfirmedAt))}
                    {seats.fresh ? '' : ': vencido, a tela do lead não mostra o número'}
                  </div>
                ) : (
                  <div className="text-xs text-amber-400 mt-0.5">Nunca confirmado: a tela do lead não mostra o número.</div>
                )}
              </>
            )}
            {seatsEdited && (
              <div className="text-xs text-muted-foreground mt-1">Os números digitados ainda não foram salvos: confirmar já salva.</div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={seatsTotal === null || seatsInvalid || busy !== null}
            onClick={() => submit('confirm')}
          >
            {busy === 'confirm' && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar números de hoje
          </Button>
        </div>
      </section>

      <section className="glass-card p-5 space-y-4">
        <h3 className="section-title">Oferta</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            id="list-price"
            label="Preço de tabela (R$)"
            hint={listPrice && !Number.isNaN(listPrice) ? `${formatBRL(listPrice)}. Âncora da cena da bolsa.` : 'Âncora da cena da bolsa. Vazio: não aparece.'}
            error={errors.listPrice}
          >
            <Input id="list-price" inputMode="decimal" value={form.listPrice} onChange={set('listPrice')} placeholder="Ex.: 20.000,00" />
          </Field>
          <Field
            id="scholarship-max"
            label="Bolsa máxima (R$)"
            hint="Maior desconto sobre o preço de tabela. A preparação avisa quando o vendedor passar."
            error={errors.scholarshipMax}
          >
            <Input id="scholarship-max" inputMode="decimal" value={form.scholarshipMax} onChange={set('scholarshipMax')} />
          </Field>
        </div>
        <Field
          id="reservation-days"
          label="Prazo máximo de reserva (dias)"
          hint="Limite da data de validade que o vendedor escolhe. Vazio: nenhuma tela cita validade."
          error={errors.reservationMaxDays}
        >
          <Input id="reservation-days" inputMode="numeric" value={form.reservationMaxDays} onChange={set('reservationMaxDays')} className="max-w-[120px]" />
        </Field>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setDraft(seed(current))} disabled={busy !== null}>
          Descartar
        </Button>
        <Button type="button" onClick={() => submit('save')} disabled={invalid || !dirty || busy !== null} className="gap-2">
          {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

export default function DiagnosticSettings() {
  return (
    <DiagnosticScope>
      <DiagnosticSettingsScreen />
    </DiagnosticScope>
  );
}
