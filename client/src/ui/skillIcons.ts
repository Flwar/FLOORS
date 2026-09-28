import { skillById } from "@floors/shared";

/**
 * Skill icons: a medallion in the skill's colour with a glyph for what it does, drawn in
 * the game's style (dark outline, soft light) on a 64×64 grid and cached as data URLs.
 */

const OUTLINE = "#1d1a17";
const cache = new Map<string, string>();

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
function shade(c: string, amt: number) {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `#${((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0")}`;
}

type G = CanvasRenderingContext2D;

/** Stroke the current path with a dark outline and then a colour. */
function ink(g: G, color: string, w: number) {
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = OUTLINE;
  g.lineWidth = w + 4;
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
}

function fillInk(g: G, color: string | CanvasGradient, w = 3.5) {
  g.lineJoin = "round";
  g.strokeStyle = OUTLINE;
  g.lineWidth = w;
  g.stroke();
  g.fillStyle = color;
  g.fill();
}

function blade(g: G, x0: number, y0: number, x1: number, y1: number, width = 6, color = "#eef3f6") {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  ink(g, color, width);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const gx = x0 + dx * 0.22;
  const gy = y0 + dy * 0.22;
  g.beginPath();
  g.moveTo(gx + nx * 8, gy + ny * 8);
  g.lineTo(gx - nx * 8, gy - ny * 8);
  ink(g, "#f2d27a", 4);
}

function arrowHead(g: G, x: number, y: number, a: number, s: number, color: string) {
  g.beginPath();
  g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
  g.lineTo(x + Math.cos(a + 2.5) * s, y + Math.sin(a + 2.5) * s);
  g.lineTo(x + Math.cos(a - 2.5) * s, y + Math.sin(a - 2.5) * s);
  g.closePath();
  fillInk(g, color, 3);
}

function star(g: G, cx: number, cy: number, r: number, points: number, inner: number) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    if (i) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    else g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
}

function flake(g: G, cx: number, cy: number, r: number, color: string) {
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    g.beginPath();
    g.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    for (const s of [-1, 1]) {
      const bx = cx + Math.cos(a) * r * 0.6 * s;
      const by = cy + Math.sin(a) * r * 0.6 * s;
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a + 0.7 * s) * r * 0.3 * -s, by + Math.sin(a + 0.7 * s) * r * 0.3 * -s);
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a - 0.7 * s) * r * 0.3 * -s, by + Math.sin(a - 0.7 * s) * r * 0.3 * -s);
    }
    ink(g, color, 3.5);
  }
}

function bolt(g: G, pts: [number, number][], color: string, w = 5) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  ink(g, color, w);
}

function flame(g: G, cx: number, cy: number, s: number, outer: string, inner: string) {
  const path = (k: number) => {
    g.beginPath();
    g.moveTo(cx, cy - 20 * s * k);
    g.bezierCurveTo(cx + 14 * s * k, cy - 6 * s * k, cx + 12 * s * k, cy + 12 * s * k, cx, cy + 14 * s * k);
    g.bezierCurveTo(cx - 12 * s * k, cy + 12 * s * k, cx - 14 * s * k, cy - 4 * s * k, cx - 2 * s * k, cy - 8 * s * k);
    g.quadraticCurveTo(cx - 2 * s * k, cy - 14 * s * k, cx, cy - 20 * s * k);
    g.closePath();
  };
  path(1);
  fillInk(g, outer);
  path(0.55);
  g.fillStyle = inner;
  g.translate(0, 4 * s);
  g.fill();
  g.translate(0, -4 * s);
}

const GLYPH: Record<string, (g: G, c: string) => void> = {
  whirl: (g, c) => {
    g.beginPath();
    g.arc(32, 32, 17, -0.6, Math.PI * 1.35);
    ink(g, c, 5);
    arrowHead(g, 32 + Math.cos(-0.6) * 17, 32 + Math.sin(-0.6) * 17, -0.6 + Math.PI / 2, 8, c);
    blade(g, 24, 40, 42, 22, 5);
  },
  stance: (g) => {
    g.beginPath();
    g.moveTo(32, 12);
    g.lineTo(48, 18);
    g.lineTo(46, 36);
    g.lineTo(32, 52);
    g.lineTo(18, 36);
    g.lineTo(16, 18);
    g.closePath();
    const gr = g.createLinearGradient(0, 12, 0, 52);
    gr.addColorStop(0, "#fff1b8");
    gr.addColorStop(1, "#c9953a");
    fillInk(g, gr);
    blade(g, 22, 46, 44, 18, 4.5);
  },
  dash: (g, c) => {
    for (const [y, x0] of [[22, 12], [32, 8], [42, 12]]) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x0 + 14, y);
      ink(g, c, 3);
    }
    blade(g, 22, 40, 54, 24, 6);
  },
  wave: (g, c) => {
    g.beginPath();
    g.arc(28, 32, 20, -1.2, 1.2);
    g.arc(20, 32, 16, 1.0, -1.0, true);
    g.closePath();
    const gr = g.createLinearGradient(10, 0, 50, 0);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, c);
    fillInk(g, gr);
  },
  rally: (g) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(32 + Math.cos(a) * 20, 30 + Math.sin(a) * 20);
      g.lineTo(32 + Math.cos(a) * 26, 30 + Math.sin(a) * 26);
      ink(g, "#fff1b8", 2.5);
    }
    blade(g, 32, 52, 32, 10, 6);
  },
  judgement: (g, c) => {
    g.beginPath();
    g.moveTo(10, 52);
    g.lineTo(54, 10);
    ink(g, c, 4);
    star(g, 46, 18, 10, 4, 0.3);
    fillInk(g, "#ffffff", 2.5);
    star(g, 18, 44, 6, 4, 0.3);
    fillInk(g, "#ffffff", 2.5);
  },
  slam: (g, c) => {
    g.beginPath();
    g.moveTo(32, 8);
    g.lineTo(32, 34);
    ink(g, c, 6);
    arrowHead(g, 32, 40, Math.PI / 2, 10, c);
    bolt(g, [[10, 50], [20, 46], [26, 52], [32, 46], [38, 52], [44, 46], [54, 50]], "#d8a060", 3.5);
  },
  warcry: (g, c) => {
    for (const r of [10, 18, 26]) {
      g.beginPath();
      g.arc(20, 32, r, -0.8, 0.8);
      ink(g, c, 3.5);
    }
    g.beginPath();
    g.arc(18, 32, 7, 0, Math.PI * 2);
    fillInk(g, "#fff1d8");
  },
  fissure: (g, c) => {
    bolt(g, [[10, 54], [22, 40], [18, 32], [32, 24], [30, 16], [46, 8]], c, 6);
    for (const [x, y] of [[40, 40], [48, 30], [16, 18]]) {
      g.beginPath();
      g.arc(x, y, 3.5, 0, Math.PI * 2);
      fillInk(g, "#b08050", 2.5);
    }
  },
  ironskin: (g) => {
    g.beginPath();
    g.moveTo(32, 10);
    g.lineTo(50, 17);
    g.lineTo(48, 36);
    g.lineTo(32, 54);
    g.lineTo(16, 36);
    g.lineTo(14, 17);
    g.closePath();
    const gr = g.createLinearGradient(0, 10, 0, 54);
    gr.addColorStop(0, "#f2f6f9");
    gr.addColorStop(1, "#6f7984");
    fillInk(g, gr);
    for (const [x, y] of [[24, 22], [40, 22], [32, 40]]) {
      g.beginPath();
      g.arc(x, y, 2.5, 0, Math.PI * 2);
      g.fillStyle = "#3c4148";
      g.fill();
    }
  },
  cyclone: (g, c) => {
    g.beginPath();
    for (let t = 0; t < 4 * Math.PI; t += 0.1) {
      const r = 3 + t * 1.8;
      const x = 32 + Math.cos(t) * r;
      const y = 32 + Math.sin(t) * r * 0.8;
      if (t) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    ink(g, c, 3.5);
  },
  titan: (g, c) => {
    g.beginPath();
    g.roundRect(20, 8, 24, 18, 4);
    fillInk(g, "#9aa3ad");
    g.beginPath();
    g.moveTo(32, 26);
    g.lineTo(32, 42);
    ink(g, "#8a5a34", 5);
    star(g, 32, 50, 12, 6, 0.45);
    fillInk(g, c, 3);
  },
  shadow: (g, c) => {
    for (const [x, y, r] of [[22, 40, 10], [38, 38, 12], [30, 28, 11]] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      fillInk(g, shade(c, -30), 3);
    }
    g.beginPath();
    g.arc(30, 24, 8, 0, Math.PI * 2);
    fillInk(g, "#2b2440", 3);
    for (const dx of [-3, 3]) {
      g.beginPath();
      g.arc(30 + dx, 24, 1.6, 0, Math.PI * 2);
      g.fillStyle = "#dcd4ff";
      g.fill();
    }
  },
  fan: (g) => {
    for (const a of [-0.6, 0, 0.6]) blade(g, 32 + Math.sin(a) * 10, 52, 32 + Math.sin(a) * 30, 52 - Math.cos(a) * 40, 4);
  },
  venom: (g, c) => {
    g.beginPath();
    g.moveTo(32, 8);
    g.bezierCurveTo(22, 26, 16, 32, 18, 42);
    g.arc(32, 42, 14, Math.PI, 0, true);
    g.bezierCurveTo(48, 32, 42, 26, 32, 8);
    g.closePath();
    const gr = g.createLinearGradient(0, 8, 0, 56);
    gr.addColorStop(0, "#d8ffb8");
    gr.addColorStop(1, shade(c, -50));
    fillInk(g, gr);
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.beginPath();
    g.ellipse(26, 40, 3, 6, 0.3, 0, Math.PI * 2);
    g.fill();
  },
  evis: (g, c) => {
    blade(g, 14, 50, 44, 20, 5);
    for (const d of [-7, 0, 7]) {
      g.beginPath();
      g.moveTo(34 + d, 12);
      g.lineTo(50 + d, 36);
      ink(g, c, 3);
    }
  },
  dance: (g) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      blade(g, 32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8, 32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26, 4);
    }
  },
  assassin: (g, c) => {
    g.beginPath();
    g.arc(28, 28, 18, 0.9, Math.PI * 1.9);
    g.arc(36, 22, 14, Math.PI * 1.7, 0.7, true);
    g.closePath();
    fillInk(g, shade(c, 40), 3);
    blade(g, 26, 54, 50, 26, 5);
  },
  charge: (g, c) => {
    for (const [y, x0] of [[24, 8], [40, 8]]) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x0 + 12, y);
      ink(g, c, 3);
    }
    g.beginPath();
    g.moveTo(12, 32);
    g.lineTo(46, 32);
    ink(g, "#8a5a34", 5);
    arrowHead(g, 50, 32, 0, 11, "#eef3f6");
  },
  vault: (g, c) => {
    g.beginPath();
    g.moveTo(10, 50);
    g.quadraticCurveTo(32, 0, 52, 44);
    g.setLineDash([5, 6]);
    ink(g, c, 3.5);
    g.setLineDash([]);
    arrowHead(g, 52, 46, 1.25, 8, c);
    g.beginPath();
    g.moveTo(24, 54);
    g.lineTo(40, 54);
    ink(g, "#8a5a34", 4);
  },
  javelin: (g) => {
    g.beginPath();
    g.moveTo(12, 52);
    g.lineTo(44, 20);
    ink(g, "#8a5a34", 4.5);
    arrowHead(g, 48, 16, -Math.PI / 4, 11, "#eef3f6");
  },
  sweep: (g, c) => {
    g.beginPath();
    g.arc(32, 36, 22, Math.PI * 1.05, Math.PI * 2.95, false);
    g.setLineDash([2, 0]);
    ink(g, c, 5);
    g.beginPath();
    g.moveTo(32, 36);
    g.lineTo(52, 22);
    ink(g, "#8a5a34", 4);
    arrowHead(g, 54, 20, -0.6, 7, "#eef3f6");
  },
  skewer: (g) => {
    g.beginPath();
    g.moveTo(8, 32);
    g.lineTo(48, 32);
    ink(g, "#8a5a34", 4);
    arrowHead(g, 52, 32, 0, 10, "#eef3f6");
    for (const x of [20, 32]) {
      g.beginPath();
      g.arc(x, 32, 5.5, 0, Math.PI * 2);
      fillInk(g, "#c4402c", 2.5);
    }
  },
  dragon: (g) => {
    flame(g, 30, 34, 1.1, "#ff8a3a", "#ffe08a");
    g.beginPath();
    g.moveTo(10, 50);
    g.lineTo(44, 16);
    ink(g, "#5a3b24", 4);
    arrowHead(g, 48, 12, -Math.PI / 4, 9, "#eef3f6");
  },
  frost: (g, c) => flake(g, 32, 32, 20, c),
  blizzard: (g, c) => {
    flake(g, 26, 34, 14, c);
    flake(g, 44, 22, 9, "#ffffff");
    flake(g, 44, 46, 7, "#ffffff");
  },
  meteor: (g) => {
    for (const d of [0, 6, 12]) {
      g.beginPath();
      g.moveTo(44 - d, 12 + d * 0.4);
      g.lineTo(26 - d, 30 + d * 0.4);
      ink(g, "#ffb347", 3);
    }
    g.beginPath();
    g.arc(26, 40, 13, 0, Math.PI * 2);
    const gr = g.createRadialGradient(22, 36, 2, 26, 40, 13);
    gr.addColorStop(0, "#fff6d8");
    gr.addColorStop(0.5, "#ff9a3a");
    gr.addColorStop(1, "#b8342c");
    fillInk(g, gr);
  },
  lightning: (g, c) => {
    g.beginPath();
    g.moveTo(36, 6);
    g.lineTo(16, 36);
    g.lineTo(30, 36);
    g.lineTo(24, 58);
    g.lineTo(48, 26);
    g.lineTo(34, 26);
    g.closePath();
    const gr = g.createLinearGradient(0, 6, 0, 58);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, c);
    fillInk(g, gr);
  },
  mend: (g, c) => {
    g.beginPath();
    g.moveTo(26, 12);
    g.lineTo(38, 12);
    g.lineTo(38, 26);
    g.lineTo(52, 26);
    g.lineTo(52, 38);
    g.lineTo(38, 38);
    g.lineTo(38, 52);
    g.lineTo(26, 52);
    g.lineTo(26, 38);
    g.lineTo(12, 38);
    g.lineTo(12, 26);
    g.lineTo(26, 26);
    g.closePath();
    const gr = g.createLinearGradient(0, 12, 0, 52);
    gr.addColorStop(0, "#f0fff0");
    gr.addColorStop(1, c);
    fillInk(g, gr);
  },
  barrage: (g, c) => {
    for (const [x, y, r] of [[18, 40, 7], [32, 28, 8], [46, 40, 7], [32, 48, 5]] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      const gr = g.createRadialGradient(x - 2, y - 2, 1, x, y, r);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(1, c);
      fillInk(g, gr, 3);
    }
  },
};

/** Paint a skill icon (by vfx key and colour) into a 64×64 design space. */
export function drawSkillIcon(g: G, vfx: string, color: number) {
  const c = hex(color);
  // Medallion.
  g.beginPath();
  g.roundRect(3, 3, 58, 58, 12);
  const bg = g.createRadialGradient(24, 20, 4, 32, 32, 44);
  bg.addColorStop(0, shade(c, -40));
  bg.addColorStop(1, shade(c, -140));
  g.fillStyle = bg;
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = 4;
  g.stroke();
  g.beginPath();
  g.roundRect(6, 6, 52, 52, 10);
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 2;
  g.stroke();
  // Soft glow behind the glyph.
  const glow = g.createRadialGradient(32, 32, 2, 32, 32, 28);
  glow.addColorStop(0, `${c}55`);
  glow.addColorStop(1, `${c}00`);
  g.fillStyle = glow;
  g.fillRect(4, 4, 56, 56);
  (GLYPH[vfx] ?? GLYPH.whirl)(g, c);
}

/** A skill's icon as a data URL (by skill id). */
export function skillIcon(id: string, px = 48): string {
  const key = `${id}:${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sk = skillById(id)?.move;
  const c = document.createElement("canvas");
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  c.width = c.height = Math.round(px * scale);
  const g = c.getContext("2d")!;
  g.scale(c.width / 64, c.height / 64);
  drawSkillIcon(g, sk?.vfx ?? "whirl", sk?.color ?? 0xdfe8ff);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
