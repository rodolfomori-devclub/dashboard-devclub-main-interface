import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Copy, Maximize2, MonitorPlay, Play, Save, Sparkles, Square, Volume2, X } from 'lucide-react'
import { CELEBRATION_ANIMATIONS, SaleCelebration } from '../components/tv/celebration/SaleCelebration.jsx'
import { CELEBRATION_SOUNDS, createCelebrationAudio } from '../components/tv/celebration/celebrationAudio.js'
import './tvDemo.css'

const STORAGE_KEY = 'devclub.tv-celebration-demo.v1'
const DEFAULTS = { animation: 'confetti', sound: 'victory', volume: 0.35, muted: false }
const DURATION = 5
function loadChoice() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!value || !CELEBRATION_ANIMATIONS.some(item => item.id === value.animation) || !CELEBRATION_SOUNDS.some(item => item.id === value.sound)) return DEFAULTS
    return { animation: value.animation, sound: value.sound, volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : DEFAULTS.volume, muted: value.muted === true }
  } catch { return DEFAULTS }
}

export default function TVDemoPage() {
  const [choice, setChoice] = useState(loadChoice)
  const [sellerName, setSellerName] = useState('Ana Silva')
  const [showSeller, setShowSeller] = useState(true)
  const [amount, setAmount] = useState('1297')
  const [run, setRun] = useState(null)
  const [playingSound, setPlayingSound] = useState(null)
  const [message, setMessage] = useState('')
  const [audioError, setAudioError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const audio = useRef(null)
  const sequence = useRef(0)
  const audioSequence = useRef(0)
  const screen = useRef(null)
  const fullscreenOwned = useRef(false)
  const fullscreenRequested = useRef(false)
  const mounted = useRef(false)
  const expandButton = useRef(null)
  const animationInfo = CELEBRATION_ANIMATIONS.find(item => item.id === choice.animation)
  const soundInfo = CELEBRATION_SOUNDS.find(item => item.id === choice.sound)
  const saleValue = Number(amount)
  const validSale = Number.isFinite(saleValue) && saleValue > 0 && saleValue <= 10000000 && (!showSeller || Boolean(sellerName.trim()))

  const stop = useCallback(() => {
    audioSequence.current++
    audio.current?.stop()
    setPlayingSound(null)
    setRun(null)
  }, [])

  useEffect(() => {
    mounted.current = true
    const previousTitle = document.title
    const audioGeneration = audioSequence
    document.title = 'Comemorações de vendas · DevClub'
    const onHide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      mounted.current = false
      audioGeneration.current++
      fullscreenRequested.current = false
      audio.current?.dispose()
      audio.current = null
      document.title = previousTitle
      document.removeEventListener('visibilitychange', onHide)
      if (fullscreenOwned.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [stop])

  const closeFullscreen = useCallback(() => {
    fullscreenRequested.current = false
    stop()
    setExpanded(false)
    if (fullscreenOwned.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    fullscreenOwned.current = false
    requestAnimationFrame(() => { if (mounted.current) expandButton.current?.focus() })
  }, [stop])
  useEffect(() => {
    const changed = () => { if (fullscreenOwned.current && !document.fullscreenElement) closeFullscreen() }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [closeFullscreen])
  useEffect(() => {
    if (!expanded) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    screen.current?.focus()
    return () => { document.body.style.overflow = overflow }
  }, [expanded])

  const choose = patch => { stop(); setChoice(previous => ({ ...previous, ...patch })); setMessage(''); setAudioError('') }
  const playAudio = id => {
    const current = ++audioSequence.current
    setAudioError('')
    if (choice.muted || choice.volume === 0) { setMessage('A prévia está sem som. Desmarque Silenciar e aumente o volume para ouvir.'); return }
    audio.current ||= createCelebrationAudio()
    setPlayingSound(id)
    // Called directly from a click so browser audio permission stays tied to the gesture.
    audio.current.play(id, { volume: choice.volume }).then(() => {
      if (mounted.current && current === audioSequence.current) setPlayingSound(null)
    }).catch(() => {
      if (!mounted.current || current !== audioSequence.current) return
      setPlayingSound(null)
      setAudioError('Não foi possível reproduzir o áudio. Confira o volume do aparelho e tente novamente em um navegador com áudio habilitado.')
    })
  }
  const simulate = () => {
    if (!validSale) return
    stop()
    if (!expanded) screen.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
    setMessage('')
    setAudioError('')
    setRun({ id: ++sequence.current, animation: choice.animation, sale: { sellerName: showSeller ? sellerName.trim() : undefined, amount: saleValue, product: 'DevClub' } })
    if (!choice.muted && choice.volume > 0) playAudio(choice.sound)
  }
  const finish = useCallback(() => stop(), [stop])
  const listen = id => { stop(); setMessage(''); playAudio(id) }
  const fullscreen = () => {
    fullscreenRequested.current = true
    setExpanded(true)
    if (screen.current?.requestFullscreen) screen.current.requestFullscreen().then(() => {
      if (!mounted.current || !fullscreenRequested.current) { document.exitFullscreen?.().catch(() => {}); return }
      fullscreenOwned.current = true
    }).catch(() => { /* The same preview fills the window when native fullscreen is unavailable. */ })
  }
  const screenKeys = event => {
    if (event.key === 'Escape') { event.preventDefault(); if (expanded) closeFullscreen(); else stop() }
    if (expanded && event.key === 'Tab') {
      const focusable = [...screen.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')]
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === screen.current)) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && (document.activeElement === last || document.activeElement === screen.current)) { event.preventDefault(); first?.focus() }
    }
  }
  const saveChoice = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choice)); setMessage(`Escolha guardada neste navegador: ${animationInfo.title} + ${choice.muted || choice.volume === 0 ? 'sem som' : soundInfo.title}.`) }
    catch { setMessage('Este navegador não permitiu guardar a escolha. Use Copiar escolha para levá-la com você.') }
  }
  const copyChoice = async () => {
    const text = `Minha escolha para a TV: animação ${animationInfo.title}; som ${choice.muted || choice.volume === 0 ? 'sem som' : soundInfo.title}; volume ${Math.round(choice.volume * 100)}%; duração ${DURATION} segundos.`
    try { await navigator.clipboard.writeText(text); if (mounted.current) setMessage('Escolha copiada. Você pode colar aqui na conversa para confirmar a combinação.') }
    catch { if (mounted.current) setMessage(text) }
  }

  return <div className="tv-demo" data-testid="tv-demo">
    <header className="tv-demo-nav" inert={expanded || undefined}><a href="/ranking"><ArrowLeft size={16}/>Voltar para a TV</a><span className="tv-demo-brand"><MonitorPlay size={20}/>DevClub</span><span className="tv-demo-nav-label">Prévia interativa</span></header>
    <main className="tv-demo-main">
      <div className="tv-demo-intro" inert={expanded || undefined}><div><h1>Comemorações de vendas</h1><p>Escolha a animação, dê o play na música e veja como uma nova venda aparece na TV.</p></div><span className="tv-demo-demo-badge">Vendas simuladas</span></div>
      <div className="tv-demo-layout">
        <div className="tv-demo-preview-column">
          <section ref={screen} tabIndex={-1} role={expanded ? 'dialog' : 'region'} aria-modal={expanded || undefined} aria-label="Prévia da TV" className={`tv-demo-screen${expanded ? ' tv-demo-expanded' : ''}`} data-testid="tv-demo-screen" onKeyDown={screenKeys}>
            <header className="tv-demo-screen-header"><span><span className="tv-demo-dot"/>DevClub TV</span><span className="tv-demo-stage-label">Simulação</span><div>{expanded ? <><button className="tv-demo-icon" onClick={simulate} disabled={!validSale} aria-label="Simular venda"><Play size={18}/></button><button className="tv-demo-icon" onClick={closeFullscreen} aria-label="Sair da tela cheia"><X size={19}/></button></> : <button ref={expandButton} className="tv-demo-icon" onClick={fullscreen} aria-label="Testar em tela cheia"><Maximize2 size={18}/></button>}</div></header>
            <div className="tv-demo-stage" data-testid="tv-demo-stage">
              <div className="tv-demo-backdrop" aria-hidden={Boolean(run)}>
                <div className="tv-demo-fake-heading"><span>Vendas do dia</span><span>Dados de exemplo</span></div>
                <div className="tv-demo-fake-total"><span>Total de hoje</span><strong>R$ 48.920,00</strong><small>18 vendas realizadas</small></div>
                <div className="tv-demo-fake-chart" aria-hidden="true">{[16, 22, 18, 37, 30, 52, 42, 65, 54, 78, 68, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }}/>)}</div>
                <div className="tv-demo-fake-footer"><span>Cash collected <b>R$ 32.740,00</b></span><span>Top vendedor <b>Ana Silva</b></span></div>
              </div>
              {run && <SaleCelebration key={run.id} animation={run.animation} sale={run.sale} durationSeconds={DURATION} onComplete={finish} onDismiss={finish} preview/>}
            </div>
            <footer className="tv-demo-screen-footer"><span>{run ? 'Comemoração em andamento' : 'Pronta para a próxima simulação'}</span><button onClick={stop} disabled={!run && !playingSound}><Square size={12}/>Parar prévia</button></footer>
          </section>
          <div className="tv-demo-stage-actions" inert={expanded || undefined}><button className="tv-demo-play" aria-label="Simular venda" onClick={simulate} disabled={!validSale}><Play size={19} fill="currentColor"/>Simular venda <span>{choice.muted || choice.volume === 0 ? 'sem som' : 'com som'}</span></button><p>Uma prévia de {DURATION} segundos.<br/>Experimente também em tela cheia.</p></div>
          <fieldset className="tv-demo-animations" aria-label="Animação" inert={expanded || undefined}><legend>Animação</legend><div className="tv-demo-animation-options">{CELEBRATION_ANIMATIONS.map((item, index) => <label key={item.id} className={`tv-demo-animation-option${choice.animation === item.id ? ' is-selected' : ''}`}><input type="radio" name="animation" value={item.id} checked={choice.animation === item.id} onChange={() => choose({ animation: item.id })}/><div className={`tv-demo-animation-thumb tv-demo-thumb-${item.id}`} aria-hidden="true"><span className="tv-demo-mini-brand">DevClub</span>{item.id === 'confetti' ? <><i/><i/><i/><i/><i/><Sparkles size={28}/></> : item.id === 'spotlight' ? <span className="tv-demo-mini-person">AS</span> : <span className="tv-demo-mini-ticker"><Check size={13}/>Nova venda!</span>}</div><span className="tv-demo-option-name"><span>{index + 1}. {item.title}</span>{choice.animation === item.id && <Check size={16}/>}</span><small>{item.description}</small></label>)}</div></fieldset>
          <fieldset className="tv-demo-scenario" inert={expanded || undefined}><legend>Venda de exemplo</legend><div className="tv-demo-scenario-fields"><label className="tv-demo-toggle"><input type="checkbox" checked={showSeller} onChange={event => { stop(); setShowSeller(event.target.checked) }}/>Mostrar vendedor</label><label>Nome do vendedor<input type="text" maxLength={60} value={sellerName} disabled={!showSeller} onChange={event => { stop(); setSellerName(event.target.value) }} autoComplete="off"/></label><label>Valor da venda<input type="number" min="0.01" max="10000000" step="0.01" value={amount} onChange={event => { stop(); setAmount(event.target.value) }}/></label></div>{!validSale && <p className="tv-demo-field-hint">Informe um valor entre R$ 0,01 e R$ 10.000.000,00{showSeller ? ' e o nome do vendedor' : ''}.</p>}</fieldset>
        </div>
        <aside className="tv-demo-controls" inert={expanded || undefined}>
          <div className="tv-demo-controls-heading"><Volume2 size={21}/><h2>O som da conquista</h2></div><p className="tv-demo-controls-description">Ouça cada opção e combine com qualquer animação.</p>
          <fieldset className="tv-demo-sounds" aria-label="Som da comemoração"><legend className="tv-demo-sr-only">Som da comemoração</legend>{CELEBRATION_SOUNDS.map(item => <div className={`tv-demo-sound${choice.sound === item.id ? ' is-selected' : ''}`} key={item.id}><label><input type="radio" name="sound" value={item.id} checked={choice.sound === item.id} onChange={() => choose({ sound: item.id })}/><span><strong>{item.title}</strong><small>{item.description}</small><em>{item.durationSeconds}s</em></span></label><button className="tv-demo-sound-play" aria-label={playingSound === item.id ? `Parar ${item.title}` : `Ouvir ${item.title}`} onClick={() => playingSound === item.id ? stop() : listen(item.id)} disabled={choice.muted || choice.volume === 0}>{playingSound === item.id ? <Square size={16}/> : <Play size={17}/>}</button></div>)}</fieldset>
          <div className="tv-demo-volume"><label htmlFor="tv-demo-volume">Volume <output>{Math.round(choice.volume * 100)}%</output></label><input id="tv-demo-volume" type="range" min="0" max="100" step="5" value={Math.round(choice.volume * 100)} onChange={event => choose({ volume: Number(event.target.value) / 100 })}/><label className="tv-demo-toggle"><input type="checkbox" checked={choice.muted} onChange={event => choose({ muted: event.target.checked })}/>Silenciar</label></div>
          <div className="tv-demo-selection"><span>Sua combinação</span><strong>{animationInfo.title} + {choice.muted || choice.volume === 0 ? 'sem som' : soundInfo.title}</strong><p>O nome aparece quando a venda tem vendedor atribuído.</p><button className="tv-demo-try" onClick={simulate} disabled={!validSale}><Play size={16}/>Testar combinação</button><button className="tv-demo-save" onClick={saveChoice}><Save size={16}/>Guardar minha escolha</button><button className="tv-demo-copy" onClick={copyChoice}><Copy size={15}/>Copiar escolha</button></div>
        </aside>
      </div>
      <div className="tv-demo-feedback" inert={expanded || undefined}>{audioError && <p role="alert">{audioError}</p>}{message && <p role="status">{message}</p>}</div>
      <footer className="tv-demo-page-footer" inert={expanded || undefined}><p>Esta prévia usa vendas fictícias. Sua escolha fica neste navegador e ainda não ativa alertas nas TVs.</p><span><MonitorPlay size={15}/>TV Mode · DevClub</span></footer>
    </main>
  </div>
}
