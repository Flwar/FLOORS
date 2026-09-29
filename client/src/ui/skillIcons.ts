import { skillById, skillEntry } from "@floors/shared";

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

/** Small tongues of fire along the bottom of an icon. */
function embers(g: G) {
  flame(g, 16, 50, 0.45, "#ff7a2a", "#ffe08a");
  flame(g, 48, 50, 0.4, "#ff7a2a", "#ffe08a");
}

function ball(g: G, x: number, y: number, r: number, inner: string, mid: string, outer: string) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.5, mid);
  gr.addColorStop(1, outer);
  fillInk(g, gr);
}

/** A dragon's head in profile, jaws open (Dragon's Breath, Wrath of the Wyrm). */
function dragonHead(g: G, x: number, y: number, s: number, color: string) {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + 18 * s, y - 12 * s);
  g.lineTo(x + 30 * s, y - 10 * s);
  g.lineTo(x + 26 * s, y - 2 * s);
  g.lineTo(x + 14 * s, y + 2 * s);
  g.lineTo(x + 28 * s, y + 8 * s);
  g.lineTo(x + 14 * s, y + 12 * s);
  g.lineTo(x - 2 * s, y + 10 * s);
  g.closePath();
  fillInk(g, color, 3);
  g.beginPath();
  g.moveTo(x + 4 * s, y - 2 * s);
  g.lineTo(x - 8 * s, y - 16 * s);
  g.lineTo(x + 10 * s, y - 6 * s);
  fillInk(g, "#e8dcc0", 2.5);
  g.fillStyle = "#ffe08a";
  g.beginPath();
  g.arc(x + 16 * s, y - 6 * s, 2 * s, 0, Math.PI * 2);
  g.fill();
}

/** A little sun: a white-gold disc with rays. */
function sunDisc(g: G, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 ? r * 1.15 : r * 1.6;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  fillInk(g, "#ffd24a", 2.5);
  g.beginPath();
  g.arc(x, y, r * 0.8, 0, Math.PI * 2);
  fillInk(g, "#fff8e0", 2);
}

const GLYPH: Record<string, (g: G, c: string) => void> = {
  // --- Sun arts -----------------------------------------------------------------------
  khopesh: (g, c) => {
    GLYPH.sweep(g, c);
    sunDisc(g, 48, 16, 6);
  },
  sunpierce: (g, c) => {
    GLYPH.pierce(g, c);
    sunDisc(g, 16, 16, 6);
  },
  dunebreaker: (g, c) => {
    GLYPH.quake(g, c);
    sunDisc(g, 46, 14, 6);
  },
  solarflare: (g, c) => {
    GLYPH.fissure(g, c);
    sunDisc(g, 16, 16, 7);
  },
  scarabs: (g, c) => {
    GLYPH.cuts(g, c);
    sunDisc(g, 32, 32, 6);
  },
  miragestep: (g, c) => {
    GLYPH.dash(g, c);
    sunDisc(g, 48, 18, 6);
  },
  obelisk: (g, c) => {
    g.beginPath();
    g.moveTo(26, 54); g.lineTo(28, 18); g.lineTo(32, 10); g.lineTo(36, 18); g.lineTo(38, 54);
    g.closePath();
    fillInk(g, "#e8d4a0", 3);
    g.beginPath();
    g.moveTo(12, 40);
    g.lineTo(56, 24);
    ink(g, c, 5);
    sunDisc(g, 46, 14, 5);
  },
  sunwheel: (g, c) => {
    GLYPH.whirlspear(g, c);
    sunDisc(g, 32, 32, 7);
  },
  sunrays: (g, c) => {
    for (const a of [-0.45, 0, 0.45]) {
      g.beginPath();
      g.moveTo(16, 32);
      g.lineTo(16 + Math.cos(a) * 40, 32 + Math.sin(a) * 40);
      ink(g, c, 4);
    }
    sunDisc(g, 16, 32, 7);
  },
  noonday: (g, c) => {
    g.beginPath();
    g.moveTo(24, 6); g.lineTo(40, 6); g.lineTo(46, 50); g.lineTo(18, 50);
    g.closePath();
    const bg = g.createLinearGradient(0, 6, 0, 50);
    bg.addColorStop(0, "rgba(255,248,224,0.95)");
    bg.addColorStop(1, c);
    fillInk(g, bg, 2.5);
    sunDisc(g, 32, 12, 7);
  },
  sunbolt: (g, c) => {
    GLYPH.barrage(g, c);
    sunDisc(g, 14, 32, 6);
  },
  carapace: (g, c) => {
    g.beginPath();
    g.ellipse(32, 34, 18, 22, 0, 0, Math.PI * 2);
    fillInk(g, c, 3.5);
    g.beginPath();
    g.moveTo(32, 14); g.lineTo(32, 56);
    g.moveTo(16, 28); g.quadraticCurveTo(32, 22, 48, 28);
    ink(g, "#5a3a10", 2.5);
    sunDisc(g, 32, 12, 5);
  },
  sandstorm: (g, c) => {
    GLYPH.cyclone(g, c);
    sunDisc(g, 48, 14, 5);
  },
  sunfall: (g, c) => {
    GLYPH.heaven(g, c);
    sunDisc(g, 32, 14, 9);
  },
  // --- Dragon arts and universal skills ----------------------------------------------
  dragonfang: (g, c) => {
    GLYPH.dash(g, c);
    embers(g);
  },
  wyrmslayer: (g, c) => {
    GLYPH.sunder(g, c);
    flame(g, 32, 44, 0.6, "#ff7a2a", "#ffe08a");
  },
  magma: (g, c) => {
    GLYPH.fissure(g, c);
    embers(g);
  },
  cataclysm: (g, c) => {
    GLYPH.titan(g, c);
    embers(g);
  },
  emberdance: (g, c) => {
    GLYPH.dance(g, c);
    flame(g, 32, 34, 0.5, "#ff7a2a", "#ffe08a");
  },
  wyvern: (g, c) => GLYPH.assassin(g, c),
  dragoon: (g, c) => {
    GLYPH.skyfall(g, c);
  },
  wyrmfang: (g, c) => {
    GLYPH.skewer(g, c);
    embers(g);
  },
  breath: (g) => {
    g.beginPath();
    g.moveTo(24, 30);
    g.lineTo(58, 12);
    g.lineTo(58, 50);
    g.closePath();
    const gr = g.createLinearGradient(24, 0, 58, 0);
    gr.addColorStop(0, "#fff0b0");
    gr.addColorStop(0.5, "#ff9a3a");
    gr.addColorStop(1, "rgba(200,60,30,0.6)");
    g.fillStyle = gr;
    g.fill();
    dragonHead(g, 8, 32, 0.62, "#6b3a2a");
  },
  meteors: (g) => {
    for (const [x, y, r] of [[20, 22, 7], [44, 18, 6], [34, 42, 11]] as const) {
      g.beginPath();
      g.moveTo(x + r * 1.6, y - r * 1.6);
      g.lineTo(x, y);
      ink(g, "#ffb347", 2.5);
      ball(g, x, y, r, "#fff6d8", "#ff9a3a", "#b8342c");
    }
  },
  kick: (g, c) => {
    g.beginPath();
    g.moveTo(16, 14);
    g.lineTo(26, 14);
    g.lineTo(28, 36);
    g.lineTo(48, 38);
    g.quadraticCurveTo(54, 40, 52, 48);
    g.lineTo(20, 48);
    g.closePath();
    fillInk(g, "#7a5433");
    g.beginPath();
    g.moveTo(20, 48);
    g.lineTo(52, 48);
    ink(g, "#3a2a1a", 4);
    for (const [x0, y0] of [[56, 22], [58, 32], [56, 42]]) {
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 - 4, y0);
      ink(g, c, 3);
    }
  },
  knife: (g, c) => {
    blade(g, 12, 50, 48, 14, 6, "#eef3f6");
    for (const d of [0, 7]) {
      g.beginPath();
      g.moveTo(8 + d, 38 + d);
      g.lineTo(2 + d, 44 + d);
      ink(g, c, 2);
    }
  },
  fireball: (g) => {
    for (const d of [0, 7, 14]) {
      g.beginPath();
      g.moveTo(12 + d * 0.3, 50 - d);
      g.lineTo(28, 36);
      ink(g, "#ff9a3a", 3);
    }
    ball(g, 38, 26, 15, "#fff6d8", "#ffb347", "#d8402c");
  },
  storm: (g) => {
    g.beginPath();
    g.ellipse(32, 18, 22, 10, 0, 0, Math.PI * 2);
    fillInk(g, "#5a6478");
    bolt(g, [[22, 24], [16, 38], [24, 38], [18, 54]], "#eaf6ff", 4);
    bolt(g, [[42, 24], [36, 38], [44, 38], [38, 54]], "#9fd3ff", 4);
  },
  sunburst: (g) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14);
      g.lineTo(32 + Math.cos(a) * (i % 2 ? 22 : 27), 32 + Math.sin(a) * (i % 2 ? 22 : 27));
      ink(g, "#ffe08a", 3);
    }
    ball(g, 32, 32, 12, "#ffffff", "#fff0b0", "#e8b840");
  },
  wyrmwrath: (g) => {
    flame(g, 36, 34, 1.15, "#ff5a1a", "#ffd07a");
    dragonHead(g, 10, 36, 0.7, "#3a1e14");
  },
  phoenix: (g) => {
    flame(g, 32, 40, 0.7, "#ff7a2a", "#ffe08a");
    for (const sgn of [-1, 1]) {
      g.beginPath();
      g.moveTo(32, 30);
      g.quadraticCurveTo(32 + 16 * sgn, 8, 32 + 28 * sgn, 14);
      g.quadraticCurveTo(32 + 18 * sgn, 20, 32 + 22 * sgn, 28);
      g.quadraticCurveTo(32 + 12 * sgn, 26, 32, 34);
      g.closePath();
      const gr = g.createLinearGradient(32, 30, 32 + 28 * sgn, 10);
      gr.addColorStop(0, "#ffe08a");
      gr.addColorStop(1, "#ff5a2a");
      fillInk(g, gr, 3);
    }
    g.beginPath();
    g.arc(32, 22, 5, 0, Math.PI * 2);
    fillInk(g, "#ffd07a", 2.5);
  },
  hatchets: (g) => {
    for (const [x, y, a] of [[18, 40, -0.6], [32, 30, -0.2], [46, 40, 0.3]] as const) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      g.moveTo(0, 12);
      g.lineTo(0, -10);
      ink(g, "#8a5a34", 3.5);
      g.beginPath();
      g.moveTo(-1, -12);
      g.quadraticCurveTo(10, -14, 9, -4);
      g.lineTo(-1, -5);
      g.closePath();
      fillInk(g, "#dfe5ea", 2.5);
      g.restore();
    }
  },
  snare: (g, c) => {
    g.beginPath();
    g.arc(32, 34, 20, 0, Math.PI * 2);
    ink(g, c, 3);
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(32 + i * 8, 15);
      g.lineTo(32 + i * 8, 53);
      g.moveTo(13, 34 + i * 8);
      g.lineTo(51, 34 + i * 8);
      ink(g, "#a88a5a", 2);
    }
    for (const [x, y] of [[14, 22], [50, 22], [14, 46], [50, 46]] as const) {
      g.beginPath();
      g.arc(x, y, 3.5, 0, Math.PI * 2);
      fillInk(g, "#6f6a60", 2);
    }
  },
  howl: (g, c) => {
    // A wolf's head raised to the moon.
    g.beginPath();
    g.arc(46, 16, 8, 0, Math.PI * 2);
    fillInk(g, "#fff6d8", 2.5);
    g.beginPath();
    g.moveTo(14, 54);
    g.lineTo(18, 34);
    g.lineTo(28, 18);
    g.lineTo(34, 26);
    g.lineTo(38, 20);
    g.lineTo(36, 34);
    g.lineTo(30, 42);
    g.lineTo(34, 54);
    g.closePath();
    fillInk(g, c);
    for (const r of [8, 13]) {
      g.beginPath();
      g.arc(30, 20, r, -2.2, -1.2);
      ink(g, "#ffe08a", 2);
    }
  },
  gale: (g, c) => {
    for (const [y, l] of [[22, 34], [32, 44], [42, 30]] as const) {
      g.beginPath();
      g.moveTo(10, y);
      g.quadraticCurveTo(10 + l * 0.6, y - 8, 10 + l, y);
      g.quadraticCurveTo(10 + l + 6, y + 6, 10 + l - 4, y + 7);
      ink(g, c, 3.5);
    }
    arrowHead(g, 56, 32, 0, 8, "#ffffff");
  },
  windwall: (g, c) => {
    for (const r of [10, 17, 24]) {
      g.beginPath();
      g.arc(32, 32, r, -0.9, 0.9);
      ink(g, c, 3);
      g.beginPath();
      g.arc(32, 32, r, Math.PI - 0.9, Math.PI + 0.9);
      ink(g, c, 3);
    }
    g.beginPath();
    g.arc(32, 32, 5, 0, Math.PI * 2);
    fillInk(g, "#ffffff", 2.5);
  },
  drakeblood: (g) => {
    g.beginPath();
    g.moveTo(24, 14);
    g.lineTo(40, 14);
    g.lineTo(40, 22);
    g.quadraticCurveTo(52, 30, 48, 44);
    g.quadraticCurveTo(44, 56, 32, 56);
    g.quadraticCurveTo(20, 56, 16, 44);
    g.quadraticCurveTo(12, 30, 24, 22);
    g.closePath();
    const gr = g.createLinearGradient(0, 22, 0, 56);
    gr.addColorStop(0, "#ffb347");
    gr.addColorStop(1, "#8a1a14");
    fillInk(g, gr);
    flame(g, 32, 40, 0.45, "#ffe08a", "#ffffff");
    g.beginPath();
    g.roundRect(22, 8, 20, 7, 2);
    fillInk(g, "#8a5a34", 2.5);
  },
  eruption: (g) => {
    g.beginPath();
    g.moveTo(6, 54);
    g.lineTo(24, 30);
    g.lineTo(40, 30);
    g.lineTo(58, 54);
    g.closePath();
    fillInk(g, "#4a3a32");
    flame(g, 32, 24, 0.8, "#ff5a1a", "#ffe08a");
    for (const [x, y] of [[16, 14], [48, 12], [22, 6]] as const) {
      g.beginPath();
      g.arc(x, y, 3.5, 0, Math.PI * 2);
      fillInk(g, "#ffb347", 2);
    }
  },
  glacial: (g, c) => {
    GLYPH.sunder(g, c);
    flake(g, 32, 44, 9, "#ffffff");
  },
  verdict: (g, c) => {
    GLYPH.pierce(g, c);
    flake(g, 46, 18, 8, "#ffffff");
  },
  avalanche: (g, c) => {
    GLYPH.quake(g, c);
    flake(g, 20, 18, 7, "#ffffff");
    flake(g, 44, 16, 6, "#ffffff");
  },
  shatter: (g, c) => {
    GLYPH.fissure(g, c);
    flake(g, 48, 18, 7, "#ffffff");
  },
  frostfang: (g, c) => {
    GLYPH.cuts(g, c);
    flake(g, 32, 32, 7, "#ffffff");
  },
  shiver: (g, c) => {
    GLYPH.phantom(g, c);
    flake(g, 48, 44, 7, "#ffffff");
  },
  icicle: (g, c) => {
    g.beginPath();
    g.moveTo(8, 50);
    g.lineTo(34, 32);
    ink(g, "#5a3b24", 4);
    g.beginPath();
    g.moveTo(30, 30);
    g.lineTo(58, 8);
    g.lineTo(38, 38);
    g.closePath();
    const gr = g.createLinearGradient(30, 38, 58, 8);
    gr.addColorStop(0, c);
    gr.addColorStop(1, "#ffffff");
    fillInk(g, gr, 3);
  },
  hailspin: (g, c) => {
    GLYPH.whirlspear(g, c);
    for (const [x, y] of [[14, 14], [50, 14], [50, 50]] as const) {
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      fillInk(g, "#ffffff", 2);
    }
  },
  iceshards: (g, c) => {
    for (const [a, len] of [[-0.5, 22], [-0.25, 26], [0, 28], [0.25, 26], [0.5, 22]] as const) {
      const x0 = 12;
      const y0 = 32;
      const x1 = x0 + Math.cos(a) * (len + 18);
      const y1 = y0 + Math.sin(a) * (len + 18);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x1 - Math.cos(a + 0.3) * 12, y1 - Math.sin(a + 0.3) * 12);
      g.lineTo(x1 - Math.cos(a - 0.3) * 12, y1 - Math.sin(a - 0.3) * 12);
      g.closePath();
      fillInk(g, c, 2);
    }
  },
  glacialspike: (g, c) => {
    g.beginPath();
    g.moveTo(10, 54);
    g.lineTo(54, 54);
    ink(g, "#8a98a8", 4);
    for (const [x, h, w] of [[32, 44, 9], [20, 26, 6], [44, 30, 6]] as const) {
      g.beginPath();
      g.moveTo(x - w, 54);
      g.lineTo(x, 54 - h);
      g.lineTo(x + w, 54);
      g.closePath();
      const gr = g.createLinearGradient(0, 54 - h, 0, 54);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(1, c);
      fillInk(g, gr, 2.5);
    }
  },
  icelance: (g, c) => {
    g.beginPath();
    g.moveTo(8, 56);
    g.lineTo(46, 18);
    ink(g, c, 5);
    g.beginPath();
    g.moveTo(58, 6);
    g.lineTo(40, 18);
    g.lineTo(46, 24);
    g.closePath();
    fillInk(g, "#ffffff", 2.5);
    flake(g, 18, 20, 7, "#ffffff");
  },
  prison: (g, c) => {
    g.beginPath();
    g.roundRect(14, 12, 36, 42, 6);
    const gr = g.createLinearGradient(14, 12, 50, 54);
    gr.addColorStop(0, "rgba(255,255,255,0.9)");
    gr.addColorStop(1, c);
    fillInk(g, gr, 3);
    g.fillStyle = "#1d1a17";
    g.beginPath();
    g.arc(32, 28, 6, 0, Math.PI * 2);
    g.fill();
    g.fillRect(26, 34, 12, 14);
    for (const x of [22, 32, 42]) {
      g.beginPath();
      g.moveTo(x, 12);
      g.lineTo(x, 54);
      ink(g, "rgba(255,255,255,0.8)", 1.5);
    }
  },
  hailstorm: (g) => {
    g.beginPath();
    g.ellipse(32, 16, 22, 10, 0, 0, Math.PI * 2);
    fillInk(g, "#8a9aae");
    for (const [x, y] of [[18, 34], [30, 42], [44, 34], [24, 52], [40, 50]] as const) {
      g.beginPath();
      g.arc(x, y, 4.5, 0, Math.PI * 2);
      fillInk(g, "#eaf6ff", 2);
    }
  },
  // --- Void arts ------------------------------------------------------------------------
  eclipseslash: (g, c) => {
    GLYPH.sunder(g, c);
    moonMark(g, 44, 18, 9, "#f4f0ff");
  },
  nightfall: (g, c) => {
    GLYPH.phantom(g, c);
    moonMark(g, 48, 44, 8, "#f4f0ff");
  },
  umbra: (g, c) => {
    GLYPH.quake(g, c);
    voidOrb(g, 32, 20, 8, c);
  },
  voidcleave: (g, c) => {
    GLYPH.fissure(g, c);
    voidOrb(g, 48, 18, 7, c);
  },
  nightblades: (g, c) => {
    GLYPH.cuts(g, c);
    voidOrb(g, 32, 32, 7, c);
  },
  shadewalk: (g, c) => {
    GLYPH.phantom(g, c);
    voidOrb(g, 48, 44, 7, c);
  },
  starfall: (g, c) => {
    GLYPH.pierce(g, c);
    star(g, 46, 18, 9, 5, 0.45);
    fillInk(g, "#f4f0ff", 2.5);
  },
  crescent: (g, c) => {
    moonMark(g, 32, 32, 24, c);
    moonMark(g, 32, 32, 12, "#f4f0ff");
  },
  voidorbs: (g, c) => {
    for (const [x, y] of [[20, 44], [32, 28], [46, 42]] as const) voidOrb(g, x, y, 8, c);
  },
  singularity: (g, c) => {
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(32, 32, 24 - i * 7, i, i + Math.PI * 1.4);
      ink(g, i ? c : "#f4f0ff", 2.5);
    }
    voidOrb(g, 32, 32, 7, c);
  },
  shadowbolt: (g, c) => {
    g.beginPath();
    g.moveTo(8, 56);
    g.lineTo(36, 28);
    ink(g, c, 5);
    voidOrb(g, 42, 22, 11, c);
  },
  siphon: (g, c) => {
    for (const [x, y] of [[12, 14], [52, 14], [12, 50], [52, 50]] as const) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(32 + (x - 32) * 0.35, 32 + (y - 32) * 0.35);
      ink(g, "#f4f0ff", 2.5);
    }
    voidOrb(g, 32, 32, 10, c);
  },
  voidrift: (g, c) => {
    g.beginPath();
    g.ellipse(32, 40, 24, 11, 0, 0, Math.PI * 2);
    fillInk(g, "#0c0814", 3);
    g.beginPath();
    g.ellipse(32, 40, 24, 11, 0, 0, Math.PI * 2);
    ink(g, c, 2.5);
    for (const [x, h] of [[22, 20], [32, 28], [42, 18]] as const) {
      g.beginPath();
      g.moveTo(x, 40);
      g.lineTo(x + 2, 40 - h);
      ink(g, c, 3);
    }
  },
  eclipse: (g, c) => {
    g.beginPath();
    g.arc(32, 32, 24, 0, Math.PI * 2);
    const gr = g.createRadialGradient(32, 32, 14, 32, 32, 26);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, c);
    fillInk(g, gr, 3);
    g.beginPath();
    g.arc(32, 32, 17, 0, Math.PI * 2);
    fillInk(g, "#0c0814", 2);
  },
  // --- Clockwork arts -------------------------------------------------------------------
  gearsaw: (g, c) => {
    cog(g, 32, 34, 18, c);
    GLYPH.sunder(g, "#ffffff");
  },
  piston: (g, c) => {
    g.beginPath();
    g.roundRect(8, 26, 30, 12, 3);
    fillInk(g, "#8a8a8a", 3);
    g.beginPath();
    g.moveTo(38, 32);
    g.lineTo(58, 32);
    ink(g, c, 7);
  },
  steamhammer: (g, c) => {
    GLYPH.quake(g, c);
    cog(g, 46, 16, 8, "#ffffff");
  },
  overdrive: (g, c) => {
    GLYPH.fissure(g, c);
    cog(g, 16, 16, 8, "#ffffff");
  },
  springblades: (g, c) => {
    GLYPH.cuts(g, c);
    spring(g, 32, 32, c);
  },
  ticktock: (g, c) => {
    g.beginPath();
    g.arc(32, 32, 22, 0, Math.PI * 2);
    fillInk(g, "#f4ecd8", 3);
    g.beginPath();
    g.moveTo(32, 32);
    g.lineTo(32, 16);
    g.moveTo(32, 32);
    g.lineTo(44, 38);
    ink(g, c, 3);
  },
  railshot: (g, c) => {
    GLYPH.pierce(g, c);
    cog(g, 16, 48, 7, "#ffffff");
  },
  gyro: (g, c) => {
    GLYPH.whirlspear(g, c);
    cog(g, 32, 32, 7, "#ffffff");
  },
  sparks: (g, c) => {
    for (const a of [-0.5, 0, 0.5]) {
      g.beginPath();
      g.moveTo(10, 32);
      g.lineTo(10 + Math.cos(a) * 20, 32 + Math.sin(a) * 20 - 5);
      g.lineTo(10 + Math.cos(a) * 30, 32 + Math.sin(a) * 30 + 3);
      g.lineTo(10 + Math.cos(a) * 46, 32 + Math.sin(a) * 46);
      ink(g, c, 2.5);
    }
  },
  aetherburst: (g, c) => {
    g.beginPath();
    g.arc(32, 32, 10, 0, Math.PI * 2);
    fillInk(g, "#ffffff", 3);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14);
      g.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26);
      ink(g, c, 2.5);
    }
  },
  shrapnel: (g, c) => {
    g.beginPath();
    g.arc(24, 38, 11, 0, Math.PI * 2);
    fillInk(g, "#3a3a3a", 3);
    for (const [x, y] of [[44, 18], [50, 30], [40, 10], [54, 44]] as const) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 5, y + 3);
      g.lineTo(x + 1, y + 7);
      g.closePath();
      fillInk(g, c, 2);
    }
  },
  overclock: (g, c) => {
    cog(g, 32, 32, 20, c);
    g.beginPath();
    g.moveTo(32, 32);
    g.lineTo(46, 18);
    ink(g, "#ff5a4a", 3);
  },
  steamvent: (g, c) => {
    g.beginPath();
    g.ellipse(32, 48, 18, 7, 0, 0, Math.PI * 2);
    fillInk(g, "#3a3a3a", 3);
    for (const [x, h] of [[24, 26], [32, 34], [40, 24]] as const) {
      g.beginPath();
      g.moveTo(x, 46);
      g.quadraticCurveTo(x - 6, 46 - h / 2, x, 46 - h);
      ink(g, c, 3);
    }
  },
  titanfist: (g, c) => {
    g.beginPath();
    g.roundRect(14, 18, 30, 28, 6);
    fillInk(g, c, 3);
    for (const x of [20, 28, 36]) {
      g.beginPath();
      g.moveTo(x, 18);
      g.lineTo(x, 30);
      ink(g, "#5a3a10", 2);
    }
    g.beginPath();
    g.moveTo(44, 32);
    g.lineTo(58, 32);
    ink(g, "#ffffff", 4);
  },
  // --- Tide arts ------------------------------------------------------------------------
  tidebreak: (g, c) => {
    GLYPH.sunder(g, c);
    wavelet(g, 18, 50, c);
  },
  undertow: (g, c) => {
    GLYPH.pierce(g, c);
    wavelet(g, 14, 50, c);
  },
  tsunami: (g, c) => {
    wavelet(g, 10, 30, c, 1.8);
    wavelet(g, 14, 48, "#ffffff", 1.2);
  },
  riptide: (g, c) => {
    GLYPH.fissure(g, c);
    wavelet(g, 30, 16, c);
  },
  barbs: (g, c) => {
    GLYPH.cuts(g, c);
    drop(g, 32, 34, 7, c);
  },
  eelstep: (g, c) => {
    GLYPH.phantom(g, c);
    drop(g, 48, 44, 7, c);
  },
  tridentstorm: (g, c) => {
    for (const dy of [-10, 0, 10]) {
      g.beginPath();
      g.moveTo(10, 32 + dy * 0.3);
      g.lineTo(54, 32 + dy);
      ink(g, dy ? c : "#ffffff", 3);
    }
  },
  maelspin: (g, c) => {
    GLYPH.whirlspear(g, c);
    drop(g, 50, 16, 6, "#ffffff");
  },
  bubbles: (g, c) => {
    for (const [x, y, r] of [[18, 44, 7], [30, 28, 9], [46, 40, 8], [42, 18, 5]] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      fillInk(g, "rgba(255,255,255,0.25)", 2.5);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      ink(g, c, 2);
    }
  },
  geyser: (g, c) => {
    g.beginPath();
    g.moveTo(24, 56);
    g.quadraticCurveTo(26, 30, 22, 10);
    g.lineTo(42, 10);
    g.quadraticCurveTo(38, 30, 40, 56);
    g.closePath();
    const gr = g.createLinearGradient(0, 10, 0, 56);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, c);
    fillInk(g, gr, 3);
  },
  tidalwave: (g, c) => {
    wavelet(g, 8, 40, c, 2);
  },
  riptidedash: (g, c) => {
    GLYPH.phantom(g, c);
    wavelet(g, 30, 50, c);
  },
  whirlpool: (g, c) => {
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(32, 36, 24 - i * 7, 14 - i * 4, 0, i, i + Math.PI * 1.5);
      ink(g, i === 1 ? "#ffffff" : c, 2.5);
    }
  },
  leviathan: (g, c) => {
    g.beginPath();
    g.moveTo(8, 50);
    g.bezierCurveTo(20, 10, 36, 60, 50, 22);
    ink(g, c, 7);
    g.beginPath();
    g.arc(52, 20, 6, 0, Math.PI * 2);
    fillInk(g, c, 2.5);
    wavelet(g, 8, 56, "#ffffff", 1.4);
  },
  absolutezero: (g, c) => {
    flake(g, 32, 32, 24, c);
    flake(g, 32, 32, 12, "#ffffff");
    g.beginPath();
    g.arc(32, 32, 5, 0, Math.PI * 2);
    fillInk(g, "#ffffff", 2);
  },
  passive: (g, c) => {
    g.beginPath();
    g.moveTo(32, 8);
    g.lineTo(52, 16);
    g.quadraticCurveTo(52, 44, 32, 56);
    g.quadraticCurveTo(12, 44, 12, 16);
    g.closePath();
    const gr = g.createLinearGradient(0, 8, 0, 56);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, c);
    fillInk(g, gr);
    star(g, 32, 30, 11, 5, 0.45);
    fillInk(g, "#fff3d0", 2.5);
  },
  // --- Deeper skills (levels 10 and 12) -------------------------------------------------
  pierce: (g, c) => {
    blade(g, 10, 50, 50, 14, 5);
    for (const [x, y] of [[38, 26], [26, 38]]) {
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      ink(g, c, 2.5);
    }
  },
  sunder: (g, c) => {
    g.beginPath();
    g.arc(32, 44, 26, Math.PI * 1.05, Math.PI * 1.95);
    ink(g, c, 7);
    g.beginPath();
    g.arc(32, 44, 26, Math.PI * 1.15, Math.PI * 1.85);
    ink(g, "#ffffff", 2.5);
    bolt(g, [[20, 50], [26, 44], [30, 50], [36, 42], [42, 50]], "#b08050", 3);
  },
  aegis: (g, c) => {
    g.beginPath();
    g.moveTo(32, 9);
    g.lineTo(50, 16);
    g.lineTo(48, 36);
    g.lineTo(32, 55);
    g.lineTo(16, 36);
    g.lineTo(14, 16);
    g.closePath();
    const gr = g.createLinearGradient(0, 9, 0, 55);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, c);
    fillInk(g, gr);
    star(g, 32, 30, 9, 4, 0.35);
    fillInk(g, "#ffffff", 2.5);
  },
  skyfall: (g, c) => {
    for (const x of [22, 42]) {
      g.beginPath();
      g.moveTo(x, 8);
      g.lineTo(x, 26);
      ink(g, "#fff6d8", 2.5);
    }
    blade(g, 32, 8, 32, 46, 6);
    g.beginPath();
    g.ellipse(32, 50, 18, 5, 0, 0, Math.PI * 2);
    ink(g, c, 3);
  },
  rush: (g, c) => {
    for (const [x, w] of [[14, 4], [24, 5], [36, 6]]) {
      g.beginPath();
      g.moveTo(x, 18);
      g.lineTo(x + 10, 32);
      g.lineTo(x, 46);
      ink(g, c, w);
    }
    for (const y of [22, 32, 42]) {
      g.beginPath();
      g.moveTo(6, y);
      g.lineTo(12, y);
      ink(g, "#ffffff", 2);
    }
  },
  guillotine: (g, c) => {
    g.beginPath();
    g.moveTo(18, 8);
    g.lineTo(18, 54);
    g.moveTo(46, 8);
    g.lineTo(46, 54);
    g.moveTo(14, 10);
    g.lineTo(50, 10);
    ink(g, "#8a5a34", 4);
    g.beginPath();
    g.moveTo(21, 20);
    g.lineTo(43, 26);
    g.lineTo(43, 34);
    g.lineTo(21, 34);
    g.closePath();
    const gr = g.createLinearGradient(0, 20, 0, 34);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, c);
    fillInk(g, gr, 3);
  },
  bloodlust: (g, c) => {
    g.beginPath();
    g.moveTo(32, 10);
    g.bezierCurveTo(46, 28, 48, 36, 44, 44);
    g.arc(32, 42, 12.6, 0.15, Math.PI - 0.15);
    g.bezierCurveTo(16, 36, 18, 28, 32, 10);
    g.closePath();
    const gr = g.createLinearGradient(0, 10, 0, 56);
    gr.addColorStop(0, "#ff9a8a");
    gr.addColorStop(1, c);
    fillInk(g, gr);
    g.beginPath();
    g.ellipse(27, 38, 3, 5, -0.4, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.fill();
  },
  quake: (g, c) => {
    for (const r of [10, 18, 26]) {
      g.beginPath();
      g.ellipse(32, 42, r, r * 0.35, 0, 0, Math.PI * 2);
      ink(g, c, 3);
    }
    bolt(g, [[32, 42], [26, 30], [34, 24], [28, 12]], "#3a2c1c", 3.5);
  },
  smoke: (g, c) => {
    for (const [x, y, r] of [[22, 38, 11], [40, 38, 12], [31, 26, 13], [32, 44, 10]] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      fillInk(g, shade(c, -20), 3);
    }
    g.beginPath();
    g.arc(31, 26, 7, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fill();
  },
  cuts: (g, c) => {
    for (const [x0, y0, x1, y1] of [[12, 16, 34, 46], [22, 12, 46, 40], [30, 14, 52, 42], [14, 30, 30, 52]]) {
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      ink(g, x0 === 22 ? "#ffffff" : c, 3);
    }
  },
  mark: (g, c) => {
    g.beginPath();
    g.arc(32, 32, 16, 0, Math.PI * 2);
    ink(g, c, 4);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      g.beginPath();
      g.moveTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10);
      g.lineTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24);
      ink(g, c, 3);
    }
    g.beginPath();
    g.arc(32, 32, 4, 0, Math.PI * 2);
    fillInk(g, "#ffffff", 2.5);
  },
  phantom: (g, c) => {
    for (const [x, al] of [[14, 0.35], [24, 0.6], [34, 1]] as const) {
      g.globalAlpha = al;
      g.beginPath();
      g.arc(x + 6, 24, 7, 0, Math.PI * 2);
      g.moveTo(x, 32);
      g.lineTo(x + 12, 32);
      g.lineTo(x + 14, 50);
      g.lineTo(x - 2, 50);
      g.closePath();
      fillInk(g, shade(c, -30), 3);
    }
    g.globalAlpha = 1;
    blade(g, 42, 44, 56, 18, 4);
  },
  phalanx: (g, c) => {
    g.beginPath();
    g.roundRect(14, 14, 26, 36, 6);
    const gr = g.createLinearGradient(0, 14, 0, 50);
    gr.addColorStop(0, "#f2f6f9");
    gr.addColorStop(1, c);
    fillInk(g, gr);
    g.beginPath();
    g.moveTo(46, 56);
    g.lineTo(46, 12);
    ink(g, "#8a5a34", 4);
    arrowHead(g, 46, 8, -Math.PI / 2, 8, "#eef3f6");
  },
  pin: (g, c) => {
    g.beginPath();
    g.moveTo(10, 16);
    g.lineTo(40, 44);
    ink(g, "#8a5a34", 4);
    arrowHead(g, 44, 48, Math.PI / 4, 9, "#eef3f6");
    flake(g, 48, 18, 9, c);
  },
  whirlspear: (g, c) => {
    g.beginPath();
    g.arc(32, 32, 22, 0.3, Math.PI * 1.7);
    ink(g, c, 4);
    g.beginPath();
    g.moveTo(14, 46);
    g.lineTo(46, 18);
    ink(g, "#8a5a34", 4);
    arrowHead(g, 49, 15, -Math.PI / 4, 8, "#eef3f6");
  },
  heaven: (g, c) => {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.35;
      g.beginPath();
      g.moveTo(50 + Math.cos(a) * 6, 16 + Math.sin(a) * 6);
      g.lineTo(50 + Math.cos(a) * 12, 16 + Math.sin(a) * 12);
      ink(g, "#fff6d8", 2);
    }
    g.beginPath();
    g.moveTo(8, 56);
    g.lineTo(44, 20);
    ink(g, c, 5);
    arrowHead(g, 48, 16, -Math.PI / 4, 10, "#ffffff");
  },
  drain: (g, c) => {
    bolt(g, [[8, 20], [20, 28], [28, 22], [40, 32]], c, 4);
    g.beginPath();
    g.moveTo(44, 26);
    g.bezierCurveTo(54, 38, 54, 44, 50, 48);
    g.arc(44, 46, 7, 0.2, Math.PI - 0.2);
    g.bezierCurveTo(34, 44, 36, 38, 44, 26);
    g.closePath();
    fillInk(g, "#d84a4a", 3);
  },
  ward: (g, c) => {
    g.beginPath();
    g.arc(32, 32, 20, 0, Math.PI * 2);
    ink(g, c, 4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.arc(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 3, 0, Math.PI * 2);
      fillInk(g, "#ffffff", 2);
    }
    star(g, 32, 32, 10, 6, 0.45);
    fillInk(g, "#ffffff", 2.5);
  },
  pulse: (g, c) => {
    for (const r of [8, 16, 24]) {
      g.beginPath();
      g.arc(32, 32, r, 0, Math.PI * 2);
      ink(g, r === 16 ? "#ffffff" : c, 3);
    }
    for (let i = 0; i < 4; i++) arrowHead(g, 32 + Math.cos((i * Math.PI) / 2) * 27, 32 + Math.sin((i * Math.PI) / 2) * 27, (i * Math.PI) / 2, 5, c);
  },
  comet: (g, c) => {
    for (const [w, col] of [[12, c], [6, "#fff1d8"]] as const) {
      g.beginPath();
      g.moveTo(10, 12);
      g.lineTo(36, 38);
      ink(g, col, w);
    }
    g.beginPath();
    g.arc(40, 42, 11, 0, Math.PI * 2);
    const gr = g.createRadialGradient(37, 39, 2, 40, 42, 11);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, c);
    fillInk(g, gr);
  },
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

/** A gear. */
function cog(g: G, x: number, y: number, r: number, color: string) {
  g.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.25;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  fillInk(g, color, 2.5);
  g.beginPath();
  g.arc(x, y, r * 0.35, 0, Math.PI * 2);
  fillInk(g, "#1d1a17", 1.5);
}

/** A coiled spring. */
function spring(g: G, x: number, y: number, color: string) {
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    g.lineTo(x - 12 + t * 24, y + Math.sin(t * Math.PI * 6) * 6);
  }
  ink(g, color, 2.5);
}

/** A curling wave. */
function wavelet(g: G, x: number, y: number, color: string, s = 1) {
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x + 10 * s, y - 18 * s, x + 24 * s, y - 18 * s, x + 26 * s, y - 6 * s);
  g.bezierCurveTo(x + 20 * s, y - 12 * s, x + 14 * s, y - 4 * s, x + 22 * s, y);
  ink(g, color, 3);
}

/** A drop of water. */
function drop(g: G, x: number, y: number, r: number, color: string) {
  g.beginPath();
  g.moveTo(x, y - r * 1.8);
  g.quadraticCurveTo(x + r, y - r * 0.2, x, y + r);
  g.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.8);
  fillInk(g, color, 2.5);
}

/** A crescent moon, opening to the right. */
function moonMark(g: G, x: number, y: number, r: number, color: string) {
  g.beginPath();
  g.arc(x, y, r, Math.PI * 0.3, Math.PI * 1.7, false);
  g.arc(x + r * 0.5, y, r * 0.78, Math.PI * 1.62, Math.PI * 0.38, true);
  g.closePath();
  fillInk(g, color, 2.5);
}

/** An orb of the void: black, with a violet rim. */
function voidOrb(g: G, x: number, y: number, r: number, color: string) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  const gr = g.createRadialGradient(x, y, 1, x, y, r);
  gr.addColorStop(0, "#000000");
  gr.addColorStop(0.65, "#1a0e2e");
  gr.addColorStop(1, color);
  fillInk(g, gr, 2.5);
}

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

/** Colours for passive skills, so each reads differently at a glance. */
const PASSIVE_COLOR: Record<string, number> = {
  fleetfoot: 0x8fe0c0, deepLungs: 0x9fd3ff, secondWind: 0x9fe08a, ironSkin: 0xc9d3dd, wardensGrace: 0xffe08a, riposteMaster: 0xffc27a, keenEye: 0xdfe8ff,
  executioner: 0xff7a6a, momentum: 0xffb040, scaleguard: 0xd8a060, lastStand: 0xff5a4a, unbroken: 0xb77af2, emberblood: 0xff7a2a, wyrmsbane: 0xf2a93b, frostblood: 0x8fd3ff, glacialHide: 0xdfeaf4,
  umbralTouch: 0xb77af2, nightveil: 0x6a5a9a, stormcaller: 0x9fd3ff, tidalGrace: 0x8ff0e0, siegebreaker: 0xff9a3a, clockworkHeart: 0xffd070, sunstrike: 0xffd24a, oasisHeart: 0x3ab8a0,
};

/** A passive skill's icon (shield and star in its colour). */
export function passiveIcon(id: string, px = 48): string {
  const key = `passive:${id}:${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  c.width = c.height = Math.round(px * scale);
  const g = c.getContext("2d")!;
  g.scale(c.width / 64, c.height / 64);
  drawSkillIcon(g, "passive", PASSIVE_COLOR[id] ?? 0xe8c55a);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** Draw any skill book entry's icon into a 64×64 design space (for scrolls). */
export function drawEntryIcon(g: G, id: string) {
  const e = skillEntry(id);
  if (!e) return;
  if (e.kind === "passive") drawSkillIcon(g, "passive", PASSIVE_COLOR[id] ?? 0xe8c55a);
  else drawSkillIcon(g, e.move?.vfx ?? "whirl", e.move?.color ?? 0xdfe8ff);
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
