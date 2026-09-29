import type { ItemEffect } from "./items.ts";

/**
 * Gear sets: each floor's own gear is a set. Wear two pieces of one (weapon, armour or helm)
 * for a little more health and defense; wear all three for the set's own power.
 */
export interface GearSet {
  id: string;
  name: string;
  pieces: string[];
  /** Two pieces worn. */
  two: { hp: number; defense: number };
  /** All three worn: the set's power (an effect the server applies). */
  three: { effect: ItemEffect; desc: string };
}

export const GEAR_SETS: GearSet[] = [
  {
    id: "storm",
    name: "Stormglass",
    pieces: ["sword_storm", "greatsword_storm", "daggers_storm", "spear_storm", "staff_storm", "armor_gilded", "armor_skyguard", "armor_stormweave", "helm_winged", "helm_stormcrown"],
    two: { hp: 20, defense: 6 },
    three: { effect: "setStorm", desc: "One blow in eight calls lightning down on what it strikes." },
  },
  {
    id: "dragon",
    name: "Dragonscale",
    pieces: ["sword_dragon", "greatsword_dragon", "daggers_dragon", "spear_dragon", "staff_dragon", "armor_dragon", "armor_drakehide", "armor_emberweave", "helm_dragon", "helm_embercirclet"],
    two: { hp: 28, defense: 8 },
    three: { effect: "setDragon", desc: "Your blows have a 20% chance to set enemies burning." },
  },
  {
    id: "frost",
    name: "Frostforged",
    pieces: ["sword_rime", "greatsword_rime", "daggers_rime", "spear_rime", "staff_rime", "armor_rime", "armor_furmantle", "armor_frostweave", "helm_rimecrown", "helm_furhood"],
    two: { hp: 36, defense: 10 },
    three: { effect: "setFrost", desc: "Your blows have a 25% chance to chill enemies." },
  },
  {
    id: "void",
    name: "Eclipse",
    pieces: ["sword_void", "greatsword_void", "daggers_void", "spear_void", "staff_void", "armor_eclipse", "armor_shadowsilk", "armor_voidweave", "helm_eclipse", "helm_shadowveil"],
    two: { hp: 44, defense: 12 },
    three: { effect: "setVoid", desc: "Your blows have a 25% chance to curse enemies, and you deal 8% more damage to the cursed." },
  },
  {
    id: "tide",
    name: "Tidecaller",
    pieces: ["sword_tide", "greatsword_tide", "daggers_tide", "spear_tide", "staff_tide", "armor_tide", "armor_sharkskin", "armor_seasilk", "helm_coralcrown", "helm_divers"],
    two: { hp: 52, defense: 14 },
    three: { effect: "setTide", desc: "Your blows have a 30% chance to soak enemies, and you deal 10% more damage to the soaked." },
  },
  {
    id: "brass",
    name: "Brassbound",
    pieces: ["sword_brass", "greatsword_brass", "daggers_brass", "spear_brass", "staff_brass", "armor_brass", "armor_tinker", "armor_aether", "helm_brass", "helm_goggles"],
    two: { hp: 60, defense: 16 },
    three: { effect: "setBrass", desc: "Your blows have a 30% chance to sunder armour, and you deal 10% more damage to the sundered." },
  },
  {
    id: "solar",
    name: "Solar",
    pieces: ["sword_solar", "greatsword_solar", "daggers_solar", "spear_solar", "staff_solar", "armor_solar", "armor_nomad", "armor_sunweave", "helm_nemes", "helm_veil"],
    two: { hp: 64, defense: 17 },
    three: { effect: "setSolar", desc: "Your blows have a 30% chance to dazzle, and you deal 10% more damage to the dazzled." },
  },
];

const BY_PIECE = new Map(GEAR_SETS.flatMap((s) => s.pieces.map((k) => [k, s] as const)));
/** The set an item belongs to, if any. */
export const gearSetOf = (key: string | undefined) => (key ? BY_PIECE.get(key) : undefined);

/** How many pieces of each set are worn, from the equipped items' keys. */
export function setsWorn(keys: (string | undefined)[]): { set: GearSet; count: number }[] {
  const counts = new Map<GearSet, number>();
  for (const k of keys) {
    const s = gearSetOf(k);
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts].map(([set, count]) => ({ set, count }));
}
