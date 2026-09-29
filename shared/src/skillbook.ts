import { UNIVERSAL_BASE, UNIVERSAL_SKILLS, WEAPONS, type MoveDef, type WeaponKey } from "./combat/weapons.ts";
import { ITEMS } from "./items/items.ts";
import { SHOPS } from "./items/loot.ts";
import { masteryDamage, masteryLevel, masteryMods, PERK_CHOICES } from "./progression.ts";
import { Mod } from "./sim/player.ts";

/**
 * The skill book. Skills are learned by reading skill scrolls, which come from missions,
 * quests, the Archivists' shops (for Gold and Marks) and, rarely, from enemies. Every skill
 * has a rarity: the better the skill, the harder its scroll is to find.
 *   - Weapon skills: usable only with their weapon type.
 *   - Universal skills: usable with every weapon.
 *   - Passives: always on once learned.
 * Two skills are equipped per weapon type. A weapon's combo heavy, finisher and passives
 * come from mastering that weapon (see masteryUnlocks).
 */

export type SkillKind = "skill" | "passive";

export interface SkillEntry {
  id: string;
  name: string;
  desc: string;
  kind: SkillKind;
  /** Weapon skills: the weapon type that can use it. Universal skills and passives have none. */
  weapon?: WeaponKey;
  /** Loadout index (weapon skill index, or UNIVERSAL_BASE + n). */
  index?: number;
  rarity: number;
  /** The scroll item that teaches it. */
  scroll: string;
  /** Floor abilities: the floor whose Archivist sells it and whose enemies carry it. */
  floor?: number;
  /** Ordinary skills: the floor whose Archivist sells it (its enemies and those above drop it too). */
  from: number;
  move?: MoveDef;
}

/** Rarity by a weapon's skill index: its first skills are common, its last legendary. */
const WEAPON_RARITY = [0, 1, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
/** Where a weapon's skills are first found, by skill index (Floors 4 and up add two per weapon). */
const WEAPON_FROM = [1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8];
/** Where ordinary skills of each rarity are sold, unless listed in FROM. */
const FROM_BY_RARITY = [1, 1, 2, 3, 3];
const FROM: Record<string, number> = { frostblood: 4, glacialHide: 4, umbralTouch: 5, nightveil: 5, stormcaller: 6, tidalGrace: 6, siegebreaker: 7, clockworkHeart: 7, sunstrike: 8, oasisHeart: 8 };
const UNIVERSAL_RARITY: Record<string, number> = {
  "any.kick": 0, "any.knife": 0, "any.secondwind": 1, "any.warcry": 1, "any.blink": 1, "any.ironwill": 2, "any.fireball": 2, "any.winter": 2,
  "any.thunder": 2, "any.bloodrage": 3, "any.star": 3, "any.storm": 3, "any.sunburst": 3, "any.wyrmwrath": 4, "any.phoenix": 4,
  "any.hatchets": 0, "any.snare": 1, "any.howl": 1, "any.gale": 1, "any.windwall": 2, "any.drakeblood": 3, "any.eruption": 3,
  "any.icelance": 1, "any.prison": 2, "any.hailstorm": 3, "any.absolutezero": 4,
  "any.shadowbolt": 1, "any.siphon": 2, "any.voidrift": 3, "any.eclipse": 4,
  "any.tidalwave": 1, "any.riptide": 2, "any.whirlpool": 3, "any.leviathan": 4,
  "any.shrapnel": 1, "any.overclock": 2, "any.steamvent": 3, "any.titanfist": 4,
  "any.sunbolt": 1, "any.carapace": 2, "any.sandstorm": 3, "any.sunfall": 4,
};

/**
 * Floor abilities: every floor has arts of its own, sold only by its Archivist and carried
 * only by its enemies — Emberwatch's trappers and bandits, the storms of the Terraces, the
 * fire of the Ember Reaches.
 */
export const FLOOR_OF: Record<string, number> = {
  "any.hatchets": 1, "any.snare": 1, "any.howl": 1, "any.sunburst": 1,
  "any.gale": 2, "any.windwall": 2, "any.thunder": 2, "any.storm": 2,
  "any.fireball": 3, "any.drakeblood": 3, "any.eruption": 3, "any.wyrmwrath": 3, "any.phoenix": 3,
  "any.icelance": 4, "any.prison": 4, "any.hailstorm": 4, "any.absolutezero": 4,
  "any.shadowbolt": 5, "any.siphon": 5, "any.voidrift": 5, "any.eclipse": 5,
  "any.tidalwave": 6, "any.riptide": 6, "any.whirlpool": 6, "any.leviathan": 6,
  "any.shrapnel": 7, "any.overclock": 7, "any.steamvent": 7, "any.titanfist": 7,
  "any.sunbolt": 8, "any.carapace": 8, "any.sandstorm": 8, "any.sunfall": 8,
};
export const FLOOR_NAMES = ["", "Emberwatch", "the Gilded Terraces", "the Ember Reaches", "the Frostvale", "the Umbral Wilds", "the Drowned Isles", "the Clockwork Heights", "the Sunscorched Sands"];
const PASSIVE_RARITY: Record<string, number> = {
  fleetfoot: 0, deepLungs: 0, secondWind: 1, ironSkin: 1, wardensGrace: 1, riposteMaster: 2, keenEye: 2, executioner: 2, momentum: 2,
  scaleguard: 2, lastStand: 2, unbroken: 3, emberblood: 3, wyrmsbane: 3, frostblood: 3, glacialHide: 2, umbralTouch: 3, nightveil: 3, stormcaller: 3, tidalGrace: 3, siegebreaker: 3, clockworkHeart: 3, sunstrike: 3, oasisHeart: 3,
};

export const scrollKey = (id: string) => `scroll_${id.replace(/\./g, "_")}`;

export const SKILLBOOK: SkillEntry[] = [
  ...WEAPONS.flatMap((w) =>
    w.skills.map((m, i): SkillEntry => ({ id: m.id!, name: m.name, desc: m.desc ?? "", kind: "skill", weapon: w.key, index: i, rarity: WEAPON_RARITY[i] ?? 2, from: WEAPON_FROM[i] ?? 3, scroll: scrollKey(m.id!), move: m })),
  ),
  ...UNIVERSAL_SKILLS.map((m, i): SkillEntry => ({ id: m.id!, name: m.name, desc: m.desc ?? "", kind: "skill", index: UNIVERSAL_BASE + i, rarity: UNIVERSAL_RARITY[m.id!] ?? 2, from: FROM[m.id!] ?? FROM_BY_RARITY[UNIVERSAL_RARITY[m.id!] ?? 2], scroll: scrollKey(m.id!), move: m, floor: FLOOR_OF[m.id!] })),
  ...PERK_CHOICES.flatMap((c) => c.options).map((p): SkillEntry => ({ id: p.id, name: p.name, desc: p.desc, kind: "passive", rarity: PASSIVE_RARITY[p.id] ?? 2, from: FROM[p.id] ?? FROM_BY_RARITY[PASSIVE_RARITY[p.id] ?? 2], scroll: scrollKey(p.id) })),
];

const BY_ID = new Map(SKILLBOOK.map((e) => [e.id, e]));
const BY_SCROLL = new Map(SKILLBOOK.map((e) => [e.scroll, e]));
export const skillEntry = (id: string) => BY_ID.get(id);
/** The skill a scroll item teaches. */
export const scrollSkill = (itemKey: string) => BY_SCROLL.get(itemKey);

// Every skill has a scroll.
const SCROLL_VALUE = [20, 45, 90, 180, 350];
const KIND_NAME = (e: SkillEntry) => (e.kind === "passive" ? "a passive skill" : e.weapon ? `a ${WEAPONS.find((w) => w.key === e.weapon)!.name.toLowerCase()} skill` : "a skill for every weapon");
for (const e of SKILLBOOK) {
  if (ITEMS.some((i) => i.key === e.scroll)) continue;
  ITEMS.push({ key: e.scroll, name: `Scroll: ${e.name}`, kind: "scroll", rarity: e.rarity, stack: 5, value: SCROLL_VALUE[e.rarity], tier: e.rarity + 1, skill: e.id, desc: `Read it to learn ${e.name}, ${KIND_NAME(e)}. ${e.desc}` });
}

/** Can this skill go in a slot while wielding `wk`? */
export const usableWith = (e: SkillEntry, wk: WeaponKey) => e.kind === "skill" && (!e.weapon || e.weapon === wk);

/** Loadout indices of the known skills usable with a weapon type. */
export function knownIndices(wk: WeaponKey, known: readonly string[]): number[] {
  const out: number[] = [];
  for (const id of known) {
    const e = BY_ID.get(id);
    if (e && usableWith(e, wk)) out.push(e.index!);
  }
  return out;
}

/** Simulation flags: the weapon's mastery, and passives that change how you move. */
export function skillMods(wk: WeaponKey, known: readonly string[], mastery: number): number {
  let m = masteryMods(wk, mastery);
  if (known.includes("fleetfoot")) m |= Mod.LongDodge;
  if (known.includes("keenEye")) m |= Mod.WideParry;
  return m;
}

/** +3% damage per mastery level above 1 (up to +27% at 10). */
export const weaponMasteryDamage = (level: number) => 1 + (Math.max(1, level) - 1) * 0.03;
export const itemMasteryLevel = (mxp: number | undefined) => masteryLevel(mxp ?? 0);

/** Damage multipliers from the weapon in hand: its mastery, and the passives mastery unlocks. */
export function combatBonus(wk: WeaponKey, mastery: number) {
  const m = masteryDamage(wk, mastery);
  return { ...m, dmg: m.dmg * weaponMasteryDamage(mastery) };
}

// ---------------------------------------------------------------------------
// Where scrolls come from.

/** What a scroll costs at an Archivist, by rarity (legendaries are never sold). */
export const SCROLL_PRICE = [
  { gold: 80, marks: 2 },
  { gold: 240, marks: 5 },
  { gold: 650, marks: 10 },
  { gold: 1600, marks: 22 },
];

/** How players learn where to look, by rarity. */
export const SCROLL_SOURCES = [
  "Sold by the Archivist in Emberwatch (Floor 1). Missions and enemies drop it too.",
  "Sold by the Archivist in Emberwatch (Floor 1). Elites and bosses drop it.",
  "Sold by the Archivist on Floor 2. Elites and bosses drop it, rarely.",
  "Sold by the Archivist on Floor 3. Bosses drop it, rarely.",
  "Never sold. Only Floor Bosses carry it, and seldom.",
];

/** Where to find a particular skill's scroll. */
export function scrollSource(e: SkillEntry) {
  if (e.floor && e.rarity < 4) return `A floor ability of ${FLOOR_NAMES[e.floor]}: sold only by the Archivist on Floor ${e.floor}, and carried only by its enemies.`;
  if (e.floor) return `A floor ability of ${FLOOR_NAMES[e.floor]}, never sold: only Floor ${e.floor}'s greatest foes carry it.`;
  return SCROLL_SOURCES[e.rarity];
}

/** An Archivist's stock: the ordinary scrolls first found on this floor, then the floor's own abilities. */
export function scrollShop(floor: number): { key: string; price: number; marks: number }[] {
  return SKILLBOOK.filter((e) => (e.floor ? e.floor === floor : e.from === floor) && e.rarity < SCROLL_PRICE.length)
    .sort((a, b) => (a.floor ? 1 : 0) - (b.floor ? 1 : 0) || a.rarity - b.rarity || (a.kind === b.kind ? 0 : a.kind === "skill" ? -1 : 1) || (a.weapon ?? "~").localeCompare(b.weapon ?? "~"))
    .sort((a, b) => a.rarity - b.rarity || (a.kind === b.kind ? 0 : a.kind === "skill" ? -1 : 1) || (a.weapon ?? "~").localeCompare(b.weapon ?? "~"))
    .map((e) => ({ key: e.scroll, price: SCROLL_PRICE[e.rarity].gold, marks: SCROLL_PRICE[e.rarity].marks }));
}

// The Archivists: Floor 1 sells common and uncommon scrolls, Floor 2 rare, Floor 3 and up epic.
for (let f = 1; f < FLOOR_NAMES.length; f++) SHOPS[`scrolls${f}`] = scrollShop(f);

/** The floor an enemy of this level belongs to. */
const floorOfLevel = (level: number) => (level <= 8 ? 1 : level <= 12 ? 2 : level <= 16 ? 3 : level <= 20 ? 4 : level <= 24 ? 5 : level <= 28 ? 6 : level <= 32 ? 7 : 8);

/**
 * A scroll dropped by a kill, if any. Ordinary enemies almost never carry one; elites
 * sometimes, minibosses often, Floor Bosses usually. The best a kill can drop rises with
 * its floor, and legendaries come only from Floor Bosses (`legendary` is that chance).
 */
export function rollScroll(level: number, kind: "normal" | "elite" | "mini" | "boss", legendary = 0, rnd: () => number = Math.random): string | undefined {
  const chance = { normal: 0.004, elite: 0.03, mini: 0.3, boss: 0.6 }[kind];
  if (rnd() > chance) return undefined;
  const floor = floorOfLevel(level);
  let rarity: number;
  if (kind === "boss" && rnd() < legendary) rarity = 4;
  else {
    const top = Math.min(3, floor + (kind === "boss" || kind === "mini" ? 1 : 0));
    const low = kind === "boss" ? Math.min(top, floor) : kind === "mini" ? 1 : 0;
    const weights = [60, 28, 10, 2].map((w, r) => (r >= low && r <= top ? w : 0));
    let x = rnd() * weights.reduce((a, b) => a + b, 0);
    rarity = weights.findIndex((w) => (x -= w) < 0);
    if (rarity < 0) rarity = low;
  }
  // A third of the time, the floor's own abilities (when it has one of that rarity).
  if (rnd() < 0.35) {
    const own = SKILLBOOK.filter((e) => e.floor === floor && e.rarity === rarity);
    if (own.length) return own[Math.floor(rnd() * own.length)].scroll;
  }
  return randomScroll(rarity, rnd, floor);
}

/** Any scroll of this rarity found on this floor (floor abilities only from their own floor). */
export function randomScroll(rarity: number, rnd: () => number = Math.random, floor = 99): string | undefined {
  const pool = SKILLBOOK.filter((e) => e.rarity === rarity && (e.floor ? e.floor === floor : e.from <= floor));
  return pool[Math.floor(rnd() * pool.length)]?.scroll;
}
