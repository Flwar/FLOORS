import { isEquipment, itemBase, ITEMS, Rarity, type Item } from "./items.ts";

interface PoolEntry {
  key: string;
  w: number;
}

interface LootRoll {
  chance: number;
  pool: PoolEntry[];
  qty?: [number, number];
  /** Shift the rarity roll upward (0 = normal, 1 = +1 tier on average…). */
  boost?: number;
  minRarity?: number;
}

export interface LootTable {
  gold: [number, number];
  rolls: LootRoll[];
  /** Always dropped (per killer), e.g. quest keys. `once` skips it if the killer already owns one. */
  guaranteed?: { key: string; once?: boolean }[];
}

const T1_GEAR: PoolEntry[] = [
  { key: "sword_rusty", w: 3 }, { key: "greatsword_iron", w: 2 }, { key: "daggers_twin", w: 2 }, { key: "spear_hunting", w: 2 }, { key: "staff_oak", w: 2 },
  { key: "armor_padded", w: 3 }, { key: "armor_leather", w: 2 }, { key: "helm_cap", w: 3 }, { key: "helm_hood", w: 2 }, { key: "helm_bandana", w: 2 },
  { key: "charm_wolf", w: 1 }, { key: "charm_amber", w: 1 },
  { key: "sword_bronze", w: 2 }, { key: "daggers_bone", w: 2 }, { key: "armor_hide", w: 2 },
];
const T2_GEAR: PoolEntry[] = [
  { key: "sword_iron", w: 3 }, { key: "greatsword_bandit", w: 2 }, { key: "daggers_stalker", w: 2 }, { key: "spear_iron", w: 2 }, { key: "staff_ember", w: 2 },
  { key: "armor_chain", w: 2 }, { key: "armor_ranger", w: 1.5 }, { key: "helm_iron", w: 2 }, { key: "helm_horned", w: 1 }, { key: "charm_duelist", w: 0.6 }, { key: "charm_feather", w: 0.6 }, { key: "charm_gale", w: 0.5 },
  { key: "sword_steel", w: 1.5 }, { key: "greatsword_zwei", w: 1.2 }, { key: "daggers_kris", w: 1.2 }, { key: "staff_frost", w: 1.2 },
  { key: "armor_scale", w: 1.5 }, { key: "helm_kettle", w: 1.5 }, { key: "helm_wizard", w: 1 },
  { key: "sword_falchion", w: 1.5 }, { key: "greatsword_bone", w: 1.2 }, { key: "spear_partisan", w: 1.2 }, { key: "staff_bone", w: 1.2 }, { key: "armor_ring", w: 1.5 }, { key: "helm_coif", w: 1.5 },
];
/** The best of what Floor 1 hides: elites, bosses and the ruins drop these. */
const T3_GEAR: PoolEntry[] = [
  { key: "sword_knight", w: 2 }, { key: "greatsword_exec", w: 1.5 }, { key: "spear_glaive", w: 1.5 }, { key: "armor_brigandine", w: 1.5 }, { key: "helm_greathelm", w: 1.5 },
  { key: "sword_royal", w: 1 }, { key: "greatsword_moon", w: 1 }, { key: "daggers_duelist", w: 1.2 }, { key: "spear_halberd", w: 1 }, { key: "staff_crystal", w: 1.2 },
  { key: "armor_templar", w: 1 }, { key: "armor_windrunner", w: 1 }, { key: "helm_templar", w: 1 },
  { key: "sword_frost", w: 0.15 }, { key: "daggers_night", w: 0.15 }, { key: "spear_trident", w: 0.15 }, { key: "staff_moon", w: 0.15 }, { key: "armor_shadow", w: 0.3 }, { key: "armor_arcanist", w: 0.3 },
];
const TONIC: PoolEntry[] = [{ key: "tonic", w: 1 }];

export const LOOT: Record<string, LootTable> = {
  none: { gold: [0, 0], rolls: [] },
  beast: { gold: [0, 1], rolls: [{ chance: 0.55, pool: [{ key: "mat_pelt", w: 1 }] }, { chance: 0.05, pool: TONIC }, { chance: 0.035, pool: T1_GEAR }] },
  goblin: { gold: [2, 6], rolls: [{ chance: 0.3, pool: [{ key: "mat_scrap", w: 1 }] }, { chance: 0.08, pool: TONIC }, { chance: 0.06, pool: T1_GEAR }] },
  bandit: { gold: [4, 10], rolls: [{ chance: 0.35, pool: [{ key: "mat_scrap", w: 1 }] }, { chance: 0.1, pool: TONIC }, { chance: 0.07, pool: T1_GEAR }, { chance: 0.03, pool: T2_GEAR }] },
  brute: { gold: [8, 16], rolls: [{ chance: 0.7, pool: [{ key: "mat_scrap", w: 1 }], qty: [1, 3] }, { chance: 0.25, pool: [{ key: "mat_shard", w: 1 }] }, { chance: 0.14, pool: T2_GEAR }] },
  cultist: { gold: [5, 11], rolls: [{ chance: 0.5, pool: [{ key: "mat_cloth", w: 1 }] }, { chance: 0.03, pool: [{ key: "art_idol", w: 1 }] }, { chance: 0.07, pool: [{ key: "staff_oak", w: 2 }, { key: "staff_ember", w: 1 }, { key: "helm_hood", w: 2 }, { key: "armor_robes", w: 1.5 }, { key: "staff_frost", w: 1 }, { key: "helm_wizard", w: 1 }] }, { chance: 0.012, pool: [{ key: "armor_arcanist", w: 1 }, { key: "staff_moon", w: 1 }] }] },
  ruins: { gold: [6, 12], rolls: [{ chance: 0.3, pool: [{ key: "mat_shard", w: 1 }] }, { chance: 0.02, pool: [{ key: "art_lens", w: 1 }] }, { chance: 0.09, pool: [{ key: "daggers_stalker", w: 2 }, ...T2_GEAR] }, { chance: 0.02, pool: T3_GEAR }] },
  elite: { gold: [14, 28], rolls: [{ chance: 0.65, pool: [...T1_GEAR, ...T2_GEAR], boost: 0.25 }, { chance: 0.03, pool: T3_GEAR }, { chance: 0.4, pool: [{ key: "mat_shard", w: 1 }] }, { chance: 0.3, pool: TONIC }] },
  grakk: {
    gold: [70, 100],
    guaranteed: [{ key: "key_ruins", once: true }],
    rolls: [
      { chance: 1, pool: T2_GEAR, boost: 0.7, minRarity: Rarity.Uncommon },
      { chance: 0.04, pool: [{ key: "sword_emberbrand", w: 1 }] },
      { chance: 0.25, pool: [{ key: "helm_horned", w: 1 }], minRarity: Rarity.Uncommon },
      { chance: 0.2, pool: T3_GEAR },
      { chance: 1, pool: TONIC, qty: [1, 2] },
    ],
  },
  warden: {
    gold: [90, 130],
    rolls: [
      { chance: 1, pool: T2_GEAR, boost: 0.8, minRarity: Rarity.Uncommon },
      { chance: 0.03, pool: [{ key: "greatsword_warden", w: 1 }] },
      { chance: 0.03, pool: [{ key: "helm_circlet", w: 1 }, { key: "charm_secondwind", w: 1 }] },
      { chance: 0.025, pool: [{ key: "armor_warden", w: 1 }] },
      { chance: 0.3, pool: T3_GEAR, boost: 0.4 },
      { chance: 1, pool: [{ key: "mat_shard", w: 1 }], qty: [2, 4] },
    ],
  },
  aurelion: {
    gold: [260, 400],
    guaranteed: [{ key: "art_gatestone", once: true }],
    rolls: [
      { chance: 1, pool: [...T2_GEAR, { key: "armor_plate", w: 3 }], boost: 1.0, minRarity: Rarity.Rare },
      { chance: 0.015, pool: [{ key: "sword_dawnbreaker", w: 1 }] },
      { chance: 0.08, pool: [{ key: "helm_circlet", w: 1 }, { key: "charm_secondwind", w: 1 }] },
      { chance: 0.015, pool: [{ key: "armor_dawn", w: 1 }, { key: "helm_keeper", w: 1 }] },
      { chance: 0.5, pool: T3_GEAR, boost: 0.8, minRarity: Rarity.Uncommon },
      { chance: 1, pool: [{ key: "mat_ember", w: 1 }], qty: [1, 2] },
    ],
  },
};

/**
 * Base odds of each rarity (common, uncommon, rare, epic, legendary). Epic and legendary
 * are meant to be events: about 1 in 80 and 1 in 600 of ordinary drops.
 */
const RARITY_WEIGHTS = [66, 26, 6.6, 1.25, 0.17];

export function rollRarity(boost = 0, min = 0, rnd = Math.random): number {
  // Boost moves weight from common tiers into higher ones.
  const w = RARITY_WEIGHTS.map((x, i) => x * Math.pow(1 + boost, i));
  const total = w.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  let out = 0;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) {
      out = i;
      break;
    }
  }
  return Math.max(min, out);
}

function pick(pool: PoolEntry[], rnd: () => number) {
  const total = pool.reduce((a, b) => a + b.w, 0);
  let r = rnd() * total;
  for (const e of pool) {
    r -= e.w;
    if (r <= 0) return e.key;
  }
  return pool[pool.length - 1].key;
}

let uidCounter = 0;
export function newUid() {
  uidCounter = (uidCounter + 1) % 1e6;
  return `${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Create an item instance with rarity bonuses. */
export function makeItem(key: string, rarity?: number, qty = 1, rnd = Math.random): Item {
  const b = itemBase(key)!;
  const equip = b.kind === "weapon" || b.kind === "armor" || b.kind === "helm" || b.kind === "charm";
  const r = b.rarity ?? (equip ? rarity ?? 0 : 0);
  const bonus: Item["bonus"] = {};
  if (equip && r > 0) {
    const mag = [0, 0.06, 0.12, 0.2, 0.3][r];
    if (b.kind === "weapon") bonus.atk = Math.round((b.power ?? 100) * mag);
    if (b.kind === "armor" || b.kind === "helm") bonus.defense = Math.round(((b.defense ?? 4) + 4) * mag * 2);
    const extra = r >= 2 ? (rnd() < 0.5 ? "hp" : "stamina") : undefined;
    if (extra === "hp") bonus.hp = Math.round(6 * r);
    if (extra === "stamina") bonus.stamina = Math.round(3 * r);
  }
  return { uid: newUid(), key, rarity: r, qty: Math.max(1, Math.min(qty, b.stack ?? 1)), plus: 0, bonus };
}

export interface RolledDrop {
  gold: number;
  items: Item[];
}

export function rollLoot(tableKey: string, opts: { elite?: boolean; owns?: (key: string) => boolean; rnd?: () => number } = {}): RolledDrop {
  const rnd = opts.rnd ?? Math.random;
  const table = LOOT[tableKey] ?? LOOT.none;
  const items: Item[] = [];
  const [g0, g1] = table.gold;
  let gold = g0 + Math.floor(rnd() * (g1 - g0 + 1));
  for (const g of table.guaranteed ?? []) {
    if (g.once && opts.owns?.(g.key)) continue;
    items.push(makeItem(g.key, undefined, 1, rnd));
  }
  const rolls = [...table.rolls, ...(opts.elite && tableKey !== "elite" ? LOOT.elite.rolls : [])];
  if (opts.elite) gold = Math.round(gold * 2 + 8);
  for (const roll of rolls) {
    // Chance rolls for equipment land less often: good gear is meant to be earned.
    const gearRoll = roll.chance < 1 && roll.pool.some((e) => isEquipment(itemBase(e.key) ?? ({} as never)));
    if (rnd() > roll.chance * (gearRoll ? GEAR_DROP : 1)) continue;
    const key = pick(roll.pool, rnd);
    const b = itemBase(key);
    if (!b) continue;
    const [q0, q1] = roll.qty ?? [1, 1];
    const qty = q0 + Math.floor(rnd() * (q1 - q0 + 1));
    items.push(makeItem(key, rollRarity(roll.boost ?? 0, roll.minRarity ?? 0, rnd), qty, rnd));
  }
  return { gold, items };
}

/** How often a chance roll for equipment succeeds, relative to its table (harder progression). */
export const GEAR_DROP = 0.65;
/** Shop prices for equipment, relative to what the tables say. */
export const GEAR_PRICE = 1.3;

/** Raise the equipment prices in a shop list (maps, tonics and materials keep theirs). */
export function priceGear<T extends { key: string; price: number }>(list: T[]): T[] {
  for (const e of list) {
    const b = itemBase(e.key);
    if (b && isEquipment(b)) e.price = Math.round((e.price * GEAR_PRICE) / 5) * 5;
  }
  return list;
}

/** Shop stock for the General Store and the Blacksmith. */
export const SHOPS: Record<string, { key: string; price: number; rarity?: number; /** Also costs this many Marks (skill scrolls). */ marks?: number }[]> = {
  store: [
    { key: "map_floor1", price: 35 },
    { key: "tonic", price: 18 },
    { key: "armor_padded", price: 14 },
    { key: "armor_hide", price: 30 },
    { key: "helm_cap", price: 16 },
    { key: "armor_leather", price: 55 },
    { key: "helm_hood", price: 45 },
    { key: "armor_ranger", price: 190 },
    { key: "helm_bandana", price: 30 },
    { key: "helm_wizard", price: 170 },
    { key: "charm_wolf", price: 80 },
  ],
  smith: [
    { key: "sword_rusty", price: 16 },
    { key: "greatsword_iron", price: 50 },
    { key: "daggers_twin", price: 40 },
    { key: "spear_hunting", price: 38 },
    { key: "staff_oak", price: 34 },
    { key: "armor_chain", price: 150 },
    { key: "helm_iron", price: 120 },
    { key: "helm_coif", price: 95 },
    { key: "sword_bronze", price: 42 },
    { key: "daggers_bone", price: 34 },
    { key: "armor_ring", price: 160 },
    { key: "armor_plate", price: 420 },
    { key: "sword_steel", price: 260 },
    { key: "greatsword_zwei", price: 290 },
    { key: "helm_kettle", price: 210 },
    { key: "armor_scale", price: 280 },
  ],
};

priceGear(SHOPS.store);
priceGear(SHOPS.smith);
void ITEMS;
