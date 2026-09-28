import type { Shape } from "./shapes.ts";

/**
 * Frame data for every player move, in 60 Hz ticks. Client prediction and the
 * server both read these tables, so timings are identical on both sides.
 */
export interface MoveDef {
  name: string;
  /** Animation id the renderer plays for this move. */
  anim: string;
  startup: number;
  active: number;
  recovery: number;
  /** Tick (from move start) at which the next combo input may cancel into a follow-up. */
  comboFrom: number;
  /** Tick at which dodge / parry may cancel the rest of the move. */
  cancelFrom: number;
  damage: number;
  /** Stagger pressure dealt to enemies. */
  poise: number;
  knockback: number;
  shape?: Shape;
  projectile?: { count: number; spread: number; speed: number; range: number; radius: number };
  /** Forward travel (px) spread over the startup + active ticks. */
  lunge: number;
  stamina: number;
  /** Cannot be flinched while startup/active. */
  superArmor?: boolean;
  /** Invulnerable ticks [from, to) — mobility skills. */
  iframes?: [number, number];
  /** Visual-only hitstop on contact (ms). */
  hitstop: number;
  /** Camera kick strength on contact, 0–1. */
  impact: number;
  cooldown?: number;
  /** Special behaviour hook for skills. */
  special?: "counterStance" | "warcry" | "frost" | "meteor" | "shadowstep" | "vault";
}

export interface DodgeDef {
  distance: number;
  ticks: number;
  iStart: number;
  iEnd: number;
  recovery: number;
  stamina: number;
  /** Attacks may be started after this tick of the dodge (dodge-attack). */
  attackFrom: number;
}

export interface ParryDef {
  /** Ticks after pressing during which an incoming hit is parried. */
  window: number;
  /** Ticks after pressing during which a parry is perfect. */
  perfect: number;
  /** Vulnerable ticks after the window if nothing was parried. */
  recovery: number;
  stamina: number;
}

export interface WeaponDef {
  id: number;
  key: WeaponKey;
  name: string;
  /** Light chain, in order. */
  lights: MoveDef[];
  heavy: MoveDef;
  /** Heavy pressed mid-combo. */
  comboHeavy: MoveDef;
  skills: [MoveDef, MoveDef];
  parry: ParryDef;
  dodge: DodgeDef;
  /** Damage multiplier on a hit against a parry-opened (riposte) target. */
  riposte: number;
  /** Mastery level needed for the last light in the chain (the finisher). */
  finisherMastery: number;
  blurb: string;
}

export type WeaponKey = "sword" | "greatsword" | "daggers" | "spear" | "staff";

const deg = (d: number) => (d * Math.PI) / 180;

function move(m: Omit<MoveDef, "comboFrom" | "cancelFrom" | "hitstop" | "impact" | "knockback" | "poise" | "lunge" | "stamina"> & Partial<MoveDef>): MoveDef {
  const endActive = m.startup + m.active;
  return {
    comboFrom: endActive + 2,
    cancelFrom: endActive + 4,
    hitstop: 55,
    impact: 0.15,
    knockback: 60,
    poise: 10,
    lunge: 0,
    stamina: 5,
    ...m,
  };
}

const SWORD: WeaponDef = {
  id: 0,
  key: "sword",
  name: "Sword",
  blurb: "Balanced and quick, with the most forgiving parry.",
  lights: [
    move({ name: "Slash", anim: "slashR", startup: 7, active: 4, recovery: 14, damage: 11, poise: 12, lunge: 10, shape: { kind: "arc", range: 42, arc: deg(120) } }),
    move({ name: "Backslash", anim: "slashL", startup: 7, active: 4, recovery: 14, damage: 11, poise: 12, lunge: 10, shape: { kind: "arc", range: 42, arc: deg(120) } }),
    move({ name: "Rising Cut", anim: "slashR", startup: 8, active: 5, recovery: 16, damage: 13, poise: 16, lunge: 12, shape: { kind: "arc", range: 44, arc: deg(130) } }),
    move({ name: "Piercing Finisher", anim: "thrust", startup: 12, active: 6, recovery: 24, damage: 24, poise: 38, lunge: 38, stamina: 10, knockback: 150, hitstop: 90, impact: 0.45, shape: { kind: "line", length: 74, width: 22 } }),
  ],
  heavy: move({ name: "Cleave", anim: "heavySlash", startup: 18, active: 6, recovery: 24, damage: 27, poise: 42, lunge: 14, stamina: 18, knockback: 140, hitstop: 95, impact: 0.5, shape: { kind: "arc", range: 50, arc: deg(165) } }),
  comboHeavy: move({ name: "Rising Cleave", anim: "heavySlash", startup: 13, active: 6, recovery: 22, damage: 24, poise: 50, lunge: 16, stamina: 16, knockback: 120, hitstop: 90, impact: 0.45, shape: { kind: "arc", range: 48, arc: deg(150) } }),
  skills: [
    move({ name: "Whirlwind", anim: "spin", startup: 10, active: 14, recovery: 20, damage: 20, poise: 30, stamina: 20, knockback: 160, hitstop: 70, impact: 0.4, cooldown: 480, shape: { kind: "circle", radius: 58, offset: 0 } }),
    move({ name: "Riposte Stance", anim: "stance", startup: 2, active: 40, recovery: 14, damage: 0, poise: 0, stamina: 10, cooldown: 600, special: "counterStance" }),
  ],
  parry: { window: 14, perfect: 6, recovery: 20, stamina: 8 },
  dodge: { distance: 96, ticks: 16, iStart: 2, iEnd: 12, recovery: 6, stamina: 20, attackFrom: 12 },
  riposte: 2.5,
  finisherMastery: 4,
};

const GREATSWORD: WeaponDef = {
  id: 1,
  key: "greatsword",
  name: "Greatsword",
  blurb: "Slow, crushing swings that break poise. Commit or be punished.",
  lights: [
    move({ name: "Heave", anim: "bigSlashR", startup: 14, active: 6, recovery: 22, damage: 24, poise: 32, lunge: 12, stamina: 12, knockback: 110, hitstop: 80, impact: 0.35, shape: { kind: "arc", range: 54, arc: deg(150) } }),
    move({ name: "Return Swing", anim: "bigSlashL", startup: 15, active: 6, recovery: 24, damage: 26, poise: 34, lunge: 12, stamina: 12, knockback: 110, hitstop: 80, impact: 0.35, shape: { kind: "arc", range: 54, arc: deg(150) } }),
    move({ name: "Overhead Crash", anim: "overhead", startup: 22, active: 6, recovery: 30, damage: 44, poise: 75, lunge: 16, stamina: 16, knockback: 200, hitstop: 130, impact: 0.8, superArmor: true, shape: { kind: "circle", radius: 34, offset: 40 } }),
  ],
  heavy: move({ name: "Earthsplitter", anim: "overhead", startup: 26, active: 8, recovery: 30, damage: 50, poise: 85, lunge: 10, stamina: 24, knockback: 220, hitstop: 140, impact: 0.9, superArmor: true, shape: { kind: "arc", range: 62, arc: deg(180) } }),
  comboHeavy: move({ name: "Spinning Heave", anim: "spin", startup: 18, active: 10, recovery: 26, damage: 34, poise: 60, stamina: 20, knockback: 180, hitstop: 110, impact: 0.7, superArmor: true, shape: { kind: "circle", radius: 60, offset: 0 } }),
  skills: [
    move({ name: "Leap Slam", anim: "leap", startup: 24, active: 6, recovery: 26, damage: 42, poise: 90, lunge: 120, stamina: 25, knockback: 220, hitstop: 140, impact: 1, superArmor: true, cooldown: 600, shape: { kind: "circle", radius: 62, offset: 0 } }),
    move({ name: "War Cry", anim: "roar", startup: 12, active: 4, recovery: 18, damage: 0, poise: 70, stamina: 15, knockback: 90, hitstop: 0, impact: 0.5, cooldown: 900, special: "warcry", shape: { kind: "circle", radius: 96, offset: 0 } }),
  ],
  parry: { window: 11, perfect: 5, recovery: 26, stamina: 12 },
  dodge: { distance: 84, ticks: 18, iStart: 2, iEnd: 11, recovery: 8, stamina: 24, attackFrom: 14 },
  riposte: 2.2,
  finisherMastery: 4,
};

const DAGGERS: WeaponDef = {
  id: 2,
  key: "daggers",
  name: "Daggers",
  blurb: "Blinding speed and mobility. Tiny reach, huge ripostes.",
  lights: [
    move({ name: "Jab", anim: "stabR", startup: 4, active: 3, recovery: 8, damage: 5, poise: 5, lunge: 8, stamina: 3, knockback: 30, hitstop: 35, impact: 0.05, shape: { kind: "arc", range: 32, arc: deg(90) } }),
    move({ name: "Cross", anim: "stabL", startup: 4, active: 3, recovery: 8, damage: 5, poise: 5, lunge: 8, stamina: 3, knockback: 30, hitstop: 35, impact: 0.05, shape: { kind: "arc", range: 32, arc: deg(90) } }),
    move({ name: "Hook", anim: "stabR", startup: 4, active: 3, recovery: 8, damage: 6, poise: 6, lunge: 8, stamina: 3, knockback: 30, hitstop: 35, impact: 0.05, shape: { kind: "arc", range: 32, arc: deg(100) } }),
    move({ name: "Hook", anim: "stabL", startup: 4, active: 3, recovery: 8, damage: 6, poise: 6, lunge: 8, stamina: 3, knockback: 30, hitstop: 35, impact: 0.05, shape: { kind: "arc", range: 32, arc: deg(100) } }),
    move({ name: "Flurry's End", anim: "spin", startup: 6, active: 6, recovery: 14, damage: 13, poise: 18, lunge: 14, stamina: 6, knockback: 120, hitstop: 70, impact: 0.3, shape: { kind: "circle", radius: 38, offset: 6 } }),
  ],
  heavy: move({ name: "Lunging Stab", anim: "thrust", startup: 8, active: 5, recovery: 14, damage: 15, poise: 20, lunge: 84, stamina: 12, knockback: 80, hitstop: 70, impact: 0.3, shape: { kind: "line", length: 42, width: 18 } }),
  comboHeavy: move({ name: "Twin Rend", anim: "twin", startup: 6, active: 6, recovery: 12, damage: 16, poise: 22, lunge: 12, stamina: 10, knockback: 90, hitstop: 70, impact: 0.3, shape: { kind: "arc", range: 36, arc: deg(150) } }),
  skills: [
    move({ name: "Shadowstep", anim: "vanish", startup: 3, active: 8, recovery: 8, damage: 0, poise: 0, lunge: 140, stamina: 15, hitstop: 0, impact: 0, cooldown: 360, iframes: [0, 12], special: "shadowstep" }),
    move({ name: "Fan of Knives", anim: "throw", startup: 8, active: 2, recovery: 14, damage: 8, poise: 8, stamina: 14, knockback: 40, hitstop: 30, impact: 0.1, cooldown: 420, projectile: { count: 5, spread: deg(50), speed: 520, range: 220, radius: 6 } }),
  ],
  parry: { window: 12, perfect: 6, recovery: 16, stamina: 6 },
  dodge: { distance: 108, ticks: 14, iStart: 1, iEnd: 11, recovery: 4, stamina: 15, attackFrom: 10 },
  riposte: 3.2,
  finisherMastery: 4,
};

const SPEAR: WeaponDef = {
  id: 3,
  key: "spear",
  name: "Spear",
  blurb: "Reach and spacing. Keep them at the tip.",
  lights: [
    move({ name: "Thrust", anim: "thrust", startup: 8, active: 4, recovery: 14, damage: 12, poise: 12, lunge: 8, shape: { kind: "line", length: 74, width: 16 } }),
    move({ name: "Thrust", anim: "thrust", startup: 8, active: 4, recovery: 14, damage: 12, poise: 12, lunge: 8, shape: { kind: "line", length: 74, width: 16 } }),
    move({ name: "Sweep", anim: "sweep", startup: 11, active: 6, recovery: 18, damage: 15, poise: 28, lunge: 6, stamina: 8, knockback: 140, hitstop: 70, impact: 0.3, shape: { kind: "arc", range: 64, arc: deg(220), inner: 18 } }),
  ],
  heavy: move({ name: "Piercing Lunge", anim: "thrust", startup: 16, active: 6, recovery: 22, damage: 29, poise: 38, lunge: 52, stamina: 18, knockback: 170, hitstop: 100, impact: 0.55, shape: { kind: "line", length: 94, width: 20 } }),
  comboHeavy: move({ name: "Rising Thrust", anim: "thrust", startup: 12, active: 5, recovery: 20, damage: 24, poise: 34, lunge: 20, stamina: 15, knockback: 150, hitstop: 90, impact: 0.45, shape: { kind: "line", length: 84, width: 18 } }),
  skills: [
    move({ name: "Impaling Charge", anim: "charge", startup: 14, active: 18, recovery: 22, damage: 26, poise: 40, lunge: 190, stamina: 25, knockback: 200, hitstop: 90, impact: 0.6, cooldown: 600, superArmor: true, shape: { kind: "line", length: 40, width: 30 } }),
    move({ name: "Vault", anim: "leap", startup: 4, active: 14, recovery: 10, damage: 0, poise: 0, lunge: 150, stamina: 18, hitstop: 0, impact: 0, cooldown: 420, iframes: [2, 16], special: "vault" }),
  ],
  parry: { window: 13, perfect: 5, recovery: 20, stamina: 8 },
  dodge: { distance: 96, ticks: 16, iStart: 2, iEnd: 12, recovery: 6, stamina: 20, attackFrom: 12 },
  riposte: 2.4,
  finisherMastery: 4,
};

const STAFF: WeaponDef = {
  id: 4,
  key: "staff",
  name: "Staff",
  blurb: "Bolts at range, bursts up close. Position is your armour.",
  lights: [
    move({ name: "Arcane Bolt", anim: "cast", startup: 9, active: 1, recovery: 12, damage: 10, poise: 8, stamina: 4, knockback: 40, hitstop: 40, impact: 0.1, projectile: { count: 1, spread: 0, speed: 480, range: 300, radius: 7 } }),
    move({ name: "Arcane Bolt", anim: "cast", startup: 9, active: 1, recovery: 12, damage: 10, poise: 8, stamina: 4, knockback: 40, hitstop: 40, impact: 0.1, projectile: { count: 1, spread: 0, speed: 480, range: 300, radius: 7 } }),
    move({ name: "Tri-Bolt", anim: "cast", startup: 12, active: 1, recovery: 18, damage: 9, poise: 8, stamina: 8, knockback: 50, hitstop: 40, impact: 0.15, projectile: { count: 3, spread: 0.32, speed: 480, range: 300, radius: 7 } }),
  ],
  heavy: move({ name: "Arcane Nova", anim: "nova", startup: 20, active: 6, recovery: 24, damage: 22, poise: 45, stamina: 22, knockback: 240, hitstop: 80, impact: 0.6, shape: { kind: "circle", radius: 72, offset: 0 } }),
  comboHeavy: move({ name: "Arcane Lance", anim: "cast", startup: 16, active: 5, recovery: 22, damage: 27, poise: 35, stamina: 18, knockback: 140, hitstop: 80, impact: 0.45, shape: { kind: "line", length: 170, width: 14 } }),
  skills: [
    move({ name: "Frost Nova", anim: "nova", startup: 12, active: 4, recovery: 18, damage: 12, poise: 30, stamina: 18, knockback: 60, hitstop: 50, impact: 0.3, cooldown: 600, special: "frost", shape: { kind: "circle", radius: 92, offset: 0 } }),
    move({ name: "Meteor", anim: "cast", startup: 16, active: 2, recovery: 20, damage: 40, poise: 70, stamina: 26, knockback: 200, hitstop: 120, impact: 0.9, cooldown: 780, special: "meteor", shape: { kind: "circle", radius: 60, offset: 170 } }),
  ],
  parry: { window: 12, perfect: 5, recovery: 22, stamina: 8 },
  dodge: { distance: 112, ticks: 10, iStart: 0, iEnd: 9, recovery: 8, stamina: 22, attackFrom: 10 },
  riposte: 2.0,
  finisherMastery: 99,
};

export const WEAPONS: WeaponDef[] = [SWORD, GREATSWORD, DAGGERS, SPEAR, STAFF];
export const weaponByKey = (key: WeaponKey) => WEAPONS.find((w) => w.key === key)!;

/** Move ids packed in one byte: 0–15 lights, 16 heavy, 17 combo heavy, 18/19 skills. */
export const MOVE_HEAVY = 16;
export const MOVE_COMBO_HEAVY = 17;
export const MOVE_SKILL1 = 18;
export const MOVE_SKILL2 = 19;

export function getMove(weapon: number, id: number): MoveDef {
  const w = WEAPONS[weapon] ?? SWORD;
  if (id < 16) return w.lights[id] ?? w.lights[0];
  if (id === MOVE_HEAVY) return w.heavy;
  if (id === MOVE_COMBO_HEAVY) return w.comboHeavy;
  return w.skills[id === MOVE_SKILL1 ? 0 : 1];
}

export const moveLength = (m: MoveDef) => m.startup + m.active + m.recovery;
