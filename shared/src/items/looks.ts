/**
 * Visible equipment styles. Each armour, helm and weapon names one of these, and the
 * index is synced on the player so everyone sees what you wear.
 */
export const ARMOR_STYLES = ["clothes", "padded", "leather", "ranger", "chain", "robes", "plate", "warden", "dawn", "scale", "brigandine", "shadow", "arcanist", "gilded", "skyguard", "stormweave", "hide", "ringmail", "templar", "windrunner", "sunforged", "mystic", "dragonscale", "drakehide", "emberweave", "rimeplate", "furmantle", "frostweave"] as const;
export type ArmorStyle = (typeof ARMOR_STYLES)[number];

export const HELM_STYLES = ["none", "cap", "hood", "iron", "circlet", "horned", "keeper", "bandana", "wizard", "kettle", "greathelm", "winged", "stormcrown", "coif", "templar", "suncrown", "dragonhelm", "embercirclet", "rimecrown", "furhood"] as const;
export type HelmStyle = (typeof HELM_STYLES)[number];

export const WEAPON_ARTS = [
  "sword_rusty", "sword_iron", "sword_ember", "sword_dawn",
  "gs_iron", "gs_cleaver", "gs_warden",
  "dg_knives", "dg_fangs",
  "sp_hunting", "sp_pike",
  "st_oak", "st_ember",
  // Added later: new indices only ever go at the end (the index is synced to clients).
  "sword_steel", "sword_knight", "sword_frost",
  "gs_zwei", "gs_exec",
  "dg_kris", "dg_night",
  "sp_glaive", "sp_trident",
  "st_frost", "st_moon",
  // Floor 2: the Stormglass set.
  "sword_storm", "gs_storm", "dg_storm", "sp_storm", "st_storm",
  // The third wave.
  "sword_bronze", "sword_falchion", "sword_royal",
  "gs_bone", "gs_moon", "gs_gilded",
  "dg_bone", "dg_duel", "dg_gilded",
  "sp_partisan", "sp_halberd", "sp_sun",
  "st_bone", "st_crystal", "st_sun",
  // Floor 3: the Dragonscale set.
  "sword_dragon", "gs_dragon", "dg_dragon", "sp_dragon", "st_dragon",
  // Floor 4: the Frostforged set.
  "sword_rime", "gs_rime", "dg_rime", "sp_rime", "st_rime",
] as const;
export type WeaponArtKey = (typeof WEAPON_ARTS)[number];

export const armorStyle = (i: number): ArmorStyle => ARMOR_STYLES[i] ?? "clothes";
export const helmStyle = (i: number): HelmStyle => HELM_STYLES[i] ?? "none";
export const weaponArt = (i: number): WeaponArtKey => WEAPON_ARTS[i] ?? "sword_iron";

/** Art shown when a weapon class is used without a specific item (e.g. dev weapon swaps). */
export const DEFAULT_WEAPON_ART: Record<string, WeaponArtKey> = {
  sword: "sword_iron", greatsword: "gs_iron", daggers: "dg_knives", spear: "sp_hunting", staff: "st_oak",
};
