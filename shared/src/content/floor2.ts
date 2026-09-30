/**
 * Floor 2 content — the Gilded Terraces: enemies, materials, loot tables and shops.
 * Registered into the shared tables when this module loads (it is exported from the
 * package index, so client and server register identically). Appending keeps every
 * existing enemy index stable.
 */
import type { Shape } from "../combat/shapes.ts";
import { ENEMIES, type EnemyAttack, type EnemyDef } from "../enemies/defs.ts";
import { ITEMS, type ItemBase } from "../items/items.ts";
import { LOOT, priceGear, SHOPS } from "../items/loot.ts";

const deg = (d: number) => (d * Math.PI) / 180;
const atk = (a: Omit<EnemyAttack, "weight"> & { weight?: number }): EnemyAttack => ({ weight: 1, ...a });
const arc = (range: number, a: number): Shape => ({ kind: "arc", range, arc: deg(a) });

// ---------------------------------------------------------------------------
// Enemies

const FLOOR2_ENEMIES: EnemyDef[] = [
  {
    key: "skylynx",
    name: "Sky Lynx",
    behavior: "pack",
    hp: 44,
    poise: 24,
    flinches: true,
    armor: 0,
    speed: 192,
    radius: 10,
    aggroRange: 210,
    leashRange: 560,
    preferred: [60, 100],
    attacks: [
      atk({ name: "Rake", anim: "bite", windup: 18, active: 5, recovery: 24, damage: 9, knockback: 70, lunge: 34, shape: arc(28, 110), parryable: true, range: 48, cooldown: 46 }),
      atk({ name: "Skyleap", anim: "pounce", windup: 30, active: 8, recovery: 34, damage: 14, knockback: 130, lunge: 136, shape: arc(26, 120), parryable: true, range: 150, minRange: 70, cooldown: 140 }),
    ],
    xp: 18,
    loot: "f2beast",
    look: { rig: "wolf", scale: 1.05, skin: "#d8b060", cloth: "#9a7434", trim: "#fff0c8", weapon: "none", glow: "#9fe0ff" },
  },
  {
    key: "skyguard",
    name: "Skyguard Lancer",
    behavior: "melee",
    hp: 72,
    poise: 34,
    flinches: false,
    armor: 0.08,
    speed: 112,
    radius: 11,
    aggroRange: 220,
    leashRange: 560,
    preferred: [50, 80],
    attacks: [
      atk({ name: "Lance Thrust", anim: "thrust", windup: 22, active: 5, recovery: 26, damage: 14, knockback: 110, lunge: 20, shape: { kind: "line", length: 72, width: 18 }, parryable: true, range: 74, cooldown: 60, weight: 2 }),
      atk({ name: "Sky Sweep", anim: "sweep", windup: 32, active: 7, recovery: 30, damage: 16, knockback: 160, shape: { kind: "arc", range: 66, arc: deg(220), inner: 14 }, parryable: true, range: 62, cooldown: 150 }),
      atk({ name: "Diving Lunge", anim: "thrust", windup: 34, active: 8, recovery: 34, damage: 20, knockback: 170, lunge: 120, shape: { kind: "line", length: 50, width: 26 }, parryable: false, heavy: true, range: 170, minRange: 90, cooldown: 240 }),
    ],
    xp: 30,
    loot: "f2soldier",
    look: { rig: "humanoid", scale: 1, skin: "#e0c8a8", cloth: "#3f6a8a", trim: "#f0c860", weapon: "spear" },
  },
  {
    key: "aegis",
    name: "Gilded Aegis",
    behavior: "defender",
    hp: 112,
    poise: 55,
    flinches: false,
    armor: 0.2,
    speed: 86,
    radius: 12,
    aggroRange: 200,
    leashRange: 520,
    preferred: [36, 60],
    attacks: [
      atk({ name: "Gilded Chop", anim: "slashR", windup: 24, active: 5, recovery: 28, damage: 16, knockback: 100, lunge: 18, shape: arc(46, 130), parryable: true, range: 50, cooldown: 70, weight: 2, chain: 1 }),
      atk({ name: "Riposte Cut", anim: "slashL", windup: 14, active: 5, recovery: 30, damage: 14, knockback: 110, lunge: 12, shape: arc(46, 130), parryable: true, range: 50, cooldown: 70, weight: 0 }),
      atk({ name: "Shield Rush", anim: "charge", windup: 30, active: 12, recovery: 32, damage: 18, knockback: 220, lunge: 110, shape: { kind: "line", length: 36, width: 30 }, parryable: false, heavy: true, range: 150, minRange: 60, cooldown: 220 }),
    ],
    xp: 36,
    loot: "f2soldier",
    look: { rig: "humanoid", scale: 1.08, skin: "#d8c39a", cloth: "#c9a24a", trim: "#fff4c8", weapon: "shield", shield: true },
  },
  {
    key: "windcaller",
    name: "Windcaller",
    behavior: "ranged",
    hp: 50,
    poise: 20,
    flinches: true,
    armor: 0,
    speed: 104,
    radius: 10,
    aggroRange: 260,
    leashRange: 560,
    preferred: [170, 240],
    attacks: [
      atk({ name: "Wind Arrow", anim: "shoot", windup: 26, active: 1, recovery: 22, damage: 12, knockback: 80, parryable: true, range: 280, minRange: 60, cooldown: 60, weight: 3, projectile: { count: 1, spread: 0, speed: 330, range: 360, radius: 6 } }),
      atk({ name: "Gale Volley", anim: "shoot", windup: 40, active: 1, recovery: 30, damage: 9, knockback: 70, parryable: true, range: 260, minRange: 80, cooldown: 220, projectile: { count: 3, spread: 0.4, speed: 300, range: 330, radius: 6 } }),
      atk({ name: "Gust", anim: "roar", windup: 22, active: 4, recovery: 26, damage: 8, knockback: 260, shape: { kind: "circle", radius: 56, offset: 0 }, parryable: false, ground: true, range: 60, cooldown: 260 }),
    ],
    xp: 28,
    loot: "f2caster",
    look: { rig: "humanoid", scale: 1, skin: "#e8d4b4", cloth: "#5f8a6a", trim: "#e8e0c0", weapon: "bow", hood: true },
  },
  {
    key: "stormadept",
    name: "Storm Adept",
    behavior: "caster",
    hp: 62,
    poise: 22,
    flinches: true,
    armor: 0,
    speed: 98,
    radius: 10,
    aggroRange: 250,
    leashRange: 560,
    preferred: [150, 220],
    attacks: [
      atk({ name: "Spark Bolt", anim: "cast", windup: 26, active: 1, recovery: 24, damage: 13, knockback: 80, parryable: true, range: 270, minRange: 50, cooldown: 70, weight: 2, projectile: { count: 1, spread: 0, speed: 290, range: 340, radius: 8 } }),
      atk({ name: "Thunderstrike", anim: "channel", windup: 54, active: 6, recovery: 28, damage: 22, knockback: 140, shape: { kind: "circle", radius: 44, offset: 0 }, parryable: false, ground: true, targeted: true, heavy: true, range: 250, cooldown: 220 }),
      atk({ name: "Blink", anim: "vanish", windup: 14, active: 1, recovery: 16, damage: 0, knockback: 0, parryable: false, range: 70, cooldown: 320, special: "blink" }),
    ],
    xp: 34,
    loot: "f2caster",
    look: { rig: "humanoid", scale: 1, skin: "#c9d4e8", cloth: "#2e3f6a", trim: "#9fd3ff", weapon: "staff", hood: true, glow: "#bfe0ff" },
  },
  {
    key: "sentinel",
    name: "Gilded Sentinel",
    behavior: "brute",
    hp: 170,
    poise: 95,
    flinches: false,
    armor: 0.25,
    speed: 68,
    radius: 16,
    aggroRange: 190,
    leashRange: 480,
    preferred: [40, 70],
    attacks: [
      atk({ name: "Gilded Swipe", anim: "slashR", windup: 30, active: 6, recovery: 30, damage: 20, knockback: 150, lunge: 16, shape: arc(54, 150), parryable: true, range: 58, cooldown: 80, weight: 2 }),
      atk({ name: "Hammerfall", anim: "overhead", windup: 46, active: 6, recovery: 40, damage: 32, knockback: 220, shape: { kind: "circle", radius: 46, offset: 40 }, parryable: false, heavy: true, ground: true, range: 70, cooldown: 180 }),
      atk({ name: "Tremor", anim: "roar", windup: 58, active: 6, recovery: 40, damage: 24, knockback: 240, shape: { kind: "circle", radius: 76, offset: 0 }, parryable: false, heavy: true, ground: true, range: 64, cooldown: 360 }),
    ],
    xp: 60,
    loot: "f2construct",
    look: { rig: "construct", scale: 1.35, skin: "#d9b25a", cloth: "#b8903a", trim: "#fff0a0", weapon: "hammer", glow: "#fff0a0" },
  },
  {
    key: "colossus",
    name: "Storm Colossus",
    behavior: "boss",
    hp: 900,
    poise: 400,
    flinches: false,
    armor: 0.2,
    speed: 74,
    radius: 22,
    aggroRange: 240,
    leashRange: 520,
    preferred: [50, 90],
    minions: ["stormadept", "skylynx"],
    attacks: [
      atk({ name: "Crushing Sweep", anim: "sweep", windup: 34, active: 7, recovery: 32, damage: 24, knockback: 180, shape: { kind: "arc", range: 86, arc: deg(200), inner: 16 }, parryable: true, range: 84, cooldown: 90, weight: 2 }),
      atk({ name: "Thunder Slam", anim: "overhead", windup: 48, active: 6, recovery: 40, damage: 34, knockback: 240, shape: { kind: "circle", radius: 56, offset: 46 }, parryable: false, heavy: true, ground: true, range: 96, cooldown: 160 }),
      atk({ name: "Storm Ring", anim: "roar", windup: 40, active: 4, recovery: 36, damage: 14, knockback: 90, parryable: false, range: 240, cooldown: 300, special: "bladestorm", projectile: { count: 12, spread: Math.PI * 2, speed: 210, range: 300, radius: 9 } }),
      atk({ name: "Call the Storm", anim: "channel", windup: 36, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 300, cooldown: 900, special: "summon", phase: 1 }),
      atk({ name: "Tempest Stomp", anim: "roar", windup: 52, active: 6, recovery: 36, damage: 28, knockback: 260, shape: { kind: "circle", radius: 96, offset: 0 }, parryable: false, heavy: true, ground: true, range: 90, cooldown: 280, phase: 1 }),
    ],
    xp: 520,
    loot: "colossus",
    look: { rig: "construct", scale: 1.8, skin: "#9fb4c8", cloth: "#4a5a78", trim: "#bfe0ff", weapon: "hammer", glow: "#bfe0ff" },
    boss: { title: "Storm Colossus", phases: [0.5], posture: 260, music: "miniboss" },
  },
  // --- The Stormspire ---------------------------------------------------------------------
  {
    key: "stormwarden",
    name: "Kael, the Stormwarden",
    behavior: "boss",
    hp: 1500,
    poise: 999,
    flinches: false,
    armor: 0.2,
    speed: 132,
    radius: 16,
    aggroRange: 380,
    leashRange: 2000,
    preferred: [50, 90],
    attacks: [
      atk({ name: "Lance Rush", anim: "thrust", windup: 24, active: 5, recovery: 12, damage: 20, knockback: 140, lunge: 30, shape: { kind: "line", length: 92, width: 22 }, parryable: true, range: 96, cooldown: 60, chain: 1, weight: 3 }),
      atk({ name: "Lance Rush", anim: "thrust", windup: 14, active: 5, recovery: 14, damage: 20, knockback: 140, lunge: 30, shape: { kind: "line", length: 92, width: 22 }, parryable: true, range: 96, cooldown: 60, chain: 2, weight: 0 }),
      atk({ name: "Rising Gale", anim: "sweep", windup: 30, active: 7, recovery: 36, damage: 24, knockback: 200, shape: { kind: "arc", range: 82, arc: deg(230), inner: 14 }, parryable: true, range: 96, cooldown: 60, weight: 0 }),
      atk({ name: "Storm Charge", anim: "charge", windup: 38, active: 20, recovery: 40, damage: 26, knockback: 240, lunge: 280, shape: { kind: "line", length: 44, width: 34 }, parryable: false, heavy: true, ground: true, range: 320, minRange: 120, cooldown: 240 }),
      atk({ name: "Thunderstrike", anim: "channel", windup: 50, active: 6, recovery: 30, damage: 26, knockback: 160, shape: { kind: "circle", radius: 52, offset: 0 }, parryable: false, ground: true, targeted: true, heavy: true, range: 360, cooldown: 200 }),
      atk({ name: "Chain Lightning", anim: "cast", windup: 34, active: 1, recovery: 30, damage: 14, knockback: 90, parryable: true, range: 360, cooldown: 240, phase: 1, projectile: { count: 5, spread: 0.8, speed: 300, range: 400, radius: 9 } }),
      atk({ name: "Static Field", anim: "roar", windup: 44, active: 20, recovery: 36, damage: 14, knockback: 90, parryable: false, range: 360, cooldown: 360, special: "bladestorm", phase: 1, projectile: { count: 10, spread: Math.PI * 2, speed: 200, range: 380, radius: 9 } }),
    ],
    xp: 1200,
    loot: "stormwarden",
    look: { rig: "humanoid", scale: 1.5, skin: "#e0d4c0", cloth: "#2e3f6a", trim: "#bfe0ff", weapon: "spear", glow: "#bfe0ff" },
    boss: { title: "Kael, the Stormwarden", phases: [0.5], posture: 220, music: "miniboss" },
  },
  {
    key: "vaelra",
    name: "Vaelra, Keeper of the Storm",
    behavior: "boss",
    hp: 3400,
    poise: 999,
    flinches: false,
    armor: 0.25,
    speed: 126,
    radius: 20,
    aggroRange: 460,
    leashRange: 2000,
    preferred: [60, 110],
    minions: ["windcaller", "stormadept"],
    attacks: [
      // Phase 1 — learn her spear. The third thrust is held: parrying early is punished.
      atk({ name: "Tempest Thrust", anim: "thrust", windup: 26, active: 6, recovery: 10, damage: 22, knockback: 150, lunge: 40, shape: { kind: "line", length: 112, width: 26 }, parryable: true, range: 120, cooldown: 55, chain: 1, weight: 3 }),
      atk({ name: "Tempest Return", anim: "sweep", windup: 16, active: 7, recovery: 12, damage: 20, knockback: 160, shape: { kind: "arc", range: 88, arc: deg(200), inner: 12 }, parryable: true, range: 100, cooldown: 55, chain: 2, weight: 0 }),
      atk({ name: "Eye of the Spear", anim: "thrust", windup: 52, active: 6, recovery: 44, damage: 32, knockback: 230, lunge: 60, shape: { kind: "line", length: 130, width: 30 }, parryable: true, heavy: true, range: 140, cooldown: 55, weight: 0 }),
      atk({ name: "Chain Lightning", anim: "cast", windup: 30, active: 1, recovery: 30, damage: 16, knockback: 100, parryable: true, range: 420, minRange: 90, cooldown: 150, weight: 2, projectile: { count: 3, spread: 0.45, speed: 330, range: 440, radius: 9 } }),
      atk({ name: "Stormcall", anim: "channel", windup: 48, active: 6, recovery: 30, damage: 28, knockback: 180, shape: { kind: "circle", radius: 56, offset: 0 }, parryable: false, heavy: true, ground: true, targeted: true, range: 420, cooldown: 200 }),
      // Phase 2 — the storm answers her.
      atk({ name: "Thunderfall", anim: "channel", windup: 64, active: 6, recovery: 30, damage: 26, knockback: 170, shape: { kind: "circle", radius: 54, offset: 0 }, parryable: false, ground: true, range: 460, cooldown: 320, special: "sigils", phase: 1 }),
      atk({ name: "Eye of the Storm", anim: "spin", windup: 44, active: 30, recovery: 40, damage: 15, knockback: 100, parryable: false, range: 420, cooldown: 380, special: "bladestorm", phase: 1, projectile: { count: 16, spread: Math.PI * 2, speed: 220, range: 460, radius: 9 } }),
      // Phase 3 — the tempest. Run from the Maelstrom; she calls the winds to keep you close.
      atk({ name: "Maelstrom", anim: "roar", windup: 80, active: 8, recovery: 50, damage: 44, knockback: 280, shape: { kind: "circle", radius: 132, offset: 0 }, parryable: false, heavy: true, ground: true, range: 160, cooldown: 420, phase: 2 }),
      atk({ name: "Call the Winds", anim: "channel", windup: 40, active: 2, recovery: 30, damage: 0, knockback: 0, parryable: false, range: 460, cooldown: 900, special: "summon", phase: 2 }),
    ],
    xp: 3200,
    loot: "vaelra",
    look: { rig: "humanoid", scale: 2.1, skin: "#eef4ff", cloth: "#3a4f8a", trim: "#bfe0ff", weapon: "spear", glow: "#dff4ff" },
    boss: { title: "Vaelra, Keeper of the Storm", phases: [0.66, 0.33], posture: 300, music: "boss" },
  },
];

// ---------------------------------------------------------------------------
// Items

const FLOOR2_ITEMS: ItemBase[] = [
  { key: "mat_feather", name: "Galefeather", kind: "material", stack: 20, value: 6, tier: 3, desc: "Light as a thought. Fletchers on Floor 2 pay well for them." },
  { key: "mat_stormglass", name: "Stormglass", kind: "material", stack: 20, value: 9, tier: 3, desc: "Glass struck from lightning. It hums when the wind rises." },
  { key: "mat_gilded", name: "Gilded Plate", kind: "material", stack: 20, value: 10, tier: 3, desc: "Plating from the Terraces' ancient guardians. The Smith can work it." },
  { key: "key_stormspire", name: "Stormspire Seal", kind: "key", value: 0, tier: 3, bound: true, desc: "Torn from the Storm Colossus. It fits the great door of the Stormspire." },
  { key: "art_stormheart", name: "Heart of the Storm", kind: "artifact", value: 0, tier: 4, bound: true, desc: "Vaelra's heart, still crackling. Somewhere above, a stair is listening for it." },
  { key: "map_floor2", name: "Map of the Gilded Terraces", kind: "key", value: 0, tier: 3, bound: true, desc: "A cartographer's chart of Floor 2. Buying it lets you open the map (M) up here." },
  // The Stormglass set: Floor 2's own gear (tier 4). The Skysmith upgrades it with Floor 2 materials.
  { key: "sword_storm", name: "Stormglass Blade", kind: "weapon", weapon: "sword", art: "sword_storm", power: 160, value: 520, tier: 4, desc: "A blade of glass struck by lightning and cooled in cloud. A bolt still runs down its heart." },
  { key: "greatsword_storm", name: "Thunderhewn Greatblade", kind: "weapon", weapon: "greatsword", art: "gs_storm", power: 172, value: 560, tier: 4, desc: "Too heavy to be glass, too bright to be steel. Every swing sounds like distant thunder." },
  { key: "daggers_storm", name: "Galecutter Knives", kind: "weapon", weapon: "daggers", art: "dg_storm", power: 158, value: 500, tier: 4, desc: "Two slivers of stormglass, light as galefeathers. The wind seems to push them forward." },
  { key: "spear_storm", name: "Skyguard Lance", kind: "weapon", weapon: "spear", art: "sp_storm", power: 164, value: 540, tier: 4, desc: "The long lance of the old Skyguard: a gilded haft and a glass head that never dulls." },
  { key: "staff_storm", name: "Stormcaller's Rod", kind: "weapon", weapon: "staff", art: "st_storm", power: 160, value: 540, tier: 4, desc: "A stormglass orb in gilded talons. On quiet days you can hear it crackle." },
  { key: "armor_gilded", name: "Gilded Aegis Plate", kind: "armor", defense: 50, hp: 26, stamina: -5, look: 13, value: 600, tier: 4, desc: "The golden plate of the Terraces' guardians, refitted for a climber. Heavy, bright, and very hard to hurt." },
  { key: "armor_skyguard", name: "Skyguard Harness", kind: "armor", defense: 40, hp: 18, stamina: 6, look: 14, value: 540, tier: 4, desc: "Blue coat, steel plates and a sky-blue cape: what the Skyguard wore to hold the bridges." },
  { key: "armor_stormweave", name: "Stormweave Robes", kind: "armor", defense: 22, hp: 36, stamina: 10, look: 15, value: 520, tier: 4, desc: "Cloth woven with stormglass thread. It hums against the skin and turns aside what it can." },
  { key: "helm_winged", name: "Winged Helm", kind: "helm", defense: 20, hp: 14, stamina: 4, look: 11, value: 420, tier: 4, desc: "A gilded helm with galefeather wings. Skyguard captains wore them so the troops could find them." },
  { key: "greatsword_gilded", name: "Gilded Colossus Blade", kind: "weapon", weapon: "greatsword", art: "gs_gilded", power: 178, value: 620, tier: 4, desc: "Cut from a fallen guardian's own sword. Two hands, and all your weight behind them." },
  { key: "daggers_gilded", name: "Gilded Fangs", kind: "weapon", weapon: "daggers", art: "dg_gilded", power: 162, value: 540, tier: 4, desc: "Gold over stormglass: the Terraces' old guardians paid their spies well." },
  { key: "spear_sun", name: "Sunpiercer", kind: "weapon", weapon: "spear", art: "sp_sun", power: 168, value: 580, tier: 4, desc: "A flame-shaped head of gilded steel. At noon it throws its own shadow." },
  { key: "staff_sun", name: "Sunfire Staff", kind: "weapon", weapon: "staff", art: "st_sun", power: 166, value: 580, tier: 4, desc: "A sun disc held in gilded rays. It is always a little warm." },
  { key: "armor_sunforged", name: "Sunforged Plate", kind: "armor", defense: 56, hp: 32, stamina: -6, look: 20, value: 700, tier: 4, desc: "White-gold plate and a sun-bright cape. The heaviest armour on the Terraces." },
  { key: "armor_mystic", name: "Mystic Vestments", kind: "armor", defense: 26, hp: 44, stamina: 12, look: 21, value: 620, tier: 4, desc: "Teal silk stitched with gold runes that shift when you aren't looking." },
  { key: "helm_suncrown", name: "Sun Crown", kind: "helm", defense: 18, hp: 30, stamina: 6, look: 15, value: 520, tier: 4, desc: "A circlet of gilded rays. It makes its wearer hard to look at." },
  { key: "helm_stormcrown", name: "Storm Diadem", kind: "helm", defense: 11, hp: 28, stamina: 6, look: 12, value: 440, tier: 4, desc: "A thin gold band holding three splinters of stormglass. Storm adepts wear them to hear the weather think." },
];

/** Floor 2's own gear: the Stormglass set. */
const SKY_GEAR = [
  "sword_storm", "greatsword_storm", "daggers_storm", "spear_storm", "staff_storm", "armor_gilded", "armor_skyguard", "armor_stormweave", "helm_winged", "helm_stormcrown",
  "greatsword_gilded", "daggers_gilded", "spear_sun", "staff_sun", "armor_sunforged", "armor_mystic", "helm_suncrown",
];

// ---------------------------------------------------------------------------
// Loot and shops

/** The best gear in the game so far: everything tier 3+ without a fixed rarity. */
const gearPool = (minTier: number) =>
  ITEMS.filter((i) => (i.kind === "weapon" || i.kind === "armor" || i.kind === "helm") && (i.tier ?? 1) >= minTier && !i.rarity && !SKY_GEAR.includes(i.key)).map((i) => ({ key: i.key, w: 1 }));

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  for (const d of FLOOR2_ENEMIES) if (!ENEMIES.some((e) => e.key === d.key)) ENEMIES.push(d);
  for (const it of FLOOR2_ITEMS) if (!ITEMS.some((i) => i.key === it.key)) ITEMS.push(it);
  const T3 = gearPool(3);
  const T2 = gearPool(2);
  const SKY = SKY_GEAR.map((key) => ({ key, w: 1 }));
  const tonic = [{ key: "tonic", w: 1 }];
  Object.assign(LOOT, {
    f2beast: { gold: [2, 6], rolls: [{ chance: 0.45, pool: [{ key: "mat_pelt", w: 2 }, { key: "mat_feather", w: 1 }] }, { chance: 0.07, pool: tonic }, { chance: 0.04, pool: T2 }] },
    f2soldier: { gold: [9, 18], rolls: [{ chance: 0.4, pool: [{ key: "mat_gilded", w: 1 }] }, { chance: 0.1, pool: tonic }, { chance: 0.06, pool: T3, boost: 0.3 }, { chance: 0.02, pool: SKY }] },
    f2caster: { gold: [8, 16], rolls: [{ chance: 0.45, pool: [{ key: "mat_stormglass", w: 2 }, { key: "mat_feather", w: 1 }] }, { chance: 0.1, pool: tonic }, { chance: 0.06, pool: T3, boost: 0.3 }, { chance: 0.02, pool: SKY }] },
    f2construct: { gold: [16, 30], rolls: [{ chance: 0.85, pool: [{ key: "mat_gilded", w: 1 }], qty: [1, 2] }, { chance: 0.3, pool: [{ key: "mat_stormglass", w: 1 }] }, { chance: 0.12, pool: T3, boost: 0.4 }, { chance: 0.05, pool: SKY, boost: 0.2 }] },
    stormwarden: {
      gold: [260, 360],
      rolls: [
        { chance: 1, pool: SKY, boost: 0.8, minRarity: 1 },
        { chance: 1, pool: [{ key: "mat_stormglass", w: 1 }], qty: [3, 5] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
    vaelra: {
      gold: [650, 900],
      guaranteed: [{ key: "art_stormheart", once: true }],
      rolls: [
        { chance: 1, pool: SKY, boost: 1.3, minRarity: 2 },
        { chance: 0.4, pool: SKY, boost: 0.8, minRarity: 1 },
        { chance: 1, pool: [{ key: "mat_stormglass", w: 1 }, { key: "mat_gilded", w: 1 }], qty: [4, 6] },
      ],
    },
    colossus: {
      gold: [200, 280],
      guaranteed: [{ key: "key_stormspire", once: true }],
      rolls: [
        { chance: 1, pool: [...T3, ...SKY], boost: 0.6, minRarity: 1 },
        { chance: 1, pool: [{ key: "mat_stormglass", w: 1 }], qty: [2, 4] },
        { chance: 1, pool: tonic, qty: [2, 3] },
      ],
    },
  });
  Object.assign(SHOPS, {
    store2: priceGear([
      { key: "map_floor2", price: 60 },
      { key: "tonic", price: 22 },
      // Floor 1's best for climbers who arrive short, then the Stormglass set.
      ...T3.filter((e) => ["armor_brigandine", "helm_greathelm"].includes(e.key)).map((e) => ({ key: e.key, price: 320 })),
      { key: "armor_skyguard", price: 640 },
      { key: "armor_stormweave", price: 620 },
      { key: "armor_gilded", price: 700 },
      { key: "helm_winged", price: 480 },
      { key: "helm_stormcrown", price: 500 },
      { key: "armor_mystic", price: 760 },
      { key: "armor_sunforged", price: 860 },
      { key: "helm_suncrown", price: 640 },
    ]),
    smith2: priceGear([
      { key: "sword_storm", price: 640 },
      { key: "greatsword_storm", price: 700 },
      { key: "daggers_storm", price: 620 },
      { key: "spear_storm", price: 660 },
      { key: "staff_storm", price: 660 },
      { key: "greatsword_gilded", price: 780 },
      { key: "daggers_gilded", price: 700 },
      { key: "spear_sun", price: 740 },
      { key: "staff_sun", price: 740 },
    ]),
  });
}
register();

export { FLOOR2_ENEMIES };
