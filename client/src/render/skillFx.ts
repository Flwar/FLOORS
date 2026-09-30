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
      // --- Deeper skills --------------------------------------------------------------
      case "pierce":
      case "heaven": {
        const e = ahead(shapeLen);
        fx.streak(x, cy, e.x, e.y, c, 220, m.vfx === "heaven" ? 18 : 9);
        fx.streak(x, cy, e.x, e.y, 0xffffff, 140, m.vfx === "heaven" ? 7 : 4);
        fx.ring(e.x, e.y, c, 6, m.vfx === "heaven" ? 46 : 26, 260, 4);
        fx.sparks(e.x, e.y, a, c, m.vfx === "heaven" ? 22 : 12, 300);
        if (m.vfx === "heaven") {
          fx.rise(e.x, e.y, 0xfff6d8, 16, 20, 80, 900, 2.4);
          sfx.boom(false, x, y);
        }
        if (mine) shake(m.vfx === "heaven" ? 200 : 100, m.vfx === "heaven" ? 0.007 : 0.003);
        break;
      }
      case "sunder": {
        const r = m.shape?.kind === "arc" ? m.shape.range : 70;
        fx.trail(x, cy, a - 1.9, a + 1.9, r * 0.3, r + 6, c, 300);
        fx.trail(x, cy, a - 1.6, a + 1.6, r * 0.6, r, 0xffffff, 200);
        fx.sparks(ahead(r * 0.7).x, ahead(r * 0.7).y, a, c, 18, 300, Math.PI);
        fx.dust(ahead(r * 0.6).x, ahead(r * 0.6).y + 10, 10);
        if (mine) shake(160, 0.006);
        break;
      }
      case "aegis":
      case "ward": {
        const glyph = m.vfx === "ward" ? 0xc4b4ff : 0x9fd3ff;
        fx.ring(x, cy, glyph, 10, 40, 500, 5);
        fx.ring(x, cy, 0xffffff, 6, 28, 360, 2);
        fx.rise(x, y, glyph, 18, 16, 50, 900, 2.2);
        fx.star(x, cy - 22, 0xffffff, 12, 500);
        sfx.parry(true, x, y);
        break;
      }
      case "skyfall": {
        const p = { x: x + Math.cos(a) * (m.lunge ?? 0), y: y + Math.sin(a) * (m.lunge ?? 0) * 0.8 };
        const r = m.shape?.kind === "circle" ? m.shape.radius : 70;
        fx.bolt(p.x, p.y - 320, p.x, p.y - 10, c, 260, 10, 10);
        fx.bolt(p.x, p.y - 320, p.x, p.y - 10, 0xffffff, 180, 4, 14);
        fx.ring(p.x, p.y, c, 10, r, 500, 7);
        fx.ring(p.x, p.y, 0xffffff, 6, r * 0.6, 320, 3);
        fx.rise(p.x, p.y, c, 26, r * 0.6, 90, 1000, 2.6);
        fx.dust(p.x, p.y, 16);
        sfx.boom(true, p.x, p.y);
        if (mine) shake(280, 0.01);
        break;
      }
      case "rush":
        fx.dust(x, y, 14, a + Math.PI);
        fx.ring(x, cy, c, 8, 34, 260, 4);
        sfx.roar(x, y);
        break;
      case "guillotine": {
        const e = ahead(shapeLen * 0.7);
        fx.streak(e.x, e.y - 90, e.x, e.y + 6, 0xffffff, 200, 10);
        fx.streak(e.x, e.y - 90, e.x, e.y + 6, c, 260, 16);
        fx.crack(e.x - 22, e.y + 8, e.x + 22, e.y + 12, 0x2e2216, 1800, 4);
        fx.sparks(e.x, e.y, -Math.PI / 2, c, 18, 300, Math.PI * 1.4);
        fx.dust(e.x, e.y + 8, 12);
        sfx.boom(false, e.x, e.y);
        if (mine) shake(220, 0.008);
        break;
      }
      case "bloodlust":
        // The aura comes from the server event; this is the roar.
        fx.ring(x, cy, c, 10, 60, 420, 5);
        sfx.roar(x, y);
        break;
      case "quake": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 110;
        fx.ring(x, y, c, 12, r, 600, 8);
        fx.ring(x, y, 0xffffff, 8, r * 0.7, 420, 4);
        fx.ring(x, y, c, 20, r * 1.15, 800, 3);
        fx.dust(x, y, 30);
        for (let i = 0; i < 10; i++) {
          const ca = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
          fx.crack(x, y, x + Math.cos(ca) * r * 0.95, y + Math.sin(ca) * r * 0.55, 0x3a2c1c, 2400, 4);
        }
        fx.sparks(x, y - 8, -Math.PI / 2, c, 24, 360, Math.PI * 2);
        sfx.boom(true, x, y);
        if (mine) shake(420, 0.014);
        break;
      }
      case "smoke": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 84;
        for (let i = 0; i < 26; i++) {
          const ca = Math.random() * Math.PI * 2;
          const d = Math.random() * r;
          fx.dust(x + Math.cos(ca) * d, y + Math.sin(ca) * d * 0.6, 2, undefined, 0x8a8494);
        }
        fx.burst(x, cy, 0xb8b0c8, 26, 120, 4, 900);
        fx.ring(x, y, 0x6a6474, 10, r, 500, 5);
        sfx.shoot("shadow", x, y);
        break;
      }
      case "cuts":
        for (let i = 0; i < 5; i++) {
          const o = (Math.random() - 0.5) * 1.8;
          fx.trail(x, cy, a + o - 0.6, a + o + 0.6, 12, 46, i % 2 ? 0xffffff : c, 160 + i * 40);
        }
        fx.sparks(ahead(30).x, ahead(30).y, a, c, 16, 240);
        break;
      case "mark": {
        const e = ahead(40);
        fx.streak(x, cy, e.x, e.y, c, 180, 6);
        fx.ring(e.x, e.y, c, 18, 6, 400, 3);
        fx.star(e.x, e.y, c, 12, 400);
        sfx.shoot("knife", x, y);
        break;
      }
      case "phantom": {
        const len = m.lunge || 200;
        const e = ahead(len);
        for (let i = 0; i < 4; i++) fx.streak(x, cy + (i - 1.5) * 4, e.x, e.y + (i - 1.5) * 4, i % 2 ? 0xffffff : c, 200 + i * 60, 6);
        fx.burst(x, cy, c, 20, 90, 3, 700);
        fx.burst(e.x, e.y, c, 20, 90, 3, 700);
        sfx.shoot("shadow", x, y);
        break;
      }
      case "phalanx":
        fx.ring(x, cy, c, 22, 38, 700, 4);
        fx.ring(x, cy, 0xffffff, 18, 26, 500, 2);
        fx.star(x, cy - 16, 0xffffff, 12, 400);
        sfx.parry(false, x, y);
        break;
      case "pin": {
        const e = ahead(shapeLen);
        fx.streak(x, cy, e.x, e.y, c, 200, 8);
        fx.ring(e.x, e.y, 0x9fe0ff, 6, 28, 400, 3);
        fx.burst(e.x, e.y, 0xcff4ff, 12, 80, 2.2, 600);
        break;
      }
      case "whirlspear": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 82;
        fx.trail(x, cy, a, a + Math.PI * 2.2, r * 0.5, r, c, 380);
        fx.trail(x, cy, a + 1, a + Math.PI * 2.4, r * 0.3, r * 0.8, 0xffffff, 300);
        fx.ring(x, y - 6, c, 12, r, 380, 3);
        break;
      }
      case "drain": {
        const e = ahead(shapeLen);
        fx.bolt(x + Math.cos(a) * 10, cy, e.x, e.y, 0x3f8f4a, 320, 9, 10);
        fx.bolt(x + Math.cos(a) * 10, cy, e.x, e.y, c, 260, 4, 12);
        // Motes flow back toward you.
        for (let i = 0; i < 10; i++) {
          const t = Math.random();
          fx.rise(x + (e.x - x) * t, cy + (e.y - cy) * t, c, 1, 6, 30, 700, 2.4);
        }
        fx.ring(x, cy, c, 20, 8, 500, 3);
        sfx.shoot("magic", x, y);
        break;
      }
      case "pulse": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 92;
        fx.ring(x, cy, c, 8, r, 360, 7);
        fx.ring(x, cy, 0xffffff, 6, r * 0.8, 280, 3);
        fx.ring(x, cy, c, 20, r * 1.2, 520, 2);
        fx.sparks(x, cy, a, c, 22, 360, Math.PI * 2);
        sfx.boom(false, x, y);
        if (mine) shake(150, 0.006);
        break;
      }
      case "comet":
        fx.ring(x, cy, c, 6, 30, 300, 4);
        fx.rise(x, y, c, 12, 14, 60, 700, 2.4);
        break;
      // --- Dragon arts ------------------------------------------------------------
      case "dragonfang":
      case "wyvern": {
        fx.dust(x, y, 8, a + Math.PI);
        const e = ahead(m.lunge || 110);
        fx.streak(x, cy, e.x, e.y, c, 280, 14);
        fx.streak(x, cy, e.x, e.y, 0xffffff, 170, 4);
        if (m.vfx === "dragonfang") for (let i = 0; i < 6; i++) this.flameAt(x + (e.x - x) * (i / 6), cy + (e.y - cy) * (i / 6), 0.6);
        else fx.star(e.x, e.y, c, 14, 380);
        sfx.shoot("shadow", x, y);
        break;
      }
      case "wyrmslayer": {
        const r = m.shape?.kind === "arc" ? m.shape.range : 90;
        fx.trail(x, cy, a - 2.1, a + 2.1, r * 0.3, r, c, 380);
        fx.trail(x, cy, a - 2.1, a + 2.1, r * 0.55, r * 0.9, 0xfff0c0, 240);
        for (let i = -4; i <= 4; i++) {
          const aa = a + i * 0.5;
          this.flameAt(x + Math.cos(aa) * r * 0.75, cy + Math.sin(aa) * r * 0.6, 1);
        }
        sfx.boom(true, x, y);
        if (mine) shake(300, 0.011);
        break;
      }
      case "magma": {
        let px = x;
        let py = y;
        for (let i = 1; i <= 10; i++) {
          const t = i / 10;
          const qx = x + Math.cos(a) * shapeLen * t + (Math.random() - 0.5) * 10;
          const qy = y + Math.sin(a) * shapeLen * t * 0.8 + (Math.random() - 0.5) * 6;
          fx.crack(px, py, qx, qy, 0xff6a1a, 2600, 5);
          fx.crack(px, py, qx, qy, 0xffd08a, 1600, 2);
          if (i % 2 === 0) this.flameAt(qx, qy - 6, 0.9);
          px = qx;
          py = qy;
        }
        sfx.boom(true, x, y);
        if (mine) shake(260, 0.009);
        break;
      }
      case "cataclysm":
      case "wyrmwrath": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 100;
        fx.ring(x, y - 6, 0xfff0c0, 10, r, 420, 8);
        fx.ring(x, y - 6, c, 10, r * 1.15, 620, 5);
        for (let i = 0; i < 14; i++) {
          const aa = (i / 14) * Math.PI * 2;
          this.flameAt(x + Math.cos(aa) * r * 0.8, y - 6 + Math.sin(aa) * r * 0.55, 1.2);
        }
        for (let i = 0; i < 10; i++) {
          const aa = Math.random() * Math.PI * 2;
          fx.crack(x, y, x + Math.cos(aa) * r * 0.9, y + Math.sin(aa) * r * 0.6, 0x3a1a10, 2200, 4);
        }
        fx.burst(x, y - 10, 0xff9a3a, 40, 220, 3.4, 900);
        sfx.boom(true, x, y);
        if (mine) shake(420, 0.016);
        break;
      }
      case "emberdance": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 56;
        fx.trail(x, cy, a, a + Math.PI * 2, r * 0.35, r, c, 320);
        fx.ring(x, y - 6, c, 10, r, 360, 4);
        for (let i = 0; i < 8; i++) {
          const aa = (i / 8) * Math.PI * 2;
          this.flameAt(x + Math.cos(aa) * r * 0.8, cy + Math.sin(aa) * r * 0.6, 0.7);
        }
        break;
      }
      case "dragoon": {
        fx.dust(x, y, 12);
        fx.streak(x, cy - 120, x, cy, c, 260, 10);
        fx.ring(x, y - 4, c, 10, (m.shape?.kind === "circle" ? m.shape.radius : 64), 380, 6);
        fx.sparks(x, cy, -Math.PI / 2, 0xffffff, 16, 260, Math.PI * 2);
        sfx.boom(false, x, y);
        if (mine) shake(240, 0.009);
        break;
      }
      case "wyrmfang": {
        const e = ahead(shapeLen);
        fx.streak(x, cy, e.x, e.y, c, 260, 12);
        fx.streak(x, cy, e.x, e.y, 0xfff0c0, 180, 4);
        for (let i = 1; i <= 6; i++) this.flameAt(x + (e.x - x) * (i / 6), cy + (e.y - cy) * (i / 6), 0.8);
        sfx.boom(false, x, y);
        if (mine) shake(200, 0.008);
        break;
      }
      case "breath": {
        const r = m.shape?.kind === "arc" ? m.shape.range : 120;
        for (let i = 0; i < 26; i++) fx.sparks(x + Math.cos(a) * 14, cy + Math.sin(a) * 10, a + (Math.random() - 0.5) * 1.1, Math.random() < 0.4 ? 0xffe08a : 0xff7a2a, 1, r * 2.4, 0.2);
        for (let i = 1; i <= 4; i++) this.flameAt(x + Math.cos(a) * r * (i / 4) * 0.9, cy + Math.sin(a) * r * (i / 4) * 0.7, 0.5 + i * 0.15);
        sfx.boom(false, x, y);
        break;
      }
      case "meteors":
        fx.ring(x, cy, c, 6, 34, 360, 4);
        fx.rise(x, y, c, 16, 16, 70, 800, 2.6);
        break;
      case "kick": {
        const e = ahead(34);
        fx.ring(e.x, e.y, 0xffffff, 4, 22, 200, 3);
        fx.dust(e.x, e.y + 10, 6, a);
        break;
      }
      case "knife":
        break;
      case "fireball":
        fx.burst(ahead(16).x, ahead(16).y, c, 10, 80, 2.4, 380);
        break;
      case "storm":
        fx.ring(x, cy, c, 8, 50, 360, 4);
        for (let i = 0; i < 3; i++) fx.bolt(x + (Math.random() - 0.5) * 40, cy - 160, x + (Math.random() - 0.5) * 16, cy - 20, 0xeaf6ff, 180, 3, 14);
        break;
      case "sunburst": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 110;
        fx.ring(x, cy, 0xffffff, 10, r, 360, 7);
        fx.ring(x, cy, c, 10, r * 1.2, 520, 4);
        for (let i = 0; i < 12; i++) {
          const aa = (i / 12) * Math.PI * 2;
          fx.streak(x, cy, x + Math.cos(aa) * r, cy + Math.sin(aa) * r * 0.8, c, 260, 5);
        }
        sfx.chime(4);
        if (mine) shake(220, 0.008);
        break;
      }
      case "phoenix":
      case "howl":
      case "drakeblood":
      case "hailstorm":
        // Played from the server's event (or the hazards themselves).
        break;
      // --- Frost arts ---------------------------------------------------------------
      case "glacial":
      case "absolutezero":
      case "avalanche":
      case "hailspin":
      case "frostfang": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : m.shape?.kind === "arc" ? m.shape.range : 80;
        const full = m.shape?.kind === "circle";
        if (full) {
          fx.ring(x, y - 6, 0xffffff, 10, r, 420, m.vfx === "absolutezero" ? 9 : 6);
          fx.ring(x, y - 6, c, 10, r * 1.2, 600, 3);
        } else fx.trail(x, cy, a - 1.7, a + 1.7, r * 0.3, r, c, 360);
        for (let i = 0; i < (m.vfx === "absolutezero" ? 16 : 9); i++) {
          const aa = full ? (i / 9) * Math.PI * 2 : a - 1.5 + (i / 8) * 3;
          this.frostAt(x + Math.cos(aa) * r * 0.75, cy + Math.sin(aa) * r * 0.6, m.vfx === "absolutezero" ? 1.3 : 0.9);
        }
        sfx.hit(true, x, y, true, "metal");
        if (mine) shake(m.vfx === "absolutezero" ? 420 : 220, m.vfx === "absolutezero" ? 0.015 : 0.008);
        break;
      }
      case "verdict":
      case "icicle":
      case "shatter": {
        const e = ahead(shapeLen);
        fx.streak(x, cy, e.x, e.y, c, 280, m.vfx === "shatter" ? 14 : 10);
        fx.streak(x, cy, e.x, e.y, 0xffffff, 180, 4);
        for (let i = 1; i <= 7; i++) this.frostAt(x + (e.x - x) * (i / 7), cy + (e.y - cy) * (i / 7), 0.8);
        if (m.vfx === "shatter") for (let i = 1; i <= 6; i++) fx.crack(x + (e.x - x) * ((i - 1) / 6), y + (e.y - cy) * ((i - 1) / 6), x + (e.x - x) * (i / 6), y + (e.y - cy) * (i / 6), 0x8fd3ff, 2200, 4);
        sfx.hit(true, x, y, true, "metal");
        if (mine) shake(200, 0.008);
        break;
      }
      case "shiver": {
        const e = ahead(m.lunge || 190);
        fx.streak(x, cy, e.x, e.y, c, 260, 12);
        for (let i = 0; i < 6; i++) this.frostAt(x + (e.x - x) * (i / 6), cy + (e.y - cy) * (i / 6), 0.6);
        break;
      }
      case "iceshards":
      case "icelance":
        fx.burst(ahead(16).x, ahead(16).y, c, 10, 80, 2.4, 380);
        break;
      case "glacialspike": {
        const off = m.shape?.kind === "circle" ? m.shape.offset : 140;
        const r = m.shape?.kind === "circle" ? m.shape.radius : 64;
        const e = { x: x + Math.cos(a) * off, y: y + Math.sin(a) * off * 0.8 };
        fx.ring(e.x, e.y, 0xeaf6ff, 8, r, 420, 6);
        fx.streak(e.x, e.y + 10, e.x, e.y - 70, 0xffffff, 380, 16);
        fx.streak(e.x, e.y + 10, e.x, e.y - 70, c, 520, 26);
        for (let i = 0; i < 8; i++) this.frostAt(e.x + Math.cos((i / 8) * 6.28) * r * 0.6, e.y + Math.sin((i / 8) * 6.28) * r * 0.4, 1);
        sfx.hit(true, e.x, e.y, true, "metal");
        if (mine) shake(240, 0.009);
        break;
      }
      case "prison": {
        const e = ahead(46);
        fx.ring(e.x, e.y, 0xffffff, 6, 30, 500, 6);
        for (let i = 0; i < 6; i++) this.frostAt(e.x + Math.cos((i / 6) * 6.28) * 16, e.y + Math.sin((i / 6) * 6.28) * 12, 0.9);
        sfx.parry(true, e.x, e.y);
        break;
      }
      case "hatchets":
        fx.sparks(ahead(16).x, ahead(16).y, a, 0xdfe5ea, 6, 200, 0.5);
        break;
      case "snare": {
        const e = ahead(m.shape?.kind === "circle" ? m.shape.offset : 110);
        fx.ring(e.x, e.y + 8, c, 8, (m.shape?.kind === "circle" ? m.shape.radius : 54), 500, 3);
        fx.dust(e.x, e.y + 10, 8);
        break;
      }
      case "gale": {
        const e = ahead(m.lunge || 180);
        for (let i = -1; i <= 1; i++) fx.streak(x, cy + i * 8, e.x, e.y + i * 8, c, 260, 5);
        fx.dust(x, y, 10, a + Math.PI, 0xe6f4ff);
        break;
      }
      case "windwall": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 110;
        fx.ring(x, cy, 0xffffff, 10, r, 380, 6);
        fx.ring(x, cy, c, 10, r * 1.3, 560, 3);
        for (let i = 0; i < 16; i++) {
          const aa = (i / 16) * Math.PI * 2;
          fx.streak(x + Math.cos(aa) * 20, cy + Math.sin(aa) * 16, x + Math.cos(aa) * r, cy + Math.sin(aa) * r * 0.8, c, 300, 3);
        }
        if (mine) shake(200, 0.007);
        break;
      }
      case "eruption": {
        const off = m.shape?.kind === "circle" ? m.shape.offset : 130;
        const r = m.shape?.kind === "circle" ? m.shape.radius : 70;
        const e = { x: x + Math.cos(a) * off, y: y + Math.sin(a) * off * 0.8 };
        fx.ring(e.x, e.y, 0xffb347, 8, r, 420, 6);
        for (let i = 0; i < 9; i++) {
          const aa = (i / 9) * Math.PI * 2;
          this.flameAt(e.x + Math.cos(aa) * r * 0.6, e.y + Math.sin(aa) * r * 0.4, 1.1);
        }
        fx.burst(e.x, e.y - 10, 0xff7a2a, 30, 200, 3.2, 800);
        for (let i = 0; i < 6; i++) {
          const aa = Math.random() * Math.PI * 2;
          fx.crack(e.x, e.y, e.x + Math.cos(aa) * r, e.y + Math.sin(aa) * r * 0.6, 0x3a1a10, 2000, 4);
        }
        sfx.boom(true, e.x, e.y);
        if (mine) shake(260, 0.01);
        break;
      }
      // --- Void arts ----------------------------------------------------------------
      case "eclipseslash":
      case "nightblades":
      case "umbra":
      case "crescent":
      case "siphon":
      case "eclipse": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : m.shape?.kind === "arc" ? m.shape.range : 80;
        const full = m.shape?.kind === "circle";
        const big = m.vfx === "eclipse" || m.vfx === "umbra";
        if (full) {
          fx.ring(x, y - 6, 0x0c0814, 12, r, 480, big ? 12 : 8);
          fx.ring(x, y - 6, c, 10, r * 1.15, 620, 3);
          if (m.vfx === "eclipse") {
            // The sun goes out: a black disc with a pale corona.
            fx.ring(x, cy - 40, 0xf4f0ff, 18, 34, 900, 4);
            fx.burst(x, cy - 40, 0x0c0814, 30, 60, 5, 900);
            this.scene.cameras.main.flash(260, 20, 10, 40);
          }
        } else fx.trail(x, cy, a - 1.9, a + 1.9, r * 0.3, r, c, 380);
        const n = big ? 16 : 10;
        for (let i = 0; i < n; i++) {
          const aa = full ? (i / n) * Math.PI * 2 : a - 1.7 + (i / (n - 1)) * 3.4;
          const d = m.vfx === "siphon" ? r : r * 0.75;
          this.voidAt(x + Math.cos(aa) * d, cy + Math.sin(aa) * d * 0.6, big ? 1.2 : 0.8);
          if (m.vfx === "siphon") fx.streak(x + Math.cos(aa) * r, cy + Math.sin(aa) * r * 0.6, x, cy, c, 320, 3);
        }
        sfx.shoot("magic", x, y);
        if (mine) shake(big ? 420 : 220, big ? 0.015 : 0.008);
        break;
      }
      case "voidcleave":
      case "starfall": {
        const e = ahead(shapeLen);
        fx.streak(x, cy, e.x, e.y, 0x0c0814, 320, m.vfx === "voidcleave" ? 18 : 12);
        fx.streak(x, cy, e.x, e.y, c, 260, m.vfx === "voidcleave" ? 8 : 5);
        for (let i = 1; i <= 7; i++) this.voidAt(x + (e.x - x) * (i / 7), cy + (e.y - cy) * (i / 7), 0.7);
        if (m.vfx === "starfall") fx.star(e.x, e.y, 0xf4f0ff, 18, 520);
        if (m.vfx === "voidcleave") for (let i = 1; i <= 6; i++) fx.crack(x + (e.x - x) * ((i - 1) / 6), y + (e.y - cy) * ((i - 1) / 6), x + (e.x - x) * (i / 6), y + (e.y - cy) * (i / 6), 0x6a3aa8, 2200, 4);
        sfx.hit(true, x, y, true, "metal");
        if (mine) shake(220, 0.009);
        break;
      }
      case "nightfall":
      case "shadewalk": {
        const e = ahead(m.lunge || 200);
        fx.streak(x, cy, e.x, e.y, 0x0c0814, 320, 14);
        fx.streak(x, cy, e.x, e.y, c, 260, 4);
        this.voidAt(x, cy, 1);
        this.voidAt(e.x, e.y, 1);
        break;
      }
      case "voidorbs":
      case "shadowbolt":
        fx.burst(ahead(16).x, ahead(16).y, c, 10, 80, 2.4, 380);
        this.voidAt(ahead(16).x, ahead(16).y, 0.6);
        break;
      case "singularity": {
        const off = m.shape?.kind === "circle" ? m.shape.offset : 150;
        const r = m.shape?.kind === "circle" ? m.shape.radius : 84;
        const e = { x: x + Math.cos(a) * off, y: y + Math.sin(a) * off * 0.8 };
        fx.ring(e.x, e.y - 10, c, r, 6, 520, 5);
        fx.ring(e.x, e.y - 10, 0x0c0814, r * 1.2, 4, 620, 8);
        for (let i = 0; i < 12; i++) {
          const aa = (i / 12) * Math.PI * 2;
          fx.streak(e.x + Math.cos(aa) * r, e.y - 10 + Math.sin(aa) * r * 0.6, e.x, e.y - 10, c, 420, 3);
        }
        fx.burst(e.x, e.y - 10, 0x0c0814, 24, 40, 4, 700);
        sfx.boom(true, e.x, e.y);
        if (mine) shake(260, 0.01);
        break;
      }
      // --- Sun arts ------------------------------------------------------------------
      case "khopesh":
      case "scarabs":
      case "dunebreaker":
      case "sunwheel": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : m.shape?.kind === "arc" ? m.shape.range : 80;
        const full = m.shape?.kind === "circle";
        if (full) {
          fx.ring(x, y - 6, 0xfff8e0, 10, r, 420, 6);
          fx.ring(x, y - 6, c, 10, r * 1.15, 600, 3);
        } else fx.trail(x, cy, a - 2, a + 2, r * 0.3, r, c, 360);
        for (let i = 0; i < 9; i++) {
          const aa = full ? (i / 9) * Math.PI * 2 : a - 1.8 + (i / 8) * 3.6;
          this.sunAt(x + Math.cos(aa) * r * 0.8, cy + Math.sin(aa) * r * 0.6, 0.8);
        }
        if (m.vfx === "dunebreaker") fx.dust(x, y, 16);
        sfx.hit(true, x, y, true, "metal");
        if (mine) shake(m.vfx === "dunebreaker" ? 380 : 220, m.vfx === "dunebreaker" ? 0.014 : 0.008);
        break;
      }
      case "sunpierce":
      case "solarflare":
      case "obelisk": {
        const e = ahead(shapeLen);
        const big = m.vfx === "solarflare";
        fx.streak(x, cy, e.x, e.y, c, 300, big ? 22 : 12);
        fx.streak(x, cy, e.x, e.y, 0xffffff, 200, big ? 8 : 4);
        for (let i = 1; i <= 6; i++) this.sunAt(x + (e.x - x) * (i / 6), cy + (e.y - cy) * (i / 6), big ? 1 : 0.7);
        sfx.hit(true, x, y, true, "metal");
        if (mine) shake(big ? 380 : 220, big ? 0.014 : 0.009);
        break;
      }
      case "miragestep": {
        const e = ahead(m.lunge || 220);
        fx.streak(x, cy, e.x, e.y, c, 280, 10);
        fx.burst(x, cy, 0xfff0c0, 14, 60, 3, 600);
        this.sunAt(e.x, e.y, 1);
        break;
      }
      case "sunrays":
      case "sunbolt":
        this.sunAt(ahead(16).x, ahead(16).y, 0.9);
        sfx.hit(false, x, y, true, "metal");
        break;
      case "noonday": {
        const off = m.shape?.kind === "circle" ? m.shape.offset : 150;
        const r = m.shape?.kind === "circle" ? m.shape.radius : 88;
        const e = { x: x + Math.cos(a) * off, y: y + Math.sin(a) * off * 0.8 };
        fx.streak(e.x, e.y - 260, e.x, e.y - 6, 0xfff8e0, 360, 30);
        fx.streak(e.x, e.y - 260, e.x, e.y - 6, 0xffffff, 240, 12);
        fx.ring(e.x, e.y, 0xffffff, 8, r, 420, 6);
        fx.ring(e.x, e.y, c, 10, r * 1.2, 600, 3);
        for (let i = 0; i < 5; i++) this.flameAt(e.x + (Math.random() - 0.5) * r, e.y + (Math.random() - 0.5) * r * 0.6, 0.8);
        sfx.boom(true, e.x, e.y);
        if (mine) shake(280, 0.011);
        break;
      }
      case "carapace":
        fx.ring(x, cy, 0xffe08a, 30, 18, 420, 5);
        fx.ring(x, cy, c, 24, 28, 700, 3);
        this.sunAt(x, cy - 10, 1);
        sfx.parry(false, x, y);
        break;
      case "sunfall": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : 180;
        fx.streak(x, y - 320, x, y - 6, 0xffffff, 420, 40);
        fx.streak(x, y - 320, x, y - 6, c, 520, 70);
        fx.ring(x, y - 6, 0xffffff, 10, r, 520, 8);
        fx.ring(x, y - 6, 0xffb030, 10, r * 1.15, 760, 4);
        for (let i = 0; i < 12; i++) {
          const aa = (i / 12) * Math.PI * 2;
          this.sunAt(x + Math.cos(aa) * r * 0.7, y - 6 + Math.sin(aa) * r * 0.45, 1.2);
        }
        sfx.boom(true, x, y);
        if (mine) shake(520, 0.02);
        break;
      }
      case "voidrift":
      case "whirlpool":
      case "steamvent":
      case "sandstorm":
        // Played from the server's event, where the rift (or the whirlpool) actually opens.
        break;
      // --- Clockwork arts -----------------------------------------------------------
      case "gearsaw":
      case "springblades":
      case "steamhammer":
      case "gyro": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : m.shape?.kind === "arc" ? m.shape.range : 80;
        const full = m.shape?.kind === "circle";
        if (full) {
          fx.ring(x, y - 6, 0xfff0c0, 10, r, 420, 6);
          fx.ring(x, y - 6, c, 10, r * 1.15, 600, 3);
        } else fx.trail(x, cy, a - 2, a + 2, r * 0.3, r, c, 360);
        for (let i = 0; i < 10; i++) {
          const aa = full ? (i / 10) * Math.PI * 2 : a - 1.8 + (i / 9) * 3.6;
          this.sparkAt(x + Math.cos(aa) * r * 0.8, cy + Math.sin(aa) * r * 0.6, 0.9);
        }
        if (m.vfx === "steamhammer") this.steamAt(x, y, 1.4);
        sfx.hit(true, x, y, true, "metal");
        if (mine) shake(m.vfx === "steamhammer" ? 380 : 220, m.vfx === "steamhammer" ? 0.014 : 0.008);
        break;
      }
      case "piston":
      case "overdrive":
      case "railshot":
      case "titanfist": {
        const e = ahead(shapeLen);
        const big = m.vfx === "titanfist" || m.vfx === "overdrive";
        fx.streak(x, cy, e.x, e.y, c, 280, big ? 22 : 12);
        fx.streak(x, cy, e.x, e.y, 0xffffff, 180, big ? 8 : 4);
        for (let i = 1; i <= 7; i++) this.sparkAt(x + (e.x - x) * (i / 7), cy + (e.y - cy) * (i / 7), big ? 1.1 : 0.7);
        if (big) this.steamAt(e.x, e.y, 1.2);
        sfx.hit(true, x, y, true, "metal");
        if (mine) shake(big ? 420 : 220, big ? 0.016 : 0.009);
        break;
      }
      case "ticktock": {
        const e = ahead(m.lunge || 220);
        fx.streak(x, cy, e.x, e.y, c, 260, 10);
        this.sparkAt(x, cy, 1);
        this.sparkAt(e.x, e.y, 1);
        break;
      }
      case "sparks":
      case "shrapnel":
        this.sparkAt(ahead(16).x, ahead(16).y, 0.9);
        sfx.hit(false, x, y, true, "metal");
        break;
      case "aetherburst": {
        const off = m.shape?.kind === "circle" ? m.shape.offset : 150;
        const r = m.shape?.kind === "circle" ? m.shape.radius : 86;
        const e = { x: x + Math.cos(a) * off, y: y + Math.sin(a) * off * 0.8 };
        fx.ring(e.x, e.y, 0xffffff, 8, r, 400, 6);
        fx.ring(e.x, e.y, c, 10, r * 1.2, 560, 3);
        for (let i = 0; i < 10; i++) fx.bolt(e.x, e.y - 10, e.x + Math.cos((i / 10) * 6.28) * r, e.y - 10 + Math.sin((i / 10) * 6.28) * r * 0.6, c, 220, 3, 8);
        sfx.boom(true, e.x, e.y);
        if (mine) shake(260, 0.01);
        break;
      }
      // --- Tide arts ----------------------------------------------------------------
      case "tidebreak":
      case "barbs":
      case "tsunami":
      case "maelspin":
      case "leviathan": {
        const r = m.shape?.kind === "circle" ? m.shape.radius : m.shape?.kind === "arc" ? m.shape.range : 80;
        const full = m.shape?.kind === "circle";
        const big = m.vfx === "leviathan" || m.vfx === "tsunami";
        if (full) {
          fx.ring(x, y - 6, 0xffffff, 12, r, 460, big ? 10 : 6);
          fx.ring(x, y - 6, c, 10, r * 1.2, 640, 3);
        } else fx.trail(x, cy, a - 1.9, a + 1.9, r * 0.3, r, c, 380);
        const n = big ? 18 : 10;
        for (let i = 0; i < n; i++) {
          const aa = full ? (i / n) * Math.PI * 2 : a - 1.7 + (i / (n - 1)) * 3.4;
          this.splashAt(x + Math.cos(aa) * r * 0.8, cy + Math.sin(aa) * r * 0.6, big ? 1.2 : 0.8);
        }
        sfx.boom(false, x, y);
        if (mine) shake(big ? 420 : 220, big ? 0.015 : 0.008);
        break;
      }
      case "undertow":
      case "riptide":
      case "tridentstorm": {
        const e = ahead(shapeLen);
        fx.streak(x, cy, e.x, e.y, c, 300, m.vfx === "riptide" ? 18 : 12);
        fx.streak(x, cy, e.x, e.y, 0xffffff, 200, 4);
        for (let i = 1; i <= 7; i++) this.splashAt(x + (e.x - x) * (i / 7), cy + (e.y - cy) * (i / 7), 0.7);
        sfx.hit(true, x, y, true, "flesh");
        if (mine) shake(220, 0.009);
        break;
      }
      case "eelstep":
      case "riptidedash": {
        const e = ahead(m.lunge || 200);
        fx.streak(x, cy, e.x, e.y, c, 280, 12);
        this.splashAt(x, cy, 1);
        this.splashAt(e.x, e.y, 1);
        break;
      }
      case "bubbles":
      case "tidalwave":
        this.splashAt(ahead(16).x, ahead(16).y, 0.7);
        break;
      case "geyser": {
        const off = m.shape?.kind === "circle" ? m.shape.offset : 150;
        const r = m.shape?.kind === "circle" ? m.shape.radius : 82;
        const e = { x: x + Math.cos(a) * off, y: y + Math.sin(a) * off * 0.8 };
        fx.ring(e.x, e.y, 0xffffff, 8, r, 420, 6);
        fx.streak(e.x, e.y + 10, e.x, e.y - 90, 0xffffff, 420, 18);
        fx.streak(e.x, e.y + 10, e.x, e.y - 90, c, 560, 30);
        for (let i = 0; i < 10; i++) this.splashAt(e.x + Math.cos((i / 10) * 6.28) * r * 0.6, e.y + Math.sin((i / 10) * 6.28) * r * 0.4, 1);
        sfx.boom(true, e.x, e.y);
        if (mine) shake(260, 0.01);
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
      case "phantom":
        if (Math.random() < 0.7) this.fx.rise(x, y - 14, c, 1, 8, 6, 300, 3);
        break;
      case "rush":
        if (Math.random() < 0.7) this.fx.dust(x, y, 3, a + Math.PI);
        break;
      case "ticktock":
        if (Math.random() < 0.8) this.fx.rise(x, y - 10, Math.random() < 0.5 ? c : 0xffffff, 2, 8, 10, 300, 2.4);
        break;
      case "miragestep":
        // Heat shimmer where you were.
        if (Math.random() < 0.8) this.fx.rise(x, y - 12, Math.random() < 0.5 ? 0xfff0c0 : c, 2, 10, 8, 420, 3.2);
        break;
      case "eelstep":
      case "riptidedash":
        if (Math.random() < 0.8) this.fx.rise(x, y - 10, Math.random() < 0.5 ? c : 0xffffff, 2, 10, 14, 360, 3);
        break;
      case "nightfall":
      case "shadewalk":
        if (Math.random() < 0.8) this.fx.rise(x, y - 14, Math.random() < 0.5 ? c : 0x1a1028, 2, 10, 10, 360, 3.4);
        break;
      case "cuts":
        if (Math.random() < 0.5) this.fx.trail(x, y - 14, a - 0.8, a + 0.8, 10, 44, Math.random() < 0.5 ? c : 0xffffff, 140);
        break;
    }
  }

  /** A puff of frost and ice crystals. */
  frostAt(x: number, y: number, size: number) {
    const fx = this.fx;
    fx.rise(x, y, Math.random() < 0.5 ? 0xdff4ff : 0x9fd8ff, Math.ceil(4 * size), 8 * size, 30 * size, 640, 2.6 * size);
    fx.star(x, y - 6 * size, 0xffffff, 5 * size, 420);
  }

  /** A wisp of the void: dark motes and a pale spark. */
  voidAt(x: number, y: number, size: number) {
    const fx = this.fx;
    fx.rise(x, y, Math.random() < 0.5 ? 0x2a1a44 : 0x0c0814, Math.ceil(4 * size), 9 * size, 34 * size, 700, 3 * size);
    fx.rise(x, y, Math.random() < 0.5 ? 0xb77af2 : 0xd8b8ff, Math.ceil(2 * size), 6 * size, 40 * size, 520, 1.8 * size);
    fx.star(x, y - 6 * size, 0xf0e8ff, 4 * size, 360);
  }

  /** A burst of sparks off hot metal. */
  sparkAt(x: number, y: number, size: number) {
    const fx = this.fx;
    fx.sparks(x, y, -Math.PI / 2, Math.random() < 0.5 ? 0xffd070 : 0xff9a3a, Math.ceil(5 * size), 160 * size, Math.PI * 1.6);
    fx.star(x, y, 0xfff0c0, 4 * size, 260);
  }

  /** A glint of sunlight: a white-gold star and a few golden sparks. */
  sunAt(x: number, y: number, size: number) {
    const fx = this.fx;
    fx.star(x, y, 0xfff8e0, 6 * size, 300);
    fx.sparks(x, y, -Math.PI / 2, Math.random() < 0.5 ? 0xffd24a : 0xffb030, Math.ceil(4 * size), 120 * size, Math.PI * 1.6);
  }

  /** A puff of steam. */
  steamAt(x: number, y: number, size: number) {
    const fx = this.fx;
    fx.rise(x, y, 0xf0f0f0, Math.ceil(6 * size), 14 * size, 40 * size, 900, 5 * size);
    fx.rise(x, y, 0xd8d8d8, Math.ceil(4 * size), 10 * size, 28 * size, 700, 4 * size);
  }

  /** A splash of seawater: droplets thrown up, and foam. */
  splashAt(x: number, y: number, size: number) {
    const fx = this.fx;
    fx.rise(x, y, Math.random() < 0.5 ? 0x8ff0e0 : 0x3fb8c8, Math.ceil(5 * size), 10 * size, 30 * size, 520, 2.6 * size);
    fx.rise(x, y, 0xffffff, Math.ceil(3 * size), 6 * size, 22 * size, 420, 2 * size);
  }

  /** A tongue of fire that leaps up and fades. */
  flameAt(x: number, y: number, size: number) {
    const fx = this.fx;
    fx.rise(x, y, Math.random() < 0.5 ? 0xff7a2a : 0xffb347, Math.ceil(4 * size), 8 * size, 50 * size, 520, 2.8 * size);
    fx.rise(x, y, 0xffe08a, Math.ceil(2 * size), 4 * size, 36 * size, 380, 2 * size);
  }

  /** Server events for effects that land somewhere else than the caster. */
  event(k: string, x: number, y: number, r: number) {
    const fx = this.fx;
    switch (k) {
      case "storm":
        fx.ring(x, y - 10, 0x9fd3ff, 10, r, 500, 3);
        sfx.hit(true, x, y, true, "metal");
        return true;
      case "iceburst":
        fx.burst(x, y - 6, 0xdff4ff, 16, 110, 2.6, 560);
        this.frostAt(x, y - 6, 0.9);
        sfx.hit(true, x, y, true, "metal");
        return true;
      // --- The Sunscorched Sands -------------------------------------------------------
      case "sunburst":
        fx.burst(x, y - 6, 0xffe08a, 14, 100, 2.6, 520);
        this.sunAt(x, y - 8, 1);
        sfx.hit(false, x, y, true, "metal");
        return true;
      case "dazzled":
        // Blinded: a flash of white-gold in its eyes.
        fx.star(x, y - 30, 0xffffff, 12, 360);
        fx.ring(x, y - 26, 0xffd24a, 4, 18, 360, 3);
        return true;
      case "dazzlemiss":
        fx.text(x + (Math.random() - 0.5) * 16, y - 44, "MISS", { color: "#ffe08a", size: 9, bold: true }, 700, 22);
        this.sunAt(x, y - 20, 0.6);
        return true;
      case "sandstorm":
        fx.ring(x, y, 0xe8c070, 8, r, 800, 5);
        for (let i = 0; i < 10; i++) fx.dust(x + (Math.random() - 0.5) * r * 1.4, y + (Math.random() - 0.5) * r * 0.9, 4);
        sfx.boom(false, x, y);
        return true;
      case "suncarry":
        // The sun in someone's hands, burning.
        fx.star(x, y - 48, 0xfff8e0, 13, 280);
        fx.ring(x, y - 48, 0xffd24a, 5, 14, 260, 3);
        fx.rise(x, y - 44, Math.random() < 0.5 ? 0xffd24a : 0xffffff, 3, 8, 24, 480, 2.6);
        return true;
      case "suntaken":
        fx.streak(x, y - 240, x, y - 6, 0xfff8e0, 420, 26);
        fx.ring(x, y - 6, 0xffd24a, 8, 60, 520, 5);
        this.sunAt(x, y - 30, 1.4);
        sfx.chime(3);
        return true;
      case "sunfade":
        fx.burst(x, y - 40, 0x8a7a5a, 16, 60, 3, 700);
        fx.ring(x, y - 40, 0xffd24a, 16, 4, 400, 3);
        return true;
      case "altarlit":
        fx.streak(x, y - 200, x, y - 6, 0xfff0a0, 420, 20);
        fx.ring(x, y - 6, 0xffb030, 8, 70, 560, 6);
        for (let i = 0; i < 5; i++) this.flameAt(x + (Math.random() - 0.5) * 20, y - 10, 1);
        this.sunAt(x, y - 30, 1.4);
        sfx.boom(false, x, y);
        return true;
      case "sunchamber":
        fx.ring(x, y, 0xfff0a0, 20, r, 900, 8);
        fx.ring(x, y, 0xffb030, 30, r * 1.1, 1200, 4);
        for (let i = 0; i < 16; i++) {
          const aa = (i / 16) * Math.PI * 2;
          this.sunAt(x + Math.cos(aa) * r * 0.6, y + Math.sin(aa) * r * 0.4, 1.4);
        }
        sfx.boom(true, x, y);
        return true;
      case "sparkburst":
        this.sparkAt(x, y - 6, 1);
        sfx.hit(false, x, y, true, "metal");
        return true;
      case "sundered":
        // Armour cracks: a ring of sparks and a flash of white-hot metal.
        fx.ring(x, y - 24, 0xffb040, 4, 18, 380, 3);
        this.sparkAt(x, y - 18, 0.8);
        sfx.hit(true, x, y, true, "metal");
        return true;
      case "steamvent":
        fx.ring(x, y, 0xffffff, 8, r, 800, 5);
        for (let i = 0; i < 8; i++) this.steamAt(x + (Math.random() - 0.5) * r * 1.4, y + (Math.random() - 0.5) * r * 0.9, 1);
        sfx.boom(false, x, y);
        return true;
      case "breaker":
        fx.bolt(x, y - 40, x, y - 4, 0x9fd3ff, 260, 4, 10);
        this.sparkAt(x, y - 20, 1.1);
        sfx.hit(true, x, y, true, "metal");
        return true;
      case "breakerdrop":
        fx.burst(x, y - 20, 0x5a5a5a, 10, 60, 3, 500);
        this.steamAt(x, y - 10, 0.8);
        return true;
      case "overload":
        fx.ring(x, y, 0x9fd3ff, 20, r, 900, 6);
        for (let i = 0; i < 12; i++) fx.bolt(x, y, x + Math.cos((i / 12) * 6.28) * r, y + Math.sin((i / 12) * 6.28) * r * 0.6, 0x9fd3ff, 400, 4, 12);
        sfx.boom(true, x, y);
        return true;
      case "splash":
        fx.burst(x, y - 6, 0x8ff0e0, 16, 110, 2.6, 520);
        this.splashAt(x, y - 6, 0.9);
        sfx.hit(false, x, y, true, "flesh");
        return true;
      case "soaked":
        fx.ring(x, y - 30, 0x8ff0e0, 4, 16, 400, 3);
        this.splashAt(x, y - 20, 0.6);
        return true;
      case "whirlpool":
        fx.ring(x, y, 0xffffff, r, 8, 900, 4);
        fx.ring(x, y, 0x3fb8c8, r * 1.1, 10, 1100, 6);
        for (let i = 0; i < 12; i++) this.splashAt(x + Math.cos((i / 12) * 6.28) * r, y + Math.sin((i / 12) * 6.28) * r * 0.7, 0.8);
        sfx.boom(false, x, y);
        return true;
      case "tiderise":
        for (let i = 0; i < 16; i++) this.splashAt(x + (Math.random() - 0.5) * r * 2, y, 0.8);
        sfx.boom(false, x, y);
        return true;
      case "tidedrain":
        fx.ring(x, y, 0x8ff0e0, 20, r, 900, 4);
        for (let i = 0; i < 20; i++) this.splashAt(x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * r, 0.9);
        return true;
      case "voidburst":
        fx.burst(x, y - 6, 0xb77af2, 16, 110, 2.6, 560);
        this.voidAt(x, y - 6, 0.9);
        sfx.hit(true, x, y, true, "flesh");
        return true;
      case "cursed":
        // A curse takes hold: a violet sigil flares over the target.
        fx.ring(x, y - 34, 0xb77af2, 4, 16, 420, 3);
        this.voidAt(x, y - 20, 0.6);
        return true;
      case "voidrift":
        fx.ring(x, y, 0x0c0814, 10, r, 700, 10);
        fx.ring(x, y, 0xb77af2, 6, r * 0.9, 900, 3);
        for (let i = 0; i < 10; i++) this.voidAt(x + (Math.random() - 0.5) * r * 1.4, y + (Math.random() - 0.5) * r * 0.9, 0.9);
        sfx.shoot("magic", x, y);
        return true;
      case "nightveil":
        fx.burst(x, y - 16, 0x2a1a44, 18, 80, 3, 500);
        fx.ring(x, y - 16, 0xd8b8ff, 6, 30, 360, 3);
        return true;
      case "fireburst":
        fx.burst(x, y - 6, 0xff9a3a, 18, 120, 3, 600);
        this.flameAt(x, y - 6, 1);
        sfx.boom(false, x, y);
        return true;
      case "learn":
        // Someone read a scroll: golden script unfurls around them.
        fx.ring(x, y - 14, 0xf2d27a, 6, 44, 600, 3);
        fx.rise(x, y - 6, 0xf2d27a, 18, 16, 50, 1000, 2.2);
        return true;
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
