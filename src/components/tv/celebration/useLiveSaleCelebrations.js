import { useCallback, useEffect, useRef, useState } from 'react'
import { createTvSaleTracker } from './liveSaleTracker.js'
import { createCelebrationAudio } from './celebrationAudio.js'

export const TV_CELEBRATION = Object.freeze({ animation: 'confetti', sound: 'victory', volume: 1, durationSeconds: 5 })

export function useLiveSaleCelebrations(feed, healthy) {
  const [run, setRun] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [audioMessage, setAudioMessage] = useState('')
  const [visible, setVisible] = useState(!document.hidden)
  const engine = useRef(null)
  if (!engine.current) engine.current = { tracker: createTvSaleTracker(), lastReady: {}, queue: [], active: null, audio: null, sound: false, mounted: false, generation: 0, sequence: 0 }

  const clear = useCallback(() => {
    const state = engine.current
    state.queue = []; state.active = null
    state.audio?.stop()
    if (state.mounted) setRun(null)
  }, [])
  const next = useCallback(() => {
    const state = engine.current
    if (!state.mounted || state.active || document.hidden) return
    let sale
    while (state.queue.length) {
      const candidate = state.queue.shift()
      const time = Date.parse(candidate.occurredAt)
      const now = Date.now()
      if (candidate.test || (now - time <= 600000 && new Date(time - 10800000).toISOString().slice(0, 10) === new Date(now - 10800000).toISOString().slice(0, 10))) { sale = candidate; break }
    }
    if (!sale) return
    state.active = { ...sale, key: ++state.sequence }
    setRun(state.active)
    if (state.sound && state.audio) state.audio.play(TV_CELEBRATION.sound, { volume: TV_CELEBRATION.volume }).catch(() => {
      if (!state.mounted || !state.sound) return
      state.sound = false; setSoundEnabled(false)
      setAudioMessage('Som bloqueado pelo navegador. Clique em Ativar som para tentar novamente.')
    })
  }, [])
  const finish = useCallback(() => {
    const state = engine.current
    state.audio?.stop(); state.active = null; setRun(null)
    next()
  }, [next])

  useEffect(() => {
    const state = engine.current
    state.mounted = true
    const changed = () => {
      if (document.hidden) { state.tracker.reset(); state.lastReady = {}; state.generation++; clear() }
      setVisible(!document.hidden)
    }
    document.addEventListener('visibilitychange', changed)
    return () => {
      state.mounted = false; state.generation++
      state.tracker.reset(); state.queue = []; state.active = null
      state.audio?.dispose(); state.audio = null; state.sound = false
      document.removeEventListener('visibilitychange', changed)
    }
  }, [clear])
  useEffect(() => {
    const state = engine.current
    const currentDay = feed?.day === new Date(Date.now() - 10800000).toISOString().slice(0, 10)
    const incoming = state.tracker.consume(feed, { active: visible, healthy: healthy && currentDay })
    if (!visible || !healthy || !currentDay || !feed) { state.lastReady = {}; clear(); return }
    // A source that becomes unavailable must not keep stale queued alerts.
    const now = Date.now()
    const ready = new Set(feed.groups?.filter(group => {
      if (group.ready) { state.lastReady[group.source] = now; return true }
      if (group.refreshing && now - (state.lastReady[group.source] || 0) <= 120000) return true
      delete state.lastReady[group.source]; return false
    }).map(group => group.source))
    state.queue = state.queue.filter(sale => sale.test || ready.has(sale.source))
    if (state.active && !state.active.test && !ready.has(state.active.source)) {
      state.audio?.stop(); state.active = null; setRun(null)
    }
    state.queue.push(...incoming)
    state.queue = state.queue.slice(-100)
    next()
  }, [feed, healthy, visible, clear, next])

  const toggleSound = useCallback(() => {
    const state = engine.current
    const generation = ++state.generation
    setAudioMessage('')
    if (state.sound) {
      state.sound = false; state.audio?.stop(); setSoundEnabled(false)
      return
    }
    state.audio ||= createCelebrationAudio()
    state.audio.unlock().then(() => {
      if (!state.mounted || state.generation !== generation) return
      state.sound = true; setSoundEnabled(true)
    }).catch(() => {
      if (state.mounted && state.generation === generation) setAudioMessage('Não foi possível ativar o som. Confira o áudio do aparelho e tente novamente.')
    })
  }, [])
  const test = useCallback(() => {
    const state = engine.current
    if (state.active || document.hidden) return
    state.queue.push({ id: `test-${++state.sequence}`, amount: 1297, sellerName: 'Vendedor de exemplo', test: true })
    next()
  }, [next])

  return { run, soundEnabled, audioMessage, toggleSound, test, finish, dismiss: clear }
}
