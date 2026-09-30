/**
 * Floor 7 content — the Clockwork Heights: brass towers and steam, where the tower builds
 * itself. Enemies (clockhounds, cog soldiers, tinkerers, sentries, steam golems, brass
 * drakes, the Gearwyrm, Forgemaster Vulk and the Archon Engine), materials, the Brassbound
 * set, loot tables and shops.
 */
import type { Shape } from "../combat/shapes.ts";
import { ENEMIES, type EnemyAttack, type EnemyDef } from "../enemies/defs.ts";
import { ITEMS, type ItemBase } from "../items/items.ts";
import { LOOT, priceGear, SHOPS } from "../items/loot.ts";
import { TIDE_GEAR } from "./floor6.ts";

const deg = (d: number) => (d * Math.PI) / 180;
const atk = (a: Omit<EnemyAttack, "weight"> & { weight?: number }): EnemyAttack => ({ weight: 1, ...a });
const arc = (range: number, a: number): Shape => ({ kind: "arc", range, arc: deg(a) });
const circle = (radius: number, offset = 0): Shape => ({ kind: "circle", radius, offset });

// ---------------------------------------------------------------------------
// Enemies

const FLOOR7_ENEMIES: EnemyDef[] = [
  {
    key: "clockhound",
    name: "Clockhound",
    behavior: "pack",
    hp: 64,
    poise: 30,
    flinches: true,
    armor: 0.1,
    speed: 216,
    radius: 11,
    aggroRange: 230,
    leashRange: 580,
    preferred: [60, 100],
    attacks: [
      atk({ name: "Gear Bite", anim: "bite", windup: 17, active: 5, recovery: 24, damage: 19, knockback: 70, lunge: 34, shape: arc(30, 110), parryable: true, range: 50, cooldown: 44 }),
      atk({ name: "Spring Pounce", anim: "pounce", windup: 28, active: 8, recovery: 34, damage: 23, knockback: 130, lunge: 160, shape: arc(28, 120), parryable: true, range: 170, minRange: 70, cooldown: 140 }),
    ],
    xp: 32,
    loot: "f7beast",
    look: { rig: "wolf", scale: 1.15, skin: "#c9a24a", cloth: "#6a4a2a", trim: "#ffd070", weapon: "none", glow: "#ffb040" },
  },
  {
    key: "cogsoldier",
    name: "Cog Soldier",
    behavior: "defender",
    hp: 118,
    poise: 50,
    flinches: false,
    armor: 0.2,
    speed: 104,
    radius: 12,
    aggroRange: 220,
    leashRange: 560,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Piston Thrust", anim: "thrust", windup: 22, active: 6, recovery: 24, damage: 25, knockback: 140, lunge: 28, shape: { kind: "line", length: 72, width: 22 }, parryable: true, range: 78, cooldown: 60, weight: 2 }),
      atk({ name: "Shield Ram", anim: "thrust", windup: 20, active: 5, recovery: 24, damage: 16, knockback: 180, lunge: 34, shape: { kind: "line", length: 40, width: 26 }, parryable: true, range: 50, cooldown: 120 }),
      atk({ name: "Steam Stamp", anim: "overhead", windup: 40, active: 6, recovery: 32, damage: 31, knockback: 190, shape: circle(58, 24), parryable: false, heavy: true, ground: true, range: 76, cooldown: 220 }),
    ],
    xp: 58,
    loot: "f7soldier",
    look: { rig: "construct", scale: 1.1, skin: "#b8904a", cloth: "#5a4a3a", trim: "#ffd070", weapon: "spear", shield: true, glow: "#ffb040" },
  },
  {
    key: "tinkerer",
    name: "Mad Tinkerer",
    behavior: "caster",
    hp: 68,
    poise: 22,
    flinches: true,
    armor: 0,
    speed: 120,
    radius: 10,
    aggroRange: 270,
    leashRange: 620,
    preferred: [150, 220],
    attacks: [
      atk({ name: "Spark Bolt", anim: "cast", windup: 22, active: 1, recovery: 26, damage: 21, knockback: 90, parryable: true, range: 340, minRange: 70, cooldown: 72, projectile: { count: 1, spread: 0, speed: 380, range: 360, radius: 8 }, weight: 2 }),
      atk({ name: "Bomb Toss", anim: "throw", windup: 40, active: 6, recovery: 28, damage: 30, knockback: 170, shape: circle(52), parryable: false, heavy: true, ground: true, targeted: true, range: 320, cooldown: 180 }),
      atk({ name: "Jetpack Hop", anim: "cast", windup: 12, active: 2, recovery: 14, damage: 0, knockback: 0, parryable: false, range: 90, cooldown: 300, special: "blink" }),
    ],
    xp: 46,
    loot: "f7caster",
    look: { rig: "humanoid", scale: 1, skin: "#e0b890", cloth: "#5a3a2a", trim: "#ffd070", weapon: "staff", hood: false, glow: "#ffb040" },
  },
  {
    key: "sentry",
    name: "Sentry Automaton",
    behavior: "ranged",
    hp: 80,
    poise: 40,
    flinches: false,
    armor: 0.2,
    speed: 86,
    radius: 12,
    aggroRange: 300,
    leashRange: 600,
    preferred: [180, 260],
    attacks: [
      atk({ name: "Rivet Volley", anim: "cast", windup: 26, active: 2, recovery: 26, damage: 16, knockback: 70, parryable: true, range: 380, minRange: 60, cooldown: 90, projectile: { count: 3, spread: 0.3, speed: 440, range: 400, radius: 7 }, weight: 2 }),
      atk({ name: "Scatter Shot", anim: "cast", windup: 36, active: 2, recovery: 30, damage: 14, knockback: 90, parryable: false, range: 300, cooldown: 200, projectile: { count: 7, spread: 1.2, speed: 380, range: 320, radius: 7 } }),
    ],
    xp: 50,
    loot: "f7construct",
    look: { rig: "construct", scale: 1.25, skin: "#8a8a7a", cloth: "#3a3a3a", trim: "#ff7a3a", weapon: "none", glow: "#ff7a3a" },
  },
  {
    key: "steamgolem",
    name: "Steam Golem",
    behavior: "brute",
    hp: 124,
    poise: 96,
    flinches: false,
    armor: 0.25,
    speed: 84,
    radius: 16,
    aggroRange: 200,
    leashRange: 520,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Hammer Fist", anim: "overhead", windup: 40, active: 6, recovery: 36, damage: 39, knockback: 230, shape: circle(62, 30), parryable: false, heavy: true, ground: true, range: 80, cooldown: 120, weight: 2 }),
      atk({ name: "Piston Sweep", anim: "sweep", windup: 32, active: 8, recovery: 32, damage: 30, knockback: 190, shape: { kind: "arc", range: 72, arc: deg(200), inner: 16 }, parryable: true, range: 68, cooldown: 90 }),
      atk({ name: "Vent Steam", anim: "roar", windup: 40, active: 4, recovery: 40, damage: 18, knockback: 100, parryable: false, range: 200, cooldown: 240, special: "bladestorm", projectile: { count: 10, spread: Math.PI * 2, speed: 250, range: 240, radius: 9 } }),
    ],
    xp: 86,
    loot: "f7construct",
    look: { rig: "construct", scale: 1.8, skin: "#a07a3a", cloth: "#4a3a2a", trim: "#ffd070", weapon: "hammer", glow: "#ffe0a0" },
  },
  {
    key: "brassdrake",
    name: "Brass Drake",
    behavior: "melee",
    hp: 128,
    poise: 56,
    flinches: false,
    armor: 0.15,
    speed: 158,
    radius: 16,
    aggroRange: 260,
    leashRange: 620,
    preferred: [50, 90],
    attacks: [
      atk({ name: "Clockwork Bite", anim: "bite", windup: 22, active: 6, recovery: 26, damage: 25, knockback: 110, lunge: 24, shape: arc(40, 100), parryable: true, range: 60, cooldown: 60, weight: 2 }),
      atk({ name: "Tail Hammer", anim: "tail", windup: 26, active: 8, recovery: 28, damage: 21, knockback: 160, shape: circle(50), parryable: true, range: 56, cooldown: 110 }),
      atk({ name: "Scald", anim: "breath", windup: 28, active: 2, recovery: 28, damage: 16, knockback: 70, parryable: true, range: 300, minRange: 80, cooldown: 160, projectile: { count: 3, spread: 0.35, speed: 310, range: 320, radius: 9 } }),
      atk({ name: "Gear Dive", anim: "dive", windup: 34, active: 8, recovery: 34, damage: 29, knockback: 190, lunge: 150, shape: { kind: "line", length: 50, width: 34 }, parryable: false, heavy: true, ground: true, range: 200, minRange: 90, cooldown: 220 }),
    ],
    xp: 78,
    loot: "f7drake",
    look: { rig: "dragon", scale: 1.25, skin: "#c9a24a", cloth: "#5a4020", trim: "#ffe0a0", weapon: "none", horns: true, glow: "#ffb040", element: "steam" },
  },
  // --- The wyrm of the Sky Rails: its heart is the key to the Engine. ------------------------
  {
    key: "gearwyrm",
    name: "The Gearwyrm",
    behavior: "boss",
    hp: 1580,
    poise: 999,
    flinches: false,
    armor: 0.24,
    speed: 128,
    radius: 30,
    aggroRange: 380,
    leashRange: 1400,
    preferred: [70, 130],
    minions: ["brassdrake", "clockhound"],
    attacks: [
      atk({ name: "Grinding Bite", anim: "bite", windup: 26, active: 6, recovery: 24, damage: 33, knockback: 150, lunge: 30, shape: arc(70, 110), parryable: true, range: 90, cooldown: 60, weight: 3 }),
      atk({ name: "Chain Tail", anim: "tail", windup: 34, active: 8, recovery: 30, damage: 31, knockback: 210, shape: circle(96), parryable: false, heavy: true, ground: true, range: 110, cooldown: 150 }),
      atk({ name: "Steam Breath", anim: "breath", windup: 44, active: 26, recovery: 34, damage: 36, knockback: 170, shape: arc(210, 55), parryable: false, heavy: true, ground: true, range: 230, cooldown: 220, weight: 2 }),
      atk({ name: "Bellows", anim: "wing", windup: 30, active: 6, recovery: 30, damage: 15, knockback: 300, shape: circle(120), parryable: false, ground: true, range: 140, cooldown: 260 }),
      atk({ name: "Rail Dive", anim: "dive", windup: 50, active: 10, recovery: 40, damage: 41, knockback: 240, lunge: 260, shape: { kind: "line", length: 70, width: 60 }, parryable: false, heavy: true, ground: true, range: 360, minRange: 120, cooldown: 300 }),
      atk({ name: "Rivet Rain", anim: "roar", windup: 60, active: 6, recovery: 30, damage: 31, knockback: 160, shape: circle(48), parryable: false, ground: true, range: 380, cooldown: 320, special: "sigils", phase: 1 }),
      atk({ name: "Rebuild", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 380, cooldown: 900, special: "summon", phase: 1 }),
    ],
    xp: 4200,
    loot: "gearwyrm",
    look: { rig: "dragon", scale: 2.5, skin: "#a07a3a", cloth: "#3a2a1a", trim: "#ffe0a0", weapon: "none", horns: true, glow: "#ffb040", element: "steam" },
    boss: { title: "The Gearwyrm", phases: [0.5], posture: 320, music: "miniboss" },
  },
  // --- The Great Engine ---------------------------------------------------------------------
  {
    key: "vulk",
    name: "Forgemaster Vulk",
    behavior: "boss",
    hp: 2120,
    poise: 999,
    flinches: false,
    armor: 0.28,
    speed: 132,
    radius: 18,
    aggroRange: 420,
    leashRange: 1600,
    preferred: [50, 90],
    minions: ["cogsoldier", "tinkerer"],
    attacks: [
      atk({ name: "Forge Hammer", anim: "overhead", windup: 30, active: 6, recovery: 14, damage: 37, knockback: 190, lunge: 20, shape: circle(70, 40), parryable: true, heavy: true, range: 96, cooldown: 60, chain: 1, weight: 3 }),
      atk({ name: "Backswing", anim: "bigSlashL", windup: 14, active: 6, recovery: 30, damage: 30, knockback: 180, lunge: 16, shape: arc(84, 160), parryable: true, range: 90, cooldown: 55, weight: 0 }),
      atk({ name: "Anvil Charge", anim: "thrust", windup: 26, active: 10, recovery: 32, damage: 37, knockback: 230, lunge: 220, shape: { kind: "line", length: 50, width: 42 }, parryable: false, heavy: true, ground: true, range: 260, minRange: 100, cooldown: 200 }),
      atk({ name: "Molten Pour", anim: "channel", windup: 60, active: 6, recovery: 30, damage: 29, knockback: 160, shape: circle(52), parryable: false, ground: true, range: 400, cooldown: 300, special: "sigils", phase: 1 }),
      atk({ name: "Shrapnel", anim: "spin", windup: 44, active: 24, recovery: 40, damage: 18, knockback: 100, parryable: false, range: 360, cooldown: 380, special: "bladestorm", phase: 1, projectile: { count: 14, spread: Math.PI * 2, speed: 235, range: 400, radius: 10 } }),
    ],
    xp: 3800,
    loot: "vulk",
    look: { rig: "humanoid", scale: 2.2, skin: "#c98f65", cloth: "#4a2a1a", trim: "#ffd070", weapon: "hammer", horns: false, glow: "#ff7a3a" },
    boss: { title: "Forgemaster Vulk", phases: [0.5], posture: 290, music: "miniboss" },
  },
  {
    key: "archon",
    name: "The Archon Engine",
    behavior: "boss",
    hp: 6200,
    poise: 999,
    flinches: false,
    armor: 0.32,
    speed: 112,
    radius: 30,
    aggroRange: 540,
    leashRange: 2400,
    preferred: [90, 170],
    minions: ["sentry", "clockhound"],
    attacks: [
      // Phase 1 — the Engine wakes: pistons and rivets.
      atk({ name: "Piston Fist", anim: "overhead", windup: 30, active: 6, recovery: 24, damage: 40, knockback: 210, lunge: 26, shape: circle(84, 60), parryable: true, heavy: true, range: 130, cooldown: 70, weight: 3 }),
      atk({ name: "Gear Sweep", anim: "sweep", windup: 34, active: 8, recovery: 30, damage: 35, knockback: 230, shape: { kind: "arc", range: 140, arc: deg(220), inner: 30 }, parryable: false, heavy: true, ground: true, range: 140, cooldown: 150 }),
      atk({ name: "Rivet Barrage", anim: "cast", windup: 28, active: 2, recovery: 28, damage: 26, knockback: 110, parryable: true, range: 460, minRange: 100, cooldown: 90, projectile: { count: 5, spread: 0.5, speed: 420, range: 480, radius: 9 }, weight: 2 }),
      // Phase 2 — the furnace opens.
      atk({ name: "Furnace Vent", anim: "roar", windup: 44, active: 26, recovery: 40, damage: 20, knockback: 110, parryable: false, range: 460, cooldown: 320, special: "bladestorm", phase: 1, projectile: { count: 24, spread: Math.PI * 2, speed: 240, range: 500, radius: 10 } }),
      atk({ name: "Hammerfall", anim: "roar", windup: 58, active: 6, recovery: 30, damage: 34, knockback: 180, shape: circle(58), parryable: false, ground: true, range: 500, cooldown: 280, special: "sigils", phase: 1 }),
      atk({ name: "Steam Lance", anim: "channel", windup: 50, active: 20, recovery: 36, damage: 38, knockback: 210, shape: { kind: "line", length: 440, width: 46 }, parryable: false, heavy: true, ground: true, range: 460, cooldown: 280, phase: 1 }),
      // Phase 3 — Overload: the Engine tears itself apart, and takes the room with it.
      atk({ name: "Overload", anim: "roar", windup: 150, active: 6, recovery: 80, damage: 420, knockback: 320, parryable: false, heavy: true, range: 1000, cooldown: 1300, special: "judgement", phase: 2 }),
      atk({ name: "Grinding Gears", anim: "spin", windup: 40, active: 30, recovery: 40, damage: 22, knockback: 140, parryable: false, range: 460, cooldown: 300, special: "bladestorm", phase: 2, projectile: { count: 30, spread: Math.PI * 2, speed: 250, range: 520, radius: 10 } }),
      atk({ name: "Summon Repairs", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 500, cooldown: 900, special: "summon", phase: 2 }),
    ],
    xp: 7200,
    loot: "archon",
    look: { rig: "construct", scale: 3.2, skin: "#b8904a", cloth: "#3a2a1a", trim: "#ffe0a0", weapon: "hammer", horns: true, glow: "#ff9a3a" },
    boss: { title: "The Archon Engine", phases: [0.66, 0.33], posture: 420, music: "boss" },
  },
];

// ---------------------------------------------------------------------------
// Items

const FLOOR7_ITEMS: ItemBase[] = [
  { key: "mat_brassgear", name: "Brass Gear", kind: "material", stack: 20, value: 20, tier: 8, desc: "A gear cut so fine its teeth ring when you flick them." },
  { key: "mat_spring", name: "Mainspring", kind: "material", stack: 20, value: 24, tier: 8, desc: "A coiled spring of blue steel, still wound. Don't let it go." },
  { key: "mat_aethercore", name: "Aether Core", kind: "material", stack: 20, value: 60, tier: 9, desc: "A glass sphere with a spark inside that never goes out. The golems run on them." },
  { key: "key_engine", name: "The Master Cog", kind: "key", value: 0, tier: 8, bound: true, desc: "The Gearwyrm's heart: a cog as big as a shield, still turning. It fits the Great Engine's door." },
  { key: "art_archoncore", name: "Heart of the Archon", kind: "artifact", value: 0, tier: 9, bound: true, desc: "The Archon Engine's core, cooling in your hands. The last thing it built was a stair." },
  { key: "map_floor7", name: "Map of the Clockwork Heights", kind: "key", value: 0, tier: 8, bound: true, desc: "A blueprint of Floor 7, all of it measured to the inch. Buying it lets you open the map (M) up here." },
  { key: "charm_cog", name: "Tinker's Cog", kind: "charm", stamina: 16, hp: 24, value: 1300, tier: 8, rarity: 3, effect: "tinkercog", desc: "A cog that turns on its own. One blow in six sunders the armour of what it strikes." },
  // The Brassbound set (tier 9). The Gearworks upgrades it with Floor 7 materials.
  { key: "sword_brass", name: "Clockwork Saber", kind: "weapon", weapon: "sword", art: "sword_brass", power: 278, value: 1900, tier: 9, desc: "A brass saber with a ticking hilt. Every cut is exactly as long as the last." },
  { key: "greatsword_brass", name: "Piston Blade", kind: "weapon", weapon: "greatsword", art: "gs_brass", power: 298, value: 2040, tier: 9, desc: "A greatsword with a steam piston in the spine that drives every swing." },
  { key: "daggers_brass", name: "Spring Knives", kind: "weapon", weapon: "daggers", art: "dg_brass", power: 272, value: 1870, tier: 9, desc: "Two knives that snap out of their guards on springs." },
  { key: "spear_brass", name: "Rail Lance", kind: "weapon", weapon: "spear", art: "sp_brass", power: 284, value: 1960, tier: 9, desc: "A lance on a brass rail. It pushes itself a little further than you do." },
  { key: "staff_brass", name: "Aether Rod", kind: "weapon", weapon: "staff", art: "st_brass", power: 278, value: 1960, tier: 9, desc: "A rod of copper coils around an aether core. It hums in your hand." },
  { key: "armor_brass", name: "Brassbound Plate", kind: "armor", defense: 100, hp: 64, stamina: -6, look: 34, value: 2180, tier: 9, desc: "Plate riveted together with brass. Every joint is a tiny machine." },
  { key: "armor_tinker", name: "Tinker's Coat", kind: "armor", defense: 74, hp: 40, stamina: 20, look: 35, value: 2020, tier: 9, desc: "A leather coat with a hundred pockets, most of them full of tools." },
  { key: "armor_aether", name: "Aetherweave Robes", kind: "armor", defense: 50, hp: 86, stamina: 22, look: 36, value: 2000, tier: 9, desc: "Robes threaded with copper wire. Sparks crawl along the hem." },
  { key: "helm_brass", name: "Brass Visor", kind: "helm", defense: 42, hp: 40, look: 24, value: 1560, tier: 9, desc: "A brass helm with a slotted visor and a little gauge over the brow." },
  { key: "helm_goggles", name: "Tinker's Goggles", kind: "helm", defense: 26, hp: 60, stamina: 14, look: 25, value: 1580, tier: 9, desc: "A leather cap and a pair of brass goggles with far too many lenses." },
  // The Archon's legendaries.
  { key: "greatsword_archon", name: "Engine Breaker", kind: "weapon", weapon: "greatsword", art: "gs_brass", power: 330, rarity: 4, value: 5600, tier: 9, desc: "A blade made from one of the Archon's own pistons. It still drives itself." },
  { key: "armor_archon", name: "Archon Shell", kind: "armor", defense: 112, hp: 96, stamina: 8, look: 34, rarity: 4, value: 5800, tier: 9, desc: "The Archon Engine's casing, beaten into armour. It keeps perfect time." },
];

/** Floor 7's own gear: the Brassbound set. */
const BRASS_GEAR = ["sword_brass", "greatsword_brass", "daggers_brass", "spear_brass", "staff_brass", "armor_brass", "armor_tinker", "armor_aether", "helm_brass", "helm_goggles"];

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  for (const d of FLOOR7_ENEMIES) if (!ENEMIES.some((e) => e.key === d.key)) ENEMIES.push(d);
  for (const it of FLOOR7_ITEMS) if (!ITEMS.some((i) => i.key === it.key)) ITEMS.push(it);
  const BRASS = BRASS_GEAR.map((key) => ({ key, w: 1 }));
  const TIDE = TIDE_GEAR.map((key) => ({ key, w: 1 }));
  const tonic = [{ key: "tonic", w: 1 }];
  const gear = [{ key: "mat_brassgear", w: 1 }];
  const spring = [{ key: "mat_spring", w: 1 }];
  Object.assign(LOOT, {
    f7beast: { gold: [9, 16], rolls: [{ chance: 0.45, pool: spring }, { chance: 0.08, pool: tonic }, { chance: 0.03, pool: TIDE }, { chance: 0.01, pool: BRASS }] },
    f7caster: { gold: [16, 28], rolls: [{ chance: 0.45, pool: spring }, { chance: 0.1, pool: tonic }, { chance: 0.04, pool: TIDE, boost: 0.2 }, { chance: 0.015, pool: BRASS }] },
    f7soldier: { gold: [18, 30], rolls: [{ chance: 0.4, pool: gear }, { chance: 0.12, pool: tonic }, { chance: 0.05, pool: TIDE }, { chance: 0.018, pool: BRASS }] },
    f7construct: { gold: [28, 44], rolls: [{ chance: 0.9, pool: gear, qty: [1, 2] }, { chance: 0.05, pool: [{ key: "mat_aethercore", w: 1 }] }, { chance: 0.08, pool: TIDE, boost: 0.3 }, { chance: 0.03, pool: BRASS, boost: 0.2 }] },
    f7drake: { gold: [26, 38], rolls: [{ chance: 0.6, pool: spring, qty: [1, 2] }, { chance: 0.3, pool: gear }, { chance: 0.06, pool: [{ key: "mat_aethercore", w: 1 }] }, { chance: 0.04, pool: BRASS, boost: 0.2 }] },
    gearwyrm: {
      gold: [460, 580],
      guaranteed: [{ key: "key_engine", once: true }],
      rolls: [
        { chance: 1, pool: BRASS, boost: 0.6, minRarity: 1 },
        { chance: 1, pool: spring, qty: [3, 5] },
        { chance: 0.5, pool: [{ key: "mat_aethercore", w: 1 }] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    vulk: {
      gold: [520, 640],
      rolls: [
        { chance: 1, pool: BRASS, boost: 0.8, minRarity: 1 },
        { chance: 1, pool: gear, qty: [3, 5] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    archon: {
      gold: [1300, 1800],
      guaranteed: [{ key: "art_archoncore", once: true }],
      rolls: [
        { chance: 1, pool: BRASS, boost: 1.3, minRarity: 2 },
        { chance: 0.4, pool: BRASS, boost: 0.8, minRarity: 1 },
        { chance: 0.015, pool: [{ key: "greatsword_archon", w: 1 }] },
        { chance: 0.015, pool: [{ key: "armor_archon", w: 1 }] },
        { chance: 1, pool: [{ key: "mat_aethercore", w: 1 }], qty: [1, 2] },
        { chance: 1, pool: spring, qty: [4, 6] },
      ],
    },
  });
  Object.assign(SHOPS, {
    store7: priceGear([
      { key: "map_floor7", price: 210 },
      { key: "tonic", price: 58 },
      { key: "armor_tinker", price: 2020 },
      { key: "armor_aether", price: 2000 },
      { key: "armor_brass", price: 2180 },
      { key: "helm_brass", price: 1560 },
      { key: "helm_goggles", price: 1580 },
    ]),
    smith7: priceGear([
      { key: "sword_brass", price: 2120 },
      { key: "greatsword_brass", price: 2280 },
      { key: "daggers_brass", price: 2090 },
      { key: "spear_brass", price: 2190 },
      { key: "staff_brass", price: 2190 },
    ]),
  });
}
register();

export { FLOOR7_ENEMIES, BRASS_GEAR };
