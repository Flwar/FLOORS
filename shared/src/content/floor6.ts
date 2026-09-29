/**
 * Floor 6 content — the Drowned Isles: a drowned archipelago where the sea climbs the
 * tower. Enemies (brinehounds, merrow guards, sirens, drowned sailors, coral golems, sea
 * drakes, Scylla the Deep Serpent, Captain Blackbrine and Thalassa, the Leviathan Queen),
 * materials, the Tidecaller set, loot tables and shops.
 */
import type { Shape } from "../combat/shapes.ts";
import { ENEMIES, type EnemyAttack, type EnemyDef } from "../enemies/defs.ts";
import { ITEMS, type ItemBase } from "../items/items.ts";
import { LOOT, priceGear, SHOPS } from "../items/loot.ts";
import { VOID_GEAR } from "./floor5.ts";

const deg = (d: number) => (d * Math.PI) / 180;
const atk = (a: Omit<EnemyAttack, "weight"> & { weight?: number }): EnemyAttack => ({ weight: 1, ...a });
const arc = (range: number, a: number): Shape => ({ kind: "arc", range, arc: deg(a) });
const circle = (radius: number, offset = 0): Shape => ({ kind: "circle", radius, offset });

// ---------------------------------------------------------------------------
// Enemies

const FLOOR6_ENEMIES: EnemyDef[] = [
  {
    key: "brinehound",
    name: "Brinehound",
    behavior: "pack",
    hp: 60,
    poise: 28,
    flinches: true,
    armor: 0,
    speed: 212,
    radius: 11,
    aggroRange: 230,
    leashRange: 580,
    preferred: [60, 100],
    attacks: [
      atk({ name: "Brine Bite", anim: "bite", windup: 17, active: 5, recovery: 24, damage: 17, knockback: 70, lunge: 34, shape: arc(30, 110), parryable: true, range: 50, cooldown: 44 }),
      atk({ name: "Surf Pounce", anim: "pounce", windup: 30, active: 8, recovery: 34, damage: 21, knockback: 130, lunge: 150, shape: arc(28, 120), parryable: true, range: 160, minRange: 70, cooldown: 140 }),
    ],
    xp: 30,
    loot: "f6beast",
    look: { rig: "wolf", scale: 1.15, skin: "#3a7a86", cloth: "#1e4a56", trim: "#8ff0e0", weapon: "none", glow: "#8ff0e0" },
  },
  {
    key: "merrowguard",
    name: "Merrow Guard",
    behavior: "defender",
    hp: 110,
    poise: 46,
    flinches: false,
    armor: 0.15,
    speed: 108,
    radius: 12,
    aggroRange: 220,
    leashRange: 560,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Trident Thrust", anim: "thrust", windup: 22, active: 6, recovery: 24, damage: 23, knockback: 130, lunge: 26, shape: { kind: "line", length: 70, width: 22 }, parryable: true, range: 76, cooldown: 60, weight: 2 }),
      atk({ name: "Shell Bash", anim: "thrust", windup: 20, active: 5, recovery: 24, damage: 15, knockback: 170, lunge: 30, shape: { kind: "line", length: 40, width: 26 }, parryable: true, range: 50, cooldown: 120 }),
      atk({ name: "Undertow", anim: "overhead", windup: 40, active: 6, recovery: 32, damage: 29, knockback: 190, shape: circle(58, 24), parryable: false, heavy: true, ground: true, range: 76, cooldown: 220 }),
    ],
    xp: 54,
    loot: "f6soldier",
    look: { rig: "humanoid", scale: 1.12, skin: "#5aa89a", cloth: "#1e4a56", trim: "#f0d890", weapon: "spear", shield: true, horns: true, glow: "#8ff0e0" },
  },
  {
    key: "siren",
    name: "Siren",
    behavior: "caster",
    hp: 64,
    poise: 22,
    flinches: true,
    armor: 0,
    speed: 118,
    radius: 10,
    aggroRange: 270,
    leashRange: 620,
    preferred: [150, 220],
    attacks: [
      atk({ name: "Sea Bolt", anim: "cast", windup: 24, active: 1, recovery: 26, damage: 19, knockback: 90, parryable: true, range: 340, minRange: 70, cooldown: 76, projectile: { count: 1, spread: 0, speed: 350, range: 360, radius: 8 }, weight: 2 }),
      atk({ name: "Drowning Song", anim: "channel", windup: 46, active: 6, recovery: 28, damage: 26, knockback: 140, shape: circle(50), parryable: false, ground: true, targeted: true, range: 330, cooldown: 190 }),
      atk({ name: "Slip Away", anim: "cast", windup: 14, active: 2, recovery: 16, damage: 0, knockback: 0, parryable: false, range: 90, cooldown: 300, special: "blink" }),
    ],
    xp: 44,
    loot: "f6caster",
    look: { rig: "humanoid", scale: 1, skin: "#bfe8e0", cloth: "#2a6a7a", trim: "#f0d890", weapon: "staff", hood: true, glow: "#8ff0e0" },
  },
  {
    key: "drowned",
    name: "Drowned Sailor",
    behavior: "melee",
    hp: 76,
    poise: 30,
    flinches: true,
    armor: 0.05,
    speed: 138,
    radius: 10,
    aggroRange: 230,
    leashRange: 580,
    preferred: [40, 70],
    attacks: [
      atk({ name: "Cutlass", anim: "slashR", windup: 18, active: 5, recovery: 12, damage: 18, knockback: 80, lunge: 16, shape: arc(40, 130), parryable: true, range: 50, cooldown: 44, chain: 1, weight: 2 }),
      atk({ name: "Backhand", anim: "slashL", windup: 12, active: 5, recovery: 22, damage: 15, knockback: 90, lunge: 10, shape: arc(40, 130), parryable: true, range: 48, cooldown: 44, weight: 0 }),
      atk({ name: "Anchor Swing", anim: "overhead", windup: 34, active: 6, recovery: 30, damage: 27, knockback: 180, shape: circle(52, 22), parryable: false, heavy: true, ground: true, range: 66, cooldown: 200 }),
    ],
    xp: 36,
    loot: "f6soldier",
    look: { rig: "humanoid", scale: 1, skin: "#8ab0a0", cloth: "#3a4a4e", trim: "#c9a24a", weapon: "cleaver", hood: false, glow: "#8ff0e0" },
  },
  {
    key: "coralgolem",
    name: "Coral Golem",
    behavior: "brute",
    hp: 118,
    poise: 92,
    flinches: false,
    armor: 0.22,
    speed: 82,
    radius: 16,
    aggroRange: 200,
    leashRange: 520,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Reef Slam", anim: "overhead", windup: 42, active: 6, recovery: 36, damage: 37, knockback: 220, shape: circle(62, 30), parryable: false, heavy: true, ground: true, range: 80, cooldown: 120, weight: 2 }),
      atk({ name: "Coral Sweep", anim: "sweep", windup: 34, active: 8, recovery: 32, damage: 28, knockback: 180, shape: { kind: "arc", range: 70, arc: deg(200), inner: 16 }, parryable: true, range: 66, cooldown: 90 }),
      atk({ name: "Spine Burst", anim: "roar", windup: 40, active: 4, recovery: 40, damage: 17, knockback: 90, parryable: false, range: 200, cooldown: 240, special: "bladestorm", projectile: { count: 10, spread: Math.PI * 2, speed: 240, range: 240, radius: 8 } }),
    ],
    xp: 82,
    loot: "f6construct",
    look: { rig: "construct", scale: 1.75, skin: "#e07a6a", cloth: "#5a2a3a", trim: "#fff0d8", weapon: "hammer", glow: "#ffb0a0" },
  },
  {
    key: "seadrake",
    name: "Sea Drake",
    behavior: "melee",
    hp: 122,
    poise: 54,
    flinches: false,
    armor: 0.1,
    speed: 156,
    radius: 16,
    aggroRange: 260,
    leashRange: 620,
    preferred: [50, 90],
    attacks: [
      atk({ name: "Drake Bite", anim: "bite", windup: 22, active: 6, recovery: 26, damage: 23, knockback: 110, lunge: 24, shape: arc(40, 100), parryable: true, range: 60, cooldown: 60, weight: 2 }),
      atk({ name: "Tail Lash", anim: "tail", windup: 26, active: 8, recovery: 28, damage: 19, knockback: 150, shape: circle(50), parryable: true, range: 56, cooldown: 110 }),
      atk({ name: "Brine Spit", anim: "breath", windup: 28, active: 2, recovery: 28, damage: 15, knockback: 70, parryable: true, range: 300, minRange: 80, cooldown: 160, projectile: { count: 3, spread: 0.35, speed: 300, range: 320, radius: 9 } }),
      atk({ name: "Wave Dive", anim: "dive", windup: 34, active: 8, recovery: 34, damage: 27, knockback: 190, lunge: 150, shape: { kind: "line", length: 50, width: 34 }, parryable: false, heavy: true, ground: true, range: 200, minRange: 90, cooldown: 220 }),
    ],
    xp: 74,
    loot: "f6drake",
    look: { rig: "dragon", scale: 1.25, skin: "#2a8a9a", cloth: "#123a4a", trim: "#f0d890", weapon: "none", horns: true, glow: "#8ff0e0", element: "tide" },
  },
  // --- The serpent of the Stormbreak Cliffs: carries the key to the Cathedral. -----------------
  {
    key: "scylla",
    name: "Scylla, the Deep Serpent",
    behavior: "boss",
    hp: 1480,
    poise: 999,
    flinches: false,
    armor: 0.2,
    speed: 126,
    radius: 30,
    aggroRange: 380,
    leashRange: 1400,
    preferred: [70, 130],
    minions: ["seadrake", "brinehound"],
    attacks: [
      atk({ name: "Rending Bite", anim: "bite", windup: 26, active: 6, recovery: 24, damage: 31, knockback: 150, lunge: 30, shape: arc(70, 110), parryable: true, range: 90, cooldown: 60, weight: 3 }),
      atk({ name: "Coil Sweep", anim: "tail", windup: 34, active: 8, recovery: 30, damage: 29, knockback: 200, shape: circle(96), parryable: false, heavy: true, ground: true, range: 110, cooldown: 150 }),
      atk({ name: "Tidal Breath", anim: "breath", windup: 44, active: 26, recovery: 34, damage: 34, knockback: 170, shape: arc(210, 55), parryable: false, heavy: true, ground: true, range: 230, cooldown: 220, weight: 2 }),
      atk({ name: "Spray", anim: "wing", windup: 30, active: 6, recovery: 30, damage: 14, knockback: 300, shape: circle(120), parryable: false, ground: true, range: 140, cooldown: 260 }),
      atk({ name: "Breach", anim: "dive", windup: 50, active: 10, recovery: 40, damage: 39, knockback: 240, lunge: 260, shape: { kind: "line", length: 70, width: 60 }, parryable: false, heavy: true, ground: true, range: 360, minRange: 120, cooldown: 300 }),
      atk({ name: "Waterspouts", anim: "roar", windup: 60, active: 6, recovery: 30, damage: 29, knockback: 160, shape: circle(48), parryable: false, ground: true, range: 380, cooldown: 320, special: "sigils", phase: 1 }),
      atk({ name: "Call the Shoal", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 380, cooldown: 900, special: "summon", phase: 1 }),
    ],
    xp: 3700,
    loot: "scylla",
    look: { rig: "dragon", scale: 2.5, skin: "#1e6a7a", cloth: "#0e3a4a", trim: "#f0d890", weapon: "none", horns: true, glow: "#8ff0e0", element: "tide" },
    boss: { title: "Scylla, the Deep Serpent", phases: [0.5], posture: 310, music: "miniboss" },
  },
  // --- The Drowned Cathedral --------------------------------------------------------------------
  {
    key: "blackbrine",
    name: "Captain Blackbrine",
    behavior: "boss",
    hp: 1980,
    poise: 999,
    flinches: false,
    armor: 0.26,
    speed: 140,
    radius: 17,
    aggroRange: 420,
    leashRange: 1600,
    preferred: [50, 90],
    minions: ["drowned", "drowned"],
    attacks: [
      atk({ name: "Cutlass Flurry", anim: "bigSlashR", windup: 24, active: 6, recovery: 12, damage: 33, knockback: 150, lunge: 26, shape: arc(84, 160), parryable: true, range: 96, cooldown: 55, chain: 1, weight: 3 }),
      atk({ name: "Riposte", anim: "bigSlashL", windup: 14, active: 6, recovery: 30, damage: 29, knockback: 180, lunge: 16, shape: arc(80, 150), parryable: true, range: 90, cooldown: 55, weight: 0 }),
      atk({ name: "Boarding Charge", anim: "thrust", windup: 26, active: 10, recovery: 32, damage: 35, knockback: 220, lunge: 220, shape: { kind: "line", length: 50, width: 40 }, parryable: false, heavy: true, ground: true, range: 260, minRange: 100, cooldown: 200 }),
      atk({ name: "Broadside", anim: "channel", windup: 60, active: 6, recovery: 30, damage: 27, knockback: 160, shape: circle(52), parryable: false, ground: true, range: 400, cooldown: 300, special: "sigils", phase: 1 }),
      atk({ name: "Grapeshot", anim: "spin", windup: 44, active: 24, recovery: 40, damage: 17, knockback: 100, parryable: false, range: 360, cooldown: 380, special: "bladestorm", phase: 1, projectile: { count: 14, spread: Math.PI * 2, speed: 230, range: 400, radius: 10 } }),
      atk({ name: "All Hands!", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 400, cooldown: 900, special: "summon", phase: 1 }),
    ],
    xp: 3400,
    loot: "blackbrine",
    look: { rig: "humanoid", scale: 2.1, skin: "#7aa098", cloth: "#2a2a3a", trim: "#c9a24a", weapon: "greatsword", horns: false, hood: false, glow: "#8ff0e0" },
    boss: { title: "Captain Blackbrine", phases: [0.5], posture: 280, music: "miniboss" },
  },
  {
    key: "thalassa",
    name: "Thalassa, the Leviathan Queen",
    behavior: "boss",
    hp: 5700,
    poise: 999,
    flinches: false,
    armor: 0.3,
    speed: 122,
    radius: 32,
    aggroRange: 540,
    leashRange: 2400,
    preferred: [90, 170],
    minions: ["siren", "brinehound"],
    attacks: [
      // Phase 1 — the queen of the deep: jaws and coils, and the sea at her call.
      atk({ name: "Crushing Jaws", anim: "bite", windup: 28, active: 6, recovery: 24, damage: 36, knockback: 170, lunge: 34, shape: arc(90, 110), parryable: true, range: 110, cooldown: 60, weight: 3 }),
      atk({ name: "Coil Crush", anim: "tail", windup: 36, active: 8, recovery: 30, damage: 33, knockback: 220, shape: circle(110), parryable: false, heavy: true, ground: true, range: 124, cooldown: 150 }),
      atk({ name: "Tidal Breath", anim: "breath", windup: 46, active: 28, recovery: 34, damage: 36, knockback: 180, shape: arc(240, 60), parryable: false, heavy: true, ground: true, range: 260, cooldown: 220, weight: 2 }),
      atk({ name: "Brine Lances", anim: "breath", windup: 28, active: 2, recovery: 28, damage: 25, knockback: 110, parryable: true, range: 460, minRange: 100, cooldown: 90, projectile: { count: 5, spread: 0.5, speed: 380, range: 480, radius: 10 } }),
      // Phase 2 — the storm rises.
      atk({ name: "Maelstrom", anim: "wing", windup: 44, active: 26, recovery: 40, damage: 19, knockback: 110, parryable: false, range: 460, cooldown: 320, special: "bladestorm", phase: 1, projectile: { count: 22, spread: Math.PI * 2, speed: 235, range: 500, radius: 10 } }),
      atk({ name: "Waterspouts", anim: "roar", windup: 58, active: 6, recovery: 30, damage: 32, knockback: 170, shape: circle(56), parryable: false, ground: true, range: 500, cooldown: 280, special: "sigils", phase: 1 }),
      atk({ name: "Breach", anim: "dive", windup: 52, active: 12, recovery: 42, damage: 44, knockback: 260, lunge: 300, shape: { kind: "line", length: 80, width: 70 }, parryable: false, heavy: true, ground: true, range: 420, minRange: 130, cooldown: 300, phase: 1 }),
      // Phase 3 — the Deluge: the sea itself comes down. Only the high ground is safe.
      atk({ name: "The Deluge", anim: "roar", windup: 160, active: 6, recovery: 80, damage: 400, knockback: 320, parryable: false, heavy: true, range: 1000, cooldown: 1300, special: "judgement", phase: 2 }),
      atk({ name: "Tidal Wave", anim: "breath", windup: 46, active: 28, recovery: 36, damage: 36, knockback: 200, shape: arc(320, 140), parryable: false, heavy: true, ground: true, range: 330, cooldown: 260, phase: 2 }),
      atk({ name: "Call the Deep", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 500, cooldown: 900, special: "summon", phase: 2 }),
    ],
    xp: 6400,
    loot: "thalassa",
    look: { rig: "dragon", scale: 3.1, skin: "#1a5a6a", cloth: "#0a2a3a", trim: "#f0d890", weapon: "none", horns: true, glow: "#8ff0e0", element: "tide" },
    boss: { title: "Thalassa, the Leviathan Queen", phases: [0.66, 0.33], posture: 400, music: "boss" },
  },
];

// ---------------------------------------------------------------------------
// Items

const FLOOR6_ITEMS: ItemBase[] = [
  { key: "mat_coral", name: "Living Coral", kind: "material", stack: 20, value: 18, tier: 7, desc: "A branch of coral that is still, somehow, growing. It pinches if you hold it wrong." },
  { key: "mat_brinepearl", name: "Brine Pearl", kind: "material", stack: 20, value: 22, tier: 7, desc: "A grey pearl that smells of storms. The sirens wear them as eyes." },
  { key: "mat_leviathanscale", name: "Leviathan Scale", kind: "material", stack: 20, value: 54, tier: 8, desc: "A scale as big as a shield, shed by something that should not exist." },
  { key: "key_cathedral", name: "The Drowned Key", kind: "key", value: 0, tier: 7, bound: true, desc: "Scylla swallowed this long ago: an iron key crusted with barnacles. It opens the Drowned Cathedral." },
  { key: "art_tidecrown", name: "Crown of the Deep", kind: "artifact", value: 0, tier: 8, bound: true, desc: "Thalassa's crown of coral and pearl. Hold it to your ear: the whole sea is in it, and something above, calling." },
  { key: "map_floor6", name: "Map of the Drowned Isles", kind: "key", value: 0, tier: 7, bound: true, desc: "A waterproof chart of Floor 6, with the tides marked in red. Buying it lets you open the map (M) up here." },
  { key: "charm_tide", name: "Tidecaller's Shell", kind: "charm", stamina: 14, hp: 20, value: 1100, tier: 7, rarity: 3, effect: "tideshell", desc: "Hold it up and hear the sea. Your blows soak what they strike, one time in six." },
  // The Tidecaller set (tier 8). The Pearlforge upgrades it with Floor 6 materials.
  { key: "sword_tide", name: "Riptide Blade", kind: "weapon", weapon: "sword", art: "sword_tide", power: 252, value: 1600, tier: 8, desc: "Sea-green steel that ripples like water when it moves." },
  { key: "greatsword_tide", name: "Breaker", kind: "weapon", weapon: "greatsword", art: "gs_tide", power: 270, value: 1720, tier: 8, desc: "A blade as heavy as a breaking wave, and about as gentle." },
  { key: "daggers_tide", name: "Twin Barbs", kind: "weapon", weapon: "daggers", art: "dg_tide", power: 248, value: 1570, tier: 8, desc: "Two barbed knives of shark-tooth steel." },
  { key: "spear_tide", name: "Reach Trident", kind: "weapon", weapon: "spear", art: "sp_tide", power: 258, value: 1650, tier: 8, desc: "A three-pronged spear the merrow would kill to get back." },
  { key: "staff_tide", name: "Tidecaller's Staff", kind: "weapon", weapon: "staff", art: "st_tide", power: 252, value: 1650, tier: 8, desc: "Driftwood wrapped around a brine pearl. The tide follows it." },
  { key: "armor_tide", name: "Tidewarden Plate", kind: "armor", defense: 90, hp: 58, stamina: -6, look: 31, value: 1840, tier: 8, desc: "Sea-green plate crusted with pearl. It never rusts." },
  { key: "armor_sharkskin", name: "Sharkskin Leathers", kind: "armor", defense: 66, hp: 36, stamina: 18, look: 32, value: 1700, tier: 8, desc: "Rough to touch, slick in water, and very hard to cut." },
  { key: "armor_seasilk", name: "Seasilk Robes", kind: "armor", defense: 44, hp: 78, stamina: 20, look: 33, value: 1680, tier: 8, desc: "Robes spun by the sirens, the blue of deep water." },
  { key: "helm_coralcrown", name: "Coral Crown", kind: "helm", defense: 38, hp: 36, look: 22, value: 1320, tier: 8, desc: "A helm of pearl-white steel crowned in living coral." },
  { key: "helm_divers", name: "Diver's Helm", kind: "helm", defense: 24, hp: 54, stamina: 12, look: 23, value: 1340, tier: 8, desc: "A brass diving helm with a round glass window. You can breathe in it. Probably." },
  // The Leviathan Queen's legendaries.
  { key: "spear_thalassa", name: "Thalassa's Trident", kind: "weapon", weapon: "spear", art: "sp_tide", power: 296, rarity: 4, value: 4800, tier: 8, desc: "The Leviathan Queen's own trident. The sea parts for whoever holds it." },
  { key: "armor_thalassa", name: "Leviathan Mantle", kind: "armor", defense: 100, hp: 90, stamina: 8, look: 31, rarity: 4, value: 5000, tier: 8, desc: "A mantle of Thalassa's scales, each one bigger than your hand. Nothing gets through." },
];

/** Floor 6's own gear: the Tidecaller set. */
const TIDE_GEAR = ["sword_tide", "greatsword_tide", "daggers_tide", "spear_tide", "staff_tide", "armor_tide", "armor_sharkskin", "armor_seasilk", "helm_coralcrown", "helm_divers"];

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  for (const d of FLOOR6_ENEMIES) if (!ENEMIES.some((e) => e.key === d.key)) ENEMIES.push(d);
  for (const it of FLOOR6_ITEMS) if (!ITEMS.some((i) => i.key === it.key)) ITEMS.push(it);
  const TIDE = TIDE_GEAR.map((key) => ({ key, w: 1 }));
  const VOID = VOID_GEAR.map((key) => ({ key, w: 1 }));
  const tonic = [{ key: "tonic", w: 1 }];
  const coral = [{ key: "mat_coral", w: 1 }];
  const pearl = [{ key: "mat_brinepearl", w: 1 }];
  Object.assign(LOOT, {
    f6beast: { gold: [8, 15], rolls: [{ chance: 0.45, pool: pearl }, { chance: 0.08, pool: tonic }, { chance: 0.03, pool: VOID }, { chance: 0.01, pool: TIDE }] },
    f6caster: { gold: [15, 26], rolls: [{ chance: 0.45, pool: pearl }, { chance: 0.1, pool: tonic }, { chance: 0.04, pool: VOID, boost: 0.2 }, { chance: 0.015, pool: TIDE }] },
    f6soldier: { gold: [17, 28], rolls: [{ chance: 0.4, pool: coral }, { chance: 0.12, pool: tonic }, { chance: 0.05, pool: VOID }, { chance: 0.018, pool: TIDE }] },
    f6construct: { gold: [26, 42], rolls: [{ chance: 0.9, pool: coral, qty: [1, 2] }, { chance: 0.05, pool: [{ key: "mat_leviathanscale", w: 1 }] }, { chance: 0.08, pool: VOID, boost: 0.3 }, { chance: 0.03, pool: TIDE, boost: 0.2 }] },
    f6drake: { gold: [24, 36], rolls: [{ chance: 0.6, pool: pearl, qty: [1, 2] }, { chance: 0.3, pool: coral }, { chance: 0.06, pool: [{ key: "mat_leviathanscale", w: 1 }] }, { chance: 0.04, pool: TIDE, boost: 0.2 }] },
    scylla: {
      gold: [420, 540],
      guaranteed: [{ key: "key_cathedral", once: true }],
      rolls: [
        { chance: 1, pool: TIDE, boost: 0.6, minRarity: 1 },
        { chance: 1, pool: pearl, qty: [3, 5] },
        { chance: 0.5, pool: [{ key: "mat_leviathanscale", w: 1 }] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    blackbrine: {
      gold: [480, 600],
      rolls: [
        { chance: 1, pool: TIDE, boost: 0.8, minRarity: 1 },
        { chance: 1, pool: coral, qty: [3, 5] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    thalassa: {
      gold: [1200, 1650],
      guaranteed: [{ key: "art_tidecrown", once: true }],
      rolls: [
        { chance: 1, pool: TIDE, boost: 1.3, minRarity: 2 },
        { chance: 0.4, pool: TIDE, boost: 0.8, minRarity: 1 },
        { chance: 0.015, pool: [{ key: "spear_thalassa", w: 1 }] },
        { chance: 0.015, pool: [{ key: "armor_thalassa", w: 1 }] },
        { chance: 1, pool: [{ key: "mat_leviathanscale", w: 1 }], qty: [1, 2] },
        { chance: 1, pool: pearl, qty: [4, 6] },
      ],
    },
  });
  Object.assign(SHOPS, {
    store6: priceGear([
      { key: "map_floor6", price: 180 },
      { key: "tonic", price: 50 },
      { key: "armor_sharkskin", price: 1700 },
      { key: "armor_seasilk", price: 1680 },
      { key: "armor_tide", price: 1840 },
      { key: "helm_coralcrown", price: 1320 },
      { key: "helm_divers", price: 1340 },
    ]),
    smith6: priceGear([
      { key: "sword_tide", price: 1800 },
      { key: "greatsword_tide", price: 1940 },
      { key: "daggers_tide", price: 1780 },
      { key: "spear_tide", price: 1860 },
      { key: "staff_tide", price: 1860 },
    ]),
  });
}
register();

export { FLOOR6_ENEMIES, TIDE_GEAR };
