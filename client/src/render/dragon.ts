import * as Phaser from "phaser";
import { RES } from "../art/characters.ts";

/**
 * Dragons: drakes, Cindermaw and Ignivar. Painted in parts (body, neck, horned head with a
 * separate jaw, two tail segments, bat wings, four legs) and posed per frame, so a dragon
 * can bite, breathe fire, lash its tail, buffet with its wings and dive from the sky.
 */

const OUTLINE = "#1d1a17";

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `#${((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0")}`;
}

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const g = tex.getContext();
  g.lineJoin = "round";
  g.lineCap = "round";
  paint(g);
  tex.refresh();
}

/** Fill a path with an outline behind it. */
function inked(g: CanvasRenderingContext2D, path: () => void, fill: string | CanvasGradient, width = 3) {
  path();
  g.strokeStyle = OUTLINE;
  g.lineWidth = width;
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

export function paintDragon(scene: Phaser.Scene, key: string, scale: string, dark: string, belly: string, glow: string) {
  const grad = (g: CanvasRenderingContext2D, y0: number, y1: number) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, shade(scale, 34));
    gr.addColorStop(0.55, scale);
    gr.addColorStop(1, dark);
    return gr;
  };
  // Body: a heavy barrel with spines down the back and plated belly.
  canvas(scene, `${key}:body`, 84, 48, (g) => {
    g.fillStyle = OUTLINE;
    for (let i = 0; i < 6; i++) {
      const x = 16 + i * 10;
      g.beginPath();
      g.moveTo(x - 5, 12);
      g.lineTo(x + 1, 1 + (i % 2) * 3);
      g.lineTo(x + 5, 12);
      g.fill();
    }
    g.fillStyle = shade(dark, 20);
    for (let i = 0; i < 6; i++) {
      const x = 16 + i * 10;
      g.beginPath();
      g.moveTo(x - 3, 12);
      g.lineTo(x + 1, 4 + (i % 2) * 3);
      g.lineTo(x + 3, 12);
      g.fill();
    }
    inked(g, () => {
      g.beginPath();
      g.ellipse(42, 26, 38, 17, 0, 0, Math.PI * 2);
    }, grad(g, 9, 43), 3.5);
    // Belly plates.
    g.save();
    g.beginPath();
    g.ellipse(42, 26, 38, 17, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = belly;
    g.beginPath();
    g.ellipse(44, 40, 30, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade(belly, -50);
    g.lineWidth = 1.4;
    for (let x = 20; x < 72; x += 7) {
      g.beginPath();
      g.moveTo(x, 32);
      g.lineTo(x + 2, 44);
      g.stroke();
    }
    // Scale texture.
    g.fillStyle = "rgba(0,0,0,0.14)";
    for (let y = 14; y < 32; y += 6) for (let x = 10 + (y % 12); x < 76; x += 12) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI);
      g.fill();
    }
    g.restore();
  });
  // Neck.
  canvas(scene, `${key}:neck`, 40, 22, (g) => {
    inked(g, () => {
      g.beginPath();
      g.moveTo(2, 3);
      g.quadraticCurveTo(20, 0, 38, 6);
      g.lineTo(38, 16);
      g.quadraticCurveTo(20, 21, 2, 19);
      g.closePath();
    }, grad(g, 2, 20), 3);
    g.fillStyle = belly;
    g.beginPath();
    g.moveTo(4, 16);
    g.quadraticCurveTo(20, 19, 36, 14);
    g.lineTo(36, 16);
    g.quadraticCurveTo(20, 21, 4, 19);
    g.fill();
  });
  // Head: long skull, swept horns, a glowing eye, nostrils that smoke.
  canvas(scene, `${key}:head`, 60, 40, (g) => {
    // Horns behind the skull.
    for (const [hx, hy, tx, ty] of [[14, 16, 1, 3], [18, 14, 6, 1]] as const) {
      inked(g, () => {
        g.beginPath();
        g.moveTo(hx + 4, hy + 4);
        g.quadraticCurveTo(hx - 2, hy - 2, tx, ty);
        g.quadraticCurveTo(hx + 2, hy, hx + 9, hy + 2);
        g.closePath();
      }, "#e8dcc0", 2.5);
    }
    inked(g, () => {
      g.beginPath();
      g.moveTo(10, 18);
      g.quadraticCurveTo(18, 8, 32, 12);
      g.lineTo(54, 18);
      g.quadraticCurveTo(58, 22, 54, 26);
      g.lineTo(28, 30);
      g.quadraticCurveTo(12, 30, 10, 18);
      g.closePath();
    }, grad(g, 8, 30), 3);
    // Brow ridge and eye.
    g.fillStyle = shade(dark, -10);
    g.beginPath();
    g.moveTo(20, 14);
    g.quadraticCurveTo(28, 10, 34, 15);
    g.lineTo(24, 18);
    g.closePath();
    g.fill();
    g.shadowColor = glow;
    g.shadowBlur = 6;
    g.fillStyle = glow;
    g.beginPath();
    g.ellipse(28, 17.5, 3.2, 2, -0.2, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = OUTLINE;
    g.fillRect(27.5, 16, 1.2, 3.2);
    // Nostril and teeth along the upper jaw.
    g.beginPath();
    g.ellipse(51, 19, 1.8, 1.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f4ecd8";
    for (let x = 30; x < 52; x += 5) {
      g.beginPath();
      g.moveTo(x, 27);
      g.lineTo(x + 1.5, 31);
      g.lineTo(x + 3, 27);
      g.fill();
    }
  });
  // Lower jaw.
  canvas(scene, `${key}:jaw`, 44, 14, (g) => {
    inked(g, () => {
      g.beginPath();
      g.moveTo(2, 3);
      g.lineTo(40, 5);
      g.quadraticCurveTo(42, 8, 38, 10);
      g.lineTo(6, 12);
      g.closePath();
    }, shade(scale, -20), 2.5);
    g.fillStyle = "#f4ecd8";
    for (let x = 12; x < 38; x += 5) {
      g.beginPath();
      g.moveTo(x, 5);
      g.lineTo(x + 1.5, 1);
      g.lineTo(x + 3, 5);
      g.fill();
    }
  });
  // Tail: a thick root, and a tip ending in a spade.
  canvas(scene, `${key}:tail1`, 48, 24, (g) => {
    inked(g, () => {
      g.beginPath();
      g.moveTo(46, 2);
      g.quadraticCurveTo(24, 5, 2, 8);
      g.lineTo(2, 16);
      g.quadraticCurveTo(24, 20, 46, 22);
      g.closePath();
    }, grad(g, 2, 22), 3);
    g.fillStyle = OUTLINE;
    for (let x = 10; x < 44; x += 9) {
      g.beginPath();
      g.moveTo(x - 3, 6);
      g.lineTo(x, 0);
      g.lineTo(x + 3, 5);
      g.fill();
    }
  });
  canvas(scene, `${key}:tail2`, 48, 22, (g) => {
    inked(g, () => {
      g.beginPath();
      g.moveTo(46, 8);
      g.quadraticCurveTo(28, 9, 12, 10);
      g.lineTo(2, 3);
      g.lineTo(6, 11);
      g.lineTo(2, 19);
      g.lineTo(12, 13);
      g.quadraticCurveTo(28, 15, 46, 15);
      g.closePath();
    }, grad(g, 3, 19), 2.5);
  });
  // A wing: bone fingers and a membrane lit from behind.
  canvas(scene, `${key}:wing`, 92, 76, (g) => {
    const shoulder = { x: 10, y: 70 };
    const fingers = [[30, 6], [58, 4], [82, 18], [90, 44]] as const;
    const mem = g.createLinearGradient(0, 0, 90, 70);
    mem.addColorStop(0, shade(dark, 30));
    mem.addColorStop(0.6, dark);
    mem.addColorStop(1, shade(dark, -20));
    inked(g, () => {
      g.beginPath();
      g.moveTo(shoulder.x, shoulder.y);
      g.lineTo(fingers[0][0], fingers[0][1]);
      for (let i = 1; i < fingers.length; i++) {
        const [px, py] = fingers[i - 1];
        const [x, y] = fingers[i];
        g.quadraticCurveTo((px + x) / 2 + 4, (py + y) / 2 + 14, x, y);
      }
      g.quadraticCurveTo(50, 60, shoulder.x + 6, shoulder.y);
      g.closePath();
    }, mem, 3);
    g.strokeStyle = shade(scale, 10);
    g.lineWidth = 3;
    for (const [x, y] of fingers) {
      g.beginPath();
      g.moveTo(shoulder.x + 2, shoulder.y - 4);
      g.lineTo(x, y);
      g.stroke();
    }
    g.fillStyle = "#e8dcc0";
    g.beginPath();
    g.moveTo(fingers[0][0] - 3, fingers[0][1] + 2);
    g.lineTo(fingers[0][0] + 1, fingers[0][1] - 5);
    g.lineTo(fingers[0][0] + 3, fingers[0][1] + 3);
    g.fill();
  });
  // A leg with claws.
  canvas(scene, `${key}:leg`, 18, 26, (g) => {
    inked(g, () => {
      g.beginPath();
      g.roundRect(3, 0, 12, 22, 5);
    }, shade(scale, -24), 2.5);
    g.fillStyle = "#e8dcc0";
    for (const x of [4, 9, 14]) {
      g.beginPath();
      g.moveTo(x - 2, 22);
      g.lineTo(x, 26);
      g.lineTo(x + 2, 22);
      g.fill();
    }
  });
}

/**
 * A posable dragon. `apply` takes the enemy's animation (idle, walk, run, bite, breath,
 * tail, wing, dive, roar, hurt, dead) and the clip's timing.
 */
export class DragonRig {
  readonly root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private neck: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private jaw: Phaser.GameObjects.Image;
  private tail1: Phaser.GameObjects.Image;
  private tail2: Phaser.GameObjects.Image;
  private wingFar: Phaser.GameObjects.Image;
  private wingNear: Phaser.GameObjects.Image;
  private legs: Phaser.GameObjects.Image[];
  private shadow: Phaser.GameObjects.Image;
  private images: Phaser.GameObjects.Image[];
  private flip = false;
  private flashUntil = 0;
  /** Where the mouth is right now (world units, relative to the root), for breath effects. */
  readonly mouth = { x: 0, y: 0, open: 0 };

  constructor(private scene: Phaser.Scene, key: string, scale: string, dark: string, belly: string, glow: string, private size: number) {
    paintDragon(scene, key, scale, dark, belly, glow);
    const k = 1 / RES;
    this.shadow = scene.add.image(0, 0, "shadow").setScale(k * 2.2, k * 1.2);
    this.wingFar = scene.add.image(0, 0, `${key}:wing`).setOrigin(0.11, 0.92).setScale(k).setTint(0x9a8a8a);
    this.legs = [0, 1, 2, 3].map((i) => scene.add.image(0, 0, `${key}:leg`).setOrigin(0.5, 0).setScale(k).setTint(i % 2 ? 0xffffff : 0xb0a0a0));
    this.tail2 = scene.add.image(0, 0, `${key}:tail2`).setOrigin(0.97, 0.5).setScale(k);
    this.tail1 = scene.add.image(0, 0, `${key}:tail1`).setOrigin(0.97, 0.5).setScale(k);
    this.body = scene.add.image(0, 0, `${key}:body`).setScale(k);
    this.neck = scene.add.image(0, 0, `${key}:neck`).setOrigin(0.05, 0.5).setScale(k);
    this.jaw = scene.add.image(0, 0, `${key}:jaw`).setOrigin(0.05, 0.3).setScale(k);
    this.head = scene.add.image(0, 0, `${key}:head`).setOrigin(0.2, 0.55).setScale(k);
    this.wingNear = scene.add.image(0, 0, `${key}:wing`).setOrigin(0.11, 0.92).setScale(k);
    this.root = scene.add.container(0, 0, [
      this.shadow, this.wingFar, this.legs[0], this.legs[2], this.tail2, this.tail1, this.body, this.neck, this.jaw, this.head, this.legs[1], this.legs[3], this.wingNear,
    ]);
    this.root.setScale(size);
    this.images = [this.body, this.neck, this.head, this.jaw, this.tail1, this.tail2, this.wingFar, this.wingNear, ...this.legs];
  }

  flash(ms = 80) {
    this.flashUntil = this.scene.time.now + ms;
    for (const im of this.images) im.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  apply(anim: string, t: number, face: number, windup: number, active: number, recovery: number, alpha: number) {
    if (this.flashUntil && this.scene.time.now > this.flashUntil) {
      this.flashUntil = 0;
      for (const im of this.images) im.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      this.wingFar.setTint(0x9a8a8a);
      this.legs.forEach((l, i) => l.setTint(i % 2 ? 0xffffff : 0xb0a0a0));
    }
    const c = Math.cos(face);
    if (Math.abs(c) > 0.2) this.flip = c < 0;
    const sx = this.flip ? -1 : 1;
    const k = 1 / RES;
    const run = anim === "run" || anim === "walk";
    const ph = run ? t * (anim === "run" ? 0.018 : 0.01) : 0;
    const pw = Math.min(1, t / Math.max(1, windup));
    const pa = Math.min(1, Math.max(0, (t - windup) / Math.max(1, active)));
    const pr = Math.min(1, Math.max(0, (t - windup - active) / Math.max(1, recovery)));
    const inWind = t < windup;
    const inAct = t >= windup && t < windup + active;
    const breathe = Math.sin(t / 600);

    // Defaults: standing, wings folded, head raised on the neck.
    let lift = 0;
    let bodyRot = 0;
    let neckRot = -0.55 + Math.sin(face) * 0.3 + breathe * 0.03;
    let headRot = 0.35;
    let jawOpen = 0.05;
    let wingRot = -0.25 + breathe * 0.04;
    let wingSpread = 0.55;
    let flap = 0;
    let tailRot = 0.25 + Math.sin(t / 420) * 0.12;
    let tailCurl = 0.2 + Math.sin(t / 300) * 0.15;
    let crouch = 0;
    switch (anim) {
      case "bite":
        neckRot = inWind ? -0.9 * pw - 0.2 : inAct ? 0.05 : -0.2 - 0.35 * pr;
        headRot = inWind ? 0.5 : 0.1;
        jawOpen = inWind ? 0.5 * pw : inAct ? 0.1 : 0.05;
        crouch = inWind ? 2 * pw : 0;
        break;
      case "breath":
        // Rear back, then pour fire forward with the jaws wide.
        neckRot = inWind ? -0.55 - 0.6 * pw : inAct ? -0.15 + Math.sin(pa * Math.PI * 3) * 0.08 : -0.5;
        headRot = inWind ? 0.6 : 0.05;
        jawOpen = inWind ? 0.25 * pw : inAct ? 0.75 : 0.1;
        wingSpread = inWind || inAct ? 0.75 : 0.55;
        wingRot = -0.5;
        break;
      case "tail":
        bodyRot = inWind ? 0.06 * pw : inAct ? -0.08 : 0;
        tailRot = inWind ? -0.4 * pw + 0.25 : inAct ? 0.25 + Math.sin(pa * Math.PI) * 1.4 : 0.25;
        tailCurl = inAct ? -0.6 : 0.3;
        neckRot = -0.7;
        break;
      case "wing":
        wingSpread = inWind ? 0.55 + 0.45 * pw : 1;
        wingRot = inWind ? -0.25 - 0.9 * pw : inAct ? -1.15 + Math.sin(pa * Math.PI) * 1.4 : -1.15 + pr * 0.9;
        flap = inAct ? Math.sin(pa * Math.PI) : 0;
        lift = inAct ? -Math.sin(pa * Math.PI) * 6 : 0;
        neckRot = -0.9;
        break;
      case "dive":
        wingSpread = 1;
        if (inWind) {
          crouch = 3 * pw;
          wingRot = -0.25 - 1.0 * pw;
          lift = -8 * pw;
          flap = Math.sin(t / 60) * 0.5;
        } else if (inAct) {
          lift = -8 - Math.sin(pa * Math.PI) * 26;
          wingRot = -1.25 + Math.sin(pa * Math.PI * 4) * 0.5;
          flap = Math.abs(Math.sin(pa * Math.PI * 4));
          bodyRot = 0.18;
          neckRot = 0.05;
          jawOpen = 0.45;
        } else {
          lift = -8 * (1 - pr);
          wingRot = -1.25 + pr;
          wingSpread = 1 - 0.45 * pr;
        }
        break;
      case "roar":
        neckRot = inWind ? -0.6 - 0.7 * pw : -1.3;
        headRot = inWind ? 0.35 - 0.6 * pw : -0.25;
        jawOpen = inWind ? 0.3 + 0.5 * pw : 0.8;
        wingSpread = inWind ? 0.55 + 0.45 * pw : 1;
        wingRot = inWind ? -0.25 - 0.8 * pw : -1.05 + Math.sin(t / 90) * 0.12;
        break;
      case "hurt":
        bodyRot = -0.08;
        neckRot = -0.2;
        headRot = 0.5;
        jawOpen = 0.35;
        break;
      case "dead": {
        const d = Math.min(1, t / 700);
        bodyRot = 0.05 * d;
        neckRot = -0.55 + 1.0 * d;
        headRot = 0.35 + 0.4 * d;
        jawOpen = 0.3 * d;
        wingRot = -0.25 + 0.55 * d;
        wingSpread = 0.55 + 0.2 * d;
        crouch = 6 * d;
        tailRot = 0.25 + 0.2 * d;
        break;
      }
    }
    const bob = run ? -Math.abs(Math.sin(ph)) * 1.6 : breathe * 0.6;
    const by = -21 + bob + lift + crouch;
    this.body.setPosition(0, by).setScale(k * sx, k).setRotation(bodyRot * sx);
    // The neck grows from the chest; the head sits at its end.
    const nx = 15;
    const ny = by - 6;
    this.neck.setPosition(nx * sx, ny).setScale(k * sx, k).setRotation(neckRot * sx);
    const nl = 17;
    const hx = nx + Math.cos(neckRot) * nl;
    const hy = ny + Math.sin(neckRot) * nl;
    const hr = neckRot + headRot;
    this.head.setPosition(hx * sx, hy).setScale(k * sx, k).setRotation(hr * sx);
    this.jaw.setPosition((hx + Math.cos(hr + 0.5) * 3) * sx, hy + Math.sin(hr + 0.5) * 3).setScale(k * sx, k).setRotation((hr + jawOpen) * sx);
    this.mouth.x = (hx + Math.cos(hr) * 25) * sx * this.size;
    this.mouth.y = (hy + Math.sin(hr) * 25 + 3) * this.size;
    this.mouth.open = jawOpen;
    // Tail: root from the hip, tip from the root's end.
    const tx = -16;
    const ty = by + 2;
    this.tail1.setPosition(tx * sx, ty).setScale(k * sx, k).setRotation(-tailRot * sx);
    const tl = 22;
    const t2x = tx - Math.cos(tailRot) * tl;
    const t2y = ty + Math.sin(tailRot) * tl;
    this.tail2.setPosition(t2x * sx, t2y).setScale(k * sx, k).setRotation(-(tailRot + tailCurl) * sx);
    // Wings: folded along the back, or spread and beating.
    const wy = by - 6;
    const ws = k * (0.55 + 0.45 * wingSpread);
    this.wingFar.setPosition(6 * sx, wy - 1).setScale(ws * sx * 0.92, ws * (1 - flap * 0.35)).setRotation((wingRot - 0.12) * sx);
    this.wingNear.setPosition(2 * sx, wy).setScale(ws * sx, ws * (1 - flap * 0.45)).setRotation(wingRot * sx);
    const legX = [-13, -9, 9, 13];
    this.legs.forEach((leg, i) => {
      const swing = run ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 3 : 0;
      const tuck = lift < -4 ? 0.9 * sx * (i > 1 ? -1 : 1) : 0;
      leg.setPosition((legX[i] + swing) * sx, by + 6).setScale(k * sx, k * (lift < -4 ? 0.8 : 1)).setRotation(tuck);
    });
    const sh = 1 + lift / 50;
    this.shadow.setScale(k * 2.2 * sh, k * 1.2 * sh);
    this.root.setAlpha(alpha);
  }

  destroy() {
    this.root.destroy();
  }
}
