import * as Phaser from "phaser";
import { Tile, TILE, type WorldMap } from "@floors/shared";
import type { CharLook } from "../art/characters.ts";
import { sfx } from "../audio/sfx.ts";
import { blendPose, HumanoidRig, locomotionPose, restPose, type Pose } from "./rig.ts";

/**
 * Ambient life that has no gameplay: townsfolk on their errands, pigeons, chimney smoke,
 * butterflies and falling leaves. Townsfolk follow a timetable driven by server time, so
 * every player sees the same person at the same stall.
 */

function hash(n: number) {
  const h = Math.imul(n ^ (n >>> 15), 2246822519) ^ Math.imul(n + 1, 3266489917);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

interface Leg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Time spent walking this leg, then standing at its end. */
  walk: number;
  pause: number;
}

class Townsfolk {
  readonly rig: HumanoidRig;
  private legs: Leg[] = [];
  private period = 0;
  private pose: Pose = restPose(Math.PI / 2);
  private scratch: Pose = restPose(Math.PI / 2);
  private target: Pose = restPose(Math.PI / 2);
  private step = 0;
  private offset: number;

  constructor(scene: Phaser.Scene, route: [number, number][], seed: number) {
    const skins = ["#f1d0ae", "#d9a77c", "#a8744f", "#7a5236", "#e0b890"];
    const hairs = ["#3b2a20", "#6b4226", "#b8863b", "#2b2b30", "#8a3b2a", "#d9d2c4"];
    const cloths = ["#7a4a32", "#4a6a3a", "#3f5a7a", "#8a6a3a", "#6b3f5a", "#5a5a62", "#a0643a"];
    const helms = ["none", "none", "cap", "hood", "none"] as const;
    const pick = <T,>(a: readonly T[], k: number) => a[Math.floor(hash(seed * 31 + k) * a.length)];
    const look: CharLook = {
      key: `folk:${seed}`,
      skin: pick(skins, 1),
      hair: pick(hairs, 2),
      cloth: pick(cloths, 3),
      trim: pick(["#6b4a2b", "#c9a24a", "#3e2a1a", "#e8d8b0"], 4),
      helm: pick(helms, 5),
      bulk: 0.95 + hash(seed * 31 + 6) * 0.1,
    };
    this.rig = new HumanoidRig(scene, look, "none", 0, 0.94);
    const speed = 34 + hash(seed * 31 + 7) * 10;
    for (let i = 0; i < route.length; i++) {
      const [ax, ay] = route[i];
      const [bx, by] = route[(i + 1) % route.length];
      const x0 = (ax + 0.5) * TILE;
      const y0 = (ay + 0.5) * TILE;
      const x1 = (bx + 0.5) * TILE;
      const y1 = (by + 0.5) * TILE;
      const walk = (Math.hypot(x1 - x0, y1 - y0) / speed) * 1000;
      const pause = 1200 + hash(seed * 31 + 10 + i) * 4500;
      this.legs.push({ x0, y0, x1, y1, walk, pause });
      this.period += walk + pause;
    }
    this.offset = hash(seed * 31 + 9) * this.period;
  }

  update(now: number, dtMs: number, view: Phaser.Geom.Rectangle) {
    let t = (now + this.offset) % this.period;
    let x = this.legs[0].x0;
    let y = this.legs[0].y0;
    let face = Math.PI / 2;
    let walking = false;
    for (const l of this.legs) {
      face = Math.atan2(l.y1 - l.y0, l.x1 - l.x0);
      if (t < l.walk) {
        const k = t / l.walk;
        x = l.x0 + (l.x1 - l.x0) * k;
        y = l.y0 + (l.y1 - l.y0) * k;
        walking = true;
        break;
      }
      t -= l.walk;
      if (t < l.pause) {
        x = l.x1;
        y = l.y1;
        break;
      }
      t -= l.pause;
    }
    const visible = x > view.x - 60 && x < view.right + 60 && y > view.y - 60 && y < view.bottom + 90;
    this.rig.root.setVisible(visible);
    if (!visible) return;
    if (walking) {
      this.step += dtMs;
      locomotionPose(face, 1, this.step, this.target);
    } else Object.assign(this.target, restPose(face));
    blendPose(this.pose, this.target, Math.min(1, dtMs / 90), this.scratch);
    Object.assign(this.pose, this.scratch);
    this.rig.apply(this.pose);
    this.rig.root.setPosition(x, y).setDepth(y);
  }

  destroy() {
    this.rig.destroy();
  }
}

interface Bird {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hop: number;
  flying: boolean;
  alpha: number;
  face: number;
}

interface Flock {
  hx: number;
  hy: number;
  birds: Bird[];
  /** When the flock comes back after being scattered. */
  back: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  kind: "smoke" | "leaf";
  spin: number;
  color: number;
}

interface Butterfly {
  hx: number;
  hy: number;
  phase: number;
  color: number;
  x: number;
  y: number;
}

export class Ambient {
  private folk: Townsfolk[] = [];
  private flocks: Flock[] = [];
  private g: Phaser.GameObjects.Graphics;
  private sky: Phaser.GameObjects.Graphics;
  private motes: Mote[] = [];
  private butterflies: Butterfly[] = [];
  private chimneys: { x: number; y: number; next: number }[] = [];
  private scanAt = 0;
  private t = 0;

  constructor(private scene: Phaser.Scene, private map: WorldMap) {
    this.g = scene.add.graphics();
    this.sky = scene.add.graphics().setDepth(1e5);
    if (map.name.startsWith("Floor 1")) {
      const routes: [number, number][][] = [
        [[34, 73], [47, 73], [47, 82], [34, 82]],
        [[32, 69], [45, 69], [45, 72], [32, 72]],
        [[31, 90], [42, 90], [42, 92], [32, 92]],
        [[31, 77], [35, 77], [34, 81], [31, 81]],
        [[54, 75], [56, 75], [56, 81], [53, 81]],
        [[47, 73], [34, 73], [34, 82], [47, 82]],
      ];
      routes.forEach((r, i) => this.folk.push(new Townsfolk(scene, r, i + 1)));
      for (const [tx, ty] of [[41, 74], [35, 90], [46, 79]]) this.flocks.push(this.makeFlock((tx + 0.5) * TILE, (ty + 0.5) * TILE));
    }
    for (const b of map.buildings) {
      this.chimneys.push({ x: (b.tx + b.tw) * TILE - 26.5, y: (b.ty + b.th) * TILE - (b.th * TILE + 28) + 2, next: Math.random() * 600 });
    }
  }

  private makeFlock(hx: number, hy: number): Flock {
    const birds: Bird[] = [];
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) birds.push({ x: hx + (Math.random() - 0.5) * 30, y: hy + (Math.random() - 0.5) * 18, vx: 0, vy: 0, hop: Math.random() * 3000, flying: false, alpha: 1, face: Math.random() < 0.5 ? -1 : 1 });
    return { hx, hy, birds, back: 0 };
  }

  /** `now` is shared server time; `people` are everyone who can startle the pigeons. */
  update(dtMs: number, now: number, cam: Phaser.Cameras.Scene2D.Camera, people: { x: number; y: number }[], zoneId?: string) {
    const dt = dtMs / 1000;
    this.t += dtMs;
    const view = cam.worldView;
    for (const f of this.folk) f.update(now, dtMs, view);
    const g = this.g;
    g.clear();
    this.sky.clear();

    // Pigeons: peck and shuffle; scatter when someone comes close; drift back later.
    for (const fl of this.flocks) {
      if (Math.abs(fl.hx - view.centerX) > view.width && Math.abs(fl.hy - view.centerY) > view.height) continue;
      const near = people.some((p) => Math.hypot(p.x - fl.hx, p.y - fl.hy) < 56);
      if (near && fl.birds.some((b) => !b.flying)) {
        sfx.flutter(fl.hx, fl.hy);
        for (const b of fl.birds) {
          if (b.flying) continue;
          b.flying = true;
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
          b.vx = Math.cos(a) * (70 + Math.random() * 50);
          b.vy = Math.sin(a) * (70 + Math.random() * 40) - 30;
          b.face = b.vx >= 0 ? 1 : -1;
        }
        fl.back = this.t + 14000 + Math.random() * 8000;
      }
      if (fl.back && this.t > fl.back && !near) {
        Object.assign(fl, this.makeFlock(fl.hx, fl.hy), { back: 0 });
        for (const b of fl.birds) b.alpha = 0;
      }
      for (const b of fl.birds) {
        if (b.flying) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vy -= 20 * dt;
          b.alpha = Math.max(0, b.alpha - dt * 0.5);
        } else {
          b.alpha = Math.min(1, b.alpha + dt * 1.5);
          b.hop -= dtMs;
          if (b.hop < 0) {
            b.hop = 800 + Math.random() * 2600;
            b.x += (Math.random() - 0.5) * 8;
            b.y += (Math.random() - 0.5) * 5;
            b.face = Math.random() < 0.5 ? -1 : 1;
          }
        }
        if (b.alpha <= 0.01) continue;
        this.drawBird(b.flying ? this.sky : g, b);
      }
    }

    // Chimney smoke.
    for (const c of this.chimneys) {
      if (c.x < view.x - 80 || c.x > view.right + 80 || c.y < view.y - 200 || c.y > view.bottom + 100) continue;
      c.next -= dtMs;
      if (c.next <= 0) {
        c.next = 380 + Math.random() * 380;
        this.motes.push({ x: c.x + (Math.random() - 0.5) * 3, y: c.y, vx: 4 + Math.random() * 5, vy: -14 - Math.random() * 6, life: 3200, max: 3200, r: 2.5, kind: "smoke", spin: 0, color: 0xd8d4cc });
      }
    }

    // Falling leaves under the forest canopy.
    if (zoneId === "whisperwood" && this.motes.filter((m) => m.kind === "leaf").length < 14 && Math.random() < dt * 3) {
      const colors = [0x6fae52, 0x8cc04a, 0xc9a24a, 0xa8743a];
      this.motes.push({
        x: view.x + Math.random() * view.width, y: view.y - 10, vx: 8 + Math.random() * 10, vy: 16 + Math.random() * 12,
        life: 6000, max: 6000, r: 2.2, kind: "leaf", spin: Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.life -= dtMs;
      if (m.life <= 0) {
        this.motes.splice(i, 1);
        continue;
      }
      const k = m.life / m.max;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.kind === "smoke") {
        m.r += dt * 3.2;
        this.sky.fillStyle(m.color, 0.32 * k * Math.min(1, (1 - k) * 8));
        this.sky.fillCircle(m.x, m.y, m.r);
      } else {
        m.spin += dt * 3;
        m.x += Math.sin(m.spin) * 12 * dt;
        this.sky.fillStyle(m.color, Math.min(1, k * 3) * 0.9);
        this.sky.fillEllipse(m.x, m.y, m.r * 2 * Math.abs(Math.cos(m.spin)) + 1, m.r * 1.3);
      }
    }

    // Butterflies over flowers in view.
    if (this.t > this.scanAt) {
      this.scanAt = this.t + 2500;
      const homes: { x: number; y: number }[] = [];
      const tx0 = Math.max(0, Math.floor(view.x / TILE));
      const ty0 = Math.max(0, Math.floor(view.y / TILE));
      for (let ty = ty0; ty < Math.min(this.map.height, ty0 + Math.ceil(view.height / TILE) + 1); ty++) {
        for (let tx = tx0; tx < Math.min(this.map.width, tx0 + Math.ceil(view.width / TILE) + 1); tx++) {
          if (this.map.get(tx, ty) === Tile.Flowers) homes.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
        }
      }
      this.butterflies = this.butterflies.filter((b) => homes.some((h) => h.x === b.hx && h.y === b.hy));
      const colors = [0xffffff, 0xf6d860, 0xff9a6b, 0x9fd3ff, 0xf59bb7];
      while (this.butterflies.length < Math.min(6, Math.ceil(homes.length / 4))) {
        const h = homes[Math.floor(Math.random() * homes.length)];
        this.butterflies.push({ hx: h.x, hy: h.y, phase: Math.random() * 100, color: colors[Math.floor(Math.random() * colors.length)], x: h.x, y: h.y });
      }
    }
    for (const b of this.butterflies) {
      b.phase += dt;
      b.x = b.hx + Math.sin(b.phase * 0.7) * 22 + Math.sin(b.phase * 1.9) * 6;
      b.y = b.hy + Math.cos(b.phase * 0.9) * 12 - 10 + Math.sin(b.phase * 2.3) * 4;
      const flap = Math.abs(Math.sin(b.phase * 18));
      this.sky.fillStyle(0x1d1a17, 0.6);
      this.sky.fillEllipse(b.x, b.y + 12, 3, 1.2);
      this.sky.fillStyle(b.color, 0.95);
      this.sky.fillEllipse(b.x - 1.6 * flap - 0.4, b.y, 2.6 * flap + 0.6, 2.4);
      this.sky.fillEllipse(b.x + 1.6 * flap + 0.4, b.y, 2.6 * flap + 0.6, 2.4);
    }
  }

  private drawBird(g: Phaser.GameObjects.Graphics, b: Bird) {
    const a = b.alpha;
    const s = b.face;
    g.fillStyle(0x000000, 0.18 * a);
    if (!b.flying) g.fillEllipse(b.x, b.y + 2, 7, 2.4);
    if (b.flying) {
      const w = Math.sin(this.t / 45 + b.x) * 3.5;
      g.fillStyle(0x7d808a, a);
      g.fillTriangle(b.x - 1, b.y, b.x - 6, b.y - w, b.x + 1, b.y - 1);
      g.fillTriangle(b.x + 1, b.y, b.x + 6, b.y - w, b.x - 1, b.y - 1);
    }
    const bob = b.flying ? 0 : Math.max(0, Math.sin(this.t / 180 + b.x)) * 1.2;
    g.fillStyle(0x1d1a17, a);
    g.fillEllipse(b.x, b.y - 2, 8, 5.5);
    g.fillStyle(0x9a9ea8, a);
    g.fillEllipse(b.x, b.y - 2, 6.5, 4);
    g.fillStyle(0x1d1a17, a);
    g.fillCircle(b.x + s * 3.4, b.y - 4.2 + bob, 2.3);
    g.fillStyle(0x6f7280, a);
    g.fillCircle(b.x + s * 3.4, b.y - 4.2 + bob, 1.6);
    g.fillStyle(0x5aa08a, a);
    g.fillCircle(b.x + s * 2.4, b.y - 2.8 + bob * 0.5, 1);
    g.fillStyle(0xe0a040, a);
    g.fillCircle(b.x + s * 5.2, b.y - 4 + bob, 0.7);
    g.setDepth(b.flying ? 1e5 : b.y);
  }

  destroy() {
    for (const f of this.folk) f.destroy();
    this.g.destroy();
    this.sky.destroy();
  }
}
