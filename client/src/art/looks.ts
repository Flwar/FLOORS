import { armorStyle, helmStyle, type HelmStyle } from "@floors/shared";
import { ARMOR_BULK, type CharLook, type HelmKind } from "./characters.ts";

const HAIR = ["#3b2a20", "#6b4226", "#b8863b", "#d9c07a", "#2b2b30", "#8a3b2a", "#e8e0d0"];
const SKIN = ["#f1d0ae", "#d9a77c", "#a8744f", "#7a5236"];
const HELM_KIND: Record<HelmStyle, HelmKind> = {
  none: "none", cap: "cap", hood: "hood", iron: "iron", circlet: "circlet", horned: "horned", keeper: "keeper",
  bandana: "bandana", wizard: "wizard", kettle: "kettle", greathelm: "greathelm", winged: "winged", stormcrown: "stormcrown", coif: "coif", templar: "templar", suncrown: "suncrown", dragonhelm: "dragonhelm", embercirclet: "embercirclet", rimecrown: "rimecrown", furhood: "furhood",
};

function hsv(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${((f(5) << 16) | (f(3) << 8) | f(1)).toString(16).padStart(6, "0")}`;
}

/** A player's appearance: personal colours from `hue`, plus the armour and helm they wear. */
export function personLook(hue: number, armor: number, helm: number): CharLook {
  const accent = hsv(hue / 360, 0.5, 0.72);
  const style = armorStyle(armor);
  return {
    key: `p:${hue}:${armor}:${helm}`,
    skin: SKIN[hue % SKIN.length],
    hair: HAIR[hue % HAIR.length],
    cloth: accent,
    trim: "#6b4a2b",
    accent,
    helm: HELM_KIND[helmStyle(helm)],
    armor: style,
    bulk: ARMOR_BULK[style],
  };
}
