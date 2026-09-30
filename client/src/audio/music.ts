import { sfx } from "./sfx.ts";

/**
 * Generative music: each area has a mood (tempo, scale, chords, instruments),
 * rendered live with WebAudio and crossfaded when you move between areas.
 */
interface Track {
  bpm: number;
  root: number; // MIDI note
  scale: number[];
  chords: number[][]; // scale degrees
  pad: OscillatorType;
  padLevel: number;
  arp?: { pattern: number[]; level: number; wave: OscillatorType; octave: number };
  bass?: { level: number; pattern: number[] };
  drums?: { kick: number[]; hat?: number[]; level: number };
  drone?: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
/** Phrygian dominant: the desert's scale (a raised third over a flat second). */
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];

const TRACKS: Record<string, Track> = {
  town: { bpm: 84, root: 55, scale: MAJOR, chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4], [5, 0, 2], [3, 5, 0], [1, 3, 5], [4, 6, 1]], pad: "triangle", padLevel: 0.05, arp: { pattern: [0, 1, 2, 1, 0, 2, 1, 2], level: 0.035, wave: "sine", octave: 1 }, bass: { level: 0.06, pattern: [0, -1, -1, -1, 0, -1, 2, -1] } },
  fields: { bpm: 92, root: 57, scale: LYDIAN, chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [4, 6, 1]], pad: "triangle", padLevel: 0.045, arp: { pattern: [0, 2, 1, 2, 0, 2, 1, 3], level: 0.03, wave: "triangle", octave: 1 }, bass: { level: 0.05, pattern: [0, -1, -1, -1, -1, -1, -1, -1] } },
  forest: { bpm: 76, root: 50, scale: DORIAN, chords: [[0, 2, 4], [6, 1, 3], [3, 5, 0], [4, 6, 1]], pad: "sine", padLevel: 0.06, arp: { pattern: [0, -1, 2, -1, 1, -1, 3, -1], level: 0.03, wave: "sine", octave: 2 }, bass: { level: 0.05, pattern: [0, -1, -1, -1, 0, -1, -1, -1] } },
  ruins: { bpm: 70, root: 52, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], pad: "sine", padLevel: 0.055, arp: { pattern: [0, -1, -1, 2, -1, -1, 1, -1], level: 0.028, wave: "triangle", octave: 1 }, drone: 0.03 },
  caves: { bpm: 60, root: 45, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2]], pad: "sine", padLevel: 0.05, drone: 0.05, arp: { pattern: [4, -1, -1, -1, -1, -1, 2, -1], level: 0.02, wave: "sine", octave: 2 } },
  dungeon: { bpm: 66, root: 43, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [4, 6, 1]], pad: "sawtooth", padLevel: 0.018, drone: 0.05, drums: { kick: [1, 0, 0, 0, 0, 0, 1, 0], level: 0.2 } },
  miniboss: { bpm: 128, root: 45, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], pad: "sawtooth", padLevel: 0.02, arp: { pattern: [0, 2, 4, 2, 0, 2, 4, 6], level: 0.03, wave: "square", octave: 1 }, bass: { level: 0.08, pattern: [0, 0, -1, 0, 0, -1, 0, 3] }, drums: { kick: [1, 0, 0, 1, 1, 0, 0, 0], hat: [0, 1, 0, 1, 0, 1, 0, 1], level: 0.24 } },
  boss: { bpm: 140, root: 43, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [4, 6, 1], [0, 2, 4], [3, 5, 0], [1, 3, 5], [4, 6, 1]], pad: "sawtooth", padLevel: 0.025, drone: 0.03, arp: { pattern: [0, 4, 2, 4, 0, 4, 2, 6], level: 0.035, wave: "square", octave: 1 }, bass: { level: 0.1, pattern: [0, 0, 0, -1, 0, 0, 3, 4] }, drums: { kick: [1, 0, 1, 0, 1, 0, 1, 1], hat: [0, 1, 0, 1, 0, 1, 0, 1], level: 0.28 } },
  skyreach: { bpm: 72, root: 60, scale: LYDIAN, chords: [[0, 2, 4], [1, 3, 5], [4, 6, 1], [0, 2, 4]], pad: "sine", padLevel: 0.06, arp: { pattern: [0, 2, 4, 6, 4, 2, 1, 3], level: 0.03, wave: "sine", octave: 2 } },
  terraces: { bpm: 96, root: 62, scale: LYDIAN, chords: [[0, 2, 4], [1, 3, 5], [4, 6, 1], [0, 2, 4], [5, 0, 2], [1, 3, 5]], pad: "triangle", padLevel: 0.045, arp: { pattern: [0, 2, 4, 6, 7, 6, 4, 2], level: 0.03, wave: "sine", octave: 1 }, bass: { level: 0.05, pattern: [0, -1, -1, 4, -1, -1, 0, -1] } },
  gardens: { bpm: 80, root: 57, scale: DORIAN, chords: [[0, 2, 4], [3, 5, 0], [6, 1, 3], [4, 6, 1]], pad: "sine", padLevel: 0.055, arp: { pattern: [0, -1, 4, -1, 2, -1, 6, -1], level: 0.03, wave: "triangle", octave: 2 }, bass: { level: 0.045, pattern: [0, -1, -1, -1, 3, -1, -1, -1] } },
  causeway: { bpm: 104, root: 60, scale: MAJOR, chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], pad: "triangle", padLevel: 0.04, arp: { pattern: [0, 4, 2, 4, 7, 4, 2, 4], level: 0.032, wave: "square", octave: 1 }, bass: { level: 0.06, pattern: [0, -1, 0, -1, 4, -1, 3, -1] }, drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0], level: 0.12 } },
  storm: { bpm: 112, root: 50, scale: MINOR, chords: [[0, 2, 4], [6, 1, 3], [5, 0, 2], [4, 6, 1]], pad: "sawtooth", padLevel: 0.022, drone: 0.03, arp: { pattern: [0, 2, 4, 2, 5, 4, 2, 1], level: 0.028, wave: "square", octave: 1 }, bass: { level: 0.08, pattern: [0, 0, -1, 0, 5, -1, 4, -1] }, drums: { kick: [1, 0, 0, 1, 0, 0, 1, 0], hat: [0, 1, 0, 1, 0, 1, 0, 1], level: 0.18 } },
  // Indoors: a slow tavern waltz by the fire.
  inn: { bpm: 96, root: 57, scale: MAJOR, chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], pad: "triangle", padLevel: 0.04, arp: { pattern: [0, 2, 4, 2, 4, 2, 0, 2], level: 0.035, wave: "triangle", octave: 1 }, bass: { level: 0.05, pattern: [0, -1, -1, 4, -1, -1, 0, -1] } },
  // Floor 3: the Ember Reaches — heavy, smouldering, with a pulse like a heartbeat under the rock.
  ember: { bpm: 84, root: 45, scale: [0, 1, 4, 5, 7, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], pad: "sawtooth", padLevel: 0.02, drone: 0.045, arp: { pattern: [0, -1, 2, -1, 1, -1, 4, -1], level: 0.028, wave: "triangle", octave: 1 }, bass: { level: 0.07, pattern: [0, -1, -1, 0, -1, -1, 1, -1] }, drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0], level: 0.14 } },
  emberhold: { bpm: 78, root: 52, scale: DORIAN, chords: [[0, 2, 4], [3, 5, 0], [6, 1, 3], [4, 6, 1]], pad: "triangle", padLevel: 0.045, arp: { pattern: [0, 2, 4, 2, 1, 3, 5, 3], level: 0.03, wave: "sine", octave: 1 }, bass: { level: 0.055, pattern: [0, -1, -1, -1, 4, -1, -1, -1] } },
  dragon: { bpm: 120, root: 43, scale: [0, 1, 4, 5, 7, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [5, 0, 2], [6, 1, 3]], pad: "sawtooth", padLevel: 0.026, drone: 0.04, arp: { pattern: [0, 2, 4, 2, 1, 4, 2, 6], level: 0.03, wave: "square", octave: 1 }, bass: { level: 0.09, pattern: [0, 0, -1, 0, 1, -1, 0, 4] }, drums: { kick: [1, 0, 0, 1, 1, 0, 1, 0], hat: [0, 1, 0, 1, 0, 1, 0, 1], level: 0.22 } },
  // Floor 4: the Frostvale — sparse and glassy; the town warm by contrast; the Glacier Throne cold and grand.
  frost: { bpm: 70, root: 57, scale: DORIAN, chords: [[0, 2, 4], [6, 1, 3], [3, 5, 0], [4, 6, 1]], pad: "sine", padLevel: 0.05, arp: { pattern: [0, -1, 4, -1, 2, -1, 6, 4], level: 0.03, wave: "sine", octave: 2 }, drone: 0.025 },
  rimeholt: { bpm: 88, root: 55, scale: MAJOR, chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], pad: "triangle", padLevel: 0.045, arp: { pattern: [0, 2, 4, 2, 5, 4, 2, 1], level: 0.032, wave: "triangle", octave: 1 }, bass: { level: 0.05, pattern: [0, -1, -1, 4, -1, -1, 0, -1] } },
  glacier: { bpm: 96, root: 45, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], pad: "sawtooth", padLevel: 0.02, drone: 0.04, arp: { pattern: [0, 4, 2, 4, 7, 4, 2, 4], level: 0.03, wave: "sine", octave: 2 }, bass: { level: 0.07, pattern: [0, -1, 0, -1, 5, -1, 4, -1] }, drums: { kick: [1, 0, 0, 0, 1, 0, 0, 1], level: 0.14 } },
  // Floor 5: the Umbral Wilds — slow, hollow and uneasy; Duskhollow a lullaby by lantern-light; the Sanctum a dark procession.
  umbral: { bpm: 62, root: 50, scale: [0, 1, 3, 5, 7, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [5, 0, 2], [4, 6, 1]], pad: "sine", padLevel: 0.055, drone: 0.04, arp: { pattern: [0, -1, -1, 4, -1, 1, -1, -1], level: 0.028, wave: "sine", octave: 2 } },
  duskhollow: { bpm: 72, root: 52, scale: DORIAN, chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], pad: "triangle", padLevel: 0.045, arp: { pattern: [0, 2, 4, 2, 6, 4, 2, 1], level: 0.03, wave: "triangle", octave: 1 }, bass: { level: 0.045, pattern: [0, -1, -1, -1, 3, -1, -1, -1] } },
  sanctum: { bpm: 90, root: 43, scale: [0, 1, 3, 5, 7, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [6, 1, 3], [0, 2, 4]], pad: "sawtooth", padLevel: 0.022, drone: 0.05, arp: { pattern: [0, 4, 1, 4, 0, 4, 2, 6], level: 0.028, wave: "sine", octave: 2 }, bass: { level: 0.08, pattern: [0, -1, -1, 0, 1, -1, 0, -1] }, drums: { kick: [1, 0, 0, 0, 1, 0, 1, 0], level: 0.16 } },
  // Floor 6: the Drowned Isles — a lilting sea-shanty lilt; Saltmere a jig; the Cathedral a drowned hymn.
  tide: { bpm: 92, root: 57, scale: MIXOLYDIAN, chords: [[0, 2, 4], [6, 1, 3], [3, 5, 0], [4, 6, 1]], pad: "triangle", padLevel: 0.045, arp: { pattern: [0, 2, 4, 2, 5, 4, 2, 1], level: 0.03, wave: "sine", octave: 1 }, bass: { level: 0.05, pattern: [0, -1, -1, 4, -1, -1, 3, -1] } },
  saltmere: { bpm: 116, root: 55, scale: MAJOR, chords: [[0, 2, 4], [4, 6, 1], [0, 2, 4], [3, 5, 0], [4, 6, 1]], pad: "triangle", padLevel: 0.04, arp: { pattern: [0, 2, 4, 2, 0, 4, 2, 4], level: 0.034, wave: "triangle", octave: 1 }, bass: { level: 0.06, pattern: [0, -1, 4, -1, 0, -1, 4, -1] }, drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0], level: 0.1 } },
  cathedral: { bpm: 76, root: 45, scale: DORIAN, chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], pad: "sine", padLevel: 0.06, drone: 0.05, arp: { pattern: [0, -1, 2, -1, 4, -1, 2, -1], level: 0.028, wave: "sine", octave: 2 }, bass: { level: 0.06, pattern: [0, -1, -1, -1, 5, -1, -1, -1] }, drums: { kick: [1, 0, 0, 0, 0, 0, 1, 0], level: 0.12 } },
  // Floor 7: the Clockwork Heights — a ticking, mechanical ostinato; Gearhaven a music-box waltz; the Engine a pounding march.
  brass: { bpm: 104, root: 50, scale: DORIAN, chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], pad: "triangle", padLevel: 0.035, arp: { pattern: [0, 4, 0, 4, 2, 4, 2, 5], level: 0.032, wave: "square", octave: 1 }, bass: { level: 0.06, pattern: [0, -1, 0, -1, 4, -1, 4, -1] }, drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0], hat: [1, 1, 1, 1, 1, 1, 1, 1], level: 0.08 } },
  gearhaven: { bpm: 90, root: 60, scale: MAJOR, chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]], pad: "sine", padLevel: 0.035, arp: { pattern: [0, 2, 4, 7, 4, 2, 0, 2], level: 0.036, wave: "triangle", octave: 2 }, bass: { level: 0.045, pattern: [0, -1, -1, 4, -1, -1, 4, -1] } },
  // Floor 8: the Sunscorched Sands — a slow hijaz melody over a drone; Sunwell a lilting market tune; the Pyramid a solemn procession.
  sands: { bpm: 88, root: 50, scale: HIJAZ, chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], pad: "sine", padLevel: 0.04, drone: 0.035, arp: { pattern: [0, 1, 2, 1, 4, 2, 1, 0], level: 0.034, wave: "triangle", octave: 1 }, bass: { level: 0.05, pattern: [0, -1, -1, 0, -1, -1, 4, -1] }, drums: { kick: [1, 0, 0, 1, 0, 0, 1, 0], hat: [0, 0, 1, 0, 0, 1, 0, 0], level: 0.07 } },
  sunwell: { bpm: 100, root: 57, scale: HIJAZ, chords: [[0, 2, 4], [3, 5, 0], [1, 3, 5], [0, 2, 4]], pad: "triangle", padLevel: 0.035, arp: { pattern: [0, 2, 1, 2, 4, 2, 1, 2], level: 0.036, wave: "triangle", octave: 2 }, bass: { level: 0.045, pattern: [0, -1, 4, -1, 0, -1, 4, -1] }, drums: { kick: [1, 0, 0, 1, 0, 1, 0, 0], hat: [0, 1, 1, 0, 1, 0, 1, 1], level: 0.06 } },
  pyramid: { bpm: 72, root: 45, scale: HIJAZ, chords: [[0, 2, 4], [1, 3, 5], [5, 0, 2], [0, 2, 4]], pad: "sawtooth", padLevel: 0.024, drone: 0.05, arp: { pattern: [0, -1, 1, -1, 4, -1, 1, -1], level: 0.03, wave: "sine", octave: 1 }, bass: { level: 0.08, pattern: [0, -1, -1, -1, 0, -1, 1, -1] }, drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 0, 0, 0, 0, 1, 0], level: 0.14 } },
  engine: { bpm: 124, root: 43, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [4, 6, 1]], pad: "sawtooth", padLevel: 0.022, drone: 0.04, arp: { pattern: [0, 0, 4, 0, 2, 0, 4, 6], level: 0.03, wave: "square", octave: 1 }, bass: { level: 0.09, pattern: [0, 0, -1, 0, 0, -1, 3, 4] }, drums: { kick: [1, 0, 1, 0, 1, 0, 1, 0], hat: [0, 1, 0, 1, 0, 1, 0, 1], level: 0.2 } },
  victory: { bpm: 100, root: 60, scale: MAJOR, chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]], pad: "triangle", padLevel: 0.06, arp: { pattern: [0, 2, 4, 7, 4, 2, 0, 4], level: 0.04, wave: "triangle", octave: 1 }, bass: { level: 0.07, pattern: [0, -1, 0, -1, 0, -1, 0, -1] }, drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0], level: 0.15 } },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class Music {
  private current?: string;
  private bus?: GainNode;
  private nextStep = 0;
  private step = 0;
  private timer = 0;
  volume = 0.35;
  private droneNodes: OscillatorNode[] = [];

  play(name: string) {
    if (!TRACKS[name] || name === this.current) return;
    this.current = name;
    const ctx = sfx.context;
    if (!ctx || !sfx.out) {
      // Audio unlocks on the first click/key; start then.
      const retry = () => {
        const want = this.current;
        this.current = undefined;
        if (want) this.play(want);
      };
      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("keydown", retry, { once: true });
      return;
    }
    this.fadeOut();
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.volume), ctx.currentTime + 2);
    bus.connect(sfx.out);
    this.bus = bus;
    this.step = 0;
    this.nextStep = ctx.currentTime + 0.1;
    const t = TRACKS[name];
    if (t.drone) {
      for (const n of [t.root - 12, t.root - 5]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midi(n);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 400;
        const g = ctx.createGain();
        g.gain.value = t.drone;
        o.connect(f).connect(g).connect(bus);
        o.start();
        this.droneNodes.push(o);
      }
    }
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  /** Dip the music under a big moment (perfect parry, boss down), then bring it back. */
  duck(depth = 0.35, ms = 700) {
    const ctx = sfx.context;
    if (!ctx || !this.bus) return;
    const t = ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(Math.max(0.0001, this.volume * depth), t, 0.03);
    this.bus.gain.setTargetAtTime(Math.max(0.0001, this.volume), t + ms / 1000, 0.4);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.bus && sfx.context) this.bus.gain.setTargetAtTime(Math.max(0.0001, v), sfx.context.currentTime, 0.2);
  }

  private fadeOut() {
    const ctx = sfx.context;
    if (!ctx || !this.bus) return;
    const old = this.bus;
    const drones = this.droneNodes;
    this.droneNodes = [];
    old.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
    setTimeout(() => {
      for (const d of drones) d.stop();
      old.disconnect();
    }, 3000);
  }

  private schedule() {
    const ctx = sfx.context;
    const name = this.current;
    if (!ctx || !name || !this.bus) return;
    const t = TRACKS[name];
    const stepDur = 60 / t.bpm / 2; // eighth notes
    while (this.nextStep < ctx.currentTime + 0.35) {
      this.playStep(t, this.step, this.nextStep, stepDur);
      this.nextStep += stepDur;
      this.step++;
    }
  }

  private note(freq: number, at: number, dur: number, wave: OscillatorType, level: number, cutoff = 2400) {
    const ctx = sfx.context!;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + Math.min(0.08, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(this.bus!);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  private deg(t: Track, d: number, octave = 0) {
    const n = t.scale.length;
    const o = Math.floor(d / n);
    return t.root + t.scale[((d % n) + n) % n] + 12 * (o + octave);
  }

  private playStep(t: Track, step: number, at: number, dur: number) {
    const bar = Math.floor(step / 8);
    const chord = t.chords[bar % t.chords.length];
    const s = step % 8;
    if (s === 0) for (const d of chord) this.note(midi(this.deg(t, d)), at, dur * 8.2, t.pad, t.padLevel, 1400);
    if (t.arp) {
      const i = t.arp.pattern[s];
      if (i >= 0) this.note(midi(this.deg(t, chord[i % chord.length] + Math.floor(i / chord.length) * 7, t.arp.octave)), at, dur * 1.6, t.arp.wave, t.arp.level, 3000);
    }
    if (t.bass) {
      const i = t.bass.pattern[s];
      if (i >= 0) this.note(midi(this.deg(t, chord[0] + i, -1)), at, dur * 1.8, "triangle", t.bass.level, 800);
    }
    if (t.drums) {
      const ctx = sfx.context!;
      if (t.drums.kick[s]) {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(120, at);
        o.frequency.exponentialRampToValueAtTime(40, at + 0.15);
        const g = ctx.createGain();
        g.gain.setValueAtTime(t.drums.level, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
        o.connect(g).connect(this.bus!);
        o.start(at);
        o.stop(at + 0.25);
      }
      if (t.drums.hat?.[s]) this.note(8000 + Math.random() * 1000, at, 0.04, "square", t.drums.level * 0.08, 12000);
    }
  }
}

export const music = new Music();
