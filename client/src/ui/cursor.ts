/**
 * Custom cursors, painted in the game's style (dark outline, warm gold). Over the world the
 * cursor tells you what a click would mean — attack, talk, use, loot, inspect — and over the
 * interface it's a gauntlet that points, grabs and drags.
 */

export type CursorKind = "default" | "pointer" | "aim" | "attack" | "talk" | "use" | "loot" | "inspect" | "grab" | "grabbing" | "dead";

const SIZE = 32;
const OUTLINE = "#1d1a17";
const GOLD = "#f2d27a";
const GOLD_D = "#b8862a";

/** Hot spots: where on the image the click lands. */
const HOT: Record<CursorKind, [number, number]> = {
  default: [3, 2], pointer: [9, 2], aim: [16, 16], attack: [16, 16], talk: [6, 4], use: [10, 3], loot: [8, 4], inspect: [12, 12], grab: [14, 12], grabbing: [14, 12], dead: [3, 2],
};
/** What the browser falls back to if custom cursors are unavailable. */
const FALLBACK: Record<CursorKind, string> = {
  default: "default", pointer: "pointer", aim: "crosshair", attack: "crosshair", talk: "pointer", use: "pointer", loot: "pointer", inspect: "zoom-in", grab: "grab", grabbing: "grabbing", dead: "default",
};

type G = CanvasRenderingContext2D;

function stroke(g: G, color: string, w: number) {
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = OUTLINE;
  g.lineWidth = w + 3;
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
}

function fill(g: G, color: string | CanvasGradient, w = 2.5) {
  g.lineJoin = "round";
  g.strokeStyle = OUTLINE;
  g.lineWidth = w;
  g.stroke();
  g.fillStyle = color;
  g.fill();
}

function goldGrad(g: G, y0: number, y1: number, hi = "#fff3c8", mid = GOLD, lo = GOLD_D) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, hi);
  gr.addColorStop(0.5, mid);
  gr.addColorStop(1, lo);
  return gr;
}

/** The classic arrow, in gold. */
function arrow(g: G, grey = false) {
  g.beginPath();
  g.moveTo(3, 2);
  g.lineTo(3, 24);
  g.lineTo(9, 18);
  g.lineTo(13, 27);
  g.lineTo(17, 25);
  g.lineTo(13, 16);
  g.lineTo(21, 16);
  g.closePath();
  fill(g, grey ? goldGrad(g, 2, 27, "#e8e4dc", "#a8a49c", "#6f6a62") : goldGrad(g, 2, 27), 2.4);
  g.beginPath();
  g.moveTo(5.5, 7);
  g.lineTo(5.5, 17);
  g.strokeStyle = "rgba(255,255,255,0.65)";
  g.lineWidth = 1.4;
  g.stroke();
}

/** A gauntlet: pointing, open or closed. */
function gauntlet(g: G, pose: "point" | "open" | "fist") {
  const metal = goldGrad(g, 4, 30, "#eef3f6", "#c9d3dd", "#7d8792");
  // Palm and cuff.
  g.beginPath();
  g.roundRect(7, 13, 16, 13, 5);
  fill(g, metal);
  g.beginPath();
  g.roundRect(8, 25, 14, 6, 2);
  fill(g, goldGrad(g, 25, 31), 2);
  if (pose === "point") {
    g.beginPath();
    g.roundRect(7, 2, 5, 14, 2.5);
    fill(g, metal, 2);
    for (const x of [12, 16]) {
      g.beginPath();
      g.roundRect(x, 11, 4, 6, 2);
      fill(g, metal, 1.8);
    }
  } else if (pose === "open") {
    for (const [x, y, h] of [[6, 5, 10], [10, 3, 12], [14, 3, 12], [18, 5, 10]] as const) {
      g.beginPath();
      g.roundRect(x, y, 4, h, 2);
      fill(g, metal, 1.8);
    }
    g.beginPath();
    g.roundRect(21, 14, 6, 4, 2);
    fill(g, metal, 1.8);
  } else {
    for (const x of [8, 12, 16]) {
      g.beginPath();
      g.roundRect(x, 10, 4.5, 6, 2);
      fill(g, metal, 1.8);
    }
  }
}

const PAINT: Record<CursorKind, (g: G) => void> = {
  default: (g) => arrow(g),
  dead: (g) => arrow(g, true),
  pointer: (g) => gauntlet(g, "point"),
  grab: (g) => gauntlet(g, "open"),
  grabbing: (g) => gauntlet(g, "fist"),
  aim: (g) => {
    g.beginPath();
    g.arc(16, 16, 8, 0, Math.PI * 2);
    stroke(g, GOLD, 1.6);
    for (const [x0, y0, x1, y1] of [[16, 2, 16, 8], [16, 24, 16, 30], [2, 16, 8, 16], [24, 16, 30, 16]] as const) {
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      stroke(g, GOLD, 1.6);
    }
    g.beginPath();
    g.arc(16, 16, 1.6, 0, Math.PI * 2);
    fill(g, "#fff3c8", 1.5);
  },
  attack: (g) => {
    // Crossed swords over a red reticle.
    g.beginPath();
    g.arc(16, 16, 10, 0, Math.PI * 2);
    stroke(g, "#e8503a", 1.8);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(16 - 11 * s, 5);
      g.lineTo(16 + 9 * s, 25);
      stroke(g, "#eef3f6", 2.4);
      g.beginPath();
      g.moveTo(16 + 5 * s, 25);
      g.lineTo(16 + 11 * s, 20);
      stroke(g, GOLD, 2);
    }
  },
  talk: (g) => {
    g.beginPath();
    g.moveTo(8, 4);
    g.lineTo(26, 4);
    g.quadraticCurveTo(30, 4, 30, 8);
    g.lineTo(30, 17);
    g.quadraticCurveTo(30, 21, 26, 21);
    g.lineTo(15, 21);
    g.lineTo(8, 28);
    g.lineTo(10, 21);
    g.lineTo(8, 21);
    g.quadraticCurveTo(4, 21, 4, 17);
    g.lineTo(4, 8);
    g.quadraticCurveTo(4, 4, 8, 4);
    g.closePath();
    fill(g, goldGrad(g, 4, 21, "#fffaf0", "#f4ecd8", "#d9c9a8"));
    g.fillStyle = OUTLINE;
    for (const x of [11, 17, 23]) {
      g.beginPath();
      g.arc(x, 12.5, 1.8, 0, Math.PI * 2);
      g.fill();
    }
  },
  use: (g) => {
    gauntlet(g, "open");
    g.beginPath();
    g.arc(26, 7, 4, 0, Math.PI * 2);
    fill(g, "#9fe0a6", 2);
  },
  loot: (g) => {
    // A coin purse with a coin spilling out.
    g.beginPath();
    g.moveTo(10, 10);
    g.quadraticCurveTo(3, 18, 6, 25);
    g.quadraticCurveTo(15, 31, 24, 25);
    g.quadraticCurveTo(27, 18, 20, 10);
    g.closePath();
    fill(g, goldGrad(g, 10, 28, "#c9a878", "#8a5a34", "#5a3b24"));
    g.beginPath();
    g.moveTo(9, 10);
    g.lineTo(21, 10);
    stroke(g, "#c9a24a", 2);
    g.beginPath();
    g.moveTo(10, 4);
    g.lineTo(15, 9);
    g.lineTo(20, 4);
    stroke(g, "#8a5a34", 2);
    g.beginPath();
    g.arc(25, 8, 4.5, 0, Math.PI * 2);
    fill(g, goldGrad(g, 3, 13), 2);
  },
  inspect: (g) => {
    g.beginPath();
    g.arc(12, 12, 8, 0, Math.PI * 2);
    fill(g, "rgba(180,220,255,0.35)", 2);
    g.beginPath();
    g.arc(12, 12, 8, 0, Math.PI * 2);
    stroke(g, GOLD, 2.2);
    g.beginPath();
    g.moveTo(18, 18);
    g.lineTo(28, 28);
    stroke(g, "#8a5a34", 3.4);
  },
};

const urls = new Map<CursorKind, string>();

function url(kind: CursorKind) {
  let u = urls.get(kind);
  if (!u) {
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    PAINT[kind](c.getContext("2d")!);
    u = c.toDataURL();
    urls.set(kind, u);
  }
  return u;
}

/** A CSS cursor value for this kind. */
export function cursorCss(kind: CursorKind) {
  const [x, y] = HOT[kind];
  return `url(${url(kind)}) ${x} ${y}, ${FALLBACK[kind]}`;
}

/** Style the whole page: arrow by default, a pointing gauntlet over anything clickable, a grabbing one while dragging. */
export function installCursors() {
  if (document.getElementById("floors-cursors")) return;
  const style = document.createElement("style");
  style.id = "floors-cursors";
  style.textContent = `
    html, body { cursor: ${cursorCss("default")}; }
    button:not(:disabled), a, select, label, summary, .shop-row, .slot-cell, .tracker, .sk-slot, .sk-tile, .sk-tab, .pk-tab, .slot.skill.empty, [role="button"], .clickable { cursor: ${cursorCss("pointer")}; }
    .pk-cell:not(.empty) { cursor: ${cursorCss("grab")}; }
    body.pk-dragging, body.pk-dragging * { cursor: ${cursorCss("grabbing")} !important; }
    input, textarea { cursor: text; }
  `;
  document.head.append(style);
}

let current: CursorKind | undefined;

/** The cursor over the game world (set every few frames by the scene). */
export function setWorldCursor(canvas: HTMLCanvasElement, kind: CursorKind) {
  if (kind === current) return;
  current = kind;
  canvas.style.cursor = cursorCss(kind);
  canvas.dataset.cursor = kind;
}
