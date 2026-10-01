import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Monitor } from 'lucide-react'
import { TvPlayer } from '../components/tv/TvPlayer.jsx'
import { isPublicTvToken, stalePublicTvModel, validPublicPresentation } from '../components/tv/publicTvData.js'
import '../components/tv/tv.css'

const PUBLIC_API = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '')

export default function PublicTVPage() {
  const { token } = useParams()
  const validToken = isPublicTvToken(token)
  const [state, setState] = useState({ token, presentation: null, loading: true, unavailable: false, error: '' })
  const [fullscreen, setFullscreen] = useState(false)
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const current = state.token === token ? state : { presentation: null, loading: true, unavailable: false, error: '' }
  const retry = useRef(() => {})
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = () => setPrefersDark(media.matches)
    media.addEventListener('change', changed)
    const full = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', full)
    const previousTitle = document.title
    document.title = 'DevClub · TV'
    return () => { media.removeEventListener('change', changed); document.removeEventListener('fullscreenchange', full); document.title = previousTitle }
  }, [])
  useEffect(() => {
    if (!validToken) return
    let active = true, timer, controller, pending = false, lastSuccess = 0
    const load = async () => {
      if (!active || pending) return
      clearTimeout(timer); pending = true
      controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)
      let delay = 60000
      try {
        // Intentionally bypass Vault and authenticated API clients, even when
        // this device happens to have a private Dashboard session in storage.
        const response = await fetch(`${PUBLIC_API}/tv/public/${encodeURIComponent(token)}`, { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal, headers: { Accept: 'application/json' } })
        if (!active) return
        if ([403, 404, 410].includes(response.status)) {
          setState({ token, presentation: null, loading: false, unavailable: true, error: '' })
          return
        }
        if (!response.ok) throw new Error('Public TV unavailable')
        const presentation = await response.json()
        if (!validPublicPresentation(presentation)) throw new Error('Invalid public TV response')
        if (!active) return
        lastSuccess = Date.now()
        delay = presentation.loading || presentation.refreshing ? 5000 : !presentation.model ? 15000 : 60000
        setState(previous => ({ token, presentation: { ...presentation, settings: previous.token === token && previous.presentation?.revision === presentation.revision && JSON.stringify(previous.presentation.settings) === JSON.stringify(presentation.settings) ? previous.presentation.settings : presentation.settings }, loading: false, unavailable: false, error: '' }))
      } catch {
        if (!active) return
        delay = 15000
        setState(previous => ({ token, presentation: previous.token === token && Date.now() - lastSuccess < 300000 ? previous.presentation : null, loading: false, unavailable: false, error: 'Atualização indisponível. A última leitura foi mantida e uma nova tentativa será feita automaticamente.' }))
      } finally {
        clearTimeout(timeout); pending = false
        const schedule = () => { if (active) timer = setTimeout(() => { if (document.hidden) schedule(); else load() }, delay) }
        schedule()
      }
    }
    retry.current = load
    const visible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', visible)
    load()
    return () => { active = false; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visible); retry.current = () => {} }
  }, [token, validToken])
  const onFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    else document.documentElement.requestFullscreen?.().catch(() => { /* The presentation already fills the browser window. */ })
  }, [])
  const saved = current.presentation
  const rawSettings = saved?.settings
  const settings = useMemo(() => rawSettings ? { ...rawSettings, theme: rawSettings.theme === 'system' ? prefersDark ? 'dark' : 'light' : rawSettings.theme } : null, [rawSettings, prefersDark])
  const model = useMemo(() => current.error ? stalePublicTvModel(saved?.model) : saved?.model, [current.error, saved?.model])
  if (saved && settings && (model || saved.loading)) return <TvPlayer settings={settings} data={{ model, loading: saved.loading, refreshing: saved.refreshing, updatedAt: saved.updatedAt, error: current.error || saved.error }} publicView onFullscreen={onFullscreen} fullscreen={fullscreen}/>
  const unavailable = !validToken || current.unavailable
  return <main className="tv-public-state tv-surface" data-tv-theme={prefersDark ? 'dark' : 'light'}><div className="tv-empty"><Monitor size={40}/><span className="tv-eyebrow">DevClub · TV</span><h1>{unavailable ? 'Link da TV indisponível' : current.loading ? 'Abrindo a TV' : 'Não foi possível abrir a TV'}</h1><p>{unavailable ? 'Este link foi desativado, substituído ou não existe. Solicite o link atual ao administrador.' : current.loading ? 'Preparando a programação e os indicadores.' : 'A conexão está temporariamente indisponível. Tentaremos novamente automaticamente.'}</p>{!current.loading && validToken && <button onClick={() => retry.current()}>Tentar novamente</button>}</div></main>
}
