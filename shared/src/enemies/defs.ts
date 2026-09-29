import type { Shape } from "../combat/shapes.ts";

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * Enemy attacks, in 60 Hz ticks. `windup` is the readable telegraph; the hit lands
 * on the first active tick. Parryable attacks flash a gold glint, unparryable ones
 * a red glint and must be dodged.
 */
export interface EnemyAttack {
  name: string;
  anim: string;
  windup: number;
  active: number;
  recovery: number;
  damage: number;
  knockback: number;
  shape?: Shape;
  /** Forward travel during the last third of the windup + active frames. */
  lunge?: number;
  parryable: boolean;
  /** Knocks the player down instead of a flinch. */
  heavy?: boolean;
  /** AI starts this attack when the target is within this distance. */
  range: number;
  minRange?: number;
  cooldown: number;
  /** Draw the hit area on the ground during the windup. */
  ground?: boolean;
  /** Aim at the target's position when the windup starts (ground AoE placed on the player). */
  targeted?: boolean;
  projectile?: { count: number; spread: number; speed: number; range: number; radius: number };
  /** Automatically continue into this attack index (combos). */
  chain?: number;
  weight?: number;
  /** Boss phase that unlocks this attack (0 = always). */
  phase?: number;
  special?: "summon" | "blink" | "judgement" | "bladestorm" | "sigils" | "howl";
}

export type Behavior = "dummy" | "sparring" | "pack" | "melee" | "ranged" | "defender" | "brute" | "caster" | "assassin" | "boss";

export interface EnemyLook {
  rig: "humanoid" | "wolf" | "construct" | "dragon";
  scale: number;
  skin: string;
  cloth: string;
  trim: string;
  weapon: "none" | "club" | "cleaver" | "bow" | "spear" | "shield" | "hammer" | "staff" | "daggers" | "greatsword";
  shield?: boolean;
  hood?: boolean;
  ears?: boolean;
  horns?: boolean;
  glow?: string;
  /** Dragons: what they breathe (fire by default). */
  element?: "fire" | "frost" | "shadow";
}

export interface EnemyDef {
  key: string;
  name: string;
  behavior: Behavior;
  hp: number;
  /** Stagger threshold: poise damage beyond this staggers (hits below it only flinch small enemies). */
  poise: number;
  /** Flinch on every hit (small enemies) vs only when poise breaks. */
  flinches: boolean;
  armor: number;
  speed: number;
  radius: number;
  aggroRange: number;
  leashRange: number;
  preferred: [number, number];
  attacks: EnemyAttack[];
  xp: number;
  loot: string;
  /** Summon special: which enemies answer the call. */
  minions?: string[];
  look: EnemyLook;
  /** Bosses and minibosses. */
  boss?: { title: string; phases: number[]; posture: number; music: string };
}

const atk = (a: Omit<EnemyAttack, "weight"> & { weight?: number }): EnemyAttack => ({ weight: 1, ...a });

export const ENEMIES: EnemyDef[] = [
  {
    key: "dummy",
    name: "Training Dummy",
    behavior: "dummy",
    hp: 400,
    poise: 60,
    flinches: true,
    armor: 0,
    speed: 0,
    radius: 11,
    aggroRange: 0,
    leashRange: 0,
    preferred: [0, 0],
    attacks: [],
    xp: 0,
    loot: "none",
    look: { rig: "humanoid", scale: 1, skin: "#c9a36b", cloth: "#a07a45", trim: "#6b4d2a", weapon: "none" },
  },
  {
    key: "sparring",
    name: "Sparring Knight",
    behavior: "sparring",
    hp: 600,
    poise: 80,
    flinches: false,
    armor: 0,
    speed: 0,
    radius: 12,
    aggroRange: 90,
    leashRange: 0,
    preferred: [0, 60],
    attacks: [
      atk({ name: "Overhead", anim: "overhead", windup: 40, active: 5, recovery: 40, damage: 0, knockback: 60, shape: { kind: "arc", range: 56, arc: deg(140) }, parryable: true, range: 70, cooldown: 30 }),
      atk({ name: "Low Sweep", anim: "spin", windup: 34, active: 6, recovery: 40, damage: 0, knockback: 60, shape: { kind: "circle", radius: 64, offset: 0 }, parryable: false, ground: true, range: 70, cooldown: 30 }),
      atk({ name: "Quick Jab", anim: "thrust", windup: 18, active: 4, recovery: 36, damage: 0, knockback: 40, shape: { kind: "line", length: 64, width: 20 }, parryable: true, range: 70, cooldown: 30 }),
    ],
    xp: 0,
    loot: "none",
    look: { rig: "humanoid", scale: 1.15, skin: "#b9b4a8", cloth: "#6e7c8c", trim: "#c9a24a", weapon: "spear" },
  },
  {
    key: "wolf",
    name: "Grey Wolf",
    behavior: "pack",
    hp: 34,
    poise: 20,
    flinches: true,
    armor: 0,
    speed: 175,
    radius: 10,
    aggroRange: 190,
    leashRange: 520,
    preferred: [60, 90],
    attacks: [
      atk({ name: "Bite", anim: "bite", windup: 20, active: 4, recovery: 26, damage: 7, knockback: 60, lunge: 30, shape: { kind: "arc", range: 26, arc: deg(90) }, parryable: true, range: 46, cooldown: 50 }),
      atk({ name: "Pounce", anim: "pounce", windup: 32, active: 8, recovery: 36, damage: 11, knockback: 110, lunge: 118, shape: { kind: "arc", range: 24, arc: deg(110) }, parryable: true, range: 135, minRange: 70, cooldown: 150 }),
    ],
    xp: 12,
    loot: "beast",
    look: { rig: "wolf", scale: 1, skin: "#7d7f86", cloth: "#5b5d63", trim: "#d9d4c8", weapon: "none" },
  },
  {
    key: "alpha",
    name: "Alpha Wolf",
    behavior: "pack",
    hp: 120,
    poise: 45,
    flinches: false,
    armor: 0.1,
    speed: 185,
    radius: 13,
    aggroRange: 220,
    leashRange: 560,
    preferred: [70, 100],
    attacks: [
      atk({ name: "Maul", anim: "bite", windup: 22, active: 5, recovery: 24, damage: 12, knockback: 90, lunge: 36, shape: { kind: "arc", range: 30, arc: deg(110) }, parryable: true, range: 52, cooldown: 40, chain: 1 }),
      atk({ name: "Maul", anim: "bite", windup: 14, active: 5, recovery: 30, damage: 12, knockback: 110, lunge: 30, shape: { kind: "arc", range: 30, arc: deg(110) }, parryable: true, range: 52, cooldown: 40, weight: 0 }),
      atk({ name: "Pounce", anim: "pounce", windup: 30, active: 8, recovery: 36, damage: 16, knockback: 140, lunge: 140, shape: { kind: "arc", range: 28, arc: deg(110) }, parryable: false, heavy: true, range: 160, minRange: 80, cooldown: 160 }),
      atk({ name: "Howl", anim: "howl", windup: 40, active: 2, recovery: 20, damage: 0, knockback: 0, parryable: false, range: 400, cooldown: 900, special: "howl" }),
    ],
    xp: 60,
    loot: "elite",
    look: { rig: "wolf", scale: 1.35, skin: "#4a4c55", cloth: "#34363d", trim: "#e8e2d4", weapon: "none", glow: "#ffcf6b" },
  },
  {
    key: "goblin",
    name: "Goblin Cutthroat",
    behavior: "melee",
    hp: 46,
    poise: 22,
    flinches: true,
    armor: 0,
    speed: 128,
    radius: 10,
    aggroRange: 200,
    leashRange: 520,
    preferred: [20, 40],
    attacks: [
      atk({ name: "Hack", anim: "slashR", windup: 20, active: 4, recovery: 10, damage: 8, knockback: 60, lunge: 14, shape: { kind: "arc", range: 34, arc: deg(120) }, parryable: true, range: 42, cooldown: 60, chain: 1, weight: 2 }),
      atk({ name: "Hack", anim: "slashL", windup: 12, active: 4, recovery: 28, damage: 8, knockback: 80, lunge: 14, shape: { kind: "arc", range: 34, arc: deg(120) }, parryable: true, range: 42, cooldown: 60, weight: 0 }),
      atk({ name: "Skullsplitter", anim: "overhead", windup: 36, active: 5, recovery: 34, damage: 15, knockback: 130, lunge: 22, shape: { kind: "arc", range: 38, arc: deg(90) }, parryable: true, heavy: true, range: 46, cooldown: 180 }),
    ],
    xp: 16,
    loot: "goblin",
    look: { rig: "humanoid", scale: 0.85, skin: "#7fa24a", cloth: "#6b4a2e", trim: "#a8823f", weapon: "cleaver", ears: true },
  },
  {
    key: "archer",
    name: "Goblin Archer",
    behavior: "ranged",
    hp: 32,
    poise: 16,
    flinches: true,
    armor: 0,
    speed: 118,
    radius: 10,
    aggroRange: 250,
    leashRange: 560,
    preferred: [140, 220],
    attacks: [
      atk({ name: "Arrow", anim: "bow", windup: 36, active: 1, recovery: 26, damage: 9, knockback: 60, parryable: true, range: 260, minRange: 60, cooldown: 70, projectile: { count: 1, spread: 0, speed: 340, range: 320, radius: 5 } }),
      atk({ name: "Volley", anim: "bow", windup: 50, active: 1, recovery: 30, damage: 7, knockback: 50, parryable: true, range: 240, minRange: 80, cooldown: 300, projectile: { count: 3, spread: 0.34, speed: 320, range: 300, radius: 5 } }),
    ],
    xp: 16,
    loot: "goblin",
    look: { rig: "humanoid", scale: 0.85, skin: "#8aa656", cloth: "#4f5b34", trim: "#8f6a3a", weapon: "bow", ears: true, hood: true },
  },
  {
    key: "shieldbearer",
    name: "Bandit Shieldbearer",
    behavior: "defender",
    hp: 78,
    poise: 34,
    flinches: false,
    armor: 0.15,
    speed: 92,
    radius: 12,
    aggroRange: 200,
    leashRange: 480,
    preferred: [30, 56],
    attacks: [
      atk({ name: "Shield Bash", anim: "bash", windup: 22, active: 5, recovery: 30, damage: 9, knockback: 150, lunge: 26, shape: { kind: "arc", range: 32, arc: deg(100) }, parryable: true, range: 42, cooldown: 90 }),
      atk({ name: "Spear Thrust", anim: "thrust", windup: 28, active: 5, recovery: 30, damage: 13, knockback: 90, lunge: 12, shape: { kind: "line", length: 66, width: 18 }, parryable: true, range: 70, cooldown: 70, weight: 2 }),
    ],
    xp: 26,
    loot: "bandit",
    look: { rig: "humanoid", scale: 1.05, skin: "#d8a97c", cloth: "#6a3b36", trim: "#9aa0a8", weapon: "spear", shield: true },
  },
  {
    key: "cutpurse",
    name: "Bandit Cutpurse",
    behavior: "melee",
    hp: 52,
    poise: 24,
    flinches: true,
    armor: 0,
    speed: 140,
    radius: 10,
    aggroRange: 210,
    leashRange: 520,
    preferred: [20, 40],
    attacks: [
      atk({ name: "Slash", anim: "slashR", windup: 16, active: 4, recovery: 12, damage: 9, knockback: 60, lunge: 18, shape: { kind: "arc", range: 36, arc: deg(110) }, parryable: true, range: 44, cooldown: 50, chain: 1, weight: 2 }),
      atk({ name: "Slash", anim: "slashL", windup: 10, active: 4, recovery: 12, damage: 9, knockback: 60, lunge: 18, shape: { kind: "arc", range: 36, arc: deg(110) }, parryable: true, range: 44, cooldown: 50, chain: 2, weight: 0 }),
      atk({ name: "Delayed Stab", anim: "thrust", windup: 30, active: 4, recovery: 34, damage: 14, knockback: 100, lunge: 34, shape: { kind: "line", length: 50, width: 18 }, parryable: true, range: 44, cooldown: 50, weight: 0 }),
    ],
    xp: 20,
    loot: "bandit",
    look: { rig: "humanoid", scale: 0.95, skin: "#c79a74", cloth: "#3f3a4a", trim: "#7b3b3b", weapon: "cleaver", hood: true },
  },
  {
    key: "brute",
    name: "Stonehide Brute",
    behavior: "brute",
    hp: 190,
    poise: 70,
    flinches: false,
    armor: 0.2,
    speed: 82,
    radius: 16,
    aggroRange: 190,
    leashRange: 460,
    preferred: [30, 60],
    attacks: [
      atk({ name: "Swipe", anim: "bigSlashR", windup: 30, active: 6, recovery: 30, damage: 16, knockback: 160, lunge: 16, shape: { kind: "arc", range: 58, arc: deg(160) }, parryable: true, range: 62, cooldown: 70, weight: 2 }),
      atk({ name: "Slam", anim: "overhead", windup: 50, active: 6, recovery: 44, damage: 26, knockback: 220, lunge: 10, shape: { kind: "circle", radius: 46, offset: 38 }, parryable: false, heavy: true, ground: true, range: 70, cooldown: 150 }),
      atk({ name: "Stomp", anim: "stomp", windup: 40, active: 5, recovery: 40, damage: 14, knockback: 200, shape: { kind: "circle", radius: 74, offset: 0 }, parryable: false, heavy: true, ground: true, range: 60, cooldown: 260 }),
    ],
    xp: 55,
    loot: "brute",
    look: { rig: "humanoid", scale: 1.7, skin: "#8d8f83", cloth: "#5a4636", trim: "#3c3a36", weapon: "hammer" },
  },
  {
    key: "cultist",
    name: "Hollow Cultist",
    behavior: "caster",
    hp: 50,
    poise: 20,
    flinches: true,
    armor: 0,
    speed: 96,
    radius: 10,
    aggroRange: 240,
    leashRange: 520,
    preferred: [150, 230],
    attacks: [
      atk({ name: "Shadow Bolt", anim: "cast", windup: 32, active: 1, recovery: 28, damage: 11, knockback: 70, parryable: true, range: 260, minRange: 50, cooldown: 80, weight: 2, projectile: { count: 1, spread: 0, speed: 230, range: 340, radius: 8 } }),
      atk({ name: "Hex Circle", anim: "channel", windup: 62, active: 6, recovery: 30, damage: 18, knockback: 120, shape: { kind: "circle", radius: 46, offset: 0 }, parryable: false, ground: true, targeted: true, range: 240, cooldown: 240 }),
      atk({ name: "Blink", anim: "vanish", windup: 16, active: 1, recovery: 16, damage: 0, knockback: 0, parryable: false, range: 70, cooldown: 360, special: "blink" }),
    ],
    xp: 24,
    loot: "cultist",
    look: { rig: "humanoid", scale: 1, skin: "#b6a9c9", cloth: "#2e2640", trim: "#8a6ad1", weapon: "staff", hood: true, glow: "#a98bff" },
  },
  {
    key: "stalker",
    name: "Ruin Stalker",
    behavior: "assassin",
    hp: 44,
    poise: 18,
    flinches: true,
    armor: 0,
    speed: 175,
    radius: 10,
    aggroRange: 230,
    leashRange: 560,
    preferred: [110, 170],
    attacks: [
      atk({ name: "Dash Strike", anim: "thrust", windup: 16, active: 6, recovery: 30, damage: 14, knockback: 90, lunge: 140, shape: { kind: "arc", range: 26, arc: deg(100) }, parryable: true, range: 170, minRange: 60, cooldown: 110, weight: 2 }),
      atk({ name: "Slice", anim: "stabR", windup: 10, active: 3, recovery: 8, damage: 6, knockback: 40, lunge: 12, shape: { kind: "arc", range: 30, arc: deg(100) }, parryable: true, range: 40, cooldown: 60, chain: 2 }),
      atk({ name: "Slice", anim: "stabL", windup: 8, active: 3, recovery: 34, damage: 6, knockback: 60, lunge: 12, shape: { kind: "arc", range: 30, arc: deg(100) }, parryable: true, range: 40, cooldown: 60, weight: 0 }),
    ],
    xp: 26,
    loot: "ruins",
    look: { rig: "humanoid", scale: 0.95, skin: "#5d6470", cloth: "#1f2229", trim: "#3a8f8a", weapon: "daggers", hood: true },
  },
  {
    key: "grakk",
    name: "Grakk, the Bandit King",
    behavior: "boss",
    hp: 900,
    poise: 999,
    flinches: false,
    armor: 0.15,
    speed: 118,
    radius: 16,
    aggroRange: 230,
    leashRange: 700,
    preferred: [30, 60],
    attacks: [
      atk({ name: "Cleave", anim: "bigSlashR", windup: 24, active: 5, recovery: 12, damage: 16, knockback: 110, lunge: 20, shape: { kind: "arc", range: 58, arc: deg(150) }, parryable: true, range: 64, cooldown: 60, chain: 1, weight: 2 }),
      atk({ name: "Cleave", anim: "bigSlashL", windup: 16, active: 5, recovery: 12, damage: 16, knockback: 110, lunge: 20, shape: { kind: "arc", range: 58, arc: deg(150) }, parryable: true, range: 64, cooldown: 60, chain: 2, weight: 0 }),
      atk({ name: "Crushing Overhead", anim: "overhead", windup: 34, active: 6, recovery: 40, damage: 26, knockback: 200, lunge: 18, shape: { kind: "circle", radius: 40, offset: 40 }, parryable: true, heavy: true, range: 64, cooldown: 60, weight: 0 }),
      atk({ name: "Leaping Smash", anim: "leap", windup: 44, active: 6, recovery: 46, damage: 28, knockback: 240, lunge: 150, shape: { kind: "circle", radius: 58, offset: 0 }, parryable: false, heavy: true, ground: true, range: 200, minRange: 90, cooldown: 260 }),
      atk({ name: "Rally the Gang", anim: "roar", windup: 50, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 500, cooldown: 1200, special: "summon", phase: 1 }),
      atk({ name: "Bull Rush", anim: "charge", windup: 36, active: 22, recovery: 40, damage: 20, knockback: 220, lunge: 260, shape: { kind: "arc", range: 34, arc: deg(120) }, parryable: false, heavy: true, ground: true, range: 260, minRange: 110, cooldown: 300, phase: 1 }),
    ],
    xp: 400,
    loot: "grakk",
    look: { rig: "humanoid", scale: 1.55, skin: "#6f8f3c", cloth: "#5a2f2a", trim: "#c9a24a", weapon: "greatsword", ears: true, horns: true },
    boss: { title: "Grakk, the Bandit King", phases: [0.5], posture: 160, music: "miniboss" },
  },
  {
    key: "warden",
    name: "The Undercroft Warden",
    behavior: "boss",
    hp: 1100,
    poise: 999,
    flinches: false,
    armor: 0.2,
    speed: 100,
    radius: 17,
    aggroRange: 260,
    leashRange: 900,
    preferred: [40, 70],
    attacks: [
      atk({ name: "Halberd Sweep", anim: "sweep", windup: 30, active: 6, recovery: 30, damage: 18, knockback: 150, shape: { kind: "arc", range: 74, arc: deg(200), inner: 20 }, parryable: true, range: 74, cooldown: 60, weight: 2 }),
      atk({ name: "Impale", anim: "thrust", windup: 26, active: 5, recovery: 34, damage: 20, knockback: 160, lunge: 40, shape: { kind: "line", length: 96, width: 22 }, parryable: true, range: 96, cooldown: 60, weight: 2 }),
      atk({ name: "Sentinel Slam", anim: "overhead", windup: 48, active: 6, recovery: 44, damage: 30, knockback: 240, shape: { kind: "circle", radius: 64, offset: 30 }, parryable: false, heavy: true, ground: true, range: 80, cooldown: 200 }),
      atk({ name: "Chains of the Deep", anim: "channel", windup: 66, active: 6, recovery: 30, damage: 20, knockback: 140, shape: { kind: "circle", radius: 50, offset: 0 }, parryable: false, ground: true, targeted: true, range: 300, cooldown: 280, phase: 1 }),
      atk({ name: "Warden's Judgement", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 500, cooldown: 900, special: "summon", phase: 1 }),
    ],
    xp: 600,
    loot: "warden",
    look: { rig: "humanoid", scale: 1.75, skin: "#5a6470", cloth: "#2f3a45", trim: "#7fd1c7", weapon: "spear", glow: "#7fd1c7" },
    boss: { title: "The Undercroft Warden", phases: [0.5], posture: 200, music: "miniboss" },
  },
  {
    key: "aurelion",
    name: "Aurelion, Keeper of the First Gate",
    behavior: "boss",
    hp: 3200,
    poise: 999,
    flinches: false,
    armor: 0.25,
    speed: 120,
    radius: 22,
    aggroRange: 420,
    leashRange: 2000,
    preferred: [40, 80],
    attacks: [
      // Phase 1 — learn his sword.
      atk({ name: "Gate Cleave", anim: "bigSlashR", windup: 26, active: 6, recovery: 10, damage: 20, knockback: 140, lunge: 24, shape: { kind: "arc", range: 78, arc: deg(160) }, parryable: true, range: 84, cooldown: 50, chain: 1, weight: 3 }),
      atk({ name: "Gate Cleave", anim: "bigSlashL", windup: 18, active: 6, recovery: 12, damage: 20, knockback: 140, lunge: 24, shape: { kind: "arc", range: 78, arc: deg(160) }, parryable: true, range: 84, cooldown: 50, chain: 2, weight: 0 }),
      // The delayed third hit punishes panic parries.
      atk({ name: "Held Verdict", anim: "overhead", windup: 52, active: 6, recovery: 44, damage: 32, knockback: 220, lunge: 30, shape: { kind: "circle", radius: 50, offset: 56 }, parryable: true, heavy: true, range: 84, cooldown: 50, weight: 0 }),
      atk({ name: "Radiant Thrust", anim: "thrust", windup: 30, active: 6, recovery: 40, damage: 26, knockback: 200, lunge: 90, shape: { kind: "line", length: 120, width: 28 }, parryable: true, range: 180, minRange: 60, cooldown: 140, weight: 2 }),
      atk({ name: "Shield of Dawn", anim: "charge", windup: 40, active: 24, recovery: 44, damage: 24, knockback: 260, lunge: 300, shape: { kind: "arc", range: 40, arc: deg(130) }, parryable: false, heavy: true, ground: true, range: 320, minRange: 140, cooldown: 280 }),
      atk({ name: "Sunfall", anim: "overhead", windup: 54, active: 6, recovery: 46, damage: 34, knockback: 260, shape: { kind: "circle", radius: 90, offset: 0 }, parryable: false, heavy: true, ground: true, range: 90, cooldown: 240 }),
      // Phase 2 — new mechanics.
      atk({ name: "Blade Storm", anim: "spin", windup: 44, active: 30, recovery: 40, damage: 14, knockback: 90, parryable: false, range: 360, cooldown: 420, special: "bladestorm", phase: 1, projectile: { count: 12, spread: Math.PI * 2, speed: 210, range: 420, radius: 9 } }),
      atk({ name: "Sigils of Binding", anim: "channel", windup: 70, active: 6, recovery: 30, damage: 24, knockback: 160, shape: { kind: "circle", radius: 54, offset: 0 }, parryable: false, ground: true, range: 420, cooldown: 360, special: "sigils", phase: 1 }),
      // Phase 3 — the ultimate.
      atk({ name: "Judgement of the Gate", anim: "roar", windup: 180, active: 6, recovery: 90, damage: 70, knockback: 300, parryable: false, heavy: true, range: 1000, cooldown: 1500, special: "judgement", phase: 2 }),
    ],
    xp: 2000,
    loot: "aurelion",
    look: { rig: "construct", scale: 2.3, skin: "#d9c79a", cloth: "#39424f", trim: "#f0c860", weapon: "greatsword", shield: true, glow: "#ffd98a" },
    boss: { title: "Aurelion, Keeper of the First Gate", phases: [0.7, 0.35], posture: 260, music: "boss" },
  },
];

/**
 * Difficulty: how tough enemies are relative to their base stats. Normal enemies are
 * meant to take a couple of full combos and to punish a player who trades hits.
 */
export const ENEMY_TUNING = {
  /** Normal enemies: ~6–12 s to kill for an on-level climber (npm run curve). */
  hp: 3.3,
  dmg: 1.85,
  /** Per level: enough to keep pace with how players grow (level, gear tier, rarity, mastery). */
  hpPerLevel: 0.2,
  dmgPerLevel: 0.1,
  /** Bosses keep their tested health curve (their fights are built on phases and posture) but hit harder. */
  bossHp: 1,
  bossHpPerLevel: 0.12,
  bossDmg: 1.35,
  eliteHp: 2,
  eliteDmg: 1.35,
  /** Longer fights are worth more (but levels are hard-won: the story carries most of the way). */
  xp: 1.3,
  /**
   * Per-enemy corrections, from the time-to-kill / time-to-die table (npm run curve):
   * a normal enemy should fall in ~6–12 s to an on-level climber (heavies up to ~16 s),
   * and should take several times longer to kill you than you take to kill it.
   */
  per: {
    goblin: { hp: 0.85 },
    cutpurse: { dmg: 0.85 },
    shieldbearer: { hp: 0.7 },
    alpha: { hp: 0.5, dmg: 0.85 },
    brute: { hp: 0.42, dmg: 0.9 },
    // Floor 2
    skyguard: { hp: 0.85 },
    aegis: { hp: 0.62 },
    sentinel: { hp: 0.42 },
  } as Record<string, { hp?: number; dmg?: number }>,
};

const practice = (def: EnemyDef) => def.behavior === "dummy" || def.behavior === "sparring";

export function enemyMaxHp(def: EnemyDef, level: number, elite = false, hpScale = 1) {
  const t = ENEMY_TUNING;
  if (practice(def)) return Math.round(def.hp * hpScale);
  if (def.boss) return Math.round(def.hp * t.bossHp * (1 + (level - 1) * t.bossHpPerLevel) * hpScale);
  const per = t.per[def.key]?.hp ?? 1;
  return Math.round(def.hp * t.hp * per * (elite ? t.eliteHp : 1) * (1 + (level - 1) * t.hpPerLevel) * hpScale);
}

export function enemyDamageScale(def: EnemyDef, level: number, elite = false) {
  const t = ENEMY_TUNING;
  if (practice(def)) return 1;
  const per = def.boss ? 1 : (t.per[def.key]?.dmg ?? 1);
  return (def.boss ? t.bossDmg : t.dmg) * per * (elite ? t.eliteDmg : 1) * (1 + (level - 1) * t.dmgPerLevel);
}

export const enemyXp = (def: EnemyDef) => (def.boss ? def.xp : Math.round(def.xp * ENEMY_TUNING.xp));

export const enemyIndex = (key: string) => ENEMIES.findIndex((e) => e.key === key);
export const enemyDef = (i: number) => ENEMIES[i];

/** Enemy action states (synced). */
export const EAct = {
  Idle: 0,
  Move: 1,
  Attack: 2,
  Hurt: 3,
  Stagger: 4,
  Dead: 5,
  Guard: 6,
  Spawn: 7,
  Leash: 8,
} as const;

export const EFlag = {
  Elite: 1,
  Riposte: 2, // parried/staggered: next player hit is a critical riposte
  Chilled: 4,
  Aggro: 8,
  Enraged: 16,
  Hidden: 32,
  /** Taking poison damage over time (Venom Edge). */
  Poisoned: 64,
  /** Death Mark: takes 30% more damage from everyone. */
  Marked: 128,
  /** Burning (dragonfire skills, Emberblood). */
  Burning: 256,
  /** Cursed (void skills, Umbral Touch): deals 30% less damage, takes 10% more. */
  Cursed: 512,
} as const;

/** Tick timeline of an enemy attack. */
export const attackLength = (a: EnemyAttack) => a.windup + a.active + a.recovery;
