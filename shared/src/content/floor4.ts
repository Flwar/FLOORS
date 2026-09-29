/**
 * Floor 4 content — the Frostvale: snowfields, a frozen lake and the Glacier Throne.
 * Enemies (rime wolves, yetis, ice wraiths, the white wyrm Glacierfang, Jarnhild the Frost
 * Giant and Hrimthar, the Winter King), materials, the Frostforged set, loot tables and shops.
 */
import type { Shape } from "../combat/shapes.ts";
import { ENEMIES, type EnemyAttack, type EnemyDef } from "../enemies/defs.ts";
import { ITEMS, type ItemBase } from "../items/items.ts";
import { LOOT, priceGear, SHOPS } from "../items/loot.ts";
import { DRAGON_GEAR } from "./floor3.ts";

const deg = (d: number) => (d * Math.PI) / 180;
const atk = (a: Omit<EnemyAttack, "weight"> & { weight?: number }): EnemyAttack => ({ weight: 1, ...a });
const arc = (range: number, a: number): Shape => ({ kind: "arc", range, arc: deg(a) });
const circle = (radius: number, offset = 0): Shape => ({ kind: "circle", radius, offset });

// ---------------------------------------------------------------------------
// Enemies

const FLOOR4_ENEMIES: EnemyDef[] = [
  {
    key: "rimewolf",
    name: "Rime Wolf",
    behavior: "pack",
    hp: 50,
    poise: 26,
    flinches: true,
    armor: 0,
    speed: 204,
    radius: 11,
    aggroRange: 230,
    leashRange: 580,
    preferred: [60, 100],
    attacks: [
      atk({ name: "Frostbite", anim: "bite", windup: 17, active: 5, recovery: 24, damage: 13, knockback: 70, lunge: 34, shape: arc(30, 110), parryable: true, range: 50, cooldown: 44 }),
      atk({ name: "Snow Pounce", anim: "pounce", windup: 30, active: 8, recovery: 34, damage: 17, knockback: 130, lunge: 150, shape: arc(28, 120), parryable: true, range: 160, minRange: 70, cooldown: 140 }),
    ],
    xp: 26,
    loot: "f4beast",
    look: { rig: "wolf", scale: 1.15, skin: "#e6eef5", cloth: "#9ab0c4", trim: "#6fb8ff", weapon: "none", glow: "#bfe6ff" },
  },
  {
    key: "yeti",
    name: "Yeti",
    behavior: "brute",
    hp: 118,
    poise: 90,
    flinches: false,
    armor: 0.12,
    speed: 98,
    radius: 16,
    aggroRange: 210,
    leashRange: 540,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Maul", anim: "slashR", windup: 26, active: 6, recovery: 28, damage: 28, knockback: 170, lunge: 18, shape: arc(60, 150), parryable: true, range: 70, cooldown: 70, weight: 2 }),
      atk({ name: "Ground Pound", anim: "overhead", windup: 42, active: 6, recovery: 34, damage: 32, knockback: 220, shape: circle(66, 24), parryable: false, heavy: true, ground: true, range: 80, cooldown: 150 }),
      atk({ name: "Snowball Hurl", anim: "throw", windup: 32, active: 1, recovery: 30, damage: 22, knockback: 160, parryable: true, range: 280, minRange: 90, cooldown: 160, projectile: { count: 1, spread: 0, speed: 280, range: 300, radius: 13 } }),
    ],
    xp: 72,
    loot: "f4beast",
    look: { rig: "humanoid", scale: 1.55, skin: "#e8eef4", cloth: "#c9d6e2", trim: "#6f8aa4", weapon: "none", horns: true, glow: "#6fb8ff" },
  },
  {
    key: "icewraith",
    name: "Ice Wraith",
    behavior: "caster",
    hp: 56,
    poise: 22,
    flinches: true,
    armor: 0,
    speed: 112,
    radius: 10,
    aggroRange: 260,
    leashRange: 620,
    preferred: [150, 220],
    attacks: [
      atk({ name: "Frost Bolt", anim: "cast", windup: 24, active: 1, recovery: 26, damage: 16, knockback: 80, parryable: true, range: 340, minRange: 70, cooldown: 76, projectile: { count: 1, spread: 0, speed: 330, range: 360, radius: 8 }, weight: 2 }),
      atk({ name: "Rime Circle", anim: "channel", windup: 46, active: 6, recovery: 28, damage: 22, knockback: 120, shape: circle(46), parryable: false, ground: true, targeted: true, range: 330, cooldown: 200 }),
      atk({ name: "Cold Step", anim: "cast", windup: 14, active: 2, recovery: 16, damage: 0, knockback: 0, parryable: false, range: 90, cooldown: 300, special: "blink" }),
    ],
    xp: 40,
    loot: "f4caster",
    look: { rig: "humanoid", scale: 1, skin: "#bfd4e6", cloth: "#2e4a6a", trim: "#bfe6ff", weapon: "staff", hood: true, glow: "#bfe6ff" },
  },
  {
    key: "rimeguard",
    name: "Rimeguard",
    behavior: "defender",
    hp: 100,
    poise: 42,
    flinches: false,
    armor: 0.14,
    speed: 104,
    radius: 12,
    aggroRange: 220,
    leashRange: 560,
    preferred: [40, 70],
    attacks: [
      atk({ name: "Frost Axe", anim: "slashR", windup: 24, active: 6, recovery: 26, damage: 19, knockback: 120, lunge: 14, shape: arc(46, 140), parryable: true, range: 54, cooldown: 60, weight: 2 }),
      atk({ name: "Shield Bash", anim: "thrust", windup: 20, active: 5, recovery: 24, damage: 13, knockback: 160, lunge: 30, shape: { kind: "line", length: 40, width: 26 }, parryable: true, range: 50, cooldown: 120 }),
      atk({ name: "Ice Slam", anim: "overhead", windup: 40, active: 6, recovery: 32, damage: 25, knockback: 180, shape: circle(56, 20), parryable: false, heavy: true, ground: true, range: 70, cooldown: 220 }),
    ],
    xp: 48,
    loot: "f4soldier",
    look: { rig: "humanoid", scale: 1.1, skin: "#c9a07c", cloth: "#3a5a7a", trim: "#bfe6ff", weapon: "hammer", shield: true, glow: "#bfe6ff" },
  },
  {
    key: "icegolem",
    name: "Ice Golem",
    behavior: "brute",
    hp: 108,
    poise: 90,
    flinches: false,
    armor: 0.22,
    speed: 80,
    radius: 16,
    aggroRange: 200,
    leashRange: 520,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Glacial Slam", anim: "overhead", windup: 42, active: 6, recovery: 36, damage: 33, knockback: 220, shape: circle(60, 30), parryable: false, heavy: true, ground: true, range: 80, cooldown: 120, weight: 2 }),
      atk({ name: "Ice Sweep", anim: "sweep", windup: 34, active: 8, recovery: 32, damage: 25, knockback: 180, shape: { kind: "arc", range: 70, arc: deg(200), inner: 16 }, parryable: true, range: 66, cooldown: 90 }),
      atk({ name: "Shard Burst", anim: "roar", windup: 40, active: 4, recovery: 40, damage: 15, knockback: 90, parryable: false, range: 200, cooldown: 240, special: "bladestorm", projectile: { count: 8, spread: Math.PI * 2, speed: 240, range: 240, radius: 8 } }),
    ],
    xp: 74,
    loot: "f4construct",
    look: { rig: "construct", scale: 1.7, skin: "#9fc8e8", cloth: "#5a7a9a", trim: "#eaf6ff", weapon: "hammer", glow: "#bfe6ff" },
  },
  {
    key: "frostdrake",
    name: "Frost Drake",
    behavior: "melee",
    hp: 112,
    poise: 50,
    flinches: false,
    armor: 0.1,
    speed: 152,
    radius: 16,
    aggroRange: 260,
    leashRange: 620,
    preferred: [50, 90],
    attacks: [
      atk({ name: "Drake Bite", anim: "bite", windup: 22, active: 6, recovery: 26, damage: 19, knockback: 110, lunge: 24, shape: arc(40, 100), parryable: true, range: 60, cooldown: 60, weight: 2 }),
      atk({ name: "Tail Lash", anim: "tail", windup: 26, active: 8, recovery: 28, damage: 17, knockback: 150, shape: circle(50), parryable: true, range: 56, cooldown: 110 }),
      atk({ name: "Frost Spit", anim: "breath", windup: 28, active: 2, recovery: 28, damage: 13, knockback: 60, parryable: true, range: 300, minRange: 80, cooldown: 160, projectile: { count: 3, spread: 0.35, speed: 300, range: 320, radius: 9 } }),
      atk({ name: "Wing Dive", anim: "dive", windup: 34, active: 8, recovery: 34, damage: 23, knockback: 180, lunge: 150, shape: { kind: "line", length: 50, width: 34 }, parryable: false, heavy: true, ground: true, range: 200, minRange: 90, cooldown: 220 }),
    ],
    xp: 66,
    loot: "f4drake",
    look: { rig: "dragon", scale: 1.25, skin: "#7fb2dc", cloth: "#2a4a7a", trim: "#eaf6ff", weapon: "none", horns: true, glow: "#dff4ff", element: "frost" },
  },
  // --- The white wyrm of the Glacier Peak: wears the seal that opens the Glacier Throne. -----
  {
    key: "glacierfang",
    name: "Glacierfang, the White Wyrm",
    behavior: "boss",
    hp: 1300,
    poise: 999,
    flinches: false,
    armor: 0.2,
    speed: 120,
    radius: 30,
    aggroRange: 380,
    leashRange: 1400,
    preferred: [70, 130],
    minions: ["frostdrake", "rimewolf"],
    attacks: [
      atk({ name: "Rending Bite", anim: "bite", windup: 26, active: 6, recovery: 24, damage: 27, knockback: 150, lunge: 30, shape: arc(70, 110), parryable: true, range: 90, cooldown: 60, weight: 3 }),
      atk({ name: "Tail Sweep", anim: "tail", windup: 34, active: 8, recovery: 30, damage: 25, knockback: 200, shape: circle(96), parryable: false, heavy: true, ground: true, range: 110, cooldown: 150 }),
      atk({ name: "Frost Breath", anim: "breath", windup: 44, active: 26, recovery: 34, damage: 30, knockback: 150, shape: arc(210, 55), parryable: false, heavy: true, ground: true, range: 230, cooldown: 220, weight: 2 }),
      atk({ name: "Wing Buffet", anim: "wing", windup: 30, active: 6, recovery: 30, damage: 12, knockback: 300, shape: circle(120), parryable: false, ground: true, range: 140, cooldown: 260 }),
      atk({ name: "Sky Dive", anim: "dive", windup: 50, active: 10, recovery: 40, damage: 35, knockback: 240, lunge: 260, shape: { kind: "line", length: 70, width: 60 }, parryable: false, heavy: true, ground: true, range: 360, minRange: 120, cooldown: 300 }),
      atk({ name: "Hailfall", anim: "roar", windup: 60, active: 6, recovery: 30, damage: 25, knockback: 150, shape: circle(48), parryable: false, ground: true, range: 380, cooldown: 320, special: "sigils", phase: 1 }),
      atk({ name: "Call the Brood", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 380, cooldown: 900, special: "summon", phase: 1 }),
    ],
    xp: 2900,
    loot: "glacierfang",
    look: { rig: "dragon", scale: 2.4, skin: "#dfeaf4", cloth: "#4a6a9a", trim: "#bfe6ff", weapon: "none", horns: true, glow: "#8fd3ff", element: "frost" },
    boss: { title: "Glacierfang, the White Wyrm", phases: [0.5], posture: 290, music: "miniboss" },
  },
  // --- The Glacier Throne ------------------------------------------------------------------------
  {
    key: "jarnhild",
    name: "Jarnhild the Frost Giant",
    behavior: "boss",
    hp: 1750,
    poise: 999,
    flinches: false,
    armor: 0.25,
    speed: 118,
    radius: 20,
    aggroRange: 420,
    leashRange: 1600,
    preferred: [60, 100],
    minions: ["rimewolf", "icewraith"],
    attacks: [
      atk({ name: "Giant's Cleave", anim: "bigSlashR", windup: 30, active: 6, recovery: 14, damage: 30, knockback: 170, lunge: 24, shape: arc(96, 160), parryable: true, range: 110, cooldown: 55, chain: 1, weight: 3 }),
      atk({ name: "Backhand", anim: "bigSlashL", windup: 20, active: 6, recovery: 30, damage: 26, knockback: 200, lunge: 16, shape: arc(90, 150), parryable: true, range: 100, cooldown: 55, weight: 0 }),
      atk({ name: "Giant's Stomp", anim: "overhead", windup: 44, active: 6, recovery: 34, damage: 34, knockback: 240, shape: circle(92), parryable: false, heavy: true, ground: true, range: 110, cooldown: 180 }),
      atk({ name: "Boulder of Ice", anim: "throw", windup: 36, active: 1, recovery: 32, damage: 28, knockback: 200, parryable: true, range: 380, minRange: 120, cooldown: 200, projectile: { count: 1, spread: 0, speed: 300, range: 420, radius: 16 } }),
      atk({ name: "Frozen Ground", anim: "channel", windup: 60, active: 6, recovery: 30, damage: 23, knockback: 150, shape: circle(50), parryable: false, ground: true, range: 400, cooldown: 300, special: "sigils", phase: 1 }),
      atk({ name: "Avalanche", anim: "roar", windup: 44, active: 24, recovery: 40, damage: 15, knockback: 100, parryable: false, range: 360, cooldown: 380, special: "bladestorm", phase: 1, projectile: { count: 14, spread: Math.PI * 2, speed: 220, range: 400, radius: 10 } }),
    ],
    xp: 2700,
    loot: "jarnhild",
    look: { rig: "humanoid", scale: 2.3, skin: "#9fb4c8", cloth: "#3a4a5a", trim: "#bfe6ff", weapon: "club", horns: true, glow: "#8fd3ff" },
    boss: { title: "Jarnhild the Frost Giant", phases: [0.5], posture: 260, music: "miniboss" },
  },
  {
    key: "hrimthar",
    name: "Hrimthar, the Winter King",
    behavior: "boss",
    hp: 4700,
    poise: 999,
    flinches: false,
    armor: 0.3,
    speed: 126,
    radius: 22,
    aggroRange: 520,
    leashRange: 2400,
    preferred: [70, 120],
    minions: ["icewraith", "rimeguard"],
    attacks: [
      // Phase 1 — the King's blade.
      atk({ name: "Kingsblade", anim: "bigSlashR", windup: 30, active: 6, recovery: 12, damage: 34, knockback: 170, lunge: 30, shape: arc(110, 160), parryable: true, range: 120, cooldown: 55, chain: 1, weight: 3 }),
      atk({ name: "Returning Edge", anim: "bigSlashL", windup: 18, active: 6, recovery: 30, damage: 30, knockback: 190, lunge: 20, shape: arc(105, 150), parryable: true, range: 110, cooldown: 55, weight: 0 }),
      atk({ name: "Frost Thrust", anim: "thrust", windup: 22, active: 6, recovery: 30, damage: 32, knockback: 200, lunge: 60, shape: { kind: "line", length: 150, width: 34 }, parryable: true, range: 160, cooldown: 90 }),
      atk({ name: "Glacial Stomp", anim: "overhead", windup: 44, active: 6, recovery: 34, damage: 36, knockback: 250, shape: circle(120), parryable: false, heavy: true, ground: true, range: 130, cooldown: 170 }),
      // Phase 2 — the storm of winter.
      atk({ name: "Blizzard", anim: "roar", windup: 64, active: 6, recovery: 30, damage: 30, knockback: 170, shape: circle(58), parryable: false, ground: true, range: 480, cooldown: 300, special: "sigils", phase: 1 }),
      atk({ name: "Frozen Leap", anim: "leap", windup: 46, active: 8, recovery: 40, damage: 38, knockback: 260, lunge: 280, shape: circle(96), parryable: false, heavy: true, ground: true, range: 320, minRange: 120, cooldown: 260, phase: 1 }),
      atk({ name: "Ice Spikes", anim: "spin", windup: 40, active: 22, recovery: 40, damage: 16, knockback: 110, parryable: false, range: 440, cooldown: 340, special: "bladestorm", phase: 1, projectile: { count: 18, spread: Math.PI * 2, speed: 230, range: 480, radius: 10 } }),
      // Phase 3 — Absolute Cold. Run from it; the wraiths come to keep you close.
      atk({ name: "Winter's Wrath", anim: "spin", windup: 46, active: 30, recovery: 40, damage: 18, knockback: 130, parryable: false, range: 460, cooldown: 300, special: "bladestorm", phase: 2, projectile: { count: 26, spread: Math.PI * 2, speed: 240, range: 520, radius: 10 } }),
      atk({ name: "Absolute Cold", anim: "roar", windup: 84, active: 8, recovery: 50, damage: 52, knockback: 300, shape: circle(180), parryable: false, heavy: true, ground: true, range: 210, cooldown: 420, phase: 2 }),
      atk({ name: "Call the Wraiths", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 480, cooldown: 900, special: "summon", phase: 2 }),
    ],
    xp: 4800,
    loot: "hrimthar",
    look: { rig: "humanoid", scale: 3, skin: "#a8bccf", cloth: "#1e3a5a", trim: "#eaf6ff", weapon: "greatsword", horns: true, glow: "#bfe6ff" },
    boss: { title: "Hrimthar, the Winter King", phases: [0.66, 0.33], posture: 360, music: "boss" },
  },
];

// ---------------------------------------------------------------------------
// Items

const FLOOR4_ITEMS: ItemBase[] = [
  { key: "mat_rimeshard", name: "Rime Shard", kind: "material", stack: 20, value: 14, tier: 5, desc: "Ice that never melts, cut from the Frostvale's oldest glaciers." },
  { key: "mat_frostpelt", name: "Frost Pelt", kind: "material", stack: 20, value: 18, tier: 5, desc: "A pelt so thick that cold simply gives up on it." },
  { key: "mat_glacialheart", name: "Glacial Heart", kind: "material", stack: 20, value: 44, tier: 6, desc: "Blue ice that beats, faintly. The frost golems are built around them." },
  { key: "key_glacier", name: "Rime Seal", kind: "key", value: 0, tier: 5, bound: true, desc: "Glacierfang wore this seal frozen into its crest. It opens the Glacier Throne." },
  { key: "art_wintercrown", name: "Crown of Hrimthar", kind: "artifact", value: 0, tier: 6, bound: true, desc: "Ice shaped into a crown, cold enough to burn. Above it, the tower keeps climbing." },
  { key: "map_floor4", name: "Map of the Frostvale", kind: "key", value: 0, tier: 5, bound: true, desc: "A chart of Floor 4 on sealskin. Buying it lets you open the map (M) up here." },
  // The Frostforged set (tier 6). Rimeholt's forge upgrades it with Floor 4 materials.
  { key: "sword_rime", name: "Rimeblade", kind: "weapon", weapon: "sword", art: "sword_rime", power: 206, value: 1000, tier: 6, desc: "Blue steel quenched in glacier water. The edge frosts over in the air." },
  { key: "greatsword_rime", name: "Glacier Maul-Blade", kind: "weapon", weapon: "greatsword", art: "gs_rime", power: 220, value: 1080, tier: 6, desc: "A slab of frozen steel with the weight of an avalanche behind it." },
  { key: "daggers_rime", name: "Icicle Fangs", kind: "weapon", weapon: "daggers", art: "dg_rime", power: 202, value: 980, tier: 6, desc: "Two long icicles set in silver. They never quite finish melting." },
  { key: "spear_rime", name: "Frostspire Pike", kind: "weapon", weapon: "spear", art: "sp_rime", power: 210, value: 1030, tier: 6, desc: "A pike tipped with a spire of blue ice, as sharp as the wind up here." },
  { key: "staff_rime", name: "Winterheart Staff", kind: "weapon", weapon: "staff", art: "st_rime", power: 206, value: 1030, tier: 6, desc: "A glacial heart caged in white birch. Your breath fogs near it." },
  { key: "armor_rime", name: "Rimeforged Plate", kind: "armor", defense: 72, hp: 46, stamina: -6, look: 25, value: 1180, tier: 6, desc: "Steel plate grown over with blue ice. Blows skid off it." },
  { key: "armor_furmantle", name: "Frostpelt Mantle", kind: "armor", defense: 52, hp: 28, stamina: 14, look: 26, value: 1080, tier: 6, desc: "White furs over hardened leather. Warm, quiet, fast." },
  { key: "armor_frostweave", name: "Frostweave Robes", kind: "armor", defense: 34, hp: 62, stamina: 16, look: 27, value: 1060, tier: 6, desc: "Pale silk woven with threads of rime. Snow never settles on it." },
  { key: "helm_rimecrown", name: "Rime Crown", kind: "helm", defense: 30, hp: 28, look: 18, value: 840, tier: 6, desc: "A helm of blue steel crowned with icicles." },
  { key: "helm_furhood", name: "Frostpelt Hood", kind: "helm", defense: 18, hp: 42, stamina: 10, look: 19, value: 860, tier: 6, desc: "A hood of white fur with a wolf's head for a crown." },
  // The Winter King's legendaries.
  { key: "greatsword_hrimthar", name: "Winterbane", kind: "weapon", weapon: "greatsword", art: "gs_rime", power: 244, rarity: 4, value: 3200, tier: 6, desc: "Hrimthar's own blade. The snow falls away from it." },
  { key: "armor_hrimthar", name: "Mantle of the Winter King", kind: "armor", defense: 82, hp: 72, stamina: -4, look: 25, rarity: 4, value: 3400, tier: 6, desc: "White steel and a king's cloak of snow. The cold bows to you." },
];

/** Floor 4's own gear: the Frostforged set. */
const FROST_GEAR = ["sword_rime", "greatsword_rime", "daggers_rime", "spear_rime", "staff_rime", "armor_rime", "armor_furmantle", "armor_frostweave", "helm_rimecrown", "helm_furhood"];

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  for (const d of FLOOR4_ENEMIES) if (!ENEMIES.some((e) => e.key === d.key)) ENEMIES.push(d);
  for (const it of FLOOR4_ITEMS) if (!ITEMS.some((i) => i.key === it.key)) ITEMS.push(it);
  const FROST = FROST_GEAR.map((key) => ({ key, w: 1 }));
  const DRAGON = DRAGON_GEAR.map((key) => ({ key, w: 1 }));
  const tonic = [{ key: "tonic", w: 1 }];
  const shard = [{ key: "mat_rimeshard", w: 1 }];
  const pelt = [{ key: "mat_frostpelt", w: 1 }];
  Object.assign(LOOT, {
    f4beast: { gold: [6, 12], rolls: [{ chance: 0.45, pool: pelt }, { chance: 0.08, pool: tonic }, { chance: 0.03, pool: DRAGON }, { chance: 0.01, pool: FROST }] },
    f4caster: { gold: [12, 22], rolls: [{ chance: 0.45, pool: shard }, { chance: 0.1, pool: tonic }, { chance: 0.04, pool: DRAGON, boost: 0.2 }, { chance: 0.015, pool: FROST }] },
    f4soldier: { gold: [14, 24], rolls: [{ chance: 0.4, pool: shard }, { chance: 0.12, pool: tonic }, { chance: 0.05, pool: DRAGON }, { chance: 0.018, pool: FROST }] },
    f4construct: { gold: [22, 38], rolls: [{ chance: 0.9, pool: shard, qty: [1, 2] }, { chance: 0.05, pool: [{ key: "mat_glacialheart", w: 1 }] }, { chance: 0.08, pool: DRAGON, boost: 0.3 }, { chance: 0.03, pool: FROST, boost: 0.2 }] },
    f4drake: { gold: [20, 32], rolls: [{ chance: 0.6, pool: pelt, qty: [1, 2] }, { chance: 0.3, pool: shard }, { chance: 0.06, pool: [{ key: "mat_glacialheart", w: 1 }] }, { chance: 0.04, pool: FROST, boost: 0.2 }] },
    glacierfang: {
      gold: [340, 460],
      guaranteed: [{ key: "key_glacier", once: true }],
      rolls: [
        { chance: 1, pool: FROST, boost: 0.6, minRarity: 1 },
        { chance: 1, pool: pelt, qty: [3, 5] },
        { chance: 0.5, pool: [{ key: "mat_glacialheart", w: 1 }] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    jarnhild: {
      gold: [400, 520],
      rolls: [
        { chance: 1, pool: FROST, boost: 0.8, minRarity: 1 },
        { chance: 1, pool: shard, qty: [3, 5] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    hrimthar: {
      gold: [1000, 1350],
      guaranteed: [{ key: "art_wintercrown", once: true }],
      rolls: [
        { chance: 1, pool: FROST, boost: 1.3, minRarity: 2 },
        { chance: 0.4, pool: FROST, boost: 0.8, minRarity: 1 },
        { chance: 0.015, pool: [{ key: "greatsword_hrimthar", w: 1 }] },
        { chance: 0.015, pool: [{ key: "armor_hrimthar", w: 1 }] },
        { chance: 1, pool: [{ key: "mat_glacialheart", w: 1 }], qty: [1, 2] },
        { chance: 1, pool: pelt, qty: [4, 6] },
      ],
    },
  });
  Object.assign(SHOPS, {
    store4: priceGear([
      { key: "map_floor4", price: 120 },
      { key: "tonic", price: 34 },
      { key: "armor_furmantle", price: 1080 },
      { key: "armor_frostweave", price: 1060 },
      { key: "armor_rime", price: 1180 },
      { key: "helm_rimecrown", price: 840 },
      { key: "helm_furhood", price: 860 },
    ]),
    smith4: priceGear([
      { key: "sword_rime", price: 1150 },
      { key: "greatsword_rime", price: 1240 },
      { key: "daggers_rime", price: 1130 },
      { key: "spear_rime", price: 1180 },
      { key: "staff_rime", price: 1180 },
    ]),
  });
}
register();

export { FLOOR4_ENEMIES, FROST_GEAR };
