import { STORAGE_KEYS } from './storage';
const STORAGE_KEY = STORAGE_KEYS.audioSettings;

interface AudioSettings {
  enabled: boolean;
  volume: number; // 0-1
}

const DEFAULT_SETTINGS: AudioSettings = { enabled: true, volume: 0.7 };

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.7,
      };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AudioSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

let currentSettings = loadSettings();
const listeners = new Set<(s: AudioSettings) => void>();

function createCtx(): { ctx: AudioContext; masterGain: GainNode; now: number } {
  const ctx = new AudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(currentSettings.volume * 1.2, ctx.currentTime);
  masterGain.connect(ctx.destination);
  return { ctx, masterGain, now: ctx.currentTime };
}

function tone(ctx: AudioContext, masterGain: GainNode, now: number, freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.connect(gain);
  gain.connect(masterGain);
  osc.frequency.setValueAtTime(freq, now + start);
  gain.gain.setValueAtTime(0, now + start);
  gain.gain.linearRampToValueAtTime(vol, now + start + 0.015);
  gain.gain.setValueAtTime(vol, now + start + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
  osc.start(now + start);
  osc.stop(now + start + dur + 0.05);
}

export const audioManager = {
  getSettings(): AudioSettings {
    return { ...currentSettings };
  },

  setEnabled(enabled: boolean) {
    currentSettings = { ...currentSettings, enabled };
    saveSettings(currentSettings);
    this._notify();
  },

  setVolume(volume: number) {
    currentSettings = { ...currentSettings, volume: Math.max(0, Math.min(1, volume)) };
    saveSettings(currentSettings);
    this._notify();
  },

  subscribe(fn: (s: AudioSettings) => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  _notify() {
    listeners.forEach(fn => fn({ ...currentSettings }));
  },

  _canPlay() {
    return currentSettings.enabled && currentSettings.volume > 0;
  },

  /** Play sale sound from MP3 file */
  playCelebration() {
    if (!this._canPlay()) return;
    try {
      const audio = new Audio('/sounds/venda-realizada.mp3');
      audio.volume = currentSettings.volume;
      audio.play().catch(() => {});
    } catch {}
  },

  /** Play overtake sound */
  playOvertake() {
    if (!this._canPlay()) return;
    try {
      const { ctx, masterGain, now } = createCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(masterGain);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.6);

      tone(ctx, masterGain, now, 1568, 0.2, 0.4, 0.35);
      setTimeout(() => ctx.close(), 1500);
    } catch {}
  },

  /** Racing engine whoosh — new ranking leader */
  playNewLeader() {
    if (!this._canPlay()) return;
    try {
      const { ctx, masterGain, now } = createCtx();
      masterGain.gain.setValueAtTime(currentSettings.volume * 1.4, now);

      // Engine roar: filtered noise sweep
      const engineLen = 1.5;
      const engineBuf = ctx.createBuffer(1, ctx.sampleRate * engineLen, ctx.sampleRate);
      const engineData = engineBuf.getChannelData(0);
      for (let i = 0; i < engineData.length; i++) engineData[i] = (Math.random() * 2 - 1);
      const engineSrc = ctx.createBufferSource();
      engineSrc.buffer = engineBuf;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'bandpass';
      engineFilter.frequency.setValueAtTime(200, now);
      engineFilter.frequency.exponentialRampToValueAtTime(3000, now + 0.6);
      engineFilter.frequency.exponentialRampToValueAtTime(800, now + 1.2);
      engineFilter.Q.value = 5;
      const engineGain = ctx.createGain();
      engineGain.gain.setValueAtTime(0.5, now);
      engineGain.gain.linearRampToValueAtTime(0.7, now + 0.4);
      engineGain.gain.exponentialRampToValueAtTime(0.001, now + engineLen);
      engineSrc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(masterGain);
      engineSrc.start(now);

      // Acceleration tone sweep
      const accel = ctx.createOscillator();
      const accelGain = ctx.createGain();
      accel.type = 'sawtooth';
      accel.frequency.setValueAtTime(80, now);
      accel.frequency.exponentialRampToValueAtTime(600, now + 0.5);
      accel.frequency.exponentialRampToValueAtTime(300, now + 1.0);
      accel.connect(accelGain);
      accelGain.connect(masterGain);
      accelGain.gain.setValueAtTime(0.2, now);
      accelGain.gain.linearRampToValueAtTime(0.4, now + 0.3);
      accelGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      accel.start(now);
      accel.stop(now + 1.3);

      // Victory fanfare after engine
      const fanfare = [
        { freq: 784, start: 0.8, dur: 0.2, vol: 0.4 },   // G5
        { freq: 988, start: 0.95, dur: 0.2, vol: 0.45 },  // B5
        { freq: 1175, start: 1.1, dur: 0.5, vol: 0.5 },   // D6
        { freq: 1568, start: 1.25, dur: 0.8, vol: 0.45 },  // G6
      ];
      fanfare.forEach(n => tone(ctx, masterGain, now, n.freq, n.start, n.dur, n.vol));

      setTimeout(() => ctx.close(), 3000);
    } catch {}
  },

  /** Victory celebration — individual goal achieved */
  playGoalAchieved() {
    if (!this._canPlay()) return;
    try {
      const { ctx, masterGain, now } = createCtx();
      masterGain.gain.setValueAtTime(currentSettings.volume * 1.3, now);

      // Triumphant chord progression
      const chords = [
        // C major
        { freqs: [523, 659, 784], start: 0, dur: 0.4 },
        // F major
        { freqs: [698, 880, 1047], start: 0.35, dur: 0.4 },
        // G major
        { freqs: [784, 988, 1175], start: 0.7, dur: 0.4 },
        // C major high
        { freqs: [1047, 1318, 1568], start: 1.05, dur: 0.8 },
      ];
      chords.forEach(chord => {
        chord.freqs.forEach(freq => {
          tone(ctx, masterGain, now, freq, chord.start, chord.dur, 0.2);
        });
      });

      // Crowd cheer: filtered noise burst
      const cheerLen = 2.0;
      const cheerBuf = ctx.createBuffer(1, ctx.sampleRate * cheerLen, ctx.sampleRate);
      const cheerData = cheerBuf.getChannelData(0);
      for (let i = 0; i < cheerData.length; i++) cheerData[i] = (Math.random() * 2 - 1);
      const cheerSrc = ctx.createBufferSource();
      cheerSrc.buffer = cheerBuf;
      const cheerFilter = ctx.createBiquadFilter();
      cheerFilter.type = 'bandpass';
      cheerFilter.frequency.value = 2000;
      cheerFilter.Q.value = 0.5;
      const cheerGain = ctx.createGain();
      cheerGain.gain.setValueAtTime(0, now + 0.5);
      cheerGain.gain.linearRampToValueAtTime(0.25, now + 0.8);
      cheerGain.gain.setValueAtTime(0.25, now + 1.3);
      cheerGain.gain.exponentialRampToValueAtTime(0.001, now + cheerLen + 0.5);
      cheerSrc.connect(cheerFilter);
      cheerFilter.connect(cheerGain);
      cheerGain.connect(masterGain);
      cheerSrc.start(now + 0.5);

      // Sparkle shower
      for (let i = 0; i < 12; i++) {
        const sFreq = 3000 + Math.random() * 5000;
        const sStart = 1.0 + i * 0.08;
        tone(ctx, masterGain, now, sFreq, sStart, 0.15, 0.06);
      }

      setTimeout(() => ctx.close(), 4000);
    } catch {}
  },

  /** Epic team celebration — team goal achieved */
  playTeamGoalAchieved() {
    if (!this._canPlay()) return;
    try {
      const { ctx, masterGain, now } = createCtx();
      masterGain.gain.setValueAtTime(currentSettings.volume * 1.5, now);

      // Epic intro hit
      const hitBuf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const hitData = hitBuf.getChannelData(0);
      for (let i = 0; i < hitData.length; i++) hitData[i] = (Math.random() * 2 - 1);
      const hitSrc = ctx.createBufferSource();
      hitSrc.buffer = hitBuf;
      const hitFilter = ctx.createBiquadFilter();
      hitFilter.type = 'lowpass';
      hitFilter.frequency.value = 500;
      const hitGain = ctx.createGain();
      hitGain.gain.setValueAtTime(0.8, now);
      hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      hitSrc.connect(hitFilter);
      hitFilter.connect(hitGain);
      hitGain.connect(masterGain);
      hitSrc.start(now);

      // Sub boom
      const boom = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(80, now);
      boom.frequency.exponentialRampToValueAtTime(30, now + 0.5);
      boom.connect(boomGain);
      boomGain.connect(masterGain);
      boomGain.gain.setValueAtTime(0.6, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      boom.start(now);
      boom.stop(now + 0.7);

      // Epic fanfare melody
      const melody = [
        { freq: 523, start: 0.3, dur: 0.25, vol: 0.35 },  // C5
        { freq: 659, start: 0.5, dur: 0.25, vol: 0.35 },  // E5
        { freq: 784, start: 0.7, dur: 0.25, vol: 0.4 },   // G5
        { freq: 1047, start: 0.9, dur: 0.5, vol: 0.45 },  // C6
        { freq: 1175, start: 1.3, dur: 0.25, vol: 0.4 },  // D6
        { freq: 1318, start: 1.5, dur: 0.25, vol: 0.4 },  // E6
        { freq: 1568, start: 1.7, dur: 0.8, vol: 0.5 },   // G6
        { freq: 2093, start: 2.3, dur: 1.0, vol: 0.45 },  // C7
      ];
      melody.forEach(n => tone(ctx, masterGain, now, n.freq, n.start, n.dur, n.vol));

      // Harmony layer
      const harmony = [
        { freq: 392, start: 0.3, dur: 2.0, vol: 0.15 },  // G4
        { freq: 523, start: 0.9, dur: 2.0, vol: 0.15 },  // C5
        { freq: 659, start: 1.3, dur: 1.5, vol: 0.15 },  // E5
      ];
      harmony.forEach(n => tone(ctx, masterGain, now, n.freq, n.start, n.dur, n.vol));

      // Stadium crowd roar
      const roarLen = 4.0;
      const roarBuf = ctx.createBuffer(1, ctx.sampleRate * roarLen, ctx.sampleRate);
      const roarData = roarBuf.getChannelData(0);
      for (let i = 0; i < roarData.length; i++) roarData[i] = (Math.random() * 2 - 1);
      const roarSrc = ctx.createBufferSource();
      roarSrc.buffer = roarBuf;
      const roarFilter = ctx.createBiquadFilter();
      roarFilter.type = 'bandpass';
      roarFilter.frequency.value = 1500;
      roarFilter.Q.value = 0.3;
      const roarGain = ctx.createGain();
      roarGain.gain.setValueAtTime(0, now + 0.8);
      roarGain.gain.linearRampToValueAtTime(0.35, now + 1.5);
      roarGain.gain.setValueAtTime(0.35, now + 2.5);
      roarGain.gain.linearRampToValueAtTime(0.4, now + 3.0);
      roarGain.gain.exponentialRampToValueAtTime(0.001, now + roarLen + 0.8);
      roarSrc.connect(roarFilter);
      roarFilter.connect(roarGain);
      roarGain.connect(masterGain);
      roarSrc.start(now + 0.8);

      // Firework bursts
      for (let burst = 0; burst < 4; burst++) {
        const bStart = 2.0 + burst * 0.7;
        // Pop
        const popBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const popData = popBuf.getChannelData(0);
        for (let i = 0; i < popData.length; i++) popData[i] = (Math.random() * 2 - 1);
        const popSrc = ctx.createBufferSource();
        popSrc.buffer = popBuf;
        const popGain = ctx.createGain();
        popGain.gain.setValueAtTime(0.4, now + bStart);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + bStart + 0.05);
        popSrc.connect(popGain);
        popGain.connect(masterGain);
        popSrc.start(now + bStart);

        // Sparkle cascade
        for (let s = 0; s < 8; s++) {
          const sFreq = 3000 + Math.random() * 5000;
          const sStart = bStart + 0.05 + s * 0.04;
          tone(ctx, masterGain, now, sFreq, sStart, 0.2, 0.05);
        }
      }

      setTimeout(() => ctx.close(), 7000);
    } catch {}
  },

  /** Energetic zap sound — daily pace achieved */
  playPaceAchieved() {
    if (!this._canPlay()) return;
    try {
      const { ctx, masterGain, now } = createCtx();
      // Quick ascending zap
      tone(ctx, masterGain, now, 440, 0, 0.15, 0.3);
      tone(ctx, masterGain, now, 660, 0.1, 0.15, 0.35);
      tone(ctx, masterGain, now, 880, 0.2, 0.15, 0.4);
      tone(ctx, masterGain, now, 1320, 0.3, 0.3, 0.35);
      // Sparkle
      for (let i = 0; i < 6; i++) {
        tone(ctx, masterGain, now, 2500 + Math.random() * 3000, 0.5 + i * 0.06, 0.12, 0.06);
      }
      setTimeout(() => ctx.close(), 2000);
    } catch {}
  },

  /** Moderate celebration — team milestone (50%/70%) */
  playTeamMilestone() {
    if (!this._canPlay()) return;
    try {
      const { ctx, masterGain, now } = createCtx();
      // Rising chord
      const notes = [
        { freq: 523, start: 0, dur: 0.3, vol: 0.25 },
        { freq: 659, start: 0.15, dur: 0.3, vol: 0.25 },
        { freq: 784, start: 0.3, dur: 0.4, vol: 0.3 },
        { freq: 1047, start: 0.5, dur: 0.5, vol: 0.35 },
      ];
      notes.forEach(n => tone(ctx, masterGain, now, n.freq, n.start, n.dur, n.vol));
      setTimeout(() => ctx.close(), 2500);
    } catch {}
  },

  /** Test sound = same sale sound */
  playTestSound() {
    if (currentSettings.volume === 0) return;
    const wasEnabled = currentSettings.enabled;
    currentSettings.enabled = true;
    this.playCelebration();
    currentSettings.enabled = wasEnabled;
  },
};
