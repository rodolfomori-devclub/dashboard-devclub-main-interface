import { PdfPreview } from '@/components/diagnostic/PdfPreview';
import { useCockpit } from './cockpitContext';

/** A previa do que a pessoa recebe, atualizando enquanto a call anda. */
export function PdfView() {
  const { api } = useCockpit();
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      {api.issues.length > 0 && !api.frozen && (
        <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <p className="font-medium">Para enviar ainda falta:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {api.issues.map((issue) => (
              <li key={issue.field}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
      <PdfPreview model={api.model} className="h-[calc(100vh-8.5rem)] min-h-[480px]" />
    </div>
  );
}
