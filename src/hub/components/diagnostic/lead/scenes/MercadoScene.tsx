import type { MercadoVM } from '@/lib/diagnostic/presentation';
import { Eyebrow } from '../parts';

/** Autoridade externa: veiculo, data, manchete literal, dado e endereco da materia. */
export function MercadoScene({ scene }: { scene: MercadoVM }) {
  const { article, closing, index, count } = scene;
  return (
    <div className="lead-view">
      <div className="lead-eyebrow-row">
        <Eyebrow>O que o mercado está mostrando</Eyebrow>
        {article && count > 1 && (
          <p className="lead-eyebrow-quiet">
            Reportagem {index + 1} de {count}
          </p>
        )}
      </div>
      {article && (
        <article key={`a${index}`} className="lead-card lead-article lead-reveal">
          <div className="lead-badges">
            <span className="lead-badge">{article.outlet}</span>
            <span className="lead-badge">{article.date}</span>
            {article.seal && <span className="lead-badge lead-badge-accent">{article.seal}</span>}
          </div>
          <h2 className="lead-headline">“{article.headline}”</h2>
          {article.data && (
            <div className="lead-stack lead-reveal">
              <p className="lead-article-data">{article.data}</p>
              {article.url && <p className="lead-url">{article.url}</p>}
            </div>
          )}
        </article>
      )}
      {!article && closing && (
        <div key="fecho" className="lead-center lead-reveal">
          <p className="lead-closing">{closing}</p>
        </div>
      )}
    </div>
  );
}
