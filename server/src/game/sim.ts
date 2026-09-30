import {
  Act,
  Affix,
  AFFIXES,
  actionLength,
  aimToRad,
  angleDiff,
  currentMove,
  dodgeDef,
  EAct,
  EFlag,
  ENEMIES,
  enemyDamageScale,
  enemyMaxHp,
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
  REST_REGEN,
  type PlayerSim,
  type Shape,
  type WorldMap, huntBonus } from "@floors/shared";
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
  /** Fractional health regenerated out of combat, carried between ticks. */
  regen: number;
  /** Iron Skin: damage taken is halved until this time. */
  guardUntil: number;
  /** Bloodlust: hits heal until this time. */
  lifestealUntil: number;
  /** Empower (Wolf's Howl, Drakeblood): extra damage until this time. */
  empowerUntil: number;
  empower: number;
  /** A perfect dodge readies a counter: the next blow before this time strikes harder. */
  counterUntil: number;
  /** The dodge (its record time) a perfect evade came from, and the last one rewarded. */
  perfectDodge?: number;
  perfectRewarded?: number;
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
  /** Venom Edge: poison ticking until this time. */
  poisonUntil?: number;
  poisonNext?: number;
  poisonDmg?: number;
  poisonBy?: string;
  /** Death Mark: takes extra damage from everyone until this time. */
  markUntil?: number;
  /** Burning: fire ticking until this time. */
  burnUntil?: number;
  burnNext?: number;
  burnDmg?: number;
  burnBy?: string;
  /** Cursed: deals less damage and takes more until this time. */
  curseUntil?: number;
  /** Soaked: slower, and lightning and frost bite harder, until this time. */
  soakUntil?: number;
  /** Sundered: its armour counts for nothing, until this time. */
  sunderUntil?: number;
  /** Dazzled: one blow in three it throws goes wide, until this time. */
  dazzleUntil?: number;
  /** Elite affix (Affix.*). */
  affix: number;
  /** Threat per player (damage dealt, taunts), fading over time: the enemy fights whoever tops it. */
  threat: Map<string, number>;
  /** When the enemy next reconsiders who to fight (and a taunt holds it until then). */
  retargetAt: number;
  /** When its target first strayed past its leash range (0 while in range): it keeps after them a while. */
  strayAt: number;
  /** When a hurt enemy, home and left alone, starts to recover (0 until it settles). */
  restAt: number;
  /** It has already cried out for help in this fight. */
  calledHelp?: boolean;
  /** Shielded elites: what's left of the ward, and when it comes back if broken. */
  shield?: number;
  shieldAt?: number;
  /** Packleader: has it called its pack yet? */
  packCalled?: boolean;
  /** The level it spawned at; engaging a stronger player can raise it (see levelToTarget). */
  baseLevel: number;
  hpScale?: number;
  raised?: boolean;
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
  /** The skill's on-hit effect (burn, chill…). */
  special?: string;
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
  /** Sets what it hits burning (Meteor Storm). */
  burn?: boolean;
  /** Curses what it hits (Void Rift). */
  curse?: boolean;
  /** Soaks what it hits (Whirlpool). */
  soak?: boolean;
  /** Sunders what it hits (Steam Vent). */
  sunder?: boolean;
  /** Dazzles what it hits (Sandstorm). */
  dazzle?: boolean;
  /** Glyphs are safe spots, not damage. */
  safe?: boolean;
  lifeUntil: number;
}

export type Emit = (type: string, data: Record<string, unknown>, x: number, y: number) => void;

const SAFE_RESPAWN_MS = 2500;
/** Cursed enemies' blows land this much as hard. */
const CURSE_DAMAGE = 0.7;
/** Lightning strikes soaked enemies this much harder. */
const SOAK_SHOCK = 1.35;
/** A dazzled enemy's blows go wide this often. */
const DAZZLE_MISS = 1 / 3;
/** Shielded elites: the ward is this share of their health, and returns this long after the last blow. */
const SHIELD_SHARE = 0.2;
const SHIELD_BACK_MS = 8000;
/** Thorned elites send back this share of a melee blow. */
const THORNS = 0.12;
/** How long a taunt holds an enemy before it reconsiders. */
const TAUNT_MS = 3000;
/** A dodge that evades a blow within this many ticks of starting is perfect. */
const PERFECT_DODGE_TICKS = 4;
/** How long the counter from a perfect dodge waits for your next blow. */
const COUNTER_MS = 1500;
/** Share of elites that carry an affix. */
const AFFIX_CHANCE = 0.75;
export const RESPAWN_DELAY_MS = 9000;

/**
 * Level gaps, as in most MMOs: from three levels up your blows start to glance (12% less per
 * level beyond two, never below half), and enemies above you hit harder (6% per level, up to
 * 50%). Enemies below you hit a little softer (3% per level, down to 80%).
 */
export const levelGapDealt = (gap: number) => (gap >= 3 ? Math.max(0.5, 1 - 0.12 * (gap - 2)) : 1);
export const levelGapTaken = (gap: number) => (gap > 0 ? Math.min(1.5, 1 + 0.06 * gap) : Math.max(0.8, 1 + 0.03 * gap));

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
      regen: 0,
      guardUntil: 0,
      lifestealUntil: 0,
      empowerUntil: 0,
      empower: 0,
      counterUntil: 0,
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
    for (const ed of this.enemies.values()) {
      ed.threat.delete(sid);
      if (ed.target === sid) {
        ed.target = undefined;
        ed.token = undefined;
      }
    }
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
    if (m.special === "meteor" || m.special === "meteors" || m.special === "hailstorm" || m.special === "voidrift" || m.special === "whirlpool" || m.special === "steamvent" || m.special === "sandstorm") return; // detonates as hazards
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
        kind: pj.look === "wave" ? ProjKind.Wave : pj.look === "javelin" ? ProjKind.Javelin : pj.look === "fire" ? ProjKind.Fireball : pj.look === "ice" ? ProjKind.IceShard : pj.look === "void" ? ProjKind.VoidOrb : pj.look === "tide" ? ProjKind.TideWave : pj.look === "spark" ? ProjKind.Spark : pj.look === "sun" ? ProjKind.Sunbolt : pj.look === "knife" || WEAPONS[p.weapon].key === "daggers" ? ProjKind.Knife : ProjKind.Bolt,
        pierce: pj.look === "wave" || (pj.look === "tide" && pj.count === 1),
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
        special: m.special,
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
      case "meteors": {
        // Meteor Storm: six burning meteors scattered around the aim point, one after another.
        const shape = m.shape as Extract<Shape, { kind: "circle" }>;
        let cx = p.x + Math.cos(rad) * shape.offset;
        let cy = p.y + Math.sin(rad) * shape.offset;
        if (!this.wallClear(p.x, p.y, cx, cy)) {
          cx = p.x + Math.cos(rad) * shape.offset * 0.4;
          cy = p.y + Math.sin(rad) * shape.offset * 0.4;
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.random() * 0.8;
          const d = i === 0 ? 0 : shape.radius * (0.35 + Math.random() * 0.5);
          this.spawnHazard({ kind: HazardKind.Meteor, team: 0, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, radius: 46, delay: 600 + i * 170, damage: m.damage * pd.atkMul, poise: m.poise, knockback: m.knockback, heavy: true, sid: pd.sid, burn: true });
        }
        break;
      }
      case "hailstorm": {
        const shape = m.shape as Extract<Shape, { kind: "circle" }>;
        let cx = p.x + Math.cos(rad) * shape.offset;
        let cy = p.y + Math.sin(rad) * shape.offset;
        if (!this.wallClear(p.x, p.y, cx, cy)) {
          cx = p.x + Math.cos(rad) * shape.offset * 0.4;
          cy = p.y + Math.sin(rad) * shape.offset * 0.4;
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.random() * 0.8;
          const d = i === 0 ? 0 : shape.radius * (0.35 + Math.random() * 0.5);
          this.spawnHazard({ kind: HazardKind.Frost, team: 0, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, radius: 46, delay: 550 + i * 160, damage: m.damage * pd.atkMul, poise: m.poise, knockback: m.knockback, heavy: false, sid: pd.sid, frost: true });
        }
        break;
      }
      case "voidrift": {
        // Void Rift: a tear in the world where you aim that bites five times, cursing what it catches.
        const shape = m.shape as Extract<Shape, { kind: "circle" }>;
        let cx = p.x + Math.cos(rad) * shape.offset;
        let cy = p.y + Math.sin(rad) * shape.offset;
        if (!this.wallClear(p.x, p.y, cx, cy)) {
          cx = p.x + Math.cos(rad) * shape.offset * 0.4;
          cy = p.y + Math.sin(rad) * shape.offset * 0.4;
        }
        for (let i = 0; i < 5; i++) {
          this.spawnHazard({ kind: HazardKind.Void, team: 0, x: cx, y: cy, radius: shape.radius, delay: 450 + i * 420, damage: m.damage * pd.atkMul, poise: m.poise, knockback: m.knockback, heavy: false, sid: pd.sid, curse: true, life: 250 });
        }
        this.emit("fx", { k: "voidrift", x: cx, y: cy, r: shape.radius, ms: 450 + 5 * 420 }, cx, cy);
        break;
      }
      case "whirlpool": {
        // Whirlpool: churns five times where you aim, dragging in and soaking what it catches.
        const shape = m.shape as Extract<Shape, { kind: "circle" }>;
        let cx = p.x + Math.cos(rad) * shape.offset;
        let cy = p.y + Math.sin(rad) * shape.offset;
        if (!this.wallClear(p.x, p.y, cx, cy)) {
          cx = p.x + Math.cos(rad) * shape.offset * 0.4;
          cy = p.y + Math.sin(rad) * shape.offset * 0.4;
        }
        for (let i = 0; i < 5; i++) {
          this.spawnHazard({ kind: HazardKind.Tide, team: 0, x: cx, y: cy, radius: shape.radius, delay: 450 + i * 420, damage: m.damage * pd.atkMul, poise: m.poise, knockback: m.knockback, heavy: false, sid: pd.sid, soak: true, life: 250 });
        }
        this.emit("fx", { k: "whirlpool", x: cx, y: cy, r: shape.radius, ms: 450 + 5 * 420 }, cx, cy);
        break;
      }
      case "sandstorm": {
        // Sandstorm: scours five times where you aim, dazzling what it catches.
        const shape = m.shape as Extract<Shape, { kind: "circle" }>;
        let cx = p.x + Math.cos(rad) * shape.offset;
        let cy = p.y + Math.sin(rad) * shape.offset;
        if (!this.wallClear(p.x, p.y, cx, cy)) {
          cx = p.x + Math.cos(rad) * shape.offset * 0.4;
          cy = p.y + Math.sin(rad) * shape.offset * 0.4;
        }
        for (let i = 0; i < 5; i++) {
          this.spawnHazard({ kind: HazardKind.Sun, team: 0, x: cx, y: cy, radius: shape.radius, delay: 450 + i * 420, damage: m.damage * pd.atkMul, poise: m.poise, knockback: m.knockback, heavy: false, sid: pd.sid, dazzle: true, life: 250 });
        }
        this.emit("fx", { k: "sandstorm", x: cx, y: cy, r: shape.radius, ms: 450 + 5 * 420 }, cx, cy);
        break;
      }
      case "steamvent": {
        // Steam Vent: blasts five times where you aim, scalding and sundering what it catches.
        const shape = m.shape as Extract<Shape, { kind: "circle" }>;
        let cx = p.x + Math.cos(rad) * shape.offset;
        let cy = p.y + Math.sin(rad) * shape.offset;
        if (!this.wallClear(p.x, p.y, cx, cy)) {
          cx = p.x + Math.cos(rad) * shape.offset * 0.4;
          cy = p.y + Math.sin(rad) * shape.offset * 0.4;
        }
        for (let i = 0; i < 5; i++) {
          this.spawnHazard({ kind: HazardKind.Steam, team: 0, x: cx, y: cy, radius: shape.radius, delay: 450 + i * 420, damage: m.damage * pd.atkMul, poise: m.poise, knockback: m.knockback, heavy: false, sid: pd.sid, sunder: true, life: 250 });
        }
        this.emit("fx", { k: "steamvent", x: cx, y: cy, r: shape.radius, ms: 450 + 5 * 420 }, cx, cy);
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
          // A battle cry is a challenge: everything it reaches turns on you.
          if (m.special === "warcry") this.taunt(ed, pd);
          this.damageEnemy(ed, pd, m.damage, m.poise, m.knockback, ang, m);
        }
        const off = shape.kind === "circle" ? shape.offset : 0;
        const cx = p.x + Math.cos(rad) * off;
        const cy = p.y + Math.sin(rad) * off;
        this.emit("fx", { k: m.vfx === "blizzard" ? "blizzard" : m.special, x: cx, y: cy, r: (shape as { radius: number }).radius }, cx, cy);
        break;
      }
      case "rally": {
        // Heal yourself 18% and allies in range 12%.
        const r = (m.shape as { radius: number } | undefined)?.radius ?? 110;
        for (const other of this.players.values()) {
          const q = other.p;
          if (q.act === Act.Dead || q.hp <= 0) continue;
          const self = other === pd;
          if (!self && Math.hypot(q.x - p.x, q.y - p.y) > r) continue;
          const heal = Math.max(1, Math.min(q.hpMax - q.hp, Math.round(q.hpMax * (self ? 0.18 : 0.12))));
          if (q.hp < q.hpMax) {
            q.hp += heal;
            this.emit("heal", { p: other.sid, d: heal, x: q.x, y: q.y }, q.x, q.y);
          }
        }
        this.emit("fx", { k: m.vfx ?? "rally", x: p.x, y: p.y, r, p: pd.sid }, p.x, p.y);
        break;
      }
      case "storm": {
        // Storm Call: lightning falls on up to five enemies around you, one after another.
        const near = [...this.enemies.values()]
          .filter((ed) => ed.e.act !== EAct.Dead && ed.e.act !== EAct.Spawn && ed.def.behavior !== "dummy" && Math.hypot(ed.e.x - p.x, ed.e.y - p.y) < 240)
          .sort((a, b) => Math.hypot(a.e.x - p.x, a.e.y - p.y) - Math.hypot(b.e.x - p.x, b.e.y - p.y))
          .slice(0, 5);
        near.forEach((ed, i) => {
          this.spawnHazard({ kind: HazardKind.Lightning, team: 0, x: ed.e.x, y: ed.e.y, radius: 30, delay: 350 + i * 130, damage: m.damage * pd.atkMul, poise: m.poise, knockback: m.knockback, heavy: false, sid: pd.sid, life: 300 });
        });
        this.emit("fx", { k: "storm", x: p.x, y: p.y, r: 240 }, p.x, p.y);
        break;
      }
      case "phoenix": {
        // Phoenix Rite: rise in fire — heal yourself half, allies a quarter, and harden.
        for (const other of this.players.values()) {
          const q = other.p;
          if (q.act === Act.Dead || q.hp <= 0) continue;
          const self = other === pd;
          if (!self && Math.hypot(q.x - p.x, q.y - p.y) > 130) continue;
          const heal = Math.max(0, Math.min(q.hpMax - q.hp, Math.round(q.hpMax * (self ? 0.5 : 0.25))));
          if (heal) {
            q.hp += heal;
            this.emit("heal", { p: other.sid, d: heal, x: q.x, y: q.y }, q.x, q.y);
          }
        }
        pd.guardUntil = this.now + 4000;
        this.emit("fx", { k: "phoenix", x: p.x, y: p.y, p: pd.sid, ms: 4000 }, p.x, p.y);
        break;
      }
      case "ironskin": {
        pd.guardUntil = this.now + 5000;
        this.emit("fx", { k: "ironskin", x: p.x, y: p.y, p: pd.sid, ms: 5000 }, p.x, p.y);
        break;
      }
      case "empower": {
        pd.empowerUntil = this.now + 6000;
        pd.empower = m.power ?? 0.15;
        this.emit("fx", { k: "empower", x: p.x, y: p.y, p: pd.sid, ms: 6000, r: Math.round(pd.empower * 100) }, p.x, p.y);
        break;
      }
      case "bloodlust": {
        pd.lifestealUntil = this.now + 6000;
        this.emit("fx", { k: "bloodlust", x: p.x, y: p.y, p: pd.sid, ms: 6000 }, p.x, p.y);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Damage

  damageEnemy(ed: EnemyData, pd: PlayerData | undefined, base: number, poise: number, knockback: number, ang: number, m?: MoveDef, dot = false) {
    const e = ed.e;
    if (e.act === EAct.Dead || e.act === EAct.Spawn) return;
    if (dot) return this.dotDamage(ed, pd, base);
    if (e.act === EAct.Leash) {
      // Struck on its way home, it turns and fights, as long as whoever struck it is near enough
      // to chase. A blow from far beyond its reach glances off: no sniping from out of range.
      if (!pd || !this.ai.reengage(ed, pd)) {
        this.emit("hit", { t: ed.id, d: 0, r: HitResult.Blocked, x: e.x, y: e.y }, e.x, e.y);
        return;
      }
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
    let countered = false;
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
    if (e.act === EAct.Stagger && m?.vsStagger) dmg *= m.vsStagger;
    if (m?.special === "venom" && pd) {
      // Poison: a quarter of the hit again, every half second for six seconds.
      ed.poisonUntil = this.now + 6000;
      ed.poisonNext = Math.min(ed.poisonNext ?? Infinity, this.now + 500);
      ed.poisonDmg = base * 0.25;
      ed.poisonBy = pd.sid;
      e.flags |= EFlag.Poisoned;
    }
    if (attacker && attacker.act === Act.Light && pd?.ch?.hasPerk("momentum")) dmg *= 1 + Math.min(0.25, attacker.combo * 0.05);
    if (ed.markUntil && this.now < ed.markUntil) dmg *= 1.3;
    if (e.flags & EFlag.Cursed) dmg *= dv?.effects.has("setVoid") ? 1.18 : 1.1;
    if (e.flags & EFlag.Sundered) {
      poise *= 1.5;
      if (dv?.effects.has("setBrass")) dmg *= 1.1;
    }
    if (e.flags & EFlag.Dazzled && (dv?.effects.has("setSolar") || pd?.ch?.hasPerk("sunstrike"))) dmg *= 1.1;
    if (e.flags & EFlag.Soaked) {
      if (m?.vfx === "lightning" || m?.vfx === "storm") dmg *= SOAK_SHOCK;
      if (dv?.effects.has("setTide")) dmg *= 1.1;
    }
    if (pd && this.now < pd.counterUntil) {
      // The counter after a perfect dodge.
      dmg *= 1.5;
      crit = Math.max(crit, 1);
      pd.counterUntil = 0;
      countered = true;
      this.emit("fx", { k: "counter", x: e.x, y: e.y }, e.x, e.y);
    }
    if (ed.affix === Affix.Warded && e.hp > e.hpMax / 2) dmg *= 0.65;
    if (pd && this.now < pd.empowerUntil) dmg *= 1 + pd.empower;
    if (pd?.ch) {
      if (def.boss && pd.ch.hasPerk("wyrmsbane")) dmg *= 1.15;
      if (pd.p.hp < pd.p.hpMax * 0.35 && pd.ch.hasPerk("lastStand")) dmg *= 1.2;
    }
    if (pd && (m?.special === "burn" || (pd.ch?.hasPerk("emberblood") && Math.random() < 0.15) || (dv?.effects.has("setDragon") && Math.random() < 0.2))) this.ignite(ed, pd, base);
    if (dv?.effects.has("setFrost") && Math.random() < 0.25) this.chill(ed);
    if (dv?.effects.has("setVoid") && Math.random() < 0.25) this.curse(ed);
    if (pd && dv?.effects.has("setStorm") && Math.random() < 0.125) {
      // Stormglass: lightning follows the blow down.
      this.spawnHazard({ kind: HazardKind.Lightning, team: 0, x: e.x, y: e.y, radius: 34, delay: 180, damage: base * 0.6 * pd.atkMul, poise: 20, knockback: 60, heavy: false, sid: pd.sid, life: 300 });
    }
    if (m?.special === "chill" || (pd?.ch?.hasPerk("frostblood") && Math.random() < 0.2)) this.chill(ed);
    if (m?.special === "curse" || m?.curse || (pd?.ch?.hasPerk("umbralTouch") && Math.random() < 0.2) || (dv?.effects.has("moonstone") && Math.random() < 0.125)) this.curse(ed);
    if (pd && m && e.flags & EFlag.Soaked && pd.ch?.hasPerk("stormcaller") && Math.random() < 0.25) {
      // Stormcaller: lightning finds the soaked.
      this.spawnHazard({ kind: HazardKind.Lightning, team: 0, x: e.x, y: e.y, radius: 32, delay: 160, damage: base * 0.5 * pd.atkMul, poise: 20, knockback: 50, heavy: false, sid: pd.sid, life: 300 });
    }
    const heavyBlow = attacker && (attacker.act === Act.Heavy || attacker.act === Act.Skill);
    if (m?.special === "sunder" || m?.sunder || (m && heavyBlow && pd?.ch?.hasPerk("siegebreaker")) || (dv?.effects.has("tinkercog") && Math.random() < 1 / 6) || (dv?.effects.has("setBrass") && Math.random() < 0.3)) this.sunder(ed);
    // Dazzle: sun arts, the Solar set, the Golden Scarab, and Sunstrike's ripostes and counters.
    if (m?.dazzle || ((crit === 2 || countered) && pd?.ch?.hasPerk("sunstrike")) || (dv?.effects.has("goldscarab") && Math.random() < 1 / 6) || (dv?.effects.has("setSolar") && Math.random() < 0.3)) this.dazzle(ed);
    if (m?.special === "soak" || m?.soak || (dv?.effects.has("tideshell") && Math.random() < 1 / 6) || (dv?.effects.has("setTide") && Math.random() < 0.3)) this.soak(ed);
    if (pd?.ch) dmg *= levelGapDealt(e.level - pd.ch.data.level);
    // Hunter's Lore: you know how to kill what you've killed many times.
    if (pd?.ch) dmg *= 1 + huntBonus(pd.ch.data.hunts?.[def.key]);
    if (m?.special === "mark" && pd) {
      ed.markUntil = this.now + 6000;
      e.flags |= EFlag.Marked;
    }
    dmg *= 1 - (e.flags & EFlag.Sundered ? 0 : def.armor);
    let amount = Math.max(1, Math.round(dmg));
    // Shielded: the ward takes the blow first; once broken it returns after a while unhit.
    if (ed.affix === Affix.Shielded) {
      ed.shieldAt = this.now + SHIELD_BACK_MS;
      if (ed.shield === undefined) ed.shield = Math.round(e.hpMax * SHIELD_SHARE);
      if (ed.shield > 0) {
        const soak = Math.min(ed.shield, amount);
        ed.shield -= soak;
        amount -= soak;
        if (ed.shield <= 0) {
          e.flags &= ~EFlag.Shielded;
          this.emit("fx", { k: "shieldbreak", x: e.x, y: e.y, t: ed.id }, e.x, e.y);
        }
        if (amount <= 0) {
          if (pd) {
            this.addThreat(ed, pd, soak);
            pd.combatUntil = this.now + 6000;
            if (!ed.target) ed.target = pd.sid;
          }
          this.emit("hit", { t: ed.id, d: 0, r: HitResult.Blocked, x: e.x, y: e.y, a: pd?.sid }, e.x, e.y);
          return;
        }
      }
    }
    // Credit (kill share, weapon mastery) counts only health actually removed, never overkill.
    const dealt = Math.min(amount, e.hp);
    e.hp = Math.max(0, e.hp - amount);
    // Life Drain heals 40% of what it deals; Bloodlust makes every hit heal 20%.
    const steal = pd ? (m?.special === "drain" ? 0.4 : 0) + (this.now < pd.lifestealUntil ? 0.2 : 0) : 0;
    if (pd && steal && pd.p.act !== Act.Dead && pd.p.hp < pd.p.hpMax) {
      const heal = Math.min(pd.p.hpMax - pd.p.hp, Math.max(1, Math.round(dealt * steal)));
      pd.p.hp += heal;
      this.emit("heal", { p: pd.sid, d: heal, x: pd.p.x, y: pd.p.y }, pd.p.x, pd.p.y);
    }
    if (pd) {
      ed.contrib.set(pd.sid, (ed.contrib.get(pd.sid) ?? 0) + dealt);
      this.addThreat(ed, pd, dealt);
      pd.combatUntil = this.now + 6000;
      if (!ed.target && def.behavior !== "dummy") ed.target = pd.sid;
    }
    this.emit("hit", { t: ed.id, d: amount, c: crit, r: HitResult.Hit, x: e.x, y: e.y, a: pd?.sid, hs: m?.hitstop ?? 50, im: m?.impact ?? 0.1 }, e.x, e.y);
    if (pd) this.onDamageDealt?.(pd, ed, dealt);
    if (ed.affix === Affix.Packleader && !ed.packCalled && e.hp > 0 && e.hp < e.hpMax / 2) this.callPack(ed, pd);
    // Thorned: strike it up close and some of the blow comes back (never enough to kill you).
    if (ed.affix === Affix.Thorned && pd && attacker && attacker.act !== Act.Dead && Math.hypot(attacker.x - e.x, attacker.y - e.y) < 120 + def.radius) {
      const back = Math.min(attacker.hp - 1, Math.max(1, Math.round(dealt * THORNS)));
      if (back > 0) {
        attacker.hp -= back;
        this.emit("hit", { t: `p:${pd.sid}`, d: back, r: HitResult.Armor, x: attacker.x, y: attacker.y, heavy: 0, mis: 0, ang: 0 }, attacker.x, attacker.y);
        this.emit("fx", { k: "thorns", x: attacker.x, y: attacker.y, x2: e.x, y2: e.y }, attacker.x, attacker.y);
      }
    }
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
    if (ed.affix === Affix.Volatile) {
      this.spawnHazard({ kind: HazardKind.Meteor, team: 1, x: e.x, y: e.y, radius: 78, delay: 1100, damage: 24 * this.enemyDamageMul(ed), poise: 0, knockback: 220, heavy: true, life: 300 });
    }
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
      if (elapsed >= d.iStart * TICK_MS - TIMING_TOLERANCE_MS && elapsed < d.iEnd * TICK_MS + TIMING_TOLERANCE_MS) {
        // Dodged at the last moment: a perfect dodge.
        if (elapsed <= PERFECT_DODGE_TICKS * TICK_MS + TIMING_TOLERANCE_MS) pd.perfectDodge = rec.r;
        return HitResult.Evade;
      }
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
      const perfect = pd.perfectDodge;
      pd.perfectDodge = undefined;
      if (perfect !== undefined && perfect !== pd.perfectRewarded) {
        // A perfect dodge: stamina back, and the next blow is a counter.
        pd.perfectRewarded = perfect;
        pd.counterUntil = this.now + COUNTER_MS;
        p.stamina = Math.min(p.staminaMax, p.stamina + 20);
        if (pd.ch?.hasPerk("tidalGrace") && p.hp < p.hpMax) {
          const heal = Math.min(p.hpMax - p.hp, Math.round(p.hpMax * 0.1));
          p.hp += heal;
          this.emit("heal", { p: pd.sid, d: heal, x, y }, x, y);
        }
        this.emit("fx", { k: "perfectdodge", x, y, p: pd.sid }, x, y);
      }
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
    // Dazzled: one blow in three it throws goes wide.
    const dazzler = source.ed ?? (source.proj?.enemyId ? this.enemies.get(source.proj.enemyId) : undefined);
    if (dazzler && dazzler.e.flags & EFlag.Dazzled && Math.random() < DAZZLE_MISS) {
      this.emit("evade", { p: pd.sid, x, y }, x, y);
      this.emit("fx", { k: "dazzlemiss", x, y, p: pd.sid }, x, y);
      return;
    }
    if (pd.ch?.hasPerk("nightveil") && Math.random() < 0.1) {
      // Nightveil: the blow passes through your shadow.
      this.emit("evade", { p: pd.sid, x, y }, x, y);
      this.emit("fx", { k: "nightveil", x, y, p: pd.sid }, x, y);
      return;
    }
    const mistimed = pd.timeline.length > 0 && pd.timeline[pd.timeline.length - 1].act === Act.Parry && p.act === Act.Parry;
    let amount = Math.max(1, Math.round((dmg * 100) / (100 + pd.defense)));
    if (this.now < pd.guardUntil) amount = Math.max(1, Math.round(amount * 0.5));
    const src = source.ed ?? (source.proj?.enemyId ? this.enemies.get(source.proj.enemyId) : undefined);
    if (src && pd.ch) amount = Math.max(1, Math.round(amount * levelGapTaken(src.e.level - pd.ch.data.level)));
    if (result === HitResult.Armor) amount = Math.round(amount * 0.75);
    p.hp = Math.max(0, p.hp - amount);
    if (src?.affix === Affix.Vampiric && src.e.act !== EAct.Dead && src.e.hp < src.e.hpMax) {
      src.e.hp = Math.min(src.e.hpMax, src.e.hp + Math.round(amount * 2));
      this.emit("fx", { k: "vampiric", x: src.e.x, y: src.e.y, x2: x, y2: y }, src.e.x, src.e.y);
    }
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
    return enemyDamageScale(ed.def, ed.e.level, (ed.e.flags & EFlag.Elite) !== 0) * (ed.e.flags & EFlag.Cursed ? CURSE_DAMAGE : 1);
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
    damage: number; poise: number; knockback: number; sid?: string; enemyId?: string; atk?: EnemyAttack; weapon?: number; pierce?: boolean; special?: string;
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
    this.projectiles.set(id, { id, pr, damage: o.damage, poise: o.poise, knockback: o.knockback, atk: o.atk, enemyId: o.enemyId, sid: o.sid, weapon: o.weapon, pierce: !!o.pierce, hits: new Set(), special: o.special });
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

  spawnHazard(o: { kind: number; team: number; x: number; y: number; radius: number; delay: number; damage: number; poise: number; knockback: number; heavy: boolean; sid?: string; enemyId?: string; safe?: boolean; life?: number; burn?: boolean; frost?: boolean; curse?: boolean; soak?: boolean; sunder?: boolean; dazzle?: boolean }) {
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
    this.hazards.set(id, { id, hz, damage: o.damage, poise: o.poise, knockback: o.knockback, heavy: o.heavy, sid: o.sid, enemyId: o.enemyId, resolved: new Set(), safe: o.safe, burn: o.burn, frost: o.frost, curse: o.curse, soak: o.soak, sunder: o.sunder, dazzle: o.dazzle, lifeUntil: this.now + o.delay + (o.life ?? 600) });
    return id;
  }

  /** Damage over time: no stagger, no knockback, no hitstop; small green numbers. */
  private dotDamage(ed: EnemyData, pd: PlayerData | undefined, base: number) {
    const e = ed.e;
    const amount = Math.max(1, Math.round(base * (pd?.atkMul ?? 1) * (pd?.ch?.derived.mdmg.dmg ?? 1) * (1 - ed.def.armor)));
    const dealt = Math.min(amount, e.hp);
    e.hp = Math.max(0, e.hp - amount);
    if (pd) {
      ed.contrib.set(pd.sid, (ed.contrib.get(pd.sid) ?? 0) + dealt);
      this.addThreat(ed, pd, dealt);
    }
    this.emit("hit", { t: ed.id, d: amount, r: HitResult.Hit, x: e.x, y: e.y, a: pd?.sid, dot: 1 }, e.x, e.y);
    if (pd) this.onDamageDealt?.(pd, ed, dealt);
    if (e.hp <= 0) {
      // Training dummies and the sparring knight can't die, not even to poison or fire.
      if (ed.def.behavior === "dummy" || ed.def.behavior === "sparring") e.hp = e.hpMax;
      else this.killEnemy(ed, pd);
    }
  }

  /** Sunder an enemy: its armour counts for nothing and it staggers half again as fast, for a few seconds. */
  /** Dazzle an enemy: one blow in three it throws goes wide, for a few seconds. */
  dazzle(ed: EnemyData, ms = 5000) {
    if (ed.e.act === EAct.Dead) return;
    const was = (ed.e.flags & EFlag.Dazzled) !== 0;
    ed.dazzleUntil = Math.max(ed.dazzleUntil ?? 0, this.now + ms);
    ed.e.flags |= EFlag.Dazzled;
    if (!was) this.emit("fx", { k: "dazzled", x: ed.e.x, y: ed.e.y, t: ed.id }, ed.e.x, ed.e.y);
  }

  sunder(ed: EnemyData, ms = 5000) {
    const was = (ed.e.flags & EFlag.Sundered) !== 0;
    ed.sunderUntil = Math.max(ed.sunderUntil ?? 0, this.now + ms);
    ed.e.flags |= EFlag.Sundered;
    if (!was) this.emit("fx", { k: "sundered", x: ed.e.x, y: ed.e.y, t: ed.id }, ed.e.x, ed.e.y);
  }

  /** Soak an enemy: slower, and lightning and frost bite it harder, for a few seconds. */
  soak(ed: EnemyData, ms = 6000) {
    const was = (ed.e.flags & EFlag.Soaked) !== 0;
    ed.soakUntil = Math.max(ed.soakUntil ?? 0, this.now + ms);
    ed.e.flags |= EFlag.Soaked;
    if (!was) this.emit("fx", { k: "soaked", x: ed.e.x, y: ed.e.y, t: ed.id }, ed.e.x, ed.e.y);
  }

  /** Chill an enemy: slower to move (and to wind up its attacks) for a few seconds. Soaked enemies stay chilled twice as long. */
  chill(ed: EnemyData, ms = 3500) {
    if (ed.e.flags & EFlag.Soaked) ms *= 2;
    ed.slowUntil = Math.max(ed.slowUntil, this.now + ms);
    ed.e.flags |= EFlag.Chilled;
  }

  /** Damage (and damage over time) builds threat on whoever dealt it. */
  private addThreat(ed: EnemyData, pd: PlayerData, amount: number) {
    if (ed.def.behavior === "dummy" || ed.def.behavior === "sparring") return;
    ed.threat.set(pd.sid, (ed.threat.get(pd.sid) ?? 0) + amount);
  }

  /** Taunt: this player becomes the enemy's target at once, and stays it for a few seconds. */
  taunt(ed: EnemyData, pd: PlayerData) {
    if (ed.def.behavior === "dummy" || ed.def.behavior === "sparring" || ed.e.act === EAct.Dead) return;
    let top = 0;
    for (const v of ed.threat.values()) top = Math.max(top, v);
    ed.threat.set(pd.sid, top * 1.5 + 50);
    if (ed.target !== pd.sid) {
      this.releaseToken(ed);
      ed.target = pd.sid;
    }
    ed.e.flags |= EFlag.Aggro;
    ed.retargetAt = this.now + TAUNT_MS;
    this.emit("fx", { k: "taunt", x: ed.e.x, y: ed.e.y, t: ed.id }, ed.e.x, ed.e.y);
  }

  /** Packleader: two of its kind answer when it is badly hurt. */
  private callPack(ed: EnemyData, pd?: PlayerData) {
    ed.packCalled = true;
    const e = ed.e;
    // Two answer the call, wherever there is room beside the leader.
    let called = 0;
    for (let tries = 0; tries < 12 && called < 2; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 36 + Math.random() * 40;
      const spot = { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * 0.7 };
      const tx = Math.floor(spot.x / 32);
      const ty = Math.floor(spot.y / 32);
      if (this.map.isSolidTile(tx, ty)) continue;
      called++;
      const m = this.spawnEnemy(ed.def.key, spot.x, spot.y, { level: e.level, master: ed.id });
      m.homeX = ed.homeX;
      m.homeY = ed.homeY;
      if (pd) m.target = pd.sid;
      ed.minions.add(m.id);
    }
    this.emit("fx", { k: "summon", x: e.x, y: e.y }, e.x, e.y);
  }

  /** Curse an enemy: its blows land 30% softer and it takes 10% more damage, for a few seconds. */
  curse(ed: EnemyData, ms = 5000) {
    const was = (ed.e.flags & EFlag.Cursed) !== 0;
    ed.curseUntil = Math.max(ed.curseUntil ?? 0, this.now + ms);
    ed.e.flags |= EFlag.Cursed;
    if (!was) this.emit("fx", { k: "cursed", x: ed.e.x, y: ed.e.y, t: ed.id }, ed.e.x, ed.e.y);
  }

  /** Set an enemy burning: an eighth of the blow again, every half second for four seconds. */
  ignite(ed: EnemyData, pd: PlayerData, base: number) {
    const burning = ed.burnUntil !== undefined && this.now < ed.burnUntil;
    ed.burnUntil = this.now + 4000;
    ed.burnNext = Math.min(ed.burnNext ?? Infinity, this.now + 500);
    ed.burnDmg = Math.max(burning ? ed.burnDmg ?? 0 : 0, base * 0.125);
    ed.burnBy = pd.sid;
    ed.e.flags |= EFlag.Burning;
  }

  private updatePoison() {
    for (const ed of this.enemies.values()) {
      if (ed.markUntil && (this.now > ed.markUntil || ed.e.act === EAct.Dead)) {
        ed.markUntil = undefined;
        ed.e.flags &= ~EFlag.Marked;
      }
      if (ed.curseUntil && (this.now > ed.curseUntil || ed.e.act === EAct.Dead)) {
        ed.curseUntil = undefined;
        ed.e.flags &= ~EFlag.Cursed;
      }
      if (ed.soakUntil && (this.now > ed.soakUntil || ed.e.act === EAct.Dead)) {
        ed.soakUntil = undefined;
        ed.e.flags &= ~EFlag.Soaked;
      }
      if (ed.dazzleUntil && (this.now > ed.dazzleUntil || ed.e.act === EAct.Dead)) {
        ed.dazzleUntil = undefined;
        ed.e.flags &= ~EFlag.Dazzled;
      }
      if (ed.sunderUntil && (this.now > ed.sunderUntil || ed.e.act === EAct.Dead)) {
        ed.sunderUntil = undefined;
        ed.e.flags &= ~EFlag.Sundered;
      }
      if (ed.burnUntil) {
        if (this.now > ed.burnUntil || ed.e.act === EAct.Dead) {
          ed.burnUntil = undefined;
          ed.burnNext = undefined;
          ed.burnDmg = undefined;
          ed.e.flags &= ~EFlag.Burning;
        } else if (this.now >= (ed.burnNext ?? 0)) {
          ed.burnNext = this.now + 500;
          this.damageEnemy(ed, ed.burnBy ? this.players.get(ed.burnBy) : undefined, ed.burnDmg ?? 1, 0, 0, 0, undefined, true);
          if (ed.e.act === EAct.Dead) continue;
        }
      }
      if (!ed.poisonUntil) continue;
      if (this.now > ed.poisonUntil || ed.e.act === EAct.Dead) {
        ed.poisonUntil = undefined;
        ed.poisonNext = undefined;
        ed.e.flags &= ~EFlag.Poisoned;
        continue;
      }
      if (this.now >= (ed.poisonNext ?? 0)) {
        ed.poisonNext = this.now + 500;
        this.damageEnemy(ed, ed.poisonBy ? this.players.get(ed.poisonBy) : undefined, ed.poisonDmg ?? 1, 0, 0, 0, undefined, true);
      }
    }
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
        if (pj.special === "burn" && pd && ed.e.act !== EAct.Dead) {
          this.ignite(ed, pd, pj.damage / (pd.atkMul || 1));
          this.emit("fx", { k: "fireburst", x: pos.x, y: pos.y + 10 }, pos.x, pos.y);
        }
        if (pj.special === "chill" && ed.e.act !== EAct.Dead) {
          this.chill(ed);
          this.emit("fx", { k: "iceburst", x: pos.x, y: pos.y + 10 }, pos.x, pos.y);
        }
        if (pj.special === "dazzle" && ed.e.act !== EAct.Dead) {
          this.dazzle(ed);
          this.emit("fx", { k: "sunburst", x: pos.x, y: pos.y + 10 }, pos.x, pos.y);
        }
        if (pj.special === "sunder" && ed.e.act !== EAct.Dead) {
          this.sunder(ed);
          this.emit("fx", { k: "sparkburst", x: pos.x, y: pos.y + 10 }, pos.x, pos.y);
        }
        if (pj.special === "soak" && ed.e.act !== EAct.Dead) {
          this.soak(ed);
          this.emit("fx", { k: "splash", x: pos.x, y: pos.y + 10 }, pos.x, pos.y);
        }
        if (pj.special === "curse" && ed.e.act !== EAct.Dead) {
          this.curse(ed);
          this.emit("fx", { k: "voidburst", x: pos.x, y: pos.y + 10 }, pos.x, pos.y);
        }
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
          // Lightning strikes the soaked harder.
          const shock = hz.hz.kind === HazardKind.Lightning && e.flags & EFlag.Soaked ? SOAK_SHOCK : 1;
          this.damageEnemy(ed, pd, (hz.damage * shock) / (pd?.atkMul ?? 1), hz.poise, hz.knockback, Math.atan2(e.y - hz.hz.y, e.x - hz.hz.x));
          if (hz.soak && ed.e.act !== EAct.Dead) this.soak(ed);
          if (hz.sunder && ed.e.act !== EAct.Dead) this.sunder(ed);
          if (hz.dazzle && ed.e.act !== EAct.Dead) this.dazzle(ed);
          if (hz.burn && pd && ed.e.act !== EAct.Dead) this.ignite(ed, pd, hz.damage / (pd.atkMul || 1));
          if (hz.frost && ed.e.act !== EAct.Dead) this.chill(ed);
          if (hz.curse && ed.e.act !== EAct.Dead) this.curse(ed);
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

  spawnEnemy(defKey: string | number, x: number, y: number, opts: { level?: number; elite?: boolean; spawner?: string; master?: string; hpScale?: number; affix?: number } = {}): EnemyData {
    const idx = typeof defKey === "number" ? defKey : ENEMIES.findIndex((d) => d.key === defKey);
    const def = ENEMIES[idx];
    const id = this.id("e");
    const e = new Enemy();
    e.def = idx;
    e.x = Math.fround(x);
    e.y = Math.fround(y);
    e.aim = radToAim(Math.PI / 2);
    e.level = opts.level ?? 1;
    const hpMax = enemyMaxHp(def, e.level, opts.elite, opts.hpScale);
    e.hpMax = Math.min(65535, hpMax);
    e.hp = e.hpMax;
    e.flags = opts.elite ? EFlag.Elite : 0;
    // Most elites carry an affix (never bosses, dummies or summoned pack members).
    const affix = opts.affix ?? (opts.elite && !def.boss && def.behavior !== "dummy" && def.behavior !== "sparring" && !opts.master && Math.random() < AFFIX_CHANCE ? 1 + Math.floor(Math.random() * (AFFIXES.length - 1)) : 0);
    e.affix = affix;
    if (affix === Affix.Frenzied) e.flags |= EFlag.Enraged;
    if (affix === Affix.Shielded) e.flags |= EFlag.Shielded;
    e.act = EAct.Spawn;
    e.actStart = this.now;
    const ed: EnemyData = {
      id, e, def, spawner: opts.spawner, homeX: x, homeY: y, cooldowns: def.attacks.map(() => 0), attackSeq: 0, attacks: [],
      poiseDmg: 0, poiseAt: 0, flinches: 0, flinchAt: 0, hyperUntil: 0, stateUntil: this.now + 500, kbx: 0, kby: 0, pathAt: 0,
      orbit: Math.random() * Math.PI * 2, thinkAt: 0, contrib: new Map(), phase: 0, enrageUntil: 0, slowUntil: 0, minions: new Set(),
      master: opts.master, removeAt: 0, specialFired: 0, baseLevel: e.level, hpScale: opts.hpScale, affix, threat: new Map(), retargetAt: 0, strayAt: 0, restAt: 0,
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
    for (const ed of [...this.enemies.values()]) {
      this.levelToTarget(ed);
      this.ai.update(ed, dt);
    }
    this.updateProjectiles();
    this.updatePoison();
    this.updateHazards();
    this.resolveIncoming();
    for (const pd of this.players.values()) {
      const p = pd.p as unknown as PlayerSim;
      if (p.act === Act.Dead && this.now - pd.deadAt > RESPAWN_DELAY_MS) this.respawn(pd);
      // Out of combat, wounds close slowly (2% of max health a second, a few seconds after the last blow).
      if (pd.p.sit && (p.act !== Act.None || p.gait !== 0)) pd.p.sit = 0;
      if (p.act !== Act.Dead && pd.p.hp > 0 && pd.p.hp < pd.p.hpMax && this.now > pd.combatUntil) {
        // Sitting down to rest closes them faster.
        pd.regen += pd.p.hpMax * 0.02 * (pd.p.sit ? REST_REGEN : 1) * (pd.ch?.hasPerk("oasisHeart") ? 2 : 1) * dt;
        if (pd.regen >= 1) {
          const add = Math.floor(pd.regen);
          pd.regen -= add;
          pd.p.hp = Math.min(pd.p.hpMax, pd.p.hp + add);
        }
      } else pd.regen = 0;
      // Keep the server's view of hurt/knockdown timers moving even if the client stalls.
      if ((p.act === Act.Hurt || p.act === Act.Knockdown) && p.actTick > actionLength(p) + 30) p.act = Act.None;
    }
  }

  /**
   * Out-levelled monsters never become trivial: when a normal enemy engages a player, it
   * rises to that player's level less one, up to this floor's cap (0 = never, e.g. dungeons).
   * When it loses interest it settles back to its own level.
   */
  levelCap = 0;

  private levelToTarget(ed: EnemyData) {
    const e = ed.e;
    if (!this.levelCap || ed.def.boss || ed.def.behavior === "dummy" || ed.def.behavior === "sparring" || e.act === EAct.Dead) return;
    const setLevel = (level: number) => {
      if (level === e.level) return;
      const frac = e.hp / Math.max(1, e.hpMax);
      e.level = level;
      e.hpMax = Math.min(65535, enemyMaxHp(ed.def, level, (e.flags & EFlag.Elite) !== 0, ed.hpScale));
      e.hp = Math.max(1, Math.round(e.hpMax * frac));
    };
    if (ed.target && !ed.raised) {
      ed.raised = true;
      const pl = this.players.get(ed.target)?.ch?.data.level ?? 0;
      // (Never below its own level: one placed above the floor's cap stays as strong as it is.)
      const want = Math.max(ed.baseLevel, Math.min(this.levelCap, pl - 1));
      setLevel(want);
    } else if (!ed.target && ed.raised) {
      ed.raised = false;
      setLevel(ed.baseLevel);
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
