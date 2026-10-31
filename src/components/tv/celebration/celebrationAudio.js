export const CELEBRATION_SOUNDS = Object.freeze([
  { id: 'victory', title: 'Vitória', description: 'Fanfarra curta, com notas ascendentes e um acorde de conquista.', durationSeconds: 2.7 },
  { id: 'arcade', title: 'Arcade', description: 'Melodia de vitória em 8 bits, como passar de fase.', durationSeconds: 2.2 },
  { id: 'party', title: 'Festa', description: 'Batida leve, baixo e acordes para comemorar em equipe.', durationSeconds: 3.5 },
  { id: 'cash', title: 'Caixa registradora', description: 'Um clique curto seguido de um brilho de moedas.', durationSeconds: 1.5 },
].map(sound => Object.freeze(sound)))

const error = (code, message, cause) => Object.assign(new Error(message), { code, ...(cause ? { cause } : {}) })
const volumeGain = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.35
const frequency = midi => 440 * 2 ** ((midi - 69) / 12)

// All four arrangements are original, procedural sketches. They use only
// oscillators and generated percussion, with no recordings or network calls.
function instrument(context, session, at, duration, level, source, filter) {
  const envelope = context.createGain()
  session.nodes.push(source, envelope, ...(filter ? [filter] : []))
  session.sources.push(source)
  session.params.push(envelope.gain)
  const start = session.start + at, end = start + duration
  envelope.gain.setValueAtTime(0, start)
  envelope.gain.linearRampToValueAtTime(level, start + Math.min(0.008, duration / 4))
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)
  if (filter) { source.connect(filter); filter.connect(envelope) } else source.connect(envelope)
  envelope.connect(session.master)
  source.start(start)
  source.stop(end)
  if (end >= session.end) { session.end = end; session.lastSource = source }
}

function tone(context, session, at, midi, duration, type = 'triangle', level = 0.13, endFrequency) {
  const oscillator = context.createOscillator()
  oscillator.type = type
  session.params.push(oscillator.frequency)
  oscillator.frequency.setValueAtTime(frequency(midi), session.start + at)
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, session.start + at + duration)
  instrument(context, session, at, duration, level, oscillator)
}

function percussion(context, session, at, duration, level, high = true) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const data = buffer.getChannelData(0)
  // Deterministic white noise makes the sketch repeatable without assets.
  let seed = 5489
  for (let index = 0; index < data.length; index++) {
    seed = (1664525 * seed + 1013904223) >>> 0
    data[index] = seed / 2147483648 - 1
  }
  const source = context.createBufferSource()
  source.buffer = buffer
  const filter = context.createBiquadFilter()
  filter.type = high ? 'highpass' : 'bandpass'
  filter.frequency.setValueAtTime(high ? 6500 : 1600, session.start + at)
  filter.Q.setValueAtTime(0.6, session.start + at)
  session.params.push(filter.frequency, filter.Q)
  instrument(context, session, at, duration, level, source, filter)
}

const arrangements = {
  victory(context, session) {
    for (const [at, midi, duration] of [[0, 67, 0.15], [0.19, 72, 0.15], [0.38, 76, 0.18],
      [0.64, 79, 0.38], [1.08, 76, 0.16], [1.3, 79, 0.18], [1.6, 84, 1.06]]) {
      tone(context, session, at, midi, duration, 'triangle', 0.2)
      tone(context, session, at, midi - 12, duration, 'sawtooth', 0.035)
    }
    for (const midi of [48, 60, 64, 67]) tone(context, session, 1.6, midi, 1.06, 'triangle', 0.08)
  },
  arcade(context, session) {
    for (const [index, midi] of [72, 76, 79, 84, 83, 79, 86, 88].entries()) {
      tone(context, session, index * 0.14, midi, index === 7 ? 0.38 : 0.11, 'square', 0.085)
    }
    for (const [at, midi] of [[0, 48], [0.28, 55], [0.56, 52], [0.84, 55], [1.42, 60]]) {
      tone(context, session, at, midi, at === 1.42 ? 0.74 : 0.16, 'triangle', 0.18)
    }
    for (const midi of [76, 79, 84]) tone(context, session, 1.42, midi, 0.74, 'square', 0.04)
  },
  party(context, session) {
    for (let beat = 0; beat < 8; beat++) {
      const at = beat * 0.4
      tone(context, session, at, 48, 0.16, 'sine', 0.32, 42)
      tone(context, session, at + 0.04, [48, 48, 55, 52][beat % 4], 0.24, 'triangle', 0.16)
      percussion(context, session, at, 0.055, 0.045)
      percussion(context, session, at + 0.2, 0.07, 0.055)
      if (beat % 2) percussion(context, session, at, 0.12, 0.09, false)
      if (beat % 2 === 0) for (const midi of [72, 76, 79]) tone(context, session, at + 0.2, midi, 0.17, 'triangle', 0.07)
    }
    for (const midi of [72, 76, 79, 84]) tone(context, session, 3.04, midi, 0.42, 'triangle', 0.08)
  },
  cash(context, session) {
    percussion(context, session, 0, 0.055, 0.18, false)
    tone(context, session, 0.035, 51, 0.07, 'square', 0.05, 80)
    for (const [at, midi, duration] of [[0.13, 88, 0.55], [0.24, 95, 0.52], [0.38, 100, 1.08]]) {
      tone(context, session, at, midi, duration, 'sine', 0.2)
      tone(context, session, at, midi + 12, duration * 0.6, 'sine', 0.045)
    }
  },
}

/** Create a silent controller. Only an explicit play() creates/resumes audio.
 * play resolves { id, status: 'ended' | 'stopped' }; failures reject.
 * stop also cancels a play awaiting browser permission, without stale starts.
 */
export function createCelebrationAudio() {
  let context = null, active = null, disposed = false

  function clean(session) {
    const now = context?.currentTime || 0
    for (const parameter of session.params) {
      try { parameter.cancelScheduledValues(now) } catch { /* Already closed. */ }
    }
    try { session.master?.gain.setValueAtTime(0, now) } catch { /* Already closed. */ }
    for (const source of session.sources) {
      source.onended = null
      try { source.stop() } catch { /* A naturally ended source may be stopped. */ }
    }
    for (const node of session.nodes) {
      try { node.disconnect() } catch { /* Disconnect is best-effort after close. */ }
    }
    session.sources = []; session.nodes = []; session.params = []
  }

  function finish(session, status, failure) {
    if (active !== session) return
    active = null
    clean(session)
    if (failure) session.reject(failure)
    else session.resolve({ id: session.id, status })
  }

  function stop() { if (active) finish(active, 'stopped') }

  // This must be called from a user gesture. It unlocks future sale sounds
  // without playing a fake sale or creating any oscillator on page load.
  function unlock() {
    if (disposed) return Promise.reject(error('AUDIO_DISPOSED', 'Este player de áudio já foi encerrado.'))
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext
        if (!AudioContext) throw error('UNSUPPORTED_AUDIO', 'Este navegador não oferece áudio para a TV.')
        context = new AudioContext()
      }
      return Promise.resolve(context.state === 'running' ? undefined : context.resume()).then(() => {
        if (disposed || context?.state !== 'running') throw error('AUDIO_BLOCKED', 'Clique em Ativar som para tentar novamente.')
      })
    } catch (cause) { return Promise.reject(cause) }
  }

  function play(id, { volume = 0.35 } = {}) {
    if (disposed) return Promise.reject(error('AUDIO_DISPOSED', 'Este player de áudio já foi encerrado.'))
    if (!Object.hasOwn(arrangements, id)) return Promise.reject(error('UNKNOWN_SOUND', 'Escolha um som de comemoração disponível.'))
    stop()
    const session = { id, sources: [], nodes: [], params: [], end: 0, master: null }
    const completion = new Promise((resolve, reject) => { session.resolve = resolve; session.reject = reject })
    active = session
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext
        if (!AudioContext) throw error('UNSUPPORTED_AUDIO', 'Este navegador não oferece áudio para a prévia. Experimente outro navegador.')
        context = new AudioContext()
      }
      // Call resume synchronously inside the click handler for Safari/iOS.
      const resumed = context.state === 'running' ? undefined : context.resume()
      Promise.resolve(resumed).then(() => {
        if (active !== session || disposed) return
        if (context.state !== 'running') throw error('AUDIO_BLOCKED', 'Clique novamente para liberar o áudio neste navegador.')
        session.start = context.currentTime + 0.015
        session.master = context.createGain()
        session.nodes.push(session.master)
        session.params.push(session.master.gain)
        session.master.gain.setValueAtTime(volumeGain(volume), context.currentTime)
        session.master.connect(context.destination)
        arrangements[id](context, session)
        session.lastSource.onended = () => finish(session, 'ended')
      }).catch(cause => finish(session, null, cause?.code ? cause
        : error('AUDIO_START_FAILED', 'Não foi possível tocar o som. Clique para tentar novamente.', cause)))
    } catch (cause) {
      finish(session, null, cause?.code ? cause : error('AUDIO_START_FAILED', 'Não foi possível iniciar o áudio neste navegador.', cause))
    }
    return completion
  }

  function dispose() {
    if (disposed) return
    disposed = true
    stop()
    if (context && context.state !== 'closed') {
      try { Promise.resolve(context.close()).catch(() => {}) } catch { /* Safari may already be closing. */ }
    }
    context = null
  }

  return { play, stop, dispose, unlock }
}
