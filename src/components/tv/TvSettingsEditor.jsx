import { isRankingParticipant } from '../../utils/goalScopes.js'
/* eslint-disable react/prop-types -- Internal TV configuration form. */
import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react'
import { TV_METRICS, TV_PANELS } from './tvConfig.js'
import { PRODUCT_FAMILIES } from '../../utils/salesData.js'

const PRESETS = {
  'Visão da operação': ['monthly-goal', 'pace', 'team-goals', 'product-goals', 'sellers', 'products'],
  'Comercial': ['daily', 'sellers', 'team-goals', 'monthly-goal'],
  'Metas': ['monthly-goal', 'pace', 'team-goals', 'product-goals'],
  'Produtos': ['products', 'product-goals', 'payment-mix'],
}

export function TvSettingsEditor({ initial, directory, saving, error, conflict, onSave, onCancel, onReload }) {
  const [draft, setDraft] = useState(() => structuredClone(initial))
  const change = (key, value) => setDraft(old => ({ ...old, [key]: value }))
  const selected = draft.panels.filter(panel => panel.enabled)
  const options = draft.paceScope === 'team' ? directory?.teams || [] : draft.paceScope === 'individual' ? (directory?.individuals || []).filter(isRankingParticipant) : PRODUCT_FAMILIES.filter(id => id !== 'Não informado').map(id => ({ id, name: id }))
  const currentKnown = options.some(item => item.id === draft.paceScopeId)
  const patchPanel = (id, patch) => setDraft(old => {
    const panels = old.panels.map(panel => panel.id === id ? { ...panel, ...patch } : panel)
    return { ...old, panels, fixedPanel: panels.some(panel => panel.id === old.fixedPanel && panel.enabled) ? old.fixedPanel : panels.find(panel => panel.enabled)?.id }
  })
  const move = (index, direction) => setDraft(old => {
    const panels = [...old.panels]; [panels[index], panels[index + direction]] = [panels[index + direction], panels[index]]
    return { ...old, panels }
  })
  const preset = name => setDraft(old => {
    const ids = PRESETS[name]
    return { ...old, fixedPanel: ids[0], panels: [...ids, ...TV_PANELS.map(p => p.id).filter(id => !ids.includes(id))].map(id => ({ ...old.panels.find(p => p.id === id), enabled: ids.includes(id) })) }
  })
  return <form className="tv-editor" aria-label="Programação da TV" onSubmit={event => { event.preventDefault(); onSave(draft) }}>
    <div className="tv-section-heading"><div><span className="tv-eyebrow">Controle de exibição</span><h2>Programe a sua TV</h2><p>Valor bruto em destaque e cash collected sempre visível. A base escolhida define as metas e a ordenação dos rankings. Esta programação vale para todas as TVs.</p></div><button type="button" className="tv-icon-button" aria-label="Fechar configuração" onClick={onCancel} disabled={saving}><X size={20}/></button></div>
    <fieldset disabled={saving}>
      <div className="tv-presets"><span>Começar com</span>{Object.keys(PRESETS).map(name => <button type="button" key={name} onClick={() => preset(name)}>{name}</button>)}</div>
      <div className="tv-form-grid">
        <label>Exibição<select value={draft.mode} onChange={e => change('mode', e.target.value)}><option value="rotate">Alternar entre painéis</option><option value="fixed">Manter um painel fixo</option></select></label>
        {draft.mode === 'fixed' && <label>Painel fixo<select value={draft.fixedPanel} onChange={e => change('fixedPanel', e.target.value)}>{selected.map(panel => <option key={panel.id} value={panel.id}>{TV_PANELS.find(p => p.id === panel.id)?.title}</option>)}</select></label>}
        <label>Base das metas e da ordenação<select value={draft.metric} onChange={e => change('metric', e.target.value)}>{Object.entries(TV_METRICS).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label>Período<select value={draft.monthMode} onChange={e => setDraft(old => ({ ...old, monthMode: e.target.value, month: e.target.value === 'current' ? '' : new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date()).slice(0, 7) }))}><option value="current">Mês atual · muda automaticamente</option><option value="fixed">Escolher um mês</option></select></label>
        {draft.monthMode === 'fixed' && <label>Mês de referência<input type="month" required min="2000-01" max="2100-12" value={draft.month} onChange={e => change('month', e.target.value)}/></label>}
        <label>Tema da TV<select value={draft.theme} onChange={e => change('theme', e.target.value)}><option value="system">Seguir o Workspace</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
        <label>Escopo do gráfico de pace<select value={draft.paceScope} onChange={e => setDraft(old => ({ ...old, paceScope: e.target.value, paceScopeId: '' }))}><option value="overall">Geral</option><option value="team">Time</option><option value="product">Produto</option><option value="individual">Vendedor</option></select></label>
        {draft.paceScope !== 'overall' && <label>Alvo do gráfico de pace<select required value={draft.paceScopeId} onChange={e => change('paceScopeId', e.target.value)}><option value="">Selecione</option>{draft.paceScopeId && !currentKnown && <option value={draft.paceScopeId}>Seleção salva · indisponível no cadastro</option>}{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </div>
      <div className="tv-panel-list-heading"><h3>Painéis e ordem de exibição</h3><span>{selected.length} selecionados · tempo em segundos</span></div>
      <div className="tv-config-panels">{draft.panels.map((panel, index) => { const info = TV_PANELS.find(p => p.id === panel.id); return <div className="tv-config-panel" data-testid={`tv-config-${panel.id}`} key={panel.id}>
        <span className="tv-sequence">{String(index + 1).padStart(2, '0')}</span>
        <label className="tv-panel-check"><input type="checkbox" checked={panel.enabled} disabled={panel.enabled && selected.length === 1} onChange={e => patchPanel(panel.id, { enabled: e.target.checked })} aria-label={`Exibir ${info.title}`}/><span><strong>{info.title}</strong><small>{info.description}</small></span></label>
        <label className="tv-duration"><span className="tv-sr-only">Tempo de {info.title}</span><input type="number" min="10" max="120" step="1" required value={panel.durationSeconds} onChange={e => patchPanel(panel.id, { durationSeconds: e.target.value === '' ? '' : Number(e.target.value) })}/><span>s</span></label>
        <div className="tv-order"><button type="button" className="tv-icon-button" aria-label={`Subir ${info.title}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={17}/></button><button type="button" className="tv-icon-button" aria-label={`Descer ${info.title}`} disabled={index === draft.panels.length - 1} onClick={() => move(index, 1)}><ArrowDown size={17}/></button></div>
      </div> })}</div>
    </fieldset>
    {error && <div className="tv-notice" role="alert">{error}{conflict && <button type="button" onClick={onReload}>Carregar programação mais recente</button>}</div>}
    <div className="tv-editor-actions"><p>Atualização dos dados a cada minuto. Faturas de vendas passadas ficam fora destes painéis.</p><button type="button" onClick={onCancel} disabled={saving}>Cancelar</button><button type="submit" className="tv-primary" disabled={saving}><Check size={17}/>{saving ? 'Salvando…' : 'Salvar programação'}</button></div>
  </form>
}
