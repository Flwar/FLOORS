import {
  baseHp, baseStamina, DEFAULT_WEAPON_ART, EQUIP_SLOTS, itemBase, itemStats, makeItem, masteryDamage, masteryLevel, masteryMods, MAX_LEVEL, Mod,
  perkById, PERK_CHOICES, WEAPON_ARTS, WEAPONS, xpToNext, type EquipSlot, type PlayerSettings, type Item, type ItemEffect, type WeaponKey,
} from "@floors/shared";
import type { Player } from "../state.ts";

export const INV_SIZE = 24;
export const BANK_SIZE = 48;

export interface QuestState {
  stage: number;
  progress: number;
  done?: boolean;
}

/** Everything persisted for a character. */
export interface CharacterData {
  version: 1;
  name: string;
  hue: number;
  level: number;
  xp: number;
  gold: number;
  bankGold: number;
  inventory: (Item | null)[];
  bank: (Item | null)[];
  equipment: Partial<Record<EquipSlot, Item>>;
  mastery: Partial<Record<WeaponKey, number>>;
  perks: string[];
  quests: Record<string, QuestState>;
  discovered: string[];
  bossKills: string[];
  /** Highest floor unlocked. */
  floor: number;
  pos?: { room: string; x: number; y: number; hp?: number };
  stats: { kills: number; deaths: number; parries: number; perfects: number; playMs: number };
  achievements: string[];
  /** Volumes, zoom and key bindings (sanitized), so they follow the player between machines. */
  settings?: PlayerSettings;
}

export function newCharacter(name: string): CharacterData {
  const c: CharacterData = {
    version: 1,
    name,
    hue: Math.floor(Math.random() * 360),
    level: 1,
    xp: 0,
    gold: 20,
    bankGold: 0,
    inventory: Array(INV_SIZE).fill(null),
    bank: Array(BANK_SIZE).fill(null),
    equipment: {},
    mastery: {},
    perks: [],
    quests: {},
    discovered: [],
    bossKills: [],
    floor: 1,
    stats: { kills: 0, deaths: 0, parries: 0, perfects: 0, playMs: 0 },
    achievements: [],
  };
  c.equipment.weapon = makeItem("sword_rusty", 0);
  c.equipment.armor = makeItem("armor_padded", 0);
  c.inventory[0] = makeItem("tonic", 0, 3);
  return c;
}

/** Derived combat numbers applied to the player each time gear/level/perks change. */
export interface Derived {
  atkMul: number;
  defense: number;
  hpMax: number;
  staminaMax: number;
  mods: number;
  effects: Set<ItemEffect>;
  weaponKey: WeaponKey;
  mastery: number;
  mdmg: ReturnType<typeof masteryDamage>;
}

/**
 * Server-authoritative character: every inventory change happens here, on the
 * server, with unique item ids — clients only ask.
 */
export class Character {
  derived!: Derived;
  dirty = true;
  unbrokenReadyAt = 0;

  constructor(public data: CharacterData, readonly accountId: number | null) {
    this.normalize();
    this.recompute();
  }

  private normalize() {
    const d = this.data;
    while (d.inventory.length < INV_SIZE) d.inventory.push(null);
    while (d.bank.length < BANK_SIZE) d.bank.push(null);
    d.quests ??= {};
    d.discovered ??= [];
    d.bossKills ??= [];
    d.stats ??= { kills: 0, deaths: 0, parries: 0, perfects: 0, playMs: 0 };
    d.achievements ??= [];
    if (!d.equipment.weapon) d.equipment.weapon = makeItem("sword_rusty", 0);
  }

  get weaponKey(): WeaponKey {
    return itemBase(this.data.equipment.weapon!.key)?.weapon ?? "sword";
  }

  hasPerk(id: string) {
    return this.data.perks.includes(id);
  }

  recompute() {
    const d = this.data;
    let power = 100;
    let defense = 0;
    let hp = 0;
    let stamina = 0;
    const effects = new Set<ItemEffect>();
    for (const slot of EQUIP_SLOTS) {
      const it = d.equipment[slot];
      if (!it) continue;
      const st = itemStats(it);
      if (slot === "weapon") power = st.power;
      defense += st.defense;
      hp += st.hp;
      stamina += st.stamina;
      const eff = itemBase(it.key)?.effect;
      if (eff) effects.add(eff);
    }
    const wk = this.weaponKey;
    const mlevel = masteryLevel(d.mastery[wk] ?? 0);
    let mods = masteryMods(wk, mlevel);
    for (const id of d.perks) mods |= perkById(id)?.mod ?? 0;
    if (effects.has("wideParry")) mods |= Mod.WideParry;
    if (effects.has("lightDodge")) mods |= Mod.LightDodge;
    if (effects.has("longDodge")) mods |= Mod.LongDodge;
    if (this.hasPerk("ironSkin")) defense += 12;
    if (this.hasPerk("deepLungs")) stamina += 15;
    let hpMax = baseHp(d.level) + hp;
    if (this.hasPerk("wardensGrace")) hpMax = Math.round(hpMax * 1.1);
    this.derived = {
      atkMul: (power / 100) * (1 + (d.level - 1) * 0.04),
      defense,
      hpMax: Math.round(hpMax),
      staminaMax: Math.max(60, Math.round(baseStamina(d.level) + stamina)),
      mods,
      effects,
      weaponKey: wk,
      mastery: mlevel,
      mdmg: masteryDamage(wk, mlevel),
    };
    this.dirty = true;
  }

  /** Push derived stats and visible gear onto the synced player. */
  applyTo(p: Player) {
    const d = this.data;
    const dv = this.derived;
    p.level = d.level;
    const ratio = p.hpMax ? p.hp / p.hpMax : 1;
    p.hpMax = dv.hpMax;
    p.hp = Math.min(dv.hpMax, Math.max(p.hp > 0 ? 1 : 0, Math.round(dv.hpMax * ratio)));
    p.staminaMax = dv.staminaMax;
    if (p.stamina > dv.staminaMax) p.stamina = dv.staminaMax;
    p.weapon = WEAPONS.findIndex((w) => w.key === dv.weaponKey);
    p.weaponRarity = d.equipment.weapon?.rarity ?? 0;
    const art = (d.equipment.weapon && itemBase(d.equipment.weapon.key)?.art) || DEFAULT_WEAPON_ART[dv.weaponKey];
    p.weaponLook = Math.max(0, WEAPON_ARTS.indexOf(art));
    p.mastered = dv.mastery >= 10;
    p.armorLook = d.equipment.armor ? itemBase(d.equipment.armor.key)?.look ?? 0 : 0;
    p.helmLook = d.equipment.helm ? itemBase(d.equipment.helm.key)?.look ?? 0 : 0;
    p.mods = dv.mods;
    p.potions = this.count("tonic");
  }

  // ---------------------------------------------------------------------------
  // Inventory

  count(key: string) {
    let n = 0;
    for (const it of this.data.inventory) if (it?.key === key) n += it.qty;
    return n;
  }

  findSlot(uid: string): number {
    return this.data.inventory.findIndex((it) => it?.uid === uid);
  }

  /** Add an item, stacking where possible. Returns false if it doesn't fit (nothing changes). */
  addItem(item: Item): boolean {
    const inv = this.data.inventory;
    const base = itemBase(item.key);
    if (!base) return false;
    const stack = base.stack ?? 1;
    let remaining = item.qty;
    if (stack > 1) {
      // Check capacity first so a partial add never happens.
      let room = 0;
      for (const it of inv) if (it?.key === item.key) room += stack - it.qty;
      room += inv.filter((x) => !x).length * stack;
      if (room < remaining) return false;
      for (const it of inv) {
        if (!remaining || it?.key !== item.key || it.qty >= stack) continue;
        const add = Math.min(stack - it.qty, remaining);
        it.qty += add;
        remaining -= add;
      }
      while (remaining > 0) {
        const i = inv.indexOf(null);
        const add = Math.min(stack, remaining);
        inv[i] = { ...item, uid: remaining === item.qty ? item.uid : `${item.uid}-${remaining}`, qty: add };
        remaining -= add;
      }
    } else {
      const i = inv.indexOf(null);
      if (i < 0) return false;
      inv[i] = item;
    }
    this.dirty = true;
    return true;
  }

  canFit(item: Item) {
    const base = itemBase(item.key);
    if (!base) return false;
    const stack = base.stack ?? 1;
    if (stack > 1) {
      let room = 0;
      for (const it of this.data.inventory) if (it?.key === item.key) room += stack - it.qty;
      room += this.data.inventory.filter((x) => !x).length * stack;
      return room >= item.qty;
    }
    return this.data.inventory.includes(null);
  }

  /** Remove qty of a key (stack-aware). */
  consume(key: string, qty: number): boolean {
    if (this.count(key) < qty) return false;
    const inv = this.data.inventory;
    for (let i = inv.length - 1; i >= 0 && qty > 0; i--) {
      const it = inv[i];
      if (it?.key !== key) continue;
      const take = Math.min(it.qty, qty);
      it.qty -= take;
      qty -= take;
      if (it.qty <= 0) inv[i] = null;
    }
    this.dirty = true;
    return true;
  }

  takeItem(uid: string): Item | undefined {
    const i = this.findSlot(uid);
    if (i < 0) return undefined;
    const it = this.data.inventory[i]!;
    this.data.inventory[i] = null;
    this.dirty = true;
    return it;
  }

  equip(uid: string): string | undefined {
    const i = this.findSlot(uid);
    if (i < 0) return "That item isn't in your pack.";
    const it = this.data.inventory[i]!;
    const base = itemBase(it.key);
    const slot = base && (["weapon", "armor", "helm", "charm"] as const).find((s) => s === base.kind);
    if (!slot) return "That can't be equipped.";
    const prev = this.data.equipment[slot];
    this.data.equipment[slot] = it;
    this.data.inventory[i] = prev ?? null;
    this.recompute();
    return undefined;
  }

  unequip(slot: EquipSlot): string | undefined {
    if (slot === "weapon") return "You always keep a weapon in hand.";
    const it = this.data.equipment[slot];
    if (!it) return undefined;
    const free = this.data.inventory.indexOf(null);
    if (free < 0) return "Your pack is full.";
    this.data.inventory[free] = it;
    delete this.data.equipment[slot];
    this.recompute();
    return undefined;
  }

  owns(key: string) {
    if (this.count(key) > 0) return true;
    if (this.data.bank.some((x) => x?.key === key)) return true;
    return Object.values(this.data.equipment).some((x) => x?.key === key);
  }

  // ---------------------------------------------------------------------------
  // Progression

  /** Returns number of levels gained. */
  addXp(amount: number): number {
    const d = this.data;
    if (d.level >= MAX_LEVEL) return 0;
    d.xp += amount;
    let gained = 0;
    while (d.level < MAX_LEVEL && d.xp >= xpToNext(d.level)) {
      d.xp -= xpToNext(d.level);
      d.level++;
      gained++;
    }
    if (d.level >= MAX_LEVEL) d.xp = 0;
    if (gained) this.recompute();
    this.dirty = true;
    return gained;
  }

  /** Returns true when a mastery level was gained. */
  addMastery(amount: number): boolean {
    const wk = this.weaponKey;
    const before = masteryLevel(this.data.mastery[wk] ?? 0);
    this.data.mastery[wk] = (this.data.mastery[wk] ?? 0) + amount;
    const after = masteryLevel(this.data.mastery[wk]!);
    this.dirty = true;
    if (after > before) {
      this.recompute();
      return true;
    }
    return false;
  }

  /** Perk choices currently available (levels reached without a pick). */
  pendingPerkLevel(): number | undefined {
    for (const choice of PERK_CHOICES) {
      if (choice.level > this.data.level) break;
      if (!choice.options.some((o) => this.data.perks.includes(o.id))) return choice.level;
    }
    return undefined;
  }

  choosePerk(id: string): string | undefined {
    const lvl = this.pendingPerkLevel();
    const choice = PERK_CHOICES.find((c) => c.level === lvl);
    if (!choice || !choice.options.some((o) => o.id === id)) return "That perk isn't available.";
    this.data.perks.push(id);
    this.recompute();
    return undefined;
  }

  /** Snapshot for the owning client's UI. */
  view(extra: Record<string, unknown> = {}) {
    const d = this.data;
    return {
      name: d.name,
      level: d.level,
      xp: d.xp,
      xpNext: d.level >= MAX_LEVEL ? 0 : xpToNext(d.level),
      gold: d.gold,
      inventory: d.inventory,
      equipment: d.equipment,
      mastery: d.mastery,
      perks: d.perks,
      pendingPerk: this.pendingPerkLevel(),
      quests: d.quests,
      discovered: d.discovered,
      bossKills: d.bossKills,
      floor: d.floor,
      stats: d.stats,
      achievements: d.achievements,
      derived: { atk: Math.round(this.derived.atkMul * 100), defense: Math.round(this.derived.defense), hpMax: this.derived.hpMax, staminaMax: this.derived.staminaMax },
      ...extra,
    };
  }
}
