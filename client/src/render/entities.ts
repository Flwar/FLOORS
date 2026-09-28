import * as Phaser from "phaser";
import {
  Act, aimToRad, attackTicks, EAct, EFlag, EMOTE_MS, EMOTES, ENEMIES, getMove, Sit, TICK_MS, weaponArt, WEAPONS, windupTicks, type Emote, type EnemyDef, type PlayerSim,
} from "@floors/shared";
import type { Enemy, Player } from "../../../server/src/state.ts";
import { paintDummy, RES, shade, type CharLook, type WeaponArt } from "../art/characters.ts";
import { personLook } from "../art/looks.ts";
import { attackPose, blendPose, HumanoidRig, locomotionPose, restAngle, restPose, WolfRig, type Pose } from "./rig.ts";
import { DragonRig } from "./dragon.ts";


/** Knock-back on hit, purely visual: a damped spring that shoves the body away from the blow. */
export class Recoil {
  x = 0;
  y = 0;
  private vx = 0;
  private vy = 0;
  kick(angle: number, px: number) {
    this.vx += Math.cos(angle) * px * 34;
    this.vy += Math.sin(angle) * px * 26;
  }
  update(dtMs: number) {
    const dt = Math.min(0.05, dtMs / 1000);
    this.vx += (-this.x * 340 - this.vx * 20) * dt;
    this.vy += (-this.y * 340 - this.vy * 20) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

/** Animation clock that can be slowed for hitstop and then catches back up. */
class AnimClock {
  lag = 0;
  private holdUntil = 0;
  hold(ms: number) {
    this.holdUntil = Math.max(this.holdUntil, performance.now() + ms);
  }
  update(dtMs: number) {
    if (performance.now() < this.holdUntil) this.lag += dtMs * 0.92;
    else if (this.lag > 0) this.lag = Math.max(0, this.lag - dtMs * 0.6);
  }
}

export function playerLook(p: Player): CharLook {
  return personLook(p.hue, p.armorLook, p.helmLook);
}

/** The exact weapon the player holds (each item has its own art). */
export function playerWeapon(p: Player): WeaponArt {
  return weaponArt(p.weaponLook);
}

export function enemyLook(def: EnemyDef): CharLook {
  const l = def.look;
  return {
    key: `e:${def.key}`,
    skin: l.skin,
    hair: shade(l.cloth, -30),
    cloth: l.cloth,
    trim: l.trim,
    helm: l.rig === "construct" ? "crown" : l.horns ? "horns" : l.hood ? "hood" : def.boss ? "helm" : "none",
    ears: l.ears,
    bulk: l.rig === "construct" ? 1.25 : def.behavior === "brute" ? 1.3 : 1,
    glow: l.glow,
  };
}

/** Emote poses, `t` ms in. */
function emotePose(e: Emote, t: number, face: number, out: Pose) {
  Object.assign(out, restPose(face));
  switch (e) {
    case "wave":
      out.offArm = -2.7 + Math.sin(t / 140) * 0.35;
      out.bob = Math.sin(t / 300) * 0.4;
      break;
    case "cheer":
      out.offArm = -2.9;
      out.wAngle = -Math.PI / 2;
      out.wReach = 12;
      out.lift = -Math.abs(Math.sin(t / 190)) * 6;
      break;
    case "dance":
      out.face = face + Math.floor(t / 360) * (Math.PI / 2);
      out.tilt = Math.sin(t / 180) * 0.22;
      out.step = t * 0.02;
      out.stepAmp = 1;
      out.bob = -Math.abs(Math.sin(t / 180)) * 2.2;
      out.offArm = Math.sin(t / 180) * 1.2 - 1.2;
      break;
    case "bow": {
      const k = t < 300 ? t / 300 : t > EMOTE_MS - 400 ? Math.max(0, (EMOTE_MS - t) / 400) : 1;
      out.lean = 4 * k;
      out.sy = 1 - 0.12 * k;
      out.offArm = 0.5 * k;
      break;
    }
    case "laugh":
      out.bob = Math.sin(t / 60) * 1.1;
      out.sy = 1 + Math.sin(t / 60) * 0.03;
      out.tilt = Math.sin(t / 110) * 0.07;
      out.offArm = -0.6;
      break;
  }
}

export class PlayerView {
  readonly rig: HumanoidRig;
  readonly label: Phaser.GameObjects.Text;
  readonly clock = new AnimClock();
  readonly recoil = new Recoil();
  pose: Pose;
  private from: Pose;
  private blendStart = 0;
  private blendMs = 0;
  private clipKey = "";
  private scratch: Pose;
  private target: Pose;

  lastTip?: { x: number; y: number; a: number };
  private bubble?: { box: Phaser.GameObjects.Container; until: number };
  private emoteName?: Emote;
  private emoteUntil = 0;
  /** For remote players: local time an action was first seen, to derive animation time. */
  private seenSeq = -1;
  private seenAt = 0;
  private lookKey: string;
  stepPhase = 0;

  constructor(private scene: Phaser.Scene, p: Player, readonly isMe: boolean) {
    const look = playerLook(p);
    this.lookKey = look.key;
    this.rig = new HumanoidRig(scene, look, playerWeapon(p), p.weaponRarity, 1);
    this.label = scene.add
      .text(0, 0, p.name, { fontFamily: "Trebuchet MS", fontSize: "18px", color: isMe ? "#ffe9a8" : "#f4ecd8", stroke: "#1d1a17", strokeThickness: 4 })
      .setOrigin(0.5, 1)
      .setScale(0.5)
      // Your own name only clutters the space where combat text appears.
      .setVisible(!isMe);
    this.pose = restPose(Math.PI / 2);
    this.from = restPose(Math.PI / 2);
    this.scratch = restPose(Math.PI / 2);
    this.target = restPose(Math.PI / 2);
  }

  lookChanged(p: Player) {
    return playerLook(p).key !== this.lookKey;
  }

  /** Update from simulation state. `animMs` is ms into the current action. */
  update(p: Player, s: PlayerSim, x: number, y: number, dtMs: number, animMsOverride?: number) {
    this.rig.setWeapon(playerWeapon(p), p.weaponRarity);
    this.clock.update(dtMs);
    const now = performance.now();
    if (s.actSeq !== this.seenSeq) {
      this.seenSeq = s.actSeq;
      this.seenAt = now - s.actTick * TICK_MS;
    }
    const t = (animMsOverride ?? now - this.seenAt) - this.clock.lag;
    const face = s.act === Act.None || s.act === Act.Use ? (s.dir * Math.PI) / 4 : s.act === Act.Dodge ? Math.atan2(s.dodgeDy, s.dodgeDx) : aimToRad(s.actAim);

    let key: string;
    const tgt = this.target;
    switch (s.act) {
      case Act.Light:
      case Act.Heavy:
      case Act.Skill: {
        const m = getMove(s.weapon, s.actMove);
        key = `atk${s.actSeq}`;
        attackPose(m.anim, t, { startup: m.startup * TICK_MS, active: m.active * TICK_MS, recovery: m.recovery * TICK_MS }, aimToRad(s.actAim), tgt);
        break;
      }
      case Act.Dodge: {
        key = `dodge${s.actSeq}`;
        Object.assign(tgt, restPose(face));
        const d = WEAPONS[s.weapon].dodge;
        const k = Math.min(1, t / (d.ticks * TICK_MS));
        tgt.lean = 5 * (1 - k);
        tgt.sx = 1.12 - 0.12 * k;
        tgt.sy = 0.86 + 0.14 * k;
        tgt.wAngle = restAngle(face) + 0.3;
        tgt.alpha = t < d.iEnd * TICK_MS ? 0.75 : 1;
        tgt.tilt = 0.15 * Math.cos(face) * (1 - k);
        break;
      }
      case Act.Parry: {
        key = `parry${s.actSeq}`;
        Object.assign(tgt, restPose(face));
        const w = WEAPONS[s.weapon].parry.window * TICK_MS;
        const k = Math.min(1, t / 60);
        tgt.wAngle = face - 1.35 * k + (1 - k) * 1.1;
        tgt.wReach = 9 + 3 * k;
        tgt.sy = 0.94;
        tgt.lean = -1;
        if (s.parryOk) {
          tgt.wAngle = face + 0.6;
          tgt.lean = 3;
        } else if (t > w) {
          tgt.wAngle = face - 0.8;
          tgt.sy = 0.97;
        }
        break;
      }
      case Act.Hurt:
      case Act.Knockdown: {
        key = `hurt${s.actSeq}`;
        Object.assign(tgt, restPose(face));
        const down = s.act === Act.Knockdown;
        const back = Math.atan2(-s.kby, -s.kbx);
        tgt.tilt = down ? (Math.cos(back) >= 0 ? -1 : 1) * Math.min(1.3, t / 120) * (t > s.hurtDur * TICK_MS - 250 ? Math.max(0, (s.hurtDur * TICK_MS - t) / 250) : 1) : -0.25 * Math.sign(Math.cos(face) || 1);
        tgt.lean = -3;
        tgt.sy = down ? 0.85 : 0.94;
        tgt.wAngle = restAngle(face) + 0.25;
        break;
      }
      case Act.Dead:
        key = `dead${s.actSeq}`;
        Object.assign(tgt, restPose(face));
        tgt.tilt = 1.45;
        tgt.sy = 0.8;
        tgt.alpha = Math.max(0.35, 1 - t / 2500);
        break;
      case Act.Use:
        key = `use${s.actSeq}`;
        Object.assign(tgt, restPose(face));
        tgt.offArm = -2.6;
        tgt.bob = Math.sin(t / 90) * 0.6;
        break;
      default: {
        const still = s.gait === 0;
        if (!still) this.emoteUntil = 0;
        if (still && p.sit) {
          key = "sit";
          Object.assign(tgt, restPose(face));
          tgt.sit = 1;
          tgt.bob = Math.sin(now / 700) * 0.3;
          tgt.wAngle = restAngle(face) + 0.35;
          tgt.wReach = 7;
        } else if (still && this.emoteName && now < this.emoteUntil) {
          key = `emote-${this.emoteName}`;
          emotePose(this.emoteName, now - (this.emoteUntil - EMOTE_MS), face, tgt);
        } else {
          key = `loco${s.gait}`;
          this.stepPhase += dtMs;
          locomotionPose(face, s.gait, this.stepPhase, tgt);
        }
      }
    }

    if (key !== this.clipKey) {
      const locoToLoco = key.startsWith("loco") && this.clipKey.startsWith("loco");
      this.clipKey = key;
      Object.assign(this.from, this.pose);
      this.blendStart = now;
      this.blendMs = key.startsWith("atk") ? 45 : key.startsWith("dodge") ? 30 : locoToLoco ? 160 : 110;
    }
    const bt = this.blendMs > 0 ? Math.min(1, (now - this.blendStart) / this.blendMs) : 1;
    blendPose(this.from, tgt, bt, this.scratch);
    Object.assign(this.pose, this.scratch);
    this.rig.apply(this.pose);
    this.recoil.update(dtMs);
    // On a bench or logs, the body is drawn up on the seat; the feet stay on the ground in front.
    const seat = p.sit === Sit.Seat && s.gait === 0 && s.act === Act.None ? -12 : 0;
    this.rig.root.setPosition(x + this.recoil.x, y + seat + this.recoil.y).setDepth(y);
    this.label.setPosition(x, y - 40 + seat + this.pose.lift).setDepth(y + 0.5).setAlpha(s.act === Act.Dead ? 0.4 : 1);
    if (this.bubble) {
      const left = this.bubble.until - now;
      if (left <= 0) {
        this.bubble.box.destroy();
        this.bubble = undefined;
      } else this.bubble.box.setPosition(x, y + seat - (this.isMe ? 42 : 52) + this.pose.lift).setAlpha(Math.min(1, left / 400));
    }
  }

  /** A speech bubble over the head (what they said, or *waves* for an emote). */
  say(text: string, emote = false) {
    this.bubble?.box.destroy();
    const t = this.scene.add
      .text(0, -4, text, { fontFamily: "Trebuchet MS", fontSize: "20px", color: emote ? "#ffe9a8" : "#2a2118", fontStyle: emote ? "italic" : "normal", align: "center", wordWrap: { width: 320 } })
      .setOrigin(0.5, 1)
      .setScale(0.5);
    const w = t.displayWidth + 12;
    const h = t.displayHeight + 8;
    const g = this.scene.add.graphics();
    g.fillStyle(emote ? 0x2a2118 : 0xfff8e8, emote ? 0.88 : 0.96);
    g.lineStyle(1.5, 0x1d1a17, 1);
    g.fillRoundedRect(-w / 2, -h, w, h, 6);
    g.strokeRoundedRect(-w / 2, -h, w, h, 6);
    g.fillTriangle(-4.5, -0.8, 4.5, -0.8, 0, 5);
    g.lineBetween(-4.5, 0, 0, 5);
    g.lineBetween(4.5, 0, 0, 5);
    const box = this.scene.add.container(0, 0, [g, t]).setDepth(1e6 - 3);
    this.bubble = { box, until: performance.now() + Math.min(8000, 3000 + text.length * 60) };
  }

  emote(e: Emote) {
    this.emoteName = e;
    this.emoteUntil = performance.now() + EMOTE_MS;
    this.say(`*${EMOTES[e]}*`, true);
  }

  destroy() {
    this.rig.destroy();
    this.label.destroy();
    this.bubble?.box.destroy();
  }
}

export class EnemyView {
  readonly def: EnemyDef;
  readonly clock = new AnimClock();
  readonly human?: HumanoidRig;
  readonly wolf?: WolfRig;
  readonly dragon?: DragonRig;
  /** While a dragon breathes fire: where from and which way (world pixels). */
  fire?: { x: number; y: number; a: number };
  readonly label?: Phaser.GameObjects.Text;
  /** Static props (training dummies): an image that wobbles when struck. */
  readonly prop?: { root: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; wobble: number; vel: number };
  pose: Pose;
  private from: Pose;
  private target: Pose;
  private scratch: Pose;
  private clipKey = "";
  private blendStart = 0;
  private lastX = 0;
  private lastY = 0;
  speed = 0;
  glintShown = "";
  hitAt = 0;
  readonly recoil = new Recoil();
  lastTip?: { x: number; y: number; a: number };
  stepPhase = 0;

  constructor(scene: Phaser.Scene, e: Enemy) {
    this.def = ENEMIES[e.def];
    const l = this.def.look;
    if (this.def.behavior === "dummy") {
      paintDummy(scene);
      const img = scene.add.image(0, 0, "dummy").setOrigin(0.5, 0.96).setScale(1 / RES);
      const shadow = scene.add.image(0, 0, "shadow").setScale(0.4, 0.4);
      this.prop = { root: scene.add.container(0, 0, [shadow, img]), img, wobble: 0, vel: 0 };
    } else if (l.rig === "wolf") {
      this.wolf = new WolfRig(scene, `wolf:${this.def.key}`, l.skin, l.cloth, l.trim, l.glow ?? "#ffd26b", l.scale);
    } else if (l.rig === "dragon") {
      this.dragon = new DragonRig(scene, `dragon:${this.def.key}`, l.skin, l.cloth, l.trim, l.glow ?? "#ffb347", l.scale);
    } else {
      const shield = l.shield ? { color: l.rig === "construct" ? "#c9a24a" : "#7a5a3a", trim: l.trim } : undefined;
      this.human = new HumanoidRig(scene, enemyLook(this.def), l.weapon === "shield" ? "none" : (l.weapon as WeaponArt), l.rig === "construct" ? 4 : 0, l.scale, shield);
    }
    if (this.def.boss || e.flags & EFlag.Elite) {
      this.label = scene.add
        .text(0, 0, (e.flags & EFlag.Elite ? "Elite " : "") + this.def.name, { fontFamily: "Georgia, serif", fontSize: "18px", color: this.def.boss ? "#ffd98a" : "#f2c46b", stroke: "#1d1a17", strokeThickness: 4 })
        .setOrigin(0.5, 1)
        .setScale(0.5);
    }
    this.lastX = e.x;
    this.lastY = e.y;
    this.pose = restPose(Math.PI / 2);
    this.from = restPose(Math.PI / 2);
    this.target = restPose(Math.PI / 2);
    this.scratch = restPose(Math.PI / 2);
  }

  get root() {
    return (this.human?.root ?? this.wolf?.root ?? this.dragon?.root ?? this.prop?.root)!;
  }

  flash() {
    this.human?.flash();
    this.wolf?.flash();
    this.dragon?.flash();
    if (this.prop) {
      this.prop.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.prop.vel += (Math.random() < 0.5 ? -1 : 1) * 9;
    }
    this.hitAt = performance.now();
  }

  /** `viewNow` is the server time this client is displaying remote entities at. */
  update(e: Enemy, x: number, y: number, viewNow: number, dtMs: number) {
    this.clock.update(dtMs);
    this.recoil.update(dtMs);
    // Heavier bodies move less when struck.
    const heft = 1 / Math.max(1, this.def.look.scale);
    const rx = this.recoil.x * heft;
    const ry = this.recoil.y * heft;
    const dist = Math.hypot(x - this.lastX, y - this.lastY);
    this.speed = this.speed * 0.8 + (dist / Math.max(1, dtMs)) * 1000 * 0.2;
    this.lastX = x;
    this.lastY = y;
    const t = viewNow - e.actStart - this.clock.lag;
    const aim = aimToRad(e.aim);
    const def = this.def;
    const hidden = (e.flags & EFlag.Hidden) !== 0;
    const alphaBase = hidden ? 0.22 + Math.sin(performance.now() / 120) * 0.06 : 1;

    if (this.prop) {
      const pr = this.prop;
      // Damped spring wobble.
      const dt = dtMs / 1000;
      pr.vel += -pr.wobble * 180 * dt - pr.vel * 8 * dt;
      pr.wobble += pr.vel * dt;
      pr.img.setRotation(pr.wobble * 0.05);
      if (performance.now() - this.hitAt > 80) pr.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      pr.root.setPosition(x, y).setDepth(y);
      return;
    }
    if (this.dragon) {
      let anim = this.speed > 110 ? "run" : this.speed > 12 ? "walk" : "idle";
      let wind = 0, act = 0, rec = 0;
      if (e.act === EAct.Attack) {
        const a = def.attacks[e.atk];
        anim = a.anim;
        wind = windupTicks(a, e.flags) * TICK_MS;
        act = a.active * TICK_MS;
        rec = a.recovery * TICK_MS;
      } else if (e.act === EAct.Hurt || e.act === EAct.Stagger) anim = "hurt";
      else if (e.act === EAct.Dead) anim = "dead";
      const alpha = e.act === EAct.Dead ? Math.max(0, 1 - Math.max(0, t - 1400) / 900) : e.act === EAct.Spawn ? Math.min(1, t / 400) : alphaBase;
      const tt = e.act === EAct.Attack || e.act === EAct.Dead ? t : performance.now() - this.clock.lag;
      this.dragon.apply(anim, tt, aim, wind, act, rec, alpha);
      const shake = performance.now() - this.hitAt < 70 ? (Math.random() - 0.5) * 1.2 : 0;
      this.dragon.root.setPosition(x + rx + shake, y + ry).setDepth(y);
      const breathing = anim === "breath" && tt >= wind && tt < wind + act;
      this.fire = breathing ? { x: x + this.dragon.mouth.x, y: y + this.dragon.mouth.y, a: aim } : undefined;
      this.label?.setPosition(x, y - 44 * def.look.scale).setDepth(y + 0.5);
      this.label?.setVisible(!(def.boss && e.flags & EFlag.Aggro));
      return;
    }
    if (this.wolf) {
      let anim = this.speed > 110 ? "run" : this.speed > 12 ? "walk" : "idle";
      let wind = 0, act = 0, rec = 0;
      if (e.act === EAct.Attack) {
        const a = def.attacks[e.atk];
        anim = a.anim;
        wind = windupTicks(a, e.flags) * TICK_MS;
        act = a.active * TICK_MS;
        rec = a.recovery * TICK_MS;
      } else if (e.act === EAct.Hurt || e.act === EAct.Stagger) anim = "hurt";
      else if (e.act === EAct.Dead) anim = "dead";
      const alpha = e.act === EAct.Dead ? Math.max(0, 1 - Math.max(0, t - 700) / 800) : e.act === EAct.Spawn ? Math.min(1, t / 400) : alphaBase;
      this.wolf.apply(anim, e.act === EAct.Attack || e.act === EAct.Dead ? t : performance.now() - this.clock.lag, aim, wind, act, rec, alpha);
      this.wolf.root.setPosition(x + rx, y + ry).setDepth(y);
      if (e.act === EAct.Dead) this.wolf.root.setRotation(Math.min(1.4, t / 250) * (Math.cos(aim) >= 0 ? -1 : 1) * 0.0);
      this.label?.setPosition(x, y - 34 * def.look.scale).setDepth(y + 0.5);
      return;
    }

    const tgt = this.target;
    let key = "";
    const moving = this.speed > 10;
    // The server turns enemies toward their movement or their target, so aim is also facing.
    const face = aim;
    switch (e.act) {
      case EAct.Attack: {
        const a = def.attacks[e.atk];
        key = `atk${e.actStart}`;
        attackPose(a.anim, t, { startup: windupTicks(a, e.flags) * TICK_MS, active: a.active * TICK_MS, recovery: a.recovery * TICK_MS }, aim, tgt);
        void attackTicks;
        break;
      }
      case EAct.Hurt:
        key = `hurt${e.actStart}`;
        Object.assign(tgt, restPose(aim));
        tgt.tilt = -0.28;
        tgt.lean = -3;
        tgt.sy = 0.93;
        break;
      case EAct.Stagger:
        key = `stag${e.actStart}`;
        Object.assign(tgt, restPose(aim));
        tgt.tilt = Math.sin(t / 140) * 0.18;
        tgt.lean = -2;
        tgt.sy = 0.92;
        tgt.wAngle = restAngle(aim) + 0.35;
        tgt.wReach = 5;
        break;
      case EAct.Dead:
        key = `dead${e.actStart}`;
        Object.assign(tgt, restPose(aim));
        tgt.tilt = Math.min(1.45, t / 180) * (Math.cos(aim) >= 0 ? -1 : 1);
        tgt.sy = 0.85;
        tgt.alpha = Math.max(0, 1 - Math.max(0, t - 800) / 700);
        break;
      case EAct.Guard:
        key = "guard";
        this.stepPhase += dtMs;
        locomotionPose(aim, moving ? 1 : 0, this.stepPhase, tgt);
        tgt.offArm = 1.2;
        tgt.sy = 0.95;
        break;
      case EAct.Spawn:
        key = "spawn";
        Object.assign(tgt, restPose(aim));
        tgt.alpha = Math.min(1, t / 400);
        tgt.lift = -(1 - Math.min(1, t / 400)) * 6;
        break;
      default:
        key = `loco${moving ? (this.speed > 140 ? 2 : 1) : 0}`;
        this.stepPhase += dtMs * (def.behavior === "boss" ? 0.8 : 1);
        locomotionPose(face, moving ? (this.speed > 140 ? 2 : 1) : 0, this.stepPhase, tgt);
    }
    if (hidden) tgt.alpha = Math.min(tgt.alpha, alphaBase);
    if (key !== this.clipKey) {
      this.clipKey = key;
      Object.assign(this.from, this.pose);
      this.blendStart = performance.now();
    }
    const bt = Math.min(1, (performance.now() - this.blendStart) / (key.startsWith("atk") ? 60 : 120));
    blendPose(this.from, tgt, bt, this.scratch);
    Object.assign(this.pose, this.scratch);
    const shake = performance.now() - this.hitAt < 70 ? (Math.random() - 0.5) * 1.6 : 0;
    this.human!.apply(this.pose);
    this.human!.root.setPosition(x + rx + shake, y + ry).setDepth(y);
    this.label?.setPosition(x, y - 44 * def.look.scale + this.pose.lift).setDepth(y + 0.5).setAlpha(this.pose.alpha);
    // Once a boss is engaged its name lives on the top health bar instead.
    this.label?.setVisible(!(def.boss && e.flags & EFlag.Aggro));
  }

  destroy() {
    this.human?.destroy();
    this.wolf?.destroy();
    this.dragon?.destroy();
    this.prop?.root.destroy();
    this.label?.destroy();
  }
}
