/**
 * Floor 5 content — the Umbral Wilds: a twilight forest under a starless sky. Enemies (shades,
 * void hounds, voidcallers, abyssal knights, void golems, umbral drakes, Nightwing the Void
 * Wyrm, Maelgrim the Hollow Knight and Nyxara, Queen of the Void), materials, the Eclipse set,
 * loot tables and shops.
 */
import type { Shape } from "../combat/shapes.ts";
import { ENEMIES, type EnemyAttack, type EnemyDef } from "../enemies/defs.ts";
import { ITEMS, type ItemBase } from "../items/items.ts";
import { LOOT, priceGear, SHOPS } from "../items/loot.ts";
import { FROST_GEAR } from "./floor4.ts";

const deg = (d: number) => (d * Math.PI) / 180;
const atk = (a: Omit<EnemyAttack, "weight"> & { weight?: number }): EnemyAttack => ({ weight: 1, ...a });
const arc = (range: number, a: number): Shape => ({ kind: "arc", range, arc: deg(a) });
const circle = (radius: number, offset = 0): Shape => ({ kind: "circle", radius, offset });

// ---------------------------------------------------------------------------
// Enemies

const FLOOR5_ENEMIES: EnemyDef[] = [
  {
    key: "shade",
    name: "Shade",
    behavior: "melee",
    hp: 58,
    poise: 24,
    flinches: true,
    armor: 0,
    speed: 188,
    radius: 10,
    aggroRange: 240,
    leashRange: 600,
    preferred: [40, 70],
    attacks: [
      atk({ name: "Shadow Claw", anim: "slashR", windup: 16, active: 5, recovery: 20, damage: 15, knockback: 70, lunge: 16, shape: arc(36, 120), parryable: true, range: 46, cooldown: 36, weight: 2 }),
      atk({ name: "Umbral Lunge", anim: "thrust", windup: 22, active: 6, recovery: 26, damage: 19, knockback: 120, lunge: 130, shape: { kind: "line", length: 40, width: 24 }, parryable: true, range: 150, minRange: 60, cooldown: 120 }),
      atk({ name: "Fade", anim: "cast", windup: 12, active: 2, recovery: 14, damage: 0, knockback: 0, parryable: false, range: 90, cooldown: 280, special: "blink" }),
    ],
    xp: 30,
    loot: "f5beast",
    look: { rig: "humanoid", scale: 1, skin: "#3a3048", cloth: "#1a1428", trim: "#b77af2", weapon: "daggers", hood: true, glow: "#c49aff" },
  },
  {
    key: "voidhound",
    name: "Void Hound",
    behavior: "pack",
    hp: 54,
    poise: 26,
    flinches: true,
    armor: 0,
    speed: 208,
    radius: 11,
    aggroRange: 230,
    leashRange: 580,
    preferred: [60, 100],
    attacks: [
      atk({ name: "Void Bite", anim: "bite", windup: 17, active: 5, recovery: 24, damage: 15, knockback: 70, lunge: 34, shape: arc(30, 110), parryable: true, range: 50, cooldown: 44 }),
      atk({ name: "Shadow Pounce", anim: "pounce", windup: 30, active: 8, recovery: 34, damage: 19, knockback: 130, lunge: 150, shape: arc(28, 120), parryable: true, range: 160, minRange: 70, cooldown: 140 }),
    ],
    xp: 28,
    loot: "f5beast",
    look: { rig: "wolf", scale: 1.15, skin: "#2e2a3a", cloth: "#1a1624", trim: "#b77af2", weapon: "none", glow: "#d8b8ff" },
  },
  {
    key: "voidcaller",
    name: "Voidcaller",
    behavior: "caster",
    hp: 60,
    poise: 22,
    flinches: true,
    armor: 0,
    speed: 112,
    radius: 10,
    aggroRange: 260,
    leashRange: 620,
    preferred: [150, 220],
    attacks: [
      atk({ name: "Void Bolt", anim: "cast", windup: 24, active: 1, recovery: 26, damage: 18, knockback: 80, parryable: true, range: 340, minRange: 70, cooldown: 76, projectile: { count: 1, spread: 0, speed: 340, range: 360, radius: 8 }, weight: 2 }),
      atk({ name: "Rift", anim: "channel", windup: 46, active: 6, recovery: 28, damage: 24, knockback: 140, shape: circle(48), parryable: false, ground: true, targeted: true, range: 330, cooldown: 200 }),
      atk({ name: "Step Between", anim: "cast", windup: 14, active: 2, recovery: 16, damage: 0, knockback: 0, parryable: false, range: 90, cooldown: 300, special: "blink" }),
    ],
    xp: 42,
    loot: "f5caster",
    look: { rig: "humanoid", scale: 1, skin: "#bfb4d4", cloth: "#3a2a5a", trim: "#d8b8ff", weapon: "staff", hood: true, glow: "#d8b8ff" },
  },
  {
    key: "abyssalknight",
    name: "Abyssal Knight",
    behavior: "defender",
    hp: 104,
    poise: 44,
    flinches: false,
    armor: 0.15,
    speed: 106,
    radius: 12,
    aggroRange: 220,
    leashRange: 560,
    preferred: [40, 70],
    attacks: [
      atk({ name: "Void Blade", anim: "slashR", windup: 24, active: 6, recovery: 26, damage: 21, knockback: 120, lunge: 14, shape: arc(48, 140), parryable: true, range: 56, cooldown: 60, weight: 2 }),
      atk({ name: "Shield Bash", anim: "thrust", windup: 20, active: 5, recovery: 24, damage: 14, knockback: 160, lunge: 30, shape: { kind: "line", length: 40, width: 26 }, parryable: true, range: 50, cooldown: 120 }),
      atk({ name: "Dark Slam", anim: "overhead", windup: 40, active: 6, recovery: 32, damage: 27, knockback: 180, shape: circle(58, 20), parryable: false, heavy: true, ground: true, range: 70, cooldown: 220 }),
    ],
    xp: 50,
    loot: "f5soldier",
    look: { rig: "humanoid", scale: 1.12, skin: "#4a4058", cloth: "#2a1e3a", trim: "#b77af2", weapon: "cleaver", shield: true, glow: "#c49aff" },
  },
  {
    key: "voidgolem",
    name: "Void Golem",
    behavior: "brute",
    hp: 112,
    poise: 90,
    flinches: false,
    armor: 0.22,
    speed: 82,
    radius: 16,
    aggroRange: 200,
    leashRange: 520,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Crystal Slam", anim: "overhead", windup: 42, active: 6, recovery: 36, damage: 35, knockback: 220, shape: circle(62, 30), parryable: false, heavy: true, ground: true, range: 80, cooldown: 120, weight: 2 }),
      atk({ name: "Night Sweep", anim: "sweep", windup: 34, active: 8, recovery: 32, damage: 26, knockback: 180, shape: { kind: "arc", range: 70, arc: deg(200), inner: 16 }, parryable: true, range: 66, cooldown: 90 }),
      atk({ name: "Starshard Burst", anim: "roar", windup: 40, active: 4, recovery: 40, damage: 16, knockback: 90, parryable: false, range: 200, cooldown: 240, special: "bladestorm", projectile: { count: 9, spread: Math.PI * 2, speed: 240, range: 240, radius: 8 } }),
    ],
    xp: 78,
    loot: "f5construct",
    look: { rig: "construct", scale: 1.75, skin: "#5a4a7a", cloth: "#2a1e3a", trim: "#e0c8ff", weapon: "hammer", glow: "#e0c8ff" },
  },
  {
    key: "umbraldrake",
    name: "Umbral Drake",
    behavior: "melee",
    hp: 116,
    poise: 52,
    flinches: false,
    armor: 0.1,
    speed: 154,
    radius: 16,
    aggroRange: 260,
    leashRange: 620,
    preferred: [50, 90],
    attacks: [
      atk({ name: "Drake Bite", anim: "bite", windup: 22, active: 6, recovery: 26, damage: 21, knockback: 110, lunge: 24, shape: arc(40, 100), parryable: true, range: 60, cooldown: 60, weight: 2 }),
      atk({ name: "Tail Lash", anim: "tail", windup: 26, active: 8, recovery: 28, damage: 18, knockback: 150, shape: circle(50), parryable: true, range: 56, cooldown: 110 }),
      atk({ name: "Void Spit", anim: "breath", windup: 28, active: 2, recovery: 28, damage: 14, knockback: 60, parryable: true, range: 300, minRange: 80, cooldown: 160, projectile: { count: 3, spread: 0.35, speed: 300, range: 320, radius: 9 } }),
      atk({ name: "Wing Dive", anim: "dive", windup: 34, active: 8, recovery: 34, damage: 25, knockback: 180, lunge: 150, shape: { kind: "line", length: 50, width: 34 }, parryable: false, heavy: true, ground: true, range: 200, minRange: 90, cooldown: 220 }),
    ],
    xp: 70,
    loot: "f5drake",
    look: { rig: "dragon", scale: 1.25, skin: "#4a3a6a", cloth: "#1e1430", trim: "#d8b8ff", weapon: "none", horns: true, glow: "#e0c8ff", element: "shadow" },
  },
  // --- The void wyrm of the Night Spires: wears the sigil that opens the Sanctum. --------------
  {
    key: "nightwing",
    name: "Nightwing, the Void Wyrm",
    behavior: "boss",
    hp: 1380,
    poise: 999,
    flinches: false,
    armor: 0.2,
    speed: 124,
    radius: 30,
    aggroRange: 380,
    leashRange: 1400,
    preferred: [70, 130],
    minions: ["umbraldrake", "voidhound"],
    attacks: [
      atk({ name: "Rending Bite", anim: "bite", windup: 26, active: 6, recovery: 24, damage: 29, knockback: 150, lunge: 30, shape: arc(70, 110), parryable: true, range: 90, cooldown: 60, weight: 3 }),
      atk({ name: "Tail Sweep", anim: "tail", windup: 34, active: 8, recovery: 30, damage: 27, knockback: 200, shape: circle(96), parryable: false, heavy: true, ground: true, range: 110, cooldown: 150 }),
      atk({ name: "Void Breath", anim: "breath", windup: 44, active: 26, recovery: 34, damage: 32, knockback: 150, shape: arc(210, 55), parryable: false, heavy: true, ground: true, range: 230, cooldown: 220, weight: 2 }),
      atk({ name: "Wing Buffet", anim: "wing", windup: 30, active: 6, recovery: 30, damage: 13, knockback: 300, shape: circle(120), parryable: false, ground: true, range: 140, cooldown: 260 }),
      atk({ name: "Night Dive", anim: "dive", windup: 50, active: 10, recovery: 40, damage: 37, knockback: 240, lunge: 260, shape: { kind: "line", length: 70, width: 60 }, parryable: false, heavy: true, ground: true, range: 360, minRange: 120, cooldown: 300 }),
      atk({ name: "Starless Rain", anim: "roar", windup: 60, active: 6, recovery: 30, damage: 27, knockback: 150, shape: circle(48), parryable: false, ground: true, range: 380, cooldown: 320, special: "sigils", phase: 1 }),
      atk({ name: "Call the Brood", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 380, cooldown: 900, special: "summon", phase: 1 }),
    ],
    xp: 3200,
    loot: "nightwing",
    look: { rig: "dragon", scale: 2.5, skin: "#2a2238", cloth: "#5a3a8a", trim: "#e0c8ff", weapon: "none", horns: true, glow: "#d8b8ff", element: "shadow" },
    boss: { title: "Nightwing, the Void Wyrm", phases: [0.5], posture: 300, music: "miniboss" },
  },
  // --- The Abyssal Sanctum --------------------------------------------------------------------
  {
    key: "maelgrim",
    name: "Maelgrim, the Hollow Knight",
    behavior: "boss",
    hp: 1850,
    poise: 999,
    flinches: false,
    armor: 0.27,
    speed: 136,
    radius: 17,
    aggroRange: 420,
    leashRange: 1600,
    preferred: [50, 90],
    minions: ["shade", "voidcaller"],
    attacks: [
      atk({ name: "Hollow Cleave", anim: "bigSlashR", windup: 28, active: 6, recovery: 12, damage: 32, knockback: 160, lunge: 26, shape: arc(84, 160), parryable: true, range: 96, cooldown: 55, chain: 1, weight: 3 }),
      atk({ name: "Returning Dark", anim: "bigSlashL", windup: 16, active: 6, recovery: 30, damage: 28, knockback: 180, lunge: 16, shape: arc(80, 150), parryable: true, range: 90, cooldown: 55, weight: 0 }),
      atk({ name: "Shadow Charge", anim: "thrust", windup: 26, active: 10, recovery: 32, damage: 34, knockback: 220, lunge: 220, shape: { kind: "line", length: 50, width: 40 }, parryable: false, heavy: true, ground: true, range: 260, minRange: 100, cooldown: 200 }),
      atk({ name: "Void Pillars", anim: "channel", windup: 60, active: 6, recovery: 30, damage: 25, knockback: 150, shape: circle(52), parryable: false, ground: true, range: 400, cooldown: 300, special: "sigils", phase: 1 }),
      atk({ name: "Soul Storm", anim: "spin", windup: 44, active: 24, recovery: 40, damage: 16, knockback: 100, parryable: false, range: 360, cooldown: 380, special: "bladestorm", phase: 1, projectile: { count: 14, spread: Math.PI * 2, speed: 225, range: 400, radius: 10 } }),
    ],
    xp: 3000,
    loot: "maelgrim",
    look: { rig: "humanoid", scale: 2.1, skin: "#6a6078", cloth: "#1e1430", trim: "#b77af2", weapon: "greatsword", horns: true, glow: "#d8b8ff" },
    boss: { title: "Maelgrim, the Hollow Knight", phases: [0.5], posture: 270, music: "miniboss" },
  },
  {
    key: "nyxara",
    name: "Nyxara, Queen of the Void",
    behavior: "boss",
    hp: 5200,
    poise: 999,
    flinches: false,
    armor: 0.3,
    speed: 130,
    radius: 22,
    aggroRange: 540,
    leashRange: 2400,
    preferred: [110, 200],
    minions: ["shade", "voidcaller"],
    attacks: [
      // Phase 1 — the Queen's court: lances of night, and a scythe for anyone who comes close.
      atk({ name: "Void Lances", anim: "cast", windup: 26, active: 2, recovery: 26, damage: 26, knockback: 120, parryable: true, range: 460, minRange: 90, cooldown: 70, projectile: { count: 3, spread: 0.3, speed: 380, range: 480, radius: 10 }, weight: 3 }),
      atk({ name: "Crescent of Night", anim: "bigSlashR", windup: 26, active: 6, recovery: 26, damage: 34, knockback: 200, lunge: 20, shape: arc(120, 200), parryable: true, range: 120, cooldown: 90, weight: 2 }),
      atk({ name: "Rift Step", anim: "cast", windup: 12, active: 2, recovery: 14, damage: 0, knockback: 0, parryable: false, range: 120, cooldown: 260, special: "blink" }),
      atk({ name: "Void Rain", anim: "roar", windup: 60, active: 6, recovery: 30, damage: 30, knockback: 160, shape: circle(56), parryable: false, ground: true, range: 500, cooldown: 280, special: "sigils" }),
      // Phase 2 — the eclipse rises.
      atk({ name: "Starfall", anim: "spin", windup: 44, active: 26, recovery: 40, damage: 18, knockback: 110, parryable: false, range: 460, cooldown: 320, special: "bladestorm", phase: 1, projectile: { count: 22, spread: Math.PI * 2, speed: 235, range: 500, radius: 10 } }),
      atk({ name: "Shadow Nova", anim: "roar", windup: 50, active: 8, recovery: 40, damage: 38, knockback: 260, shape: circle(150), parryable: false, heavy: true, ground: true, range: 170, cooldown: 260, phase: 1 }),
      atk({ name: "Moonbeam", anim: "channel", windup: 52, active: 20, recovery: 36, damage: 34, knockback: 200, shape: { kind: "line", length: 420, width: 44 }, parryable: false, heavy: true, ground: true, range: 440, cooldown: 300, phase: 1 }),
      // Phase 3 — Total Eclipse: the sun goes out. Only the pools of moonlight she can't reach are safe.
      atk({ name: "Total Eclipse", anim: "roar", windup: 160, active: 6, recovery: 80, damage: 380, knockback: 300, parryable: false, heavy: true, range: 1000, cooldown: 1300, special: "judgement", phase: 2 }),
      atk({ name: "Sweeping Night", anim: "channel", windup: 46, active: 28, recovery: 36, damage: 32, knockback: 180, shape: arc(300, 140), parryable: false, heavy: true, ground: true, range: 320, cooldown: 260, phase: 2 }),
      atk({ name: "Call the Court", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 500, cooldown: 900, special: "summon", phase: 2 }),
    ],
    xp: 5600,
    loot: "nyxara",
    look: { rig: "humanoid", scale: 2.6, skin: "#d8d0e8", cloth: "#2a1a4a", trim: "#e0c8ff", weapon: "staff", hood: true, glow: "#e0c8ff" },
    boss: { title: "Nyxara, Queen of the Void", phases: [0.66, 0.33], posture: 380, music: "boss" },
  },
];

// ---------------------------------------------------------------------------
// Items

const FLOOR5_ITEMS: ItemBase[] = [
  { key: "mat_umbralshard", name: "Umbral Shard", kind: "material", stack: 20, value: 16, tier: 6, desc: "A splinter of night, cold to the touch and darker than it should be." },
  { key: "mat_shadowsilk", name: "Shadowsilk", kind: "material", stack: 20, value: 20, tier: 6, desc: "Thread spun from a shade's last shadow. It weighs nothing at all." },
  { key: "mat_voidheart", name: "Void Heart", kind: "material", stack: 20, value: 48, tier: 7, desc: "A hole in the world the size of a fist. The void golems are built around them." },
  { key: "key_sanctum", name: "Moon Sigil", kind: "key", value: 0, tier: 6, bound: true, desc: "Nightwing wore this silver sigil beneath its wing. It opens the Abyssal Sanctum." },
  { key: "art_eclipse", name: "Shard of the Eclipse", kind: "artifact", value: 0, tier: 7, bound: true, desc: "What was left of Nyxara's crown: a sliver of the eclipse itself. Somewhere above, a light waits." },
  { key: "map_floor5", name: "Map of the Umbral Wilds", kind: "key", value: 0, tier: 6, bound: true, desc: "A chart of Floor 5 inked in silver on black. Buying it lets you open the map (M) up here." },
  { key: "charm_moonstone", name: "Moonstone Charm", kind: "charm", hp: 24, value: 900, tier: 6, rarity: 3, effect: "moonstone", desc: "A drop of the Moonwell, set hard as stone. One blow in eight curses what it strikes." },
  // The Eclipse set (tier 7). The Moonforge upgrades it with Floor 5 materials.
  { key: "sword_void", name: "Eclipse Blade", kind: "weapon", weapon: "sword", art: "sword_void", power: 228, value: 1300, tier: 7, desc: "Black steel with a pale edge, like the rim of an eclipse." },
  { key: "greatsword_void", name: "Event Horizon", kind: "weapon", weapon: "greatsword", art: "gs_void", power: 244, value: 1400, tier: 7, desc: "A blade so dark the light bends around its edge." },
  { key: "daggers_void", name: "Nightfangs", kind: "weapon", weapon: "daggers", art: "dg_void", power: 224, value: 1270, tier: 7, desc: "Two curved fangs of solid shadow. You feel them more than see them." },
  { key: "spear_void", name: "Starpiercer", kind: "weapon", weapon: "spear", art: "sp_void", power: 232, value: 1340, tier: 7, desc: "A long spear tipped with a fallen star, still faintly burning." },
  { key: "staff_void", name: "Voidheart Scepter", kind: "weapon", weapon: "staff", art: "st_void", power: 228, value: 1340, tier: 7, desc: "A void heart held in silver moons. It hums a note too low to hear." },
  { key: "armor_eclipse", name: "Eclipse Plate", kind: "armor", defense: 80, hp: 52, stamina: -6, look: 28, value: 1500, tier: 7, desc: "Black plate edged in silver. Blows vanish into it." },
  { key: "armor_shadowsilk", name: "Shadowsilk Garb", kind: "armor", defense: 58, hp: 32, stamina: 16, look: 29, value: 1380, tier: 7, desc: "Layers of shadowsilk over black leather. It moves before you do." },
  { key: "armor_voidweave", name: "Voidweave Robes", kind: "armor", defense: 38, hp: 70, stamina: 18, look: 30, value: 1360, tier: 7, desc: "Robes woven from the night sky. Stars drift across the cloth." },
  { key: "helm_eclipse", name: "Eclipse Crown", kind: "helm", defense: 34, hp: 32, look: 20, value: 1080, tier: 7, desc: "A helm of black steel crowned with a silver crescent." },
  { key: "helm_shadowveil", name: "Shadow Veil", kind: "helm", defense: 20, hp: 48, stamina: 12, look: 21, value: 1100, tier: 7, desc: "A hood of shadowsilk. Your face is only a darkness with two pale lights." },
  // The Void Queen's legendaries.
  { key: "staff_nyxara", name: "Scepter of the Void Queen", kind: "weapon", weapon: "staff", art: "st_void", power: 266, rarity: 4, value: 4000, tier: 7, desc: "Nyxara's own scepter. The night leans toward it to listen." },
  { key: "armor_nyxara", name: "Veil of Night", kind: "armor", defense: 90, hp: 80, stamina: 6, look: 30, rarity: 4, value: 4200, tier: 7, desc: "The Queen's mantle, sewn from a starless sky. It is always midnight inside it." },
];

/** Floor 5's own gear: the Eclipse set. */
const VOID_GEAR = ["sword_void", "greatsword_void", "daggers_void", "spear_void", "staff_void", "armor_eclipse", "armor_shadowsilk", "armor_voidweave", "helm_eclipse", "helm_shadowveil"];

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  for (const d of FLOOR5_ENEMIES) if (!ENEMIES.some((e) => e.key === d.key)) ENEMIES.push(d);
  for (const it of FLOOR5_ITEMS) if (!ITEMS.some((i) => i.key === it.key)) ITEMS.push(it);
  const VOID = VOID_GEAR.map((key) => ({ key, w: 1 }));
  const FROST = FROST_GEAR.map((key) => ({ key, w: 1 }));
  const tonic = [{ key: "tonic", w: 1 }];
  const shard = [{ key: "mat_umbralshard", w: 1 }];
  const silk = [{ key: "mat_shadowsilk", w: 1 }];
  Object.assign(LOOT, {
    f5beast: { gold: [7, 14], rolls: [{ chance: 0.45, pool: silk }, { chance: 0.08, pool: tonic }, { chance: 0.03, pool: FROST }, { chance: 0.01, pool: VOID }] },
    f5caster: { gold: [14, 24], rolls: [{ chance: 0.45, pool: shard }, { chance: 0.1, pool: tonic }, { chance: 0.04, pool: FROST, boost: 0.2 }, { chance: 0.015, pool: VOID }] },
    f5soldier: { gold: [16, 26], rolls: [{ chance: 0.4, pool: shard }, { chance: 0.12, pool: tonic }, { chance: 0.05, pool: FROST }, { chance: 0.018, pool: VOID }] },
    f5construct: { gold: [24, 40], rolls: [{ chance: 0.9, pool: shard, qty: [1, 2] }, { chance: 0.05, pool: [{ key: "mat_voidheart", w: 1 }] }, { chance: 0.08, pool: FROST, boost: 0.3 }, { chance: 0.03, pool: VOID, boost: 0.2 }] },
    f5drake: { gold: [22, 34], rolls: [{ chance: 0.6, pool: silk, qty: [1, 2] }, { chance: 0.3, pool: shard }, { chance: 0.06, pool: [{ key: "mat_voidheart", w: 1 }] }, { chance: 0.04, pool: VOID, boost: 0.2 }] },
    nightwing: {
      gold: [380, 500],
      guaranteed: [{ key: "key_sanctum", once: true }],
      rolls: [
        { chance: 1, pool: VOID, boost: 0.6, minRarity: 1 },
        { chance: 1, pool: silk, qty: [3, 5] },
        { chance: 0.5, pool: [{ key: "mat_voidheart", w: 1 }] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    maelgrim: {
      gold: [440, 560],
      rolls: [
        { chance: 1, pool: VOID, boost: 0.8, minRarity: 1 },
        { chance: 1, pool: shard, qty: [3, 5] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    nyxara: {
      gold: [1100, 1500],
      guaranteed: [{ key: "art_eclipse", once: true }],
      rolls: [
        { chance: 1, pool: VOID, boost: 1.3, minRarity: 2 },
        { chance: 0.4, pool: VOID, boost: 0.8, minRarity: 1 },
        { chance: 0.015, pool: [{ key: "staff_nyxara", w: 1 }] },
        { chance: 0.015, pool: [{ key: "armor_nyxara", w: 1 }] },
        { chance: 1, pool: [{ key: "mat_voidheart", w: 1 }], qty: [1, 2] },
        { chance: 1, pool: silk, qty: [4, 6] },
      ],
    },
  });
  Object.assign(SHOPS, {
    store5: priceGear([
      { key: "map_floor5", price: 150 },
      { key: "tonic", price: 42 },
      { key: "armor_shadowsilk", price: 1380 },
      { key: "armor_voidweave", price: 1360 },
      { key: "armor_eclipse", price: 1500 },
      { key: "helm_eclipse", price: 1080 },
      { key: "helm_shadowveil", price: 1100 },
    ]),
    smith5: priceGear([
      { key: "sword_void", price: 1480 },
      { key: "greatsword_void", price: 1600 },
      { key: "daggers_void", price: 1460 },
      { key: "spear_void", price: 1530 },
      { key: "staff_void", price: 1530 },
    ]),
  });
}
register();

export { FLOOR5_ENEMIES, VOID_GEAR };
