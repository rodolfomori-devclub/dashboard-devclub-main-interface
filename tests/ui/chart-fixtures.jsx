/* eslint-disable react-refresh/only-export-components -- Local fixture entry intentionally mounts directly. */
// Synthetic component fixtures only. Mounted by the intercepted local smoke route.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ChartPanel, MixChart, RankedBars } from '../../src/components/charts/AnalyticsVisuals'
import { ReferenceChart } from '../../src/components/charts/ReferenceChart'
import '../../src/index.css'

const barSeries = ['a', 'b', 'c'].map((key, index) => ({ key, label: `Série ${index + 1}`, unit: 'count' }))
const sparse = [{ date: '2026-09-01', a: 10, b: 25, c: 40 }, { date: '2026-09-02', a: 20, b: -15, c: 35 }]
const dense = Array.from({ length: 365 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1, 12)).toISOString().slice(0, 10), a: 2 + index % 7, b: 4 + index % 5, c: 1 + index % 3 }))
const mix = [{ key: 'tiny', label: 'Pix raro', value: 1 }, { key: 'card', label: 'Cartão', value: 999999 }, { key: 'missing', label: 'Ausente', value: null }, { key: 'negative', label: 'Ajuste negativo', value: -20 }]
const gaps = [10, 20, null, 40, 45].map((value, index) => ({ date: `2026-09-0${index + 1}`, actual: value, forecast: value, noFill: value }))

function ChartFixtures() {
  const [selection, setSelection] = useState('Nenhum')
  return <main className="chart-fixture-shell" data-testid="chart-fixtures-ready">
    <h1>Regressão dos gráficos</h1>
    <style>{`
      .chart-fixture-shell { margin-left: 232px; padding: 24px 28px; }
      .chart-fixture-shell > h1 { margin-bottom: 24px; }
      .chart-fixture-block { margin-top: 24px; min-width: 0; }
      .chart-fixture-fixed { width: 800px; max-width: 100%; }
      @media (max-width: 1024px) { .chart-fixture-shell { margin-left: 0; padding: 24px; } }
    `}</style>
    <div className="analytics-grid analytics-grid--wide" data-testid="mix-layout">
      <ChartPanel title="Referência de largura"><p>Mesma proporção de colunas das páginas de receita.</p></ChartPanel>
      <ChartPanel title="Mix sintético"><div data-testid="mix"><MixChart items={mix} /></div></ChartPanel>
    </div>
    <div className="chart-fixture-block chart-fixture-fixed" data-testid="sparse-bars">
      <ReferenceChart rows={sparse} series={barSeries} title="Três séries em dois dias" mode="bar" height={280} />
    </div>
    <div className="chart-fixture-block chart-fixture-fixed" data-testid="dense-bars">
      <ReferenceChart rows={dense} series={barSeries} title="Três séries em 365 dias" mode="bar" height={280} />
    </div>
    <div className="analytics-grid chart-fixture-block">
      <ChartPanel title="Valores conhecidos e ausentes"><div data-testid="signed-ranking">
        <RankedBars items={[{ key: 'positive', label: 'Positivo', value: 120 }, { key: 'negative', label: 'Negativo', value: -30 }, { key: 'unknown', label: 'Sem valor', value: null, partial: true }]} onSelect={item => setSelection(item.key)} />
        <output aria-label="Seleção do ranking">{selection}</output>
      </div></ChartPanel>
      <ChartPanel title="Atingimento"><div data-testid="percent-ranking"><RankedBars unit="percent" items={[{ key: 'quarter', label: 'Um quarto', value: 25 }, { key: 'tenth', label: 'Um décimo', value: 10 }]} /></div></ChartPanel>
    </div>
    <div className="chart-fixture-block chart-fixture-fixed" data-testid="area-gaps">
      <ReferenceChart rows={gaps} series={[{ key: 'actual', label: 'Observado', unit: 'currency' }, { key: 'forecast', label: 'Projeção', unit: 'currency', dash: '4 4' }, { key: 'noFill', label: 'Sem preenchimento', unit: 'currency', fill: false }]} title="Áreas com lacunas" mode="area" height={280} />
    </div>
  </main>
}

createRoot(document.getElementById('root')).render(<ChartFixtures />)
