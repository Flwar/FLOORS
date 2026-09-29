/**
 * Floor 8 content — the Sunscorched Sands: a desert under a sun that never sets, and the
 * tombs of the kings who worshipped it. Enemies (sand jackals, tomb guardians, sun priests,
 * sand wraiths, sandstone colossi, sun drakes, Sandmaw the Dune Wyrm, Nephra the Embalmer and
 * Solkaris the Sun Pharaoh), materials, the Solar set, loot tables and shops.
 */
import type { Shape } from "../combat/shapes.ts";
import { ENEMIES, type EnemyAttack, type EnemyDef } from "../enemies/defs.ts";
import { ITEMS, type ItemBase } from "../items/items.ts";
import { LOOT, priceGear, SHOPS } from "../items/loot.ts";
import { BRASS_GEAR } from "./floor7.ts";

const deg = (d: number) => (d * Math.PI) / 180;
const atk = (a: Omit<EnemyAttack, "weight"> & { weight?: number }): EnemyAttack => ({ weight: 1, ...a });
const arc = (range: number, a: number): Shape => ({ kind: "arc", range, arc: deg(a) });
const circle = (radius: number, offset = 0): Shape => ({ kind: "circle", radius, offset });

// ---------------------------------------------------------------------------
// Enemies

const FLOOR8_ENEMIES: EnemyDef[] = [
  {
    key: "sandjackal",
    name: "Sand Jackal",
    behavior: "pack",
    hp: 70,
    poise: 30,
    flinches: true,
    armor: 0.08,
    speed: 228,
    radius: 11,
    aggroRange: 240,
    leashRange: 600,
    preferred: [60, 100],
    attacks: [
      atk({ name: "Snap", anim: "bite", windup: 16, active: 5, recovery: 24, damage: 21, knockback: 70, lunge: 34, shape: arc(30, 110), parryable: true, range: 50, cooldown: 44 }),
      atk({ name: "Dune Leap", anim: "pounce", windup: 27, active: 8, recovery: 34, damage: 25, knockback: 130, lunge: 170, shape: arc(28, 120), parryable: true, range: 180, minRange: 70, cooldown: 140 }),
    ],
    xp: 36,
    loot: "f8beast",
    look: { rig: "wolf", scale: 1.1, skin: "#d8b070", cloth: "#8a6a3a", trim: "#fff0c0", weapon: "none", ears: true },
  },
  {
    key: "tombguard",
    name: "Tomb Guardian",
    behavior: "defender",
    hp: 128,
    poise: 54,
    flinches: false,
    armor: 0.2,
    speed: 100,
    radius: 12,
    aggroRange: 220,
    leashRange: 560,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Khopesh Hook", anim: "thrust", windup: 22, active: 6, recovery: 24, damage: 27, knockback: 140, lunge: 28, shape: { kind: "line", length: 74, width: 22 }, parryable: true, range: 80, cooldown: 60, weight: 2 }),
      atk({ name: "Shield Bash", anim: "thrust", windup: 20, active: 5, recovery: 24, damage: 18, knockback: 180, lunge: 34, shape: { kind: "line", length: 40, width: 26 }, parryable: true, range: 50, cooldown: 120 }),
      atk({ name: "Tomb Curse", anim: "overhead", windup: 40, active: 6, recovery: 32, damage: 33, knockback: 190, shape: circle(60, 24), parryable: false, heavy: true, ground: true, range: 78, cooldown: 220 }),
    ],
    xp: 64,
    loot: "f8tomb",
    look: { rig: "humanoid", scale: 1.1, skin: "#d8cca8", cloth: "#b8a888", trim: "#e8c040", weapon: "spear", shield: true, glow: "#e8c040" },
  },
  {
    key: "sunpriest",
    name: "Sun Priest",
    behavior: "caster",
    hp: 74,
    poise: 22,
    flinches: true,
    armor: 0,
    speed: 118,
    radius: 10,
    aggroRange: 280,
    leashRange: 620,
    preferred: [150, 220],
    attacks: [
      atk({ name: "Sunbolt", anim: "cast", windup: 22, active: 1, recovery: 26, damage: 23, knockback: 90, parryable: true, range: 350, minRange: 70, cooldown: 72, projectile: { count: 1, spread: 0, speed: 400, range: 370, radius: 9 }, weight: 2 }),
      atk({ name: "Solar Brand", anim: "cast", windup: 40, active: 6, recovery: 28, damage: 32, knockback: 170, shape: circle(54), parryable: false, heavy: true, ground: true, targeted: true, range: 330, cooldown: 180 }),
      atk({ name: "Heat Shimmer", anim: "cast", windup: 12, active: 2, recovery: 14, damage: 0, knockback: 0, parryable: false, range: 90, cooldown: 300, special: "blink" }),
    ],
    xp: 50,
    loot: "f8caster",
    look: { rig: "humanoid", scale: 1, skin: "#a8744f", cloth: "#e8d8a8", trim: "#ffb030", weapon: "staff", hood: true, glow: "#ffd24a" },
  },
  {
    key: "sandwraith",
    name: "Sand Wraith",
    behavior: "assassin",
    hp: 84,
    poise: 28,
    flinches: true,
    armor: 0.05,
    speed: 170,
    radius: 11,
    aggroRange: 250,
    leashRange: 600,
    preferred: [40, 70],
    attacks: [
      atk({ name: "Grit Blades", anim: "slashR", windup: 14, active: 8, recovery: 22, damage: 24, knockback: 80, lunge: 30, shape: arc(44, 140), parryable: true, range: 56, cooldown: 50, weight: 2 }),
      atk({ name: "Rising Sands", anim: "leap", windup: 28, active: 8, recovery: 30, damage: 30, knockback: 150, lunge: 180, shape: { kind: "line", length: 44, width: 30 }, parryable: false, heavy: true, ground: true, range: 190, minRange: 80, cooldown: 180 }),
    ],
    xp: 54,
    loot: "f8caster",
    look: { rig: "humanoid", scale: 1, skin: "#c8a878", cloth: "#8a6a4a", trim: "#f0d890", weapon: "daggers", hood: true, glow: "#f0d890" },
  },
  {
    key: "sandgolem",
    name: "Sandstone Colossus",
    behavior: "brute",
    hp: 134,
    poise: 100,
    flinches: false,
    armor: 0.25,
    speed: 82,
    radius: 16,
    aggroRange: 200,
    leashRange: 520,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Monolith Fist", anim: "overhead", windup: 40, active: 6, recovery: 36, damage: 42, knockback: 230, shape: circle(64, 30), parryable: false, heavy: true, ground: true, range: 82, cooldown: 120, weight: 2 }),
      atk({ name: "Sand Sweep", anim: "sweep", windup: 32, active: 8, recovery: 32, damage: 32, knockback: 190, shape: { kind: "arc", range: 74, arc: deg(200), inner: 16 }, parryable: true, range: 70, cooldown: 90 }),
      atk({ name: "Crumble", anim: "roar", windup: 40, active: 4, recovery: 40, damage: 20, knockback: 100, parryable: false, range: 200, cooldown: 240, special: "bladestorm", projectile: { count: 10, spread: Math.PI * 2, speed: 250, range: 240, radius: 9 } }),
    ],
    xp: 92,
    loot: "f8golem",
    look: { rig: "construct", scale: 1.8, skin: "#d8b880", cloth: "#8a6a4a", trim: "#e8c040", weapon: "hammer", glow: "#ffd24a" },
  },
  {
    key: "sundrake",
    name: "Sun Drake",
    behavior: "melee",
    hp: 138,
    poise: 58,
    flinches: false,
    armor: 0.15,
    speed: 160,
    radius: 16,
    aggroRange: 260,
    leashRange: 620,
    preferred: [50, 90],
    attacks: [
      atk({ name: "Gilded Bite", anim: "bite", windup: 22, active: 6, recovery: 26, damage: 27, knockback: 110, lunge: 24, shape: arc(40, 100), parryable: true, range: 60, cooldown: 60, weight: 2 }),
      atk({ name: "Tail Lash", anim: "tail", windup: 26, active: 8, recovery: 28, damage: 23, knockback: 160, shape: circle(50), parryable: true, range: 56, cooldown: 110 }),
      atk({ name: "Sunfire", anim: "breath", windup: 28, active: 2, recovery: 28, damage: 18, knockback: 70, parryable: true, range: 300, minRange: 80, cooldown: 160, projectile: { count: 3, spread: 0.35, speed: 320, range: 320, radius: 9 } }),
      atk({ name: "Sky Dive", anim: "dive", windup: 34, active: 8, recovery: 34, damage: 31, knockback: 190, lunge: 150, shape: { kind: "line", length: 50, width: 34 }, parryable: false, heavy: true, ground: true, range: 200, minRange: 90, cooldown: 220 }),
    ],
    xp: 84,
    loot: "f8drake",
    look: { rig: "dragon", scale: 1.25, skin: "#e8b848", cloth: "#8a5a20", trim: "#fff0c0", weapon: "none", horns: true, glow: "#ffd24a", element: "sun" },
  },
  // --- The wyrm under the dunes: it swallowed the seal of the Pyramid. -----------------------
  {
    key: "sandmaw",
    name: "Sandmaw, the Dune Wyrm",
    behavior: "boss",
    hp: 1700,
    poise: 999,
    flinches: false,
    armor: 0.24,
    speed: 130,
    radius: 30,
    aggroRange: 380,
    leashRange: 1400,
    preferred: [70, 130],
    minions: ["sundrake", "sandjackal"],
    attacks: [
      atk({ name: "Swallowing Bite", anim: "bite", windup: 26, active: 6, recovery: 24, damage: 35, knockback: 150, lunge: 30, shape: arc(72, 110), parryable: true, range: 92, cooldown: 60, weight: 3 }),
      atk({ name: "Dune Tail", anim: "tail", windup: 34, active: 8, recovery: 30, damage: 33, knockback: 210, shape: circle(98), parryable: false, heavy: true, ground: true, range: 112, cooldown: 150 }),
      atk({ name: "Sunfire Breath", anim: "breath", windup: 44, active: 26, recovery: 34, damage: 38, knockback: 170, shape: arc(215, 55), parryable: false, heavy: true, ground: true, range: 235, cooldown: 220, weight: 2 }),
      atk({ name: "Sand Blast", anim: "wing", windup: 30, active: 6, recovery: 30, damage: 16, knockback: 300, shape: circle(124), parryable: false, ground: true, range: 144, cooldown: 260 }),
      atk({ name: "Burrow Strike", anim: "dive", windup: 50, active: 10, recovery: 40, damage: 43, knockback: 240, lunge: 270, shape: { kind: "line", length: 72, width: 62 }, parryable: false, heavy: true, ground: true, range: 370, minRange: 120, cooldown: 300 }),
      atk({ name: "Quicksand", anim: "roar", windup: 60, active: 6, recovery: 30, damage: 33, knockback: 160, shape: circle(50), parryable: false, ground: true, range: 390, cooldown: 320, special: "sigils", phase: 1 }),
      atk({ name: "Call of the Dunes", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 390, cooldown: 900, special: "summon", phase: 1 }),
    ],
    xp: 4700,
    loot: "sandmaw",
    look: { rig: "dragon", scale: 2.6, skin: "#c89848", cloth: "#6a4a20", trim: "#fff0c0", weapon: "none", horns: true, glow: "#ffd24a", element: "sun" },
    boss: { title: "Sandmaw, the Dune Wyrm", phases: [0.5], posture: 330, music: "miniboss" },
  },
  // --- The Sun Pyramid ------------------------------------------------------------------------
  {
    key: "nephra",
    name: "Nephra the Embalmer",
    behavior: "boss",
    hp: 2280,
    poise: 999,
    flinches: false,
    armor: 0.26,
    speed: 136,
    radius: 16,
    aggroRange: 420,
    leashRange: 1600,
    preferred: [60, 110],
    minions: ["tombguard", "sandwraith"],
    attacks: [
      atk({ name: "Ritual Blade", anim: "bigSlashL", windup: 22, active: 6, recovery: 16, damage: 36, knockback: 170, lunge: 30, shape: arc(90, 150), parryable: true, range: 96, cooldown: 55, chain: 1, weight: 3 }),
      atk({ name: "Second Cut", anim: "bigSlashL", windup: 14, active: 6, recovery: 30, damage: 32, knockback: 180, lunge: 16, shape: arc(86, 160), parryable: true, range: 92, cooldown: 55, weight: 0 }),
      atk({ name: "Linen Snare", anim: "cast", windup: 28, active: 2, recovery: 28, damage: 24, knockback: -140, parryable: true, range: 380, minRange: 90, cooldown: 110, projectile: { count: 3, spread: 0.4, speed: 400, range: 400, radius: 10 }, weight: 2 }),
      atk({ name: "Canopic Curse", anim: "channel", windup: 60, active: 6, recovery: 30, damage: 30, knockback: 160, shape: circle(52), parryable: false, ground: true, range: 400, cooldown: 300, special: "sigils", phase: 1 }),
      atk({ name: "Sandstorm of Souls", anim: "spin", windup: 44, active: 24, recovery: 40, damage: 19, knockback: 100, parryable: false, range: 360, cooldown: 380, special: "bladestorm", phase: 1, projectile: { count: 14, spread: Math.PI * 2, speed: 235, range: 400, radius: 10 } }),
    ],
    xp: 4200,
    loot: "nephra",
    look: { rig: "humanoid", scale: 2.1, skin: "#d8cca8", cloth: "#2a1a3a", trim: "#e8c040", weapon: "staff", hood: true, glow: "#c070ff" },
    boss: { title: "Nephra the Embalmer", phases: [0.5], posture: 300, music: "miniboss" },
  },
  {
    key: "solkaris",
    name: "Solkaris, the Sun Pharaoh",
    behavior: "boss",
    hp: 6700,
    poise: 999,
    flinches: false,
    armor: 0.32,
    speed: 118,
    radius: 26,
    aggroRange: 540,
    leashRange: 2400,
    preferred: [90, 160],
    minions: ["tombguard", "sunpriest"],
    attacks: [
      // Phase 1 — the Pharaoh rises: the khopesh and the sun disc.
      atk({ name: "Pharaoh's Khopesh", anim: "overhead", windup: 30, active: 6, recovery: 22, damage: 42, knockback: 210, lunge: 30, shape: circle(86, 60), parryable: true, heavy: true, range: 132, cooldown: 70, weight: 3 }),
      atk({ name: "Sweep of the Horizon", anim: "sweep", windup: 34, active: 8, recovery: 30, damage: 37, knockback: 230, shape: { kind: "arc", range: 142, arc: deg(220), inner: 30 }, parryable: false, heavy: true, ground: true, range: 142, cooldown: 150 }),
      atk({ name: "Sun Disc", anim: "cast", windup: 28, active: 2, recovery: 28, damage: 28, knockback: 110, parryable: true, range: 470, minRange: 100, cooldown: 90, projectile: { count: 5, spread: 0.5, speed: 420, range: 490, radius: 10 }, weight: 2 }),
      // Phase 2 — the sky opens.
      atk({ name: "Solar Wind", anim: "roar", windup: 44, active: 26, recovery: 40, damage: 21, knockback: 110, parryable: false, range: 470, cooldown: 320, special: "bladestorm", phase: 1, projectile: { count: 24, spread: Math.PI * 2, speed: 245, range: 510, radius: 10 } }),
      atk({ name: "Brand of Ra", anim: "roar", windup: 58, active: 6, recovery: 30, damage: 36, knockback: 180, shape: circle(58), parryable: false, ground: true, range: 510, cooldown: 280, special: "sigils", phase: 1 }),
      atk({ name: "Sunbeam", anim: "channel", windup: 50, active: 20, recovery: 36, damage: 40, knockback: 210, shape: { kind: "line", length: 450, width: 48 }, parryable: false, heavy: true, ground: true, range: 470, cooldown: 280, phase: 1 }),
      // Phase 3 — High Noon: the sun burns everything but the obelisks' shade.
      atk({ name: "High Noon", anim: "roar", windup: 150, active: 6, recovery: 80, damage: 440, knockback: 320, parryable: false, heavy: true, range: 1000, cooldown: 1300, special: "judgement", phase: 2 }),
      atk({ name: "Corona", anim: "spin", windup: 40, active: 30, recovery: 40, damage: 23, knockback: 140, parryable: false, range: 470, cooldown: 300, special: "bladestorm", phase: 2, projectile: { count: 30, spread: Math.PI * 2, speed: 255, range: 530, radius: 10 } }),
      atk({ name: "Rise, My Servants", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 510, cooldown: 900, special: "summon", phase: 2 }),
    ],
    xp: 7800,
    loot: "solkaris",
    look: { rig: "humanoid", scale: 3, skin: "#c8905a", cloth: "#e8d8a8", trim: "#ffd24a", weapon: "greatsword", horns: false, glow: "#ffd24a" },
    boss: { title: "Solkaris, the Sun Pharaoh", phases: [0.66, 0.33], posture: 430, music: "boss" },
  },
];

// ---------------------------------------------------------------------------
// Items

const FLOOR8_ITEMS: ItemBase[] = [
  { key: "mat_sunstone", name: "Sunstone", kind: "material", stack: 20, value: 22, tier: 9, desc: "A chip of desert glass that holds the day's heat long after dark." },
  { key: "mat_scarab", name: "Scarab Shell", kind: "material", stack: 20, value: 26, tier: 9, desc: "A beetle's wing-case of real gold. The jackals crunch the rest." },
  { key: "mat_solarheart", name: "Heart of the Sun", kind: "material", stack: 20, value: 66, tier: 10, desc: "A pebble of pure light. It is warm, and it is never, ever dark." },
  { key: "key_pyramid", name: "The Solar Seal", kind: "key", value: 0, tier: 9, bound: true, desc: "Sandmaw swallowed it a thousand years ago: a gold disc with a sun on one side and a closed eye on the other. It fits the Pyramid's door." },
  { key: "art_suncrown", name: "Crown of Solkaris", kind: "artifact", value: 0, tier: 10, bound: true, desc: "The Sun Pharaoh's crown, dimmed at last. For a moment, when you lift it, it's noon again." },
  { key: "map_floor8", name: "Map of the Sunscorched Sands", kind: "key", value: 0, tier: 9, bound: true, desc: "A caravan-master's map of Floor 8, with every well marked twice. Buying it lets you open the map (M) up here." },
  { key: "charm_scarab", name: "Golden Scarab", kind: "charm", stamina: 18, hp: 26, value: 1400, tier: 9, rarity: 3, effect: "goldscarab", desc: "A scarab of solid gold that turns to face the sun. One blow in six dazzles what it strikes." },
  // The Solar set (tier 10). The Sunforge upgrades it with Floor 8 materials.
  { key: "sword_solar", name: "Sunsteel Khopesh", kind: "weapon", weapon: "sword", art: "sword_solar", power: 300, value: 2100, tier: 10, desc: "A hooked sword of sunsteel. It throws the light into your enemy's eyes on every swing." },
  { key: "greatsword_solar", name: "Dawnfall Blade", kind: "weapon", weapon: "greatsword", art: "gs_solar", power: 322, value: 2260, tier: 10, desc: "A greatsword with a sun disc set in the crossguard. It is heaviest at noon." },
  { key: "daggers_solar", name: "Scarab Fangs", kind: "weapon", weapon: "daggers", art: "dg_solar", power: 294, value: 2070, tier: 10, desc: "Two curved knives with gold scarabs for pommels." },
  { key: "spear_solar", name: "Obelisk Spear", kind: "weapon", weapon: "spear", art: "sp_solar", power: 306, value: 2170, tier: 10, desc: "A spear as straight as an obelisk, tipped with sunstone." },
  { key: "staff_solar", name: "Solar Scepter", kind: "weapon", weapon: "staff", art: "st_solar", power: 300, value: 2170, tier: 10, desc: "A scepter crowned with a disc of burning glass." },
  { key: "armor_solar", name: "Sunplate", kind: "armor", defense: 108, hp: 70, stamina: -6, look: 37, value: 2400, tier: 10, desc: "Gilded plate scaled like a scarab's back. It stays cool however hot the sun." },
  { key: "armor_nomad", name: "Nomad's Wraps", kind: "armor", defense: 80, hp: 44, stamina: 22, look: 38, value: 2230, tier: 10, desc: "Layer on layer of linen and leather, the way the caravans dress. Sand gets in anyway." },
  { key: "armor_sunweave", name: "Sunweave Robes", kind: "armor", defense: 54, hp: 94, stamina: 24, look: 39, value: 2210, tier: 10, desc: "White robes stitched with gold thread in the shape of the sun's path." },
  { key: "helm_nemes", name: "Pharaoh's Nemes", kind: "helm", defense: 46, hp: 44, look: 26, value: 1720, tier: 10, desc: "A striped royal headdress over a gold circlet. The desert kings wore these into battle." },
  { key: "helm_veil", name: "Desert Veil", kind: "helm", defense: 28, hp: 66, stamina: 16, look: 27, value: 1740, tier: 10, desc: "A hood and a sand-veil. Only your eyes show, and they're squinting." },
  // Solkaris's legendaries.
  { key: "sword_solkaris", name: "Khopesh of the Sun King", kind: "weapon", weapon: "sword", art: "sword_solar", power: 350, rarity: 4, value: 6000, tier: 10, desc: "Solkaris's own blade. At noon, it casts no shadow." },
  { key: "armor_solkaris", name: "Mantle of the Sun King", kind: "armor", defense: 118, hp: 104, stamina: 10, look: 37, rarity: 4, value: 6200, tier: 10, desc: "The Sun Pharaoh's golden mantle. It is always warm, and the dark doesn't like it." },
];

/** Floor 8's own gear: the Solar set. */
const SOLAR_GEAR = ["sword_solar", "greatsword_solar", "daggers_solar", "spear_solar", "staff_solar", "armor_solar", "armor_nomad", "armor_sunweave", "helm_nemes", "helm_veil"];

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  for (const d of FLOOR8_ENEMIES) if (!ENEMIES.some((e) => e.key === d.key)) ENEMIES.push(d);
  for (const it of FLOOR8_ITEMS) if (!ITEMS.some((i) => i.key === it.key)) ITEMS.push(it);
  const SOLAR = SOLAR_GEAR.map((key) => ({ key, w: 1 }));
  const BRASS = BRASS_GEAR.map((key) => ({ key, w: 1 }));
  const tonic = [{ key: "tonic", w: 1 }];
  const sunstone = [{ key: "mat_sunstone", w: 1 }];
  const scarab = [{ key: "mat_scarab", w: 1 }];
  const heart = [{ key: "mat_solarheart", w: 1 }];
  Object.assign(LOOT, {
    f8beast: { gold: [10, 18], rolls: [{ chance: 0.45, pool: scarab }, { chance: 0.08, pool: tonic }, { chance: 0.03, pool: BRASS }, { chance: 0.01, pool: SOLAR }] },
    f8caster: { gold: [18, 30], rolls: [{ chance: 0.45, pool: sunstone }, { chance: 0.1, pool: tonic }, { chance: 0.04, pool: BRASS, boost: 0.2 }, { chance: 0.015, pool: SOLAR }] },
    f8tomb: { gold: [20, 32], rolls: [{ chance: 0.4, pool: scarab }, { chance: 0.25, pool: sunstone }, { chance: 0.12, pool: tonic }, { chance: 0.05, pool: BRASS }, { chance: 0.018, pool: SOLAR }] },
    f8golem: { gold: [30, 46], rolls: [{ chance: 0.9, pool: sunstone, qty: [1, 2] }, { chance: 0.05, pool: heart }, { chance: 0.08, pool: BRASS, boost: 0.3 }, { chance: 0.03, pool: SOLAR, boost: 0.2 }] },
    f8drake: { gold: [28, 40], rolls: [{ chance: 0.6, pool: scarab, qty: [1, 2] }, { chance: 0.3, pool: sunstone }, { chance: 0.06, pool: heart }, { chance: 0.04, pool: SOLAR, boost: 0.2 }] },
    sandmaw: {
      gold: [500, 620],
      guaranteed: [{ key: "key_pyramid", once: true }],
      rolls: [
        { chance: 1, pool: SOLAR, boost: 0.6, minRarity: 1 },
        { chance: 1, pool: scarab, qty: [3, 5] },
        { chance: 0.5, pool: heart },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    nephra: {
      gold: [560, 680],
      rolls: [
        { chance: 1, pool: SOLAR, boost: 0.8, minRarity: 1 },
        { chance: 1, pool: sunstone, qty: [3, 5] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    solkaris: {
      gold: [1400, 1900],
      guaranteed: [{ key: "art_suncrown", once: true }],
      rolls: [
        { chance: 1, pool: SOLAR, boost: 1.3, minRarity: 2 },
        { chance: 0.4, pool: SOLAR, boost: 0.8, minRarity: 1 },
        { chance: 0.015, pool: [{ key: "sword_solkaris", w: 1 }] },
        { chance: 0.015, pool: [{ key: "armor_solkaris", w: 1 }] },
        { chance: 1, pool: heart, qty: [1, 2] },
        { chance: 1, pool: scarab, qty: [4, 6] },
      ],
    },
  });
  Object.assign(SHOPS, {
    store8: priceGear([
      { key: "map_floor8", price: 240 },
      { key: "tonic", price: 62 },
      { key: "armor_nomad", price: 2230 },
      { key: "armor_sunweave", price: 2210 },
      { key: "armor_solar", price: 2400 },
      { key: "helm_nemes", price: 1720 },
      { key: "helm_veil", price: 1740 },
    ]),
    smith8: priceGear([
      { key: "sword_solar", price: 2340 },
      { key: "greatsword_solar", price: 2520 },
      { key: "daggers_solar", price: 2310 },
      { key: "spear_solar", price: 2420 },
      { key: "staff_solar", price: 2420 },
    ]),
  });
}
register();

export { FLOOR8_ENEMIES, SOLAR_GEAR };
