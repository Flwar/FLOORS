/**
 * Floor 3 content — the Ember Reaches: dragon country. Enemies (drakes, the red wyrm
 * Cindermaw, and Ignivar, Tyrant of the Ember Sky), materials, the Dragonscale set, loot
 * tables and shops. Registered into the shared tables when this module loads, like Floor 2.
 */
import type { Shape } from "../combat/shapes.ts";
import { ENEMIES, type EnemyAttack, type EnemyDef } from "../enemies/defs.ts";
import { ITEMS, type ItemBase } from "../items/items.ts";
import { LOOT, priceGear, SHOPS } from "../items/loot.ts";

const deg = (d: number) => (d * Math.PI) / 180;
const atk = (a: Omit<EnemyAttack, "weight"> & { weight?: number }): EnemyAttack => ({ weight: 1, ...a });
const arc = (range: number, a: number): Shape => ({ kind: "arc", range, arc: deg(a) });
const circle = (radius: number, offset = 0): Shape => ({ kind: "circle", radius, offset });

// ---------------------------------------------------------------------------
// Enemies

const FLOOR3_ENEMIES: EnemyDef[] = [
  {
    key: "ashling",
    name: "Ashling",
    behavior: "ranged",
    hp: 38,
    poise: 18,
    flinches: true,
    armor: 0,
    speed: 150,
    radius: 9,
    aggroRange: 230,
    leashRange: 560,
    preferred: [120, 180],
    attacks: [
      atk({ name: "Ember Toss", anim: "throw", windup: 24, active: 1, recovery: 24, damage: 10, knockback: 60, parryable: true, range: 260, minRange: 60, cooldown: 70, projectile: { count: 1, spread: 0, speed: 300, range: 300, radius: 7 }, weight: 2 }),
      atk({ name: "Claw", anim: "slashR", windup: 16, active: 5, recovery: 20, damage: 8, knockback: 50, shape: arc(26, 100), parryable: true, range: 40, cooldown: 40 }),
    ],
    xp: 22,
    loot: "f3beast",
    look: { rig: "humanoid", scale: 0.78, skin: "#7a2a1a", cloth: "#3a1a14", trim: "#ffb347", weapon: "none", horns: true, glow: "#ffb347" },
  },
  {
    key: "magmahound",
    name: "Magma Hound",
    behavior: "pack",
    hp: 52,
    poise: 26,
    flinches: true,
    armor: 0,
    speed: 196,
    radius: 11,
    aggroRange: 220,
    leashRange: 560,
    preferred: [60, 100],
    attacks: [
      atk({ name: "Molten Bite", anim: "bite", windup: 18, active: 5, recovery: 24, damage: 12, knockback: 70, lunge: 34, shape: arc(30, 110), parryable: true, range: 50, cooldown: 46 }),
      atk({ name: "Lava Pounce", anim: "pounce", windup: 30, active: 8, recovery: 34, damage: 16, knockback: 130, lunge: 140, shape: arc(28, 120), parryable: true, range: 150, minRange: 70, cooldown: 140 }),
    ],
    xp: 24,
    loot: "f3beast",
    look: { rig: "wolf", scale: 1.1, skin: "#3a3434", cloth: "#241e1e", trim: "#ff8a3a", weapon: "none", glow: "#ffb347" },
  },
  {
    key: "flamecaller",
    name: "Flamecaller",
    behavior: "caster",
    hp: 58,
    poise: 22,
    flinches: true,
    armor: 0,
    speed: 108,
    radius: 10,
    aggroRange: 250,
    leashRange: 600,
    preferred: [150, 220],
    attacks: [
      atk({ name: "Fireball", anim: "cast", windup: 26, active: 1, recovery: 28, damage: 16, knockback: 90, parryable: true, range: 330, minRange: 70, cooldown: 80, projectile: { count: 1, spread: 0, speed: 320, range: 360, radius: 9 }, weight: 2 }),
      atk({ name: "Flame Pillar", anim: "channel", windup: 46, active: 6, recovery: 28, damage: 22, knockback: 140, shape: circle(44), parryable: false, ground: true, targeted: true, range: 320, cooldown: 200 }),
      atk({ name: "Cinder Step", anim: "cast", windup: 14, active: 2, recovery: 16, damage: 0, knockback: 0, parryable: false, range: 90, cooldown: 300, special: "blink" }),
    ],
    xp: 36,
    loot: "f3caster",
    look: { rig: "humanoid", scale: 1, skin: "#d9a77c", cloth: "#8a1e14", trim: "#ffb347", weapon: "staff", hood: true, glow: "#ff7a2a" },
  },
  {
    key: "emberguard",
    name: "Emberguard",
    behavior: "defender",
    hp: 96,
    poise: 40,
    flinches: false,
    armor: 0.12,
    speed: 104,
    radius: 12,
    aggroRange: 220,
    leashRange: 560,
    preferred: [40, 70],
    attacks: [
      atk({ name: "Burning Mace", anim: "slashR", windup: 24, active: 6, recovery: 26, damage: 18, knockback: 120, lunge: 14, shape: arc(46, 140), parryable: true, range: 54, cooldown: 60, weight: 2 }),
      atk({ name: "Shield Bash", anim: "thrust", windup: 20, active: 5, recovery: 24, damage: 12, knockback: 160, lunge: 30, shape: { kind: "line", length: 40, width: 26 }, parryable: true, range: 50, cooldown: 120 }),
      atk({ name: "Flame Slam", anim: "overhead", windup: 40, active: 6, recovery: 32, damage: 24, knockback: 180, shape: circle(56, 20), parryable: false, heavy: true, ground: true, range: 70, cooldown: 220 }),
    ],
    xp: 44,
    loot: "f3soldier",
    look: { rig: "humanoid", scale: 1.1, skin: "#2a2224", cloth: "#5a1e1a", trim: "#ff8a3a", weapon: "hammer", shield: true, glow: "#ff8a3a" },
  },
  {
    key: "obsidian",
    name: "Obsidian Golem",
    behavior: "brute",
    hp: 105,
    poise: 90,
    flinches: false,
    armor: 0.2,
    speed: 80,
    radius: 16,
    aggroRange: 200,
    leashRange: 520,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Obsidian Slam", anim: "overhead", windup: 42, active: 6, recovery: 36, damage: 32, knockback: 220, shape: circle(60, 30), parryable: false, heavy: true, ground: true, range: 80, cooldown: 120, weight: 2 }),
      atk({ name: "Glass Sweep", anim: "sweep", windup: 34, active: 8, recovery: 32, damage: 24, knockback: 180, shape: { kind: "arc", range: 70, arc: deg(200), inner: 16 }, parryable: true, range: 66, cooldown: 90 }),
      atk({ name: "Shard Burst", anim: "roar", windup: 40, active: 4, recovery: 40, damage: 14, knockback: 90, parryable: false, range: 200, cooldown: 240, special: "bladestorm", projectile: { count: 8, spread: Math.PI * 2, speed: 240, range: 240, radius: 8 } }),
    ],
    xp: 70,
    loot: "f3construct",
    look: { rig: "construct", scale: 1.7, skin: "#2a2630", cloth: "#16141a", trim: "#ff8a3a", weapon: "hammer", glow: "#ff7a2a" },
  },
  {
    key: "drake",
    name: "Drake",
    behavior: "melee",
    hp: 110,
    poise: 50,
    flinches: false,
    armor: 0.1,
    speed: 150,
    radius: 16,
    aggroRange: 260,
    leashRange: 620,
    preferred: [50, 90],
    attacks: [
      atk({ name: "Drake Bite", anim: "bite", windup: 22, active: 6, recovery: 26, damage: 18, knockback: 110, lunge: 24, shape: arc(40, 100), parryable: true, range: 60, cooldown: 60, weight: 2 }),
      atk({ name: "Tail Lash", anim: "tail", windup: 26, active: 8, recovery: 28, damage: 16, knockback: 150, shape: circle(50), parryable: true, range: 56, cooldown: 110 }),
      atk({ name: "Fire Spit", anim: "breath", windup: 28, active: 2, recovery: 28, damage: 12, knockback: 60, parryable: true, range: 300, minRange: 80, cooldown: 160, projectile: { count: 3, spread: 0.35, speed: 300, range: 320, radius: 9 } }),
      atk({ name: "Wing Dive", anim: "dive", windup: 34, active: 8, recovery: 34, damage: 22, knockback: 180, lunge: 150, shape: { kind: "line", length: 50, width: 34 }, parryable: false, heavy: true, ground: true, range: 200, minRange: 90, cooldown: 220 }),
    ],
    xp: 60,
    loot: "f3drake",
    look: { rig: "dragon", scale: 1.2, skin: "#b8402a", cloth: "#6a1e14", trim: "#ffd08a", weapon: "none", horns: true, glow: "#ffb347" },
  },
  // --- The red wyrm of Wyrmrest Caldera: wears the sigil that opens the Roost. ---------------
  {
    key: "cindermaw",
    name: "Cindermaw, the Red Wyrm",
    behavior: "boss",
    hp: 1250,
    poise: 999,
    flinches: false,
    armor: 0.2,
    speed: 120,
    radius: 30,
    aggroRange: 380,
    leashRange: 1400,
    preferred: [70, 130],
    minions: ["drake", "ashling"],
    attacks: [
      atk({ name: "Rending Bite", anim: "bite", windup: 26, active: 6, recovery: 24, damage: 26, knockback: 150, lunge: 30, shape: arc(70, 110), parryable: true, range: 90, cooldown: 60, weight: 3 }),
      atk({ name: "Tail Sweep", anim: "tail", windup: 34, active: 8, recovery: 30, damage: 24, knockback: 200, shape: circle(96), parryable: false, heavy: true, ground: true, range: 110, cooldown: 150 }),
      atk({ name: "Fire Breath", anim: "breath", windup: 44, active: 26, recovery: 34, damage: 30, knockback: 150, shape: arc(210, 55), parryable: false, heavy: true, ground: true, range: 230, cooldown: 220, weight: 2 }),
      atk({ name: "Wing Buffet", anim: "wing", windup: 30, active: 6, recovery: 30, damage: 12, knockback: 300, shape: circle(120), parryable: false, ground: true, range: 140, cooldown: 260 }),
      atk({ name: "Sky Dive", anim: "dive", windup: 50, active: 10, recovery: 40, damage: 34, knockback: 240, lunge: 260, shape: { kind: "line", length: 70, width: 60 }, parryable: false, heavy: true, ground: true, range: 360, minRange: 120, cooldown: 300 }),
      atk({ name: "Ember Rain", anim: "roar", windup: 60, active: 6, recovery: 30, damage: 24, knockback: 150, shape: circle(48), parryable: false, ground: true, range: 380, cooldown: 320, special: "sigils", phase: 1 }),
      atk({ name: "Call the Brood", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 380, cooldown: 900, special: "summon", phase: 1 }),
    ],
    xp: 2600,
    loot: "cindermaw",
    look: { rig: "dragon", scale: 2.3, skin: "#c8321e", cloth: "#5a120c", trim: "#ffcf7a", weapon: "none", horns: true, glow: "#ffd08a" },
    boss: { title: "Cindermaw, the Red Wyrm", phases: [0.5], posture: 280, music: "miniboss" },
  },
  // --- The Dragon's Roost ----------------------------------------------------------------------
  {
    key: "vyrmak",
    name: "Vyrmak the Dragonsworn",
    behavior: "boss",
    hp: 1600,
    poise: 999,
    flinches: false,
    armor: 0.25,
    speed: 132,
    radius: 16,
    aggroRange: 420,
    leashRange: 1600,
    preferred: [50, 90],
    minions: ["ashling", "flamecaller"],
    attacks: [
      atk({ name: "Dragonfang Cleave", anim: "bigSlashR", windup: 28, active: 6, recovery: 12, damage: 28, knockback: 160, lunge: 24, shape: arc(80, 160), parryable: true, range: 90, cooldown: 55, chain: 1, weight: 3 }),
      atk({ name: "Rising Flame", anim: "thrust", windup: 18, active: 6, recovery: 30, damage: 26, knockback: 180, lunge: 40, shape: { kind: "line", length: 100, width: 30 }, parryable: true, range: 110, cooldown: 55, weight: 0 }),
      atk({ name: "Leaping Inferno", anim: "leap", windup: 42, active: 8, recovery: 36, damage: 34, knockback: 240, lunge: 200, shape: circle(70), parryable: false, heavy: true, ground: true, range: 240, minRange: 100, cooldown: 240 }),
      atk({ name: "Scorched Earth", anim: "channel", windup: 60, active: 6, recovery: 30, damage: 22, knockback: 150, shape: circle(50), parryable: false, ground: true, range: 400, cooldown: 300, special: "sigils", phase: 1 }),
      atk({ name: "Dragon's Oath", anim: "spin", windup: 44, active: 24, recovery: 40, damage: 14, knockback: 100, parryable: false, range: 360, cooldown: 380, special: "bladestorm", phase: 1, projectile: { count: 12, spread: Math.PI * 2, speed: 220, range: 400, radius: 9 } }),
    ],
    xp: 2400,
    loot: "vyrmak",
    look: { rig: "humanoid", scale: 1.9, skin: "#3a2a2a", cloth: "#6a1a14", trim: "#ffb347", weapon: "greatsword", horns: true, glow: "#ff8a3a" },
    boss: { title: "Vyrmak the Dragonsworn", phases: [0.5], posture: 240, music: "miniboss" },
  },
  {
    key: "ignivar",
    name: "Ignivar, Tyrant of the Ember Sky",
    behavior: "boss",
    hp: 4200,
    poise: 999,
    flinches: false,
    armor: 0.28,
    speed: 124,
    radius: 44,
    aggroRange: 520,
    leashRange: 2400,
    preferred: [90, 150],
    minions: ["drake", "ashling"],
    attacks: [
      // Phase 1 — learn the tyrant's reach.
      atk({ name: "Tyrant's Bite", anim: "bite", windup: 28, active: 6, recovery: 26, damage: 32, knockback: 170, lunge: 36, shape: arc(100, 110), parryable: true, range: 120, cooldown: 60, weight: 3 }),
      atk({ name: "Tail Crush", anim: "tail", windup: 36, active: 8, recovery: 30, damage: 30, knockback: 240, shape: circle(130), parryable: false, heavy: true, ground: true, range: 150, cooldown: 140 }),
      atk({ name: "Dragonfire", anim: "breath", windup: 50, active: 30, recovery: 36, damage: 34, knockback: 170, shape: arc(300, 55), parryable: false, heavy: true, ground: true, range: 320, cooldown: 240, weight: 2 }),
      atk({ name: "Wing Tempest", anim: "wing", windup: 34, active: 6, recovery: 32, damage: 14, knockback: 340, shape: circle(160), parryable: false, ground: true, range: 180, cooldown: 280 }),
      // Phase 2 — the sky burns.
      atk({ name: "Meteor Rain", anim: "roar", windup: 64, active: 6, recovery: 30, damage: 30, knockback: 170, shape: circle(56), parryable: false, ground: true, range: 480, cooldown: 300, special: "sigils", phase: 1 }),
      atk({ name: "Skyfall Dive", anim: "dive", windup: 56, active: 10, recovery: 44, damage: 40, knockback: 280, lunge: 320, shape: { kind: "line", length: 90, width: 80 }, parryable: false, heavy: true, ground: true, range: 460, minRange: 150, cooldown: 300, phase: 1 }),
      atk({ name: "Molten Roar", anim: "roar", windup: 46, active: 26, recovery: 40, damage: 16, knockback: 110, parryable: false, range: 440, cooldown: 360, special: "bladestorm", phase: 1, projectile: { count: 20, spread: Math.PI * 2, speed: 230, range: 500, radius: 10 } }),
      // Phase 3 — the tyrant unbound. Run from the Inferno; the brood comes to keep you close.
      atk({ name: "Sweeping Flame", anim: "breath", windup: 46, active: 30, recovery: 36, damage: 30, knockback: 160, shape: arc(280, 140), parryable: false, heavy: true, ground: true, range: 300, cooldown: 260, phase: 2 }),
      atk({ name: "Inferno", anim: "roar", windup: 84, active: 8, recovery: 50, damage: 50, knockback: 300, shape: circle(170), parryable: false, heavy: true, ground: true, range: 200, cooldown: 420, phase: 2 }),
      atk({ name: "Call the Brood", anim: "roar", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 480, cooldown: 900, special: "summon", phase: 2 }),
    ],
    xp: 4200,
    loot: "ignivar",
    look: { rig: "dragon", scale: 3.3, skin: "#2a1a1e", cloth: "#7a1410", trim: "#ffb347", weapon: "none", horns: true, glow: "#ffcf5a" },
    boss: { title: "Ignivar, Tyrant of the Ember Sky", phases: [0.66, 0.33], posture: 340, music: "boss" },
  },
];

// ---------------------------------------------------------------------------
// Items

const FLOOR3_ITEMS: ItemBase[] = [
  { key: "mat_cinder", name: "Cinderstone", kind: "material", stack: 20, value: 12, tier: 4, desc: "Still warm, and it always will be. The Dragonforge burns it instead of coal." },
  { key: "mat_dragonscale", name: "Dragonscale", kind: "material", stack: 20, value: 16, tier: 4, desc: "A drake's scale, harder than steel and lighter than bone." },
  { key: "mat_emberheart", name: "Ember Heart", kind: "material", stack: 20, value: 40, tier: 5, desc: "The glowing core of a dragon's fire. Rare, and it knows it." },
  { key: "key_roost", name: "Emberwyrm Sigil", kind: "key", value: 0, tier: 4, bound: true, desc: "Cindermaw wore this sigil in its crest. It fits the doors of the Dragon's Roost." },
  { key: "art_dragonheart", name: "Heart of Ignivar", kind: "artifact", value: 0, tier: 5, bound: true, desc: "It still beats. Slowly. Somewhere above, something older is listening to it." },
  { key: "map_floor3", name: "Map of the Ember Reaches", kind: "key", value: 0, tier: 4, bound: true, desc: "A scorched chart of Floor 3. Buying it lets you open the map (M) up here." },
  // The Dragonscale set (tier 5). The Dragonforge upgrades it with Floor 3 materials.
  { key: "sword_dragon", name: "Dragonfang", kind: "weapon", weapon: "sword", art: "sword_dragon", power: 184, value: 760, tier: 5, desc: "A blade ground from a drake's fang. It is warm to hold and warmer to be cut by." },
  { key: "greatsword_dragon", name: "Wyrmbreaker", kind: "weapon", weapon: "greatsword", art: "gs_dragon", power: 196, value: 820, tier: 5, desc: "Forged to kill dragons, from the dragons it killed." },
  { key: "daggers_dragon", name: "Emberclaws", kind: "weapon", weapon: "daggers", art: "dg_dragon", power: 180, value: 740, tier: 5, desc: "Two curved claws, still edged with ember. They hiss in the rain." },
  { key: "spear_dragon", name: "Dragonspine Lance", kind: "weapon", weapon: "spear", art: "sp_dragon", power: 188, value: 780, tier: 5, desc: "A lance of fused vertebrae tipped with a glowing fang." },
  { key: "staff_dragon", name: "Cinderheart Staff", kind: "weapon", weapon: "staff", art: "st_dragon", power: 184, value: 780, tier: 5, desc: "An ember heart caged in black horn. Spells come out of it breathing." },
  { key: "armor_dragon", name: "Dragonscale Plate", kind: "armor", defense: 64, hp: 40, stamina: -6, look: 22, value: 900, tier: 5, desc: "Red scale over black plate. Fire slides off it like rain." },
  { key: "armor_drakehide", name: "Drakehide Leathers", kind: "armor", defense: 46, hp: 22, stamina: 12, look: 23, value: 820, tier: 5, desc: "Supple drake leather and a cape of wing membrane. Fast, and hard to burn." },
  { key: "armor_emberweave", name: "Emberweave Robes", kind: "armor", defense: 30, hp: 54, stamina: 14, look: 24, value: 800, tier: 5, desc: "Black silk shot through with living ember. It never quite stops smouldering." },
  { key: "helm_dragon", name: "Dragon Helm", kind: "helm", defense: 26, hp: 24, look: 16, value: 640, tier: 5, desc: "A drake's skull, horns and all, worn as a helm." },
  { key: "helm_embercirclet", name: "Ember Circlet", kind: "helm", defense: 14, hp: 38, stamina: 8, look: 17, value: 660, tier: 5, desc: "A band of black iron holding a single ember that never goes out." },
  // Ignivar's legendaries: once in a very long while.
  { key: "sword_ignivar", name: "Ignivar's Fang", kind: "weapon", weapon: "sword", art: "sword_dragon", power: 212, rarity: 4, value: 2400, tier: 5, bound: false, desc: "The tyrant's own tooth, hilted in gold. Legends are cut with it." },
  { key: "armor_ignivar", name: "Tyrant's Mantle", kind: "armor", defense: 74, hp: 64, stamina: -4, look: 22, rarity: 4, value: 2600, tier: 5, desc: "Ignivar's crest-scales over dragonbone. It remembers flying." },
];

/** Floor 3's own gear: the Dragonscale set. */
const DRAGON_GEAR = ["sword_dragon", "greatsword_dragon", "daggers_dragon", "spear_dragon", "staff_dragon", "armor_dragon", "armor_drakehide", "armor_emberweave", "helm_dragon", "helm_embercirclet"];
/** Floor 2's set still drops up here, more often than on its home floor. */
const SKY_GEAR = [
  "sword_storm", "greatsword_storm", "daggers_storm", "spear_storm", "staff_storm", "armor_gilded", "armor_skyguard", "armor_stormweave", "helm_winged", "helm_stormcrown",
  "greatsword_gilded", "daggers_gilded", "spear_sun", "staff_sun", "armor_sunforged", "armor_mystic", "helm_suncrown",
];

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  for (const d of FLOOR3_ENEMIES) if (!ENEMIES.some((e) => e.key === d.key)) ENEMIES.push(d);
  for (const it of FLOOR3_ITEMS) if (!ITEMS.some((i) => i.key === it.key)) ITEMS.push(it);
  const DRAGON = DRAGON_GEAR.map((key) => ({ key, w: 1 }));
  const SKY = SKY_GEAR.map((key) => ({ key, w: 1 }));
  const tonic = [{ key: "tonic", w: 1 }];
  Object.assign(LOOT, {
    f3beast: { gold: [4, 9], rolls: [{ chance: 0.4, pool: [{ key: "mat_cinder", w: 1 }] }, { chance: 0.08, pool: tonic }, { chance: 0.03, pool: SKY }, { chance: 0.01, pool: DRAGON }] },
    f3caster: { gold: [10, 20], rolls: [{ chance: 0.45, pool: [{ key: "mat_cinder", w: 1 }] }, { chance: 0.1, pool: tonic }, { chance: 0.04, pool: SKY, boost: 0.2 }, { chance: 0.015, pool: DRAGON }] },
    f3soldier: { gold: [12, 22], rolls: [{ chance: 0.4, pool: [{ key: "mat_cinder", w: 1 }] }, { chance: 0.12, pool: tonic }, { chance: 0.05, pool: SKY }, { chance: 0.018, pool: DRAGON }] },
    f3construct: { gold: [20, 36], rolls: [{ chance: 0.9, pool: [{ key: "mat_cinder", w: 1 }], qty: [1, 2] }, { chance: 0.05, pool: [{ key: "mat_emberheart", w: 1 }] }, { chance: 0.08, pool: SKY, boost: 0.3 }, { chance: 0.03, pool: DRAGON, boost: 0.2 }] },
    f3drake: { gold: [18, 30], rolls: [{ chance: 0.7, pool: [{ key: "mat_dragonscale", w: 1 }], qty: [1, 2] }, { chance: 0.06, pool: [{ key: "mat_emberheart", w: 1 }] }, { chance: 0.04, pool: DRAGON, boost: 0.2 }] },
    cindermaw: {
      gold: [300, 420],
      guaranteed: [{ key: "key_roost", once: true }],
      rolls: [
        { chance: 1, pool: DRAGON, boost: 0.6, minRarity: 1 },
        { chance: 1, pool: [{ key: "mat_dragonscale", w: 1 }], qty: [3, 5] },
        { chance: 0.5, pool: [{ key: "mat_emberheart", w: 1 }] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    vyrmak: {
      gold: [360, 480],
      rolls: [
        { chance: 1, pool: DRAGON, boost: 0.8, minRarity: 1 },
        { chance: 1, pool: [{ key: "mat_cinder", w: 1 }], qty: [3, 5] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    ignivar: {
      gold: [900, 1200],
      guaranteed: [{ key: "art_dragonheart", once: true }],
      rolls: [
        { chance: 1, pool: DRAGON, boost: 1.3, minRarity: 2 },
        { chance: 0.4, pool: DRAGON, boost: 0.8, minRarity: 1 },
        { chance: 0.015, pool: [{ key: "sword_ignivar", w: 1 }] },
        { chance: 0.015, pool: [{ key: "armor_ignivar", w: 1 }] },
        { chance: 1, pool: [{ key: "mat_emberheart", w: 1 }], qty: [1, 2] },
        { chance: 1, pool: [{ key: "mat_dragonscale", w: 1 }], qty: [4, 6] },
      ],
    },
  });
  Object.assign(SHOPS, {
    store3: priceGear([
      { key: "map_floor3", price: 90 },
      { key: "tonic", price: 26 },
      { key: "armor_drakehide", price: 820 },
      { key: "armor_emberweave", price: 800 },
      { key: "armor_dragon", price: 900 },
      { key: "helm_dragon", price: 640 },
      { key: "helm_embercirclet", price: 660 },
    ]),
    smith3: priceGear([
      { key: "sword_dragon", price: 880 },
      { key: "greatsword_dragon", price: 960 },
      { key: "daggers_dragon", price: 860 },
      { key: "spear_dragon", price: 900 },
      { key: "staff_dragon", price: 900 },
    ]),
  });
}
register();

export { FLOOR3_ENEMIES, DRAGON_GEAR };
