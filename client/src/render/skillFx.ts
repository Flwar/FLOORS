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
        // Played from the server's event.
        break;
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
      case "cuts":
        if (Math.random() < 0.5) this.fx.trail(x, y - 14, a - 0.8, a + 0.8, 10, 44, Math.random() < 0.5 ? c : 0xffffff, 140);
        break;
    }
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
