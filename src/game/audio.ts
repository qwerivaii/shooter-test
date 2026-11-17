export class AudioEngine {
  private actx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  private init(): void {
    if (this.actx || typeof window === 'undefined') return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    this.actx = new AC();
    this.master = this.actx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.actx.destination);

    const len = Math.floor(this.actx.sampleRate * 1.0);
    this.noiseBuffer = this.actx.createBuffer(1, len, this.actx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  private now(): number {
    return this.actx ? this.actx.currentTime : 0;
  }

  private env(node: AudioNode, t0: number, a: number, d: number, peak = 1): void {
    if (!this.actx || !this.master) return;
    const g = this.actx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g);
    g.connect(this.master);
  }

  resume(): void {
    this.init();
    if (this.actx && this.actx.state === 'suspended') {
      void this.actx.resume();
    }
  }

  suspend(): void {
    if (this.actx && this.actx.state === 'running') {
      void this.actx.suspend();
    }
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.master && this.actx) {
      this.master.gain.setValueAtTime(
        this._muted ? 0 : 0.5,
        this.actx.currentTime,
      );
    }
    return this._muted;
  }

  laser(): void {
    if (!this.actx || this._muted) return;
    const t = this.now();
    const o = this.actx.createOscillator();
    o.type = 'square';
    const f0 = 820 + Math.random() * 120;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.1);
    this.env(o, t, 0.004, 0.09, 0.15);
    o.start(t);
    o.stop(t + 0.14);
  }

  explosion(big = false): void {
    if (!this.actx || !this.noiseBuffer || this._muted) return;
    const t = this.now();
    const dur = big ? 0.75 : 0.28;
    const src = this.actx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const lp = this.actx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(big ? 1800 : 3200, t);
    lp.frequency.exponentialRampToValueAtTime(big ? 90 : 260, t + dur);
    lp.Q.value = big ? 4 : 1.2;

    src.connect(lp);
    this.env(lp, t, 0.01, dur, big ? 0.85 : 0.45);

    if (big) {
      const o = this.actx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
      this.env(o, t, 0.02, 0.6, 0.5);
      o.start(t);
      o.stop(t + 0.8);
    }

    src.start(t);
    src.stop(t + dur + 0.05);
  }

  powerup(): void {
    if (!this.actx || !this.master || this._muted) return;
    const t = this.now();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      if (!this.actx || !this.master) return;
      const o = this.actx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t + i * 0.055);
      const g = this.actx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.22, t + i * 0.055 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.055 + 0.14);
      o.connect(g);
      g.connect(this.master);
      o.start(t + i * 0.055);
      o.stop(t + i * 0.055 + 0.18);
    });
  }

  hurt(): void {
    if (!this.actx || this._muted) return;
    const t = this.now();
    const o = this.actx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    this.env(o, t, 0.005, 0.25, 0.3);
    o.start(t);
    o.stop(t + 0.3);
  }

  gameOver(): void {
    if (!this.actx || !this.master || this._muted) return;
    const t = this.now();
    const seq = [392.0, 329.63, 261.63, 196.0, 130.81];
    seq.forEach((f, i) => {
      if (!this.actx || !this.master) return;
      const o = this.actx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t + i * 0.16);
      const g = this.actx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.34);
      o.connect(g);
      g.connect(this.master);
      o.start(t + i * 0.16);
      o.stop(t + i * 0.16 + 0.4);
    });
  }

  waveStart(): void {
    if (!this.actx || this._muted) return;
    const t = this.now();
    const o = this.actx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(330, t);
    o.frequency.setValueAtTime(440, t + 0.1);
    o.frequency.setValueAtTime(660, t + 0.2);
    this.env(o, t, 0.01, 0.35, 0.14);
    o.start(t);
    o.stop(t + 0.4);
  }
}
