// Sound, all synthesised with WebAudio — no audio files, no network.
// Buses: Master <- Music, SFX, UI (audio-design skill: sliders map to gain
// squared, music ducks under big events, repeated SFX vary in pitch). The
// music is a small step sequencer: a bass line and hats, with a tense layer
// that fades in as the wanted level rises.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.intensity = 0; // 0 calm, 1 full chase
    this.engineLevel = 0;
    this.sirenOn = false;
    this._step = 0;
    this._nextStepTime = 0;
    this._bassNotes = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 73.42, 0, 65.41, 0];
    this._hatPattern = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1];
  }

  // Must be called from a user gesture at least once; browsers block audio
  // before that. Safe to call repeatedly — it builds the graph once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    // Engine hum: two detuned saws through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 75;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxBus);
    this.engineOsc.start();
    this.engineOsc2.start();
    // Siren: a triangle that alternates between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxBus);
    this.sirenOsc.start();
    this._sirenPhase = 0;
    this._nextStepTime = this.ctx.currentTime + 0.1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  setEngine(speed01, on) {
    if (!this.ctx) return;
    const target = on ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    const f = 48 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(f * 1.5, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenOn = on;
    // Quiet enough to sit under the music, loud enough to read as danger.
    this.sirenGain.gain.setTargetAtTime(on ? 0.032 : 0, this.ctx.currentTime, 0.2);
  }

  setIntensity(v) {
    this.intensity = v;
    if (this.musicBus) {
      // Duck the music a little when the chase layer is loud.
      this.musicBus.gain.setTargetAtTime(0.5 - v * 0.12, this.ctx.currentTime, 0.5);
    }
  }

  // One-shot helpers. Each varies pitch slightly (audio-design: no two
  // identical repeats) and routes through the SFX bus.
  blip(freq, dur, type = 'square', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq * (0.94 + Math.random() * 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, filterFreq = 1800) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
  }

  shoot() { this.noiseBurst(0.12, 0.5, 2600); this.blip(180, 0.08, 'square', 0.1); }
  punch() { this.noiseBurst(0.07, 0.3, 900); }
  pickup() { this.blip(660, 0.09, 'sine', 0.16); this.blip(990, 0.12, 'sine', 0.14); }
  crash() { this.noiseBurst(0.25, 0.5, 700); this.blip(70, 0.2, 'sine', 0.25); }
  horn() { this.blip(370, 0.25, 'square', 0.1); this.blip(466, 0.25, 'square', 0.08); }
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.16), i * 110)); }
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.14), i * 130)); }
  click() { this.blip(880, 0.05, 'sine', 0.1); }

  // Step sequencer, called every frame: schedules bass + hats ahead of time.
  update() {
    if (!this.ctx || !this.musicOn || this.muted) return;
    const stepDur = 60 / 112 / 2; // 112 BPM, eighth notes
    while (this._nextStepTime < this.ctx.currentTime + 0.12) {
      const t = this._nextStepTime;
      const i = this._step % 16;
      const bass = this._bassNotes[i];
      if (bass) this._note(bass, t, stepDur * 1.8, 'triangle', 0.16);
      if (this._hatPattern[i]) this._hat(t, stepDur * 0.4);
      // Chase layer: a tense high pulse on the off-beats when wanted.
      if (this.intensity > 0.4 && i % 4 === 2) {
        this._note(220 + this.intensity * 110, t, 0.1, 'sawtooth', 0.05 * this.intensity);
      }
      this._step++;
      this._nextStepTime += stepDur;
    }
    // Siren wail: alternate tone every half second while on.
    if (this.sirenOn) {
      this._sirenPhase += 1 / 60;
      if (this._sirenPhase > 0.45) {
        this._sirenPhase = 0;
        const f = this.sirenOsc.frequency.value > 800 ? 700 : 950;
        this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
      }
    }
  }

  _note(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _hat(t, dur) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.5;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(t);
  }
}
