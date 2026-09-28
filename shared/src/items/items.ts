import type { WeaponKey } from "../combat/weapons.ts";
import type { WeaponArtKey } from "./looks.ts";

export const Rarity = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 } as const;
export const RARITY_NAMES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
export const RARITY_COLORS = ["#d8d4cc", "#7fd67a", "#5aa7f0", "#b77af2", "#f2a93b"];

export type ItemKind = "weapon" | "armor" | "helm" | "charm" | "material" | "consumable" | "artifact" | "key";
export type EquipSlot = "weapon" | "armor" | "helm" | "charm";
export const EQUIP_SLOTS: EquipSlot[] = ["weapon", "armor", "helm", "charm"];

/** Special effects that change how you play, not just numbers. */
export type ItemEffect =
  | "wideParry" // parry window +2 ticks
  | "lightDodge" // dodge costs 30% less stamina
  | "longDodge" // dodge travels 15% further
  | "secondWindCharm" // perfect parries restore health
  | "emberbrand" // ripostes explode in flame
  | "dawnbreaker"; // perfect parries release a radiant wave

export interface ItemBase {
  key: string;
  name: string;
  kind: ItemKind;
  weapon?: WeaponKey;
  /** Weapon power: 100 = baseline damage. */
  power?: number;
  defense?: number;
  hp?: number;
  stamina?: number;
  /** Appearance index for armour/helms (ARMOR_STYLES / HELM_STYLES), shown on the character. */
  look?: number;
  /** Weapon sprite (WEAPON_ARTS key), shown in the character's hand. */
  art?: WeaponArtKey;
  stack?: number;
  value: number;
  tier: number;
  desc: string;
  effect?: ItemEffect;
  /** Never dropped on death, never sold (quest items, keys). */
  bound?: boolean;
  /** Fixed rarity (uniques). */
  rarity?: number;
}

export const ITEMS: ItemBase[] = [
  // Weapons — tier 1 and tier 2 of each class.
  { key: "sword_rusty", name: "Rusty Sword", kind: "weapon", weapon: "sword", art: "sword_rusty", power: 100, value: 8, tier: 1, desc: "Nicked and dull, but it answers when you parry." },
  { key: "sword_iron", name: "Iron Longsword", kind: "weapon", weapon: "sword", art: "sword_iron", power: 122, value: 40, tier: 2, desc: "A soldier's blade from the Emberwatch forge." },
  { key: "greatsword_iron", name: "Iron Greatsword", kind: "weapon", weapon: "greatsword", art: "gs_iron", power: 108, value: 30, tier: 1, desc: "Heavy enough to split a shield — and your stamina." },
  { key: "greatsword_bandit", name: "Bandit Cleaver", kind: "weapon", weapon: "greatsword", art: "gs_cleaver", power: 128, value: 55, tier: 2, desc: "Grakk's gang favours brutal, notched steel." },
  { key: "daggers_twin", name: "Twin Knives", kind: "weapon", weapon: "daggers", art: "dg_knives", power: 100, value: 24, tier: 1, desc: "Quick blades for quick hands." },
  { key: "daggers_stalker", name: "Stalker Fangs", kind: "weapon", weapon: "daggers", art: "dg_fangs", power: 124, value: 60, tier: 2, desc: "Taken from the Ruin Stalkers. Still cold." },
  { key: "spear_hunting", name: "Hunting Spear", kind: "weapon", weapon: "spear", art: "sp_hunting", power: 104, value: 22, tier: 1, desc: "Keep the wolves at the tip." },
  { key: "spear_iron", name: "Iron Pike", kind: "weapon", weapon: "spear", art: "sp_pike", power: 124, value: 48, tier: 2, desc: "Long, straight, and unforgiving." },
  { key: "staff_oak", name: "Oak Staff", kind: "weapon", weapon: "staff", art: "st_oak", power: 100, value: 20, tier: 1, desc: "Carved with an apprentice's first sigil." },
  { key: "staff_ember", name: "Ember Staff", kind: "weapon", weapon: "staff", art: "st_ember", power: 124, value: 58, tier: 2, desc: "Warm to the touch, even at night." },
  // Uniques.
  { key: "sword_emberbrand", name: "Emberbrand", kind: "weapon", weapon: "sword", art: "sword_ember", power: 142, value: 400, tier: 3, rarity: 3, effect: "emberbrand", desc: "Grakk's prize. Ripostes erupt in flame." },
  { key: "sword_dawnbreaker", name: "Dawnbreaker", kind: "weapon", weapon: "sword", art: "sword_dawn", power: 165, value: 1500, tier: 4, rarity: 4, effect: "dawnbreaker", desc: "The Keeper's blade. A perfect parry releases the dawn." },
  { key: "greatsword_warden", name: "Warden's Halberd-Sword", kind: "weapon", weapon: "greatsword", art: "gs_warden", power: 150, value: 450, tier: 3, rarity: 3, desc: "It kept the Undercroft for a thousand years." },

  // Armour (chest). `look` indexes ARMOR_STYLES.
  { key: "armor_padded", name: "Padded Tunic", kind: "armor", defense: 6, look: 1, value: 6, tier: 1, desc: "Quilted cloth. Better than nothing. Barely." },
  { key: "armor_leather", name: "Leather Jerkin", kind: "armor", defense: 14, stamina: 5, look: 2, value: 30, tier: 1, desc: "Light, quiet, trusted by scouts." },
  { key: "armor_ranger", name: "Ranger's Garb", kind: "armor", defense: 18, stamina: 12, look: 3, value: 90, tier: 2, desc: "Forest leathers and a travelling cloak. Built for long roads." },
  { key: "armor_chain", name: "Chainmail", kind: "armor", defense: 26, hp: 10, look: 4, value: 70, tier: 2, desc: "Rings of iron under a tabard in your colours." },
  { key: "armor_robes", name: "Hollow Robes", kind: "armor", defense: 12, hp: 22, look: 5, value: 110, tier: 2, desc: "Cultist vestments. The seams whisper at night." },
  { key: "armor_plate", name: "Emberwatch Plate", kind: "armor", defense: 40, hp: 20, stamina: -5, look: 6, value: 160, tier: 3, desc: "The garrison's finest. Heavy on the lungs." },
  { key: "armor_warden", name: "Warden's Aegis", kind: "armor", defense: 48, hp: 30, stamina: -5, look: 7, value: 520, tier: 3, rarity: 3, desc: "Ancient plate from the Undercroft. The runes still glow." },
  { key: "armor_dawn", name: "Dawnplate", kind: "armor", defense: 58, hp: 40, look: 8, value: 1600, tier: 4, rarity: 4, desc: "The Keeper's own armour, bright as first light." },
  // Helms. `look` indexes HELM_STYLES.
  { key: "helm_cap", name: "Leather Cap", kind: "helm", defense: 4, look: 1, value: 8, tier: 1, desc: "Keeps the rain off." },
  { key: "helm_hood", name: "Ranger's Hood", kind: "helm", defense: 6, stamina: 5, look: 2, value: 24, tier: 1, desc: "Shadows follow the wearer." },
  { key: "helm_iron", name: "Iron Helm", kind: "helm", defense: 14, hp: 8, look: 3, value: 60, tier: 2, desc: "Dented, honest steel." },
  { key: "helm_circlet", name: "Gatewarden Circlet", kind: "helm", defense: 10, hp: 20, look: 4, value: 300, tier: 3, rarity: 3, desc: "Worn by those who kept the First Gate." },
  { key: "helm_horned", name: "Horned Helm", kind: "helm", defense: 16, hp: 12, look: 5, value: 120, tier: 2, desc: "Grakk's gang wore these to look bigger. It works." },
  { key: "helm_keeper", name: "Crown of the Keeper", kind: "helm", defense: 22, hp: 35, look: 6, value: 1400, tier: 4, rarity: 4, desc: "A crown of gold and old light. Floors above will know you." },
  // Charms.
  { key: "charm_duelist", name: "Duelist's Charm", kind: "charm", value: 120, tier: 2, effect: "wideParry", desc: "Your parry window is a little wider." },
  { key: "charm_feather", name: "Feather Charm", kind: "charm", value: 110, tier: 2, effect: "lightDodge", desc: "Dodging costs 30% less stamina." },
  { key: "charm_wolf", name: "Wolf Fang Charm", kind: "charm", stamina: 12, value: 40, tier: 1, desc: "Carved from an alpha's fang. You breathe easier." },
  { key: "charm_amber", name: "Amber Heart", kind: "charm", hp: 18, value: 45, tier: 1, desc: "Warm amber, older than the town." },
  { key: "charm_gale", name: "Gale Talisman", kind: "charm", value: 150, tier: 2, effect: "longDodge", desc: "Your dodge carries you further." },
  { key: "charm_secondwind", name: "Second Wind Locket", kind: "charm", value: 220, tier: 3, rarity: 3, effect: "secondWindCharm", desc: "A perfect parry restores a little health." },

  // Materials.
  { key: "mat_pelt", name: "Wolf Pelt", kind: "material", stack: 20, value: 4, tier: 1, desc: "Thick grey fur. The tanner pays for these." },
  { key: "mat_scrap", name: "Iron Scrap", kind: "material", stack: 20, value: 5, tier: 1, desc: "Bent metal. The blacksmith can use it." },
  { key: "mat_cloth", name: "Cultist Cloth", kind: "material", stack: 20, value: 6, tier: 1, desc: "Stitched with sigils that hum faintly." },
  { key: "mat_shard", name: "Ancient Shard", kind: "material", stack: 20, value: 14, tier: 2, desc: "A splinter of the floating world's stone." },
  { key: "mat_ember", name: "Ember Core", kind: "material", stack: 10, value: 40, tier: 3, desc: "Still burning. Master smiths prize these." },
  // Consumables.
  { key: "tonic", name: "Healing Tonic", kind: "consumable", stack: 10, value: 12, tier: 1, desc: "Drink (R) to recover 40% health. Takes a moment — choose it well." },
  // Artifacts (sell or keep; some tie into quests).
  { key: "art_lens", name: "Surveyor's Lens", kind: "artifact", value: 90, tier: 2, desc: "Through it the tower above seems close enough to touch." },
  { key: "art_idol", name: "Hollow Idol", kind: "artifact", value: 120, tier: 2, desc: "The cultists pray to what lies beneath the floor." },
  { key: "art_gatestone", name: "Fragment of the First Gate", kind: "artifact", value: 0, tier: 3, bound: true, desc: "It pulls gently upward, toward the next floor." },
  // Keys.
  { key: "key_ruins", name: "Undercroft Key", kind: "key", value: 0, tier: 2, bound: true, desc: "Grakk wore it around his neck. It fits the sealed door in the Sunken Ruins." },
];

export const itemBase = (key: string) => ITEMS.find((i) => i.key === key);

/** A concrete item instance, owned by exactly one inventory/drop at a time. */
export interface Item {
  uid: string;
  key: string;
  rarity: number;
  qty: number;
  /** Upgrade level from the blacksmith (+0..+5). */
  plus: number;
  /** 0–100; broken (0) gear gives half its stats until repaired. */
  dur: number;
  /** Bonus stats from rarity. */
  bonus: { atk?: number; hp?: number; stamina?: number; defense?: number };
}

export function itemName(it: Item) {
  const base = itemBase(it.key);
  return `${base?.name ?? it.key}${it.plus ? ` +${it.plus}` : ""}`;
}

export const isEquipment = (b: ItemBase) => b.kind === "weapon" || b.kind === "armor" || b.kind === "helm" || b.kind === "charm";
export const slotOf = (b: ItemBase): EquipSlot | undefined => (isEquipment(b) ? (b.kind as EquipSlot) : undefined);

/** Stats an equipped item contributes (durability and upgrades applied). */
export function itemStats(it: Item) {
  const b = itemBase(it.key);
  if (!b) return { power: 0, defense: 0, hp: 0, stamina: 0 };
  const broken = it.dur <= 0 ? 0.5 : 1;
  const plus = 1 + it.plus * 0.06;
  return {
    power: ((b.power ?? 0) * plus + (it.bonus.atk ?? 0)) * broken,
    defense: ((b.defense ?? 0) * plus + (it.bonus.defense ?? 0)) * broken,
    hp: ((b.hp ?? 0) + (it.bonus.hp ?? 0)) * broken,
    stamina: ((b.stamina ?? 0) + (it.bonus.stamina ?? 0)) * broken,
  };
}

/** Blacksmith upgrade costs: gold + materials per level. */
export function upgradeCost(it: Item): { gold: number; mats: { key: string; qty: number }[] } | undefined {
  if (it.plus >= 5) return undefined;
  const b = itemBase(it.key);
  if (!b || !isEquipment(b)) return undefined;
  const n = it.plus + 1;
  const mats = [{ key: "mat_scrap", qty: 2 * n }];
  if (n >= 3) mats.push({ key: "mat_shard", qty: n - 2 });
  if (n >= 5) mats.push({ key: "mat_ember", qty: 1 });
  return { gold: Math.round(25 * n * n * (1 + b.tier * 0.5)), mats };
}

export const repairCost = (it: Item) => Math.ceil(((100 - it.dur) / 100) * (itemBase(it.key)?.value ?? 10) * 0.3);

export function sellPrice(it: Item) {
  const b = itemBase(it.key);
  if (!b || b.bound) return 0;
  return Math.max(1, Math.round(b.value * (1 + it.rarity * 0.6) * (1 + it.plus * 0.2) * 0.35)) * it.qty;
}
