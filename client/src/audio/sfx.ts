/**
 * Synthesized sound effects (WebAudio). No audio files: every sound is built from
 * oscillators and filtered noise, positioned relative to the listener.
 */
export type Material = "flesh" | "metal" | "wood";
export type Surface = "stone" | "grass" | "soft";

/** Random ±`amt` variation so repeated sounds never repeat exactly. */
const vary = (v: number, amt = 0.08) => v * (1 - amt + Math.random() * amt * 2);

export class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  /** Shared room reverb: sounds send a little signal here so nothing is bone-dry. */
  private reverb?: ConvolverNode;
  private reverbIn?: GainNode;
  private room = { wet: 0.16, size: 1.1 };
  private noise?: AudioBuffer;
  private listener = { x: 0, y: 0 };
  volume = 0.7;
  private last = new Map<string, number>();

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      this.master.connect(comp).connect(this.ctx.destination);
      this.reverb = this.ctx.createConvolver();
      this.reverbIn = this.ctx.createGain();
      this.reverbIn.gain.value = this.room.wet;
      this.reverbIn.connect(this.reverb).connect(this.master);
      this.buildImpulse();
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = undefined;
    }
  }

  /** Synthesized room impulse: decaying stereo noise, darker as it fades. */
  private buildImpulse() {
    const ctx = this.ctx;
    if (!ctx || !this.reverb) return;
    const len = Math.floor(ctx.sampleRate * this.room.size);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // One-pole lowpass that closes over time: early reflections bright, tail soft.
        const k = 0.55 - 0.45 * t;
        lp += k * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.pow(1 - t, 2.6);
      }
    }
    this.reverb.buffer = ir;
  }

  /** Dungeons ring; open fields barely do. */
  setRoom(kind: "open" | "town" | "cave") {
    const r = kind === "cave" ? { wet: 0.34, size: 2.2 } : kind === "town" ? { wet: 0.18, size: 1.2 } : { wet: 0.12, size: 0.9 };
    if (r.wet === this.room.wet && r.size === this.room.size) return;
    this.room = r;
    if (this.reverbIn && this.ctx) this.reverbIn.gain.setTargetAtTime(r.wet, this.ctx.currentTime, 0.4);
    this.buildImpulse();
  }

  setListener(x: number, y: number) {
    this.listener.x = x;
    this.listener.y = y;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  get context() {
    return this.ctx;
  }

  get out() {
    return this.master;
  }

  /** Output node for a sound at a world position (distance falloff + stereo pan). Undefined if inaudible. */
  private bus(x?: number, y?: number, gain = 1): AudioNode | undefined {
    const ctx = this.ctx;
    if (!ctx || !this.master) return undefined;
    let vol = gain;
    let pan = 0;
    if (x !== undefined && y !== undefined) {
      const dx = x - this.listener.x;
      const dy = y - this.listener.y;
      const d = Math.hypot(dx, dy);
      if (d > 700) return undefined;
      vol *= Math.max(0, 1 - d / 700) ** 1.3;
      pan = Math.max(-0.8, Math.min(0.8, dx / 400));
    }
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.master);
    if (this.reverbIn) p.connect(this.reverbIn);
    return g;
  }

  /** Throttle identical sounds (e.g. many hits on one frame). */
  private allow(key: string, ms: number) {
    const now = performance.now();
    if ((this.last.get(key) ?? 0) + ms > now) return false;
    this.last.set(key, now);
    return true;
  }

  private noiseSrc(dur: number) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise!;
    src.loop = true;
    src.loopStart = Math.random() * 0.5;
    const t = this.ctx!.currentTime;
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    return src;
  }

  private env(g: GainNode, peak: number, attack: number, decay: number) {
    const t = this.ctx!.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(out: AudioNode, type: OscillatorType, f0: number, f1: number, peak: number, attack: number, decay: number, delay = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  /** Filtered noise burst. */
  private noiseHit(out: AudioNode, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number, delay = 0) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    const t = ctx.currentTime + delay;
    src.start(t, Math.random() * 0.8);
    src.stop(t + attack + decay + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(out);
  }

  private whoosh(out: AudioNode, f0: number, f1: number, dur: number, peak: number, q = 1.2) {
    const ctx = this.ctx!;
    const src = this.noiseSrc(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    const t = ctx.currentTime;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g, peak, dur * 0.35, dur * 0.65);
    src.connect(bp).connect(g).connect(out);
  }

  /** A swing's whoosh, shaped by the weapon: knives whip, greatswords push air, staffs hum. */
  swing(weight: number, x?: number, y?: number, weapon = "sword") {
    const out = this.bus(x, y, 0.8);
    if (!out) return;
    const heavy = weight > 0.5;
    switch (weapon) {
      case "daggers":
        this.whoosh(out, vary(1800), vary(5200), 0.09, 0.3, 2.2);
        break;
      case "greatsword":
        this.whoosh(out, vary(300), vary(1100), heavy ? 0.38 : 0.3, 0.55, 0.7);
        this.whoosh(out, vary(900), vary(2200), 0.2, 0.18, 1.4);
        break;
      case "spear":
        this.whoosh(out, vary(700), vary(3600), 0.13, 0.36, 1.8);
        break;
      case "staff":
        this.whoosh(out, vary(600), vary(1800), 0.22, 0.28, 1.1);
        this.tone(out, "sine", vary(660), vary(990), 0.06, 0.03, 0.2);
        break;
      default:
        this.whoosh(out, vary(heavy ? 500 : 900), vary(heavy ? 1600 : 3000), heavy ? 0.26 : 0.15, heavy ? 0.5 : 0.36, heavy ? 0.9 : 1.6);
    }
  }

  /**
   * A hit, in layers: a sharp transient (the contact), a body (the material) and a low thump
   * (the weight). Metal rings, wood knocks, flesh thuds.
   */
  hit(heavy: boolean, x?: number, y?: number, crit = false, material: Material = "flesh") {
    if (!this.allow("hit", 30)) return;
    const out = this.bus(x, y, 1);
    if (!out) return;
    const w = heavy ? 1 : 0.7;
    // Transient.
    this.noiseHit(out, "highpass", vary(3200), 0.7, 0.55 * w, 0.001, 0.02);
    // Body.
    if (material === "metal") {
      this.noiseHit(out, "bandpass", vary(2400), 3, 0.35 * w, 0.001, 0.07);
      const f = vary(heavy ? 820 : 1100, 0.12);
      for (const [m, g] of [[1, 0.2], [2.76, 0.09], [5.4, 0.05]] as const) this.tone(out, "sine", f * m, f * m * 0.99, g * w, 0.001, heavy ? 0.5 : 0.32);
    } else if (material === "wood") {
      this.noiseHit(out, "bandpass", vary(900), 2.2, 0.45 * w, 0.001, 0.06);
      this.tone(out, "triangle", vary(420), vary(260), 0.25 * w, 0.001, 0.08);
    } else {
      this.noiseHit(out, "bandpass", vary(heavy ? 700 : 1000), 1.1, 0.6 * w, 0.002, heavy ? 0.12 : 0.08);
    }
    // Weight.
    this.tone(out, "sine", vary(heavy ? 120 : 170), 40, heavy ? 0.95 : 0.55, 0.003, heavy ? 0.24 : 0.12);
    if (crit) {
      this.tone(out, "triangle", vary(1900), 900, 0.24, 0.002, 0.2);
      this.tone(out, "sine", 70, 35, 0.7, 0.004, 0.35);
    }
  }

  /** The killing blow: a heavy crunch, a low drop and a bright ring-out. */
  kill(x?: number, y?: number) {
    if (!this.allow("kill", 60)) return;
    const out = this.bus(x, y, 0.9);
    if (!out) return;
    this.noiseHit(out, "lowpass", 1400, 0.8, 0.6, 0.002, 0.22);
    this.tone(out, "sine", 95, 38, 0.8, 0.004, 0.4);
    this.tone(out, "triangle", vary(1320, 0.04), vary(1180, 0.04), 0.1, 0.004, 0.5, 0.03);
    this.tone(out, "sine", vary(1980, 0.04), vary(1760, 0.04), 0.06, 0.004, 0.6, 0.05);
  }

  /** Pigeons taking off: a burst of soft wingbeats. */
  flutter(x?: number, y?: number) {
    if (!this.allow("flutter", 400)) return;
    const out = this.bus(x, y, 0.5);
    if (!out) return;
    for (let i = 0; i < 6; i++) this.noiseHit(out, "bandpass", vary(1400, 0.25), 1.2, 0.3, 0.004, 0.04, i * 0.055 + Math.random() * 0.02);
  }

  /** Low health: a heartbeat (lub-dub). */
  heartbeat(strength = 1) {
    const out = this.bus(undefined, undefined, 0.55 * strength);
    if (!out) return;
    this.tone(out, "sine", 62, 44, 0.9, 0.01, 0.16);
    this.tone(out, "sine", 56, 40, 0.65, 0.01, 0.14, 0.17);
  }

  /** The parry: a bright metallic ring. The perfect version is brighter, longer, with a rising shimmer. */
  parry(perfect: boolean, x?: number, y?: number) {
    const out = this.bus(x, y, 1);
    if (!out) return;
    const base = perfect ? 1560 : 1320;
    const partials = perfect ? [1, 1.5, 2.01, 2.76, 4.1] : [1, 1.51, 2.02];
    partials.forEach((m, i) => this.tone(out, i === 0 ? "triangle" : "sine", base * m, base * m * 0.985, (perfect ? 0.34 : 0.3) / (i + 1), 0.002, perfect ? 0.95 : 0.45));
    const ctx = this.ctx!;
    const src = this.noiseSrc(0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3500;
    const g = ctx.createGain();
    this.env(g, 0.6, 0.001, 0.05);
    src.connect(hp).connect(g).connect(out);
    if (perfect) {
      this.tone(out, "sine", 2400, 4800, 0.16, 0.05, 0.4, 0.04);
      this.tone(out, "sine", 3600, 7200, 0.1, 0.05, 0.45, 0.09);
      this.tone(out, "sine", 110, 55, 0.6, 0.004, 0.3);
    }
  }

  dodge(x?: number, y?: number) {
    const out = this.bus(x, y, 0.7);
    if (out) this.whoosh(out, 2400, 600, 0.2, 0.4, 0.8);
  }

  /** Footsteps: stone clicks, grass brushes, sand and dirt are soft. */
  step(x?: number, y?: number, soft = false, surface: Surface = "stone") {
    if (!this.allow(`step${x}`, 90)) return;
    const out = this.bus(x, y, soft ? 0.12 : 0.2);
    if (!out) return;
    if (surface === "stone") {
      this.noiseHit(out, "bandpass", vary(1900, 0.2), 1.4, 0.45, 0.001, 0.03);
      this.noiseHit(out, "lowpass", vary(600, 0.2), 0.7, 0.4, 0.002, 0.04);
    } else if (surface === "grass") {
      this.noiseHit(out, "highpass", vary(2600, 0.2), 0.6, 0.18, 0.01, 0.07);
      this.noiseHit(out, "lowpass", vary(380, 0.2), 0.7, 0.35, 0.004, 0.05);
    } else {
      this.noiseHit(out, "lowpass", vary(700, 0.2), 0.8, 0.5, 0.004, 0.06);
    }
  }

  /** Attack telegraph: gold glint is a clear high ting; red is a low warning. */
  glint(parryable: boolean, x?: number, y?: number) {
    const out = this.bus(x, y, 0.7);
    if (!out) return;
    if (parryable) {
      this.tone(out, "sine", 2900, 2800, 0.22, 0.003, 0.25);
      this.tone(out, "sine", 4350, 4300, 0.08, 0.003, 0.2);
    } else {
      this.tone(out, "sawtooth", 220, 180, 0.12, 0.01, 0.3);
      this.tone(out, "sine", 110, 90, 0.3, 0.01, 0.35);
    }
  }

  shoot(kind: "bow" | "magic" | "knife" | "shadow", x?: number, y?: number) {
    const out = this.bus(x, y, 0.6);
    if (!out) return;
    if (kind === "bow") {
      this.tone(out, "triangle", 420, 180, 0.3, 0.002, 0.12);
      this.whoosh(out, 3000, 1500, 0.12, 0.2);
    } else if (kind === "magic") {
      this.tone(out, "sine", 900, 1800, 0.25, 0.01, 0.16);
      this.tone(out, "triangle", 1350, 2700, 0.1, 0.01, 0.14);
    } else if (kind === "shadow") {
      this.tone(out, "sawtooth", 300, 150, 0.12, 0.02, 0.3);
    } else {
      this.whoosh(out, 4000, 2000, 0.08, 0.25);
    }
  }

  boom(big: boolean, x?: number, y?: number) {
    const out = this.bus(x, y, 1);
    if (!out) return;
    const ctx = this.ctx!;
    this.tone(out, "sine", big ? 90 : 130, 30, big ? 1 : 0.7, 0.005, big ? 0.6 : 0.35);
    const src = this.noiseSrc(big ? 0.7 : 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(big ? 1600 : 2200, ctx.currentTime);
    lp.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + (big ? 0.6 : 0.35));
    const g = ctx.createGain();
    this.env(g, big ? 0.8 : 0.5, 0.005, big ? 0.6 : 0.3);
    src.connect(lp).connect(g).connect(out);
  }

  hurt(x?: number, y?: number) {
    const out = this.bus(x, y, 0.8);
    if (!out) return;
    this.tone(out, "sawtooth", 180, 90, 0.25, 0.005, 0.18);
    this.hit(false, x, y);
  }

  death(x?: number, y?: number, big = false) {
    const out = this.bus(x, y, 0.8);
    if (!out) return;
    this.tone(out, "triangle", big ? 300 : 500, big ? 60 : 140, 0.3, 0.01, big ? 1.2 : 0.4);
    if (big) this.boom(true, x, y);
  }

  roar(x?: number, y?: number) {
    const out = this.bus(x, y, 0.9);
    if (!out) return;
    this.tone(out, "sawtooth", 90, 60, 0.35, 0.1, 0.9);
    this.tone(out, "sawtooth", 135, 95, 0.2, 0.1, 0.9);
    this.whoosh(out, 400, 200, 0.9, 0.3, 0.6);
  }

  howl(x?: number, y?: number) {
    const out = this.bus(x, y, 0.7);
    if (!out) return;
    this.tone(out, "sine", 420, 780, 0.25, 0.25, 0.9);
  }

  chime(rarity: number) {
    const out = this.bus(undefined, undefined, 0.6);
    if (!out) return;
    const notes = [523, 659, 784, 1047, 1319];
    for (let i = 0; i <= Math.min(4, rarity + 1); i++) this.tone(out, "sine", notes[i], notes[i], 0.2, 0.005, 0.5 + rarity * 0.1, i * 0.07);
  }

  levelUp() {
    const out = this.bus(undefined, undefined, 0.6);
    if (!out) return;
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(out, "triangle", f, f, 0.22, 0.01, 0.6, i * 0.09));
  }

  ui() {
    const out = this.bus(undefined, undefined, 0.3);
    if (out) this.tone(out, "sine", 900, 700, 0.15, 0.002, 0.06);
  }
}

export const sfx = new Sfx();
