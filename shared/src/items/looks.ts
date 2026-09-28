/**
 * Visible equipment styles. Each armour, helm and weapon names one of these, and the
 * index is synced on the player so everyone sees what you wear.
 */
export const ARMOR_STYLES = ["clothes", "padded", "leather", "ranger", "chain", "robes", "plate", "warden", "dawn"] as const;
export type ArmorStyle = (typeof ARMOR_STYLES)[number];

export const HELM_STYLES = ["none", "cap", "hood", "iron", "circlet", "horned", "keeper"] as const;
export type HelmStyle = (typeof HELM_STYLES)[number];

export const WEAPON_ARTS = [
  "sword_rusty", "sword_iron", "sword_ember", "sword_dawn",
  "gs_iron", "gs_cleaver", "gs_warden",
  "dg_knives", "dg_fangs",
  "sp_hunting", "sp_pike",
  "st_oak", "st_ember",
] as const;
export type WeaponArtKey = (typeof WEAPON_ARTS)[number];

export const armorStyle = (i: number): ArmorStyle => ARMOR_STYLES[i] ?? "clothes";
export const helmStyle = (i: number): HelmStyle => HELM_STYLES[i] ?? "none";
export const weaponArt = (i: number): WeaponArtKey => WEAPON_ARTS[i] ?? "sword_iron";

/** Art shown when a weapon class is used without a specific item (e.g. dev weapon swaps). */
export const DEFAULT_WEAPON_ART: Record<string, WeaponArtKey> = {
  sword: "sword_iron", greatsword: "gs_iron", daggers: "dg_knives", spear: "sp_hunting", staff: "st_oak",
};
