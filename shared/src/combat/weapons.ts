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
  projectile?: { count: number; spread: number; speed: number; range: number; radius: number; look?: "wave" | "javelin" | "knife" | "fire" };
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
  special?: "counterStance" | "warcry" | "frost" | "meteor" | "shadowstep" | "vault" | "rally" | "ironskin" | "venom" | "bloodlust" | "drain" | "mark" | "burn" | "meteors" | "storm" | "phoenix" | "empower";
  /** Empower: the damage bonus it grants (0.15 = +15%). */
  power?: number;
  /** Damage multiplier against staggered enemies. */
  vsStagger?: number;
  // --- Skills only ---
  /** Stable id, used by the skill book, scrolls and loadouts ("sword.whirlwind", "any.blink"). */
  id?: string;
  desc?: string;
  /** Visual effect played when the skill fires. */
  vfx?: string;
  /** Signature colour of the skill (effects, icon). */
  color?: number;
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
  /** Every skill this weapon can learn (from skill scrolls; two are equipped). */
  skills: MoveDef[];
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
    move({ id: "sword.whirlwind", name: "Whirlwind", anim: "spin", startup: 10, active: 14, recovery: 20, damage: 20, poise: 30, stamina: 20, knockback: 160, hitstop: 70, impact: 0.4, cooldown: 480, shape: { kind: "circle", radius: 58, offset: 0 }, desc: "Spin with your blade, striking everything around you.", vfx: "whirl", color: 0xdfe8ff }),
    move({ id: "sword.riposte", name: "Riposte Stance", anim: "stance", startup: 2, active: 40, recovery: 14, damage: 0, poise: 0, stamina: 10, cooldown: 600, special: "counterStance", desc: "Hold a guard: any blow that lands during the stance is countered automatically.", vfx: "stance", color: 0xffd76a }),
    move({ id: "sword.dash", name: "Dashing Strike", anim: "thrust", startup: 6, active: 8, recovery: 16, damage: 18, poise: 26, lunge: 130, stamina: 14, knockback: 110, hitstop: 70, impact: 0.4, cooldown: 360, iframes: [0, 8], shape: { kind: "line", length: 46, width: 26 }, desc: "Dash forward through danger and cut whatever is in your path.", vfx: "dash", color: 0xbfe0ff }),
    move({ id: "sword.wave", name: "Crescent Wave", anim: "slashR", startup: 10, active: 1, recovery: 16, damage: 16, poise: 20, stamina: 14, knockback: 90, hitstop: 60, impact: 0.3, cooldown: 420, projectile: { count: 1, spread: 0, speed: 430, range: 240, radius: 16, look: "wave" }, desc: "Loose a crescent of force that cuts through the air.", vfx: "wave", color: 0xcfe6ff }),
    move({ id: "sword.rally", name: "Rallying Blade", anim: "roar", startup: 10, active: 4, recovery: 16, damage: 0, poise: 0, stamina: 10, hitstop: 0, impact: 0.2, cooldown: 1200, special: "rally", shape: { kind: "circle", radius: 120, offset: 0 }, desc: "Raise your blade high: heal 18% of your health, and 12% for allies nearby.", vfx: "rally", color: 0xffe08a }),
    move({ id: "sword.judgement", name: "Judgement Cut", anim: "heavySlash", startup: 20, active: 4, recovery: 22, damage: 38, poise: 60, stamina: 22, knockback: 160, hitstop: 120, impact: 0.8, cooldown: 720, superArmor: true, shape: { kind: "line", length: 150, width: 26 }, desc: "A charged cut that splits the air far ahead of you.", vfx: "judgement", color: 0xffffff }),
    // Deeper in the tree (levels 10 and 12).
    move({ id: "sword.pierce", name: "Piercing Lunge", anim: "thrust", startup: 8, active: 5, recovery: 16, damage: 22, poise: 30, lunge: 70, stamina: 16, knockback: 90, hitstop: 80, impact: 0.45, cooldown: 480, vsStagger: 1.6, shape: { kind: "line", length: 110, width: 18 }, desc: "Drive the point straight through a line of enemies. Extra damage to the staggered.", vfx: "pierce", color: 0xe8f0ff }),
    move({ id: "sword.sunder", name: "Sundering Arc", anim: "heavySlash", startup: 14, active: 5, recovery: 20, damage: 26, poise: 75, stamina: 18, knockback: 170, hitstop: 100, impact: 0.6, cooldown: 600, superArmor: true, shape: { kind: "arc", range: 70, arc: deg(220) }, desc: "A wide, heavy sweep that shatters guards and poise.", vfx: "sunder", color: 0xffcf7a }),
    move({ id: "sword.aegis", name: "Aegis", anim: "roar", startup: 6, active: 4, recovery: 10, damage: 0, poise: 0, stamina: 12, hitstop: 0, impact: 0.2, cooldown: 1080, special: "ironskin", desc: "Raise a ward of light: take 50% less damage for 5 seconds.", vfx: "aegis", color: 0x9fd3ff }),
    move({ id: "sword.skyfall", name: "Skyfall", anim: "leap", startup: 22, active: 5, recovery: 26, damage: 44, poise: 80, lunge: 110, stamina: 26, knockback: 220, hitstop: 140, impact: 1, superArmor: true, cooldown: 900, shape: { kind: "circle", radius: 70, offset: 0 }, desc: "Leap high and bring the blade down in a column of light.", vfx: "skyfall", color: 0xfff2b0 }),
    // Dragon-slaying arts (levels 14 and 16).
    move({ id: "sword.dragonfang", name: "Dragon Fang", anim: "thrust", startup: 8, active: 6, recovery: 16, damage: 30, poise: 36, lunge: 110, stamina: 18, knockback: 120, hitstop: 90, impact: 0.55, cooldown: 600, iframes: [0, 8], special: "burn", shape: { kind: "line", length: 64, width: 26 }, desc: "Lunge through your foe with a burning edge: whatever you cut burns for 4 seconds.", vfx: "dragonfang", color: 0xff8a3a }),
    move({ id: "sword.wyrmslayer", name: "Wyrmslayer", anim: "heavySlash", startup: 18, active: 6, recovery: 24, damage: 56, poise: 100, lunge: 24, stamina: 28, knockback: 220, hitstop: 150, impact: 1, cooldown: 1200, superArmor: true, vsStagger: 1.5, special: "burn", shape: { kind: "arc", range: 92, arc: deg(240) }, desc: "The dragon-killer's cut: a vast arc of fire that sets everything it touches burning. Devastating against the staggered.", vfx: "wyrmslayer", color: 0xffb040 }),
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
    move({ name: "Heave", anim: "bigSlashR", startup: 14, active: 6, recovery: 22, damage: 21, poise: 32, lunge: 12, stamina: 12, knockback: 110, hitstop: 80, impact: 0.35, shape: { kind: "arc", range: 54, arc: deg(150) } }),
    move({ name: "Return Swing", anim: "bigSlashL", startup: 15, active: 6, recovery: 24, damage: 23, poise: 34, lunge: 12, stamina: 12, knockback: 110, hitstop: 80, impact: 0.35, shape: { kind: "arc", range: 54, arc: deg(150) } }),
    move({ name: "Overhead Crash", anim: "overhead", startup: 22, active: 6, recovery: 30, damage: 39, poise: 75, lunge: 16, stamina: 16, knockback: 200, hitstop: 130, impact: 0.8, superArmor: true, shape: { kind: "circle", radius: 34, offset: 40 } }),
  ],
  heavy: move({ name: "Earthsplitter", anim: "overhead", startup: 26, active: 8, recovery: 30, damage: 50, poise: 85, lunge: 10, stamina: 24, knockback: 220, hitstop: 140, impact: 0.9, superArmor: true, shape: { kind: "arc", range: 62, arc: deg(180) } }),
  comboHeavy: move({ name: "Spinning Heave", anim: "spin", startup: 18, active: 10, recovery: 26, damage: 34, poise: 60, stamina: 20, knockback: 180, hitstop: 110, impact: 0.7, superArmor: true, shape: { kind: "circle", radius: 60, offset: 0 } }),
  skills: [
    move({ id: "gs.leap", name: "Leap Slam", anim: "leap", startup: 24, active: 6, recovery: 26, damage: 42, poise: 90, lunge: 120, stamina: 25, knockback: 220, hitstop: 140, impact: 1, superArmor: true, cooldown: 600, shape: { kind: "circle", radius: 62, offset: 0 }, desc: "Leap and crash down, flattening everything where you land.", vfx: "slam", color: 0xffc27a }),
    move({ id: "gs.warcry", name: "War Cry", anim: "roar", startup: 12, active: 4, recovery: 18, damage: 0, poise: 70, stamina: 15, knockback: 90, hitstop: 0, impact: 0.5, cooldown: 900, special: "warcry", shape: { kind: "circle", radius: 96, offset: 0 }, desc: "A roar that staggers nearby enemies and breaks their guard.", vfx: "warcry", color: 0xff9a6b }),
    move({ id: "gs.breaker", name: "Ground Breaker", anim: "overhead", startup: 20, active: 6, recovery: 24, damage: 32, poise: 70, lunge: 8, stamina: 20, knockback: 180, hitstop: 110, impact: 0.7, cooldown: 540, superArmor: true, shape: { kind: "line", length: 150, width: 34 }, desc: "Drive your blade into the earth: a fissure tears forward in a line.", vfx: "fissure", color: 0xd8a060 }),
    move({ id: "gs.ironskin", name: "Iron Skin", anim: "roar", startup: 8, active: 4, recovery: 12, damage: 0, poise: 0, stamina: 12, hitstop: 0, impact: 0.2, cooldown: 1200, special: "ironskin", desc: "Steel yourself: take 50% less damage for 5 seconds.", vfx: "ironskin", color: 0xc9d3dd }),
    move({ id: "gs.cyclone", name: "Cyclone", anim: "spin", startup: 14, active: 16, recovery: 24, damage: 30, poise: 60, stamina: 22, knockback: 200, hitstop: 100, impact: 0.7, superArmor: true, cooldown: 600, shape: { kind: "circle", radius: 72, offset: 0 }, desc: "A whirling heave with the full weight of the blade behind it.", vfx: "cyclone", color: 0xffe0b0 }),
    move({ id: "gs.titan", name: "Titan's Fall", anim: "leap", startup: 30, active: 6, recovery: 32, damage: 60, poise: 130, lunge: 60, stamina: 30, knockback: 260, hitstop: 160, impact: 1, superArmor: true, cooldown: 900, shape: { kind: "circle", radius: 92, offset: 30 }, desc: "Your heaviest blow: a crushing overhead that shakes the ground.", vfx: "titan", color: 0xffb070 }),
    // Deeper in the tree (levels 10 and 12).
    move({ id: "gs.rush", name: "Bull Rush", anim: "charge", startup: 12, active: 10, recovery: 22, damage: 30, poise: 70, lunge: 170, stamina: 22, knockback: 240, hitstop: 110, impact: 0.7, superArmor: true, cooldown: 600, shape: { kind: "line", length: 50, width: 40 }, desc: "Charge shoulder-first, bowling over everything in your path.", vfx: "rush", color: 0xffb080 }),
    move({ id: "gs.guillotine", name: "Guillotine", anim: "overhead", startup: 22, active: 5, recovery: 28, damage: 48, poise: 60, lunge: 20, stamina: 24, knockback: 150, hitstop: 150, impact: 0.9, superArmor: true, cooldown: 720, vsStagger: 2.2, shape: { kind: "line", length: 80, width: 30 }, desc: "A falling execution stroke. More than double damage against staggered enemies.", vfx: "guillotine", color: 0xe8e0d8 }),
    move({ id: "gs.bloodlust", name: "Bloodlust", anim: "roar", startup: 10, active: 4, recovery: 14, damage: 0, poise: 0, stamina: 14, hitstop: 0, impact: 0.3, cooldown: 1200, special: "bloodlust", desc: "For 6 seconds, every hit you land heals you for 20% of its damage.", vfx: "bloodlust", color: 0xff5a4a }),
    move({ id: "gs.quake", name: "Earthquake", anim: "overhead", startup: 32, active: 8, recovery: 34, damage: 52, poise: 140, stamina: 34, knockback: 240, hitstop: 160, impact: 1, superArmor: true, cooldown: 1080, shape: { kind: "circle", radius: 112, offset: 0 }, desc: "Hammer the ground so hard the floor shakes: a huge area and a huge stagger.", vfx: "quake", color: 0xd8a060 }),
    // Dragon-slaying arts (levels 14 and 16).
    move({ id: "gs.magma", name: "Magma Cleave", anim: "overhead", startup: 20, active: 6, recovery: 26, damage: 36, poise: 70, lunge: 10, stamina: 22, knockback: 170, hitstop: 120, impact: 0.75, cooldown: 660, superArmor: true, special: "burn", shape: { kind: "line", length: 170, width: 38 }, desc: "Split the ground with a molten fissure: everything along it burns for 4 seconds.", vfx: "magma", color: 0xff6a2a }),
    move({ id: "gs.cataclysm", name: "Cataclysm", anim: "leap", startup: 28, active: 6, recovery: 32, damage: 64, poise: 130, lunge: 140, stamina: 32, knockback: 260, hitstop: 170, impact: 1, cooldown: 1260, superArmor: true, special: "burn", shape: { kind: "circle", radius: 100, offset: 0 }, desc: "Leap and bring the mountain down: a burning shockwave flattens and ignites everything around you.", vfx: "cataclysm", color: 0xff5a1a }),
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
    move({ id: "dg.shadowstep", name: "Shadowstep", anim: "vanish", startup: 3, active: 8, recovery: 8, damage: 0, poise: 0, lunge: 140, stamina: 15, hitstop: 0, impact: 0, cooldown: 360, iframes: [0, 12], special: "shadowstep", desc: "Vanish and reappear ahead of you, untouchable for a moment.", vfx: "shadow", color: 0x8a7ad8 }),
    move({ id: "dg.fan", name: "Fan of Knives", anim: "throw", startup: 8, active: 2, recovery: 14, damage: 8, poise: 8, stamina: 14, knockback: 40, hitstop: 30, impact: 0.1, cooldown: 420, projectile: { count: 5, spread: deg(50), speed: 520, range: 220, radius: 6 }, desc: "Throw five knives in a spread.", vfx: "fan", color: 0xdfe8ff }),
    move({ id: "dg.venom", name: "Venom Edge", anim: "twin", startup: 6, active: 5, recovery: 12, damage: 10, poise: 10, lunge: 16, stamina: 12, knockback: 50, hitstop: 50, impact: 0.2, cooldown: 480, special: "venom", shape: { kind: "arc", range: 40, arc: deg(150) }, desc: "Poisoned slashes: enemies you cut take damage over 6 seconds.", vfx: "venom", color: 0x8fe06a }),
    move({ id: "dg.evis", name: "Eviscerate", anim: "thrust", startup: 7, active: 4, recovery: 14, damage: 24, poise: 22, lunge: 60, stamina: 14, knockback: 90, hitstop: 90, impact: 0.45, cooldown: 420, vsStagger: 2, shape: { kind: "line", length: 44, width: 20 }, desc: "A lunging gut-strike. Double damage against staggered enemies.", vfx: "evis", color: 0xff6a5a }),
    move({ id: "dg.dance", name: "Blade Dance", anim: "spin", startup: 4, active: 12, recovery: 12, damage: 12, poise: 14, stamina: 16, knockback: 80, hitstop: 50, impact: 0.25, cooldown: 420, iframes: [0, 14], shape: { kind: "circle", radius: 46, offset: 0 }, desc: "Spin through a crowd, untouchable while the blades are out.", vfx: "dance", color: 0xe8e0ff }),
    move({ id: "dg.assassinate", name: "Assassinate", anim: "vanish", startup: 4, active: 10, recovery: 14, damage: 30, poise: 30, lunge: 150, stamina: 20, knockback: 100, hitstop: 110, impact: 0.6, cooldown: 720, iframes: [0, 12], special: "shadowstep", vsStagger: 1.5, shape: { kind: "line", length: 40, width: 28 }, desc: "Slip through an enemy's shadow and strike everything you pass.", vfx: "assassin", color: 0x6a5ad8 }),
    // Deeper in the tree (levels 10 and 12).
    move({ id: "dg.smoke", name: "Smoke Bomb", anim: "throw", startup: 4, active: 4, recovery: 8, damage: 4, poise: 30, stamina: 12, knockback: 20, hitstop: 0, impact: 0.1, cooldown: 720, iframes: [0, 10], special: "frost", shape: { kind: "circle", radius: 84, offset: 0 }, desc: "Burst into smoke: nearby enemies stagger and slow for 4 seconds.", vfx: "smoke", color: 0xb8b0c8 }),
    move({ id: "dg.cuts", name: "Thousand Cuts", anim: "twin", startup: 5, active: 16, recovery: 14, damage: 14, poise: 16, lunge: 20, stamina: 18, knockback: 60, hitstop: 40, impact: 0.3, cooldown: 540, superArmor: true, shape: { kind: "arc", range: 44, arc: deg(200) }, desc: "A blur of blades ahead of you. Nothing can stagger you while it lasts.", vfx: "cuts", color: 0xffe0e8 }),
    move({ id: "dg.mark", name: "Death Mark", anim: "stabR", startup: 6, active: 4, recovery: 12, damage: 12, poise: 12, lunge: 24, stamina: 12, knockback: 40, hitstop: 60, impact: 0.3, cooldown: 900, special: "mark", shape: { kind: "line", length: 44, width: 22 }, desc: "Mark a target: it takes 30% more damage from everyone for 6 seconds.", vfx: "mark", color: 0xd84a6a }),
    move({ id: "dg.phantom", name: "Phantom Rush", anim: "vanish", startup: 3, active: 14, recovery: 12, damage: 22, poise: 24, lunge: 200, stamina: 22, knockback: 80, hitstop: 80, impact: 0.5, cooldown: 780, iframes: [0, 16], special: "shadowstep", shape: { kind: "line", length: 36, width: 34 }, desc: "Become a shadow and tear through a whole line of enemies.", vfx: "phantom", color: 0x9a7af0 }),
    // Dragon-slaying arts (levels 14 and 16).
    move({ id: "dg.ember", name: "Ember Dance", anim: "spin", startup: 4, active: 12, recovery: 12, damage: 16, poise: 16, stamina: 16, knockback: 90, hitstop: 50, impact: 0.3, cooldown: 540, iframes: [0, 12], special: "burn", shape: { kind: "circle", radius: 56, offset: 0 }, desc: "Whirl through a ring of fire, untouchable: everything around you burns for 4 seconds.", vfx: "emberdance", color: 0xff7a30 }),
    move({ id: "dg.wyvern", name: "Wyvern Strike", anim: "thrust", startup: 4, active: 10, recovery: 14, damage: 40, poise: 34, lunge: 180, stamina: 22, knockback: 110, hitstop: 120, impact: 0.7, cooldown: 900, iframes: [0, 16], special: "mark", vsStagger: 1.8, shape: { kind: "line", length: 50, width: 30 }, desc: "Dart forward like a striking wyvern, untouchable, and drive both blades home: the target is Death-Marked for 6 seconds.", vfx: "wyvern", color: 0x6fe0b0 }),
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
    move({ id: "sp.charge", name: "Impaling Charge", anim: "charge", startup: 14, active: 18, recovery: 22, damage: 26, poise: 40, lunge: 190, stamina: 25, knockback: 200, hitstop: 90, impact: 0.6, cooldown: 600, superArmor: true, shape: { kind: "line", length: 40, width: 30 }, desc: "Charge forward spear-first, carrying enemies with you.", vfx: "charge", color: 0xffd08a }),
    move({ id: "sp.vault", name: "Vault", anim: "leap", startup: 4, active: 14, recovery: 10, damage: 0, poise: 0, lunge: 150, stamina: 18, hitstop: 0, impact: 0, cooldown: 420, iframes: [2, 16], special: "vault", desc: "Pole-vault over danger, untouchable in the air.", vfx: "vault", color: 0xbfe0ff }),
    move({ id: "sp.javelin", name: "Javelin", anim: "throw", startup: 10, active: 1, recovery: 16, damage: 24, poise: 30, stamina: 14, knockback: 120, hitstop: 80, impact: 0.4, cooldown: 420, projectile: { count: 1, spread: 0, speed: 640, range: 330, radius: 8, look: "javelin" }, desc: "Hurl a javelin that flies far and hits hard.", vfx: "javelin", color: 0xe8d0a0 }),
    move({ id: "sp.sweep", name: "Sweeping Wall", anim: "sweep", startup: 12, active: 7, recovery: 20, damage: 20, poise: 40, stamina: 16, knockback: 240, hitstop: 90, impact: 0.5, cooldown: 480, shape: { kind: "arc", range: 76, arc: deg(300), inner: 16 }, desc: "A full sweep that throws back everything around you.", vfx: "sweep", color: 0xfff0c0 }),
    move({ id: "sp.skewer", name: "Skewer", anim: "thrust", startup: 14, active: 5, recovery: 20, damage: 30, poise: 50, lunge: 20, stamina: 18, knockback: 160, hitstop: 110, impact: 0.6, cooldown: 540, shape: { kind: "line", length: 130, width: 22 }, desc: "A long, piercing thrust that runs through a whole line of enemies.", vfx: "skewer", color: 0xffffff }),
    move({ id: "sp.dragon", name: "Dragon Lance", anim: "charge", startup: 16, active: 20, recovery: 24, damage: 38, poise: 70, lunge: 260, stamina: 28, knockback: 240, hitstop: 110, impact: 0.8, superArmor: true, cooldown: 840, shape: { kind: "line", length: 48, width: 36 }, desc: "A blazing charge that burns a path through the battlefield.", vfx: "dragon", color: 0xff8a3a }),
    // Deeper in the tree (levels 10 and 12).
    move({ id: "sp.phalanx", name: "Phalanx Stance", anim: "stance", startup: 2, active: 44, recovery: 14, damage: 0, poise: 0, stamina: 12, cooldown: 720, special: "counterStance", desc: "Brace the spear: any blow that lands during the stance is countered.", vfx: "phalanx", color: 0xc9d3dd }),
    move({ id: "sp.pin", name: "Pinning Strike", anim: "thrust", startup: 9, active: 4, recovery: 16, damage: 18, poise: 30, lunge: 10, stamina: 14, knockback: 40, hitstop: 90, impact: 0.45, cooldown: 600, special: "frost", shape: { kind: "line", length: 96, width: 20 }, desc: "Pin enemies with a precise thrust: everything it hits is slowed for 4 seconds.", vfx: "pin", color: 0xe8d8b0 }),
    move({ id: "sp.whirl", name: "Whirling Guard", anim: "spin", startup: 8, active: 12, recovery: 18, damage: 20, poise: 30, stamina: 18, knockback: 150, hitstop: 70, impact: 0.45, cooldown: 540, iframes: [0, 10], shape: { kind: "circle", radius: 82, offset: 0 }, desc: "Twirl the spear around you: the widest spin of any weapon, and blows glance off as it starts.", vfx: "whirlspear", color: 0xcfe0ff }),
    move({ id: "sp.heaven", name: "Heaven's Lance", anim: "thrust", startup: 20, active: 6, recovery: 24, damage: 46, poise: 80, lunge: 60, stamina: 26, knockback: 200, hitstop: 130, impact: 0.9, superArmor: true, cooldown: 900, vsStagger: 1.8, shape: { kind: "line", length: 170, width: 26 }, desc: "A thrust with the weight of the sky behind it: it pierces far across the field.", vfx: "heaven", color: 0xfff0c0 }),
    // Dragon-slaying arts (levels 14 and 16).
    move({ id: "sp.dragoon", name: "Dragoon Dive", anim: "leap", startup: 20, active: 6, recovery: 24, damage: 40, poise: 80, lunge: 170, stamina: 24, knockback: 200, hitstop: 130, impact: 0.9, cooldown: 720, iframes: [0, 22], superArmor: true, shape: { kind: "circle", radius: 64, offset: 0 }, desc: "Leap high out of reach and dive spear-first onto your foes. Untouchable in the air.", vfx: "dragoon", color: 0x9fc8ff }),
    move({ id: "sp.wyrmfang", name: "Wyrmfang", anim: "thrust", startup: 16, active: 6, recovery: 22, damage: 50, poise: 80, lunge: 40, stamina: 26, knockback: 200, hitstop: 140, impact: 0.9, cooldown: 1080, superArmor: true, vsStagger: 1.6, special: "burn", shape: { kind: "line", length: 200, width: 30 }, desc: "A thrust wreathed in dragonfire that reaches farther than any other blow: everything it pierces burns.", vfx: "wyrmfang", color: 0xff9a40 }),
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
    move({ id: "st.frost", name: "Frost Nova", anim: "nova", startup: 12, active: 4, recovery: 18, damage: 12, poise: 30, stamina: 18, knockback: 60, hitstop: 50, impact: 0.3, cooldown: 600, special: "frost", shape: { kind: "circle", radius: 92, offset: 0 }, desc: "A burst of cold that damages and slows everything around you.", vfx: "frost", color: 0x9fe0ff }),
    move({ id: "st.meteor", name: "Meteor", anim: "cast", startup: 16, active: 2, recovery: 20, damage: 40, poise: 70, stamina: 26, knockback: 200, hitstop: 120, impact: 0.9, cooldown: 780, special: "meteor", shape: { kind: "circle", radius: 60, offset: 170 }, desc: "Call a meteor down where you aim.", vfx: "meteor", color: 0xff8a3a }),
    move({ id: "st.lightning", name: "Lightning", anim: "cast", startup: 10, active: 3, recovery: 16, damage: 20, poise: 24, stamina: 14, knockback: 80, hitstop: 70, impact: 0.35, cooldown: 420, shape: { kind: "line", length: 220, width: 16 }, desc: "A crackling bolt that strikes everything in a long line.", vfx: "lightning", color: 0xbfe0ff }),
    move({ id: "st.mend", name: "Mending Light", anim: "nova", startup: 14, active: 4, recovery: 18, damage: 0, poise: 0, stamina: 16, hitstop: 0, impact: 0.2, cooldown: 1200, special: "rally", shape: { kind: "circle", radius: 130, offset: 0 }, desc: "Heal yourself for 18% of your health, and allies nearby for 12%.", vfx: "mend", color: 0x9fe8a6 }),
    move({ id: "st.barrage", name: "Arcane Barrage", anim: "cast", startup: 12, active: 1, recovery: 20, damage: 8, poise: 8, stamina: 18, knockback: 40, hitstop: 40, impact: 0.15, cooldown: 480, projectile: { count: 7, spread: 0.9, speed: 500, range: 280, radius: 7 }, desc: "Seven arcane bolts in a fan.", vfx: "barrage", color: 0xc8a8ff }),
    move({ id: "st.blizzard", name: "Blizzard", anim: "nova", startup: 18, active: 4, recovery: 22, damage: 22, poise: 40, stamina: 26, knockback: 60, hitstop: 60, impact: 0.5, cooldown: 900, special: "frost", shape: { kind: "circle", radius: 120, offset: 120 }, desc: "Freeze a wide area where you aim: heavy damage and a long chill.", vfx: "blizzard", color: 0xdff4ff }),
    // Deeper in the tree (levels 10 and 12).
    move({ id: "st.drain", name: "Life Drain", anim: "cast", startup: 12, active: 6, recovery: 18, damage: 20, poise: 16, stamina: 16, knockback: 40, hitstop: 60, impact: 0.3, cooldown: 660, special: "drain", shape: { kind: "line", length: 150, width: 22 }, desc: "A beam that drinks life: you heal for 40% of the damage it deals.", vfx: "drain", color: 0x8fe38a }),
    move({ id: "st.ward", name: "Arcane Ward", anim: "nova", startup: 6, active: 4, recovery: 10, damage: 0, poise: 0, stamina: 12, hitstop: 0, impact: 0.2, cooldown: 1080, special: "ironskin", desc: "Wrap yourself in runes: take 50% less damage for 5 seconds.", vfx: "ward", color: 0xc4b4ff }),
    move({ id: "st.pulse", name: "Force Pulse", anim: "nova", startup: 10, active: 4, recovery: 16, damage: 12, poise: 60, stamina: 16, knockback: 300, hitstop: 70, impact: 0.6, cooldown: 600, shape: { kind: "circle", radius: 92, offset: 0 }, desc: "A shockwave that hurls every enemy around you away.", vfx: "pulse", color: 0xe0d0ff }),
    move({ id: "st.comet", name: "Comet", anim: "cast", startup: 26, active: 4, recovery: 26, damage: 64, poise: 100, stamina: 30, knockback: 220, hitstop: 150, impact: 1, cooldown: 1080, special: "meteor", shape: { kind: "circle", radius: 60, offset: 150 }, desc: "Call down a comet far ahead: the biggest blast a staff can make.", vfx: "comet", color: 0xffa060 }),
    // Dragon-slaying arts (levels 14 and 16).
    move({ id: "st.breath", name: "Dragon's Breath", anim: "cast", startup: 12, active: 8, recovery: 18, damage: 24, poise: 24, stamina: 20, knockback: 80, hitstop: 60, impact: 0.4, cooldown: 600, special: "burn", shape: { kind: "arc", range: 120, arc: deg(70) }, desc: "Breathe fire like a dragon: a cone of flame that sets everything in it burning.", vfx: "breath", color: 0xff7a2a }),
    move({ id: "st.meteors", name: "Meteor Storm", anim: "cast", startup: 24, active: 4, recovery: 26, damage: 34, poise: 60, stamina: 34, knockback: 180, hitstop: 120, impact: 0.9, cooldown: 1500, special: "meteors", shape: { kind: "circle", radius: 110, offset: 150 }, desc: "Tear open the sky where you aim: six burning meteors rain down across the ground.", vfx: "meteors", color: 0xff5a2a }),
  ],
  parry: { window: 12, perfect: 5, recovery: 22, stamina: 8 },
  dodge: { distance: 112, ticks: 10, iStart: 0, iEnd: 9, recovery: 8, stamina: 22, attackFrom: 10 },
  riposte: 2.0,
  finisherMastery: 99,
};

export const WEAPONS: WeaponDef[] = [SWORD, GREATSWORD, DAGGERS, SPEAR, STAFF];

/**
 * Universal skills: learned from scrolls like any other, and usable with every weapon.
 * In a loadout they sit at UNIVERSAL_BASE + their index.
 */
export const UNIVERSAL_SKILLS: MoveDef[] = [
  move({ id: "any.kick", name: "Staggering Kick", anim: "thrust", startup: 7, active: 4, recovery: 14, damage: 8, poise: 55, lunge: 20, stamina: 12, knockback: 200, hitstop: 80, impact: 0.45, cooldown: 360, shape: { kind: "line", length: 40, width: 30 }, desc: "A heavy boot to the chest: little damage, but it staggers and throws enemies back.", vfx: "kick", color: 0xe0c8a0 }),
  move({ id: "any.knife", name: "Throwing Knife", anim: "throw", startup: 7, active: 1, recovery: 12, damage: 14, poise: 12, stamina: 10, knockback: 50, hitstop: 50, impact: 0.2, cooldown: 300, projectile: { count: 1, spread: 0, speed: 600, range: 280, radius: 6, look: "knife" }, desc: "Flick a knife at a distant foe.", vfx: "knife", color: 0xdfe8ff }),
  move({ id: "any.secondwind", name: "Second Wind", anim: "roar", startup: 10, active: 4, recovery: 16, damage: 0, poise: 0, stamina: 0, hitstop: 0, impact: 0.2, cooldown: 1500, special: "rally", desc: "Catch your breath: heal 18% of your health, and 12% for allies nearby.", vfx: "mend", color: 0x9fe08a }),
  move({ id: "any.warcry", name: "Battle Cry", anim: "roar", startup: 12, active: 4, recovery: 18, damage: 0, poise: 60, stamina: 15, knockback: 90, hitstop: 0, impact: 0.5, cooldown: 1000, special: "warcry", shape: { kind: "circle", radius: 84, offset: 0 }, desc: "A roar that staggers nearby enemies and breaks their guard.", vfx: "warcry", color: 0xffb07a }),
  move({ id: "any.blink", name: "Blink", anim: "vanish", startup: 3, active: 8, recovery: 8, damage: 0, poise: 0, lunge: 150, stamina: 16, hitstop: 0, impact: 0, cooldown: 420, iframes: [0, 12], special: "shadowstep", desc: "Vanish and reappear ahead of you, untouchable for a moment.", vfx: "shadow", color: 0x9fb8ff }),
  move({ id: "any.ironwill", name: "Iron Will", anim: "roar", startup: 6, active: 4, recovery: 10, damage: 0, poise: 0, stamina: 12, hitstop: 0, impact: 0.2, cooldown: 1200, special: "ironskin", desc: "Set your jaw: take 50% less damage for 5 seconds.", vfx: "ironskin", color: 0xc9d3dd }),
  move({ id: "any.fireball", name: "Fireball", anim: "cast", startup: 12, active: 1, recovery: 16, damage: 22, poise: 26, stamina: 16, knockback: 110, hitstop: 70, impact: 0.4, cooldown: 480, special: "burn", projectile: { count: 1, spread: 0, speed: 420, range: 300, radius: 12, look: "fire" }, desc: "Hurl a ball of fire: it bursts on the first foe it hits and sets it burning.", vfx: "fireball", color: 0xff7a2a }),
  move({ id: "any.winter", name: "Winter's Grasp", anim: "nova", startup: 12, active: 4, recovery: 18, damage: 14, poise: 30, stamina: 18, knockback: 60, hitstop: 50, impact: 0.3, cooldown: 720, special: "frost", shape: { kind: "circle", radius: 84, offset: 0 }, desc: "A burst of frost around you: it damages and slows everything it touches.", vfx: "frost", color: 0x9fe0ff }),
  move({ id: "any.thunder", name: "Thunderclap", anim: "cast", startup: 10, active: 3, recovery: 16, damage: 22, poise: 26, stamina: 16, knockback: 90, hitstop: 70, impact: 0.4, cooldown: 540, shape: { kind: "line", length: 200, width: 18 }, desc: "Call a bolt along the ground ahead of you, striking everything in a line.", vfx: "lightning", color: 0xbfe0ff }),
  move({ id: "any.bloodrage", name: "Bloodrage", anim: "roar", startup: 10, active: 4, recovery: 14, damage: 0, poise: 0, stamina: 14, hitstop: 0, impact: 0.3, cooldown: 1320, special: "bloodlust", desc: "For 6 seconds, every hit you land heals you for 20% of its damage.", vfx: "bloodlust", color: 0xff5a4a }),
  move({ id: "any.star", name: "Falling Star", anim: "cast", startup: 18, active: 2, recovery: 20, damage: 44, poise: 70, stamina: 26, knockback: 200, hitstop: 120, impact: 0.9, cooldown: 900, special: "meteor", shape: { kind: "circle", radius: 60, offset: 160 }, desc: "Pull a star down onto the ground where you aim.", vfx: "meteor", color: 0xffc04a }),
  move({ id: "any.storm", name: "Storm Call", anim: "cast", startup: 14, active: 4, recovery: 20, damage: 30, poise: 40, stamina: 24, knockback: 90, hitstop: 80, impact: 0.6, cooldown: 1020, special: "storm", desc: "Call the storm down: lightning strikes up to five enemies around you.", vfx: "storm", color: 0x9fd3ff }),
  move({ id: "any.sunburst", name: "Radiant Burst", anim: "nova", startup: 16, active: 4, recovery: 20, damage: 40, poise: 90, stamina: 24, knockback: 240, hitstop: 110, impact: 0.8, cooldown: 960, superArmor: true, shape: { kind: "circle", radius: 110, offset: 0 }, desc: "The Keeper's light bursts out of you, hurling back everything nearby.", vfx: "sunburst", color: 0xffe08a }),
  move({ id: "any.wyrmwrath", name: "Wrath of the Wyrm", anim: "roar", startup: 20, active: 6, recovery: 24, damage: 66, poise: 130, stamina: 30, knockback: 280, hitstop: 160, impact: 1, cooldown: 1500, superArmor: true, special: "burn", shape: { kind: "circle", radius: 140, offset: 0 }, desc: "Roar with a dragon's voice: an inferno bursts out of you and sets everything nearby burning.", vfx: "wyrmwrath", color: 0xff5a1a }),
  // --- Floor abilities: each floor's own arts (see FLOOR_OF in skillbook.ts) ---------------
  move({ id: "any.hatchets", name: "Hatchet Volley", anim: "throw", startup: 8, active: 1, recovery: 14, damage: 9, poise: 12, stamina: 12, knockback: 60, hitstop: 40, impact: 0.2, cooldown: 420, projectile: { count: 3, spread: 0.35, speed: 480, range: 240, radius: 7, look: "knife" }, desc: "The bandits' favourite trick: three hatchets thrown in a spread.", vfx: "hatchets", color: 0xc9a878 }),
  move({ id: "any.snare", name: "Hunter's Snare", anim: "throw", startup: 10, active: 3, recovery: 16, damage: 6, poise: 24, stamina: 14, knockback: 30, hitstop: 40, impact: 0.2, cooldown: 660, special: "frost", shape: { kind: "circle", radius: 54, offset: 110 }, desc: "Toss a weighted net where you aim, as Emberwatch's trappers do: everything under it is slowed.", vfx: "snare", color: 0xd8c08a }),
  move({ id: "any.howl", name: "Wolf's Howl", anim: "roar", startup: 10, active: 4, recovery: 14, damage: 0, poise: 0, stamina: 10, hitstop: 0, impact: 0.3, cooldown: 1200, special: "empower", power: 0.15, desc: "Howl like the packs of Whisperwood: your blows land 15% harder for 6 seconds.", vfx: "howl", color: 0xc9d3dd }),
  move({ id: "any.gale", name: "Gale Step", anim: "vanish", startup: 3, active: 10, recovery: 10, damage: 14, poise: 18, lunge: 180, stamina: 16, knockback: 90, hitstop: 50, impact: 0.3, cooldown: 480, iframes: [0, 14], special: "shadowstep", shape: { kind: "line", length: 40, width: 30 }, desc: "Ride a gust of the Terraces' wind: dash far ahead, untouchable, cutting whatever you pass through.", vfx: "gale", color: 0xcfeaff }),
  move({ id: "any.windwall", name: "Wind Wall", anim: "nova", startup: 12, active: 4, recovery: 18, damage: 10, poise: 80, stamina: 18, knockback: 340, hitstop: 60, impact: 0.6, cooldown: 960, special: "warcry", shape: { kind: "circle", radius: 110, offset: 0 }, desc: "A wall of wind bursts out of you and hurls every enemy nearby away.", vfx: "windwall", color: 0xe6f4ff }),
  move({ id: "any.drakeblood", name: "Drakeblood", anim: "roar", startup: 10, active: 4, recovery: 14, damage: 0, poise: 0, stamina: 12, hitstop: 0, impact: 0.4, cooldown: 1500, special: "empower", power: 0.3, desc: "Drink the fire in a drake's blood: your blows land 30% harder for 6 seconds.", vfx: "drakeblood", color: 0xff5a2a }),
  move({ id: "any.eruption", name: "Eruption", anim: "cast", startup: 16, active: 4, recovery: 20, damage: 38, poise: 70, stamina: 24, knockback: 200, hitstop: 110, impact: 0.8, cooldown: 900, special: "burn", shape: { kind: "circle", radius: 70, offset: 130 }, desc: "The ground bursts open where you aim: magma erupts and sets everything there burning.", vfx: "eruption", color: 0xff6a1a }),
  move({ id: "any.phoenix", name: "Phoenix Rite", anim: "nova", startup: 14, active: 4, recovery: 16, damage: 0, poise: 0, stamina: 10, hitstop: 0, impact: 0.4, cooldown: 2400, special: "phoenix", desc: "Rise in fire: heal 50% of your health (allies nearby 25%) and take half damage for 4 seconds.", vfx: "phoenix", color: 0xffa040 }),
];
/** Loadout index of the first universal skill (weapon skills sit below it). */
export const UNIVERSAL_BASE = 64;

/** A loadout index's move for a weapon: its own skill, or a universal one. */
export function skillMove(weapon: number, index: number): MoveDef | undefined {
  if (index >= UNIVERSAL_BASE) return UNIVERSAL_SKILLS[index - UNIVERSAL_BASE];
  return (WEAPONS[weapon] ?? SWORD).skills[index];
}
export const weaponByKey = (key: WeaponKey) => WEAPONS.find((w) => w.key === key)!;

/** Move ids packed in one byte: 0–15 lights, 16 heavy, 17 combo heavy, 32+ skills (pool index). */
export const MOVE_HEAVY = 16;
export const MOVE_COMBO_HEAVY = 17;
export const MOVE_SKILL_BASE = 32;
/** An empty skill slot. */
export const NO_SKILL = 255;

export function getMove(weapon: number, id: number): MoveDef {
  const w = WEAPONS[weapon] ?? SWORD;
  if (id < 16) return w.lights[id] ?? w.lights[0];
  if (id === MOVE_HEAVY) return w.heavy;
  if (id === MOVE_COMBO_HEAVY) return w.comboHeavy;
  return skillMove(weapon, id - MOVE_SKILL_BASE) ?? w.skills[0];
}

/** Every skill by id: a weapon's own (with its weapon) or a universal one. `index` is its loadout index. */
export function skillById(id: string): { weapon?: WeaponDef; index: number; move: MoveDef } | undefined {
  for (const w of WEAPONS) {
    const index = w.skills.findIndex((m) => m.id === id);
    if (index >= 0) return { weapon: w, index, move: w.skills[index] };
  }
  const u = UNIVERSAL_SKILLS.findIndex((m) => m.id === id);
  return u >= 0 ? { index: UNIVERSAL_BASE + u, move: UNIVERSAL_SKILLS[u] } : undefined;
}

export const moveLength = (m: MoveDef) => m.startup + m.active + m.recovery;
