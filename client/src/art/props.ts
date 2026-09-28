import type * as Phaser from "phaser";
import { TILE, type PropDef, type PropKind } from "@floors/shared";
import { RES, shade } from "./characters.ts";

/**
 * Town furniture, painted like everything else: dark outline, soft gradients, a baked
 * ground shadow. A prop texture covers its footprint plus a margin and stands on the
 * footprint's bottom edge.
 */

const OUTLINE = "#1d1a17";
const WOOD = "#8a5a34";
const WOOD_D = "#65421f";
const WOOD_L = "#b07a44";
const IRON = "#59606a";
const PAD = 12;

const HEIGHT: Record<PropKind, number> = {
  stall: 150, barrel: 88, crates: 92, bench: 64, lamp: 156, planter: 76, board: 118, hay: 72,
  cart: 96, rack: 118, anvil: 76, well: 190, logs: 70, sacks: 70,
};

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function shadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  const s = g.createRadialGradient(cx, cy, 1, cx, cy, rx);
  s.addColorStop(0, "rgba(0,0,0,0.32)");
  s.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = s;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

/** Outlined, filled path helper: `shape()` builds the path. */
function ink(g: CanvasRenderingContext2D, fill: string | CanvasGradient, shape: () => void, width = 3) {
  shape();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = width;
  g.stroke();
}

function woodGrad(g: CanvasRenderingContext2D, x0: number, x1: number, base = WOOD) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, shade(base, -18));
  gr.addColorStop(0.45, shade(base, 22));
  gr.addColorStop(1, shade(base, -30));
  return gr;
}

function crate(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const top = h * 0.28;
  ink(g, shade(WOOD, 26), () => rr(g, x, y, w, top, 3));
  ink(g, woodGrad(g, x, x + w), () => rr(g, x, y + top, w, h - top, 3));
  g.strokeStyle = WOOD_D;
  g.lineWidth = 2;
  for (let i = 1; i < 3; i++) {
    g.beginPath();
    g.moveTo(x + 3, y + top + ((h - top) * i) / 3);
    g.lineTo(x + w - 3, y + top + ((h - top) * i) / 3);
    g.stroke();
  }
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x + 4, y + h - 4);
  g.lineTo(x + w - 4, y + top + 4);
  g.stroke();
}

function barrel(g: CanvasRenderingContext2D, cx: number, base: number, variant: number) {
  const w = 46;
  const h = 58;
  const top = base - h;
  ink(g, woodGrad(g, cx - w / 2, cx + w / 2), () => {
    g.beginPath();
    g.moveTo(cx - w / 2 + 3, top + 6);
    g.quadraticCurveTo(cx - w / 2 - 4, top + h / 2, cx - w / 2 + 3, base - 4);
    g.quadraticCurveTo(cx, base + 3, cx + w / 2 - 3, base - 4);
    g.quadraticCurveTo(cx + w / 2 + 4, top + h / 2, cx + w / 2 - 3, top + 6);
    g.closePath();
  });
  g.strokeStyle = "rgba(60,35,15,0.5)";
  g.lineWidth = 1.5;
  for (const dx of [-12, 0, 12]) {
    g.beginPath();
    g.moveTo(cx + dx, top + 8);
    g.quadraticCurveTo(cx + dx * 1.2, top + h / 2, cx + dx, base - 3);
    g.stroke();
  }
  g.strokeStyle = IRON;
  g.lineWidth = 4;
  for (const hy of [top + 16, base - 14]) {
    g.beginPath();
    g.moveTo(cx - w / 2 - 1, hy);
    g.quadraticCurveTo(cx, hy + 5, cx + w / 2 + 1, hy);
    g.stroke();
  }
  ink(g, variant === 1 ? "#3d6b8f" : shade(WOOD_D, 10), () => {
    g.beginPath();
    g.ellipse(cx, top + 6, w / 2 - 3, 7, 0, 0, Math.PI * 2);
  });
  if (variant === 1) {
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.fillRect(cx - 8, top + 4, 10, 2);
  } else {
    g.strokeStyle = WOOD_D;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx - 14, top + 6);
    g.lineTo(cx + 14, top + 6);
    g.stroke();
  }
}

function sack(g: CanvasRenderingContext2D, cx: number, base: number, s = 1) {
  ink(g, "#c8ab7a", () => {
    g.beginPath();
    g.moveTo(cx - 16 * s, base - 2);
    g.quadraticCurveTo(cx - 22 * s, base - 26 * s, cx - 6 * s, base - 34 * s);
    g.lineTo(cx - 4 * s, base - 42 * s);
    g.lineTo(cx + 5 * s, base - 42 * s);
    g.lineTo(cx + 6 * s, base - 34 * s);
    g.quadraticCurveTo(cx + 22 * s, base - 26 * s, cx + 16 * s, base - 2);
    g.closePath();
  });
  g.strokeStyle = "#7a5a33";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx - 7 * s, base - 35 * s);
  g.lineTo(cx + 7 * s, base - 35 * s);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.beginPath();
  g.ellipse(cx - 6 * s, base - 20 * s, 4 * s, 9 * s, 0.3, 0, Math.PI * 2);
  g.fill();
}

function paint(g: CanvasRenderingContext2D, p: PropDef, W: number, H: number) {
  const base = H - 8;
  const cx = W / 2;
  const fw = p.tw * TILE * RES;
  const x0 = PAD;
  switch (p.kind) {
    case "barrel":
      shadow(g, cx, base, 30, 8);
      barrel(g, cx, base, p.variant);
      break;
    case "crates":
      shadow(g, cx, base, 34, 9);
      if (p.variant === 1) {
        crate(g, cx - 28, base - 42, 50, 42);
        crate(g, cx - 2, base - 30, 32, 30);
      } else {
        crate(g, cx - 26, base - 44, 52, 44);
        crate(g, cx - 18, base - 78, 38, 34);
      }
      break;
    case "sacks":
      shadow(g, cx, base, 32, 8);
      sack(g, cx - 12, base, 0.9);
      sack(g, cx + 12, base + 1, 0.85);
      sack(g, cx, base - 18, 0.75);
      break;
    case "bench": {
      shadow(g, cx, base, fw / 2, 8);
      for (const lx of [x0 + 14, x0 + fw - 22]) ink(g, WOOD_D, () => rr(g, lx, base - 26, 8, 24, 2));
      ink(g, shade(WOOD, 24), () => rr(g, x0 + 4, base - 38, fw - 8, 10, 3));
      ink(g, woodGrad(g, x0, x0 + fw), () => rr(g, x0 + 4, base - 30, fw - 8, 8, 2));
      g.strokeStyle = "rgba(60,35,15,0.4)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x0 + 8, base - 33);
      g.lineTo(x0 + fw - 8, base - 33);
      g.stroke();
      break;
    }
    case "lamp": {
      shadow(g, cx, base, 16, 5);
      // Soft halo around the lantern.
      const halo = g.createRadialGradient(cx, 30, 2, cx, 30, 34);
      halo.addColorStop(0, "rgba(255,214,130,0.55)");
      halo.addColorStop(1, "rgba(255,214,130,0)");
      g.fillStyle = halo;
      g.fillRect(cx - 36, 0, 72, 70);
      ink(g, "#3c4148", () => rr(g, cx - 10, base - 10, 20, 10, 3));
      ink(g, "#454b53", () => rr(g, cx - 4, 44, 8, base - 50, 2));
      ink(g, "#3c4148", () => rr(g, cx - 13, 44, 26, 6, 2));
      const glass = g.createRadialGradient(cx, 30, 1, cx, 30, 12);
      glass.addColorStop(0, "#fff6d2");
      glass.addColorStop(1, "#f0a640");
      ink(g, glass, () => rr(g, cx - 10, 18, 20, 26, 3));
      g.strokeStyle = OUTLINE;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, 18);
      g.lineTo(cx, 44);
      g.stroke();
      ink(g, "#3c4148", () => {
        g.beginPath();
        g.moveTo(cx - 15, 19);
        g.lineTo(cx, 6);
        g.lineTo(cx + 15, 19);
        g.closePath();
      });
      break;
    }
    case "planter": {
      shadow(g, cx, base, 34, 8);
      const top = base - 30;
      ink(g, "#8e8778", () => rr(g, cx - 30, top, 60, 30, 4));
      ink(g, "#aaa393", () => rr(g, cx - 30, top - 6, 60, 10, 4));
      g.fillStyle = "#5a3e28";
      rr(g, cx - 25, top - 4, 50, 5, 2);
      g.fill();
      const greens = ["#4f8c45", "#62a055", "#3f7438"];
      for (let i = 0; i < 9; i++) {
        g.fillStyle = greens[i % 3];
        g.beginPath();
        g.arc(cx - 24 + i * 6, top - 8 - ((i * 7) % 5) * 2, 7, 0, Math.PI * 2);
        g.fill();
      }
      const petals = ["#f59bb7", "#f6d860", "#ffffff", "#ff9a6b", "#b99af5"];
      for (let i = 0; i < 8; i++) {
        g.fillStyle = petals[(i + p.variant) % petals.length];
        g.beginPath();
        g.arc(cx - 22 + i * 6.4, top - 12 - ((i * 5) % 4) * 3, 3.2, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "board": {
      shadow(g, cx, base, 30, 6);
      for (const px of [cx - 30, cx + 24]) ink(g, WOOD_D, () => rr(g, px, 26, 7, base - 26, 2));
      ink(g, woodGrad(g, cx - 36, cx + 36, WOOD_L), () => rr(g, cx - 34, 30, 68, 50, 3));
      ink(g, "#6b3f2a", () => {
        g.beginPath();
        g.moveTo(cx - 42, 30);
        g.lineTo(cx, 14);
        g.lineTo(cx + 42, 30);
        g.closePath();
      });
      const notes: [number, number, number, number][] = [[-28, 36, 20, 24], [-4, 38, 16, 20], [14, 35, 16, 26], [-20, 60, 22, 16]];
      notes.forEach(([dx, dy, w, h], i) => {
        g.fillStyle = i === 2 ? "#f3e2b8" : "#efe8d6";
        g.fillRect(cx + dx, dy, w, h);
        g.strokeStyle = "rgba(80,60,40,0.55)";
        g.lineWidth = 1;
        for (let l = 5; l < h - 3; l += 4) {
          g.beginPath();
          g.moveTo(cx + dx + 3, dy + l);
          g.lineTo(cx + dx + w - 3, dy + l);
          g.stroke();
        }
        g.fillStyle = i === 2 ? "#c4402c" : "#8a8a8a";
        g.beginPath();
        g.arc(cx + dx + w / 2, dy + 2, 2, 0, Math.PI * 2);
        g.fill();
      });
      break;
    }
    case "hay": {
      shadow(g, cx, base, 32, 8);
      const hg = g.createLinearGradient(0, base - 48, 0, base);
      hg.addColorStop(0, "#f0cf78");
      hg.addColorStop(1, "#b88d3c");
      ink(g, hg, () => {
        g.beginPath();
        g.ellipse(cx, base - 22, 30, 22, 0, 0, Math.PI * 2);
      });
      g.strokeStyle = "rgba(120,80,30,0.55)";
      g.lineWidth = 1.5;
      for (let r = 6; r < 22; r += 5) {
        g.beginPath();
        g.ellipse(cx + 8, base - 22, r * 0.55, r, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = "#8a5a2a";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(cx - 12, base - 43);
      g.quadraticCurveTo(cx - 18, base - 22, cx - 12, base - 2);
      g.stroke();
      break;
    }
    case "cart": {
      shadow(g, cx, base, fw / 2 + 4, 9);
      // Handles.
      g.strokeStyle = OUTLINE;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(x0 + 18, base - 34);
      g.lineTo(x0 - 6, base - 20);
      g.stroke();
      g.strokeStyle = WOOD;
      g.lineWidth = 4;
      g.stroke();
      ink(g, woodGrad(g, x0, x0 + fw), () => rr(g, x0 + 10, base - 52, fw - 20, 24, 3));
      ink(g, shade(WOOD, 20), () => rr(g, x0 + 10, base - 60, fw - 20, 10, 3));
      crate(g, x0 + 24, base - 92, 40, 36);
      sack(g, x0 + fw - 42, base - 56, 0.8);
      for (const wx of [x0 + 30, x0 + fw - 30]) {
        ink(g, "#6b4a2b", () => {
          g.beginPath();
          g.arc(wx, base - 16, 15, 0, Math.PI * 2);
        });
        g.strokeStyle = "#3e2a1a";
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI;
          g.beginPath();
          g.moveTo(wx + Math.cos(a) * 12, base - 16 + Math.sin(a) * 12);
          g.lineTo(wx - Math.cos(a) * 12, base - 16 - Math.sin(a) * 12);
          g.stroke();
        }
        g.fillStyle = IRON;
        g.beginPath();
        g.arc(wx, base - 16, 4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "rack": {
      shadow(g, cx, base, 30, 6);
      for (const px of [cx - 28, cx + 22]) ink(g, WOOD_D, () => rr(g, px, 30, 7, base - 30, 2));
      ink(g, WOOD, () => rr(g, cx - 32, 44, 64, 7, 2));
      ink(g, WOOD, () => rr(g, cx - 32, base - 26, 64, 7, 2));
      const blade = (x: number, top: number, color: string, w: number) => {
        g.strokeStyle = OUTLINE;
        g.lineWidth = w + 3;
        g.beginPath();
        g.moveTo(x, base - 22);
        g.lineTo(x + 3, top);
        g.stroke();
        g.strokeStyle = color;
        g.lineWidth = w;
        g.stroke();
      };
      blade(cx - 16, 20, "#dfe5ea", 4);
      blade(cx - 2, 8, "#8a5a34", 3);
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.moveTo(cx - 4, 4);
      g.lineTo(cx + 3, 14);
      g.lineTo(cx - 5, 16);
      g.fill();
      blade(cx + 13, 26, "#cfd6dd", 5);
      g.fillStyle = "#c9a24a";
      g.fillRect(cx - 21, 50, 10, 4);
      g.fillRect(cx + 8, 54, 12, 4);
      break;
    }
    case "anvil": {
      shadow(g, cx, base, 30, 7);
      ink(g, woodGrad(g, cx - 20, cx + 20, "#7a5433"), () => rr(g, cx - 18, base - 30, 36, 30, 5));
      ink(g, "#9a7a55", () => {
        g.beginPath();
        g.ellipse(cx, base - 30, 18, 6, 0, 0, Math.PI * 2);
      });
      ink(g, "#4b5159", () => {
        g.beginPath();
        g.moveTo(cx - 14, base - 34);
        g.lineTo(cx + 12, base - 34);
        g.lineTo(cx + 10, base - 44);
        g.lineTo(cx + 26, base - 50);
        g.lineTo(cx + 20, base - 56);
        g.lineTo(cx - 20, base - 56);
        g.lineTo(cx - 20, base - 48);
        g.lineTo(cx - 10, base - 44);
        g.closePath();
      });
      g.fillStyle = "rgba(255,255,255,0.3)";
      g.fillRect(cx - 18, base - 55, 34, 3);
      // A hammer resting against it.
      g.strokeStyle = OUTLINE;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(cx - 28, base - 4);
      g.lineTo(cx - 20, base - 30);
      g.stroke();
      g.strokeStyle = WOOD_L;
      g.lineWidth = 3;
      g.stroke();
      ink(g, IRON, () => rr(g, cx - 28, base - 38, 16, 9, 2), 2);
      break;
    }
    case "well": {
      const wc = cx;
      const wy = base - 34;
      shadow(g, wc, base - 6, fw / 2, 14);
      // Posts and roof.
      for (const px of [wc - 50, wc + 44]) ink(g, WOOD_D, () => rr(g, px, 46, 8, wy - 40, 2));
      ink(g, "#8a4a32", () => {
        g.beginPath();
        g.moveTo(wc - 62, 54);
        g.lineTo(wc, 18);
        g.lineTo(wc + 62, 54);
        g.lineTo(wc + 52, 60);
        g.lineTo(wc, 30);
        g.lineTo(wc - 52, 60);
        g.closePath();
      });
      ink(g, WOOD, () => rr(g, wc - 50, 58, 100, 6, 2));
      g.strokeStyle = "#d8c8a0";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(wc, 64);
      g.lineTo(wc, 92);
      g.stroke();
      ink(g, "#7a5433", () => rr(g, wc - 9, 92, 18, 16, 3));
      // Stone ring.
      ink(g, "#9b968b", () => {
        g.beginPath();
        g.ellipse(wc, wy, 56, 22, 0, 0, Math.PI);
        g.lineTo(wc - 56, wy - 30);
        g.ellipse(wc, wy - 30, 56, 20, 0, Math.PI, 0, true);
        g.closePath();
      });
      g.strokeStyle = "rgba(40,36,30,0.45)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        const sx = wc - 48 + i * 16;
        g.beginPath();
        g.moveTo(sx, wy - 12);
        g.lineTo(sx, wy + 12);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(wc - 56, wy - 6);
      g.quadraticCurveTo(wc, wy + 16, wc + 56, wy - 6);
      g.stroke();
      ink(g, "#b5ad9b", () => {
        g.beginPath();
        g.ellipse(wc, wy - 30, 56, 20, 0, 0, Math.PI * 2);
      });
      g.fillStyle = "#1f3a4f";
      g.beginPath();
      g.ellipse(wc, wy - 30, 42, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(160,210,240,0.35)";
      g.fillRect(wc - 14, wy - 33, 18, 2);
      break;
    }
    case "logs": {
      shadow(g, cx, base, fw / 2, 8);
      const log = (x: number, y: number) => {
        ink(g, woodGrad(g, x, x + fw - 36, "#7a5433"), () => rr(g, x, y - 12, fw - 36, 24, 12));
        ink(g, "#d8b27a", () => {
          g.beginPath();
          g.ellipse(x + fw - 36, y, 9, 12, 0, 0, Math.PI * 2);
        });
        g.strokeStyle = "rgba(120,80,40,0.6)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(x + fw - 36, y, 4.5, 6, 0, 0, Math.PI * 2);
        g.stroke();
      };
      log(x0 + 8, base - 14);
      log(x0 + 20, base - 16);
      log(x0 + 12, base - 36);
      break;
    }
    case "stall": {
      const awnA = p.variant === 1 ? "#3f6a8a" : "#b8433a";
      const awnB = "#efe4cc";
      shadow(g, cx, base, fw / 2 + 6, 10);
      // Back posts, counter, front posts.
      for (const px of [x0 + 8, x0 + fw - 16]) ink(g, WOOD_D, () => rr(g, px, 40, 8, base - 70, 2));
      ink(g, shade(WOOD, 18), () => rr(g, x0 + 2, base - 58, fw - 4, 14, 3));
      ink(g, woodGrad(g, x0, x0 + fw), () => rr(g, x0 + 2, base - 46, fw - 4, 44, 3));
      g.strokeStyle = WOOD_D;
      g.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        g.beginPath();
        g.moveTo(x0 + (fw * i) / 6, base - 44);
        g.lineTo(x0 + (fw * i) / 6, base - 4);
        g.stroke();
      }
      // Goods on the counter.
      if (p.variant === 1) {
        const bolts = ["#6b3f6f", "#d8b35a", "#3f7a5a", "#b8433a", "#efe4cc"];
        bolts.forEach((c, i) => ink(g, c, () => rr(g, x0 + 12 + i * 22, base - 74, 18, 18, 6), 2.5));
        ink(g, "#b86a3a", () => {
          g.beginPath();
          g.ellipse(x0 + fw - 18, base - 66, 9, 11, 0, 0, Math.PI * 2);
        }, 2.5);
      } else {
        const fruit = ["#d8452f", "#8cc04a", "#f0a33a"];
        for (let b = 0; b < 3; b++) {
          const bx = x0 + 14 + b * 38;
          ink(g, "#9a6b3a", () => rr(g, bx, base - 66, 32, 12, 3), 2.5);
          for (let i = 0; i < 5; i++) {
            g.fillStyle = fruit[b];
            g.beginPath();
            g.arc(bx + 5 + i * 5.5, base - 68 - (i % 2) * 3, 4.5, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = "rgba(0,0,0,0.35)";
            g.lineWidth = 1;
            g.stroke();
          }
        }
      }
      // Striped awning with a scalloped edge.
      const aTop = 18;
      const aBot = 60;
      g.save();
      g.beginPath();
      g.moveTo(x0 - 6, aBot);
      g.lineTo(x0 + 10, aTop);
      g.lineTo(x0 + fw - 10, aTop);
      g.lineTo(x0 + fw + 6, aBot);
      for (let sx = x0 + fw + 6; sx > x0 - 6; sx -= 16) g.quadraticCurveTo(sx - 8, aBot + 10, sx - 16, aBot);
      g.closePath();
      g.fillStyle = awnB;
      g.fill();
      g.clip();
      g.fillStyle = awnA;
      for (let sx = x0 - 20; sx < x0 + fw + 20; sx += 32) {
        g.beginPath();
        g.moveTo(sx, aBot + 12);
        g.lineTo(sx + 6, aTop);
        g.lineTo(sx + 22, aTop);
        g.lineTo(sx + 16, aBot + 12);
        g.fill();
      }
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.fillRect(x0, aTop, fw, 6);
      g.restore();
      g.strokeStyle = OUTLINE;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x0 - 6, aBot);
      g.lineTo(x0 + 10, aTop);
      g.lineTo(x0 + fw - 10, aTop);
      g.lineTo(x0 + fw + 6, aBot);
      for (let sx = x0 + fw + 6; sx > x0 - 6; sx -= 16) g.quadraticCurveTo(sx - 8, aBot + 10, sx - 16, aBot);
      g.stroke();
      break;
    }
  }
}

/** Texture for a prop, painted once per kind+variant+footprint. */
export function propTexture(scene: Phaser.Scene, p: PropDef): { key: string; padX: number } {
  const key = `prop:${p.kind}:${p.variant}:${p.tw}x${p.th}`;
  if (!scene.textures.exists(key)) {
    const W = p.tw * TILE * RES + PAD * 2;
    const H = HEIGHT[p.kind] + (p.th - 1) * TILE * RES * 0.5;
    const tex = scene.textures.createCanvas(key, W, H)!;
    const g = tex.getContext();
    g.lineJoin = "round";
    g.lineCap = "round";
    paint(g, p, W, H);
    tex.refresh();
  }
  return { key, padX: PAD / RES };
}
