// Procedural sound effects and music with the Web Audio API.
// Everything is synthesized at runtime: no audio files, no licensing issues.

type Ctx = AudioContext;

export interface AudioSettings {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
}

class Sfx {
  ctx: Ctx | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  settings: AudioSettings = { master: 0.8, sfx: 0.9, music: 0.45, muted: false };
  private musicOn = false;
  private musicTimer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private tense = false;
  private lastPlay = new Map<string, number>();

  constructor() {
    try {
      const s = localStorage.getItem('tofu.audio');
      if (s) Object.assign(this.settings, JSON.parse(s));
    } catch {
      /* ignore */
    }
  }

  /** Must be called from a user gesture (browser audio unlock). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
  }

  apply() {
    if (!this.ctx) return;
    const s = this.settings;
    this.master.gain.value = s.muted ? 0 : s.master;
    this.sfxBus.gain.value = s.sfx;
    this.musicBus.gain.value = s.music * 0.5;
    try {
      localStorage.setItem('tofu.audio', JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  private now() {
    return this.ctx!.currentTime;
  }

  private throttle(key: string, ms: number): boolean {
    const t = performance.now();
    const l = this.lastPlay.get(key) ?? 0;
    if (t - l < ms) return false;
    this.lastPlay.set(key, t);
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, glideTo?: number, bus?: GainNode) {
    const c = this.ctx!;
    const t = this.now() + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0, q = 1, sweepTo?: number, bus?: GainNode) {
    const c = this.ctx!;
    if (!this.noiseBuf) return;
    const t = this.now() + at;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name: string, vol = 1) {
    if (!this.ctx || this.settings.muted) return;
    switch (name) {
      case 'bark': {
        if (!this.throttle('bark', 120)) return;
        const p = 0.9 + Math.random() * 0.2;
        this.tone(330 * p, 0.16, 'sawtooth', 0.22 * vol, 0, 170 * p);
        this.tone(165 * p, 0.18, 'square', 0.1 * vol, 0, 110 * p);
        this.noise(0.12, 0.25 * vol, 'bandpass', 900, 0, 2, 500);
        break;
      }
      case 'pickup':
        this.tone(520, 0.09, 'triangle', 0.25 * vol, 0, 880);
        break;
      case 'drop':
        this.tone(220, 0.12, 'sine', 0.3 * vol, 0, 90);
        break;
      case 'store':
        this.tone(660, 0.08, 'triangle', 0.22 * vol);
        this.tone(990, 0.12, 'triangle', 0.18 * vol, 0.07);
        break;
      case 'crash':
        if (!this.throttle('crash', 60)) return;
        this.noise(0.45, 0.45 * vol, 'lowpass', 3000, 0, 0.7, 300);
        this.tone(1800, 0.12, 'triangle', 0.08 * vol, 0.02, 2400);
        this.tone(2600, 0.1, 'triangle', 0.06 * vol, 0.06, 1900);
        this.tone(120, 0.25, 'sine', 0.3 * vol, 0, 60);
        break;
      case 'thud':
        this.tone(140, 0.15, 'sine', 0.3 * vol, 0, 70);
        this.noise(0.08, 0.12 * vol, 'lowpass', 800);
        break;
      // Leaves scattered: a dry crackling rustle.
      case 'rustle':
        if (!this.throttle('rustle', 200)) return;
        this.noise(0.5, 0.18 * vol, 'highpass', 2500, 0, 0.8, 5000);
        this.noise(0.35, 0.1 * vol, 'bandpass', 4200, 0.08, 2);
        break;
      // A snowman falling apart: muffled "pouf".
      case 'snowThud':
        this.noise(0.4, 0.3 * vol, 'lowpass', 900, 0, 0.7, 200);
        this.tone(90, 0.3, 'sine', 0.25 * vol, 0, 50);
        break;
      // One drop of the leaking watering can.
      case 'drip':
        if (!this.throttle('drip', 300)) return;
        this.tone(1500 + Math.random() * 500, 0.06, 'sine', 0.05 * vol, 0, 700);
        break;
      case 'pawSnow':
        this.noise(0.06, 0.06 * vol, 'lowpass', 1600 + Math.random() * 300, 0, 1.2, 600);
        break;
      case 'splash':
        if (!this.throttle('splash', 250)) return;
        this.noise(0.4, 0.35 * vol, 'bandpass', 1400, 0, 1.2, 400);
        this.tone(400, 0.2, 'sine', 0.08 * vol, 0.05, 900);
        break;
      case 'clean':
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.12 * vol, i * 0.06));
        break;
      case 'vacuumOn':
        this.tone(880, 0.07, 'square', 0.06 * vol);
        this.tone(1320, 0.09, 'square', 0.06 * vol, 0.09);
        this.noise(0.9, 0.06 * vol, 'lowpass', 300, 0.15, 0.7, 1800);
        break;
      case 'vacuumOff':
        this.tone(1320, 0.07, 'square', 0.05 * vol);
        this.tone(880, 0.1, 'square', 0.05 * vol, 0.09);
        break;
      case 'unroll':
        if (!this.throttle('unroll', 400)) return;
        this.noise(0.35, 0.12 * vol, 'bandpass', 3200, 0, 1.5, 1400);
        this.noise(0.25, 0.08 * vol, 'bandpass', 2400, 0.18, 1.5, 1200);
        break;
      // Footsteps: soft thuds for humans, light clicks for Tofu's paws.
      case 'step':
        this.noise(0.06, 0.07 * vol, 'bandpass', 1100 + Math.random() * 300, 0, 1.4);
        this.tone(105 + Math.random() * 20, 0.06, 'sine', 0.05 * vol, 0, 70);
        break;
      case 'stepGrass':
        this.noise(0.09, 0.06 * vol, 'lowpass', 700 + Math.random() * 200, 0, 0.8);
        break;
      case 'paw':
        this.noise(0.03, 0.05 * vol, 'bandpass', 2600 + Math.random() * 600, 0, 2.5);
        break;
      case 'pawGrass':
        this.noise(0.05, 0.04 * vol, 'lowpass', 1300 + Math.random() * 300, 0, 0.8);
        break;
      case 'pawMud':
        this.noise(0.07, 0.07 * vol, 'bandpass', 600, 0, 3, 350);
        break;
      case 'scrub':
        if (!this.throttle('scrub', 180)) return;
        this.noise(0.14, 0.08 * vol, 'bandpass', 2500, 0, 3);
        break;
      case 'door':
        this.noise(0.08, 0.3 * vol, 'bandpass', 500, 0, 3);
        this.tone(180, 0.1, 'triangle', 0.15 * vol, 0, 120);
        break;
      case 'creak':
        this.tone(300, 0.35, 'sawtooth', 0.04 * vol, 0, 420);
        break;
      case 'meow': {
        if (!this.throttle('meow', 600)) return;
        const c = this.ctx;
        const t = this.now();
        const o = c.createOscillator();
        const g = c.createGain();
        const f = c.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(520, t);
        o.frequency.linearRampToValueAtTime(820, t + 0.15);
        o.frequency.linearRampToValueAtTime(560, t + 0.45);
        f.type = 'bandpass';
        f.frequency.setValueAtTime(1200, t);
        f.frequency.linearRampToValueAtTime(2200, t + 0.2);
        f.frequency.linearRampToValueAtTime(900, t + 0.45);
        f.Q.value = 4;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18 * vol, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(f);
        f.connect(g);
        g.connect(this.sfxBus);
        o.start(t);
        o.stop(t + 0.55);
        break;
      }
      case 'hiss':
        if (!this.throttle('hiss', 400)) return;
        this.noise(0.5, 0.25 * vol, 'highpass', 3500, 0, 0.8);
        break;
      case 'zoomies':
        this.tone(300, 0.5, 'sawtooth', 0.12 * vol, 0, 1200);
        this.noise(0.6, 0.2 * vol, 'bandpass', 800, 0, 1, 3000);
        this.tone(600, 0.15, 'square', 0.08 * vol, 0.45, 900);
        break;
      case 'whoosh':
        this.noise(0.25, 0.2 * vol, 'bandpass', 600, 0, 1.5, 2400);
        break;
      case 'crunch':
        for (let i = 0; i < 3; i++) this.noise(0.06, 0.25 * vol, 'bandpass', 1800 + i * 300, i * 0.09, 2);
        break;
      case 'slip':
        this.tone(1300, 0.45, 'sine', 0.15 * vol, 0, 280);
        this.tone(110, 0.2, 'sine', 0.35 * vol, 0.42, 60);
        break;
      case 'task':
        [784, 988, 1175].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16 * vol, i * 0.08));
        break;
      case 'taskLost':
        this.tone(440, 0.25, 'triangle', 0.14 * vol, 0, 330);
        break;
      case 'secret':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.08 * vol, i * 0.09));
        break;
      case 'steal':
        this.tone(700, 0.08, 'square', 0.08 * vol, 0, 1100);
        this.tone(900, 0.1, 'square', 0.06 * vol, 0.08, 1400);
        break;
      case 'alarm':
        this.tone(880, 0.12, 'square', 0.07 * vol);
        this.tone(660, 0.12, 'square', 0.07 * vol, 0.13);
        break;
      case 'doorbell':
        this.bell(659, 0, vol);
        this.bell(523, 0.45, vol);
        break;
      case 'beep':
        this.tone(660, 0.15, 'sine', 0.2 * vol);
        break;
      case 'go':
        this.tone(1046, 0.35, 'triangle', 0.22 * vol);
        this.tone(1568, 0.3, 'triangle', 0.12 * vol, 0.05);
        break;
      case 'win':
        [523, 659, 784, 1047, 988, 1047, 1319].forEach((f, i) => this.tone(f, i === 6 ? 0.6 : 0.2, 'triangle', 0.16 * vol, i * 0.13));
        break;
      case 'lose':
        [392, 370, 349, 330].forEach((f, i) => this.tone(f, i === 3 ? 0.7 : 0.3, 'sawtooth', 0.08 * vol, i * 0.3, i === 3 ? 260 : undefined));
        break;
      case 'click':
        this.tone(1200, 0.04, 'square', 0.05 * vol);
        break;
      case 'pet':
        this.tone(880, 0.12, 'sine', 0.1 * vol, 0, 1100);
        break;
      case 'treat':
        this.tone(1200, 0.06, 'triangle', 0.12 * vol);
        this.noise(0.15, 0.08 * vol, 'bandpass', 1500, 0.02, 1);
        break;
      case 'chaos':
        if (!this.throttle('chaos', 90)) return;
        this.tone(1500, 0.06, 'square', 0.04 * vol, 0, 1900);
        break;
      case 'boop':
        this.tone(900, 0.08, 'sine', 0.15 * vol, 0, 1500);
        this.hiss();
        break;
      case 'startle':
        this.tone(500, 0.2, 'sawtooth', 0.08 * vol, 0, 900);
        break;
    }
  }

  private hiss() {
    this.noise(0.3, 0.15, 'highpass', 4000, 0.03);
  }

  private bell(freq: number, at: number, vol: number) {
    this.tone(freq, 1.2, 'sine', 0.25 * vol, at);
    this.tone(freq * 2.01, 0.8, 'sine', 0.08 * vol, at);
    this.tone(freq * 3.02, 0.5, 'sine', 0.04 * vol, at);
  }

  // --- Music: a cheerful procedural loop (I - V - vi - IV) ------------------

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextBeat = this.now() + 0.1;
    this.beat = 0;
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      while (this.nextBeat < this.now() + 0.25) {
        this.scheduleBeat(this.nextBeat, this.beat);
        const bpm = this.tense ? 150 : 116;
        this.nextBeat += 60 / bpm / 2;
        this.beat++;
      }
      this.musicTimer = window.setTimeout(tick, 60);
    };
    tick();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearTimeout(this.musicTimer);
  }

  setTense(t: boolean) {
    this.tense = t;
  }

  private scheduleBeat(t: number, b: number) {
    const c = this.ctx!;
    const chords = [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]];
    const bar = Math.floor(b / 8) % 4;
    const step = b % 8;
    const chord = chords[bar];
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    const env = (o: OscillatorNode, vol: number, dur: number, type: OscillatorType, f: number) => {
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    // Bass on beats 0 and 4.
    if (step === 0 || step === 4) env(c.createOscillator(), 0.22, 0.32, 'triangle', midi(chord[0] - 24));
    // Plucky arpeggio.
    const arp = [0, 1, 2, 1, 0, 2, 1, 2];
    env(c.createOscillator(), 0.06, 0.16, 'square', midi(chord[arp[step]] + 12));
    // Off-beat "tss".
    if (step % 2 === 1 && this.noiseBuf) {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = c.createGain();
      g.gain.setValueAtTime(0.03, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.06);
    }
    // Little melody every other bar.
    if (bar % 2 === 1 && (step === 0 || step === 3 || step === 6)) {
      const notes = [chord[2] + 12, chord[1] + 12, chord[0] + 12];
      env(c.createOscillator(), 0.05, 0.25, 'triangle', midi(notes[step / 3]));
    }
  }
}

export const sfx = new Sfx();
