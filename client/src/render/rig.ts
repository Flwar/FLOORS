import * as Phaser from "phaser";
import { hasCape, paintCharacter, paintShield, paintWeapon, paintWolf, RES, type CharLook, type View, type WeaponArt } from "../art/characters.ts";

/** Everything a clip controls. Poses blend numerically, so transitions never snap. */
export interface Pose {
  bob: number;
  lift: number;
  lean: number;
  tilt: number;
  step: number;
  stepAmp: number;
  /** Weapon angle in world space (radians). */
  wAngle: number;
  /** Distance of the weapon hand from the shoulder. */
  wReach: number;
  offArm: number;
  sx: number;
  sy: number;
  alpha: number;
  /** Facing used to pick the view (radians). */
  face: number;
  /** 0 standing … 1 seated: the body settles and the legs fold forward. */
  sit: number;
}

/** Arm length when the weapon hangs at rest. */
export const REST_REACH = 9;

/**
 * Resting weapon angle: the arm hangs down and the blade points down and slightly out
 * (to the weapon hand's side, or forward in profile), like a sword held loosely at the hip.
 */
export function restAngle(face: number): number {
  const { view, flip } = viewFor(face);
  if (view === "front") return Math.PI / 2 + 0.4;
  if (view === "back") return Math.PI / 2 - 0.4;
  return flip ? Math.PI / 2 + 0.75 : Math.PI / 2 - 0.75;
}

export const restPose = (face: number): Pose => ({
  bob: 0, lift: 0, lean: 0, tilt: 0, step: 0, stepAmp: 0, wAngle: restAngle(face), wReach: REST_REACH, offArm: 0, sx: 1, sy: 1, alpha: 1, face, sit: 0,
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function blendPose(a: Pose, b: Pose, t: number, out: Pose): Pose {
  // Never let a bad value stick: a NaN in the source pose would poison every later blend.
  for (const k of Object.keys(a) as (keyof Pose)[]) if (!Number.isFinite(a[k])) a[k] = b[k];
  for (const k of Object.keys(b) as (keyof Pose)[]) if (!Number.isFinite(b[k])) b[k] = k === "alpha" || k === "sx" || k === "sy" ? 1 : 0;
  out.bob = lerp(a.bob, b.bob, t);
  out.lift = lerp(a.lift, b.lift, t);
  out.lean = lerp(a.lean, b.lean, t);
  out.tilt = lerp(a.tilt, b.tilt, t);
  out.step = b.step;
  out.stepAmp = lerp(a.stepAmp, b.stepAmp, t);
  out.wAngle = lerpAngle(a.wAngle, b.wAngle, t);
  out.wReach = lerp(a.wReach, b.wReach, t);
  out.offArm = lerp(a.offArm, b.offArm, t);
  out.sx = lerp(a.sx, b.sx, t);
  out.sy = lerp(a.sy, b.sy, t);
  out.alpha = lerp(a.alpha, b.alpha, t);
  out.face = lerpAngle(a.face, b.face, t);
  out.sit = lerp(a.sit ?? 0, b.sit ?? 0, t);
  return out;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export interface ClipTiming {
  startup: number;
  active: number;
  recovery: number;
}

/**
 * Pose for an attack/skill clip at `t` ms into the move. Swings are keyed to the
 * move's own frame data so the blade crosses the target exactly on active frames.
 */
export function attackPose(anim: string, t: number, tm: ClipTiming, aim: number, out: Pose): Pose {
  const S = tm.startup;
  const A = tm.active;
  const R = tm.recovery;
  const inWind = t < S;
  const inActive = t >= S && t < S + A;
  const pw = clamp01(t / Math.max(1, S));
  const pa = clamp01((t - S) / Math.max(1, A));
  const pr = clamp01((t - S - A) / Math.max(1, R));
  Object.assign(out, restPose(aim));
  out.face = aim;
  const rest = out.wAngle;

  const swing = (from: number, to: number, reachA: number, reachB: number, leanA: number) => {
    if (inWind) {
      out.wAngle = lerpAngle(rest, aim + from, easeOut(pw));
      out.wReach = lerp(REST_REACH, reachA, pw);
      out.lean = -1.5 * pw;
      out.tilt = from * 0.05 * pw;
    } else if (inActive) {
      out.wAngle = aim + lerp(from, to, easeOut3(pa));
      out.wReach = reachB;
      out.lean = leanA;
      out.tilt = to * 0.06;
    } else {
      out.wAngle = lerpAngle(aim + to, rest, easeInOut(pr));
      out.wReach = lerp(reachB, REST_REACH, pr);
      out.lean = leanA * (1 - pr);
      out.tilt = to * 0.06 * (1 - pr);
    }
  };

  switch (anim) {
    case "slashR":
      swing(-1.9, 1.5, 9, 13, 3);
      break;
    case "slashL":
      swing(1.7, -1.6, 9, 13, 3);
      break;
    case "heavySlash":
    case "bigSlashR":
      swing(-2.5, 1.9, 8, 15, 4);
      if (inActive) out.sy = 0.94;
      break;
    case "bigSlashL":
      swing(2.4, -2.0, 8, 15, 4);
      if (inActive) out.sy = 0.94;
      break;
    case "sweep":
      swing(-2.3, 2.3, 10, 16, 2);
      out.sy = inActive ? 0.9 : out.sy;
      break;
    case "stabR":
    case "stabL":
    case "thrust":
    case "charge": {
      const side = anim === "stabL" ? 0.35 : anim === "stabR" ? -0.35 : 0;
      out.wAngle = aim + side;
      if (inWind) {
        out.wReach = lerp(7, 3, easeOut(pw));
        out.lean = -2 * pw;
        out.offArm = -0.6 * pw;
      } else if (inActive) {
        out.wReach = anim === "charge" ? 18 : 22;
        out.lean = anim === "charge" ? 6 : 5;
        out.sx = 1.06;
        out.sy = 0.95;
      } else {
        out.wReach = lerp(22, 8, easeInOut(pr));
        out.lean = 5 * (1 - pr);
      }
      if (anim === "charge") out.lean += 3;
      break;
    }
    case "overhead":
    case "leap": {
      const up = -Math.PI / 2;
      if (inWind) {
        out.wAngle = lerpAngle(rest, up - 0.3, easeOut(pw));
        out.wReach = lerp(7, 12, pw);
        out.lean = -3 * pw;
        out.sy = 1 + 0.06 * pw;
        if (anim === "leap") out.lift = -Math.sin(pw * Math.PI * 0.95) * 26;
      } else if (inActive) {
        out.wAngle = lerpAngle(up - 0.3, aim + 0.2, easeOut3(clamp01(pa * 2)));
        out.wReach = 16;
        out.lean = 5;
        out.sy = 0.86;
        out.sx = 1.1;
      } else {
        out.wAngle = lerpAngle(aim + 0.2, rest, easeInOut(pr));
        out.wReach = lerp(16, 7, pr);
        out.lean = 5 * (1 - pr);
        out.sy = lerp(0.9, 1, pr);
      }
      break;
    }
    case "spin":
      if (inWind) {
        out.wAngle = lerpAngle(rest, aim - 1.5, easeOut(pw));
        out.wReach = 10;
        out.sy = 0.95;
      } else if (inActive) {
        out.wAngle = aim - 1.5 + Math.PI * 2 * easeOut(pa);
        out.wReach = 15;
        out.tilt = Math.sin(pa * Math.PI * 2) * 0.12;
      } else {
        out.wAngle = lerpAngle(aim - 1.5, rest, easeInOut(pr));
        out.wReach = lerp(15, 7, pr);
      }
      break;
    case "cast":
    case "throw":
      out.wAngle = lerpAngle(aim - 1.2, aim, easeOut(pw));
      out.wReach = inWind ? lerp(7, 5, pw) : inActive ? 16 : lerp(16, 8, pr);
      out.lean = inActive ? 3 : inWind ? -1 : 3 * (1 - pr);
      break;
    case "nova":
    case "roar":
    case "howl":
    case "channel": {
      const up = -Math.PI / 2;
      if (inWind) {
        out.wAngle = lerpAngle(rest, up, easeOut(pw));
        out.wReach = 12;
        out.sy = 1 + 0.08 * pw;
        out.offArm = -2.4 * pw;
      } else {
        const k = inActive ? 1 : 1 - pr;
        out.wAngle = up;
        out.wReach = 12;
        out.sy = inActive ? 0.9 : lerp(0.9, 1, pr);
        out.sx = inActive ? 1.1 : lerp(1.1, 1, pr);
        out.offArm = -2.4 * k;
      }
      if (anim === "channel") out.bob = Math.sin(t / 60) * 1.2;
      break;
    }
    case "stance":
      out.wAngle = aim - 1.3;
      out.wReach = 9;
      out.sy = 0.93;
      out.lean = -1;
      break;
    case "bash":
      out.wAngle = aim + 1.2;
      out.offArm = inWind ? -0.4 * pw : inActive ? 1.2 : 1.2 * (1 - pr);
      out.lean = inActive ? 6 : inWind ? -2 * pw : 6 * (1 - pr);
      break;
    case "bow":
      out.wAngle = aim;
      out.wReach = 11;
      out.offArm = inWind ? -1.5 * easeOut(pw) : 0;
      out.lean = inActive ? -2 : 0;
      break;
    case "vanish":
    case "twin":
      if (anim === "vanish") {
        out.alpha = inWind ? 1 - pw : inActive ? 0.1 : pr;
        out.sy = inWind ? 1 - 0.2 * pw : 1;
      } else swing(-1.6, 1.6, 9, 12, 3);
      break;
    case "stomp":
      out.lift = inWind ? -10 * easeOut(pw) : 0;
      out.sy = inActive ? 0.84 : 1;
      out.sx = inActive ? 1.14 : 1;
      break;
    default:
      swing(-1.6, 1.4, 9, 12, 3);
  }
  return out;
}

export function locomotionPose(face: number, gait: number, clock: number, out: Pose): Pose {
  Object.assign(out, restPose(face));
  if (gait === 0) {
    out.bob = Math.sin(clock / 420) * 0.6;
    out.sy = 1 + Math.sin(clock / 420) * 0.012;
    out.wAngle = restAngle(face) + Math.sin(clock / 420) * 0.04;
    return out;
  }
  const rate = gait === 2 ? 0.019 : 0.0125;
  out.step = clock * rate;
  out.stepAmp = 1;
  out.bob = -Math.abs(Math.sin(out.step)) * (gait === 2 ? 2.2 : 1.4);
  out.lean = gait === 2 ? 2.5 : 0.8;
  out.tilt = gait === 2 ? 0.05 * Math.cos(face) : 0;
  out.wAngle = restAngle(face) + Math.sin(out.step) * (gait === 2 ? 0.2 : 0.12);
  out.offArm = Math.sin(out.step) * 0.5;
  return out;
}

// ---------------------------------------------------------------------------

export function viewFor(face: number): { view: View; flip: boolean } {
  const s = Math.sin(face);
  if (s > 0.55) return { view: "front", flip: false };
  if (s < -0.55) return { view: "back", flip: false };
  return { view: "side", flip: Math.cos(face) < 0 };
}

/**
 * Paper-doll humanoid: legs + an upper-body container (torso, head, arms, weapon,
 * shield) re-layered each frame so the weapon passes correctly in front of or
 * behind the body.
 */
export class HumanoidRig {
  readonly root: Phaser.GameObjects.Container;
  private upper: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Image;
  private legL: Phaser.GameObjects.Image;
  private legR: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private armW: Phaser.GameObjects.Image;
  private armO: Phaser.GameObjects.Image;
  private weapon: Phaser.GameObjects.Image;
  private shield?: Phaser.GameObjects.Image;
  /** Cape: behind the legs when seen from the front or side, over the back when seen from behind. */
  private cape?: Phaser.GameObjects.Image;
  private weaponArt: WeaponArt = "none";
  private weaponOx = 0.2;
  private weaponRarity = -1;
  private images: Phaser.GameObjects.Image[];
  private flashUntil = 0;
  private view: View = "front";
  readonly look: CharLook;

  constructor(private scene: Phaser.Scene, look: CharLook, weapon: WeaponArt, rarity: number, scale: number, shield?: { color: string; trim: string }) {
    this.look = look;
    paintCharacter(scene, look);
    const k = 1 / RES;
    this.shadow = scene.add.image(0, 0, "shadow").setScale(k * look.bulk);
    this.legL = scene.add.image(-3.5, -7, `${look.key}:leg`).setOrigin(0.5, 0).setScale(k);
    this.legR = scene.add.image(3.5, -7, `${look.key}:leg`).setOrigin(0.5, 0).setScale(k);
    this.torso = scene.add.image(0, -13, `${look.key}:torso:front`).setScale(k);
    this.head = scene.add.image(0, -26, `${look.key}:head:front`).setScale(k);
    this.armW = scene.add.image(0, 0, `${look.key}:arm`).setOrigin(0.5, 0.08).setScale(k);
    this.armO = scene.add.image(0, 0, `${look.key}:arm`).setOrigin(0.5, 0.08).setScale(k);
    this.weapon = scene.add.image(0, 0, "__DEFAULT").setScale(k);
    if (shield) this.shield = scene.add.image(0, 0, paintShield(scene, shield.color, shield.trim)).setScale(k);
    this.upper = scene.add.container(0, 0, [this.armO, this.torso, this.head, this.armW, this.weapon]);
    if (this.shield) this.upper.add(this.shield);
    this.root = scene.add.container(0, 0, [this.shadow, this.legL, this.legR, this.upper]);
    this.root.setScale(scale);
    this.images = [this.legL, this.legR, this.torso, this.head, this.armW, this.armO, this.weapon];
    if (this.shield) this.images.push(this.shield);
    if (hasCape(look)) {
      this.cape = scene.add.image(0, -20, `${look.key}:cape:front`).setOrigin(0.5, 0.05).setScale(k);
      this.root.addAt(this.cape, 1);
      this.images.push(this.cape);
    }
    this.setWeapon(weapon, rarity);
  }

  setWeapon(kind: WeaponArt, rarity: number) {
    if (kind === this.weaponArt && rarity === this.weaponRarity) return;
    this.weaponRarity = rarity;
    this.weaponArt = kind;
    const { key, ox } = paintWeapon(this.scene, kind, rarity);
    this.weapon.setTexture(key).setOrigin(ox, 0.5).setVisible(kind !== "none");
    this.weaponOx = ox;
  }

  get weaponKind() {
    return this.weaponArt;
  }

  flash(ms = 80) {
    this.flashUntil = this.scene.time.now + ms;
    for (const im of this.images) im.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  /** World position of the weapon tip (for trails and sparks), relative to the root. */
  tip(p: Pose): { x: number; y: number } {
    const sh = this.shoulder(p);
    const len = (this.weapon.width * (1 - this.weaponOx)) / RES;
    const hx = sh.x + Math.cos(p.wAngle) * p.wReach;
    const hy = sh.y + Math.sin(p.wAngle) * p.wReach * 0.8;
    const s = this.root.scaleX;
    return { x: (hx + Math.cos(p.wAngle) * len) * s, y: (hy + Math.sin(p.wAngle) * len * 0.8) * s + p.lift * s };
  }

  private shoulder(p: Pose) {
    const { view, flip } = viewFor(p.face);
    const lean = { x: Math.cos(p.face) * p.lean, y: Math.sin(p.face) * p.lean * 0.6 };
    const sx = view === "front" ? -6.5 : view === "back" ? 6.5 : flip ? -2 : 2;
    return { x: sx * this.look.bulk + lean.x, y: -17 + p.bob + lean.y };
  }

  apply(p: Pose) {
    const now = this.scene.time.now;
    if (this.flashUntil && now > this.flashUntil) {
      this.flashUntil = 0;
      for (const im of this.images) im.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
    const { view, flip } = viewFor(p.face);
    const look = this.look;
    if (view !== this.view) {
      this.view = view;
      this.torso.setTexture(`${look.key}:torso:${view}`);
      this.head.setTexture(`${look.key}:head:${view}`);
      this.cape?.setTexture(`${look.key}:cape:${view}`);
    }
    this.torso.setFlipX(flip);
    this.head.setFlipX(flip);

    const lean = { x: Math.cos(p.face) * p.lean, y: Math.sin(p.face) * p.lean * 0.6 };
    this.upper.setPosition(lean.x, p.bob + lean.y + p.lift);
    this.upper.setRotation(p.tilt);
    this.upper.setScale(p.sx, p.sy);
    this.shadow.setScale((1 / RES) * look.bulk * (1 + p.lift / 80), (1 / RES) * look.bulk * (1 + p.lift / 80));
    this.shadow.setAlpha(p.alpha);

    // Legs step along the facing direction.
    const stepX = Math.cos(p.face) * 2.2 * p.stepAmp;
    const stepY = Math.sin(p.face) * 1.4 * p.stepAmp;
    const s1 = Math.sin(p.step);
    const legSpread = view === "side" ? 1.5 : 3.5 * look.bulk;
    this.legL.setPosition(-legSpread + stepX * s1 + lean.x * 0.3, -7 + stepY * s1 - Math.max(0, s1) * 1.5 * p.stepAmp + p.lift);
    this.legR.setPosition(legSpread - stepX * s1 + lean.x * 0.3, -7 - stepY * s1 - Math.max(0, -s1) * 1.5 * p.stepAmp + p.lift);
    // Sitting: the body settles, and the legs fold toward the facing (in profile) or
    // foreshorten toward the camera (front and back).
    const k = 1 / RES;
    const sit = p.sit ?? 0;
    if (sit > 0.01) {
      const drop = 5 * sit;
      this.upper.y += drop;
      const dir = Math.cos(p.face) >= 0 ? 1 : -1;
      for (const leg of [this.legL, this.legR]) {
        if (view === "side") leg.setRotation(-dir * 1.45 * sit).setScale(k, k);
        else leg.setRotation(0).setScale(k, k * (1 - (view === "front" ? 0.5 : 0.62) * sit));
        leg.y += drop * 0.85;
      }
    } else {
      this.legL.setRotation(0).setScale(k, k);
      this.legR.setRotation(0).setScale(k, k);
    }
    for (const im of this.images) im.setAlpha(p.alpha);

    this.torso.setPosition(0, -13);
    this.head.setPosition(0, -26 + Math.sin(p.step * 2) * 0.3 * p.stepAmp);

    // Weapon arm from shoulder to hand; weapon extends from the hand.
    const sh = { x: (view === "front" ? -6.5 : view === "back" ? 6.5 : flip ? -2 : 2) * look.bulk, y: -17 };
    const hx = sh.x + Math.cos(p.wAngle) * p.wReach;
    const hy = sh.y + Math.sin(p.wAngle) * p.wReach * 0.8;
    const armAng = Math.atan2(hy - sh.y, hx - sh.x) - Math.PI / 2;
    const armLen = Math.hypot(hx - sh.x, hy - sh.y);
    this.armW.setPosition(sh.x, sh.y).setRotation(armAng).setScale(1 / RES, (1 / RES) * Phaser.Math.Clamp(armLen / 10, 0.6, 1.5));
    this.weapon.setPosition(hx, hy).setRotation(p.wAngle);
    this.weapon.setScale((1 / RES) * (0.9 + 0.1 * Math.abs(Math.cos(p.wAngle))), (1 / RES) * (this.weaponArt === "bow" ? 1 : 0.9));

    const ox = { x: (view === "front" ? 6.5 : view === "back" ? -6.5 : flip ? 3 : -3) * look.bulk, y: -17 };
    this.armO.setPosition(ox.x, ox.y).setRotation(p.offArm * (flip ? -1 : 1) + (view === "side" ? 0 : Math.sign(ox.x) * -0.15));
    if (this.shield) {
      const f = p.face;
      const out = view === "back" ? 2 : 7 + Math.max(0, p.offArm) * 6;
      this.shield.setPosition(ox.x + Math.cos(f) * out * 0.6, ox.y + 5 + Math.sin(f) * out * 0.4);
      this.shield.setFlipX(flip);
    }

    // Layering: weapon behind the body when it points away from the camera.
    const pointsUp = Math.sin(p.wAngle) < -0.25;
    const behind = view === "back" ? !(Math.sin(p.wAngle) > 0.4) : pointsUp;
    const order: Phaser.GameObjects.GameObject[] = [];
    if (behind) order.push(this.weapon, this.armW);
    if (view === "back" && this.shield) order.push(this.shield);
    order.push(this.armO, this.torso, this.head);
    if (!behind) order.push(this.armW, this.weapon);
    if (view !== "back" && this.shield) order.push(this.shield);
    const cape = this.cape;
    if (cape) {
      // Swing back while moving, sway a little with each step.
      const trail = view === "side" ? (flip ? -1 : 1) * 0.28 * p.stepAmp : 0;
      cape.setRotation(trail + Math.sin(p.step) * 0.035 * p.stepAmp - p.tilt * 0.5);
      cape.setFlipX(flip);
      cape.setScale(1 / RES, (1 / RES) * (view === "back" ? 1 - 0.05 * p.stepAmp : 1));
      const sideX = view === "side" ? (flip ? 3 : -3) : 0;
      if (view === "back") {
        if (cape.parentContainer === this.root) this.root.remove(cape);
        cape.setPosition(sideX, -20);
        order.splice(order.indexOf(this.head), 0, cape);
      } else {
        if (cape.parentContainer !== this.root) {
          this.upper.remove(cape);
          this.root.addAt(cape, 1);
        }
        cape.setPosition(this.upper.x + sideX, this.upper.y - 20);
      }
    }
    this.upper.removeAll(false);
    this.upper.add(order);
  }

  destroy() {
    this.root.destroy();
  }
}

/** Quadruped rig for wolves. Seen from the side; flips to face left/right. */
export class WolfRig {
  readonly root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private tail: Phaser.GameObjects.Image;
  private legs: Phaser.GameObjects.Image[];
  private shadow: Phaser.GameObjects.Image;
  private flip = false;
  private flashUntil = 0;
  private images: Phaser.GameObjects.Image[];

  constructor(private scene: Phaser.Scene, key: string, fur: string, dark: string, belly: string, eye: string, scale: number) {
    paintWolf(scene, key, fur, dark, belly, eye);
    const k = 1 / RES;
    this.shadow = scene.add.image(0, 0, "shadow").setScale(k * 1.3, k);
    this.legs = [0, 1, 2, 3].map(() => scene.add.image(0, 0, `${key}:leg`).setOrigin(0.5, 0).setScale(k));
    this.body = scene.add.image(0, -12, `${key}:body`).setScale(k);
    this.head = scene.add.image(10, -17, `${key}:head`).setOrigin(0.35, 0.55).setScale(k);
    this.tail = scene.add.image(-12, -15, `${key}:tail`).setOrigin(0.95, 0.5).setScale(k);
    this.root = scene.add.container(0, 0, [this.shadow, this.legs[0], this.legs[2], this.tail, this.body, this.legs[1], this.legs[3], this.head]);
    this.root.setScale(scale);
    this.images = [...this.legs, this.body, this.head, this.tail];
  }

  flash(ms = 80) {
    this.flashUntil = this.scene.time.now + ms;
    for (const im of this.images) im.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  /** anim: idle | walk | run | bite | pounce | howl | hurt | dead. t in ms, p = normalized clip progress for attacks. */
  apply(anim: string, t: number, face: number, windup: number, active: number, recovery: number, alpha: number) {
    if (this.flashUntil && this.scene.time.now > this.flashUntil) {
      this.flashUntil = 0;
      for (const im of this.images) im.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
    const c = Math.cos(face);
    if (Math.abs(c) > 0.2) this.flip = c < 0;
    const sx = this.flip ? -1 : 1;
    const run = anim === "run" || anim === "walk";
    const rate = anim === "run" ? 0.022 : 0.012;
    const ph = run ? t * rate : 0;
    let lift = 0;
    let stretch = 1;
    let headX = 10;
    let headY = -17;
    let headRot = Math.sin(face) * 0.25;
    let bodyRot = 0;
    const pw = Math.min(1, t / Math.max(1, windup));
    const pa = Math.min(1, Math.max(0, (t - windup) / Math.max(1, active)));
    const inWind = t < windup;
    const inAct = t >= windup && t < windup + active;
    switch (anim) {
      case "bite":
        headX = inWind ? 10 - 4 * pw : inAct ? 16 : 10;
        headRot += inWind ? -0.3 * pw : inAct ? 0.2 : 0;
        bodyRot = inWind ? -0.08 * pw : 0;
        break;
      case "pounce":
        if (inWind) {
          bodyRot = -0.15 * pw;
          stretch = 1 - 0.12 * pw;
        } else if (inAct) {
          lift = -Math.sin(pa * Math.PI) * 18;
          stretch = 1.25;
          headX = 14;
        }
        break;
      case "howl":
        headRot = -0.9 * (inWind ? pw : 1);
        headY = -20;
        break;
      case "hurt":
        bodyRot = 0.15;
        headRot = 0.3;
        break;
      case "dead":
        bodyRot = 0;
        this.root.setRotation(0);
        break;
    }
    void recovery;
    const bob = run ? -Math.abs(Math.sin(ph)) * 2 : Math.sin(t / 500) * 0.5;
    this.body.setPosition(0, -12 + bob + lift).setScale((1 / RES) * stretch * sx, (1 / RES) * (anim === "dead" ? 0.8 : 1)).setRotation(bodyRot * sx);
    this.head.setPosition(headX * stretch * sx, headY + bob + lift).setScale((1 / RES) * sx, 1 / RES).setRotation(headRot * sx);
    this.tail.setPosition(-12 * stretch * sx, -15 + bob + lift).setScale((1 / RES) * sx, 1 / RES).setRotation((Math.sin(t / 180) * 0.25 + (run ? -0.2 : 0.1)) * sx);
    const legX = [-9, -7, 8, 10];
    this.legs.forEach((leg, i) => {
      const swing = run ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 3.5 : 0;
      leg.setPosition((legX[i] * stretch + swing) * sx, -6 + lift * 0.7).setRotation(anim === "pounce" && inAct ? 0.6 * sx * (i > 1 ? -1 : 1) : 0);
    });
    this.shadow.setScale((1 / RES) * 1.3 * (1 + lift / 60), (1 / RES) * (1 + lift / 60));
    for (const im of this.images) im.setAlpha(alpha);
    if (anim === "dead") {
      this.root.setAlpha(alpha);
      this.body.setRotation(Math.PI / 2 * 0.0);
    }
  }

  destroy() {
    this.root.destroy();
  }
}
