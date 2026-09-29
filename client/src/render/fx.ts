import * as Phaser from "phaser";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
  kind: "spark" | "dot" | "ring" | "streak" | "star" | "dust" | "crack";
  r0?: number;
  r1?: number;
  a?: number;
  drag?: number;
  gravity?: number;
}

interface TrailSeg {
  x: number;
  y: number;
  a0: number;
  a1: number;
  rIn: number;
  rOut: number;
  life: number;
  max: number;
  color: number;
}

interface Floater {
  text: Phaser.GameObjects.Text;
  vy: number;
  life: number;
  max: number;
  /** Damage numbers arc: they fly out sideways and fall under gravity. */
  vx?: number;
  gravity?: number;
}

/**
 * Lightweight effect layer: particles, weapon trails, rings and floating combat
 * text, all drawn into two Graphics objects each frame.
 */
export class Fx {
  private under: Phaser.GameObjects.Graphics;
  /** Weapon trails: normal blending so they read on bright ground instead of washing out. */
  private trailG: Phaser.GameObjects.Graphics;
  private over: Phaser.GameObjects.Graphics;
  /** Dust sits on the ground, under characters, with normal blending. */
  private dustG: Phaser.GameObjects.Graphics;
  private dusts: Particle[] = [];
  private parts: Particle[] = [];
  private trails: TrailSeg[] = [];
  private floaters: Floater[] = [];
  private pool: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene) {
    this.under = scene.add.graphics().setDepth(-4);
    this.over = scene.add.graphics().setDepth(1e6).setBlendMode(Phaser.BlendModes.ADD);
    this.trailG = scene.add.graphics().setDepth(1e6 - 3);
    this.dustG = scene.add.graphics().setDepth(-3);
  }

  /** Motes that float upward (healing light, embers, magic gathering). */
  rise(x: number, y: number, color: number, count = 10, spread = 16, speed = 40, life = 900, size = 2) {
    for (let i = 0; i < count; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread * 0.6, vx: (Math.random() - 0.5) * 12, vy: -speed * (0.5 + Math.random()),
        life: life * (0.6 + Math.random() * 0.5), max: life, color, size: size * (0.6 + Math.random() * 0.7), kind: "dot", drag: 0.985, gravity: -8,
      });
    }
  }

  /** A crack or scorch mark on the ground that fades (normal blend, under characters). */
  crack(x0: number, y0: number, x1: number, y1: number, color = 0x3a2c1c, ms = 1600, width = 3) {
    this.dusts.push({ x: x0, y: y0, vx: x1, vy: y1, life: ms, max: ms, color, size: width, kind: "crack" });
  }

  /** A jagged lightning bolt between two points. */
  bolt(x0: number, y0: number, x1: number, y1: number, color: number, ms = 160, width = 5, jag = 12) {
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 22));
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const len = Math.hypot(nx, ny) || 1;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const off = i === n ? 0 : (Math.random() - 0.5) * jag * 2;
      const qx = x0 + (x1 - x0) * t + (nx / len) * off;
      const qy = y0 + (y1 - y0) * t + (ny / len) * off;
      this.streak(px, py, qx, qy, color, ms, width);
      this.streak(px, py, qx, qy, 0xffffff, ms * 0.7, width * 0.4);
      px = qx;
      py = qy;
    }
  }

  /** Soft dust kicked up at the feet (dodges, sprint steps, landings). `dir` pushes it one way. */
  dust(x: number, y: number, count = 5, dir?: number, color = 0xcdbb9a) {
    for (let i = 0; i < count; i++) {
      const a = dir === undefined ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * 1.6;
      const sp = 14 + Math.random() * 34;
      this.dusts.push({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 6,
        life: 380 + Math.random() * 260, max: 640, color, size: 2.2 + Math.random() * 2.2, kind: "dust", drag: 0.9,
      });
    }
  }

  /** Weapon trail wedge between two blade angles around (x, y). */
  trail(x: number, y: number, a0: number, a1: number, rIn: number, rOut: number, color = 0xffffff, ms = 150) {
    if (Math.abs(a1 - a0) < 0.01) return;
    this.trails.push({ x, y, a0, a1, rIn, rOut, life: ms, max: ms, color });
  }

  sparks(x: number, y: number, angle: number, color: number, count = 10, speed = 260, spread = 1.4) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 220 + Math.random() * 140, max: 360, color, size: 1.4 + Math.random(), kind: "spark", drag: 0.9 });
    }
  }

  burst(x: number, y: number, color: number, count = 14, speed = 120, size = 2.4, life = 500) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - 20, life: life * (0.6 + Math.random() * 0.5), max: life, color, size: size * (0.6 + Math.random() * 0.6), kind: "dot", drag: 0.92, gravity: 60 });
    }
  }

  ring(x: number, y: number, color: number, r0: number, r1: number, ms = 300, width = 3) {
    this.parts.push({ x, y, vx: 0, vy: 0, life: ms, max: ms, color, size: width, kind: "ring", r0, r1 });
  }

  star(x: number, y: number, color: number, size = 9, ms = 260) {
    this.parts.push({ x, y, vx: 0, vy: 0, life: ms, max: ms, color, size, kind: "star", a: Math.random() * 0.5 });
  }

  streak(x0: number, y0: number, x1: number, y1: number, color: number, ms = 180, width = 6) {
    this.parts.push({ x: x0, y: y0, vx: x1, vy: y1, life: ms, max: ms, color, size: width, kind: "streak" });
  }

  text(x: number, y: number, msg: string, style: { color: string; size: number; stroke?: string; bold?: boolean }, ms = 800, rise = 36) {
    let t = this.pool.pop();
    if (!t) {
      t = this.scene.add.text(0, 0, "", { fontFamily: "Trebuchet MS, sans-serif" }).setOrigin(0.5, 1);
    }
    t.setText(msg)
      .setStyle({ fontFamily: "Trebuchet MS, sans-serif", fontSize: `${style.size * 2}px`, color: style.color, fontStyle: style.bold ? "bold" : "normal", stroke: style.stroke ?? "#1d1a17", strokeThickness: 5 })
      .setScale(0.5)
      .setPosition(x + (Math.random() - 0.5) * 8, y)
      .setAlpha(1)
      .setDepth(1e6 + 1)
      .setVisible(true);
    this.floaters.push({ text: t, vy: -rise, life: ms, max: ms });
  }

  /**
   * A damage number that pops out of the hit and arcs away from the blow (`dir`), so
   * numbers from a fast combo fan out instead of piling up.
   */
  number(x: number, y: number, msg: string, style: { color: string; size: number; bold?: boolean }, dir: number, ms = 800) {
    this.text(x, y, msg, style, ms, 0);
    const f = this.floaters[this.floaters.length - 1];
    const side = Math.cos(dir) >= 0 ? 1 : -1;
    f.vx = side * (30 + Math.random() * 28);
    f.vy = -(58 + Math.random() * 22);
    f.gravity = 190;
    f.text.x = x + side * 4;
  }

  update(dtMs: number) {
    const dt = dtMs / 1000;
    const g = this.over;
    const dg = this.dustG;
    dg.clear();
    for (let i = this.dusts.length - 1; i >= 0; i--) {
      const p = this.dusts[i];
      p.life -= dtMs;
      if (p.life <= 0) {
        this.dusts.splice(i, 1);
        continue;
      }
      const k = p.life / p.max;
      if (p.kind === "crack") {
        dg.lineStyle(p.size, p.color, 0.7 * Math.min(1, k * 2));
        dg.lineBetween(p.x, p.y, p.vx, p.vy);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.05, dt);
      p.vy *= Math.pow(0.05, dt);
      dg.fillStyle(p.color, 0.34 * Math.min(1, k * 1.6));
      dg.fillCircle(p.x, p.y, p.size * (1.6 - k * 0.8));
    }
    this.trailG.clear();
    // The ground layer (telegraphs, hazards) is owned by the scene, which clears and redraws it each frame.
    g.clear();

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const s = this.trails[i];
      s.life -= dtMs;
      if (s.life <= 0) {
        this.trails.splice(i, 1);
        continue;
      }
      const k = s.life / s.max;
      const tg = this.trailG;
      tg.fillStyle(s.color, 0.32 * k);
      tg.beginPath();
      const steps = Math.max(2, Math.ceil(Math.abs(s.a1 - s.a0) / 0.15));
      for (let j = 0; j <= steps; j++) {
        const a = s.a0 + ((s.a1 - s.a0) * j) / steps;
        const px = s.x + Math.cos(a) * s.rOut;
        const py = s.y + Math.sin(a) * s.rOut * 0.8;
        if (j === 0) tg.moveTo(px, py);
        else tg.lineTo(px, py);
      }
      for (let j = steps; j >= 0; j--) {
        const a = s.a0 + ((s.a1 - s.a0) * j) / steps;
        tg.lineTo(s.x + Math.cos(a) * s.rIn, s.y + Math.sin(a) * s.rIn * 0.8);
      }
      tg.closePath();
      tg.fillPath();
      // A bright leading edge along the blade's path.
      tg.lineStyle(1.6, 0xffffff, 0.75 * k);
      tg.beginPath();
      for (let j = 0; j <= steps; j++) {
        const a = s.a0 + ((s.a1 - s.a0) * j) / steps;
        const px = s.x + Math.cos(a) * s.rOut;
        const py = s.y + Math.sin(a) * s.rOut * 0.8;
        if (j === 0) tg.moveTo(px, py);
        else tg.lineTo(px, py);
      }
      tg.strokePath();
    }

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dtMs;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      const k = p.life / p.max;
      switch (p.kind) {
        case "spark": {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= p.drag!;
          p.vy *= p.drag!;
          g.lineStyle(p.size, p.color, k);
          g.lineBetween(p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          break;
        }
        case "dot": {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= p.drag!;
          p.vy = p.vy * p.drag! + (p.gravity ?? 0) * dt;
          g.fillStyle(p.color, k);
          g.fillCircle(p.x, p.y, p.size * (0.5 + k * 0.5));
          break;
        }
        case "ring": {
          const r = p.r0! + (p.r1! - p.r0!) * Phaser.Math.Easing.Cubic.Out(1 - k);
          g.lineStyle(p.size * k + 0.5, p.color, k);
          g.strokeEllipse(p.x, p.y, r * 2, r * 1.6);
          break;
        }
        case "star": {
          const s = p.size * (0.4 + (1 - Math.abs(k - 0.5) * 2) * 0.8);
          g.fillStyle(p.color, Math.min(1, k * 2));
          const a = p.a! + (1 - k) * 0.8;
          g.beginPath();
          for (let j = 0; j < 8; j++) {
            const rr = j % 2 ? s * 0.22 : s;
            const aa = a + (j * Math.PI) / 4;
            if (j === 0) g.moveTo(p.x + Math.cos(aa) * rr, p.y + Math.sin(aa) * rr);
            else g.lineTo(p.x + Math.cos(aa) * rr, p.y + Math.sin(aa) * rr);
          }
          g.closePath();
          g.fillPath();
          g.fillStyle(0xffffff, Math.min(1, k * 2));
          g.fillCircle(p.x, p.y, s * 0.18);
          break;
        }
        case "streak": {
          g.lineStyle(p.size * k, p.color, 0.5 * k);
          g.lineBetween(p.x, p.y, p.vx, p.vy);
          break;
        }
      }
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dtMs;
      if (f.life <= 0) {
        f.text.setVisible(false);
        if (this.pool.length < 60) this.pool.push(f.text);
        else f.text.destroy();
        this.floaters.splice(i, 1);
        continue;
      }
      const k = f.life / f.max;
      if (f.gravity !== undefined) {
        f.text.x += (f.vx ?? 0) * dt;
        f.text.y += f.vy * dt;
        f.vy += f.gravity * dt;
      } else f.text.y += f.vy * dt * k;
      f.text.setAlpha(Math.min(1, k * 2.5));
      const pop = 1 - k < 0.12 ? 1 + (0.12 - (1 - k)) * 3 : 1;
      f.text.setScale(0.5 * pop);
    }
  }

  /** Ground-level layer (telegraphs, hazards) redrawn by the scene each frame. */
  get ground() {
    return this.under;
  }
}
