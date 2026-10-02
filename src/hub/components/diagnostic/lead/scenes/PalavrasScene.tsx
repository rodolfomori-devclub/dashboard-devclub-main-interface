import type { PalavrasVM } from '@/lib/diagnostic/presentation';
import { quoteSizeClass } from '../format';
import { Eyebrow } from '../parts';

/** O custo de ficar parado, dito por ele. Nenhuma projecao da ferramenta. */
export function PalavrasScene({ scene }: { scene: PalavrasVM }) {
  return (
    <div className="lead-center">
      <Eyebrow>Nas suas palavras</Eyebrow>
      <blockquote className={`lead-bigquote ${quoteSizeClass(scene.quote)}`}>
        <span className="lead-qm">“</span>
        {scene.quote}
        <span className="lead-qm">”</span>
      </blockquote>
    </div>
  );
}
