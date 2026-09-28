import {
  Act,
  actionLength,
  aimToRad,
  angleDiff,
  currentMove,
  dodgeDef,
  EAct,
  EFlag,
  ENEMIES,
  HazardKind,
  HitResult,
  impactMs,
  INTERP_DELAY,
  isActiveTick,
  MAX_VIEW_LAG_MS,
  parryDef,
  PLAYER_RADIUS,
  ProjKind,
  radToAim,
  shapeHits,
  shapeReach,
  stepPlayer,
  TICK_MS,
  TIMING_TOLERANCE_MS,
  WEAPONS,
  getMove,
  type EnemyAttack,
  type EnemyDef,
  type MoveDef,
  type PlayerCommand,
  type PlayerSim,
  type Shape,
  type WorldMap,
} from "@floors/shared";
import { Enemy, Hazard, Projectile, type Player, type WorldState } from "../state.ts";
import { EnemyAI } from "./ai.ts";
import type { Character } from "./character.ts";
import { PathGrid } from "./pathfind.ts";

/** Minimal surface of Colyseus' Rewind we rely on. */
export interface RewindLike {
  lastSeenBy(sessionId: string): { value(entity: object, field: string): number };
  at(time: number): { value(entity: object, field: string): number };
}

export interface ActionRecord {
  act: number;
  move: number;
  seq: number;
  /** Server time the player was looking at when they pressed it (renderTime). */
  r: number;
}

export interface PlayerData {
  sid: string;
  p: Player;
  timeline: ActionRecord[];
  /** Latest view time (server ms) of this player, from their input stamps. */
  view: number;
  prevView: number;
  hitSeq: number;
  hitSet: Set<string>;
  projSeq: number;
  specialSeq: number;
  combatUntil: number;
  invulnUntil: number;
  deadAt: number;
  atkMul: number;
  defense: number;
  ch?: Character;
  useSeq: number;
}

export interface AttackRecord {
  seq: number;
  atk: EnemyAttack;
  start: number;
  a0: number;
  a1: number;
  flags: number;
  aim: number;
  anchor?: { x: number; y: number };
  resolved: Set<string>;
}

export interface EnemyData {
  id: string;
  e: Enemy;
  def: EnemyDef;
  spawner?: string;
  homeX: number;
  homeY: number;
  target?: string;
  cooldowns: number[];
  attackSeq: number;
  attacks: AttackRecord[];
  poiseDmg: number;
  poiseAt: number;
  flinches: number;
  flinchAt: number;
  hyperUntil: number;
  stateUntil: number;
  kbx: number;
  kby: number;
  path?: { x: number; y: number }[];
  pathAt: number;
  orbit: number;
  thinkAt: number;
  token?: string;
  contrib: Map<string, number>;
  phase: number;
  enrageUntil: number;
  slowUntil: number;
  minions: Set<string>;
  master?: string;
  removeAt: number;
  specialFired: number;
}

interface ProjData {
  id: string;
  pr: Projectile;
  damage: number;
  poise: number;
  knockback: number;
  atk?: EnemyAttack;
  enemyId?: string;
  sid?: string;
  weapon?: number;
  pierce: boolean;
  hits: Set<string>;
}

interface HazardData {
  id: string;
  hz: Hazard;
  damage: number;
  poise: number;
  knockback: number;
  heavy: boolean;
  sid?: string;
  enemyId?: string;
  resolved: Set<string>;
  frost?: boolean;
  /** Glyphs are safe spots, not damage. */
  safe?: boolean;
  lifeUntil: number;
}

export type Emit = (type: string, data: Record<string, unknown>, x: number, y: number) => void;

const SAFE_RESPAWN_MS = 2500;
export const RESPAWN_DELAY_MS = 9000;

export class Sim {
  readonly players = new Map<string, PlayerData>();
  readonly enemies = new Map<string, EnemyData>();
  private projectiles = new Map<string, ProjData>();
  private hazards = new Map<string, HazardData>();
  readonly grid: PathGrid;
  readonly ai: EnemyAI;
  private nextId = 1;
  /** Melee attackers currently engaging each player (anti-mob tokens). */
  readonly tokens = new Map<string, Set<string>>();
  now = 0;

  onEnemyKilled?: (ed: EnemyData, killer?: PlayerData) => void;
  onPlayerDied?: (pd: PlayerData) => void;
  onPlayerRespawn?: (pd: PlayerData) => void;
  onEnemyRemoved?: (ed: EnemyData) => void;
  onDamageDealt?: (pd: PlayerData, ed: EnemyData, amount: number) => void;
  onParry?: (pd: PlayerData, perfect: boolean) => void;
  /** Consume a tonic; return false if none. */
  onUseStart?: (pd: PlayerData) => boolean;
  /** A new synced entity exists (for interest management). */
  onSpawn?: (obj: object, x: number, y: number) => void;

  constructor(
    readonly map: WorldMap,
    readonly state: WorldState,
    readonly rewind: RewindLike,
    readonly emit: Emit,
  ) {
    const blocked = new Uint8Array(map.width * map.height);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const zone = map.zoneAt(x * 32 + 16, y * 32 + 16);
        blocked[y * map.width + x] = map.isSolidTile(x, y) || zone?.safe ? 1 : 0;
      }
    }
    this.grid = new PathGrid(map, blocked);
    this.ai = new EnemyAI(this);
  }

  id(prefix: string) {
    return `${prefix}${(this.nextId++).toString(36)}`;
  }

  // ---------------------------------------------------------------------------
  // Players

  addPlayer(sid: string, p: Player): PlayerData {
    const pd: PlayerData = {
      sid,
      p,
      timeline: [],
      view: this.now - INTERP_DELAY,
      prevView: this.now - INTERP_DELAY,
      hitSeq: -1,
      hitSet: new Set(),
      projSeq: -1,
      specialSeq: -1,
      combatUntil: 0,
      invulnUntil: this.now + SAFE_RESPAWN_MS,
      deadAt: 0,
      atkMul: 1,
      defense: 0,
      useSeq: -1,
    };
    this.players.set(sid, pd);
    return pd;
  }

  removePlayer(sid: string) {
    this.players.delete(sid);
    this.tokens.delete(sid);
    for (const ed of this.enemies.values()) if (ed.target === sid) ed.target = undefined;
  }

  /** Apply one input frame for a player. `renderTime` is the server time the client was viewing. */
  applyInput(pd: PlayerData, cmd: PlayerCommand, dt: number, renderTime: number) {
    const p = pd.p;
    const s = p as unknown as PlayerSim;
    const prevSeq = p.actSeq;
    stepPlayer(s, cmd, dt, this.map, this.bodiesSeenBy(pd));
    if (renderTime > 0) pd.view = Math.max(pd.view, Math.min(renderTime, this.now));

    if (p.actSeq !== prevSeq) {
      pd.timeline.push({ act: p.act, move: p.actMove, seq: p.actSeq, r: renderTime > 0 ? renderTime : this.now - INTERP_DELAY });
      if (pd.timeline.length > 16) pd.timeline.shift();
    }
    if (p.act === Act.Use) {
      if (pd.useSeq !== p.actSeq) {
        pd.useSeq = p.actSeq;
        if (!this.onUseStart?.(pd)) {
          s.act = Act.None;
          s.actTick = 0;
        }
      } else if (p.actTick === 22) {
        const heal = Math.round(p.hpMax * 0.4);
        p.hp = Math.min(p.hpMax, p.hp + heal);
        this.emit("heal", { p: pd.sid, d: heal, x: p.x, y: p.y }, p.x, p.y);
      }
      return;
    }
    const m = currentMove(s);
    if (!m) return;
    if (isActiveTick(s) && m.shape) this.playerMelee(pd, m);
    if (m.projectile && p.actTick === m.startup && pd.projSeq !== p.actSeq) {
      pd.projSeq = p.actSeq;
      this.spawnPlayerProjectiles(pd, m);
    }
    if (m.special && p.actTick === m.startup && pd.specialSeq !== p.actSeq) {
      pd.specialSeq = p.actSeq;
      this.playerSpecial(pd, m);
    }
  }

  /** Line of sight for player attacks: only real walls block (safe zones and enemy pathing do not). */
  wallClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.map.isSolidTile(Math.floor((x0 + (x1 - x0) * t) / 32), Math.floor((y0 + (y1 - y0) * t) / 32))) return false;
    }
    return true;
  }

  private bodyScratch: { x: number; y: number; r: number }[] = [];
  /** Enemy bodies near a player, rewound to what that player sees (matches their prediction). */
  private bodiesSeenBy(pd: PlayerData) {
    const out = this.bodyScratch;
    out.length = 0;
    const p = pd.p;
    if (p.act !== Act.Light && p.act !== Act.Heavy && p.act !== Act.Skill) return out;
    const seen = this.rewind.lastSeenBy(pd.sid);
    for (const ed of this.enemies.values()) {
      const e = ed.e;
      if (e.act === EAct.Dead || Math.abs(e.x - p.x) > 140 || Math.abs(e.y - p.y) > 140) continue;
      out.push({ x: seen.value(e, "x"), y: seen.value(e, "y"), r: ed.def.radius });
    }
    return out;
  }

  private playerMelee(pd: PlayerData, m: MoveDef) {
    const p = pd.p;
    if (pd.hitSeq !== p.actSeq) {
      pd.hitSeq = p.actSeq;
      pd.hitSet.clear();
    }
    if (m.special === "meteor") return; // detonates as a hazard
    const shape = m.shape!;
    const rad = aimToRad(p.actAim);
    const reach = shapeReach(shape) + 40;
    // What the attacker saw: enemies rewound to their render time.
    const seen = this.rewind.lastSeenBy(pd.sid);
    for (const ed of this.enemies.values()) {
      const e = ed.e;
      if (e.act === EAct.Dead || e.act === EAct.Spawn || pd.hitSet.has(ed.id)) continue;
      if (Math.abs(e.x - p.x) > reach + ed.def.radius || Math.abs(e.y - p.y) > reach + ed.def.radius) continue;
      const ex = seen.value(e, "x");
      const ey = seen.value(e, "y");
      if (!shapeHits(shape, p.x, p.y, rad, ex, ey, ed.def.radius)) continue;
      if (shapeReach(shape) > 80 && !this.wallClear(p.x, p.y - 8, ex, ey - 8)) continue;
      pd.hitSet.add(ed.id);
      this.damageEnemy(ed, pd, m.damage, m.poise, m.knockback, Math.atan2(ey - p.y, ex - p.x), m);
    }
  }

  private spawnPlayerProjectiles(pd: PlayerData, m: MoveDef) {
    const p = pd.p;
    const pj = m.projectile!;
    const base = aimToRad(p.actAim);
    for (let i = 0; i < pj.count; i++) {
      const off = pj.count === 1 ? 0 : -pj.spread / 2 + (pj.spread * i) / (pj.count - 1);
      const a = base + off;
      this.spawnProjectile({
        kind: WEAPONS[p.weapon].key === "daggers" ? ProjKind.Knife : ProjKind.Bolt,
        team: 0,
        owner: pd.sid,
        x: p.x + Math.cos(a) * 14,
        y: p.y - 10 + Math.sin(a) * 14,
        angle: a,
        speed: pj.speed,
        range: pj.range,
        radius: pj.radius,
        damage: m.damage * pd.atkMul,
        poise: m.poise,
        knockback: m.knockback,
        sid: pd.sid,
        weapon: p.weapon,
      });
    }
  }

  private playerSpecial(pd: PlayerData, m: MoveDef) {
    const p = pd.p;
    const rad = aimToRad(p.actAim);
    switch (m.special) {
      case "meteor": {
        const off = (m.shape as Extract<Shape, { kind: "circle" }>).offset;
        let tx = p.x + Math.cos(rad) * off;
        let ty = p.y + Math.sin(rad) * off;
        if (!this.wallClear(p.x, p.y, tx, ty)) {
          tx = p.x + Math.cos(rad) * off * 0.4;
          ty = p.y + Math.sin(rad) * off * 0.4;
        }
        this.spawnHazard({ kind: HazardKind.Meteor, team: 0, x: tx, y: ty, radius: 60, delay: 700, damage: m.damage * pd.atkMul, poise: m.poise, knockback: m.knockback, heavy: true, sid: pd.sid });
        break;
      }
      case "frost":
      case "warcry": {
        const shape = m.shape!;
        for (const ed of this.enemies.values()) {
          const e = ed.e;
          if (e.act === EAct.Dead || !shapeHits(shape, p.x, p.y, rad, e.x, e.y, ed.def.radius)) continue;
          const ang = Math.atan2(e.y - p.y, e.x - p.x);
          if (m.special === "frost") {
            ed.slowUntil = this.now + 4000;
            e.flags |= EFlag.Chilled;
          }
          this.damageEnemy(ed, pd, m.damage, m.poise, m.knockback, ang, m);
        }
        this.emit("fx", { k: m.special, x: p.x, y: p.y, r: (shape as { radius: number }).radius }, p.x, p.y);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Damage

  damageEnemy(ed: EnemyData, pd: PlayerData | undefined, base: number, poise: number, knockback: number, ang: number, m?: MoveDef) {
    const e = ed.e;
    if (e.act === EAct.Dead || e.act === EAct.Spawn) return;
    if (e.act === EAct.Leash) {
      this.emit("hit", { t: ed.id, d: 0, r: HitResult.Blocked, x: e.x, y: e.y }, e.x, e.y);
      return;
    }
    const def = ed.def;
    const attacker = pd?.p;
    // Shieldbearers block frontal hits unless the blow is heavy enough to break guard.
    if (e.act === EAct.Guard && attacker) {
      const toAttacker = Math.atan2(attacker.y - e.y, attacker.x - e.x);
      if (Math.abs(angleDiff(toAttacker, aimToRad(e.aim))) < 1.25) {
        if (poise < 35) {
          ed.poiseDmg += poise * 0.6;
          this.emit("hit", { t: ed.id, d: 0, r: HitResult.Blocked, x: e.x, y: e.y, a: pd?.sid }, e.x, e.y);
          if (ed.poiseDmg >= def.poise) this.stagger(ed, 80, true);
          return;
        }
        this.emit("guardbreak", { t: ed.id, x: e.x, y: e.y }, e.x, e.y);
        this.stagger(ed, 70, true);
      }
    }

    const dv = pd?.ch?.derived;
    const md = dv?.mdmg;
    let dmg = base * (pd?.atkMul ?? 1) * (md?.dmg ?? 1);
    poise *= md?.poise ?? 1;
    knockback *= md?.knock ?? 1;
    let crit = 0;
    if (e.flags & EFlag.Riposte) {
      dmg *= (attacker ? WEAPONS[attacker.weapon].riposte : 2) * (md?.riposte ?? 1) * (pd?.ch?.hasPerk("riposteMaster") ? 1.4 : 1);
      crit = 2;
      e.flags &= ~EFlag.Riposte;
    } else if (attacker && ed.target !== pd!.sid) {
      const toAttacker = Math.atan2(attacker.y - e.y, attacker.x - e.x);
      if (Math.abs(angleDiff(toAttacker, aimToRad(e.aim))) > 2.2) {
        dmg *= 1.5 * (md?.backstab ?? 1); // backstab
        crit = 1;
      }
    }
    if (e.act === EAct.Stagger && pd?.ch?.hasPerk("executioner")) dmg *= 1.25;
    if (attacker && attacker.act === Act.Light && pd?.ch?.hasPerk("momentum")) dmg *= 1 + Math.min(0.25, attacker.combo * 0.05);
    dmg *= 1 - def.armor;
    const amount = Math.max(1, Math.round(dmg));
    // Credit (kill share, weapon mastery) counts only health actually removed, never overkill.
    const dealt = Math.min(amount, e.hp);
    e.hp = Math.max(0, e.hp - amount);
    if (pd) {
      ed.contrib.set(pd.sid, (ed.contrib.get(pd.sid) ?? 0) + dealt);
      pd.combatUntil = this.now + 6000;
      if (!ed.target && def.behavior !== "dummy") ed.target = pd.sid;
    }
    this.emit("hit", { t: ed.id, d: amount, c: crit, r: HitResult.Hit, x: e.x, y: e.y, a: pd?.sid, hs: m?.hitstop ?? 50, im: m?.impact ?? 0.1 }, e.x, e.y);
    if (pd) this.onDamageDealt?.(pd, ed, dealt);
    if (crit === 2 && pd && dv?.effects.has("emberbrand")) {
      // Emberbrand: ripostes erupt in flame around the target.
      this.spawnHazard({ kind: HazardKind.Meteor, team: 0, x: e.x, y: e.y, radius: 54, delay: 60, damage: 16, poise: 20, knockback: 90, heavy: false, sid: pd.sid, life: 300 });
      this.emit("fx", { k: "ember", x: e.x, y: e.y }, e.x, e.y);
    }

    if (e.hp <= 0) {
      if (def.behavior === "dummy" || def.behavior === "sparring") {
        e.hp = e.hpMax;
        return;
      }
      this.killEnemy(ed, pd);
      return;
    }

    // Bosses: posture instead of flinching.
    if (def.boss) {
      this.addPosture(ed, poise * 0.35);
      this.checkPhase(ed);
      return;
    }

    if (this.now - ed.poiseAt > 2500) ed.poiseDmg = 0;
    ed.poiseAt = this.now;
    ed.poiseDmg += poise;
    const inAttack = e.act === EAct.Attack;
    const rec = inAttack ? ed.attacks[ed.attacks.length - 1] : undefined;
    const inWindup = !!rec && this.now < rec.a0;
    if (ed.poiseDmg >= def.poise) {
      ed.poiseDmg = 0;
      this.stagger(ed, 55, false);
      this.knock(ed, ang, knockback * 1.4);
    } else if (def.flinches && (!inAttack || inWindup) && this.now >= ed.hyperUntil) {
      if (this.now - ed.flinchAt > 1200) ed.flinches = 0;
      ed.flinchAt = this.now;
      ed.flinches++;
      if (ed.flinches >= 4) {
        // Hyper armour after repeated flinches so enemies can't be stun-locked forever.
        ed.hyperUntil = this.now + 1400;
        ed.flinches = 0;
      }
      this.setEnemyAct(ed, EAct.Hurt);
      ed.stateUntil = this.now + 14 * TICK_MS;
      this.knock(ed, ang, knockback);
    } else if (!inAttack) {
      this.knock(ed, ang, knockback * 0.4);
    }
  }

  private knock(ed: EnemyData, ang: number, force: number) {
    const mass = ed.def.boss ? 0.15 : ed.def.radius > 14 ? 0.4 : 1;
    ed.kbx = Math.cos(ang) * force * 4 * mass;
    ed.kby = Math.sin(ang) * force * 4 * mass;
  }

  stagger(ed: EnemyData, ticks: number, riposte: boolean) {
    this.releaseToken(ed);
    this.setEnemyAct(ed, EAct.Stagger);
    ed.stateUntil = this.now + ticks * TICK_MS;
    if (riposte) ed.e.flags |= EFlag.Riposte;
    this.emit("stagger", { t: ed.id, x: ed.e.x, y: ed.e.y, ms: ticks * TICK_MS }, ed.e.x, ed.e.y);
  }

  private addPosture(ed: EnemyData, amount: number) {
    const max = ed.def.boss!.posture;
    const next = ed.e.posture / 255 * max + amount;
    if (next >= max) {
      ed.e.posture = 0;
      this.stagger(ed, 170, true);
      this.emit("posture", { t: ed.id, x: ed.e.x, y: ed.e.y }, ed.e.x, ed.e.y);
    } else {
      ed.e.posture = Math.round((next / max) * 255);
    }
  }

  checkPhase(ed: EnemyData) {
    const phases = ed.def.boss?.phases ?? [];
    const frac = ed.e.hp / ed.e.hpMax;
    let phase = 0;
    for (const t of phases) if (frac <= t) phase++;
    if (phase > ed.phase) {
      ed.phase = phase;
      ed.e.flags |= EFlag.Enraged;
      this.emit("phase", { t: ed.id, phase, x: ed.e.x, y: ed.e.y }, ed.e.x, ed.e.y);
    }
  }

  killEnemy(ed: EnemyData, killer?: PlayerData) {
    const e = ed.e;
    this.releaseToken(ed);
    this.setEnemyAct(ed, EAct.Dead);
    e.flags &= ~(EFlag.Riposte | EFlag.Hidden);
    ed.removeAt = this.now + 1600;
    this.emit("death", { t: ed.id, x: e.x, y: e.y, boss: ed.def.boss ? 1 : 0 }, e.x, e.y);
    for (const mid of ed.minions) {
      const m = this.enemies.get(mid);
      if (m && m.e.act !== EAct.Dead) this.killEnemy(m);
    }
    this.onEnemyKilled?.(ed, killer);
  }

  setEnemyAct(ed: EnemyData, act: number, atk = 0) {
    ed.e.act = act;
    ed.e.atk = atk;
    ed.e.actStart = this.now;
  }

  releaseToken(ed: EnemyData) {
    if (ed.token) this.tokens.get(ed.token)?.delete(ed.id);
    ed.token = undefined;
  }

  // ---------------------------------------------------------------------------
  // Enemy attacks against players, judged in each defender's own view time.

  /**
   * Resolve an incoming hit against the player's action timeline at impact time H:
   * a parry pressed within the window before H parries it; dodge i-frames covering H
   * evade it; otherwise it lands.
   */
  private judge(pd: PlayerData, H: number, parryable: boolean): number {
    const p = pd.p;
    if (p.act === Act.Dead || p.act === Act.Knockdown || this.now < pd.invulnUntil) return HitResult.Evade;
    let rec: ActionRecord | undefined;
    for (let i = pd.timeline.length - 1; i >= 0; i--) {
      if (pd.timeline[i].r <= H + TIMING_TOLERANCE_MS) {
        rec = pd.timeline[i];
        break;
      }
    }
    if (!rec) return HitResult.Hit;
    const elapsed = H - rec.r;
    if (process.env.FLOORS_DEBUG_JUDGE) {
      console.log(`[judge] act=${rec.act} r=${rec.r.toFixed(0)} H=${H.toFixed(0)} elapsed=${elapsed.toFixed(0)} now=${this.now.toFixed(0)} view=${pd.view.toFixed(0)}`);
    }
    const sim = { weapon: p.weapon, mods: p.mods };
    if (rec.act === Act.Parry) {
      const pr = parryDef(sim);
      if (elapsed <= pr.window * TICK_MS + TIMING_TOLERANCE_MS) {
        if (!parryable) return HitResult.Hit;
        return elapsed <= pr.perfect * TICK_MS + TIMING_TOLERANCE_MS ? HitResult.Perfect : HitResult.Parry;
      }
      return HitResult.Hit;
    }
    if (rec.act === Act.Dodge) {
      const d = dodgeDef(sim);
      if (elapsed >= d.iStart * TICK_MS - TIMING_TOLERANCE_MS && elapsed < d.iEnd * TICK_MS + TIMING_TOLERANCE_MS) return HitResult.Evade;
      return HitResult.Hit;
    }
    if (rec.act === Act.Skill) {
      const m = getMove(p.weapon, rec.move);
      if (m.special === "counterStance" && elapsed <= (m.startup + m.active) * TICK_MS) return parryable ? HitResult.Parry : HitResult.Hit;
      if (m.iframes && elapsed >= m.iframes[0] * TICK_MS && elapsed < m.iframes[1] * TICK_MS + TIMING_TOLERANCE_MS) return HitResult.Evade;
    }
    if (rec.act === Act.Light || rec.act === Act.Heavy || rec.act === Act.Skill) {
      const m = getMove(p.weapon, rec.move);
      if (m.superArmor && elapsed <= (m.startup + m.active) * TICK_MS) return HitResult.Armor;
    }
    return HitResult.Hit;
  }

  /** Apply an enemy hit to a player given the judged result. */
  private landOnPlayer(pd: PlayerData, result: number, dmg: number, knockback: number, ang: number, heavy: boolean, source: { ed?: EnemyData; proj?: ProjData; practice?: boolean }) {
    const p = pd.p;
    const s = p as unknown as PlayerSim;
    pd.combatUntil = this.now + 6000;
    const x = p.x;
    const y = p.y;
    if (result === HitResult.Evade) {
      this.emit("evade", { p: pd.sid, x, y }, x, y);
      return;
    }
    if (result === HitResult.Parry || result === HitResult.Perfect) {
      const perfect = result === HitResult.Perfect;
      if (p.act === Act.Parry || p.act === Act.Skill) p.parryOk = perfect ? 2 : 1;
      if (perfect) p.stamina = Math.min(p.staminaMax, p.stamina + parryDef(s).stamina);
      else p.stamina = Math.max(0, p.stamina - 6);
      this.onParry?.(pd, perfect);
      const ch = pd.ch;
      if (perfect && ch) {
        const heal = (ch.hasPerk("secondWind") ? 0.06 : 0) + (ch.derived.effects.has("secondWindCharm") ? 0.05 : 0);
        if (heal > 0) {
          const amt = Math.round(p.hpMax * heal);
          p.hp = Math.min(p.hpMax, p.hp + amt);
          this.emit("heal", { p: pd.sid, d: amt, x, y }, x, y);
        }
        if (ch.derived.effects.has("dawnbreaker") && !source.practice) this.dawnWave(pd);
      }
      this.emit("parry", { p: pd.sid, e: source.ed?.id, perfect: perfect ? 1 : 0, x, y }, x, y);
      if (source.proj) this.reflect(pd, source.proj);
      const ed = source.ed;
      if (ed && !source.proj && !source.practice) {
        if (ed.def.boss) {
          this.addPosture(ed, perfect ? ed.def.boss.posture * 0.22 : ed.def.boss.posture * 0.1);
          const rec = ed.attacks[ed.attacks.length - 1];
          if (perfect && rec?.atk.name === "Radiant Thrust" && ed.e.act !== EAct.Stagger) this.stagger(ed, 120, true);
        } else if (ed.def.poise >= 60) {
          if (perfect) this.stagger(ed, 60, true);
          else {
            this.setEnemyAct(ed, EAct.Hurt);
            ed.stateUntil = this.now + 18 * TICK_MS;
          }
        } else {
          this.stagger(ed, perfect ? 85 : 50, true);
        }
      }
      return;
    }
    if (source.practice) {
      this.emit("practice", { p: pd.sid, x, y }, x, y);
      return;
    }
    const mistimed = pd.timeline.length > 0 && pd.timeline[pd.timeline.length - 1].act === Act.Parry && p.act === Act.Parry;
    let amount = Math.max(1, Math.round((dmg * 100) / (100 + pd.defense)));
    if (result === HitResult.Armor) amount = Math.round(amount * 0.75);
    p.hp = Math.max(0, p.hp - amount);
    if (p.hp <= 0 && pd.ch?.hasPerk("unbroken") && this.now >= pd.ch.unbrokenReadyAt) {
      // Unbroken: a lethal blow leaves you standing at 1, once every two minutes.
      p.hp = 1;
      pd.ch.unbrokenReadyAt = this.now + 120000;
      this.emit("fx", { k: "unbroken", x, y }, x, y);
    }
    this.emit("hit", { t: `p:${pd.sid}`, d: amount, r: result, x, y, heavy: heavy ? 1 : 0, mis: mistimed ? 1 : 0, ang: Math.round(ang * 100) / 100 }, x, y);
    if (p.hp <= 0) {
      this.killPlayer(pd);
      return;
    }
    if (result === HitResult.Armor) return;
    const force = knockback * 3;
    s.act = heavy ? Act.Knockdown : Act.Hurt;
    s.actTick = 0;
    s.actSeq = (s.actSeq + 1) & 0xff;
    s.hurtDur = heavy ? (pd.ch?.hasPerk("ironSkin") ? 42 : 58) : mistimed ? 28 : 20;
    s.kbx = Math.fround(Math.cos(ang) * force);
    s.kby = Math.fround(Math.sin(ang) * force);
    s.buf = 0;
    s.combo = 0;
    s.comboTimer = 0;
    s.parryOk = 0;
  }

  /** Dawnbreaker: a perfect parry releases a radiant wave. */
  private dawnWave(pd: PlayerData) {
    const p = pd.p;
    for (const ed of this.enemies.values()) {
      const e = ed.e;
      if (e.act === EAct.Dead || Math.hypot(e.x - p.x, e.y - p.y) > 100 + ed.def.radius) continue;
      this.damageEnemy(ed, pd, 26, 55, 160, Math.atan2(e.y - p.y, e.x - p.x));
    }
    this.emit("fx", { k: "dawn", x: p.x, y: p.y }, p.x, p.y);
  }

  killPlayer(pd: PlayerData) {
    const s = pd.p as unknown as PlayerSim;
    s.act = Act.Dead;
    s.actTick = 0;
    s.actSeq = (s.actSeq + 1) & 0xff;
    s.kbx = 0;
    s.kby = 0;
    pd.deadAt = this.now;
    for (const ed of this.enemies.values()) if (ed.target === pd.sid) ed.target = undefined;
    this.tokens.delete(pd.sid);
    this.emit("pdeath", { p: pd.sid, x: pd.p.x, y: pd.p.y }, pd.p.x, pd.p.y);
    this.onPlayerDied?.(pd);
  }

  private reflect(pd: PlayerData, pj: ProjData) {
    const p = pd.p;
    const src = pj.enemyId ? this.enemies.get(pj.enemyId) : undefined;
    const a = src ? Math.atan2(src.e.y - p.y, src.e.x - p.x) : pj.pr.angle + Math.PI;
    this.spawnProjectile({
      kind: ProjKind.Reflected,
      team: 0,
      owner: pd.sid,
      x: p.x + Math.cos(a) * 12,
      y: p.y - 10 + Math.sin(a) * 12,
      angle: a,
      speed: Math.max(360, pj.pr.speed * 1.4),
      range: 360,
      radius: 8,
      damage: pj.damage * 1.6,
      poise: 30,
      knockback: 120,
      sid: pd.sid,
      weapon: p.weapon,
    });
  }

  /** Each tick: advance each player's view time and resolve enemy strikes/projectiles/hazards they have now "seen". */
  private resolveIncoming() {
    for (const pd of this.players.values()) {
      const p = pd.p;
      // Never let a stalled client hide in the past.
      const view = Math.max(pd.view, this.now - MAX_VIEW_LAG_MS);
      const prev = pd.prevView;
      pd.prevView = view;
      pd.view = view;
      if (view <= prev || p.act === Act.Dead) continue;

      for (const ed of this.enemies.values()) {
        const e = ed.e;
        if (!ed.attacks.length || Math.abs(e.x - p.x) > 600 || Math.abs(e.y - p.y) > 600) continue;
        for (const rec of ed.attacks) {
          const atk = rec.atk;
          if (!atk.shape || rec.resolved.has(pd.sid)) continue;
          if (view < rec.a0 || prev >= rec.a1) continue;
          const t = Math.min(view, rec.a1 - 1);
          const seen = this.rewind.at(t);
          const ox = rec.anchor ? rec.anchor.x : seen.value(e, "x");
          const oy = rec.anchor ? rec.anchor.y : seen.value(e, "y");
          if (!shapeHits(atk.shape, ox, oy, rec.aim, p.x, p.y, PLAYER_RADIUS)) continue;
          rec.resolved.add(pd.sid);
          const result = this.judge(pd, rec.a0, atk.parryable);
          const practice = ed.def.behavior === "sparring";
          const ang = Math.atan2(p.y - oy, p.x - ox);
          this.landOnPlayer(pd, result, atk.damage * this.enemyDamageMul(ed), atk.knockback, ang, !!atk.heavy, { ed, practice });
          if (result === HitResult.Parry || result === HitResult.Perfect) rec.a1 = Math.min(rec.a1, t); // a parried swing stops
          if (pd.p.act === Act.Dead) break;
        }
      }

      for (const pj of this.projectiles.values()) {
        if (pj.pr.team !== 1 || pj.hits.has(pd.sid)) continue;
        const pos = this.projPos(pj.pr, view);
        if (!pos || Math.hypot(pos.x - p.x, pos.y - (p.y - 8)) > pj.pr.radius + PLAYER_RADIUS) continue;
        pj.hits.add(pd.sid);
        const result = this.judge(pd, view, true);
        this.landOnPlayer(pd, result, pj.damage, pj.knockback, pj.pr.angle, false, { ed: pj.enemyId ? this.enemies.get(pj.enemyId) : undefined, proj: pj });
        if (result !== HitResult.Evade) this.removeProjectile(pj.id);
      }

      for (const hz of this.hazards.values()) {
        if (hz.hz.team !== 1 || hz.safe || hz.resolved.has(pd.sid)) continue;
        const at = hz.hz.born + hz.hz.delay;
        if (view < at || prev >= at + 120) continue;
        hz.resolved.add(pd.sid);
        if (hz.hz.kind === HazardKind.Judgement) {
          // Arena-wide: only standing inside a glyph saves you.
          if (this.insideGlyph(p.x, p.y)) {
            this.emit("evade", { p: pd.sid, x: p.x, y: p.y, glyph: 1 }, p.x, p.y);
            continue;
          }
        } else if (Math.hypot(p.x - hz.hz.x, p.y - hz.hz.y) > hz.hz.radius + PLAYER_RADIUS) continue;
        const result = hz.hz.kind === HazardKind.Judgement ? HitResult.Hit : this.judge(pd, at, false);
        const ed = hz.enemyId ? this.enemies.get(hz.enemyId) : undefined;
        this.landOnPlayer(pd, result, hz.damage, hz.knockback, Math.atan2(p.y - hz.hz.y, p.x - hz.hz.x), hz.heavy, { ed });
      }
    }
  }

  private insideGlyph(x: number, y: number) {
    for (const hz of this.hazards.values()) if (hz.safe && Math.hypot(x - hz.hz.x, y - hz.hz.y) <= hz.hz.radius) return true;
    return false;
  }

  enemyDamageMul(ed: EnemyData) {
    const elite = ed.e.flags & EFlag.Elite ? 1.35 : 1;
    return elite * (1 + (ed.e.level - 1) * 0.08);
  }

  /** Record an enemy attack reaching its active frames (called by the AI). */
  recordAttack(ed: EnemyData, atk: EnemyAttack, anchor?: { x: number; y: number }) {
    const e = ed.e;
    const a0 = e.actStart + impactMs(atk, e.flags);
    ed.attacks.push({ seq: ++ed.attackSeq, atk, start: e.actStart, a0, a1: a0 + atk.active * TICK_MS, flags: e.flags, aim: aimToRad(e.aim), anchor, resolved: new Set() });
    if (ed.attacks.length > 4) ed.attacks.shift();
  }

  // ---------------------------------------------------------------------------
  // Projectiles and hazards

  spawnProjectile(o: {
    kind: number; team: number; owner: string; x: number; y: number; angle: number; speed: number; range: number; radius: number;
    damage: number; poise: number; knockback: number; sid?: string; enemyId?: string; atk?: EnemyAttack; weapon?: number; pierce?: boolean;
  }) {
    const id = this.id("j");
    const pr = new Projectile();
    pr.kind = o.kind;
    pr.team = o.team;
    pr.owner = o.owner;
    pr.x0 = o.x;
    pr.y0 = o.y;
    pr.angle = o.angle;
    pr.speed = o.speed;
    pr.range = o.range;
    pr.radius = o.radius;
    pr.born = this.now;
    this.state.projectiles.set(id, pr);
    this.onSpawn?.(pr, o.x, o.y);
    this.projectiles.set(id, { id, pr, damage: o.damage, poise: o.poise, knockback: o.knockback, atk: o.atk, enemyId: o.enemyId, sid: o.sid, weapon: o.weapon, pierce: !!o.pierce, hits: new Set() });
  }

  projPos(pr: Projectile, t: number): { x: number; y: number } | undefined {
    const dt = (t - pr.born) / 1000;
    if (dt < 0) return undefined;
    const d = pr.speed * dt;
    if (d > pr.range) return undefined;
    return { x: pr.x0 + Math.cos(pr.angle) * d, y: pr.y0 + Math.sin(pr.angle) * d };
  }

  removeProjectile(id: string) {
    this.projectiles.delete(id);
    this.state.projectiles.delete(id);
  }

  spawnHazard(o: { kind: number; team: number; x: number; y: number; radius: number; delay: number; damage: number; poise: number; knockback: number; heavy: boolean; sid?: string; enemyId?: string; safe?: boolean; life?: number }) {
    const id = this.id("h");
    const hz = new Hazard();
    hz.kind = o.kind;
    hz.team = o.team;
    hz.x = o.x;
    hz.y = o.y;
    hz.radius = o.radius;
    hz.born = this.now;
    hz.delay = o.delay;
    this.state.hazards.set(id, hz);
    this.onSpawn?.(hz, o.x, o.y);
    this.hazards.set(id, { id, hz, damage: o.damage, poise: o.poise, knockback: o.knockback, heavy: o.heavy, sid: o.sid, enemyId: o.enemyId, resolved: new Set(), safe: o.safe, lifeUntil: this.now + o.delay + (o.life ?? 600) });
    return id;
  }

  private updateProjectiles() {
    for (const pj of this.projectiles.values()) {
      const pos = this.projPos(pj.pr, this.now);
      if (!pos) {
        // Past its range; enemy projectiles linger briefly so lagging viewers still resolve them.
        if (pj.pr.team === 0 || this.now - pj.pr.born > (pj.pr.range / pj.pr.speed) * 1000 + MAX_VIEW_LAG_MS) this.removeProjectile(pj.id);
        continue;
      }
      if (this.map.isSolidTile(Math.floor(pos.x / 32), Math.floor((pos.y + 8) / 32))) {
        if (pj.pr.team === 0) {
          this.emit("impact", { x: pos.x, y: pos.y, k: pj.pr.kind }, pos.x, pos.y);
          this.removeProjectile(pj.id);
        }
        continue;
      }
      if (pj.pr.team !== 0) continue;
      const pd = pj.sid ? this.players.get(pj.sid) : undefined;
      for (const ed of this.enemies.values()) {
        const e = ed.e;
        if (e.act === EAct.Dead || e.act === EAct.Spawn || pj.hits.has(ed.id)) continue;
        if (Math.hypot(e.x - pos.x, e.y - 10 - pos.y) > ed.def.radius + pj.pr.radius) continue;
        pj.hits.add(ed.id);
        this.damageEnemy(ed, pd, pj.damage / (pd?.atkMul ?? 1), pj.poise, pj.knockback, pj.pr.angle);
        if (!pj.pierce) {
          this.removeProjectile(pj.id);
          break;
        }
      }
    }
  }

  private updateHazards() {
    for (const hz of this.hazards.values()) {
      const at = hz.hz.born + hz.hz.delay;
      if (hz.hz.team === 0 && this.now >= at && !hz.resolved.has("*")) {
        hz.resolved.add("*");
        const pd = hz.sid ? this.players.get(hz.sid) : undefined;
        for (const ed of this.enemies.values()) {
          const e = ed.e;
          if (e.act === EAct.Dead || Math.hypot(e.x - hz.hz.x, e.y - hz.hz.y) > hz.hz.radius + ed.def.radius) continue;
          this.damageEnemy(ed, pd, hz.damage / (pd?.atkMul ?? 1), hz.poise, hz.knockback, Math.atan2(e.y - hz.hz.y, e.x - hz.hz.x));
        }
      }
      if (this.now > hz.lifeUntil) {
        this.hazards.delete(hz.id);
        this.state.hazards.delete(hz.id);
      }
    }
  }

  clearHazards(kind?: number) {
    for (const hz of this.hazards.values()) {
      if (kind !== undefined && hz.hz.kind !== kind) continue;
      this.hazards.delete(hz.id);
      this.state.hazards.delete(hz.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Enemies

  spawnEnemy(defKey: string | number, x: number, y: number, opts: { level?: number; elite?: boolean; spawner?: string; master?: string; hpScale?: number } = {}): EnemyData {
    const idx = typeof defKey === "number" ? defKey : ENEMIES.findIndex((d) => d.key === defKey);
    const def = ENEMIES[idx];
    const id = this.id("e");
    const e = new Enemy();
    e.def = idx;
    e.x = Math.fround(x);
    e.y = Math.fround(y);
    e.aim = radToAim(Math.PI / 2);
    e.level = opts.level ?? 1;
    const hpMax = Math.round(def.hp * (opts.elite ? 2.4 : 1) * (1 + (e.level - 1) * 0.12) * (opts.hpScale ?? 1));
    e.hpMax = Math.min(65535, hpMax);
    e.hp = e.hpMax;
    e.flags = opts.elite ? EFlag.Elite : 0;
    e.act = EAct.Spawn;
    e.actStart = this.now;
    const ed: EnemyData = {
      id, e, def, spawner: opts.spawner, homeX: x, homeY: y, cooldowns: def.attacks.map(() => 0), attackSeq: 0, attacks: [],
      poiseDmg: 0, poiseAt: 0, flinches: 0, flinchAt: 0, hyperUntil: 0, stateUntil: this.now + 500, kbx: 0, kby: 0, pathAt: 0,
      orbit: Math.random() * Math.PI * 2, thinkAt: 0, contrib: new Map(), phase: 0, enrageUntil: 0, slowUntil: 0, minions: new Set(),
      master: opts.master, removeAt: 0, specialFired: 0,
    };
    this.enemies.set(id, ed);
    this.state.enemies.set(id, e);
    this.onSpawn?.(e, x, y);
    return ed;
  }

  removeEnemy(id: string) {
    const ed = this.enemies.get(id);
    if (!ed) return;
    this.releaseToken(ed);
    if (ed.master) this.enemies.get(ed.master)?.minions.delete(id);
    this.enemies.delete(id);
    this.state.enemies.delete(id);
    this.onEnemyRemoved?.(ed);
  }

  // ---------------------------------------------------------------------------

  tick(dt: number, now: number) {
    this.now = now;
    for (const ed of [...this.enemies.values()]) this.ai.update(ed, dt);
    this.updateProjectiles();
    this.updateHazards();
    this.resolveIncoming();
    for (const pd of this.players.values()) {
      const p = pd.p as unknown as PlayerSim;
      if (p.act === Act.Dead && this.now - pd.deadAt > RESPAWN_DELAY_MS) this.respawn(pd);
      // Keep the server's view of hurt/knockdown timers moving even if the client stalls.
      if ((p.act === Act.Hurt || p.act === Act.Knockdown) && p.actTick > actionLength(p) + 30) p.act = Act.None;
    }
  }

  /** An ally pulled them back up: stand again where they fell. */
  revive(pd: PlayerData, frac: number) {
    const s = pd.p as unknown as PlayerSim;
    if (s.act !== Act.Dead) return;
    s.act = Act.None;
    s.actTick = 0;
    s.actSeq = (s.actSeq + 1) & 0xff;
    pd.p.hp = Math.max(1, Math.round(pd.p.hpMax * frac));
    pd.invulnUntil = this.now + 2000;
    this.emit("fx", { k: "revive", x: s.x, y: s.y }, s.x, s.y);
  }

  respawn(pd: PlayerData) {
    const s = pd.p as unknown as PlayerSim;
    s.act = Act.None;
    s.actTick = 0;
    s.actSeq = (s.actSeq + 1) & 0xff;
    pd.p.hp = pd.p.hpMax;
    s.stamina = s.staminaMax;
    s.exhausted = false;
    const spot = this.onPlayerRespawn ? undefined : this.map.spawn;
    if (spot) {
      s.x = Math.fround(spot.x);
      s.y = Math.fround(spot.y);
    }
    pd.invulnUntil = this.now + SAFE_RESPAWN_MS;
    this.onPlayerRespawn?.(pd);
    this.emit("respawn", { p: pd.sid, x: s.x, y: s.y }, s.x, s.y);
  }
}
