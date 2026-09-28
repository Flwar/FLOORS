import { armorStyle, DEFAULT_WEAPON_ART, helmStyle, itemBase, RARITY_COLORS } from "@floors/shared";
import { drawGearIcon } from "../art/characters.ts";

const cache = new Map<string, string>();
const canvases = new Map<string, HTMLCanvasElement>();

/** The icon as a canvas (for in-world drops). */
export function itemIconCanvas(key: string, rarity = 0): HTMLCanvasElement {
  itemIcon(key, rarity);
  return canvases.get(`${key}:${rarity}`)!;
}
const S = 64;

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** A 64×64 icon for an item, as a data URL (cached). */
export function itemIcon(key: string, rarity = 0): string {
  const id = `${key}:${rarity}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.lineJoin = "round";
  g.lineCap = "round";
  const base = itemBase(key);
  const accent = RARITY_COLORS[rarity] ?? RARITY_COLORS[0];
  // Soft rarity glow behind the object.
  if (rarity > 0) {
    const glow = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
    glow.addColorStop(0, `${accent}66`);
    glow.addColorStop(1, `${accent}00`);
    g.fillStyle = glow;
    g.fillRect(0, 0, S, S);
  }
  const outline = "#1d1a17";
  // Equipment icons use the same art as the character wearing it.
  if (base && (base.kind === "weapon" || base.kind === "armor" || base.kind === "helm")) {
    const style = base.kind === "weapon" ? base.art ?? DEFAULT_WEAPON_ART[base.weapon ?? "sword"] : base.kind === "armor" ? armorStyle(base.look ?? 0) : helmStyle(base.look ?? 0);
    drawGearIcon(g, S, base.kind, style, rarity);
  } else switch (base?.kind === "consumable" || base?.kind === "material" || base?.kind === "artifact" || base?.kind === "key" ? key : base?.kind) {
    case "charm": {
      g.strokeStyle = "#c9a24a";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(32, 22, 14, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 38, 13, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c9a24a";
      g.beginPath();
      g.arc(32, 38, 10, 0, Math.PI * 2);
      g.fill();
      const gem = g.createRadialGradient(30, 35, 1, 32, 38, 7);
      gem.addColorStop(0, "#ffffff");
      gem.addColorStop(1, rarity ? accent : "#d8453c");
      g.fillStyle = gem;
      g.beginPath();
      g.arc(32, 38, 6, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "tonic": {
      g.fillStyle = outline;
      rr(g, 20, 22, 24, 32, 10);
      g.fill();
      g.fillRect(27, 10, 10, 14);
      const lg = g.createLinearGradient(0, 24, 0, 52);
      lg.addColorStop(0, "#ff7a6a");
      lg.addColorStop(1, "#b02a22");
      g.fillStyle = lg;
      rr(g, 23, 30, 18, 21, 8);
      g.fill();
      g.fillStyle = "#e9dcc0";
      g.fillRect(29, 12, 6, 9);
      g.fillStyle = "rgba(255,255,255,0.6)";
      g.fillRect(26, 32, 3, 12);
      break;
    }
    case "mat_pelt":
      g.fillStyle = outline;
      g.beginPath();
      g.ellipse(32, 34, 22, 16, 0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#7d7f86";
      g.beginPath();
      g.ellipse(32, 34, 19, 13, 0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#d9d4c8";
      g.beginPath();
      g.ellipse(34, 38, 10, 5, 0.2, 0, Math.PI * 2);
      g.fill();
      break;
    case "mat_scrap":
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 32, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#8b96a1";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillRect(32 + Math.cos(a) * 14 - 3, 32 + Math.sin(a) * 14 - 3, 6, 6);
      }
      g.beginPath();
      g.arc(32, 32, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 32, 5, 0, Math.PI * 2);
      g.fill();
      break;
    case "mat_cloth":
      g.fillStyle = outline;
      rr(g, 12, 18, 40, 28, 5);
      g.fill();
      g.fillStyle = "#2e2640";
      rr(g, 14, 20, 36, 24, 4);
      g.fill();
      g.strokeStyle = "#a98bff";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(32, 32, 7, 0, Math.PI * 2);
      g.stroke();
      break;
    case "mat_shard":
    case "art_gatestone":
    case "mat_ember": {
      const col = key === "mat_ember" ? ["#ffd08a", "#e8622c"] : key === "art_gatestone" ? ["#fff6c8", "#f0c860"] : ["#c8f4ff", "#4fa6d8"];
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(32, 6);
      g.lineTo(48, 30);
      g.lineTo(32, 58);
      g.lineTo(16, 30);
      g.fill();
      const cg = g.createLinearGradient(16, 0, 48, 0);
      cg.addColorStop(0, col[0]);
      cg.addColorStop(1, col[1]);
      g.fillStyle = cg;
      g.beginPath();
      g.moveTo(32, 10);
      g.lineTo(45, 30);
      g.lineTo(32, 54);
      g.lineTo(19, 30);
      g.fill();
      break;
    }
    case "art_lens":
      g.strokeStyle = outline;
      g.lineWidth = 8;
      g.beginPath();
      g.arc(28, 28, 14, 0, Math.PI * 2);
      g.moveTo(38, 38);
      g.lineTo(52, 52);
      g.stroke();
      g.strokeStyle = "#c9a24a";
      g.lineWidth = 4;
      g.stroke();
      g.fillStyle = "rgba(160,220,255,0.6)";
      g.beginPath();
      g.arc(28, 28, 11, 0, Math.PI * 2);
      g.fill();
      break;
    case "art_idol":
      g.fillStyle = outline;
      rr(g, 20, 10, 24, 46, 10);
      g.fill();
      g.fillStyle = "#6b6f7a";
      rr(g, 23, 13, 18, 40, 8);
      g.fill();
      g.fillStyle = "#a98bff";
      g.fillRect(27, 24, 3, 3);
      g.fillRect(34, 24, 3, 3);
      break;
    case "key_ruins":
      g.strokeStyle = outline;
      g.lineWidth = 9;
      g.beginPath();
      g.arc(22, 24, 9, 0, Math.PI * 2);
      g.moveTo(29, 31);
      g.lineTo(50, 52);
      g.moveTo(44, 46);
      g.lineTo(38, 52);
      g.stroke();
      g.strokeStyle = "#c9a24a";
      g.lineWidth = 5;
      g.stroke();
      break;
    default:
      g.fillStyle = "#6b6f7a";
      rr(g, 18, 18, 28, 28, 6);
      g.fill();
  }
  const url = c.toDataURL();
  cache.set(id, url);
  canvases.set(id, c);
  return url;
}

export function goldIcon(): string {
  const id = "gold";
  const hit = cache.get(id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  for (const [x, y] of [[24, 40], [40, 40], [32, 30]]) {
    g.fillStyle = "#1d1a17";
    g.beginPath();
    g.ellipse(x, y, 12, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2c94c";
    g.beginPath();
    g.ellipse(x, y - 1, 10, 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  const url = c.toDataURL();
  cache.set(id, url);
  return url;
}
