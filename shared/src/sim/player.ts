import {
  BODY_HALF_H,
  BODY_HALF_W,
  EXHAUST_RECOVER,
  Gait,
  SPRINT_DRAIN,
  SPRINT_SPEED,
  STAMINA_REGEN,
  STAMINA_REGEN_DELAY,
  WALK_SPEED,
} from "../constants.ts";
import { aimToRad } from "../combat/shapes.ts";
import {
  getMove,
  MOVE_COMBO_HEAVY,
  MOVE_HEAVY,
  MOVE_SKILL_BASE,
  moveLength,
  NO_SKILL,
  WEAPONS,
  type MoveDef,
} from "../combat/weapons.ts";
import type { WorldMap } from "../world/map.ts";

/** What a character is doing. Hurt/Knockdown/Dead are only ever set by the server. */
export const Act = {
  None: 0,
  Light: 1,
  Heavy: 2,
  Dodge: 3,
  Parry: 4,
  Skill: 5,
  Hurt: 6,
  Knockdown: 7,
  Dead: 8,
  Use: 9,
} as const;

export const Btn = {
  Light: 1,
  Heavy: 2,
  Dodge: 4,
  Parry: 8,
  Skill1: 16,
  Skill2: 32,
  Sprint: 64,
  Use: 128,
} as const;

/** Server-granted unlocks and passives the step needs to know about. */
export const Mod = {
  Finisher: 1,
  ComboHeavy: 2,
  Skill1: 4,
  Skill2: 8,
  LightDodge: 16, // dodge costs 30% less
  WideParry: 32, // +2 parry window ticks
  LongDodge: 64, // +15% dodge distance
  QuickCast: 128, // skill cooldowns 25% shorter
} as const;

/** Buffered presses survive this many ticks waiting for a cancel window (~200 ms). */
export const BUFFER_TICKS = 12;
/** After a light/heavy ends, the chain continues if the next press comes within this many ticks. */
export const COMBO_GRACE = 14;
export const USE_TICKS = 42;

/** Everything the player step reads or writes. Mirrors the synced Player fields. */
export interface PlayerSim {
  x: number;
  y: number;
  /** 8-way facing, 0 = east, clockwise (screen space, y down). */
  dir: number;
  gait: number;
  aim: number;
  stamina: number;
  staminaMax: number;
  staminaDelay: number;
  exhausted: boolean;
  act: number;
  actTick: number;
  actMove: number;
  actAim: number;
  actSeq: number;
  combo: number;
  comboTimer: number;
  buf: number;
  bufAim: number;
  bufAge: number;
  dodgeDx: number;
  dodgeDy: number;
  kbx: number;
  kby: number;
  hurtDur: number;
  weapon: number;
  mods: number;
  parryOk: number;
  cd1: number;
  cd2: number;
  /** Equipped skills: indices into the weapon's skill pool (NO_SKILL when a slot is empty). */
  sk1: number;
  sk2: number;
  /** Healing tonics carried (server-driven; drinking needs one). */
  potions: number;
}

/** Enemy bodies a lunge should stop against (positions as the acting player sees them). */
export interface Body {
  x: number;
  y: number;
  r: number;
}

export interface PlayerCommand {
  mx: number;
  my: number;
  aim: number;
  btn: number;
}

const f = Math.fround;

export function dirFromVector(mx: number, my: number): number {
  return (Math.round(Math.atan2(my, mx) / (Math.PI / 4)) + 8) % 8;
}

export const dirFromAim = (aim: number) => (Math.round(aim / 32) + 8) % 8;

export function parryDef(s: Pick<PlayerSim, "weapon" | "mods">) {
  const p = WEAPONS[s.weapon].parry;
  return s.mods & Mod.WideParry ? { ...p, window: p.window + 2, perfect: p.perfect + 1 } : p;
}

export function dodgeDef(s: Pick<PlayerSim, "weapon" | "mods">) {
  const d = WEAPONS[s.weapon].dodge;
  let out = d;
  if (s.mods & Mod.LightDodge) out = { ...out, stamina: Math.round(out.stamina * 0.7) };
  if (s.mods & Mod.LongDodge) out = { ...out, distance: out.distance * 1.15 };
  return out;
}

/** Total length of the current action in ticks. */
export function actionLength(s: PlayerSim): number {
  switch (s.act) {
    case Act.Light:
    case Act.Heavy:
    case Act.Skill:
      return moveLength(getMove(s.weapon, s.actMove));
    case Act.Dodge: {
      const d = dodgeDef(s);
      return d.ticks + d.recovery;
    }
    case Act.Parry: {
      const p = parryDef(s);
      return p.window + p.recovery;
    }
    case Act.Hurt:
    case Act.Knockdown:
      return s.hurtDur;
    case Act.Use:
      return USE_TICKS;
    case Act.Dead:
      return Infinity;
    default:
      return 0;
  }
}

export function currentMove(s: PlayerSim): MoveDef | undefined {
  return s.act === Act.Light || s.act === Act.Heavy || s.act === Act.Skill ? getMove(s.weapon, s.actMove) : undefined;
}

/** True while the move's hitbox is live. */
export function isActiveTick(s: PlayerSim): boolean {
  const m = currentMove(s);
  return !!m && s.actTick >= m.startup && s.actTick < m.startup + m.active;
}

/** Invulnerable this tick (dodge i-frames, mobility skills, getting up). */
export function isInvulnerable(s: PlayerSim): boolean {
  if (s.act === Act.Dodge) {
    const d = dodgeDef(s);
    return s.actTick >= d.iStart && s.actTick < d.iEnd;
  }
  if (s.act === Act.Knockdown || s.act === Act.Dead) return true;
  const m = currentMove(s);
  return !!m?.iframes && s.actTick >= m.iframes[0] && s.actTick < m.iframes[1];
}

export function hasSuperArmor(s: PlayerSim): boolean {
  const m = currentMove(s);
  return !!m?.superArmor && s.actTick < m.startup + m.active;
}

function pressedAction(btn: number): number {
  if (btn & Btn.Dodge) return Btn.Dodge;
  if (btn & Btn.Parry) return Btn.Parry;
  if (btn & Btn.Heavy) return Btn.Heavy;
  if (btn & Btn.Light) return Btn.Light;
  if (btn & Btn.Skill1) return Btn.Skill1;
  if (btn & Btn.Skill2) return Btn.Skill2;
  if (btn & Btn.Use) return Btn.Use;
  return 0;
}

function chainLength(s: PlayerSim): number {
  const w = WEAPONS[s.weapon];
  return s.mods & Mod.Finisher ? w.lights.length : Math.max(1, w.lights.length - 1);
}

function canStart(s: PlayerSim, want: number): boolean {
  const dodge = dodgeDef(s);
  if (want === Btn.Dodge && (s.exhausted || s.stamina <= 0)) return false;
  if (want === Btn.Heavy && s.exhausted) return false;
  if (want === Btn.Skill1 && (s.sk1 === NO_SKILL || s.cd1 > 0)) return false;
  if (want === Btn.Skill2 && (s.sk2 === NO_SKILL || s.cd2 > 0)) return false;
  if ((want === Btn.Skill1 || want === Btn.Skill2) && s.exhausted) return false;
  if (want === Btn.Use && s.potions <= 0) return false;
  switch (s.act) {
    case Act.None:
      return true;
    case Act.Light:
    case Act.Heavy:
    case Act.Skill: {
      const m = getMove(s.weapon, s.actMove);
      if (want === Btn.Dodge || want === Btn.Parry) return s.actTick >= m.cancelFrom;
      if (want === Btn.Use) return false;
      return s.actTick >= m.comboFrom;
    }
    case Act.Dodge:
      if (want === Btn.Dodge || want === Btn.Use) return false;
      return s.actTick >= dodge.attackFrom;
    case Act.Parry:
      // A successful parry opens an immediate counter; a whiff commits you to the recovery.
      if (s.parryOk) return want !== Btn.Parry && want !== Btn.Use;
      return false;
    default:
      return false;
  }
}

function spend(s: PlayerSim, cost: number) {
  if (cost <= 0) return;
  s.stamina = f(Math.max(0, s.stamina - cost));
  s.staminaDelay = f(STAMINA_REGEN_DELAY);
  if (s.stamina <= 0) s.exhausted = true;
}

function begin(s: PlayerSim, act: number, aim: number) {
  s.act = act;
  s.actTick = 0;
  s.actAim = aim;
  s.actSeq = (s.actSeq + 1) & 0xff;
  s.parryOk = 0;
}

function startAction(s: PlayerSim, want: number, aim: number, cmd: PlayerCommand) {
  const w = WEAPONS[s.weapon];
  // A dodge mid-combo keeps the chain alive: light, light, dodge, light continues.
  const inChain = s.act === Act.Light || ((s.act === Act.None || s.act === Act.Dodge) && s.comboTimer > 0);
  switch (want) {
    case Btn.Light: {
      let next = 0;
      if (inChain) next = s.combo + 1;
      if (next >= chainLength(s)) next = 0;
      const m = w.lights[next];
      begin(s, Act.Light, aim);
      s.actMove = next;
      s.combo = next;
      spend(s, m.stamina);
      break;
    }
    case Btn.Heavy: {
      const combo = inChain && (s.mods & Mod.ComboHeavy) !== 0;
      const id = combo ? MOVE_COMBO_HEAVY : MOVE_HEAVY;
      begin(s, Act.Heavy, aim);
      s.actMove = id;
      s.combo = 0;
      spend(s, getMove(s.weapon, id).stamina);
      break;
    }
    case Btn.Skill1:
    case Btn.Skill2: {
      const id = MOVE_SKILL_BASE + (want === Btn.Skill1 ? s.sk1 : s.sk2);
      const m = getMove(s.weapon, id);
      begin(s, Act.Skill, aim);
      s.actMove = id;
      s.combo = 0;
      spend(s, m.stamina);
      const cd = Math.round((m.cooldown ?? 0) * (s.mods & Mod.QuickCast ? 0.75 : 1));
      if (want === Btn.Skill1) s.cd1 = cd;
      else s.cd2 = cd;
      break;
    }
    case Btn.Dodge: {
      const d = dodgeDef(s);
      let dx = Math.sign(cmd.mx);
      let dy = Math.sign(cmd.my);
      if (!dx && !dy) {
        // No direction held: backstep away from the aim.
        const a = aimToRad(aim);
        dx = -Math.cos(a);
        dy = -Math.sin(a);
      }
      const len = Math.hypot(dx, dy);
      begin(s, Act.Dodge, aim);
      s.dodgeDx = f(dx / len);
      s.dodgeDy = f(dy / len);
      s.dir = dirFromVector(s.dodgeDx, s.dodgeDy);
      spend(s, d.stamina);
      return;
    }
    case Btn.Parry:
      begin(s, Act.Parry, aim);
      spend(s, parryDef(s).stamina);
      s.combo = 0;
      break;
    case Btn.Use:
      begin(s, Act.Use, aim);
      break;
  }
  s.dir = dirFromAim(aim);
  s.comboTimer = 0;
}

/**
 * One fixed 60 Hz step for a player: stamina, action timeline, cancels, input
 * buffering and movement. Deterministic — the server runs it as the authority and
 * the owning client runs it for prediction and replay.
 */
export function stepPlayer(s: PlayerSim, cmd: PlayerCommand, dt: number, map: WorldMap, bodies?: readonly Body[]): void {
  if (s.cd1 > 0) s.cd1--;
  if (s.cd2 > 0) s.cd2--;
  s.aim = cmd.aim;

  if (s.act === Act.Dead) {
    s.gait = Gait.Idle;
    return;
  }

  // Buffer presses so a button hit slightly early still comes out on the first legal tick.
  const pressed = pressedAction(cmd.btn);
  if (pressed) {
    s.buf = pressed;
    s.bufAim = cmd.aim;
    s.bufAge = 0;
  } else if (s.buf) {
    s.bufAge++;
    if (s.bufAge > BUFFER_TICKS) s.buf = 0;
  }

  // Advance the current action.
  if (s.act !== Act.None) {
    s.actTick++;
    if (s.actTick >= actionLength(s)) {
      const ended = s.act;
      s.act = Act.None;
      s.actTick = 0;
      s.parryOk = 0;
      if (ended === Act.Light) s.comboTimer = COMBO_GRACE;
      else if (ended !== Act.Dodge) {
        s.comboTimer = 0;
        s.combo = 0;
      }
    }
  } else if (s.comboTimer > 0) {
    s.comboTimer--;
    if (s.comboTimer === 0) s.combo = 0;
  }

  if (s.buf && canStart(s, s.buf)) {
    // Attacks aim where the cursor is now, not where it was when buffered.
    startAction(s, s.buf, s.buf === Btn.Dodge ? s.bufAim : cmd.aim, cmd);
    s.buf = 0;
  }

  const sprintHeld = (cmd.btn & Btn.Sprint) !== 0;
  if (s.exhausted && s.stamina >= EXHAUST_RECOVER) s.exhausted = false;

  switch (s.act) {
    case Act.None:
      walk(s, cmd, sprintHeld, dt, map, 1);
      break;
    case Act.Use:
      walk(s, cmd, false, dt, map, 0.4);
      break;
    case Act.Light:
    case Act.Heavy:
    case Act.Skill: {
      const m = getMove(s.weapon, s.actMove);
      const travelTicks = m.startup + m.active;
      const from = Math.floor(m.startup / 2);
      if (m.lunge > 0 && s.actTick >= from && s.actTick < travelTicks && !blockedAhead(s, bodies, m.special === undefined)) {
        const a = aimToRad(s.actAim);
        const per = m.lunge / (travelTicks - from);
        moveBy(s, Math.cos(a) * per, Math.sin(a) * per, map);
      }
      // A little steering keeps attacks from feeling like you're glued to the floor.
      steer(s, cmd, dt, map, 0.18);
      s.gait = Gait.Idle;
      break;
    }
    case Act.Dodge: {
      const d = dodgeDef(s);
      if (s.actTick < d.ticks) {
        const ease = (t: number) => 1 - (1 - t) * (1 - t);
        const step = d.distance * (ease((s.actTick + 1) / d.ticks) - ease(s.actTick / d.ticks));
        moveBy(s, s.dodgeDx * step, s.dodgeDy * step, map);
      }
      s.gait = Gait.Idle;
      break;
    }
    case Act.Parry:
      s.gait = Gait.Idle;
      break;
    case Act.Hurt:
    case Act.Knockdown:
      if (s.kbx || s.kby) {
        moveBy(s, s.kbx * dt, s.kby * dt, map);
        s.kbx = f(Math.abs(s.kbx) < 4 ? 0 : s.kbx * 0.86);
        s.kby = f(Math.abs(s.kby) < 4 ? 0 : s.kby * 0.86);
      }
      s.gait = Gait.Idle;
      break;
  }

  regenStamina(s, dt, s.act === Act.None && sprintHeld && s.gait === Gait.Sprint);
}

/** Attack lunges stop when an enemy is right in front, so combos don't carry you through targets. */
function blockedAhead(s: PlayerSim, bodies: readonly Body[] | undefined, applies: boolean): boolean {
  if (!bodies || !applies) return false;
  const a = aimToRad(s.actAim);
  const c = Math.cos(a);
  const sn = Math.sin(a);
  for (const b of bodies) {
    const dx = b.x - s.x;
    const dy = b.y - s.y;
    const along = dx * c + dy * sn;
    const across = Math.abs(-dx * sn + dy * c);
    if (along > -4 && along < b.r + 16 && across < b.r + 8) return true;
  }
  return false;
}

function regenStamina(s: PlayerSim, dt: number, sprinting: boolean) {
  if (sprinting) return;
  // Attacking and dodging pause regeneration; blocking a parry does not refund.
  if (s.act === Act.Light || s.act === Act.Heavy || s.act === Act.Skill || s.act === Act.Dodge) return;
  if (s.staminaDelay > 0) {
    s.staminaDelay = f(Math.max(0, s.staminaDelay - dt));
  } else if (s.stamina < s.staminaMax) {
    s.stamina = f(Math.min(s.staminaMax, s.stamina + STAMINA_REGEN * dt));
  }
}

function walk(s: PlayerSim, cmd: PlayerCommand, sprintHeld: boolean, dt: number, map: WorldMap, scale: number) {
  const mx = Math.sign(cmd.mx);
  const my = Math.sign(cmd.my);
  if (!mx && !my) {
    s.gait = Gait.Idle;
    return;
  }
  const sprinting = sprintHeld && !s.exhausted && s.stamina > 0 && scale === 1;
  if (sprinting) {
    s.stamina = f(Math.max(0, s.stamina - SPRINT_DRAIN * dt));
    s.staminaDelay = f(STAMINA_REGEN_DELAY);
    if (s.stamina <= 0) s.exhausted = true;
  }
  s.dir = dirFromVector(mx, my);
  s.gait = sprinting ? Gait.Sprint : Gait.Walk;
  const inv = 1 / Math.hypot(mx, my);
  const speed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * scale;
  moveBy(s, mx * inv * speed * dt, 0, map);
  moveBy(s, 0, my * inv * speed * dt, map);
}

function steer(s: PlayerSim, cmd: PlayerCommand, dt: number, map: WorldMap, scale: number) {
  const mx = Math.sign(cmd.mx);
  const my = Math.sign(cmd.my);
  if (!mx && !my) return;
  const inv = 1 / Math.hypot(mx, my);
  moveBy(s, mx * inv * WALK_SPEED * scale * dt, my * inv * WALK_SPEED * scale * dt, map);
}

/** Move with tile collision, sliding along walls one axis at a time. */
export function moveBy(s: { x: number; y: number }, dx: number, dy: number, map: WorldMap): void {
  if (dx) moveAxis(s, dx, 0, map);
  if (dy) moveAxis(s, 0, dy, map);
}

function moveAxis(s: { x: number; y: number }, dx: number, dy: number, map: WorldMap): void {
  const nx = s.x + dx;
  const ny = s.y + dy;
  if (!map.boxBlocked(nx, ny, BODY_HALF_W, BODY_HALF_H)) {
    s.x = f(nx);
    s.y = f(ny);
    return;
  }
  const dist = Math.abs(dx + dy);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let moved = 0;
  while (moved < dist) {
    const step = Math.min(1, dist - moved);
    const tx = s.x + sx * step;
    const ty = s.y + sy * step;
    if (map.boxBlocked(tx, ty, BODY_HALF_W, BODY_HALF_H)) break;
    s.x = f(tx);
    s.y = f(ty);
    moved += step;
  }
}
