import { sfx } from "./sfx.ts";

/**
 * Environmental ambience: a filtered-noise bed (wind, rustle, rumble) plus sparse
 * one-shot details (birds, drips, bells), chosen per area and crossfaded.
 */
interface Profile {
  bed: { type: BiquadFilterType; freq: number; q: number; level: number; wobble: number };
  events: { kind: "bird" | "drip" | "bell" | "owl" | "creak" | "chime"; every: [number, number]; level: number }[];
}

const PROFILES: Record<string, Profile> = {
  town: { bed: { type: "lowpass", freq: 500, q: 0.5, level: 0.035, wobble: 0.3 }, events: [{ kind: "bird", every: [4, 9], level: 0.05 }, { kind: "bell", every: [40, 70], level: 0.05 }] },
  fields: { bed: { type: "bandpass", freq: 700, q: 0.4, level: 0.05, wobble: 0.5 }, events: [{ kind: "bird", every: [2.5, 6], level: 0.06 }] },
  forest: { bed: { type: "bandpass", freq: 1800, q: 0.6, level: 0.045, wobble: 0.7 }, events: [{ kind: "bird", every: [2, 5], level: 0.05 }, { kind: "owl", every: [25, 45], level: 0.05 }] },
  ruins: { bed: { type: "bandpass", freq: 380, q: 1.2, level: 0.06, wobble: 0.8 }, events: [{ kind: "creak", every: [10, 22], level: 0.05 }] },
  caves: { bed: { type: "lowpass", freq: 160, q: 0.7, level: 0.09, wobble: 0.2 }, events: [{ kind: "drip", every: [1.2, 4], level: 0.06 }] },
  dungeon: { bed: { type: "lowpass", freq: 140, q: 0.8, level: 0.09, wobble: 0.15 }, events: [{ kind: "drip", every: [2, 6], level: 0.05 }, { kind: "creak", every: [14, 26], level: 0.04 }] },
  skyreach: { bed: { type: "highpass", freq: 1500, q: 0.4, level: 0.03, wobble: 0.6 }, events: [{ kind: "chime", every: [5, 11], level: 0.04 }] },
  storm: { bed: { type: "bandpass", freq: 420, q: 0.5, level: 0.075, wobble: 0.9 }, events: [{ kind: "creak", every: [6, 14], level: 0.06 }, { kind: "chime", every: [12, 24], level: 0.03 }] },
};

class Ambience {
  private current?: string;
  private bus?: GainNode;
  private src?: AudioBufferSourceNode;
  private timers: number[] = [];

  play(name: string) {
    if (!PROFILES[name] || name === this.current) return;
    const ctx = sfx.context;
    if (!ctx || !sfx.out) {
      const retry = () => {
        this.current = undefined;
        this.play(name);
      };
      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("keydown", retry, { once: true });
      return;
    }
    this.stop();
    this.current = name;
    const p = PROFILES[name];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.5);
    bus.connect(sfx.out);
    this.bus = bus;
    // Noise bed with a slow wobble, like wind gusts.
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < len; i++) {
      b0 = 0.98 * b0 + 0.02 * (Math.random() * 2 - 1);
      d[i] = b0 * 6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = p.bed.type;
    f.frequency.value = p.bed.freq;
    f.Q.value = p.bed.q;
    const g = ctx.createGain();
    g.gain.value = p.bed.level;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.bed.level * p.bed.wobble;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(bus);
    src.start();
    lfo.start();
    this.src = src;
    for (const ev of p.events) this.schedule(ev);
  }

  private schedule(ev: Profile["events"][number]) {
    const delay = (ev.every[0] + Math.random() * (ev.every[1] - ev.every[0])) * 1000;
    const id = window.setTimeout(() => {
      this.fire(ev.kind, ev.level);
      if (this.timers.includes(id)) this.schedule(ev);
    }, delay);
    this.timers.push(id);
  }

  private fire(kind: string, level: number) {
    const ctx = sfx.context;
    if (!ctx || !this.bus) return;
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.bus);
    const tone = (f0: number, f1: number, at: number, dur: number, lvl: number, type: OscillatorType = "sine") => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + at);
      o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(lvl, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(pan);
      o.start(t + at);
      o.stop(t + at + dur + 0.05);
    };
    switch (kind) {
      case "bird": {
        const base = 2600 + Math.random() * 1600;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) tone(base * (1 + Math.random() * 0.2), base * (1.3 + Math.random() * 0.4), i * 0.11, 0.08, level);
        break;
      }
      case "owl":
        tone(420, 380, 0, 0.35, level);
        tone(420, 360, 0.5, 0.5, level);
        break;
      case "drip":
        tone(1400 + Math.random() * 900, 500, 0, 0.12, level);
        break;
      case "bell":
        for (const [m, l] of [[1, 1], [2.76, 0.4], [5.4, 0.2]]) tone(330 * m, 330 * m * 0.998, 0, 3.5, level * l);
        break;
      case "creak":
        tone(160 + Math.random() * 60, 110, 0, 0.7, level, "sawtooth");
        break;
      case "chime":
        tone(1568, 1560, 0, 1.8, level);
        tone(2093, 2090, 0.15, 1.6, level * 0.7);
        break;
    }
  }

  stop() {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    const ctx = sfx.context;
    const bus = this.bus;
    const src = this.src;
    this.current = undefined;
    this.bus = undefined;
    this.src = undefined;
    if (!ctx || !bus) return;
    bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
    setTimeout(() => {
      src?.stop();
      bus.disconnect();
    }, 3000);
  }
}

export const ambience = new Ambience();
