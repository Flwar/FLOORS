import { itemBase, ITEMS, Rarity, type Item } from "./items.ts";

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
  { key: "armor_padded", w: 3 }, { key: "armor_leather", w: 2 }, { key: "helm_cap", w: 3 }, { key: "helm_hood", w: 2 },
  { key: "charm_wolf", w: 1 }, { key: "charm_amber", w: 1 },
];
const T2_GEAR: PoolEntry[] = [
  { key: "sword_iron", w: 3 }, { key: "greatsword_bandit", w: 2 }, { key: "daggers_stalker", w: 2 }, { key: "spear_iron", w: 2 }, { key: "staff_ember", w: 2 },
  { key: "armor_chain", w: 2 }, { key: "armor_ranger", w: 1.5 }, { key: "helm_iron", w: 2 }, { key: "helm_horned", w: 1 }, { key: "charm_duelist", w: 0.6 }, { key: "charm_feather", w: 0.6 }, { key: "charm_gale", w: 0.5 },
];
const TONIC: PoolEntry[] = [{ key: "tonic", w: 1 }];

export const LOOT: Record<string, LootTable> = {
  none: { gold: [0, 0], rolls: [] },
  beast: { gold: [0, 1], rolls: [{ chance: 0.55, pool: [{ key: "mat_pelt", w: 1 }] }, { chance: 0.05, pool: TONIC }, { chance: 0.035, pool: T1_GEAR }] },
  goblin: { gold: [2, 6], rolls: [{ chance: 0.3, pool: [{ key: "mat_scrap", w: 1 }] }, { chance: 0.08, pool: TONIC }, { chance: 0.06, pool: T1_GEAR }] },
  bandit: { gold: [4, 10], rolls: [{ chance: 0.35, pool: [{ key: "mat_scrap", w: 1 }] }, { chance: 0.1, pool: TONIC }, { chance: 0.07, pool: T1_GEAR }, { chance: 0.03, pool: T2_GEAR }] },
  brute: { gold: [8, 16], rolls: [{ chance: 0.7, pool: [{ key: "mat_scrap", w: 1 }], qty: [1, 3] }, { chance: 0.25, pool: [{ key: "mat_shard", w: 1 }] }, { chance: 0.14, pool: T2_GEAR }] },
  cultist: { gold: [5, 11], rolls: [{ chance: 0.5, pool: [{ key: "mat_cloth", w: 1 }] }, { chance: 0.03, pool: [{ key: "art_idol", w: 1 }] }, { chance: 0.07, pool: [{ key: "staff_oak", w: 2 }, { key: "staff_ember", w: 1 }, { key: "helm_hood", w: 2 }, { key: "armor_robes", w: 1.5 }] }] },
  ruins: { gold: [6, 12], rolls: [{ chance: 0.3, pool: [{ key: "mat_shard", w: 1 }] }, { chance: 0.02, pool: [{ key: "art_lens", w: 1 }] }, { chance: 0.09, pool: [{ key: "daggers_stalker", w: 2 }, ...T2_GEAR] }] },
  elite: { gold: [14, 28], rolls: [{ chance: 0.65, pool: [...T1_GEAR, ...T2_GEAR], boost: 1.2 }, { chance: 0.4, pool: [{ key: "mat_shard", w: 1 }] }, { chance: 0.3, pool: TONIC }] },
  grakk: {
    gold: [70, 100],
    guaranteed: [{ key: "key_ruins", once: true }],
    rolls: [
      { chance: 1, pool: T2_GEAR, boost: 1.5, minRarity: Rarity.Rare },
      { chance: 0.18, pool: [{ key: "sword_emberbrand", w: 1 }] },
      { chance: 0.35, pool: [{ key: "helm_horned", w: 1 }], minRarity: Rarity.Rare },
      { chance: 1, pool: TONIC, qty: [1, 2] },
    ],
  },
  warden: {
    gold: [90, 130],
    rolls: [
      { chance: 1, pool: T2_GEAR, boost: 2, minRarity: Rarity.Rare },
      { chance: 0.25, pool: [{ key: "greatsword_warden", w: 1 }] },
      { chance: 0.15, pool: [{ key: "helm_circlet", w: 1 }, { key: "charm_secondwind", w: 1 }] },
      { chance: 0.22, pool: [{ key: "armor_warden", w: 1 }] },
      { chance: 1, pool: [{ key: "mat_shard", w: 1 }], qty: [2, 4] },
    ],
  },
  aurelion: {
    gold: [260, 400],
    guaranteed: [{ key: "art_gatestone", once: true }],
    rolls: [
      { chance: 1, pool: [...T2_GEAR, { key: "armor_plate", w: 3 }], boost: 2.5, minRarity: Rarity.Epic },
      { chance: 0.3, pool: [{ key: "sword_dawnbreaker", w: 1 }] },
      { chance: 0.5, pool: [{ key: "helm_circlet", w: 1 }, { key: "charm_secondwind", w: 1 }] },
      { chance: 0.3, pool: [{ key: "armor_dawn", w: 1 }, { key: "helm_keeper", w: 1 }] },
      { chance: 1, pool: [{ key: "mat_ember", w: 1 }], qty: [1, 2] },
    ],
  },
};

const RARITY_WEIGHTS = [62, 26, 9, 2.5, 0.5];

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
  return { uid: newUid(), key, rarity: r, qty: Math.max(1, Math.min(qty, b.stack ?? 1)), plus: 0, dur: 100, bonus };
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
    if (rnd() > roll.chance) continue;
    const key = pick(roll.pool, rnd);
    const b = itemBase(key);
    if (!b) continue;
    const [q0, q1] = roll.qty ?? [1, 1];
    const qty = q0 + Math.floor(rnd() * (q1 - q0 + 1));
    items.push(makeItem(key, rollRarity(roll.boost ?? 0, roll.minRarity ?? 0, rnd), qty, rnd));
  }
  return { gold, items };
}

/** Shop stock for the General Store and the Blacksmith. */
export const SHOPS: Record<string, { key: string; price: number; rarity?: number }[]> = {
  store: [
    { key: "tonic", price: 18 },
    { key: "armor_padded", price: 14 },
    { key: "helm_cap", price: 16 },
    { key: "armor_leather", price: 55 },
    { key: "helm_hood", price: 45 },
    { key: "armor_ranger", price: 190 },
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
    { key: "armor_plate", price: 420 },
  ],
};

void ITEMS;
