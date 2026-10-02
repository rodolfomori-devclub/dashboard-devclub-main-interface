import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Gift } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchDiagnosis } from '@/lib/diagnostic/workspace';
import { isHttpUrl } from '@/lib/diagnostic/prepChecklist';
import { materialPhrases } from '@diag/texts.ts';
import { Field } from './fields';
import { PrepSubheading } from './PrepCard';

/** Material de presente: aula so com link; sem link, o kit de 3 prompts da area. */
export function MaterialSection({ api }: { api: ReadyWorkspace }) {
  const { ws, model } = api;
  const material = model.material;
  const saved = ws.diagnosis.lesson_url_override;
  // lesson_url_override vai no PDF: depois de enviado fica travado.
  const locked = !api.canEdit || api.frozen;
  const [draft, setDraft] = useState(saved);
  const editingRef = useRef(false);

  // Mudou por fora (outra janela): mostra o novo, a menos que esteja digitando.
  useEffect(() => {
    if (!editingRef.current) setDraft(saved);
  }, [saved]);

  const clean = draft.trim();
  const invalid = clean !== '' && !isHttpUrl(clean);

  // Grava so link valido (ou vazio): o PDF leva o link como esta. Link invalido
  // fica na tela com o aviso, sem trocar o que estava salvo.
  const commit = () => {
    editingRef.current = false;
    if (invalid || clean === saved) return;
    api.update((w) => patchDiagnosis(w, { lesson_url_override: clean }));
  };

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <PrepSubheading>Material de presente</PrepSubheading>
      <div className="rounded-md border border-border/60 p-3 space-y-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Gift className="h-4 w-4 text-muted-foreground shrink-0" />
          {materialPhrases(model).gift}
        </p>
        {material.type === 'aula' && material.lessonUrl ? (
          <a
            href={material.lessonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all"
          >
            <ExternalLink className="h-3 w-3 shrink-0" /> {material.lessonUrl}
          </a>
        ) : (
          <>
            <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-0.5">
              {material.kit.map((k) => (
                <li key={k.titulo}>{k.titulo}</li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              Vai na página 3 do diagnóstico.
              {material.lessonTitle ? ` A aula "${material.lessonTitle}" ainda não tem link.` : ''}
            </p>
          </>
        )}
      </div>
      <Field
        id="prep-lesson-url"
        label="Link da aula, se já tiver"
        error={invalid ? 'Use um link completo, começando com https://. Enquanto isso, vale o que já estava.' : null}
        hint="Com link, vai a aula no lugar do kit e o diagnóstico fica com 2 páginas."
      >
        <Input
          id="prep-lesson-url"
          type="url"
          value={draft}
          placeholder="https://"
          onFocus={() => {
            editingRef.current = true;
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          disabled={locked}
          aria-invalid={invalid || undefined}
          className="h-9"
        />
      </Field>
    </div>
  );
}
