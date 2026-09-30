import { armorStyle, DEFAULT_WEAPON_ART, helmStyle, itemBase, RARITY_COLORS } from "@floors/shared";
import { drawGearIcon } from "../art/characters.ts";
import { drawEntryIcon } from "./skillIcons.ts";
import { drawUiIcon } from "./uiIcons.ts";

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
  } else if (base?.kind === "scroll") {
    drawScroll(g, base.skill ?? "", accent);
  } else if (key.startsWith("map_")) {
    drawMap(g);
  } else switch (base?.kind === "consumable" || base?.kind === "material" || base?.kind === "artifact" || base?.kind === "key" ? key : base?.kind) {
    // --- Floor 8: the Sunscorched Sands ------------------------------------------------
    case "mat_sunstone": {
      // A chip of amber desert glass, still warm.
      const halo = g.createRadialGradient(32, 34, 3, 32, 34, 26);
      halo.addColorStop(0, "rgba(255,200,90,0.8)");
      halo.addColorStop(1, "rgba(255,160,40,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(18, 46); g.lineTo(24, 18); g.lineTo(40, 12); g.lineTo(48, 30); g.lineTo(42, 52); g.lineTo(26, 54);
      g.closePath();
      g.fill();
      const sg = g.createLinearGradient(20, 14, 46, 52);
      sg.addColorStop(0, "#fff4c8");
      sg.addColorStop(0.5, "#ffb040");
      sg.addColorStop(1, "#b8641c");
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(21, 45); g.lineTo(26, 20); g.lineTo(39, 15); g.lineTo(45, 30); g.lineTo(40, 49); g.lineTo(27, 51);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.75)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(28, 22); g.lineTo(26, 40);
      g.stroke();
      break;
    }
    case "mat_scarab": {
      // A golden beetle's wing-case.
      g.fillStyle = outline;
      g.beginPath();
      g.ellipse(32, 34, 17, 21, 0, 0, Math.PI * 2);
      g.fill();
      const cg = g.createRadialGradient(26, 26, 2, 32, 34, 20);
      cg.addColorStop(0, "#fff4c0");
      cg.addColorStop(0.55, "#e8b030");
      cg.addColorStop(1, "#8a5a10");
      g.fillStyle = cg;
      g.beginPath();
      g.ellipse(32, 34, 14.5, 18.5, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = outline;
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(32, 16); g.lineTo(32, 52);
      g.moveTo(20, 26); g.quadraticCurveTo(32, 22, 44, 26);
      g.stroke();
      g.fillStyle = "#2a5aa8";
      g.beginPath();
      g.arc(32, 14, 5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "mat_solarheart":
    case "key_pyramid": {
      // A noon you can hold (and the Solar Seal: a gold disc with a sun on its face).
      const seal = key === "key_pyramid";
      const halo = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      halo.addColorStop(0, "rgba(255,240,170,0.95)");
      halo.addColorStop(1, "rgba(255,180,40,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      g.fillStyle = outline;
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const rad = i % 2 ? (seal ? 19 : 14) : seal ? 24 : 20;
        g.lineTo(32 + Math.cos(ang) * rad, 32 + Math.sin(ang) * rad);
      }
      g.closePath();
      g.fill();
      const sg = g.createRadialGradient(28, 28, 2, 32, 32, seal ? 20 : 15);
      sg.addColorStop(0, "#ffffff");
      sg.addColorStop(0.5, "#ffe08a");
      sg.addColorStop(1, "#d88a20");
      g.fillStyle = sg;
      g.beginPath();
      g.arc(32, 32, seal ? 16 : 11.5, 0, Math.PI * 2);
      g.fill();
      if (seal) {
        // The closed eye on the seal's face.
        g.strokeStyle = outline;
        g.lineWidth = 2.6;
        g.beginPath();
        g.arc(32, 28, 8, Math.PI * 0.15, Math.PI * 0.85);
        g.stroke();
        for (const dx of [-5, 0, 5]) {
          g.beginPath();
          g.moveTo(32 + dx, 35);
          g.lineTo(32 + dx * 1.3, 39);
          g.stroke();
        }
      }
      break;
    }
    case "art_suncrown": {
      // The Sun Pharaoh's crown: a gold band, a sun disc between horns, a cobra at the brow.
      const halo = g.createRadialGradient(32, 26, 4, 32, 26, 30);
      halo.addColorStop(0, "rgba(255,230,140,0.8)");
      halo.addColorStop(1, "rgba(255,180,40,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(12, 52); g.lineTo(14, 36); g.lineTo(50, 36); g.lineTo(52, 52);
      g.closePath();
      g.fill();
      g.beginPath();
      g.arc(32, 22, 14, 0, Math.PI * 2);
      g.fill();
      const bg = g.createLinearGradient(0, 36, 0, 52);
      bg.addColorStop(0, "#fff0a0");
      bg.addColorStop(1, "#c8862a");
      g.fillStyle = bg;
      g.fillRect(15, 38, 34, 12);
      g.fillStyle = "#2a5aa8";
      for (let x = 17; x < 48; x += 6) g.fillRect(x, 40, 3, 8);
      const dg = g.createRadialGradient(28, 18, 2, 32, 22, 12);
      dg.addColorStop(0, "#ffffff");
      dg.addColorStop(0.5, "#ffd24a");
      dg.addColorStop(1, "#e87a20");
      g.fillStyle = dg;
      g.beginPath();
      g.arc(32, 22, 11, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "mat_essence": {
      const halo = g.createRadialGradient(32, 34, 3, 32, 34, 28);
      halo.addColorStop(0, "rgba(214,160,255,0.95)");
      halo.addColorStop(1, "rgba(120,60,200,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(32, 8); g.lineTo(46, 30); g.lineTo(32, 58); g.lineTo(18, 30);
      g.closePath();
      g.fill();
      const eg = g.createLinearGradient(20, 10, 44, 56);
      eg.addColorStop(0, "#fbeaff");
      eg.addColorStop(0.45, "#c07cff");
      eg.addColorStop(1, "#5a2a9a");
      g.fillStyle = eg;
      g.beginPath();
      g.moveTo(32, 12); g.lineTo(42, 30); g.lineTo(32, 53); g.lineTo(22, 30);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(32, 14); g.lineTo(27, 30); g.lineTo(32, 48);
      g.stroke();
      break;
    }
    case "mat_rimeshard": {
      // A long shard of blue-white ice.
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(30, 4); g.lineTo(46, 22); g.lineTo(40, 60); g.lineTo(22, 56); g.lineTo(18, 24);
      g.closePath();
      g.fill();
      const rg = g.createLinearGradient(18, 6, 46, 58);
      rg.addColorStop(0, "#ffffff");
      rg.addColorStop(0.5, "#cfe8f8");
      rg.addColorStop(1, "#6f9fcf");
      g.fillStyle = rg;
      g.beginPath();
      g.moveTo(30, 9); g.lineTo(42, 23); g.lineTo(37, 56); g.lineTo(25, 53); g.lineTo(22, 25);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(30, 14); g.lineTo(28, 48);
      g.stroke();
      break;
    }
    case "mat_frostpelt": {
      // A white pelt with a pale blue sheen.
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(10, 22); g.quadraticCurveTo(20, 10, 32, 14); g.quadraticCurveTo(44, 10, 54, 22);
      g.lineTo(50, 44); g.quadraticCurveTo(32, 58, 14, 44);
      g.closePath();
      g.fill();
      const pg = g.createLinearGradient(0, 12, 0, 52);
      pg.addColorStop(0, "#ffffff");
      pg.addColorStop(1, "#b8c8d6");
      g.fillStyle = pg;
      g.beginPath();
      g.moveTo(14, 23); g.quadraticCurveTo(22, 14, 32, 18); g.quadraticCurveTo(42, 14, 50, 23);
      g.lineTo(47, 42); g.quadraticCurveTo(32, 53, 17, 42);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(111,184,255,0.55)";
      g.lineWidth = 1.5;
      for (const x of [22, 30, 38]) {
        g.beginPath();
        g.moveTo(x, 24); g.lineTo(x + 2, 42);
        g.stroke();
      }
      break;
    }
    case "mat_glacialheart":
    case "art_wintercrown": {
      const crown = key === "art_wintercrown";
      const halo = g.createRadialGradient(32, 34, 4, 32, 34, 30);
      halo.addColorStop(0, "rgba(191,230,255,0.9)");
      halo.addColorStop(1, "rgba(111,184,255,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      if (crown) {
        // A crown of icicles on a band of blue steel.
        g.fillStyle = outline;
        g.beginPath();
        g.moveTo(10, 46); g.lineTo(12, 22); g.lineTo(20, 34); g.lineTo(26, 12); g.lineTo(32, 30); g.lineTo(38, 12); g.lineTo(44, 34); g.lineTo(52, 22); g.lineTo(54, 46);
        g.closePath();
        g.fill();
        const cg = g.createLinearGradient(0, 12, 0, 46);
        cg.addColorStop(0, "#ffffff");
        cg.addColorStop(1, "#8fb8dc");
        g.fillStyle = cg;
        g.beginPath();
        g.moveTo(13, 43); g.lineTo(14, 27); g.lineTo(20, 37); g.lineTo(26, 18); g.lineTo(32, 34); g.lineTo(38, 18); g.lineTo(44, 37); g.lineTo(50, 27); g.lineTo(51, 43);
        g.closePath();
        g.fill();
        g.fillStyle = "#6fb8ff";
        g.beginPath();
        g.arc(32, 40, 3.5, 0, Math.PI * 2);
        g.fill();
      } else {
        // A heart of beating blue ice.
        g.fillStyle = outline;
        g.beginPath();
        g.moveTo(32, 54);
        g.bezierCurveTo(8, 38, 12, 14, 26, 16);
        g.quadraticCurveTo(32, 18, 32, 24);
        g.quadraticCurveTo(32, 18, 38, 16);
        g.bezierCurveTo(52, 14, 56, 38, 32, 54);
        g.fill();
        const hg = g.createRadialGradient(28, 28, 2, 32, 34, 22);
        hg.addColorStop(0, "#ffffff");
        hg.addColorStop(0.45, "#9fd8ff");
        hg.addColorStop(1, "#2e5a8a");
        g.fillStyle = hg;
        g.beginPath();
        g.moveTo(32, 50);
        g.bezierCurveTo(12, 36, 15, 18, 26, 19);
        g.quadraticCurveTo(31, 21, 32, 27);
        g.quadraticCurveTo(33, 21, 38, 19);
        g.bezierCurveTo(49, 18, 52, 36, 32, 50);
        g.fill();
      }
      break;
    }
    case "key_glacier": {
      // The Rime Seal: a disc of ice holding a snowflake.
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 32, 22, 0, Math.PI * 2);
      g.fill();
      const sg = g.createRadialGradient(26, 24, 2, 32, 32, 20);
      sg.addColorStop(0, "#ffffff");
      sg.addColorStop(1, "#6f9fcf");
      g.fillStyle = sg;
      g.beginPath();
      g.arc(32, 32, 19, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#1e3a5a";
      g.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const an = (i * Math.PI) / 3;
        g.beginPath();
        g.moveTo(32 - Math.cos(an) * 12, 32 - Math.sin(an) * 12);
        g.lineTo(32 + Math.cos(an) * 12, 32 + Math.sin(an) * 12);
        g.stroke();
      }
      break;
    }
    // --- Floor 7: the Clockwork Heights ----------------------------------------------
    case "mat_brassgear":
    case "key_engine": {
      const big = key === "key_engine";
      const r = big ? 20 : 15;
      g.fillStyle = outline;
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = i % 2 ? r + 2 : r + 7;
        g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      const gg = g.createRadialGradient(26, 26, 2, 32, 32, r + 4);
      gg.addColorStop(0, "#fff0c0");
      gg.addColorStop(1, big ? "#c87a28" : "#a07028");
      g.fillStyle = gg;
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = i % 2 ? r : r + 4.5;
        g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 32, r * 0.35, 0, Math.PI * 2);
      g.fill();
      if (big) {
        g.fillStyle = "#ffb040";
        g.beginPath();
        g.arc(32, 32, r * 0.2, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "mat_spring": {
      g.strokeStyle = outline;
      g.lineWidth = 7;
      g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = t * Math.PI * 8;
        const rr = 4 + t * 18;
        g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr);
      }
      g.stroke();
      g.strokeStyle = "#6a8ab8";
      g.lineWidth = 3.5;
      g.stroke();
      break;
    }
    case "mat_aethercore":
    case "art_archoncore": {
      const halo = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      halo.addColorStop(0, key === "art_archoncore" ? "rgba(255,176,64,0.9)" : "rgba(159,211,255,0.9)");
      halo.addColorStop(1, "rgba(80,120,200,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 32, 17, 0, Math.PI * 2);
      g.fill();
      const cg = g.createRadialGradient(28, 28, 2, 32, 32, 15);
      cg.addColorStop(0, "#ffffff");
      cg.addColorStop(0.5, key === "art_archoncore" ? "#ffb040" : "#9fd3ff");
      cg.addColorStop(1, key === "art_archoncore" ? "#8a3a10" : "#2a5a8a");
      g.fillStyle = cg;
      g.beginPath();
      g.arc(32, 32, 14.5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#c8a048";
      g.lineWidth = 3;
      for (const a of [0, Math.PI / 2]) {
        g.beginPath();
        g.ellipse(32, 32, 18, 6, a, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    // --- Floor 6: the Drowned Isles --------------------------------------------------
    case "mat_coral": {
      // A branch of living coral.
      for (const [col, wd] of [[outline, 9], ["#ff8a7a", 5]] as const) {
        g.strokeStyle = col;
        g.lineWidth = wd;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(32, 58); g.lineTo(32, 30);
        g.moveTo(32, 40); g.lineTo(18, 24); g.lineTo(16, 12);
        g.moveTo(32, 34); g.lineTo(46, 18); g.lineTo(50, 8);
        g.moveTo(18, 24); g.lineTo(10, 20);
        g.moveTo(46, 18); g.lineTo(54, 22);
        g.stroke();
      }
      break;
    }
    case "mat_brinepearl": {
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 34, 16, 0, Math.PI * 2);
      g.fill();
      const pg = g.createRadialGradient(26, 28, 2, 32, 34, 15);
      pg.addColorStop(0, "#ffffff");
      pg.addColorStop(0.6, "#b8c8c4");
      pg.addColorStop(1, "#5a7a7a");
      g.fillStyle = pg;
      g.beginPath();
      g.arc(32, 34, 13.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "mat_leviathanscale":
    case "art_tidecrown": {
      const halo = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      halo.addColorStop(0, "rgba(143,240,224,0.85)");
      halo.addColorStop(1, "rgba(31,168,192,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      if (key === "art_tidecrown") {
        // A crown of coral and pearl.
        g.fillStyle = outline;
        g.fillRect(12, 34, 40, 14);
        g.fillStyle = "#f4ecd8";
        g.fillRect(14, 36, 36, 10);
        for (const [x, h, col] of [[18, 20, "#ff8a7a"], [32, 26, "#ff9a6a"], [46, 20, "#ff8a7a"]] as const) {
          g.strokeStyle = outline;
          g.lineWidth = 7;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(x, 36); g.lineTo(x, 36 - h);
          g.stroke();
          g.strokeStyle = col;
          g.lineWidth = 4;
          g.stroke();
        }
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(32, 41, 3.5, 0, Math.PI * 2);
        g.fill();
      } else {
        // A shield-sized scale, sea-green and iridescent.
        g.fillStyle = outline;
        g.beginPath();
        g.moveTo(32, 6); g.quadraticCurveTo(56, 20, 50, 44); g.quadraticCurveTo(32, 62, 14, 44); g.quadraticCurveTo(8, 20, 32, 6);
        g.fill();
        const sg = g.createLinearGradient(12, 8, 52, 56);
        sg.addColorStop(0, "#dffaf4");
        sg.addColorStop(0.5, "#3fb8b0");
        sg.addColorStop(1, "#1e4a5a");
        g.fillStyle = sg;
        g.beginPath();
        g.moveTo(32, 10); g.quadraticCurveTo(52, 22, 47, 43); g.quadraticCurveTo(32, 58, 17, 43); g.quadraticCurveTo(12, 22, 32, 10);
        g.fill();
      }
      break;
    }
    case "key_cathedral": {
      // An iron key crusted with barnacles.
      g.strokeStyle = outline;
      g.lineWidth = 9;
      g.lineCap = "round";
      g.beginPath();
      g.arc(22, 24, 10, 0, Math.PI * 2);
      g.moveTo(30, 32); g.lineTo(52, 54);
      g.moveTo(44, 46); g.lineTo(50, 40);
      g.moveTo(48, 50); g.lineTo(54, 44);
      g.stroke();
      g.strokeStyle = "#5a6a6a";
      g.lineWidth = 5;
      g.stroke();
      g.fillStyle = "#e8e0d0";
      for (const [x, y] of [[16, 18], [28, 26], [40, 42]] as const) {
        g.beginPath();
        g.arc(x, y, 2.4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    // --- Floor 5: the Umbral Wilds ---------------------------------------------------
    case "mat_umbralshard": {
      // A splinter of night: a black shard with a violet edge.
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(34, 4); g.lineTo(48, 26); g.lineTo(38, 60); g.lineTo(20, 52); g.lineTo(18, 22);
      g.closePath();
      g.fill();
      const ug = g.createLinearGradient(18, 6, 48, 58);
      ug.addColorStop(0, "#b77af2");
      ug.addColorStop(0.4, "#2a1a44");
      ug.addColorStop(1, "#0c0814");
      g.fillStyle = ug;
      g.beginPath();
      g.moveTo(34, 9); g.lineTo(44, 26); g.lineTo(36, 56); g.lineTo(23, 50); g.lineTo(22, 24);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(224,200,255,0.9)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(34, 12); g.lineTo(42, 27);
      g.stroke();
      break;
    }
    case "mat_shadowsilk": {
      // A spool of thread spun from shadow.
      g.fillStyle = outline;
      g.fillRect(14, 10, 36, 8);
      g.fillRect(14, 46, 36, 8);
      g.fillRect(18, 16, 28, 32);
      g.fillStyle = "#6a5a4a";
      g.fillRect(16, 12, 32, 4);
      g.fillRect(16, 48, 32, 4);
      const sg = g.createLinearGradient(20, 0, 44, 0);
      sg.addColorStop(0, "#3a2e54");
      sg.addColorStop(0.5, "#6a5a9a");
      sg.addColorStop(1, "#1e1830");
      g.fillStyle = sg;
      g.fillRect(20, 17, 24, 30);
      g.strokeStyle = "rgba(216,184,255,0.55)";
      g.lineWidth = 1.2;
      for (let y = 20; y < 46; y += 4) {
        g.beginPath();
        g.moveTo(20, y); g.lineTo(44, y + 2);
        g.stroke();
      }
      break;
    }
    case "mat_voidheart":
    case "art_eclipse": {
      const halo = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      halo.addColorStop(0, key === "art_eclipse" ? "rgba(255,255,255,0.95)" : "rgba(183,122,242,0.8)");
      halo.addColorStop(1, "rgba(120,80,200,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      if (key === "art_eclipse") {
        // A sliver of the eclipse: a black disc wearing a white corona.
        g.fillStyle = outline;
        g.beginPath();
        g.arc(32, 32, 19, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#06040a";
        g.beginPath();
        g.arc(32, 32, 16, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#f4f0ff";
        g.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * Math.PI * 2;
          g.beginPath();
          g.moveTo(32 + Math.cos(an) * 20, 32 + Math.sin(an) * 20);
          g.lineTo(32 + Math.cos(an) * (25 + (i % 2) * 4), 32 + Math.sin(an) * (25 + (i % 2) * 4));
          g.stroke();
        }
      } else {
        // A hole in the world the size of a fist.
        g.fillStyle = outline;
        g.beginPath();
        g.moveTo(32, 54);
        g.bezierCurveTo(8, 38, 12, 14, 26, 16);
        g.quadraticCurveTo(32, 18, 32, 24);
        g.quadraticCurveTo(32, 18, 38, 16);
        g.bezierCurveTo(52, 14, 56, 38, 32, 54);
        g.fill();
        const hg = g.createRadialGradient(32, 32, 2, 32, 34, 22);
        hg.addColorStop(0, "#000000");
        hg.addColorStop(0.6, "#1a0e2e");
        hg.addColorStop(1, "#b77af2");
        g.fillStyle = hg;
        g.beginPath();
        g.moveTo(32, 50);
        g.bezierCurveTo(12, 36, 15, 18, 26, 19);
        g.quadraticCurveTo(31, 21, 32, 27);
        g.quadraticCurveTo(33, 21, 38, 19);
        g.bezierCurveTo(49, 18, 52, 36, 32, 50);
        g.fill();
      }
      break;
    }
    case "key_sanctum": {
      // The Moon Sigil: a silver disc holding a crescent.
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 32, 22, 0, Math.PI * 2);
      g.fill();
      const mg = g.createRadialGradient(26, 24, 2, 32, 32, 20);
      mg.addColorStop(0, "#ffffff");
      mg.addColorStop(1, "#9a90b0");
      g.fillStyle = mg;
      g.beginPath();
      g.arc(32, 32, 19, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#2a1a44";
      g.beginPath();
      g.arc(32, 32, 12, Math.PI * 0.3, Math.PI * 1.7, false);
      g.arc(38, 32, 9.4, Math.PI * 1.62, Math.PI * 0.38, true);
      g.closePath();
      g.fill();
      break;
    }
    case "mat_cinder": {
      // A lump of black stone, glowing through its cracks.
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(14, 40); g.lineTo(22, 18); g.lineTo(40, 14); g.lineTo(52, 30); g.lineTo(46, 50); g.lineTo(24, 52);
      g.closePath();
      g.fill();
      const cg = g.createLinearGradient(16, 16, 48, 50);
      cg.addColorStop(0, "#4a4440");
      cg.addColorStop(1, "#1f1b19");
      g.fillStyle = cg;
      g.beginPath();
      g.moveTo(18, 40); g.lineTo(24, 21); g.lineTo(39, 18); g.lineTo(48, 31); g.lineTo(43, 47); g.lineTo(25, 48);
      g.closePath();
      g.fill();
      g.strokeStyle = "#ff8a3a";
      g.lineWidth = 2.5;
      g.shadowColor = "#ff6a1a";
      g.shadowBlur = 8;
      g.beginPath();
      g.moveTo(26, 24); g.lineTo(32, 33); g.lineTo(28, 42);
      g.moveTo(32, 33); g.lineTo(42, 30);
      g.stroke();
      g.shadowBlur = 0;
      break;
    }
    case "mat_dragonscale": {
      // A single great scale, ridged and red-bronze.
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(32, 8);
      g.quadraticCurveTo(54, 20, 48, 42);
      g.quadraticCurveTo(40, 56, 32, 58);
      g.quadraticCurveTo(24, 56, 16, 42);
      g.quadraticCurveTo(10, 20, 32, 8);
      g.fill();
      const sg = g.createLinearGradient(16, 10, 48, 56);
      sg.addColorStop(0, "#e87a4a");
      sg.addColorStop(0.6, "#9a2e22");
      sg.addColorStop(1, "#5a1a14");
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(32, 12);
      g.quadraticCurveTo(50, 22, 45, 41);
      g.quadraticCurveTo(38, 53, 32, 54);
      g.quadraticCurveTo(26, 53, 19, 41);
      g.quadraticCurveTo(14, 22, 32, 12);
      g.fill();
      g.strokeStyle = "rgba(255,210,150,0.55)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(32, 16); g.lineTo(32, 50);
      g.moveTo(24, 26); g.quadraticCurveTo(32, 32, 40, 26);
      g.moveTo(22, 38); g.quadraticCurveTo(32, 44, 42, 38);
      g.stroke();
      break;
    }
    case "mat_emberheart":
    case "art_dragonheart": {
      // A living coal: the heart of a dragon's fire.
      const big = key === "art_dragonheart";
      const halo = g.createRadialGradient(32, 34, 4, 32, 34, 30);
      halo.addColorStop(0, "rgba(255,160,60,0.85)");
      halo.addColorStop(1, "rgba(255,80,20,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(32, 54);
      g.bezierCurveTo(8, 38, 12, 14, 26, 16);
      g.quadraticCurveTo(32, 18, 32, 24);
      g.quadraticCurveTo(32, 18, 38, 16);
      g.bezierCurveTo(52, 14, 56, 38, 32, 54);
      g.fill();
      const hg = g.createRadialGradient(28, 28, 2, 32, 34, 22);
      hg.addColorStop(0, "#fff6d8");
      hg.addColorStop(0.4, big ? "#ff7a2a" : "#ffb347");
      hg.addColorStop(1, big ? "#8a1a14" : "#c4402c");
      g.fillStyle = hg;
      g.beginPath();
      g.moveTo(32, 50);
      g.bezierCurveTo(12, 36, 15, 18, 26, 19);
      g.quadraticCurveTo(31, 21, 32, 27);
      g.quadraticCurveTo(33, 21, 38, 19);
      g.bezierCurveTo(49, 18, 52, 36, 32, 50);
      g.fill();
      break;
    }
    case "key_roost": {
      // The Emberwyrm Sigil: a bronze disc bearing a coiled dragon.
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 32, 22, 0, Math.PI * 2);
      g.fill();
      const dg = g.createRadialGradient(26, 24, 2, 32, 32, 20);
      dg.addColorStop(0, "#ffd08a");
      dg.addColorStop(1, "#9a4a22");
      g.fillStyle = dg;
      g.beginPath();
      g.arc(32, 32, 19, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#3a1a10";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(32, 32, 10, Math.PI * 0.2, Math.PI * 1.8);
      g.stroke();
      g.fillStyle = "#3a1a10";
      g.beginPath();
      g.moveTo(40, 26); g.lineTo(48, 22); g.lineTo(44, 30);
      g.closePath();
      g.fill();
      break;
    }
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
    case "map_floor1":
    case "map_floor2":
      drawUiIcon(g, "map");
      break;
    // --- Floor 2 ---------------------------------------------------------------
    case "mat_feather": {
      // A long white-gold flight feather.
      g.save();
      g.translate(32, 32);
      g.rotate(-0.7);
      g.fillStyle = outline;
      g.beginPath();
      g.ellipse(0, -4, 11, 24, 0, 0, Math.PI * 2);
      g.fill();
      const fg = g.createLinearGradient(-9, 0, 9, 0);
      fg.addColorStop(0, "#fff6dc");
      fg.addColorStop(1, "#e8c46a");
      g.fillStyle = fg;
      g.beginPath();
      g.ellipse(0, -4, 8, 21, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#b8902e";
      g.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        g.moveTo(0, -4 + i * 5);
        g.lineTo(7, -9 + i * 5);
        g.moveTo(0, -4 + i * 5);
        g.lineTo(-7, -9 + i * 5);
        g.stroke();
      }
      g.strokeStyle = outline;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, -22);
      g.lineTo(0, 28);
      g.stroke();
      g.restore();
      break;
    }
    case "mat_stormglass": {
      // A shard of pale-blue glass with a lightning glint.
      g.fillStyle = outline;
      g.beginPath();
      g.moveTo(34, 6); g.lineTo(50, 26); g.lineTo(42, 58); g.lineTo(20, 54); g.lineTo(14, 28);
      g.closePath();
      g.fill();
      const sg = g.createLinearGradient(14, 8, 48, 56);
      sg.addColorStop(0, "#eaf6ff");
      sg.addColorStop(0.5, "#9fcaf2");
      sg.addColorStop(1, "#4f78b8");
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(34, 11); g.lineTo(46, 27); g.lineTo(39, 54); g.lineTo(23, 51); g.lineTo(18, 29);
      g.closePath();
      g.fill();
      g.strokeStyle = "#ffffff";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(33, 16); g.lineTo(28, 30); g.lineTo(35, 33); g.lineTo(29, 47);
      g.stroke();
      break;
    }
    case "mat_gilded": {
      // A riveted plate of gilded armour.
      g.fillStyle = outline;
      rr(g, 12, 16, 40, 34, 8);
      g.fill();
      const pg = g.createLinearGradient(0, 18, 0, 48);
      pg.addColorStop(0, "#f4d67a");
      pg.addColorStop(1, "#b8862a");
      g.fillStyle = pg;
      rr(g, 15, 19, 34, 28, 6);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.45)";
      rr(g, 18, 22, 28, 6, 3);
      g.fill();
      g.fillStyle = outline;
      for (const [x, y] of [[20, 25], [44, 25], [20, 41], [44, 41]]) {
        g.beginPath();
        g.arc(x, y, 2.5, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "key_stormspire":
    case "art_stormheart": {
      // The Seal is a gold disc bearing the storm's bolt; the Heart is the same storm, loose.
      const heart = key === "art_stormheart";
      if (heart) {
        const halo = g.createRadialGradient(32, 32, 4, 32, 32, 30);
        halo.addColorStop(0, "rgba(200,235,255,0.9)");
        halo.addColorStop(1, "rgba(160,210,255,0)");
        g.fillStyle = halo;
        g.fillRect(0, 0, S, S);
      }
      g.fillStyle = outline;
      g.beginPath();
      g.arc(32, 32, 21, 0, Math.PI * 2);
      g.fill();
      const dg = g.createRadialGradient(28, 26, 2, 32, 32, 19);
      dg.addColorStop(0, heart ? "#ffffff" : "#ffe9a8");
      dg.addColorStop(1, heart ? "#6fa8e8" : "#c9a24a");
      g.fillStyle = dg;
      g.beginPath();
      g.arc(32, 32, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = heart ? "#ffffff" : "#2c3a58";
      g.strokeStyle = outline;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(35, 14); g.lineTo(23, 35); g.lineTo(31, 35); g.lineTo(27, 50); g.lineTo(42, 28); g.lineTo(34, 28);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }
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

/** A skill scroll: rolled parchment with a wax seal in its rarity's colour, and the skill's own icon. */
function drawScroll(g: CanvasRenderingContext2D, skill: string, accent: string) {
  const outline = "#1d1a17";
  // The open sheet.
  g.fillStyle = outline;
  rr(g, 10, 12, 44, 42, 4);
  g.fill();
  const pg = g.createLinearGradient(0, 12, 0, 54);
  pg.addColorStop(0, "#f4e6c4");
  pg.addColorStop(1, "#d6bf8e");
  g.fillStyle = pg;
  rr(g, 13, 15, 38, 36, 3);
  g.fill();
  // Rolled ends.
  for (const y of [10, 50]) {
    g.fillStyle = outline;
    rr(g, 6, y - 2, 52, 10, 5);
    g.fill();
    g.fillStyle = "#c9a878";
    rr(g, 8, y, 48, 6, 3);
    g.fill();
  }
  // The skill, inked on the page.
  g.save();
  g.translate(19, 18);
  g.scale(26 / 64, 26 / 64);
  drawEntryIcon(g, skill);
  g.restore();
  // Wax seal in the rarity's colour.
  g.fillStyle = outline;
  g.beginPath();
  g.arc(47, 46, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = accent;
  g.beginPath();
  g.arc(47, 46, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.beginPath();
  g.arc(45, 44, 2, 0, Math.PI * 2);
  g.fill();
}

/** A folded map. */
function drawMap(g: CanvasRenderingContext2D) {
  const outline = "#1d1a17";
  g.fillStyle = outline;
  g.beginPath();
  g.moveTo(8, 16); g.lineTo(24, 10); g.lineTo(40, 16); g.lineTo(56, 10); g.lineTo(56, 48); g.lineTo(40, 54); g.lineTo(24, 48); g.lineTo(8, 54);
  g.closePath();
  g.fill();
  const panels: [number, number, string][] = [[8, 24, "#e8d6ae"], [24, 40, "#d9c49a"], [40, 56, "#e8d6ae"]];
  for (const [x0, x1, col] of panels) {
    g.fillStyle = col;
    g.beginPath();
    const top = (x: number) => (x === 24 || x === 56 ? 13 : 19);
    const bot = (x: number) => (x === 24 || x === 56 ? 45 : 51);
    g.moveTo(x0 + 2, top(x0) + 1); g.lineTo(x1 - 2, top(x1) + 1); g.lineTo(x1 - 2, bot(x1) - 1); g.lineTo(x0 + 2, bot(x0) - 1);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = "#b8342c";
  g.lineWidth = 2;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(14, 42); g.quadraticCurveTo(28, 26, 36, 36); g.quadraticCurveTo(44, 44, 50, 24);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = "#b8342c";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(46, 20); g.lineTo(54, 28); g.moveTo(54, 20); g.lineTo(46, 28);
  g.stroke();
}
