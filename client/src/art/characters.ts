import type * as Phaser from "phaser";
import type { ArmorStyle, WeaponArtKey } from "@floors/shared";

/** Textures are painted at RES× their world size and displayed at 1/RES scale. */
export const RES = 2;

export type HelmKind = "none" | "hood" | "helm" | "cap" | "crown" | "horns" | "iron" | "circlet" | "horned" | "keeper";

export interface CharLook {
  key: string;
  skin: string;
  hair: string;
  cloth: string;
  trim: string;
  helm: HelmKind;
  /** Players: the armour set drawn over the body. Unset draws a plain tunic in `cloth`. */
  armor?: ArmorStyle;
  /** Players: personal colour, used for tabards, capes, hoods and belts. */
  accent?: string;
  ears?: boolean;
  /** Visual heft: wider torso for brutes and armoured bosses. */
  bulk: number;
  glow?: string;
  /** Item icons: a blank mannequin with no face or hair. */
  faceless?: boolean;
}

export type View = "front" | "back" | "side";

const OUTLINE = "#1d1a17";

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
export { shade };

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function blob(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

/** Stroke the current path twice: a dark outline, then the colour on top. */
function inked(g: CanvasRenderingContext2D, color: string, width: number) {
  g.strokeStyle = OUTLINE;
  g.lineWidth = width + 2.4;
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const g = tex.getContext();
  g.lineJoin = "round";
  g.lineCap = "round";
  paint(g);
  tex.refresh();
}

// ---------------------------------------------------------------------------
// Outfits: what each armour set looks like.

type Finish = "cloth" | "quilt" | "leather" | "mail" | "robe" | "plate";

interface Outfit {
  finish: Finish;
  base: string;
  trim: string;
  belt: string;
  sleeve: string;
  /** Hand colour: skin, or a glove/gauntlet. */
  hand: string;
  leg: string;
  boot: string;
  tabard?: string;
  pauldron?: string;
  cape?: string;
  capeTrim?: string;
  /** Glowing rune/inlay colour. */
  rune?: string;
  straps?: boolean;
}

/** How wide each armour set makes the body. */
export const ARMOR_BULK: Record<ArmorStyle, number> = {
  clothes: 1, padded: 1.03, leather: 1.03, ranger: 1.03, chain: 1.06, robes: 1.04, plate: 1.12, warden: 1.16, dawn: 1.14,
};

function outfit(look: CharLook): Outfit {
  const acc = look.accent ?? look.cloth;
  switch (look.armor) {
    case "padded":
      return { finish: "quilt", base: "#cbb68b", trim: "#9c8660", belt: shade(acc, -25), sleeve: "#bba579", hand: look.skin, leg: "#5b4a3a", boot: "#4a3526" };
    case "leather":
      return { finish: "leather", base: "#8a5a34", trim: "#d0a948", belt: "#3e2a1a", sleeve: "#6e4526", hand: "#5a3b24", leg: "#4d3a2c", boot: "#3a281b", straps: true };
    case "ranger":
      return { finish: "leather", base: "#50693b", trim: "#d0a948", belt: "#4a3121", sleeve: "#435a33", hand: "#5a3b24", leg: "#3d3a2c", boot: "#3a281b", cape: shade(acc, -45), capeTrim: "#7a5433", straps: true };
    case "chain":
      return { finish: "mail", base: "#a3acb6", trim: "#d0a948", belt: "#4a3121", sleeve: "#959eaa", hand: "#6f7984", leg: "#7d858e", boot: "#3a2e25", tabard: acc };
    case "robes":
      return { finish: "robe", base: "#3d3152", trim: "#6fd6c8", belt: "#6fd6c8", sleeve: "#3d3152", hand: look.skin, leg: "#3d3152", boot: "#231d2e", rune: "#6fd6c8" };
    case "plate":
      return { finish: "plate", base: "#a4aeb9", trim: "#d8b35a", belt: shade(acc, -15), sleeve: "#949ea9", hand: "#7d8792", leg: "#9ca6b1", boot: "#5f6974", tabard: acc, pauldron: "#b3bcc6" };
    case "warden":
      return { finish: "plate", base: "#627570", trim: "#c2a25a", belt: "#2f3a37", sleeve: "#566a64", hand: "#46554f", leg: "#5b6d68", boot: "#35403c", pauldron: "#71867f", rune: "#6ff0d8" };
    case "dawn":
      return { finish: "plate", base: "#f3e7c2", trim: "#d9a93a", belt: "#d9a93a", sleeve: "#eadbb0", hand: "#dcc68f", leg: "#ebdcb3", boot: "#b8964a", pauldron: "#f0cf6e", cape: "#f7f2e6", capeTrim: "#d9a93a", rune: "#fff0a0" };
    default:
      return { finish: "cloth", base: look.cloth, trim: look.trim, belt: look.trim, sleeve: look.cloth, hand: look.skin, leg: shade(look.cloth, -55), boot: "#4a3526" };
  }
}

/** Does this look carry a cape (an extra layer that sways behind the body)? */
export function hasCape(look: CharLook) {
  return !!outfit(look).cape;
}

/** Soft glow for runes and enchanted metal. Call `noGlow` after. */
function glow(g: CanvasRenderingContext2D, color: string, blur = 4) {
  g.shadowColor = color;
  g.shadowBlur = blur;
}
function noGlow(g: CanvasRenderingContext2D) {
  g.shadowBlur = 0;
  g.shadowColor = "transparent";
}

// ---------------------------------------------------------------------------
// Body parts. Each draws into a 2D context so textures, icons and the paper doll share them.

export function torsoSize(look: CharLook) {
  return { w: Math.round(36 * look.bulk), h: 34 };
}

export function drawTorso(g: CanvasRenderingContext2D, look: CharLook, view: View) {
  const o = outfit(look);
  const tw = torsoSize(look).w;
  const w = view === "side" ? tw * 0.62 : tw - 6;
  const x = (tw - w) / 2;
  const cx = tw / 2;
  // In side textures the body faces +x; the chest is the right half.
  const chestX = view === "side" ? x + w * 0.55 : cx;
  const metal = o.finish === "plate";

  g.fillStyle = OUTLINE;
  rr(g, x - 2, 1, w + 4, 32, 9);
  g.fill();
  const grad = g.createLinearGradient(0, 2, 0, 32);
  grad.addColorStop(0, shade(o.base, metal ? 48 : 26));
  grad.addColorStop(0.55, o.base);
  grad.addColorStop(1, shade(o.base, metal ? -55 : -40));
  g.fillStyle = grad;
  rr(g, x, 3, w, 28, 8);
  g.fill();

  g.save();
  rr(g, x, 3, w, 28, 8);
  g.clip();
  const belt = (y: number, h: number) => {
    g.fillStyle = OUTLINE;
    g.fillRect(x, y - 0.8, w, h + 1.6);
    g.fillStyle = o.belt;
    g.fillRect(x, y, w, h);
    if (view !== "back") {
      g.fillStyle = OUTLINE;
      g.fillRect(chestX - 2.8, y - 1, 5.6, h + 2);
      g.fillStyle = shade(o.trim, 30);
      g.fillRect(chestX - 1.8, y, 3.6, h);
    }
  };
  switch (o.finish) {
    case "cloth": {
      g.fillStyle = look.trim;
      g.fillRect(x + 1, 20, w - 2, 4);
      if (view === "front") {
        g.fillStyle = shade(look.trim, 40);
        g.fillRect(cx - 2, 19, 4, 6);
        g.fillStyle = shade(look.cloth, -20);
        g.fillRect(cx - 1, 5, 2, 14);
      }
      if (view === "back") {
        g.fillStyle = shade(look.cloth, -25);
        rr(g, x + 3, 5, w - 6, 13, 5);
        g.fill();
      }
      break;
    }
    case "quilt": {
      g.strokeStyle = shade(o.base, -38);
      g.lineWidth = 1;
      for (let y = 7.5; y < 20; y += 4) line(g, x, y, x + w, y);
      for (const f of [0.3, 0.7]) line(g, x + w * f, 4, x + w * f, 19);
      g.strokeStyle = shade(o.base, 22);
      for (let y = 8.5; y < 20; y += 4) line(g, x, y, x + w, y);
      if (view === "front") {
        g.fillStyle = shade(o.base, -30);
        g.beginPath();
        g.moveTo(cx - 5, 3); g.lineTo(cx, 9); g.lineTo(cx + 5, 3);
        g.fill();
      }
      belt(20, 3.5);
      // Skirt below the belt.
      g.strokeStyle = shade(o.base, -45);
      for (const f of [0.25, 0.5, 0.75]) line(g, x + w * f, 25, x + w * f, 31);
      break;
    }
    case "leather": {
      // Stitched seams.
      g.strokeStyle = shade(o.base, -30);
      g.lineWidth = 0.8;
      g.setLineDash([1.5, 1.5]);
      if (view !== "side") {
        line(g, x + 4, 5, x + 4, 19);
        line(g, x + w - 4, 5, x + w - 4, 19);
      } else line(g, chestX, 5, chestX, 19);
      g.setLineDash([]);
      // Collar.
      if (view === "front") {
        g.fillStyle = shade(o.base, 32);
        rr(g, cx - 7, 3, 14, 3.5, 1.5);
        g.fill();
      }
      belt(20, 3.5);
      if (o.straps) {
        g.beginPath();
        if (view === "front") {
          g.moveTo(x + 2, 4);
          g.lineTo(x + w - 3, 19);
        } else if (view === "back") {
          g.moveTo(x + 2, 4); g.lineTo(x + w - 2, 19);
          g.moveTo(x + w - 2, 4); g.lineTo(x + 2, 19);
        } else {
          g.moveTo(x + w * 0.3, 3);
          g.lineTo(x + w * 0.75, 19);
        }
        inked(g, shade(o.base, -48), 2.2);
        if (view === "front") {
          g.fillStyle = o.trim;
          g.fillRect(x + w * 0.45, 10, 3, 3);
          // Pouches on the belt.
          g.fillStyle = OUTLINE;
          rr(g, x + 1.5, 22, 6, 6, 1.5);
          g.fill();
          g.fillStyle = shade(o.base, -18);
          rr(g, x + 2.5, 23, 4, 4, 1);
          g.fill();
        }
      }
      break;
    }
    case "mail": {
      g.strokeStyle = shade(o.base, -48);
      g.lineWidth = 0.8;
      for (let y = 5, row = 0; y < 32; y += 2.6, row++) {
        for (let xx = x + (row % 2) * 1.4; xx < x + w + 2; xx += 2.8) {
          g.beginPath();
          g.arc(xx, y, 1.25, 0, Math.PI);
          g.stroke();
        }
      }
      if (o.tabard) {
        const tx0 = view === "side" ? chestX - 2 : cx - w * 0.24;
        const tx1 = view === "side" ? x + w + 1 : cx + w * 0.24;
        g.fillStyle = OUTLINE;
        g.beginPath();
        g.moveTo(tx0 - 1, 5); g.lineTo(tx1 + 1, 5); g.lineTo(tx1 + 1, 29); g.lineTo((tx0 + tx1) / 2, 33); g.lineTo(tx0 - 1, 29);
        g.fill();
        const tg = g.createLinearGradient(0, 5, 0, 31);
        tg.addColorStop(0, shade(o.tabard, 20));
        tg.addColorStop(1, shade(o.tabard, -35));
        g.fillStyle = tg;
        g.beginPath();
        g.moveTo(tx0, 6); g.lineTo(tx1, 6); g.lineTo(tx1, 28.5); g.lineTo((tx0 + tx1) / 2, 31.5); g.lineTo(tx0, 28.5);
        g.fill();
        g.strokeStyle = o.trim;
        g.lineWidth = 1;
        line(g, tx0 + 1, 7, tx0 + 1, 28);
        line(g, tx1 - 1, 7, tx1 - 1, 28);
        if (view !== "side") {
          // A simple heraldic chevron.
          g.strokeStyle = shade(o.trim, 20);
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(cx - 3.5, 11); g.lineTo(cx, 14.5); g.lineTo(cx + 3.5, 11);
          g.stroke();
        }
      }
      belt(20, 3);
      break;
    }
    case "robe": {
      // Long folds.
      g.strokeStyle = shade(o.base, -30);
      g.lineWidth = 1.2;
      for (const f of view === "side" ? [0.35, 0.7] : [0.22, 0.5, 0.78]) line(g, x + w * f, 8, x + w * f - 1, 31);
      if (view === "front") {
        g.fillStyle = OUTLINE;
        g.beginPath();
        g.moveTo(cx - 6, 3); g.lineTo(cx, 12); g.lineTo(cx + 6, 3);
        g.fill();
        g.fillStyle = shade(look.skin, -45);
        g.beginPath();
        g.moveTo(cx - 4.5, 3); g.lineTo(cx, 10); g.lineTo(cx + 4.5, 3);
        g.fill();
      }
      if (view === "back") {
        // The cowl lying on the shoulders.
        g.fillStyle = shade(o.base, -22);
        blob(g, cx, 4, w * 0.42, 6);
        g.fill();
      }
      glow(g, o.rune!, 5);
      g.fillStyle = o.rune!;
      g.fillRect(x, 19, w, 2.4);
      if (view !== "back") {
        g.fillRect(chestX - 1, 21, 2, 10);
        g.fillRect(chestX - 3, 25, 6, 1.4);
      }
      noGlow(g);
      break;
    }
    case "plate": {
      if (view === "front") {
        g.strokeStyle = shade(o.base, -55);
        g.lineWidth = 1;
        line(g, cx + 0.8, 5, cx + 0.8, 18);
        g.strokeStyle = shade(o.base, 70);
        g.lineWidth = 1.2;
        line(g, cx - 0.6, 5, cx - 0.6, 18);
        // Specular highlight on the breastplate.
        g.fillStyle = "rgba(255,255,255,0.35)";
        blob(g, cx - 5, 10, 2.6, 4.2);
        g.fill();
      } else if (view === "back") {
        g.strokeStyle = shade(o.base, -45);
        g.lineWidth = 1;
        line(g, x + 3, 10, x + w - 3, 10);
        line(g, x + 3, 15, x + w - 3, 15);
      } else {
        g.fillStyle = "rgba(255,255,255,0.3)";
        blob(g, chestX, 10, 2.4, 4);
        g.fill();
      }
      // Lames (plated skirt).
      g.strokeStyle = shade(o.base, -60);
      g.lineWidth = 1;
      line(g, x, 26, x + w, 26);
      line(g, x, 29.5, x + w, 29.5);
      g.strokeStyle = shade(o.base, 40);
      line(g, x, 27, x + w, 27);
      // Rivets.
      g.fillStyle = o.trim;
      for (const rx of view === "side" ? [x + 3, x + w - 3] : [x + 3, x + w - 3]) {
        blob(g, rx, 6, 1, 1);
        g.fill();
        blob(g, rx, 16, 1, 1);
        g.fill();
      }
      belt(20.5, 3.2);
      if (o.tabard && view !== "side") {
        g.fillStyle = OUTLINE;
        g.fillRect(cx - 5, 24, 10, 9);
        g.fillStyle = o.tabard;
        g.fillRect(cx - 4, 24.5, 8, 8);
        g.fillStyle = o.trim;
        g.fillRect(cx - 4, 24.5, 8, 1);
      }
      if (o.rune && look.armor === "warden") {
        glow(g, o.rune, 5);
        g.strokeStyle = o.rune;
        g.lineWidth = 1.3;
        if (view === "front") {
          g.beginPath();
          g.moveTo(cx - 5, 7); g.lineTo(cx, 11.5); g.lineTo(cx + 5, 7);
          g.moveTo(cx, 11.5); g.lineTo(cx, 17.5);
          g.moveTo(cx - 3, 15); g.lineTo(cx + 3, 15);
          g.stroke();
        } else if (view === "back") {
          blob(g, cx, 12.5, 3.5, 3.5);
          g.stroke();
        } else line(g, chestX, 7, chestX, 17);
        noGlow(g);
      }
      if (o.rune && look.armor === "dawn" && view !== "back") {
        const sx = chestX;
        glow(g, "#ffe9a8", 6);
        g.strokeStyle = o.trim;
        g.lineWidth = 1.1;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          line(g, sx + Math.cos(a) * 4, 11 + Math.sin(a) * 4, sx + Math.cos(a) * 6.5, 11 + Math.sin(a) * 6.5);
        }
        g.fillStyle = o.rune;
        blob(g, sx, 11, 3.2, 3.2);
        g.fill();
        noGlow(g);
        g.strokeStyle = o.trim;
        g.lineWidth = 1;
        blob(g, sx, 11, 3.2, 3.2);
        g.stroke();
      }
      break;
    }
  }
  g.restore();
  // Plate edges catch the light along the collar.
  if (metal && view !== "back") {
    g.strokeStyle = o.trim;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x + 5, 4);
    g.quadraticCurveTo(chestX, 7, x + w - 5, 4);
    g.stroke();
  }
}

function drawHair(g: CanvasRenderingContext2D, hair: string, view: View, cx: number, cy: number) {
  g.fillStyle = hair;
  g.beginPath();
  if (view === "back") {
    blob(g, cx, cy - 1, 11.5, 11.5);
  } else if (view === "side") {
    // Hair over the back and crown only, so the face side stays readable.
    g.arc(cx - 2, cy - 2, 11.5, Math.PI * 0.72, Math.PI * 1.9);
    g.quadraticCurveTo(cx + 4, cy - 5, cx - 1, cy - 1);
    g.lineTo(cx - 6, cy + 7);
  } else {
    g.arc(cx, cy - 2, 11.5, Math.PI * 1.02, Math.PI * 1.98);
    g.lineTo(cx + 9, cy - 3);
    g.quadraticCurveTo(cx, cy - 7, cx - 9, cy - 3);
  }
  g.fill();
}

/** Steel dome helmet; `steel` is the light/dark gradient. */
function drawDome(g: CanvasRenderingContext2D, cx: number, cy: number, hi: string, lo: string) {
  g.fillStyle = OUTLINE;
  g.beginPath();
  g.arc(cx, cy, 13, Math.PI, 0);
  g.lineTo(cx + 13, cy + 3);
  g.lineTo(cx - 13, cy + 3);
  g.fill();
  const hg = g.createLinearGradient(0, cy - 12, 0, cy + 3);
  hg.addColorStop(0, hi);
  hg.addColorStop(1, lo);
  g.fillStyle = hg;
  g.beginPath();
  g.arc(cx, cy, 11, Math.PI, 0);
  g.lineTo(cx + 11, cy + 1);
  g.lineTo(cx - 11, cy + 1);
  g.fill();
}

export function drawHead(g: CanvasRenderingContext2D, look: CharLook, view: View) {
  const cx = 17;
  const cy = 19;
  const skin = look.faceless ? "#5d554d" : look.skin;
  const skinD = shade(skin, -38);
  const h = look.helm;
  if (look.ears) {
    g.fillStyle = OUTLINE;
    g.beginPath();
    if (view !== "side") {
      g.moveTo(cx - 12, cy - 1); g.lineTo(cx - 20, cy - 9); g.lineTo(cx - 9, cy - 6);
      g.moveTo(cx + 12, cy - 1); g.lineTo(cx + 20, cy - 9); g.lineTo(cx + 9, cy - 6);
    } else {
      g.moveTo(cx - 4, cy - 4); g.lineTo(cx - 15, cy - 12); g.lineTo(cx - 2, cy - 9);
    }
    g.lineWidth = 5;
    g.strokeStyle = OUTLINE;
    g.stroke();
    g.strokeStyle = skin;
    g.lineWidth = 2.5;
    g.stroke();
  }
  g.fillStyle = OUTLINE;
  blob(g, cx, cy, 13, 13);
  g.fill();
  const sk = g.createRadialGradient(cx - 3, cy - 4, 2, cx, cy, 13);
  sk.addColorStop(0, shade(skin, 22));
  sk.addColorStop(1, skinD);
  g.fillStyle = sk;
  blob(g, cx, cy, 11, 11);
  g.fill();

  const closed = h === "helm" || h === "crown" || h === "iron" || h === "horned";
  if (!closed && h !== "hood" && !look.faceless) drawHair(g, look.hair, view, cx, cy);

  switch (h) {
    case "hood": {
      const hood = look.accent ? shade(look.accent, -40) : shade(look.cloth, -40);
      g.fillStyle = OUTLINE;
      g.beginPath();
      blob(g, cx, cy - 1, 14.5, 14.5);
      g.fill();
      if (view === "back") {
        // The hood's point.
        g.beginPath();
        g.moveTo(cx - 6, cy + 8); g.lineTo(cx, cy + 16); g.lineTo(cx + 6, cy + 8);
        g.fill();
      }
      const hg = g.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, 14);
      hg.addColorStop(0, shade(hood, 30));
      hg.addColorStop(1, hood);
      g.fillStyle = hg;
      blob(g, cx, cy - 1, 12.5, 12.5);
      g.fill();
      if (view === "back") {
        g.beginPath();
        g.moveTo(cx - 4.5, cy + 8); g.lineTo(cx, cy + 13.5); g.lineTo(cx + 4.5, cy + 8);
        g.fill();
      } else {
        g.fillStyle = shade(skin, -60);
        blob(g, view === "side" ? cx + 4 : cx, cy + 2, view === "side" ? 6 : 8, 8);
        g.fill();
      }
      break;
    }
    case "cap": {
      const cap = "#8a5a34";
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.arc(cx, cy - 1, 13, Math.PI * 1.02, Math.PI * 1.98);
      g.closePath();
      g.fill();
      const cg = g.createLinearGradient(0, cy - 14, 0, cy - 2);
      cg.addColorStop(0, shade(cap, 34));
      cg.addColorStop(1, shade(cap, -20));
      g.fillStyle = cg;
      g.beginPath();
      g.arc(cx, cy - 1, 11.2, Math.PI * 1.04, Math.PI * 1.96);
      g.closePath();
      g.fill();
      // Band and seam.
      g.fillStyle = OUTLINE;
      g.fillRect(cx - 12.5, cy - 5, 25, 3.6);
      g.fillStyle = "#5a3b24";
      g.fillRect(cx - 11.5, cy - 4.4, 23, 2.4);
      g.strokeStyle = shade(cap, -35);
      g.lineWidth = 0.9;
      if (view !== "side") line(g, cx, cy - 12, cx, cy - 5);
      if (view === "side") {
        // Short brim over the eyes.
        g.fillStyle = OUTLINE;
        blob(g, cx + 11, cy - 3.5, 5, 2.2);
        g.fill();
        g.fillStyle = "#5a3b24";
        blob(g, cx + 11, cy - 3.8, 4, 1.3);
        g.fill();
      }
      break;
    }
    case "helm":
    case "crown":
    case "iron":
    case "horned": {
      if (view !== "front") {
        // Mail aventail over the back of the neck (the side view keeps the face open).
        g.save();
        blob(g, cx, cy, 11, 11);
        g.clip();
        g.fillStyle = "#6f7984";
        g.fillRect(view === "side" ? cx - 12 : cx - 12, cy, view === "side" ? 13 : 24, 12);
        g.strokeStyle = "#4b535c";
        g.lineWidth = 0.8;
        for (let y = cy + 2; y < cy + 12; y += 2.4) line(g, cx - 12, y, view === "side" ? cx + 1 : cx + 12, y);
        g.restore();
      }
      drawDome(g, cx, cy, "#d6dde4", "#6f7984");
      if (h === "iron" || h === "horned") {
        // Rim band with rivets and a nasal guard.
        g.fillStyle = OUTLINE;
        g.fillRect(cx - 13, cy - 3, 26, 4);
        g.fillStyle = "#8b96a1";
        g.fillRect(cx - 12, cy - 2.4, 24, 2.6);
        g.fillStyle = "#e8edf1";
        for (let i = -2; i <= 2; i++) {
          if (view === "side" && i > 0) continue;
          blob(g, cx + i * 5, cy - 1.1, 0.8, 0.8);
          g.fill();
        }
        if (view === "front") {
          g.fillStyle = OUTLINE;
          g.fillRect(cx - 2, cy - 3, 4, 10);
          g.fillStyle = "#b9c2cb";
          g.fillRect(cx - 1, cy - 2.5, 2, 9);
        } else if (view === "side") {
          g.fillStyle = OUTLINE;
          g.fillRect(cx + 9, cy - 3, 4, 9);
          g.fillStyle = "#b9c2cb";
          g.fillRect(cx + 10, cy - 2.5, 2, 8);
        }
        // Ridge over the crown.
        g.strokeStyle = "#f4f7f9";
        g.lineWidth = 1.2;
        if (view !== "side") line(g, cx, cy - 11, cx, cy - 4);
        else {
          g.beginPath();
          g.arc(cx, cy, 10, Math.PI * 1.1, Math.PI * 1.6);
          g.stroke();
        }
      } else if (view === "front") {
        g.fillStyle = OUTLINE;
        g.fillRect(cx - 7, cy - 1, 14, 3);
      }
      if (view === "front" && (h === "iron" || h === "horned")) {
        // Eye shadows either side of the nasal.
        g.fillStyle = "rgba(20,18,16,0.75)";
        g.fillRect(cx - 8, cy + 1, 5.5, 2.4);
        g.fillRect(cx + 2.5, cy + 1, 5.5, 2.4);
      }
      if (h === "crown") {
        g.fillStyle = look.trim;
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(cx + i * 7 - 3, cy - 9);
          g.lineTo(cx + i * 7, cy - 17);
          g.lineTo(cx + i * 7 + 3, cy - 9);
          g.fill();
        }
      }
      break;
    }
    case "circlet": {
      g.beginPath();
      if (view === "front") {
        g.moveTo(cx - 11.5, cy - 5);
        g.quadraticCurveTo(cx, cy - 2, cx + 11.5, cy - 5);
      } else if (view === "side") {
        g.moveTo(cx - 10, cy - 7);
        g.lineTo(cx + 11, cy - 4);
      } else {
        g.moveTo(cx - 11.5, cy - 4);
        g.quadraticCurveTo(cx, cy - 7, cx + 11.5, cy - 4);
      }
      inked(g, "#e8c867", 1.8);
      if (view !== "back") {
        const gx = view === "front" ? cx : cx + 8;
        const gy = view === "front" ? cy - 3.6 : cy - 4.6;
        g.fillStyle = OUTLINE;
        blob(g, gx, gy, 3, 3);
        g.fill();
        glow(g, "#8fd3ff", 5);
        g.fillStyle = "#5aa7f0";
        blob(g, gx, gy, 1.9, 1.9);
        g.fill();
        noGlow(g);
      }
      break;
    }
    case "keeper": {
      const gold = "#f0c860";
      const band = view === "side" ? [cx - 10, cx + 11] : [cx - 12, cx + 12];
      glow(g, "#ffe9a8", 6);
      g.fillStyle = OUTLINE;
      g.beginPath();
      const pts = view === "side" ? [-0.8, -0.2, 0.4, 0.95] : [-1, -0.5, 0, 0.5, 1];
      g.moveTo(band[0] - 1, cy - 4);
      for (const t of pts) {
        const px = (band[0] + band[1]) / 2 + t * ((band[1] - band[0]) / 2 - 1.5);
        const tall = t === 0 ? 11 : Math.abs(t) < 0.6 ? 8 : 6;
        g.lineTo(px - 2.6, cy - 9);
        g.lineTo(px, cy - 9 - tall);
        g.lineTo(px + 2.6, cy - 9);
      }
      g.lineTo(band[1] + 1, cy - 4);
      g.closePath();
      g.fill();
      noGlow(g);
      g.fillStyle = gold;
      g.beginPath();
      g.moveTo(band[0], cy - 5);
      for (const t of pts) {
        const px = (band[0] + band[1]) / 2 + t * ((band[1] - band[0]) / 2 - 1.5);
        const tall = t === 0 ? 11 : Math.abs(t) < 0.6 ? 8 : 6;
        g.lineTo(px - 1.6, cy - 9);
        g.lineTo(px, cy - 8 - tall);
        g.lineTo(px + 1.6, cy - 9);
      }
      g.lineTo(band[1], cy - 5);
      g.closePath();
      g.fill();
      g.fillStyle = "#fff4c8";
      g.fillRect(band[0] + 1, cy - 8.6, band[1] - band[0] - 2, 1.2);
      if (view !== "back") {
        const gx = view === "side" ? cx + 4 : cx;
        glow(g, "#ffb3a0", 5);
        g.fillStyle = "#e0463a";
        blob(g, gx, cy - 6.4, 1.8, 1.8);
        g.fill();
        g.fillStyle = "#5aa7f0";
        for (const d of view === "side" ? [-7] : [-7, 7]) {
          blob(g, gx + d, cy - 6.4, 1.3, 1.3);
          g.fill();
        }
        noGlow(g);
      }
      break;
    }
  }
  if (h === "horns" || h === "horned") {
    g.beginPath();
    if (view === "side") {
      g.moveTo(cx + 1, cy - 7); g.quadraticCurveTo(cx - 11, cy - 7, cx - 9, cy - 20);
    } else {
      g.moveTo(cx - 9, cy - 7); g.quadraticCurveTo(cx - 18, cy - 12, cx - 15, cy - 20);
      g.moveTo(cx + 9, cy - 7); g.quadraticCurveTo(cx + 18, cy - 12, cx + 15, cy - 20);
    }
    g.strokeStyle = OUTLINE;
    g.lineWidth = 6;
    g.stroke();
    g.strokeStyle = "#e9dfc6";
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = "#b8a784";
    g.lineWidth = 1;
    g.stroke();
  }

  // Face.
  if (look.faceless) return;
  if (!closed) {
    if (view === "front") {
      g.fillStyle = look.glow ?? OUTLINE;
      blob(g, cx - 4, cy + 2, 1.8, 2.3);
      g.fill();
      blob(g, cx + 4, cy + 2, 1.8, 2.3);
      g.fill();
    } else if (view === "side") {
      g.fillStyle = look.glow ?? OUTLINE;
      blob(g, cx + 6, cy + 1.5, 1.8, 2.3);
      g.fill();
      g.fillStyle = skinD;
      blob(g, cx + 11, cy + 4, 2.2, 1.8);
      g.fill();
    }
  } else if (look.glow && view !== "back") {
    g.fillStyle = look.glow;
    g.fillRect(view === "side" ? cx + 2 : cx - 6, cy, view === "side" ? 8 : 12, 2);
  }
}

export const ARM_W = 16;
export const ARM_H = 26;

/** Arm hanging from its shoulder pivot at the top centre. */
export function drawArm(g: CanvasRenderingContext2D, look: CharLook) {
  const o = outfit(look);
  const cx = ARM_W / 2;
  if (o.finish === "robe") {
    // Wide bell sleeve.
    g.fillStyle = OUTLINE;
    g.beginPath();
    g.moveTo(cx - 5, 1); g.lineTo(cx + 5, 1); g.lineTo(cx + 7.5, 18); g.lineTo(cx - 7.5, 18);
    g.closePath();
    g.fill();
    g.fillStyle = o.sleeve;
    g.beginPath();
    g.moveTo(cx - 3.5, 2.5); g.lineTo(cx + 3.5, 2.5); g.lineTo(cx + 6, 16.5); g.lineTo(cx - 6, 16.5);
    g.closePath();
    g.fill();
    glow(g, o.rune!, 3);
    g.fillStyle = o.rune!;
    g.fillRect(cx - 6, 15, 12, 1.5);
    noGlow(g);
  } else {
    g.fillStyle = OUTLINE;
    rr(g, cx - 5, 1, 10, 22, 5);
    g.fill();
    const sg = g.createLinearGradient(cx - 3, 0, cx + 3, 0);
    sg.addColorStop(0, shade(o.sleeve, o.finish === "plate" ? 40 : 18));
    sg.addColorStop(1, shade(o.sleeve, -20));
    g.fillStyle = sg;
    rr(g, cx - 3, 3, 6, 13, 3);
    g.fill();
    if (o.finish === "plate") {
      // Elbow cop.
      g.fillStyle = OUTLINE;
      blob(g, cx, 11, 3.6, 2.6);
      g.fill();
      g.fillStyle = shade(o.sleeve, 30);
      blob(g, cx, 11, 2.6, 1.7);
      g.fill();
    } else if (o.finish === "mail") {
      g.strokeStyle = shade(o.sleeve, -45);
      g.lineWidth = 0.7;
      for (let y = 5; y < 16; y += 2.4) line(g, cx - 2.5, y, cx + 2.5, y);
    } else if (o.finish === "leather") {
      // Bracer.
      g.fillStyle = OUTLINE;
      rr(g, cx - 4, 10.5, 8, 6, 2);
      g.fill();
      g.fillStyle = "#5a3b24";
      rr(g, cx - 3, 11.3, 6, 4.4, 1.5);
      g.fill();
      g.fillStyle = o.trim;
      g.fillRect(cx - 3, 13, 6, 0.9);
    } else if (o.finish === "quilt") {
      g.strokeStyle = shade(o.sleeve, -35);
      g.lineWidth = 0.8;
      for (let y = 6; y < 16; y += 3.5) line(g, cx - 3, y, cx + 3, y);
    }
  }
  // Hand, glove or gauntlet.
  g.fillStyle = OUTLINE;
  blob(g, cx, 20, 5, 5);
  g.fill();
  g.fillStyle = o.hand;
  blob(g, cx, 20, 3.4, 3.4);
  g.fill();
  if (o.hand !== look.skin) {
    g.fillStyle = "rgba(255,255,255,0.3)";
    blob(g, cx - 1, 19, 1.4, 1.1);
    g.fill();
  }
  // Pauldron over the shoulder.
  if (o.pauldron) {
    g.fillStyle = OUTLINE;
    blob(g, cx, 5, 7.6, 5.6);
    g.fill();
    const pg = g.createLinearGradient(0, 0, 0, 10);
    pg.addColorStop(0, shade(o.pauldron, 45));
    pg.addColorStop(1, shade(o.pauldron, -35));
    g.fillStyle = pg;
    blob(g, cx, 4.6, 6.2, 4.4);
    g.fill();
    g.strokeStyle = o.trim;
    g.lineWidth = 1.1;
    g.beginPath();
    g.ellipse(cx, 4.6, 6.2, 4.4, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    if (o.rune) {
      glow(g, o.rune, 4);
      g.fillStyle = o.rune;
      blob(g, cx, 4, 1.4, 1.4);
      g.fill();
      noGlow(g);
    }
  }
}

export function drawLeg(g: CanvasRenderingContext2D, look: CharLook) {
  const o = outfit(look);
  if (o.finish === "robe") {
    g.fillStyle = OUTLINE;
    rr(g, 1, 0, 12, 17, 4);
    g.fill();
    const lg = g.createLinearGradient(0, 0, 0, 14);
    lg.addColorStop(0, o.leg);
    lg.addColorStop(1, shade(o.leg, -25));
    g.fillStyle = lg;
    rr(g, 2.5, 0.5, 9, 13, 3);
    g.fill();
    glow(g, o.rune!, 3);
    g.fillStyle = o.rune!;
    g.fillRect(2.5, 11.5, 9, 1.3);
    noGlow(g);
    g.fillStyle = o.boot;
    rr(g, 4, 13.2, 6, 3, 1.4);
    g.fill();
    return;
  }
  g.fillStyle = OUTLINE;
  rr(g, 2, 0, 10, 17, 4);
  g.fill();
  g.fillStyle = o.leg;
  rr(g, 4, 1, 6, 9, 2);
  g.fill();
  if (o.finish === "mail") {
    g.strokeStyle = shade(o.leg, -40);
    g.lineWidth = 0.7;
    for (let y = 3; y < 10; y += 2.2) line(g, 4.5, y, 9.5, y);
  }
  if (o.finish === "plate") {
    // Greave with a knee cop, over a metal sabaton.
    g.fillStyle = OUTLINE;
    rr(g, 2.5, 4, 9, 12.5, 3.5);
    g.fill();
    const gg = g.createLinearGradient(3, 0, 11, 0);
    gg.addColorStop(0, shade(o.leg, 45));
    gg.addColorStop(1, shade(o.leg, -30));
    g.fillStyle = gg;
    rr(g, 3.5, 5, 7, 10.5, 3);
    g.fill();
    g.fillStyle = OUTLINE;
    blob(g, 7, 5.5, 3.6, 2.6);
    g.fill();
    g.fillStyle = shade(o.leg, 35);
    blob(g, 7, 5.5, 2.6, 1.7);
    g.fill();
    g.fillStyle = o.boot;
    rr(g, 3.5, 12.5, 7, 3.5, 1.5);
    g.fill();
    return;
  }
  const tall = o.finish === "leather";
  g.fillStyle = o.boot;
  rr(g, 3.5, tall ? 7 : 9, 7, tall ? 8.5 : 6.5, 3);
  g.fill();
  if (tall) {
    g.fillStyle = shade(o.boot, 30);
    g.fillRect(3.5, 7.5, 7, 1.4);
  }
}

export const CAPE_W = 38;
export const CAPE_H = 40;

/** Cape hanging from the shoulders (pivot at the top centre). */
export function drawCape(g: CanvasRenderingContext2D, look: CharLook, view: View) {
  const o = outfit(look);
  if (!o.cape) return;
  const c = CAPE_W / 2;
  const shape = (inset: number) => {
    g.beginPath();
    if (view === "side") {
      g.moveTo(c - 5 + inset, 1 + inset);
      g.lineTo(c + 5 - inset, 1 + inset);
      g.quadraticCurveTo(c + 6, 22, c + 4 - inset, CAPE_H - 3 - inset);
      g.quadraticCurveTo(c - 6, CAPE_H - inset, c - 13 + inset, CAPE_H - 5 - inset);
      g.quadraticCurveTo(c - 10, 18, c - 5 + inset, 1 + inset);
    } else {
      g.moveTo(c - 11 + inset, 1 + inset);
      g.lineTo(c + 11 - inset, 1 + inset);
      g.lineTo(c + 17 - inset, CAPE_H - 5 - inset);
      g.quadraticCurveTo(c + 8, CAPE_H - 1 - inset, c, CAPE_H - 4 - inset);
      g.quadraticCurveTo(c - 8, CAPE_H - 1 - inset, c - 17 + inset, CAPE_H - 5 - inset);
    }
    g.closePath();
  };
  g.fillStyle = OUTLINE;
  shape(0);
  g.fill();
  const cg = g.createLinearGradient(0, 0, 0, CAPE_H);
  cg.addColorStop(0, shade(o.cape, 22));
  cg.addColorStop(1, shade(o.cape, -35));
  g.fillStyle = cg;
  shape(2);
  g.fill();
  g.save();
  shape(2);
  g.clip();
  // Folds.
  g.strokeStyle = shade(o.cape, -40);
  g.lineWidth = 1.3;
  if (view === "side") line(g, c - 2, 6, c - 5, CAPE_H - 5);
  else for (const d of [-7, 0, 7]) line(g, c + d * 0.6, 6, c + d * 1.25, CAPE_H - 4);
  // Hem.
  g.strokeStyle = o.capeTrim ?? o.trim;
  g.lineWidth = 2.2;
  g.beginPath();
  if (view === "side") {
    g.moveTo(c + 5, CAPE_H - 4);
    g.quadraticCurveTo(c - 6, CAPE_H - 1, c - 14, CAPE_H - 6);
  } else {
    g.moveTo(c + 18, CAPE_H - 6);
    g.quadraticCurveTo(c + 8, CAPE_H - 2, c, CAPE_H - 5);
    g.quadraticCurveTo(c - 8, CAPE_H - 2, c - 18, CAPE_H - 6);
  }
  g.stroke();
  if (look.armor === "dawn" && view === "back") {
    glow(g, "#ffe9a8", 6);
    g.strokeStyle = o.trim;
    g.lineWidth = 1.4;
    blob(g, c, 17, 5, 5);
    g.stroke();
    g.fillStyle = o.rune!;
    blob(g, c, 17, 2.6, 2.6);
    g.fill();
    noGlow(g);
  }
  g.restore();
  // Clasp / collar at the shoulders.
  g.fillStyle = OUTLINE;
  rr(g, c - 11, 0, 22, 4.5, 2);
  g.fill();
  g.fillStyle = shade(o.cape, -20);
  rr(g, c - 10, 0.8, 20, 2.8, 1.4);
  g.fill();
}

/** Paint every body-part texture for a look. Keys: `${look.key}:${part}:${view}`. */
export function paintCharacter(scene: Phaser.Scene, look: CharLook): void {
  const { w: tw, h: th } = torsoSize(look);
  for (const view of ["front", "back", "side"] as View[]) {
    canvas(scene, `${look.key}:torso:${view}`, tw, th, (g) => drawTorso(g, look, view));
    canvas(scene, `${look.key}:head:${view}`, 34, 36, (g) => drawHead(g, look, view));
    if (hasCape(look)) canvas(scene, `${look.key}:cape:${view}`, CAPE_W, CAPE_H, (g) => drawCape(g, look, view));
  }
  canvas(scene, `${look.key}:arm`, ARM_W, ARM_H, (g) => drawArm(g, look));
  canvas(scene, `${look.key}:leg`, 14, 18, (g) => drawLeg(g, look));
  canvas(scene, "shadow", 44, 16, (g) => {
    const s = g.createRadialGradient(22, 8, 2, 22, 8, 21);
    s.addColorStop(0, "rgba(0,0,0,0.38)");
    s.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = s;
    blob(g, 22, 8, 21, 7.5);
    g.fill();
  });
}

// ---------------------------------------------------------------------------
// Weapons

export type WeaponArt = "sword" | "greatsword" | "daggers" | "spear" | "staff" | "club" | "cleaver" | "bow" | "hammer" | "none" | WeaponArtKey;

export const RARITY_COLORS = ["#d8d4cc", "#7fd67a", "#5aa7f0", "#b77af2", "#f2a93b"];

/** Trail colour for swings, so enchanted weapons leave their own light. */
export function weaponTrail(kind: WeaponArt): number {
  switch (kind) {
    case "sword_ember":
    case "st_ember":
      return 0xffa860;
    case "sword_dawn":
      return 0xfff0a8;
    case "gs_warden":
    case "dg_fangs":
      return 0x9ff0e0;
    case "staff":
    case "st_oak":
      return 0x7fc8ff;
    default:
      return 0xe8f0ff;
  }
}

/** [width, height, grip length] of each weapon texture. */
const WEAPON_SIZE: Record<WeaponArt, [number, number, number]> = {
  sword: [52, 16, 8],
  greatsword: [78, 22, 10],
  daggers: [32, 12, 7],
  spear: [96, 14, 20],
  staff: [70, 22, 10],
  club: [44, 18, 6],
  cleaver: [44, 20, 7],
  bow: [30, 44, 14],
  hammer: [66, 30, 10],
  none: [4, 4, 2],
  sword_rusty: [48, 16, 8],
  sword_iron: [54, 16, 8],
  sword_ember: [58, 22, 8],
  sword_dawn: [64, 24, 9],
  gs_iron: [78, 22, 10],
  gs_cleaver: [76, 28, 12],
  gs_warden: [94, 34, 14],
  dg_knives: [32, 12, 7],
  dg_fangs: [36, 18, 7],
  sp_hunting: [96, 16, 20],
  sp_pike: [112, 16, 24],
  st_oak: [72, 26, 10],
  st_ember: [76, 28, 10],
};

export function weaponSize(kind: WeaponArt) {
  const [w, h, grip] = WEAPON_SIZE[kind] ?? WEAPON_SIZE.sword;
  return { w, h, grip };
}

interface BladeStyle {
  width: number;
  hi: string;
  mid: string;
  lo: string;
  guard: string;
  guardW?: number;
  grip?: string;
  edge?: string;
  edgeGlow?: string;
  fuller?: string;
  pommel?: string;
}

/** Straight blade pointing +x, with guard and wrapped grip. */
function straightBlade(g: CanvasRenderingContext2D, w: number, h: number, grip: number, s: BladeStyle) {
  const cy = h / 2;
  const bw = s.width;
  const start = grip + 6;
  const tip = Math.min(9, bw + 2);
  if (s.edgeGlow) glow(g, s.edgeGlow, 6);
  g.fillStyle = OUTLINE;
  g.beginPath();
  g.moveTo(start, cy - bw / 2 - 1.5);
  g.lineTo(w - tip, cy - bw / 2 - 1.5);
  g.lineTo(w - 0.5, cy);
  g.lineTo(w - tip, cy + bw / 2 + 1.5);
  g.lineTo(start, cy + bw / 2 + 1.5);
  g.fill();
  noGlow(g);
  const bg = g.createLinearGradient(0, cy - bw / 2, 0, cy + bw / 2);
  bg.addColorStop(0, s.hi);
  bg.addColorStop(0.5, s.mid);
  bg.addColorStop(1, s.lo);
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(start, cy - bw / 2);
  g.lineTo(w - tip, cy - bw / 2);
  g.lineTo(w - 2.5, cy);
  g.lineTo(w - tip, cy + bw / 2);
  g.lineTo(start, cy + bw / 2);
  g.fill();
  if (s.edge) {
    g.strokeStyle = s.edge;
    g.lineWidth = 1;
    if (s.edgeGlow) glow(g, s.edgeGlow, 4);
    line(g, start + 1, cy - bw / 2 + 0.5, w - tip, cy - bw / 2 + 0.5);
    line(g, start + 1, cy + bw / 2 - 0.5, w - tip, cy + bw / 2 - 0.5);
    line(g, w - tip, cy - bw / 2 + 0.5, w - 2.5, cy);
    line(g, w - tip, cy + bw / 2 - 0.5, w - 2.5, cy);
    noGlow(g);
  }
  if (s.fuller) {
    g.fillStyle = s.fuller;
    if (s.edgeGlow) glow(g, s.edgeGlow, 4);
    g.fillRect(start + 3, cy - 0.8, w - start - tip - 6, 1.6);
    noGlow(g);
  }
  // Guard, grip and pommel.
  const gw = s.guardW ?? bw + 8;
  g.fillStyle = OUTLINE;
  g.fillRect(start - 3, cy - gw / 2 - 1, 5, gw + 2);
  g.fillStyle = s.guard;
  g.fillRect(start - 2, cy - gw / 2, 3, gw);
  g.fillStyle = OUTLINE;
  g.fillRect(0, cy - 3, start - 2, 6);
  g.fillStyle = s.grip ?? "#5a3b24";
  g.fillRect(1, cy - 2, start - 4, 4);
  g.strokeStyle = shade(s.grip ?? "#5a3b24", -30);
  g.lineWidth = 0.8;
  for (let x = 3; x < start - 3; x += 2.5) line(g, x, cy - 2, x + 1.2, cy + 2);
  if (s.pommel) {
    g.fillStyle = OUTLINE;
    blob(g, 2, cy, 3, 3);
    g.fill();
    g.fillStyle = s.pommel;
    blob(g, 2, cy, 1.9, 1.9);
    g.fill();
  }
}

function shaft(g: CanvasRenderingContext2D, x0: number, x1: number, cy: number, color: string, thick = 3.6) {
  g.fillStyle = OUTLINE;
  g.fillRect(x0, cy - thick / 2 - 1.2, x1 - x0, thick + 2.4);
  const sg = g.createLinearGradient(0, cy - thick / 2, 0, cy + thick / 2);
  sg.addColorStop(0, shade(color, 30));
  sg.addColorStop(1, shade(color, -25));
  g.fillStyle = sg;
  g.fillRect(x0 + 1, cy - thick / 2, x1 - x0 - 2, thick);
}

/** Draw a weapon pointing +x with the grip at the left, into a w×h context. */
export function drawWeapon(g: CanvasRenderingContext2D, kind: WeaponArt, rarity = 0) {
  const { w, h, grip } = weaponSize(kind);
  const accent = RARITY_COLORS[rarity] ?? RARITY_COLORS[0];
  const steel = "#dfe5ea";
  const steelD = "#8b96a1";
  const wood = "#7a5433";
  const cy = h / 2;
  g.strokeStyle = OUTLINE;
  g.fillStyle = OUTLINE;
  switch (kind) {
    case "sword":
    case "greatsword":
    case "daggers":
    case "sword_iron":
    case "gs_iron":
    case "dg_knives": {
      const big = kind === "greatsword" || kind === "gs_iron";
      const small = kind === "daggers" || kind === "dg_knives";
      straightBlade(g, w, h, grip + (big ? 2 : 0), {
        width: big ? 8 : small ? 4.5 : 5.5,
        hi: "#ffffff", mid: steel, lo: steelD,
        guard: rarity >= 3 ? accent : "#c9a24a",
        fuller: rarity >= 2 ? accent : big ? "#aab4be" : undefined,
        pommel: big ? "#c9a24a" : undefined,
      });
      break;
    }
    case "sword_rusty": {
      straightBlade(g, w, h, grip, { width: 5.5, hi: "#d9b8a0", mid: "#a47a5c", lo: "#6e4a33", guard: "#6b5a4a", grip: "#4a3121" });
      // Rust spots and a nick in the edge.
      g.fillStyle = "#7a3f22";
      for (const [x, y, r] of [[22, cy - 1, 1.4], [31, cy + 1.2, 1.1], [38, cy - 0.8, 0.9]] as const) {
        blob(g, x, y, r, r * 0.8);
        g.fill();
      }
      g.fillStyle = "rgba(0,0,0,0)";
      g.globalCompositeOperation = "destination-out";
      g.beginPath();
      g.moveTo(27, cy - 4.5); g.lineTo(29.5, cy - 2.2); g.lineTo(32, cy - 4.5);
      g.fill();
      g.globalCompositeOperation = "source-over";
      break;
    }
    case "sword_ember": {
      straightBlade(g, w, h, grip, {
        width: 6.5, hi: "#6a5a5a", mid: "#3c3438", lo: "#221c20",
        guard: "#c4402c", guardW: 16, grip: "#3a1f1a",
        edge: "#ffb35a", edgeGlow: "#ff7a2a", fuller: "#ffd08a", pommel: "#ff8a3a",
      });
      // Flame-swept guard tips.
      g.fillStyle = OUTLINE;
      const gx = grip + 4;
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(gx - 1, cy + d * 7); g.lineTo(gx + 6, cy + d * 10.5); g.lineTo(gx + 3, cy + d * 5);
        g.fill();
      }
      g.fillStyle = "#e8622c";
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(gx, cy + d * 7); g.lineTo(gx + 5, cy + d * 9.5); g.lineTo(gx + 3, cy + d * 5.5);
        g.fill();
      }
      break;
    }
    case "sword_dawn": {
      straightBlade(g, w, h, grip, {
        width: 7, hi: "#ffffff", mid: "#fff3d0", lo: "#e0c070",
        guard: "#f0c860", guardW: 12, grip: "#f4ecd8",
        edge: "#ffffff", edgeGlow: "#ffe9a8", fuller: "#f2a93b", pommel: "#f2a93b",
      });
      // Swept wings on the guard.
      const gx = grip + 4;
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(gx, cy + d * 4);
        g.quadraticCurveTo(gx - 1, cy + d * 11, gx + 9, cy + d * 11);
        g.quadraticCurveTo(gx + 4, cy + d * 7, gx + 4, cy + d * 3);
        g.closePath();
        g.fillStyle = OUTLINE;
        g.fill();
        g.lineWidth = 1.2;
        g.strokeStyle = OUTLINE;
        g.stroke();
      }
      g.fillStyle = "#f0c860";
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(gx + 0.8, cy + d * 4.4);
        g.quadraticCurveTo(gx, cy + d * 10, gx + 7.5, cy + d * 10.2);
        g.quadraticCurveTo(gx + 3.4, cy + d * 7, gx + 3.4, cy + d * 3.6);
        g.closePath();
        g.fill();
      }
      glow(g, "#ffe9a8", 6);
      g.fillStyle = "#f2a93b";
      blob(g, gx + 2, cy, 2.2, 2.2);
      g.fill();
      noGlow(g);
      break;
    }
    case "gs_cleaver": {
      // Long grip, then a broad slab with a notched spine.
      g.fillStyle = OUTLINE;
      g.fillRect(0, cy - 3.2, grip + 6, 6.4);
      g.fillStyle = "#4a3121";
      g.fillRect(1, cy - 2.2, grip + 4, 4.4);
      const x0 = grip + 4;
      const top = cy - 11;
      const bot = cy + 7;
      const spine = (inset: number) => {
        g.beginPath();
        g.moveTo(x0 + inset, top + inset);
        for (let x = x0 + 8; x < w - 12; x += 8) {
          g.lineTo(x - 2, top + inset);
          g.lineTo(x, top + 3 + inset);
          g.lineTo(x + 2, top + inset);
        }
        g.lineTo(w - 4 - inset, top + 2 + inset);
        g.lineTo(w - 1 - inset, cy);
        g.lineTo(w - 8 - inset, bot - inset);
        g.lineTo(x0 + inset, bot - inset);
        g.closePath();
      };
      g.fillStyle = OUTLINE;
      spine(0);
      g.fill();
      const cg = g.createLinearGradient(0, top, 0, bot);
      cg.addColorStop(0, "#9aa1a8");
      cg.addColorStop(0.7, "#c7ced4");
      cg.addColorStop(1, "#f2f5f7");
      g.fillStyle = cg;
      spine(2);
      g.fill();
      g.fillStyle = "#7a4a2c";
      for (const [x, y] of [[x0 + 10, top + 5], [x0 + 30, top + 6], [w - 20, top + 4]] as const) {
        blob(g, x, y, 2.2, 1.4);
        g.fill();
      }
      g.fillStyle = OUTLINE;
      blob(g, x0 + 6, cy - 3, 2.2, 2.2);
      g.fill();
      if (rarity >= 2) {
        g.fillStyle = accent;
        g.fillRect(x0 + 12, bot - 4, w - x0 - 26, 1.4);
      }
      break;
    }
    case "gs_warden": {
      // Halberd: a long dark pole, axe blade, spike and back hook.
      shaft(g, 0, w - 16, cy + 5, "#3d4346", 4);
      g.fillStyle = "#b89a52";
      for (const x of [6, grip + 8, w - 34]) g.fillRect(x, cy + 2.2, 2.5, 5.6);
      const hx = w - 30;
      // Spike.
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.moveTo(hx + 4, cy + 1.5); g.lineTo(w, cy + 5); g.lineTo(hx + 4, cy + 8.5);
      g.fill();
      g.fillStyle = "#cfe0dc";
      g.beginPath();
      g.moveTo(hx + 6, cy + 3); g.lineTo(w - 3, cy + 5); g.lineTo(hx + 6, cy + 7);
      g.fill();
      // Axe blade (up) and hook (down).
      const axe = (inset: number) => {
        g.beginPath();
        g.moveTo(hx + inset, cy + 3 - inset * 0.3);
        g.lineTo(hx - 3 + inset, cy - 10 + inset);
        g.quadraticCurveTo(hx + 9, cy - 17 + inset * 1.2, hx + 20 - inset, cy - 11 + inset);
        g.lineTo(hx + 16 - inset, cy + 3 - inset * 0.3);
        g.closePath();
      };
      glow(g, "#6ff0d8", 5);
      g.fillStyle = OUTLINE;
      axe(0);
      g.fill();
      noGlow(g);
      const ag = g.createLinearGradient(0, cy - 16, 0, cy + 3);
      ag.addColorStop(0, "#e6f4f0");
      ag.addColorStop(1, "#6f8a84");
      g.fillStyle = ag;
      axe(2);
      g.fill();
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.moveTo(hx + 4, cy + 7); g.lineTo(hx + 2, cy + 16); g.lineTo(hx + 10, cy + 7);
      g.fill();
      glow(g, "#6ff0d8", 5);
      g.strokeStyle = "#6ff0d8";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(hx + 4, cy - 7); g.lineTo(hx + 8, cy - 3); g.lineTo(hx + 12, cy - 7);
      g.stroke();
      noGlow(g);
      break;
    }
    case "dg_fangs": {
      // Curved fang blade.
      const x0 = grip + 4;
      const fang = (inset: number) => {
        g.beginPath();
        g.moveTo(x0 + inset * 0.5, cy - 4 + inset);
        g.quadraticCurveTo(w - 10, cy - 8 + inset, w - 0.5 - inset * 1.5, cy - 7 + inset * 0.8);
        g.quadraticCurveTo(w - 12, cy + 2 - inset * 0.5, x0 + inset * 0.5, cy + 3 - inset);
        g.closePath();
      };
      glow(g, "#6ff0d8", 4);
      g.fillStyle = OUTLINE;
      fang(0);
      g.fill();
      noGlow(g);
      const fg = g.createLinearGradient(0, cy - 8, 0, cy + 3);
      fg.addColorStop(0, "#f2fffd");
      fg.addColorStop(1, "#5e9aa4");
      g.fillStyle = fg;
      fang(1.6);
      g.fill();
      g.fillStyle = OUTLINE;
      g.fillRect(x0 - 3, cy - 5, 4, 10);
      g.fillStyle = "#6aa6b0";
      g.fillRect(x0 - 2, cy - 4, 2, 8);
      g.fillStyle = OUTLINE;
      g.fillRect(0, cy - 2.8, x0 - 2, 5.6);
      g.fillStyle = "#2a3336";
      g.fillRect(1, cy - 1.8, x0 - 4, 3.6);
      break;
    }
    case "spear":
    case "sp_hunting": {
      shaft(g, 0, w - 14, cy, wood);
      // Cord binding below the head.
      g.strokeStyle = "#d8c8a0";
      g.lineWidth = 1;
      for (let x = w - 26; x < w - 17; x += 2) line(g, x, cy - 2.4, x + 1, cy + 2.4);
      // Leaf-shaped head.
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.moveTo(w - 19, cy);
      g.quadraticCurveTo(w - 12, cy - 8, w, cy);
      g.quadraticCurveTo(w - 12, cy + 8, w - 19, cy);
      g.fill();
      g.fillStyle = steel;
      g.beginPath();
      g.moveTo(w - 17, cy);
      g.quadraticCurveTo(w - 11, cy - 5.5, w - 2.5, cy);
      g.quadraticCurveTo(w - 11, cy + 5.5, w - 17, cy);
      g.fill();
      g.strokeStyle = steelD;
      g.lineWidth = 0.8;
      line(g, w - 16, cy, w - 4, cy);
      g.fillStyle = rarity >= 1 ? accent : "#a0643a";
      g.fillRect(w - 28, cy - 3, 3, 6);
      break;
    }
    case "sp_pike": {
      shaft(g, 0, w - 16, cy, "#5a5f66", 3.4);
      g.fillStyle = "#8b96a1";
      for (const x of [grip, grip + 20]) g.fillRect(x, cy - 2.4, 2.5, 4.8);
      // Lugs (crossbar) and a long square spike.
      g.fillStyle = OUTLINE;
      g.fillRect(w - 26, cy - 6, 4, 12);
      g.fillStyle = "#b9c2cb";
      g.fillRect(w - 25, cy - 5, 2, 10);
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.moveTo(w - 23, cy - 3.5); g.lineTo(w, cy); g.lineTo(w - 23, cy + 3.5);
      g.fill();
      const pg = g.createLinearGradient(0, cy - 3, 0, cy + 3);
      pg.addColorStop(0, "#ffffff");
      pg.addColorStop(1, steelD);
      g.fillStyle = pg;
      g.beginPath();
      g.moveTo(w - 22, cy - 2); g.lineTo(w - 2.5, cy); g.lineTo(w - 22, cy + 2);
      g.fill();
      if (rarity >= 2) {
        g.fillStyle = accent;
        g.fillRect(w - 30, cy - 2.2, 3, 4.4);
      }
      break;
    }
    case "staff":
    case "st_oak": {
      // Gnarled oak: a wavy shaft splitting into branches around a crystal.
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(0, cy);
      g.bezierCurveTo(w * 0.3, cy - 2.5, w * 0.5, cy + 2.5, w - 20, cy);
      inked(g, wood, 3.8);
      g.beginPath();
      g.moveTo(w - 22, cy);
      g.quadraticCurveTo(w - 12, cy - 11, w - 3, cy - 6);
      g.moveTo(w - 22, cy);
      g.quadraticCurveTo(w - 12, cy + 11, w - 3, cy + 6);
      inked(g, shade(wood, 10), 2.4);
      // Leaves.
      for (const [x, y, a] of [[w - 26, cy - 5, -0.8], [w - 30, cy + 5, 0.9]] as const) {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.fillStyle = OUTLINE;
        blob(g, 0, 0, 4.4, 2.4);
        g.fill();
        g.fillStyle = "#6fae4a";
        blob(g, 0, 0, 3.2, 1.4);
        g.fill();
        g.restore();
      }
      const orb = rarity >= 1 ? accent : "#8fd3ff";
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.moveTo(w - 12, cy); g.lineTo(w - 7, cy - 6); g.lineTo(w - 2, cy); g.lineTo(w - 7, cy + 6);
      g.fill();
      glow(g, orb, 7);
      const og = g.createLinearGradient(w - 11, cy - 5, w - 3, cy + 5);
      og.addColorStop(0, "#ffffff");
      og.addColorStop(1, orb);
      g.fillStyle = og;
      g.beginPath();
      g.moveTo(w - 10.5, cy); g.lineTo(w - 7, cy - 4.2); g.lineTo(w - 3.5, cy); g.lineTo(w - 7, cy + 4.2);
      g.fill();
      noGlow(g);
      break;
    }
    case "st_ember": {
      shaft(g, 0, w - 18, cy, "#3a2a22", 4);
      g.fillStyle = "#6b5a4a";
      for (const x of [8, grip + 14, w - 30]) g.fillRect(x, cy - 3.2, 2.6, 6.4);
      // Iron claws cradling the flame.
      g.beginPath();
      g.moveTo(w - 22, cy);
      g.quadraticCurveTo(w - 16, cy - 12, w - 6, cy - 11);
      g.moveTo(w - 22, cy);
      g.quadraticCurveTo(w - 16, cy + 12, w - 6, cy + 11);
      inked(g, "#5a5f66", 2.2);
      glow(g, "#ff7a2a", 10);
      const fg = g.createRadialGradient(w - 12, cy - 2, 1, w - 11, cy, 8.5);
      fg.addColorStop(0, "#fff6d8");
      fg.addColorStop(0.45, "#ffb347");
      fg.addColorStop(1, "#e8622c");
      g.fillStyle = OUTLINE;
      blob(g, w - 11, cy, 8.4, 8.4);
      g.fill();
      g.fillStyle = fg;
      blob(g, w - 11, cy, 7, 7);
      g.fill();
      // A lick of flame off the top.
      g.beginPath();
      g.moveTo(w - 15, cy - 5);
      g.quadraticCurveTo(w - 10, cy - 14, w - 4, cy - 12);
      g.quadraticCurveTo(w - 7, cy - 7, w - 7, cy - 4);
      g.fillStyle = "#ffb347";
      g.fill();
      noGlow(g);
      break;
    }
    case "club":
    case "hammer": {
      g.fillStyle = OUTLINE;
      g.fillRect(0, cy - 3, w - 12, 6);
      g.fillStyle = wood;
      g.fillRect(1, cy - 1.8, w - 14, 3.6);
      if (kind === "hammer") {
        g.fillStyle = OUTLINE;
        rr(g, w - 20, 0, 20, h, 4);
        g.fill();
        g.fillStyle = "#7d7f86";
        rr(g, w - 18, 2, 16, h - 4, 3);
        g.fill();
      } else {
        g.fillStyle = OUTLINE;
        blob(g, w - 10, cy, 10, 8.5);
        g.fill();
        g.fillStyle = "#8a6440";
        blob(g, w - 10, cy, 8, 6.5);
        g.fill();
      }
      break;
    }
    case "cleaver": {
      g.fillStyle = OUTLINE;
      g.fillRect(0, cy - 3, 14, 6);
      g.fillStyle = "#5a3b24";
      g.fillRect(1, cy - 2, 12, 4);
      g.fillStyle = OUTLINE;
      rr(g, 12, 1, w - 13, h - 5, 4);
      g.fill();
      g.fillStyle = "#b9c0c7";
      rr(g, 14, 3, w - 17, h - 9, 3);
      g.fill();
      break;
    }
    case "bow": {
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(4, 3);
      g.quadraticCurveTo(w + 6, h / 2, 4, h - 3);
      g.stroke();
      g.strokeStyle = wood;
      g.lineWidth = 2.6;
      g.stroke();
      g.strokeStyle = "#e9e4d6";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(4, 3);
      g.lineTo(4, h - 3);
      g.stroke();
      break;
    }
  }
}

/** Weapon texture pointing +x with the grip at the left. Returns the grip origin fraction. */
export function paintWeapon(scene: Phaser.Scene, kind: WeaponArt, rarity = 0): { key: string; ox: number } {
  const key = `weapon:${kind}:${rarity}`;
  const { w, h, grip } = weaponSize(kind);
  canvas(scene, key, w, h, (g) => drawWeapon(g, kind, rarity));
  return { key, ox: grip / w };
}

// ---------------------------------------------------------------------------
// DOM canvases: the paper doll and equipment icons use the same parts.

function part(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.lineJoin = "round";
  g.lineCap = "round";
  paint(g);
  return c;
}

/**
 * Paint a standing, front-facing character into `g`, feet at (fx, fy), `scale` screen px per
 * texture px. Mirrors HumanoidRig's rest pose; `weaponAngle` can stand the weapon upright.
 */
export function drawFigure(
  g: CanvasRenderingContext2D, look: CharLook, weapon: WeaponArt, rarity: number, fx: number, fy: number, scale: number,
  weaponAngle = Math.PI / 2 + 0.4,
) {
  const k = scale * RES; // screen px per world unit
  const put = (img: HTMLCanvasElement, x: number, y: number, ox: number, oy: number, rot = 0, sx = 1, sy = 1) => {
    g.save();
    g.translate(fx + x * k, fy + y * k);
    g.rotate(rot);
    g.scale(sx * scale, sy * scale);
    g.drawImage(img, -ox * img.width, -oy * img.height);
    g.restore();
  };
  const b = look.bulk;
  const { w: tw, h: th } = torsoSize(look);
  const shadow = part(44, 16, (c) => {
    const s = c.createRadialGradient(22, 8, 2, 22, 8, 21);
    s.addColorStop(0, "rgba(0,0,0,0.38)");
    s.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = s;
    blob(c, 22, 8, 21, 7.5);
    c.fill();
  });
  put(shadow, 0, 0, 0.5, 0.5, 0, b, b);
  // Hand at rest; the weapon extends from it.
  const a = Math.PI / 2 + 0.4;
  const sh = { x: -6.5 * b, y: -17 };
  const hx = sh.x + Math.cos(a) * 9;
  const hy = sh.y + Math.sin(a) * 9 * 0.8;
  const upright = Math.sin(weaponAngle) < -0.25;
  const drawWeaponPart = () => {
    if (weapon === "none") return;
    const { w, h, grip } = weaponSize(weapon);
    const wa = weaponAngle;
    put(part(w, h, (c) => drawWeapon(c, weapon, rarity)), hx, hy, grip / w, 0.5, wa, 0.9 + 0.1 * Math.abs(Math.cos(wa)), 0.9);
  };
  if (upright) drawWeaponPart();
  if (hasCape(look)) put(part(CAPE_W, CAPE_H, (c) => drawCape(c, look, "front")), 0, -20, 0.5, 0.05);
  const leg = part(14, 18, (c) => drawLeg(c, look));
  put(leg, -3.5 * b, -7, 0.5, 0);
  put(leg, 3.5 * b, -7, 0.5, 0);
  const arm = part(ARM_W, ARM_H, (c) => drawArm(c, look));
  put(arm, 6.5 * b, -17, 0.5, 0.08, -0.15);
  put(part(tw, th, (c) => drawTorso(c, look, "front")), 0, -13, 0.5, 0.5);
  put(part(34, 36, (c) => drawHead(c, look, "front")), 0, -26, 0.5, 0.5);
  const armAng = Math.atan2(hy - sh.y, hx - sh.x) - Math.PI / 2;
  put(arm, sh.x, sh.y, 0.5, 0.08, armAng, 1, Math.min(1.5, Math.max(0.6, Math.hypot(hx - sh.x, hy - sh.y) / 10)));
  if (!upright) drawWeaponPart();
}

/** Equipment icon art (armour/helm on a mannequin, weapon on a diagonal), into a size×size context. */
export function drawGearIcon(g: CanvasRenderingContext2D, size: number, kind: "armor" | "helm" | "weapon", style: string, rarity: number) {
  const mannequin: CharLook = {
    key: "icon", skin: "#5d554d", hair: "#000000", cloth: "#8a6a4a", trim: "#6b4a2b", accent: "#9b3c3c",
    helm: "none", bulk: 1, faceless: true,
  };
  if (kind === "weapon") {
    const art = style as WeaponArt;
    const { w, h } = weaponSize(art);
    const s = Math.min(1.5, (size * 1.22) / w);
    const img = part(w, h, (c) => drawWeapon(c, art, rarity));
    g.save();
    g.translate(size / 2, size / 2);
    g.rotate(-Math.PI / 4);
    g.scale(s, s);
    g.drawImage(img, -w / 2, -h / 2);
    g.restore();
    return;
  }
  if (kind === "helm") {
    const look: CharLook = { ...mannequin, helm: style as HelmKind };
    const img = part(34, 36, (c) => drawHead(c, look, "front"));
    const s = size / 38;
    g.save();
    g.translate(size / 2, size / 2 + size * 0.06);
    g.scale(s * 1.05, s * 1.05);
    g.drawImage(img, -17, -19);
    g.restore();
    return;
  }
  const look: CharLook = { ...mannequin, armor: style as ArmorStyle, cloth: "#8a6a4a", bulk: ARMOR_BULK[style as ArmorStyle] ?? 1 };
  const { w: tw, h: th } = torsoSize(look);
  const s = size / 46;
  g.save();
  g.translate(size / 2, size / 2 + size * 0.02);
  g.scale(s, s);
  if (hasCape(look)) {
    const cape = part(CAPE_W, CAPE_H, (c) => drawCape(c, look, "front"));
    g.drawImage(cape, -CAPE_W / 2, -th / 2 - 1);
  }
  const arm = part(ARM_W, ARM_H, (c) => drawArm(c, look));
  for (const d of [-1, 1]) {
    g.save();
    g.translate(d * 13 * look.bulk, -th / 2 + 8);
    g.rotate(-d * 0.22);
    g.drawImage(arm, -ARM_W / 2, -2);
    g.restore();
  }
  g.drawImage(part(tw, th, (c) => drawTorso(c, look, "front")), -tw / 2, -th / 2);
  g.restore();
}


/** Round shield carried on the off arm. */
export function paintShield(scene: Phaser.Scene, color: string, trim: string) {
  const key = `shield:${color}:${trim}`;
  canvas(scene, key, 30, 34, (g) => {
    g.fillStyle = OUTLINE;
    g.beginPath();
    g.moveTo(15, 1); g.lineTo(29, 6); g.lineTo(27, 22); g.lineTo(15, 33); g.lineTo(3, 22); g.lineTo(1, 6);
    g.closePath();
    g.fill();
    const sg = g.createLinearGradient(0, 0, 0, 34);
    sg.addColorStop(0, shade(color, 30));
    sg.addColorStop(1, shade(color, -30));
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(15, 4); g.lineTo(26, 8); g.lineTo(24.5, 21); g.lineTo(15, 30); g.lineTo(5.5, 21); g.lineTo(4, 8);
    g.closePath();
    g.fill();
    g.fillStyle = trim;
    g.fillRect(13.5, 6, 3, 22);
    g.fillRect(7, 13, 16, 3);
  });
  return key;
}

/** Quadruped parts for wolves. */
export function paintWolf(scene: Phaser.Scene, key: string, fur: string, dark: string, belly: string, eye: string) {
  canvas(scene, `${key}:body`, 50, 30, (g) => {
    g.fillStyle = OUTLINE;
    blob(g, 25, 15, 23, 13);
    g.fill();
    const bg = g.createLinearGradient(0, 3, 0, 28);
    bg.addColorStop(0, shade(fur, 24));
    bg.addColorStop(0.6, fur);
    bg.addColorStop(1, dark);
    g.fillStyle = bg;
    blob(g, 25, 15, 21, 11);
    g.fill();
    g.fillStyle = belly;
    blob(g, 25, 21, 13, 4);
    g.fill();
    g.fillStyle = dark;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(14 + i * 7, 5);
      g.lineTo(17 + i * 7, 11);
      g.lineTo(20 + i * 7, 5);
      g.fill();
    }
  });
  canvas(scene, `${key}:head`, 34, 30, (g) => {
    g.fillStyle = OUTLINE;
    g.beginPath();
    g.moveTo(6, 4); g.lineTo(11, 12); g.lineTo(4, 14);
    g.moveTo(17, 3); g.lineTo(19, 12); g.lineTo(12, 11);
    g.fill();
    blob(g, 13, 17, 11, 10);
    g.fill();
    g.beginPath();
    g.moveTo(16, 11); g.lineTo(33, 17); g.lineTo(16, 25);
    g.fill();
    g.fillStyle = fur;
    blob(g, 13, 17, 9, 8);
    g.fill();
    g.beginPath();
    g.moveTo(16, 13); g.lineTo(30, 17.5); g.lineTo(16, 23);
    g.fill();
    g.fillStyle = belly;
    g.beginPath();
    g.moveTo(18, 19); g.lineTo(29, 18.5); g.lineTo(18, 23);
    g.fill();
    g.fillStyle = OUTLINE;
    blob(g, 31, 17, 2.2, 2.2);
    g.fill();
    g.fillStyle = eye;
    blob(g, 18, 14.5, 2, 1.6);
    g.fill();
  });
  canvas(scene, `${key}:leg`, 10, 16, (g) => {
    g.fillStyle = OUTLINE;
    rr(g, 1, 0, 8, 16, 3.5);
    g.fill();
    g.fillStyle = dark;
    rr(g, 2.5, 1, 5, 13, 2.5);
    g.fill();
  });
  canvas(scene, `${key}:tail`, 30, 14, (g) => {
    g.fillStyle = OUTLINE;
    g.beginPath();
    g.moveTo(0, 5); g.quadraticCurveTo(16, -2, 29, 7); g.quadraticCurveTo(16, 14, 0, 9);
    g.fill();
    g.fillStyle = fur;
    g.beginPath();
    g.moveTo(1, 6); g.quadraticCurveTo(16, 1, 26, 7); g.quadraticCurveTo(16, 11, 1, 8);
    g.fill();
  });
}

/** Straw training dummy on a post. */
export function paintDummy(scene: Phaser.Scene) {
  canvas(scene, "dummy", 40, 70, (g) => {
    g.fillStyle = OUTLINE;
    g.fillRect(17, 30, 6, 38);
    g.fillStyle = "#7a5433";
    g.fillRect(18.5, 31, 3, 36);
    g.fillStyle = OUTLINE;
    g.fillRect(3, 30, 34, 6);
    g.fillStyle = "#8a6440";
    g.fillRect(4, 31, 32, 4);
    g.fillStyle = OUTLINE;
    rr(g, 7, 20, 26, 30, 10);
    g.fill();
    const sg = g.createLinearGradient(0, 20, 0, 50);
    sg.addColorStop(0, "#e8cf8a");
    sg.addColorStop(1, "#b9964f");
    g.fillStyle = sg;
    rr(g, 9, 22, 22, 26, 8);
    g.fill();
    g.strokeStyle = "#a07a3a";
    g.lineWidth = 1.5;
    for (let y = 26; y < 46; y += 5) { g.beginPath(); g.moveTo(10, y); g.lineTo(30, y + 1); g.stroke(); }
    g.fillStyle = "#c4402c";
    blob(g, 20, 35, 6, 6);
    g.fill();
    g.fillStyle = "#f4ecd8";
    blob(g, 20, 35, 3.5, 3.5);
    g.fill();
    g.fillStyle = "#c4402c";
    blob(g, 20, 35, 1.5, 1.5);
    g.fill();
    g.fillStyle = OUTLINE;
    blob(g, 20, 12, 10, 10);
    g.fill();
    g.fillStyle = "#e2c67e";
    blob(g, 20, 12, 8, 8);
    g.fill();
    g.strokeStyle = "#8a6a30";
    g.beginPath(); g.moveTo(15, 10); g.lineTo(18, 13); g.moveTo(18, 10); g.lineTo(15, 13); g.moveTo(22, 10); g.lineTo(25, 13); g.moveTo(25, 10); g.lineTo(22, 13); g.stroke();
  });
}
