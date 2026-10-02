import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { ISSUE_ANCHOR, lessonUrlProblem, usablePhone } from '@/lib/diagnostic/send';
import { patchDiagnosis, type DiagnosisFields } from '@/lib/diagnostic/workspace';
import { findForbidden } from '@diag/guardrails.ts';
import { useLatch } from './hooks';
import { SubSection, WarnNote } from './StepCard';

interface Props {
  api: ReadyWorkspace;
  readOnly: boolean;
}

/**
 * Causa raiz do PDF: o texto do perfil (confirmado ou sugerido pela aplicacao)
 * ou um texto do consultor (verificado, sem travar). Sem perfil, so o texto dele.
 */
export function RootCauseField({ api, readOnly }: Props) {
  const { ws, model, content } = api;
  // Foto enviada antes de existir archetypeSource conta como perfil (era o texto que ia).
  const profile = model.archetypeSource === 'none' ? null : (model.archetype ?? null);
  const profileText = profile?.causa_raiz ?? '';
  const own = ws.diagnosis.root_cause_override;
  const forbidden = own.trim() ? findForbidden(own, content.guardrails) : [];
  const set = (root_cause_override: string) => api.update((w) => patchDiagnosis(w, { root_cause_override }));

  let action: ReactNode = null;
  if (!readOnly && own && profileText) {
    action = (
      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => set('')}>
        Voltar ao texto do perfil
      </Button>
    );
  } else if (!readOnly && !own && profileText) {
    action = (
      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => set(profileText)}>
        Ajustar com as suas palavras
      </Button>
    );
  }

  let note = 'Texto seu.';
  if (!own.trim() && profile) {
    const origin = model.archetypeSource === 'suggested' ? ', sugerido pela aplicação e ainda não confirmado' : '';
    note = `Em branco, vai o texto do perfil ${profile.nome}${origin}.`;
  }

  return (
    <SubSection id={ISSUE_ANCHOR.rootCause} title="Causa raiz" hint='Vai no PDF, em "O que está te travando".' action={action}>
      <Textarea
        aria-label="Causa raiz"
        value={own}
        onChange={(e) => set(e.target.value)}
        placeholder={profileText || 'O que está travando, com as suas palavras.'}
        rows={4}
        disabled={readOnly}
        className="text-sm"
      />
      {!own.trim() && !profile ? (
        <p className="text-xs text-amber-400">
          Sem perfil confirmado nem sugerido: escreva a causa raiz com as suas palavras. Sem ela, o PDF não sai.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{note}</p>
      )}
      {forbidden.length > 0 && <WarnNote>Vai para o diagnóstico do lead. Evite: {forbidden.join(', ')}.</WarnNote>}
    </SubSection>
  );
}

/**
 * Nome e WhatsApp do consultor, so quando o nome faltava (ficam na tela ate o
 * fim para corrigir). Vao no PDF: "fale com {nome} no WhatsApp {numero}".
 */
export function ConsultantFields({ api, readOnly }: Props) {
  const d = api.ws.diagnosis;
  const show = useLatch(!d.consultant_name.trim() || api.issues.some((i) => i.field === 'consultant'));
  if (!show) return null;

  const set = (p: Partial<DiagnosisFields>) => api.update((w) => patchDiagnosis(w, p));
  const phone = d.consultant_whatsapp;
  const phoneOff = phone.trim() !== '' && !usablePhone(phone);

  return (
    <SubSection id={ISSUE_ANCHOR.consultant} title="Consultor" hint="Vão no PDF, para o lead saber com quem falar.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="send-consultant-name">Nome do consultor</Label>
          <Input
            id="send-consultant-name"
            value={d.consultant_name}
            onChange={(e) => set({ consultant_name: e.target.value })}
            placeholder="Nome e sobrenome"
            disabled={readOnly}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="send-consultant-whatsapp">WhatsApp do consultor</Label>
          <Input
            id="send-consultant-whatsapp"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => set({ consultant_whatsapp: e.target.value })}
            placeholder="(11) 90000-0000"
            disabled={readOnly}
            autoComplete="off"
          />
          <p className={phoneOff ? 'text-xs text-amber-400' : 'text-xs text-muted-foreground'}>
            {phoneOff ? 'Confira o número: DDD e número.' : 'Opcional. Sem ele, o PDF traz só o nome.'}
          </p>
        </div>
      </div>
    </SubSection>
  );
}

/** Link da aula da area: com link vai a aula (2 paginas); sem, o kit de prompts (3 paginas). */
export function LessonUrlField({ api, readOnly }: Props) {
  const { ws, model } = api;
  const value = ws.diagnosis.lesson_url_override;
  const problem = lessonUrlProblem(value);
  const material = model.material;
  const outcome =
    material.type === 'aula'
      ? `Vai a aula${material.lessonTitle ? ` "${material.lessonTitle}"` : ''} e o PDF fica com 2 páginas.`
      : `Sem link de aula, o PDF leva o kit de 3 prompts para ${material.areaLabel} na página 3.`;

  return (
    <SubSection id="send-lesson" title="Aula da área" hint="Só cole o link se a aula já estiver publicada.">
      <Input
        type="url"
        inputMode="url"
        aria-label="Link da aula da área"
        value={value}
        onChange={(e) => api.update((w) => patchDiagnosis(w, { lesson_url_override: e.target.value }))}
        placeholder="https://"
        disabled={readOnly}
        autoComplete="off"
      />
      {problem ? <p className="text-xs text-red-400">{problem}</p> : <p className="text-xs text-muted-foreground">{outcome}</p>}
    </SubSection>
  );
}
