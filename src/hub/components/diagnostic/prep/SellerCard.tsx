import { BookmarkCheck, IdCard, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Json } from '@/integrations/supabase/types';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { useSaveSellerPreset, useSellerPreset } from '@/hooks/useDiagnosticData';
import { normalizePrepConfig, patchDiagnosis, type DiagnosisFields } from '@/lib/diagnostic/workspace';
import { applySellerPreset, hasPhone, sellerPresetPayload } from '@/lib/diagnostic/prepChecklist';
import { PREP_SECTION } from './anchors';
import { Field } from './fields';
import { PrepCard } from './PrepCard';

const warn = (text: string) => <span className="text-amber-400">{text}</span>;

/** Nome e WhatsApp que vao no diagnostico, e o padrao do vendedor para as proximas sessoes. */
export function SellerCard({ api }: { api: ReadyWorkspace }) {
  const { ws } = api;
  const d = ws.diagnosis;
  // Nome e WhatsApp vao no PDF: depois de enviado ficam travados.
  const locked = !api.canEdit || api.frozen;
  const presetQuery = useSellerPreset();
  const savePreset = useSaveSellerPreset();
  const preset = presetQuery.data ?? null;

  const setD = (p: Partial<DiagnosisFields>) => api.update((w) => patchDiagnosis(w, p));
  const save = () => {
    const payload = sellerPresetPayload(ws);
    savePreset.mutate({ ...payload, prep_config: payload.prep_config as unknown as Json });
  };
  const applyPreset = () => {
    if (!preset) return;
    api.update((w) => applySellerPreset(w, preset, { frozen: api.frozen }));
    toast.success(
      api.frozen ? 'Padrão aplicado nas cenas e na oferta. Nome e WhatsApp ficam como o lead recebeu.' : 'Padrão aplicado nesta sessão.',
    );
  };

  const presetPrep = preset ? normalizePrepConfig(preset.prep_config) : null;
  const presetSummary = preset
    ? [
        preset.display_name || 'sem nome',
        preset.whatsapp || 'sem WhatsApp',
        `${presetPrep?.offer.paths.length ?? 0} ${presetPrep?.offer.paths.length === 1 ? 'forma' : 'formas'} de pagamento`,
        presetPrep?.scenes.length ? 'cenas do seu jeito' : 'cenas no padrão',
      ].join(' · ')
    : null;

  return (
    <PrepCard
      id={PREP_SECTION.seller}
      icon={IdCard}
      title="Seus dados no diagnóstico"
      description="Vão no PDF e no encerramento da tela do lead, para ele saber com quem falar."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="prep-seller-name" label="Seu nome">
          <Input
            id="prep-seller-name"
            value={d.consultant_name}
            onChange={(e) => setD({ consultant_name: e.target.value })}
            disabled={locked}
            className="h-9"
          />
        </Field>
        <Field
          id="prep-seller-whatsapp"
          label="Seu WhatsApp"
          hint={d.consultant_whatsapp.trim() && !hasPhone(d.consultant_whatsapp) ? warn('Confira o número: DDD e número.') : undefined}
        >
          <Input
            id="prep-seller-whatsapp"
            value={d.consultant_whatsapp}
            inputMode="tel"
            placeholder="(11) 90000-0000"
            onChange={(e) => setD({ consultant_whatsapp: e.target.value })}
            disabled={locked}
            className="h-9"
          />
        </Field>
      </div>

      <div className="rounded-md border border-border/60 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Seu padrão guarda nome, WhatsApp, as cenas e as formas de pagamento. Nunca o valor com bolsa nem a validade, que são
          de cada sessão.
        </p>
        {presetSummary && <p className="text-xs text-foreground">Seu padrão: {presetSummary}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={save}
            disabled={!api.canEdit || savePreset.isPending}
          >
            {savePreset.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar como meu padrão
          </Button>
          {preset && (
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={applyPreset} disabled={!api.canEdit}>
              <BookmarkCheck className="h-3.5 w-3.5" /> Usar meu padrão
            </Button>
          )}
        </div>
      </div>
    </PrepCard>
  );
}
