import test from 'node:test'
import assert from 'node:assert/strict'
import { CELEBRATION_SOUNDS, createCelebrationAudio } from '../src/components/tv/celebration/celebrationAudio.js'

class Parameter {
  events = []
  setValueAtTime(value, at) { this.events.push(['set', value, at]); return this }
  linearRampToValueAtTime(value, at) { this.events.push(['linear', value, at]); return this }
  exponentialRampToValueAtTime(value, at) { this.events.push(['exponential', value, at]); return this }
  cancelScheduledValues(at) { this.events.push(['cancel', at]); return this }
}

function installAudio(t, { webkit = false, resume } = {}) {
  const originals = ['AudioContext', 'webkitAudioContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const instances = []
  class Context {
    state = 'suspended'
    currentTime = 10
    sampleRate = 8000
    destination = {}
    sources = []
    nodes = []
    resumeCalls = 0
    closeCalls = 0
    constructor() { instances.push(this) }
    resume() { this.resumeCalls++; return resume ? resume(this) : (this.state = 'running', Promise.resolve()) }
    close() { this.closeCalls++; this.state = 'closed'; return Promise.resolve() }
    node(type) {
      const node = { type, connected: [], disconnected: 0,
        connect(target) { this.connected.push(target); return target }, disconnect() { this.disconnected++ } }
      this.nodes.push(node)
      return node
    }
    source(type) {
      const source = Object.assign(this.node(type), { starts: [], stops: [], onended: null,
        start(at) { this.starts.push(at) }, stop(at) { this.stops.push(at); if (at === undefined) this.onended?.() } })
      this.sources.push(source)
      return source
    }
    createGain() { return Object.assign(this.node('gain'), { gain: new Parameter() }) }
    createOscillator() { return Object.assign(this.source('oscillator'), { frequency: new Parameter() }) }
    createBufferSource() { return this.source('buffer') }
    createBiquadFilter() { return Object.assign(this.node('filter'), { frequency: new Parameter(), Q: new Parameter() }) }
    createBuffer(channels, frames, sampleRate) {
      assert.equal(channels, 1)
      assert.equal(sampleRate, this.sampleRate)
      return { getChannelData: () => new Float32Array(frames) }
    }
    decodeCalls = 0
    decodeAudioData(data, resolve) { this.decodeCalls++; resolve({ decodedFrom: data }) }
  }
  Object.defineProperty(globalThis, 'AudioContext', { value: webkit ? undefined : Context, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'webkitAudioContext', { value: webkit ? Context : undefined, configurable: true, writable: true })
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return instances
}

const flush = async () => { await Promise.resolve(); await Promise.resolve() }
const finish = context => {
  const final = context.sources.filter(source => source.onended).at(-1)
  assert.ok(final, 'A source completion event settles playback without timers')
  final.onended()
}

const settle = () => new Promise(resolve => setTimeout(resolve))
const recordingFile = { ok: true, arrayBuffer: async () => 'mp3-bytes' }

test('the sale sound plays the decoded recording through the master gain and downloads it once', async t => {
  const instances = installAudio(t)
  const download = t.mock.method(globalThis, 'fetch', async () => recordingFile)
  const audio = createCelebrationAudio()
  const first = audio.play('sale', { volume: 1 })
  await settle()
  const context = instances[0]
  const [source] = context.sources
  const master = context.nodes.find(node => node.type === 'gain')
  assert.equal(context.sources.length, 1)
  assert.equal(source.type, 'buffer')
  assert.deepEqual(source.buffer, { decodedFrom: 'mp3-bytes' })
  assert.equal(source.connected[0], master)
  assert.deepEqual(master.gain.events[0], ['set', 1, context.currentTime])
  assert.ok(source.starts[0] > context.currentTime)
  finish(context)
  assert.deepEqual(await first, { id: 'sale', status: 'ended' })
  assert.ok(context.nodes.every(node => node.disconnected === 1))
  const second = audio.play('sale', { volume: 1 })
  await settle()
  finish(context)
  await second
  assert.equal(download.mock.callCount(), 1)
  assert.equal(context.decodeCalls, 1)
  audio.dispose()
})

test('a recording that fails to load plays the Victory score and is retried on the next sale', async t => {
  const instances = installAudio(t)
  const download = t.mock.method(globalThis, 'fetch', async () => ({ ok: false }))
  const audio = createCelebrationAudio()
  const fallback = audio.play('sale', { volume: 1 })
  await settle()
  const context = instances[0]
  assert.equal(context.sources.length, 18)
  assert.ok(context.sources.every(source => source.frequency))
  finish(context)
  assert.deepEqual(await fallback, { id: 'sale', status: 'ended' })
  download.mock.mockImplementation(async () => recordingFile)
  const recovered = audio.play('sale', { volume: 1 })
  await settle()
  assert.equal(download.mock.callCount(), 2)
  assert.equal(context.sources.at(-1).type, 'buffer')
  finish(context)
  await recovered
  audio.dispose()
})

test('stopping during the download never starts the recording', async t => {
  let deliver
  const instances = installAudio(t)
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { deliver = resolve }))
  const audio = createCelebrationAudio()
  const canceled = audio.play('sale')
  await settle()
  audio.stop()
  assert.deepEqual(await canceled, { id: 'sale', status: 'stopped' })
  deliver(recordingFile)
  await settle()
  assert.equal(instances[0].sources.length, 0)
  audio.dispose()
})

test('audio can be unlocked by a gesture without producing any sale sound', async t => {
  const instances = installAudio(t)
  const audio = createCelebrationAudio()
  assert.equal(instances.length, 0)
  await audio.unlock()
  assert.equal(instances.length, 1)
  assert.equal(instances[0].state, 'running')
  assert.equal(instances[0].sources.length, 0)
  const playing = audio.play('victory', { volume: 0.35 })
  await flush()
  assert.ok(instances[0].sources.length > 0)
  audio.stop()
  assert.equal((await playing).status, 'stopped')
  audio.dispose()
})

test('controller stays silent until play, schedules four distinct short arrangements, and releases nodes at completion', async t => {
  const instances = installAudio(t)
  const audio = createCelebrationAudio()
  assert.equal(instances.length, 0)
  assert.deepEqual(CELEBRATION_SOUNDS.map(sound => sound.id), ['victory', 'arcade', 'party', 'cash'])
  const arrangements = []
  for (const sound of CELEBRATION_SOUNDS) {
    const promise = audio.play(sound.id)
    await flush()
    const context = instances[0]
    const sources = context.sources.filter(source => !source.disconnected)
    assert.ok(sources.length > 5)
    assert.ok(sound.durationSeconds <= 5)
    assert.ok(sources.every(source => source.starts.length === 1 && source.starts[0] > context.currentTime))
    assert.ok(sources.every(source => Number.isFinite(source.stops[0]) && source.stops[0] > source.starts[0]))
    assert.ok(Math.max(...sources.map(source => source.stops[0])) <= context.currentTime + sound.durationSeconds + 0.02)
    arrangements.push(sources.map(source => [source.type, source.starts[0], source.frequency?.events[0]?.[1]]))
    finish(context)
    assert.deepEqual(await promise, { id: sound.id, status: 'ended' })
    assert.ok(context.nodes.every(node => node.disconnected === 1))
  }
  assert.equal(new Set(arrangements.map(value => JSON.stringify(value))).size, 4)
  assert.equal(instances.length, 1, 'Reuse one context instead of leaking browser audio sessions')
  audio.dispose()
  assert.equal(instances[0].closeCalls, 1)
})

test('volume is clamped and stop immediately mutes, cancels automation and disconnects all scheduled sources', async t => {
  const instances = installAudio(t)
  const audio = createCelebrationAudio()
  for (const [volume, expected] of [[-4, 0], [2, 1], [0.2, 0.2], [NaN, 0.35], [undefined, 0.35]]) {
    const promise = audio.play('party', { volume })
    await flush()
    const context = instances[0]
    const liveNodes = context.nodes.filter(node => !node.disconnected)
    const master = liveNodes[0]
    assert.deepEqual(master.gain.events[0], ['set', expected, context.currentTime])
    audio.stop()
    audio.stop()
    assert.deepEqual(await promise, { id: 'party', status: 'stopped' })
    assert.deepEqual(master.gain.events.at(-1), ['set', 0, context.currentTime])
    assert.ok(liveNodes.every(node => node.disconnected === 1))
    assert.ok(context.sources.every(source => source.stops.at(-1) === undefined))
    for (const node of liveNodes) for (const key of ['gain', 'frequency', 'Q']) {
      if (node[key]) assert.ok(node[key].events.some(event => event[0] === 'cancel'))
    }
  }
  audio.dispose()
})

test('a new play stops its predecessor and a late old ended event cannot stop the replacement', async t => {
  const instances = installAudio(t)
  const audio = createCelebrationAudio()
  const previous = audio.play('victory')
  await flush()
  const oldSources = [...instances[0].sources]
  const oldEnded = oldSources.find(source => source.onended).onended
  const next = audio.play('arcade')
  assert.deepEqual(await previous, { id: 'victory', status: 'stopped' })
  await flush()
  oldEnded()
  assert.ok(oldSources.every(source => source.disconnected === 1))
  assert.ok(instances[0].sources.some(source => source.disconnected === 0))
  finish(instances[0])
  assert.deepEqual(await next, { id: 'arcade', status: 'ended' })
  audio.dispose()
})

test('stop and supersession while Safari resume is pending cannot start stale playback', async t => {
  const pending = []
  const instances = installAudio(t, { webkit: true, resume: context => new Promise(resolve => {
    pending.push(() => { context.state = 'running'; resolve() })
  }) })
  const audio = createCelebrationAudio()
  const canceled = audio.play('party')
  assert.equal(instances[0].resumeCalls, 1, 'resume runs synchronously inside the user gesture')
  audio.stop()
  assert.deepEqual(await canceled, { id: 'party', status: 'stopped' })
  const superseded = audio.play('cash')
  const latest = audio.play('victory')
  assert.deepEqual(await superseded, { id: 'cash', status: 'stopped' })
  pending.forEach(resolve => resolve())
  await flush()
  assert.equal(instances.length, 1)
  assert.ok(instances[0].sources.length > 0)
  assert.ok(instances[0].sources.every(source => source.frequency), 'Canceled percussion sounds never start')
  audio.dispose()
  audio.dispose()
  assert.deepEqual(await latest, { id: 'victory', status: 'stopped' })
  assert.equal(instances[0].closeCalls, 1)
  await assert.rejects(audio.play('cash'), { code: 'AUDIO_DISPOSED' })
})

test('dispose while resume is pending settles playback, closes once and never starts a source afterward', async t => {
  let resolveResume
  const instances = installAudio(t, { resume: () => new Promise(resolve => { resolveResume = resolve }) })
  const audio = createCelebrationAudio()
  const promise = audio.play('cash')
  audio.dispose()
  resolveResume()
  await flush()
  assert.deepEqual(await promise, { id: 'cash', status: 'stopped' })
  assert.equal(instances[0].sources.length, 0)
  assert.equal(instances[0].closeCalls, 1)
})

test('unsupported browsers, unknown selections and blocked permission fail clearly without scheduling audio', async t => {
  const instances = installAudio(t, { resume: () => Promise.reject(new Error('Permission denied')) })
  const audio = createCelebrationAudio()
  await assert.rejects(audio.play('unlisted'), { code: 'UNKNOWN_SOUND' })
  assert.equal(instances.length, 0)
  await assert.rejects(audio.play('cash'), { code: 'AUDIO_START_FAILED' })
  assert.equal(instances[0].sources.length, 0)
  audio.dispose()
  globalThis.AudioContext = undefined
  const unsupported = createCelebrationAudio()
  await assert.rejects(unsupported.play('victory'), { code: 'UNSUPPORTED_AUDIO' })
  unsupported.stop()
  unsupported.dispose()
})
