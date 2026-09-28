import type * as Phaser from "phaser";
import type { MoveDef } from "@floors/shared";
import { sfx } from "../audio/sfx.ts";
import type { Fx } from "./fx.ts";

/**
 * Skill visuals: particles gather while a skill winds up, the skill's signature effect
 * plays the moment it fires, and some skills leave a trail while they are active.
 */
export class SkillFx {
  constructor(private fx: Fx, private scene: Phaser.Scene) {}

  /** While winding up: motes drawn in toward the caster. */
  charge(m: MoveDef, x: number, y: number, k: number) {
    if (!m.vfx || Math.random() > 0.55) return;
    const c = m.color ?? 0xffffff;
    const a = Math.random() * Math.PI * 2;
    const r = 26 - k * 14;
    this.fx.rise(x + Math.cos(a) * r, y - 16 + Math.sin(a) * r * 0.6, c, 1, 2, 20, 260, 1.6);
  }

  /** The moment a skill fires. `mine` adds camera weight for your own skills. */
  fire(m: MoveDef, x: number, y: number, a: number, mine: boolean, shake: (ms: number, amt: number) => void) {
    const fx = this.fx;
    const c = m.color ?? 0xffffff;
    const cy = y - 14;
    const ahead = (d: number) => ({ x: x + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8 });
    const shapeLen = m.shape?.kind === "line" ? m.shape.length : m.shape?.kind === "circle" ? m.shape.radius : 60;
    switch (m.vfx) {
      case "whirl":
      case "dance":
      case "cyclone": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 56;
        fx.trail(x, cy, a, a + Math.PI * 2 * (m.vfx === "cyclone" ? 1.5 : 1), r * 0.35, r, c, 320);
        fx.ring(x, y - 6, c, 10, r, 340, 4);
        fx.sparks(x, cy, a, c, 14, 260, Math.PI * 2);
        if (m.vfx === "cyclone") fx.dust(x, y, 12);
        break;
      }
      case "stance":
        fx.ring(x, cy, c, 26, 34, 700, 4);
        fx.star(x, cy - 16, 0xffffff, 12, 400);
        sfx.parry(false, x, y);
        break;
      case "dash":
      case "assassin":
      case "shadow": {
        fx.dust(x, y, 8, a + Math.PI);
        const len = m.lunge || 120;
        const e = ahead(len);
        fx.streak(x, cy, e.x, e.y, c, 260, 12);
        fx.streak(x, cy, e.x, e.y, 0xffffff, 160, 4);
        if (m.vfx !== "dash") {
          fx.burst(x, cy, c, 16, 70, 3, 600);
          fx.burst(e.x, e.y, c, 16, 70, 3, 600);
        }
        break;
      }
      case "wave":
      case "fan":
      case "barrage":
      case "javelin":
        fx.burst(ahead(16).x, ahead(16).y, c, 10, 90, 2.2, 360);
        fx.ring(ahead(12).x, ahead(12).y, c, 4, 18, 200, 2);
        break;
      case "rally":
      case "mend": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 110;
        fx.ring(x, y - 4, c, 12, r, 700, 4);
        fx.rise(x, y - 4, c, 34, 18, 70, 1200, 2.4);
        fx.rise(x, y - 4, 0xffffff, 10, 10, 90, 900, 1.6);
        fx.star(x, y - 46, c, 16, 600);
        sfx.chime(2);
        break;
      }
      case "judgement":
      case "skewer": {
        const e = ahead(shapeLen);
        fx.streak(x, cy, e.x, e.y, c, 240, m.vfx === "judgement" ? 16 : 10);
        fx.streak(x, cy, e.x, e.y, 0xffffff, 150, 5);
        fx.sparks(e.x, e.y, a, c, 16, 280);
        fx.star(e.x, e.y, 0xffffff, 16, 300);
        if (mine) shake(120, 0.004);
        break;
      }
      case "slam":
      case "titan": {
        const off = m.shape?.kind === "circle" ? m.shape.offset : 0;
        const r = m.shape?.kind === "circle" ? m.shape.radius : 62;
        const p = { x: x + Math.cos(a) * off, y: y + Math.sin(a) * off * 0.8 };
        fx.ring(p.x, p.y, c, 10, r, 460, 6);
        fx.ring(p.x, p.y, 0xffffff, 6, r * 0.6, 300, 3);
        fx.dust(p.x, p.y, m.vfx === "titan" ? 26 : 16);
        fx.sparks(p.x, p.y - 8, -Math.PI / 2, c, 18, 320, Math.PI * 2);
        for (let i = 0; i < (m.vfx === "titan" ? 7 : 4); i++) {
          const ca = (i / (m.vfx === "titan" ? 7 : 4)) * Math.PI * 2 + Math.random();
          fx.crack(p.x, p.y, p.x + Math.cos(ca) * r * 0.9, p.y + Math.sin(ca) * r * 0.5, 0x3a2c1c, 1800, 3);
        }
        sfx.boom(m.vfx === "titan", p.x, p.y);
        if (mine) shake(m.vfx === "titan" ? 320 : 220, m.vfx === "titan" ? 0.01 : 0.007);
        break;
      }
      case "warcry":
        fx.ring(x, cy, c, 10, 70, 380, 5);
        fx.ring(x, cy, 0xffffff, 10, 96, 520, 3);
        if (mine) shake(160, 0.005);
        break;
      case "fissure": {
        let px = x;
        let py = y;
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          const qx = x + Math.cos(a) * shapeLen * t + (Math.random() - 0.5) * 10;
          const qy = y + Math.sin(a) * shapeLen * t * 0.8 + (Math.random() - 0.5) * 6;
          fx.crack(px, py, qx, qy, 0x2e2216, 2200, 4);
          fx.dust(qx, qy, 3);
          px = qx;
          py = qy;
        }
        fx.sparks(px, py - 6, a, c, 12, 240);
        sfx.boom(false, x, y);
        if (mine) shake(200, 0.006);
        break;
      }
      case "venom":
        fx.sparks(ahead(26).x, ahead(26).y, a, c, 14, 220);
        fx.burst(ahead(24).x, ahead(24).y, 0x5fae3a, 8, 60, 2.4, 500);
        sfx.shoot("shadow", x, y);
        break;
      case "evis":
        fx.streak(x, cy, ahead(70).x, ahead(70).y, c, 200, 9);
        fx.sparks(ahead(60).x, ahead(60).y, a, c, 12, 260);
        break;
      case "sweep":
        fx.trail(x, cy, a - 2.6, a + 2.6, 16, 76, c, 280);
        fx.dust(x, y, 10);
        break;
      case "charge":
      case "dragon":
        fx.dust(x, y, 10, a + Math.PI);
        fx.ring(x, cy, c, 6, 28, 220, 3);
        break;
      case "vault":
        fx.dust(x, y, 10);
        break;
      case "lightning": {
        const e = ahead(shapeLen);
        // Two bolts: a wide saturated one that reads on bright ground, a white core.
        fx.bolt(x + Math.cos(a) * 10, cy, e.x, e.y, 0x4f8fff, 240, 9, 14);
        fx.bolt(x + Math.cos(a) * 10, cy, e.x, e.y, c, 200, 5, 14);
        fx.bolt(x + Math.cos(a) * 10, cy, e.x, e.y, 0xeaf6ff, 140, 3, 20);
        fx.sparks(e.x, e.y, a, 0xeaf6ff, 14, 300, Math.PI * 2);
        fx.ring(x, cy, c, 6, 30, 200, 3);
        sfx.hit(true, x, y, true, "metal");
        if (mine) shake(90, 0.003);
        break;
      }
      case "frost":
      case "blizzard":
      case "meteor":
      case "ironskin":
        // Played from the server's event, where the effect actually lands.
        break;
      default:
        fx.ring(x, cy, c, 8, 40, 300, 3);
    }
  }

  /** Every frame while a skill is active: trails for charges and dashes. */
  during(m: MoveDef, x: number, y: number, a: number) {
    const c = m.color ?? 0xffffff;
    switch (m.vfx) {
      case "charge":
        if (Math.random() < 0.6) this.fx.dust(x, y, 2, a + Math.PI);
        break;
      case "dragon":
        this.fx.rise(x - Math.cos(a) * 10, y - 12, Math.random() < 0.5 ? c : 0xffd08a, 2, 8, 30, 500, 2.4);
        this.fx.crack(x, y, x - Math.cos(a) * 14, y - Math.sin(a) * 10, 0x3a1e10, 900, 5);
        break;
      case "dash":
      case "assassin":
      case "shadow":
        if (Math.random() < 0.7) this.fx.rise(x, y - 14, c, 1, 8, 6, 300, 3);
        break;
    }
  }

  /** Server events for effects that land somewhere else than the caster. */
  event(k: string, x: number, y: number, r: number) {
    const fx = this.fx;
    switch (k) {
      case "blizzard":
        fx.ring(x, y - 6, 0xdff4ff, 12, r, 600, 6);
        fx.ring(x, y - 6, 0x9fe0ff, 8, r * 0.7, 420, 3);
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * r;
          fx.star(x + Math.cos(a) * d, y - 30 - Math.random() * 40 + Math.sin(a) * d * 0.6, 0xffffff, 4 + Math.random() * 3, 500 + Math.random() * 500);
        }
        fx.burst(x, y - 6, 0xcff4ff, 30, 160, 2.4, 800);
        sfx.shoot("magic", x, y);
        return true;
      case "rally":
      case "mend":
        return true;
    }
    return false;
  }
}
