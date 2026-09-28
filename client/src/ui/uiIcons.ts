/**
 * Interface icons, drawn in the game's style (dark outline, warm gold, soft highlights)
 * on a 64×64 design grid and cached as data URLs.
 */

export type UiIconName =
  | "main" | "side" | "talk" | "turnin" | "kill" | "collect" | "search" | "parry" | "visit" | "dungeon" | "check" | "pin" | "quest"
  | "pack" | "character" | "map" | "party" | "settings" | "heart" | "stamina" | "gold" | "xp" | "skills" | "lock" | "cooldown" | "boot" | "shield" | "sword" | "star";

const OUTLINE = "#1d1a17";
const GOLD = "#f2d27a";
const GOLD_D = "#c9953a";
const cache = new Map<string, string>();

function path(g: CanvasRenderingContext2D, fill: string | CanvasGradient, build: () => void, width = 5) {
  g.beginPath();
  build();
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = OUTLINE;
  g.lineWidth = width;
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

function grad(g: CanvasRenderingContext2D, a: string, b: string, y0 = 8, y1 = 56) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  return gr;
}

function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner = 0.45, points = 5) {
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    if (i === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
}

function blade(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  g.lineCap = "round";
  g.strokeStyle = OUTLINE;
  g.lineWidth = 11;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.strokeStyle = "#dfe5ea";
  g.lineWidth = 6;
  g.stroke();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 2;
  g.stroke();
  // Guard and grip near the start.
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const gx = x0 + dx * 0.18;
  const gy = y0 + dy * 0.18;
  g.strokeStyle = OUTLINE;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(gx + nx * 9, gy + ny * 9);
  g.lineTo(gx - nx * 9, gy - ny * 9);
  g.stroke();
  g.strokeStyle = GOLD;
  g.lineWidth = 4.5;
  g.stroke();
  g.strokeStyle = OUTLINE;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(gx, gy);
  g.stroke();
  g.strokeStyle = "#6b4426";
  g.lineWidth = 4.5;
  g.stroke();
}

const DRAW: Record<UiIconName, (g: CanvasRenderingContext2D) => void> = {
  main: (g) => {
    path(g, grad(g, "#fff1b8", GOLD_D), () => star(g, 32, 34, 26, 0.46));
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.ellipse(26, 24, 5, 3, -0.5, 0, Math.PI * 2);
    g.fill();
  },
  star: (g) => path(g, grad(g, "#fff1b8", GOLD_D), () => star(g, 32, 34, 24, 0.5)),
  side: (g) => {
    path(g, grad(g, "#f6ecd2", "#d7c49a"), () => g.roundRect(14, 10, 36, 44, 5));
    path(g, "#c9b48a", () => g.roundRect(10, 8, 44, 9, 4.5), 4);
    path(g, "#c9b48a", () => g.roundRect(10, 48, 44, 9, 4.5), 4);
    g.strokeStyle = "rgba(90,60,30,0.6)";
    g.lineWidth = 2.5;
    for (let y = 24; y <= 40; y += 8) {
      g.beginPath();
      g.moveTo(20, y);
      g.lineTo(44, y);
      g.stroke();
    }
  },
  quest: (g) => DRAW.side(g),
  talk: (g) => {
    path(g, grad(g, "#ffffff", "#d9d2c4"), () => {
      g.roundRect(8, 10, 48, 34, 12);
      g.moveTo(20, 42);
      g.lineTo(16, 56);
      g.lineTo(32, 43);
    });
    g.fillStyle = OUTLINE;
    for (const x of [22, 32, 42]) {
      g.beginPath();
      g.arc(x, 27, 3.4, 0, Math.PI * 2);
      g.fill();
    }
  },
  turnin: (g) => {
    path(g, grad(g, "#d9f7dc", "#8fd39a"), () => {
      g.roundRect(8, 10, 48, 34, 12);
      g.moveTo(20, 42);
      g.lineTo(16, 56);
      g.lineTo(32, 43);
    });
    g.strokeStyle = OUTLINE;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(21, 27);
    g.lineTo(29, 34);
    g.lineTo(43, 19);
    g.stroke();
  },
  kill: (g) => {
    blade(g, 12, 52, 52, 12);
    blade(g, 52, 52, 12, 12);
  },
  sword: (g) => blade(g, 14, 50, 52, 12),
  collect: (g) => {
    path(g, grad(g, "#c9a36a", "#8a6440"), () => {
      g.moveTo(22, 20);
      g.quadraticCurveTo(6, 34, 14, 50);
      g.quadraticCurveTo(32, 60, 50, 50);
      g.quadraticCurveTo(58, 34, 42, 20);
      g.closePath();
    });
    path(g, "#8a6440", () => g.roundRect(20, 12, 24, 10, 4), 4);
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(21, 22);
    g.lineTo(43, 22);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.beginPath();
    g.ellipse(24, 36, 4, 8, 0.3, 0, Math.PI * 2);
    g.fill();
  },
  search: (g) => {
    g.strokeStyle = OUTLINE;
    g.lineWidth = 12;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(38, 38);
    g.lineTo(54, 54);
    g.stroke();
    g.strokeStyle = "#8a6440";
    g.lineWidth = 6;
    g.stroke();
    path(g, "rgba(170,220,255,0.55)", () => g.arc(28, 28, 17, 0, Math.PI * 2), 6);
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(28, 28, 17, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.beginPath();
    g.ellipse(22, 22, 4, 2.5, -0.7, 0, Math.PI * 2);
    g.fill();
  },
  parry: (g) => {
    path(g, grad(g, "#e6ebef", "#8b96a1"), () => {
      g.moveTo(32, 6);
      g.lineTo(54, 14);
      g.lineTo(51, 36);
      g.lineTo(32, 58);
      g.lineTo(13, 36);
      g.lineTo(10, 14);
      g.closePath();
    });
    path(g, GOLD, () => star(g, 32, 30, 12, 0.35, 4), 3);
  },
  shield: (g) => {
    path(g, grad(g, "#6f8fb8", "#2e4a6a"), () => {
      g.moveTo(32, 6);
      g.lineTo(54, 14);
      g.lineTo(51, 36);
      g.lineTo(32, 58);
      g.lineTo(13, 36);
      g.lineTo(10, 14);
      g.closePath();
    });
    g.fillStyle = GOLD;
    g.fillRect(29, 14, 6, 34);
    g.fillRect(18, 24, 28, 6);
  },
  visit: (g) => {
    g.strokeStyle = OUTLINE;
    g.lineWidth = 8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(18, 8);
    g.lineTo(18, 58);
    g.stroke();
    g.strokeStyle = "#8a6440";
    g.lineWidth = 4;
    g.stroke();
    path(g, grad(g, "#e8554a", "#a8322a"), () => {
      g.moveTo(20, 10);
      g.quadraticCurveTo(36, 4, 52, 14);
      g.quadraticCurveTo(40, 22, 52, 32);
      g.quadraticCurveTo(36, 26, 20, 32);
      g.closePath();
    });
  },
  dungeon: (g) => {
    path(g, grad(g, "#a8a292", "#6f6a5e"), () => {
      g.moveTo(8, 58);
      g.lineTo(8, 28);
      g.arc(32, 28, 24, Math.PI, 0);
      g.lineTo(56, 58);
      g.closePath();
    });
    path(g, "#1d1a17", () => {
      g.moveTo(18, 58);
      g.lineTo(18, 30);
      g.arc(32, 30, 14, Math.PI, 0);
      g.lineTo(46, 58);
      g.closePath();
    }, 2);
    g.strokeStyle = "#5f6670";
    g.lineWidth = 3;
    for (const x of [24, 32, 40]) {
      g.beginPath();
      g.moveTo(x, 20);
      g.lineTo(x, 58);
      g.stroke();
    }
  },
  check: (g) => {
    path(g, grad(g, "#b8f0b0", "#4fa84a"), () => g.arc(32, 32, 24, 0, Math.PI * 2));
    g.strokeStyle = "#ffffff";
    g.lineWidth = 7;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(20, 33);
    g.lineTo(29, 42);
    g.lineTo(45, 23);
    g.stroke();
  },
  pin: (g) => {
    path(g, grad(g, "#fff1b8", GOLD_D), () => {
      g.moveTo(32, 60);
      g.bezierCurveTo(10, 36, 12, 8, 32, 8);
      g.bezierCurveTo(52, 8, 54, 36, 32, 60);
      g.closePath();
    });
    path(g, "#fff8e0", () => g.arc(32, 27, 8, 0, Math.PI * 2), 3);
  },
  pack: (g) => {
    path(g, grad(g, "#b07a44", "#6b4426"), () => g.roundRect(10, 16, 44, 42, 10));
    path(g, "#8a5a34", () => g.roundRect(10, 16, 44, 18, [10, 10, 4, 4]), 4);
    path(g, GOLD, () => g.roundRect(28, 28, 8, 10, 2), 3);
    g.strokeStyle = OUTLINE;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(32, 16, 9, Math.PI, 0);
    g.stroke();
  },
  character: (g) => {
    path(g, grad(g, "#8a5590", "#5a3f7a"), () => {
      g.moveTo(12, 58);
      g.quadraticCurveTo(12, 36, 32, 36);
      g.quadraticCurveTo(52, 36, 52, 58);
      g.closePath();
    });
    path(g, grad(g, "#f1d0ae", "#c99a74"), () => g.arc(32, 22, 13, 0, Math.PI * 2));
  },
  map: (g) => {
    path(g, grad(g, "#f6ecd2", "#d7c49a"), () => {
      g.moveTo(8, 14);
      g.lineTo(24, 8);
      g.lineTo(40, 14);
      g.lineTo(56, 8);
      g.lineTo(56, 50);
      g.lineTo(40, 56);
      g.lineTo(24, 50);
      g.lineTo(8, 56);
      g.closePath();
    });
    g.strokeStyle = "rgba(90,60,30,0.45)";
    g.lineWidth = 2;
    for (const x of [24, 40]) {
      g.beginPath();
      g.moveTo(x, 9);
      g.lineTo(x, 55);
      g.stroke();
    }
    g.strokeStyle = "#c4402c";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(40, 26);
    g.lineTo(48, 34);
    g.moveTo(48, 26);
    g.lineTo(40, 34);
    g.stroke();
    g.setLineDash([3, 4]);
    g.strokeStyle = "#6b4426";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(14, 44);
    g.quadraticCurveTo(24, 30, 40, 32);
    g.stroke();
    g.setLineDash([]);
  },
  party: (g) => {
    for (const [cx, col] of [[22, "#3f6a8a"], [42, "#6b3f6f"]] as const) {
      path(g, col, () => {
        g.moveTo(cx - 14, 58);
        g.quadraticCurveTo(cx - 14, 38, cx, 38);
        g.quadraticCurveTo(cx + 14, 38, cx + 14, 58);
        g.closePath();
      });
      path(g, grad(g, "#f1d0ae", "#c99a74"), () => g.arc(cx, 26, 10, 0, Math.PI * 2));
    }
  },
  settings: (g) => {
    path(g, grad(g, "#d6dde4", "#6f7984"), () => star(g, 32, 32, 26, 0.72, 8));
    path(g, "#2b2f35", () => g.arc(32, 32, 9, 0, Math.PI * 2), 4);
  },
  skills: (g) => {
    path(g, grad(g, "#b7d8ff", "#4f7fc0"), () => {
      g.moveTo(34, 4);
      g.lineTo(14, 36);
      g.lineTo(30, 36);
      g.lineTo(24, 60);
      g.lineTo(50, 24);
      g.lineTo(34, 24);
      g.closePath();
    });
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.beginPath();
    g.moveTo(32, 10);
    g.lineTo(22, 30);
    g.lineTo(27, 30);
    g.closePath();
    g.fill();
  },
  heart: (g) => {
    path(g, grad(g, "#ff8a7a", "#b8342c"), () => {
      g.moveTo(32, 56);
      g.bezierCurveTo(4, 36, 8, 10, 24, 10);
      g.bezierCurveTo(30, 10, 32, 16, 32, 18);
      g.bezierCurveTo(32, 16, 34, 10, 40, 10);
      g.bezierCurveTo(56, 10, 60, 36, 32, 56);
      g.closePath();
    });
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.ellipse(21, 22, 5, 3.5, -0.6, 0, Math.PI * 2);
    g.fill();
  },
  stamina: (g) => {
    path(g, grad(g, "#fff1b8", "#e0a030"), () => {
      g.moveTo(36, 4);
      g.lineTo(14, 36);
      g.lineTo(30, 36);
      g.lineTo(26, 60);
      g.lineTo(50, 26);
      g.lineTo(34, 26);
      g.closePath();
    });
  },
  boot: (g) => {
    path(g, grad(g, "#a8743a", "#6b4426"), () => {
      g.moveTo(18, 8);
      g.lineTo(36, 8);
      g.lineTo(36, 36);
      g.lineTo(54, 44);
      g.lineTo(54, 56);
      g.lineTo(14, 56);
      g.closePath();
    });
    g.fillStyle = GOLD;
    g.fillRect(18, 14, 18, 4);
  },
  gold: (g) => {
    for (const [x, y] of [[24, 42], [40, 42], [32, 30]] as const) {
      path(g, grad(g, "#fff1b8", GOLD_D, y - 8, y + 8), () => g.ellipse(x, y, 13, 8, 0, 0, Math.PI * 2), 4);
    }
  },
  xp: (g) => {
    path(g, grad(g, "#e0d4ff", "#8a6ae0"), () => star(g, 32, 32, 26, 0.5, 4));
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.beginPath();
    g.arc(32, 32, 5, 0, Math.PI * 2);
    g.fill();
  },
  lock: (g) => {
    g.strokeStyle = OUTLINE;
    g.lineWidth = 11;
    g.beginPath();
    g.arc(32, 26, 12, Math.PI, 0);
    g.stroke();
    g.strokeStyle = "#9aa3ad";
    g.lineWidth = 5;
    g.stroke();
    path(g, grad(g, "#f2d27a", "#b8863b"), () => g.roundRect(14, 26, 36, 30, 6));
    g.fillStyle = OUTLINE;
    g.beginPath();
    g.arc(32, 38, 4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(30, 40, 4, 9);
  },
  cooldown: (g) => {
    path(g, grad(g, "#e6ebef", "#8b96a1"), () => g.arc(32, 34, 24, 0, Math.PI * 2));
    g.strokeStyle = OUTLINE;
    g.lineWidth = 5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(32, 34);
    g.lineTo(32, 18);
    g.moveTo(32, 34);
    g.lineTo(43, 40);
    g.stroke();
  },
};

/** A UI icon as a data URL, rendered at `px` CSS pixels (and 2× for sharpness). */
export function uiIcon(name: UiIconName, px = 20): string {
  const key = `${name}:${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  c.width = c.height = Math.round(px * scale);
  const g = c.getContext("2d")!;
  g.scale(c.width / 64, c.height / 64);
  DRAW[name](g);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** `<img>` markup for an icon. */
export function iconImg(name: UiIconName, px = 20, cls = "uicon") {
  return `<img class="${cls}" src="${uiIcon(name, px)}" width="${px}" height="${px}" alt="">`;
}

/** Draw an icon into a 64×64 design space (for item icons that share UI art). */
export function drawUiIcon(g: CanvasRenderingContext2D, name: UiIconName) {
  DRAW[name](g);
}
