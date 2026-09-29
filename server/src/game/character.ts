import {
  baseHp, baseStamina, combatBonus, DEFAULT_WEAPON_ART, EQUIP_SLOTS, itemBase, itemMasteryLevel, itemStats, knownIndices, makeItem, masteryProgress,
  MAX_LEVEL, Mod, NO_SKILL, scrollSkill, setsWorn, skillEntry, skillMods, WEAPON_ARTS, WEAPONS, xpToNext,
  type EquipSlot, type Item, type ItemEffect, type PlayerSettings, type SkillEntry, type WeaponKey,
} from "@floors/shared";

/** Main-story quests that used to award a skill point (for converting old characters). */
const OLD_QUEST_POINTS = ["q_welcome", "q_grakk", "q_undercroft", "q_keeper", "f2_causeway", "f2_storm", "f2_spire"];
/** Marks paid for each skill point a character had not spent when the skill tree was retired. */
const MARKS_PER_POINT = 3;
/**
 * Bump to reset everyone's skills once: each character goes back to knowing only Whirlwind
 * the next time they load, and every skill they lose is paid back in Marks.
 * (2 = the reset after the skill tree became skill scrolls.)
 */
export const SKILLS_VERSION = 2;
import type { Player } from "../state.ts";

export const INV_SIZE = 24;
export const BANK_SIZE = 48;

export interface QuestState {
  stage: number;
  progress: number;
  done?: boolean;
  /** When it was finished (missions go back on the board after a while). */
  at?: number;
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
  /** Legacy (per weapon type); mastery now lives on each weapon item. */
  mastery: Partial<Record<WeaponKey, number>>;
  /** Legacy perk picks (converted into known skills). */
  perks: string[];
  /** Legacy skill tree (converted into known skills and Marks). */
  tree?: string[];
  bonusPoints?: number;
  treeVersion?: number;
  /** Skills learned from scrolls (weapon skills, universal skills and passives), by id. */
  skills?: string[];
  /** Marks: earned from missions and quests, spent on skill scrolls at the Archivists. */
  marks?: number;
  /** Which skills reset this character has had (see SKILLS_VERSION). */
  skillsVersion?: number;
  /** Equipped skills per weapon type: loadout indices (see skillMove), NO_SKILL for empty. */
  loadout?: Partial<Record<WeaponKey, [number, number]>>;
  quests: Record<string, QuestState>;
  discovered: string[];
  bossKills: string[];
  /** Highest floor unlocked. */
  floor: number;
  /** Where the character is. `via`: arrive at this object (a gate) instead of x/y. */
  pos?: { room: string; x: number; y: number; hp?: number; via?: string };
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
    skills: ["sword.whirlwind"],
    marks: 0,
    skillsVersion: SKILLS_VERSION,
    loadout: { sword: [0, NO_SKILL] },
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
  /** Mastery level of the weapon in hand. */
  mastery: number;
  mdmg: ReturnType<typeof combatBonus>;
}

/**
 * Server-authoritative character: every inventory change happens here, on the
 * server, with unique item ids — clients only ask.
 */
export class Character {
  derived!: Derived;
  dirty = true;
  unbrokenReadyAt = 0;
  /** Set when loading converted an old skill tree into scrolls: the room tells the player once. */
  skillbookNews?: { lost: number; marks: number };
  /** Set when a gate sends the character to another floor: where they will appear. */
  travelTo?: { room: string; via: string; pos?: CharacterData["pos"] };

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
    // The oldest characters kept mastery per weapon type: it moves onto the weapon in hand.
    if (!d.tree && !d.skills) {
      const w = d.equipment.weapon!;
      const wk = itemBase(w.key)?.weapon;
      if (wk && w.mxp === undefined && d.mastery[wk]) w.mxp = d.mastery[wk];
    }
    // Skill scrolls replaced the skill tree, and everyone's skills were reset once
    // (SKILLS_VERSION): back to Whirlwind, with what they had paid back in Marks.
    let refund = 0;
    if (!d.skills) {
      // Still on the old skill tree: every point it ever had (spent or not) comes back as Marks.
      const learned = [...new Set([...(d.tree ?? []), ...(d.perks ?? [])])].filter((id) => skillEntry(id) && id !== "sword.whirlwind");
      const points = d.level + (d.tree ? d.bonusPoints ?? 0 : OLD_QUEST_POINTS.filter((id) => d.quests[id]?.done).length);
      refund = points * MARKS_PER_POINT;
      d.skills = ["sword.whirlwind"];
      d.loadout = { sword: [0, NO_SKILL] };
      d.marks = (d.marks ?? 0) + refund;
      d.skillsVersion = SKILLS_VERSION;
      this.skillbookNews = { lost: learned.length, marks: refund };
    }
    // Everyone's skills were reset: back to Whirlwind, with every lost skill paid back in Marks.
    if ((d.skillsVersion ?? 1) < SKILLS_VERSION) {
      const lost = d.skills.filter((id) => id !== "sword.whirlwind").length;
      const marks = lost * MARKS_PER_POINT;
      d.skills = ["sword.whirlwind"];
      d.loadout = { sword: [0, NO_SKILL] };
      d.marks = (d.marks ?? 0) + marks;
      d.skillsVersion = SKILLS_VERSION;
      refund += marks;
      if (lost || refund) this.skillbookNews = { lost, marks: refund };
    }
    delete d.tree;
    delete d.bonusPoints;
    delete d.treeVersion;
    d.marks ??= 0;
    d.loadout ??= {};
    // Durability was removed: drop the old field from saved gear.
    for (const it of [...Object.values(d.equipment), ...d.inventory, ...d.bank]) if (it && "dur" in it) delete (it as { dur?: number }).dur;
  }

  get weaponKey(): WeaponKey {
    return itemBase(this.data.equipment.weapon!.key)?.weapon ?? "sword";
  }

  /** Knows this skill or passive (learned from its scroll). */
  knows(id: string) {
    return this.data.skills!.includes(id);
  }

  hasPerk(id: string) {
    return this.knows(id);
  }

  // ---------------------------------------------------------------------------
  // Skills

  /**
   * Read a skill scroll from the pack: learn its skill and use the scroll up. A new skill
   * goes straight into an empty slot (the weapon in hand first).
   */
  readScroll(uid: string): { err?: string; entry?: SkillEntry } {
    const d = this.data;
    const i = this.findSlot(uid);
    const it = i >= 0 ? d.inventory[i] : null;
    const e = it ? scrollSkill(it.key) : undefined;
    if (!it || !e) return { err: "That isn't a skill scroll." };
    if (this.knows(e.id)) return { err: `You already know ${e.name}. Sell the scroll or trade it.` };
    it.qty--;
    if (it.qty <= 0) d.inventory[i] = null;
    d.skills!.push(e.id);
    if (e.kind === "skill") {
      const order: WeaponKey[] = e.weapon ? [e.weapon] : [this.weaponKey];
      for (const wk of order) {
        const lo = this.loadoutFor(wk);
        const empty = lo.indexOf(NO_SKILL);
        if (empty >= 0) {
          lo[empty] = e.index!;
          break;
        }
      }
    }
    this.recompute();
    return { entry: e };
  }

  /** The two equipped skills for a weapon type, cleaned of anything not learned. */
  loadoutFor(wk: WeaponKey): [number, number] {
    const d = this.data;
    const known = knownIndices(wk, d.skills!);
    let lo = d.loadout![wk] ?? [NO_SKILL, NO_SKILL];
    lo = lo.map((i) => (known.includes(i) ? i : NO_SKILL)) as [number, number];
    if (lo[0] !== NO_SKILL && lo[0] === lo[1]) lo[1] = NO_SKILL;
    d.loadout![wk] = lo;
    return lo;
  }

  equipSkill(wk: WeaponKey, slot: number, index: number): string | undefined {
    if (slot !== 0 && slot !== 1) return "No such slot.";
    const lo = this.loadoutFor(wk);
    if (index !== NO_SKILL && !knownIndices(wk, this.data.skills!).includes(index)) return "You haven't learned that skill. Read its scroll first.";
    const other = 1 - slot;
    if (index !== NO_SKILL && lo[other] === index) lo[other] = lo[slot];
    lo[slot] = index;
    this.recompute();
    return undefined;
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
    const mlevel = itemMasteryLevel(d.equipment.weapon?.mxp);
    let mods = skillMods(wk, d.skills!, mlevel);
    if (effects.has("wideParry")) mods |= Mod.WideParry;
    if (effects.has("lightDodge")) mods |= Mod.LightDodge;
    if (effects.has("longDodge")) mods |= Mod.LongDodge;
    // Gear sets: two pieces of one set add health and defense; all three add its power.
    for (const { set, count } of setsWorn([d.equipment.weapon?.key, d.equipment.armor?.key, d.equipment.helm?.key])) {
      if (count >= 2) {
        hp += set.two.hp;
        defense += set.two.defense;
      }
      if (count >= 3) effects.add(set.three.effect);
    }
    if (this.hasPerk("ironSkin")) defense += 12;
    if (this.hasPerk("scaleguard")) defense += 20;
    if (this.hasPerk("glacialHide")) defense += 25;
    if (this.hasPerk("deepLungs")) stamina += 15;
    if (this.hasPerk("tidalGrace")) stamina += 20;
    let hpMax = baseHp(d.level) + hp;
    if (this.hasPerk("wardensGrace")) hpMax = Math.round(hpMax * 1.1);
    if (this.hasPerk("glacialHide")) hpMax = Math.round(hpMax * 1.08);
    this.derived = {
      atkMul: (power / 100) * (1 + (d.level - 1) * 0.04),
      defense,
      hpMax: Math.round(hpMax),
      staminaMax: Math.max(60, Math.round(baseStamina(d.level) + stamina)),
      mods,
      effects,
      weaponKey: wk,
      mastery: mlevel,
      mdmg: combatBonus(wk, mlevel),
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
    const lo = this.loadoutFor(dv.weaponKey);
    p.sk1 = lo[0];
    p.sk2 = lo[1];
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

  /** Mastery goes to the weapon in hand. Returns true when it gained a level. */
  addMastery(amount: number): boolean {
    const w = this.data.equipment.weapon;
    if (!w) return false;
    const before = itemMasteryLevel(w.mxp);
    w.mxp = Math.round(((w.mxp ?? 0) + amount) * 100) / 100;
    this.dirty = true;
    if (itemMasteryLevel(w.mxp) > before) {
      this.recompute();
      return true;
    }
    return false;
  }

  /** Highest mastery level of any weapon this character owns. */
  bestMastery() {
    const d = this.data;
    let best = 0;
    for (const it of [...Object.values(d.equipment), ...d.inventory, ...d.bank]) {
      if (it && itemBase(it.key)?.kind === "weapon") best = Math.max(best, itemMasteryLevel(it.mxp));
    }
    return best;
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
      skills: d.skills,
      marks: d.marks ?? 0,
      loadout: Object.fromEntries(WEAPONS.map((w) => [w.key, this.loadoutFor(w.key)])),
      weaponMastery: masteryProgress(this.data.equipment.weapon?.mxp ?? 0),
      quests: d.quests,
      discovered: d.discovered,
      bossKills: d.bossKills,
      floor: d.floor,
      stats: d.stats,
      achievements: d.achievements,
      derived: { atk: Math.round(this.derived.atkMul * 100), defense: Math.round(this.derived.defense), hpMax: this.derived.hpMax, staminaMax: this.derived.staminaMax, effects: [...this.derived.effects] },
      ...extra,
    };
  }
}
