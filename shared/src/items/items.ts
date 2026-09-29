import type { WeaponKey } from "../combat/weapons.ts";
import type { WeaponArtKey } from "./looks.ts";

export const Rarity = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 } as const;
export const RARITY_NAMES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
export const RARITY_COLORS = ["#d8d4cc", "#7fd67a", "#5aa7f0", "#b77af2", "#f2a93b"];

export type ItemKind = "weapon" | "armor" | "helm" | "charm" | "material" | "consumable" | "artifact" | "key" | "scroll";
export type EquipSlot = "weapon" | "armor" | "helm" | "charm";
export const EQUIP_SLOTS: EquipSlot[] = ["weapon", "armor", "helm", "charm"];

/** Special effects that change how you play, not just numbers. */
export type ItemEffect =
  | "wideParry" // parry window +2 ticks
  | "lightDodge" // dodge costs 30% less stamina
  | "longDodge" // dodge travels 15% further
  | "secondWindCharm" // perfect parries restore health
  | "emberbrand" // ripostes explode in flame
  | "dawnbreaker" // perfect parries release a radiant wave
  | "moonstone"; // blows sometimes curse

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
  /** Fixed rarity (uniques, scrolls). */
  rarity?: number;
  /** Scrolls: the skill it teaches. */
  skill?: string;
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
  // Forged, found and fought for: a second wave of weapons.
  { key: "sword_steel", name: "Steel Arming Sword", kind: "weapon", weapon: "sword", art: "sword_steel", power: 132, value: 90, tier: 2, desc: "Well balanced, well kept. The weapon of a professional." },
  { key: "sword_knight", name: "Knight's Longsword", kind: "weapon", weapon: "sword", art: "sword_knight", power: 146, value: 220, tier: 3, desc: "A long blade with a gilded cross. Sworn oaths are etched along the fuller." },
  { key: "sword_frost", name: "Frostbite", kind: "weapon", weapon: "sword", art: "sword_frost", power: 152, value: 480, tier: 3, rarity: 3, desc: "Blue steel that never warms. Frost creeps along the edge after every swing." },
  { key: "greatsword_zwei", name: "Zweihänder", kind: "weapon", weapon: "greatsword", art: "gs_zwei", power: 136, value: 110, tier: 2, desc: "A wavy flamberge as tall as its wielder. It parts crowds." },
  { key: "greatsword_exec", name: "Executioner's Blade", kind: "weapon", weapon: "greatsword", art: "gs_exec", power: 158, value: 320, tier: 3, desc: "Broad, square and blunt-tipped. It was made to end things." },
  { key: "daggers_kris", name: "Serpent Kris", kind: "weapon", weapon: "daggers", art: "dg_kris", power: 132, value: 100, tier: 2, desc: "Wavy blades that bite twice on the way out." },
  { key: "daggers_night", name: "Nightshade Daggers", kind: "weapon", weapon: "daggers", art: "dg_night", power: 148, value: 340, tier: 3, rarity: 3, desc: "Black blades with a violet sheen. They drink the light around them." },
  { key: "spear_glaive", name: "Warden's Glaive", kind: "weapon", weapon: "spear", art: "sp_glaive", power: 144, value: 180, tier: 3, desc: "A curved blade on a long haft, for keeping a gate against many." },
  { key: "spear_trident", name: "Stormcaller Trident", kind: "weapon", weapon: "spear", art: "sp_trident", power: 154, value: 440, tier: 3, rarity: 3, desc: "Three prongs that hum before a storm. Sparks jump between them." },
  { key: "staff_frost", name: "Frostspire Staff", kind: "weapon", weapon: "staff", art: "st_frost", power: 134, value: 120, tier: 2, desc: "A shard of blue ice held in silver. Your breath fogs when you hold it." },
  { key: "staff_moon", name: "Moonwood Staff", kind: "weapon", weapon: "staff", art: "st_moon", power: 150, value: 380, tier: 3, rarity: 3, desc: "Pale wood cradling a crescent moon that glows at dusk." },
  { key: "greatsword_warden", name: "Warden's Halberd-Sword", kind: "weapon", weapon: "greatsword", art: "gs_warden", power: 150, value: 450, tier: 3, rarity: 3, desc: "It kept the Undercroft for a thousand years." },

  // Armour (chest). `look` indexes ARMOR_STYLES.
  // --- The third wave (Floor 1: tiers 1–3) ---------------------------------------------
  { key: "sword_bronze", name: "Bronze Gladius", kind: "weapon", weapon: "sword", art: "sword_bronze", power: 106, value: 30, tier: 1, desc: "Short, broad and heavy for its size. Old soldiers still swear by bronze." },
  { key: "sword_falchion", name: "Bandit Falchion", kind: "weapon", weapon: "sword", art: "sword_falchion", power: 126, value: 70, tier: 2, desc: "A cleaver of a sword with a hooked back. Grakk's lieutenants carry them." },
  { key: "sword_royal", name: "Royal Guard Sabre", kind: "weapon", weapon: "sword", art: "sword_royal", power: 150, value: 300, tier: 3, desc: "Blued steel and a gilded basket. It was made to be seen as much as used." },
  { key: "greatsword_bone", name: "Bonecleaver", kind: "weapon", weapon: "greatsword", art: "gs_bone", power: 126, value: 80, tier: 2, desc: "A slab of old bone lashed to a haft. It breaks shields and nerve alike." },
  { key: "greatsword_moon", name: "Moonsplitter", kind: "weapon", weapon: "greatsword", art: "gs_moon", power: 154, value: 320, tier: 3, desc: "Dark steel etched with a crescent that catches light that isn't there." },
  { key: "daggers_bone", name: "Bone Shivs", kind: "weapon", weapon: "daggers", art: "dg_bone", power: 104, value: 24, tier: 1, desc: "Two sharpened ribs. Crude, quick, and nobody expects them." },
  { key: "daggers_duelist", name: "Duelist's Pair", kind: "weapon", weapon: "daggers", art: "dg_duel", power: 142, value: 280, tier: 3, desc: "A matched pair of needle blades. Every thrust finds a seam." },
  { key: "spear_partisan", name: "Bronze Partisan", kind: "weapon", weapon: "spear", art: "sp_partisan", power: 126, value: 75, tier: 2, desc: "A broad winged head that catches blades as well as it cuts." },
  { key: "spear_halberd", name: "Halberd", kind: "weapon", weapon: "spear", art: "sp_halberd", power: 150, value: 300, tier: 3, desc: "Spike, hook and axe on one long haft: a small army in one weapon." },
  { key: "staff_bone", name: "Bone Totem", kind: "weapon", weapon: "staff", art: "st_bone", power: 126, value: 80, tier: 2, desc: "Cultist work: a skull on a staff, and something in the skull still listening." },
  { key: "staff_crystal", name: "Crystal Rod", kind: "weapon", weapon: "staff", art: "st_crystal", power: 146, value: 300, tier: 3, desc: "Amethyst grown around a silver rod. Spells come out of it sharper." },
  { key: "armor_hide", name: "Hide Armour", kind: "armor", defense: 10, hp: 4, look: 16, value: 22, tier: 1, desc: "Layered hides stitched with sinew. Warm, stiff, and better than cloth." },
  { key: "armor_ring", name: "Ring Mail", kind: "armor", defense: 22, hp: 8, look: 17, value: 110, tier: 2, desc: "Rings sewn onto leather: most of the protection of chain for half the weight." },
  { key: "armor_templar", name: "Templar Plate", kind: "armor", defense: 44, hp: 22, stamina: -4, look: 18, value: 340, tier: 3, desc: "White plate under a red tabard. The order that wore it held the ruins for a century." },
  { key: "armor_windrunner", name: "Windrunner Leathers", kind: "armor", defense: 28, hp: 6, stamina: 16, look: 19, value: 300, tier: 3, desc: "Supple leathers and a green cape. For those who win by never being where the blow lands." },
  { key: "helm_coif", name: "Mail Coif", kind: "helm", defense: 12, hp: 6, look: 13, value: 70, tier: 2, desc: "A hood of mail that rolls down to the shoulders." },
  { key: "helm_templar", name: "Templar Helm", kind: "helm", defense: 20, hp: 14, stamina: -2, look: 14, value: 260, tier: 3, desc: "A great helm with a gilded cross over the eyes." },
  { key: "armor_padded", name: "Padded Tunic", kind: "armor", defense: 6, look: 1, value: 6, tier: 1, desc: "Quilted cloth. Better than nothing. Barely." },
  { key: "armor_leather", name: "Leather Jerkin", kind: "armor", defense: 14, stamina: 5, look: 2, value: 30, tier: 1, desc: "Light, quiet, trusted by scouts." },
  { key: "armor_ranger", name: "Ranger's Garb", kind: "armor", defense: 18, stamina: 12, look: 3, value: 90, tier: 2, desc: "Forest leathers and a travelling cloak. Built for long roads." },
  { key: "armor_chain", name: "Chainmail", kind: "armor", defense: 26, hp: 10, look: 4, value: 70, tier: 2, desc: "Rings of iron under a tabard in your colours." },
  { key: "armor_robes", name: "Hollow Robes", kind: "armor", defense: 12, hp: 22, look: 5, value: 110, tier: 2, desc: "Cultist vestments. The seams whisper at night." },
  { key: "armor_plate", name: "Emberwatch Plate", kind: "armor", defense: 40, hp: 20, stamina: -5, look: 6, value: 160, tier: 3, desc: "The garrison's finest. Heavy on the lungs." },
  { key: "armor_warden", name: "Warden's Aegis", kind: "armor", defense: 48, hp: 30, stamina: -5, look: 7, value: 520, tier: 3, rarity: 3, desc: "Ancient plate from the Undercroft. The runes still glow." },
  { key: "armor_scale", name: "Scale Mail", kind: "armor", defense: 32, hp: 14, stamina: -2, look: 9, value: 120, tier: 2, desc: "Overlapping bronze scales on a leather coat. It rustles like a snake." },
  { key: "armor_brigandine", name: "Brigandine", kind: "armor", defense: 38, hp: 18, look: 10, value: 190, tier: 3, desc: "Steel plates riveted inside a coat in your colours. Tough, and it still breathes." },
  { key: "armor_shadow", name: "Shadowweave Leathers", kind: "armor", defense: 26, stamina: 20, look: 11, value: 280, tier: 3, rarity: 2, desc: "Dyed black and oiled silent. Made for those who strike first." },
  { key: "armor_arcanist", name: "Arcanist's Robes", kind: "armor", defense: 18, hp: 32, stamina: 8, look: 12, value: 260, tier: 3, rarity: 2, desc: "Deep blue silk embroidered with stars that shift when you're not looking." },
  { key: "armor_dawn", name: "Dawnplate", kind: "armor", defense: 58, hp: 40, look: 8, value: 1600, tier: 4, rarity: 4, desc: "The Keeper's own armour, bright as first light." },
  // Helms. `look` indexes HELM_STYLES.
  { key: "helm_cap", name: "Leather Cap", kind: "helm", defense: 4, look: 1, value: 8, tier: 1, desc: "Keeps the rain off." },
  { key: "helm_hood", name: "Ranger's Hood", kind: "helm", defense: 6, stamina: 5, look: 2, value: 24, tier: 1, desc: "Shadows follow the wearer." },
  { key: "helm_iron", name: "Iron Helm", kind: "helm", defense: 14, hp: 8, look: 3, value: 60, tier: 2, desc: "Dented, honest steel." },
  { key: "helm_circlet", name: "Gatewarden Circlet", kind: "helm", defense: 10, hp: 20, look: 4, value: 300, tier: 3, rarity: 3, desc: "Worn by those who kept the First Gate." },
  { key: "helm_horned", name: "Horned Helm", kind: "helm", defense: 16, hp: 12, look: 5, value: 120, tier: 2, desc: "Grakk's gang wore these to look bigger. It works." },
  { key: "helm_bandana", name: "Bandit's Bandana", kind: "helm", defense: 5, stamina: 6, look: 7, value: 14, tier: 1, desc: "A red scarf knotted at the back. Grakk's gang wore them first." },
  { key: "helm_wizard", name: "Wizard's Hat", kind: "helm", defense: 8, hp: 16, look: 8, value: 80, tier: 2, desc: "Tall, pointed and slightly singed at the brim." },
  { key: "helm_kettle", name: "Kettle Hat", kind: "helm", defense: 16, hp: 10, look: 9, value: 90, tier: 2, desc: "A wide steel brim that keeps off arrows and rain alike." },
  { key: "helm_greathelm", name: "Great Helm", kind: "helm", defense: 24, hp: 18, stamina: -3, look: 10, value: 210, tier: 3, desc: "A steel bucket with a cross for eyes. The world narrows; so does the fear." },
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
  { key: "map_floor1", name: "Map of the Verdant Floor", kind: "key", value: 0, tier: 1, bound: true, desc: "A cartographer's map of Floor 1: roads, landmarks and where your quests lead. Buying it lets you open the map (M) any time." },
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
  /** Bonus stats from rarity. */
  bonus: { atk?: number; hp?: number; stamina?: number; defense?: number };
  /** Weapons: mastery XP earned fighting with this very weapon. */
  mxp?: number;
}

export function itemName(it: Item) {
  const base = itemBase(it.key);
  return `${base?.name ?? it.key}${it.plus ? ` +${it.plus}` : ""}`;
}

export const isEquipment = (b: ItemBase) => b.kind === "weapon" || b.kind === "armor" || b.kind === "helm" || b.kind === "charm";
export const slotOf = (b: ItemBase): EquipSlot | undefined => (isEquipment(b) ? (b.kind as EquipSlot) : undefined);

/** Stats an equipped item contributes (upgrades applied). */
export function itemStats(it: Item) {
  const b = itemBase(it.key);
  if (!b) return { power: 0, defense: 0, hp: 0, stamina: 0 };
  const plus = 1 + it.plus * 0.05;
  return {
    power: (b.power ?? 0) * plus + (it.bonus.atk ?? 0),
    defense: (b.defense ?? 0) * plus + (it.bonus.defense ?? 0),
    hp: (b.hp ?? 0) + (it.bonus.hp ?? 0),
    stamina: (b.stamina ?? 0) + (it.bonus.stamina ?? 0),
  };
}

/** Blacksmith upgrade costs: gold + materials per level. */
export function upgradeCost(it: Item): { gold: number; mats: { key: string; qty: number }[] } | undefined {
  if (it.plus >= 5) return undefined;
  const b = itemBase(it.key);
  if (!b || !isEquipment(b)) return undefined;
  const n = it.plus + 1;
  // Floor 5's own gear (tier 7) is worked with void materials.
  if (b.tier >= 7) {
    const mats = [{ key: "mat_umbralshard", qty: 2 * n }];
    if (n >= 3) mats.push({ key: "mat_shadowsilk", qty: n - 1 });
    if (n >= 5) mats.push({ key: "mat_voidheart", qty: 1 });
    return { gold: Math.round(38 * n * n * (1 + b.tier * 0.5)), mats };
  }
  // Floor 4's own gear (tier 6) is worked with frost materials.
  if (b.tier >= 6) {
    const mats = [{ key: "mat_rimeshard", qty: 2 * n }];
    if (n >= 3) mats.push({ key: "mat_frostpelt", qty: n - 1 });
    if (n >= 5) mats.push({ key: "mat_glacialheart", qty: 1 });
    return { gold: Math.round(38 * n * n * (1 + b.tier * 0.5)), mats };
  }
  // Floor 3's own gear (tier 5) is worked with dragon materials.
  if (b.tier >= 5) {
    const mats = [{ key: "mat_dragonscale", qty: 2 * n }];
    if (n >= 3) mats.push({ key: "mat_cinder", qty: n - 1 });
    if (n >= 5) mats.push({ key: "mat_emberheart", qty: 1 });
    return { gold: Math.round(38 * n * n * (1 + b.tier * 0.5)), mats };
  }
  // Floor 2's own gear (tier 4 without a fixed rarity) is worked with Floor 2 materials.
  if (b.tier >= 4 && !b.rarity) {
    const sky = [{ key: "mat_gilded", qty: 2 * n }];
    if (n >= 3) sky.push({ key: "mat_stormglass", qty: n - 1 });
    if (n >= 5) sky.push({ key: "mat_feather", qty: 3 });
    return { gold: Math.round(38 * n * n * (1 + b.tier * 0.5)), mats: sky };
  }
  const mats = [{ key: "mat_scrap", qty: 2 * n }];
  if (n >= 3) mats.push({ key: "mat_shard", qty: n - 2 });
  if (n >= 5) mats.push({ key: "mat_ember", qty: 1 });
  return { gold: Math.round(38 * n * n * (1 + b.tier * 0.5)), mats };
}

export function sellPrice(it: Item) {
  const b = itemBase(it.key);
  if (!b || b.bound) return 0;
  return Math.max(1, Math.round(b.value * (1 + it.rarity * 0.6) * (1 + it.plus * 0.2) * 0.35)) * it.qty;
}
