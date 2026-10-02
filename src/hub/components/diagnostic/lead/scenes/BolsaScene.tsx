import type { BolsaVM } from '@/lib/diagnostic/presentation';
import { fmtMoney } from '../format';
import { Eyebrow } from '../parts';

/** Ancoragem e escassez real: so o que a oferta ja validou. Datas fixas, sem relogio. */
export function BolsaScene({ scene }: { scene: BolsaVM }) {
  const { anchor, finalPrice, discount, paths, seatsLine, validityLine } = scene;
  return (
    <div className="lead-view">
      <Eyebrow>A bolsa</Eyebrow>
      {(anchor != null || finalPrice != null) && (
        <div className="lead-grid-2 lead-align-start">
          {anchor != null && (
            <div className="lead-stack lead-reveal">
              <p className="lead-label">Investimento do programa</p>
              <p className="lead-money-anchor">{fmtMoney(anchor)}</p>
            </div>
          )}
          {finalPrice != null && (
            <div className="lead-stack lead-reveal">
              <p className="lead-label">Com a bolsa, você investe</p>
              <p className="lead-money-final">{fmtMoney(finalPrice)}</p>
              {discount != null && discount > 0 && <p className="lead-small lead-muted">Bolsa de {fmtMoney(discount)}</p>}
            </div>
          )}
        </div>
      )}
      {paths && paths.length > 0 && (
        <div className="lead-stack lead-reveal">
          <p className="lead-label">Formas de pagamento</p>
          <div className="lead-grid-auto">
            {paths.map((p) => (
              <div key={p.label} className="lead-card lead-stack">
                <p className="lead-text lead-strong">{p.label}</p>
                <p className="lead-path-main">
                  {p.installments > 1 ? `${p.installments}x de ${fmtMoney(p.installmentValue)}` : fmtMoney(p.total)}
                </p>
                {p.installments > 1 && <p className="lead-small lead-muted">Total {fmtMoney(p.total)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {(seatsLine || validityLine) && (
        <div className="lead-facts lead-reveal">
          {seatsLine && <p>{seatsLine}</p>}
          {validityLine && <p>{validityLine}</p>}
        </div>
      )}
    </div>
  );
}
