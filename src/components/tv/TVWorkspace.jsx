import { useCallback, useEffect, useRef, useState } from 'react'
import { Monitor, Play, RefreshCw, Settings2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { requestApi } from '../../lib/api.js'
import { useTvData } from './useTvData.js'
import { TvPanel } from './TvPanels.jsx'
import { TvPlayer } from './TvPlayer.jsx'
import { TvSettingsEditor } from './TvSettingsEditor.jsx'
import TvSharing from './TvSharing.jsx'
import { defaultTvSettings, TV_METRICS, TV_PANELS, tvMonthLabel } from './tvConfig.js'
import './tv.css'

export default function TVWorkspace() {
  const { userRoles, hasPermission } = useAuth()
  const [saved, setSaved] = useState(null)
  const [settingsError, setSettingsError] = useState('')
  const [editor, setEditor] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [presenting, setPresenting] = useState(false)
  const [preview, setPreview] = useState('monthly-goal')
  const request = useRef(0)
  const pendingSave = useRef(false)
  const ownsFullscreen = useRef(false)
  const presentationActive = useRef(false)
  const mounted = useRef(true)
  const readSettings = useCallback(async () => {
    if (pendingSave.current) return null
    const id = ++request.current
    try {
      const next = await requestApi('/tv/settings')
      if (!mounted.current || id !== request.current) return null
      setSaved(previous => previous?.revision === next.revision && JSON.stringify(previous?.settings) === JSON.stringify(next.settings) ? previous : next); setSettingsError('')
      return next
    } catch (error) { if (mounted.current && id === request.current) setSettingsError(error.message); return null }
  }, [])
  useEffect(() => {
    mounted.current = true
    readSettings()
    const refresh = () => { if (!document.hidden) readSettings() }
    const invalidate = () => { request.current++ }
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { mounted.current = false; invalidate(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [readSettings])
  const settings = saved?.settings || defaultTvSettings()
  const allowed = ['today', 'daily', 'monthly', 'yearly', 'goal-pace', 'goals'].some(hasPermission)
  const data = useTvData({ month: settings.monthMode === 'fixed' ? settings.month : 'current', metric: settings.metric, enabled: allowed && Boolean(saved), paceScope: settings.paceScope, paceScopeId: settings.paceScopeId })
  const enabledPanels = settings.panels.filter(panel => panel.enabled)
  const previewId = enabledPanels.some(panel => panel.id === preview) ? preview : enabledPanels[0]?.id
  const closeTv = useCallback(() => {
    presentationActive.current = false
    setPresenting(false)
    if (ownsFullscreen.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    ownsFullscreen.current = false
  }, [])
  useEffect(() => {
    const changed = () => { if (ownsFullscreen.current && !document.fullscreenElement) closeTv() }
    document.addEventListener('fullscreenchange', changed)
    return () => { document.removeEventListener('fullscreenchange', changed); if (ownsFullscreen.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); ownsFullscreen.current = false }
  }, [closeTv])
  const startTv = () => {
    presentationActive.current = true
    setPresenting(true)
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => { if (!mounted.current || !presentationActive.current) { document.exitFullscreen?.().catch(() => {}); return }; ownsFullscreen.current = true }).catch(() => { /* The viewport presentation also works when fullscreen is unavailable. */ })
    }
  }
  const save = async draft => {
    pendingSave.current = true; request.current++; setSaving(true); setSaveError(''); setConflict(false)
    try {
      const next = await requestApi('/tv/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: draft, expectedRevision: editor.revision }) })
      if (!mounted.current) return
      setSaved(next); setSettingsError(''); setEditor(null); setNotice('Programação salva. As TVs abertas recebem a atualização em até um minuto.'); setPreview(draft.mode === 'fixed' ? draft.fixedPanel : draft.panels.find(panel => panel.enabled).id)
    } catch (error) { if (mounted.current) { setSaveError(error.code === 'TV_SETTINGS_CONFLICT' ? 'Outro administrador alterou a programação. Seu rascunho foi preservado; carregue a versão mais recente antes de salvar.' : error.message); setConflict(error.code === 'TV_SETTINGS_CONFLICT') } }
    finally { pendingSave.current = false; if (mounted.current) setSaving(false) }
  }
  const reloadDraft = async () => { const next = await readSettings(); if (next) { setEditor(next); setSaveError(''); setConflict(false) } }
  return <div className="tv-workspace tv-surface">
    <header className="tv-workspace-heading"><div><span className="tv-eyebrow"><Monitor size={15}/>Operação em tempo real</span><h1>TV Mode</h1><p>Os números que movem o time, sempre à vista.</p></div><div className="tv-actions">{userRoles?.isAdmin && <button disabled={!saved || saving} onClick={() => { setEditor(saved); setSaveError(''); setConflict(false); setNotice('') }}><Settings2 size={17}/>Configurar TV</button>}<button className="tv-primary" onClick={startTv} disabled={!saved || !allowed || Boolean(editor)}><Play size={17}/>Iniciar TV</button></div></header>
    {settingsError && <div className="tv-notice" role="alert">{settingsError} <button onClick={readSettings}>Tentar novamente</button></div>}
    {notice && <p className="tv-save-notice" role="status">{notice}</p>}
    {userRoles?.isAdmin && <TvSharing/>}
    {editor && <TvSettingsEditor key={editor.revision} initial={editor.settings} directory={data.model?.directory} saving={saving} error={saveError} conflict={conflict} onSave={save} onCancel={() => setEditor(null)} onReload={reloadDraft}/>}
    {!allowed ? <div className="tv-empty"><Monitor size={36}/><h2>Acesso aos indicadores da TV</h2><p>Para exibir os painéis financeiros, libere Mensal ou Ritmo das metas no Vault. O ranking comercial continua disponível na outra aba.</p></div> : <>
      <div className="tv-program-summary"><div><span className="tv-live-dot"/><strong>{settings.mode === 'fixed' ? 'Painel fixo' : `${enabledPanels.length} painéis em sequência`}</strong><span>{tvMonthLabel(data.model?.month || settings.month)}</span><span>Metas e ordem: {TV_METRICS[settings.metric]}</span></div><button onClick={() => data.refresh()} disabled={data.loading || data.refreshing || !saved} aria-label="Atualizar indicadores"><RefreshCw size={16} className={data.refreshing ? 'tv-spin' : ''}/>{data.refreshing ? 'Atualizando…' : 'Atualizar'}</button></div>
      <div className="tv-preview-nav" aria-label="Prévia dos painéis">{enabledPanels.map(panel => <button key={panel.id} aria-pressed={panel.id === previewId} onClick={() => setPreview(panel.id)}>{TV_PANELS.find(info => info.id === panel.id)?.title}{settings.mode === 'rotate' && <small>{panel.durationSeconds}s</small>}</button>)}</div>
      {data.error && <div className="tv-notice" role="status">{data.error}</div>}
      <section className="tv-preview tv-surface" data-testid="tv-preview" data-panel-id={previewId} data-tv-theme={settings.theme} data-metric={settings.metric}><div className="tv-scene-heading"><span className="tv-eyebrow">Prévia</span><h2>{TV_PANELS.find(panel => panel.id === previewId)?.title}</h2>{data.refreshing && <span className="tv-refresh-label">Atualizando…</span>}</div><TvPanel panelId={previewId} model={data.model} loading={data.loading || !saved}/></section>
      <div className="tv-workspace-foot"><span>Dados atualizados a cada minuto · horário de Brasília</span><span>{settings.mode === 'rotate' ? 'Na apresentação: ← → para navegar · espaço para pausar · Esc para sair' : 'Na apresentação: Esc para sair'}</span></div>
    </>}
    {presenting && allowed && saved && <TvPlayer settings={settings} data={data} onClose={closeTv}/>}
  </div>
}
