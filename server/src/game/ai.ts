import {
  aimToRad,
  angleDiff,
  EAct,
  EFlag,
  HazardKind,
  radToAim,
  TICK_MS,
  TILE,
  windupTicks,
  Act,
  type EnemyAttack,
} from "@floors/shared";
import type { EnemyData, PlayerData, Sim } from "./sim.ts";

const MELEE_TOKENS = 2;
const TURN_RATE = 7; // rad/s outside attacks

/** How often an enemy reconsiders who to fight (ms). */
const RETARGET_MS = 400;
/** Another player must top the current target's threat by this much (and 10) to pull the enemy away. */
const THREAT_MARGIN = 1.2;
/** Threat kept at each reconsideration (fades by about half every 4–5 seconds). */
const THREAT_FADE = 0.94;

/**
 * Leashing. An enemy in a fight doesn't give up the moment you step past its leash range: it
 * keeps after you for LEASH_GRACE_MS, up to LEASH_SLACK times its range. When it does go home
 * it keeps its wounds (no free heal on the way), turns and fights if you hit it on the way,
 * and only starts to recover once it has been home and left alone for REST_DELAY_MS.
 */
const LEASH_GRACE_MS = 5000;
const LEASH_SLACK = 1.5;
const REST_DELAY_MS = 8000;
/** Share of its health a resting enemy recovers per second. */
const REST_RATE = 0.04;

/** Frenzied elites stay enraged (Affix.Frenzied). */
const FRENZIED = 2;

/** Server-side enemy brains. One `update` per enemy per 60 Hz tick. */
export class EnemyAI {
  constructor(private sim: Sim) {}

  update(ed: EnemyData, dt: number) {
    const sim = this.sim;
    const e = ed.e;
    const now = sim.now;

    if (ed.enrageUntil && now > ed.enrageUntil) {
      ed.enrageUntil = 0;
      if (!ed.def.boss && ed.affix !== FRENZIED) e.flags &= ~EFlag.Enraged;
    }
    if (ed.slowUntil && now > ed.slowUntil) {
      ed.slowUntil = 0;
      e.flags &= ~EFlag.Chilled;
    }
    for (let i = 0; i < ed.cooldowns.length; i++) if (ed.cooldowns[i] > 0) ed.cooldowns[i]--;

    if (ed.kbx || ed.kby) {
      this.move(ed, ed.kbx * dt, ed.kby * dt);
      ed.kbx = Math.abs(ed.kbx) < 5 ? 0 : ed.kbx * 0.86;
      ed.kby = Math.abs(ed.kby) < 5 ? 0 : ed.kby * 0.86;
    }

    switch (e.act) {
      case EAct.Spawn:
        if (now >= ed.stateUntil) sim.setEnemyAct(ed, EAct.Idle);
        return;
      case EAct.Dead:
        if (ed.removeAt && now >= ed.removeAt) sim.removeEnemy(ed.id);
        return;
      case EAct.Hurt:
      case EAct.Stagger:
        if (now >= ed.stateUntil) {
          e.flags &= ~EFlag.Riposte;
          sim.setEnemyAct(ed, EAct.Idle);
        }
        return;
      case EAct.Attack:
        this.runAttack(ed, dt);
        return;
      case EAct.Leash:
        this.leash(ed, dt);
        return;
      default:
        this.think(ed, dt);
    }
  }

  // ---------------------------------------------------------------------------

  private target(ed: EnemyData): PlayerData | undefined {
    return ed.target ? this.sim.players.get(ed.target) : undefined;
  }

  private inSafeZone(x: number, y: number) {
    return !!this.sim.map.zoneAt(x, y)?.safe;
  }

  private validTarget(ed: EnemyData, pd: PlayerData | undefined, slack = 1): pd is PlayerData {
    if (!pd) return false;
    const p = pd.p;
    if (p.act === Act.Dead) return false;
    // The training yard's sparring partner lives inside the safe town on purpose.
    if (ed.def.behavior === "sparring") return Math.hypot(p.x - ed.e.x, p.y - ed.e.y) <= ed.def.aggroRange;
    if (this.inSafeZone(p.x, p.y)) return false;
    if (Math.hypot(p.x - ed.homeX, p.y - ed.homeY) > ed.def.leashRange * slack) return false;
    return true;
  }

  /**
   * Is the enemy still willing to fight this target? Past its leash range it gives chase for a
   * few seconds more (and never past the slack), instead of turning for home at once.
   */
  private keepsTarget(ed: EnemyData, pd: PlayerData | undefined): pd is PlayerData {
    if (!this.validTarget(ed, pd, LEASH_SLACK)) return false;
    if (ed.def.behavior === "sparring") return true;
    if (Math.hypot(pd.p.x - ed.homeX, pd.p.y - ed.homeY) <= ed.def.leashRange) {
      ed.strayAt = 0;
      return true;
    }
    if (!ed.strayAt) ed.strayAt = this.sim.now;
    return this.sim.now - ed.strayAt < LEASH_GRACE_MS;
  }

  /** Struck while walking home: turn and fight, if the attacker is near enough to chase. */
  reengage(ed: EnemyData, pd: PlayerData): boolean {
    if (!this.validTarget(ed, pd, LEASH_SLACK)) return false;
    ed.target = pd.sid;
    ed.strayAt = 0;
    ed.e.flags |= EFlag.Aggro;
    this.sim.setEnemyAct(ed, EAct.Idle);
    return true;
  }

  private acquire(ed: EnemyData) {
    const e = ed.e;
    let best: PlayerData | undefined;
    let bestD = ed.def.aggroRange * (e.flags & EFlag.Aggro ? 1.6 : 1);
    for (const pd of this.sim.players.values()) {
      const p = pd.p;
      if (!this.validTarget(ed, pd)) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d > bestD) continue;
      if (ed.def.behavior !== "sparring" && !this.sim.grid.lineClear(e.x, e.y, p.x, p.y, 1)) continue;
      best = pd;
      bestD = d;
    }
    if (best) {
      ed.target = best.sid;
      e.flags |= EFlag.Aggro;
      this.alertPack(ed, best.sid);
    }
  }

  /** The valid player with the most threat on this enemy, if anyone has any. */
  private topThreat(ed: EnemyData): PlayerData | undefined {
    let best: PlayerData | undefined;
    let bestT = 0;
    for (const [sid, t] of ed.threat) {
      if (t <= bestT) continue;
      const pd = this.sim.players.get(sid);
      if (!this.validTarget(ed, pd)) continue;
      best = pd;
      bestT = t;
    }
    return best;
  }

  /** Threat fades, so whoever is hitting it now counts more than whoever hit it long ago. */
  private fadeThreat(ed: EnemyData) {
    for (const [sid, t] of ed.threat) {
      const next = t * THREAT_FADE;
      if (next < 1 || !this.sim.players.has(sid)) ed.threat.delete(sid);
      else ed.threat.set(sid, next);
    }
  }

  /** Nearby idle allies join the fight. */
  private alertPack(ed: EnemyData, sid: string) {
    for (const other of this.sim.enemies.values()) {
      if (other === ed || other.target || other.def.behavior === "dummy" || other.def.behavior === "sparring") continue;
      if (other.spawner && other.spawner === ed.spawner) other.target = sid;
      else if (Math.hypot(other.e.x - ed.e.x, other.e.y - ed.e.y) < 110) other.target = sid;
    }
  }

  private think(ed: EnemyData, dt: number) {
    const sim = this.sim;
    const e = ed.e;
    const def = ed.def;
    if (def.behavior === "dummy") return;

    let pd = this.target(ed);
    if (ed.target && !this.keepsTarget(ed, pd)) {
      ed.threat.delete(ed.target);
      ed.target = undefined;
      ed.strayAt = 0;
      sim.releaseToken(ed);
      // Someone else has been hitting it: it turns on them instead of going home.
      pd = this.topThreat(ed);
      if (pd) ed.target = pd.sid;
      else ed.threat.clear();
      if (!pd && def.behavior !== "sparring" && Math.hypot(e.x - ed.homeX, e.y - ed.homeY) > 60) {
        sim.setEnemyAct(ed, EAct.Leash);
        e.flags &= ~EFlag.Aggro;
        return;
      }
    }
    // Its target is gone (left, or never picked): whoever else has been hitting it comes first.
    if (!pd && ed.threat.size) {
      pd = this.topThreat(ed);
      if (pd) ed.target = pd.sid;
    }
    if (!pd && sim.now >= ed.thinkAt) {
      ed.thinkAt = sim.now + 220 + Math.random() * 80;
      this.acquire(ed);
      pd = this.target(ed);
    }
    // Threat: every so often, fight whoever has clearly out-threatened the current target.
    if (pd && sim.now >= ed.retargetAt && def.behavior !== "sparring") {
      ed.retargetAt = sim.now + RETARGET_MS;
      this.fadeThreat(ed);
      const better = this.topThreat(ed);
      if (better && better.sid !== ed.target) {
        const cur = ed.threat.get(ed.target!) ?? 0;
        if ((ed.threat.get(better.sid) ?? 0) > cur * THREAT_MARGIN + 10) {
          sim.releaseToken(ed);
          ed.target = better.sid;
          pd = better;
        }
      }
    }
    if (!pd) {
      e.flags &= ~EFlag.Aggro;
      if (e.act === EAct.Guard) sim.setEnemyAct(ed, EAct.Idle);
      this.rest(ed);
      this.wander(ed, dt);
      return;
    }
    ed.restAt = 0;

    const p = pd.p;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    const toT = Math.atan2(dy, dx);
    this.turn(ed, toT, TURN_RATE * dt);

    switch (def.behavior) {
      case "sparring":
        this.sparring(ed, pd, d);
        return;
      case "boss":
        this.boss(ed, pd, d, toT, dt);
        return;
      default:
        this.fighter(ed, pd, d, toT, dt);
    }
  }

  private fighter(ed: EnemyData, pd: PlayerData, d: number, toT: number, dt: number) {
    const sim = this.sim;
    const e = ed.e;
    const def = ed.def;
    const p = pd.p;
    const speed = this.speed(ed);
    const [pmin, pmax] = def.preferred;
    const ranged = def.behavior === "ranged" || def.behavior === "caster";

    // Assassins stay veiled until they commit.
    if (def.behavior === "assassin") {
      if (d > 95) e.flags |= EFlag.Hidden;
      else e.flags &= ~EFlag.Hidden;
    }

    const choice = sim.now >= ed.thinkAt ? this.pickAttack(ed, d, pd) : undefined;
    if (choice !== undefined) {
      const atk = def.attacks[choice];
      const needsToken = !ranged && !atk.projectile && !atk.special;
      if (!needsToken || this.takeToken(ed, pd.sid)) {
        this.startAttack(ed, choice, pd);
        return;
      }
    }

    // Positioning.
    let gx = e.x;
    let gy = e.y;
    let spd = speed;
    const hasToken = ed.token === pd.sid;
    if (ranged && !sim.grid.lineClear(e.x, e.y, p.x, p.y, 1)) {
      gx = p.x;
      gy = p.y;
    } else if (ranged) {
      if (d < pmin) {
        const blink = def.attacks.findIndex((a) => a.special === "blink");
        if (blink >= 0 && ed.cooldowns[blink] === 0 && d < 70) {
          this.startAttack(ed, blink, pd);
          return;
        }
        gx = e.x - Math.cos(toT) * 60;
        gy = e.y - Math.sin(toT) * 60;
        spd *= 0.85;
      } else if (d > pmax) {
        gx = p.x;
        gy = p.y;
      } else {
        ed.orbit += dt * 0.5;
        const a = toT + Math.PI + Math.sin(ed.orbit) * 0.9;
        gx = p.x + Math.cos(a) * (pmin + pmax) / 2;
        gy = p.y + Math.sin(a) * (pmin + pmax) / 2;
        spd *= 0.55;
      }
    } else if (def.behavior === "pack" || def.behavior === "assassin" || !hasToken) {
      // Circle the target, waiting for an opening (and for an attack token).
      const ring = hasToken ? Math.max(20, pmin * 0.5) : Math.max(pmin, 64);
      ed.orbit += dt * (def.behavior === "pack" ? 0.9 : 0.6) * (ed.id.charCodeAt(ed.id.length - 1) % 2 ? 1 : -1);
      const a = toT + Math.PI + Math.sin(ed.orbit) * 1.2;
      gx = p.x + Math.cos(a) * ring;
      gy = p.y + Math.sin(a) * ring;
      spd *= hasToken ? 1 : 0.7;
    } else {
      gx = p.x - Math.cos(toT) * Math.max(16, pmin);
      gy = p.y - Math.sin(toT) * Math.max(16, pmin);
    }

    // Shieldbearers raise their guard when threatened and advance behind it.
    if (def.behavior === "defender") {
      if (d < 130) {
        if (e.act !== EAct.Guard) sim.setEnemyAct(ed, EAct.Guard);
        spd *= 0.6;
      } else if (e.act === EAct.Guard) sim.setEnemyAct(ed, EAct.Move);
    } else {
      const moving = Math.hypot(gx - e.x, gy - e.y) > 6;
      if (e.act !== (moving ? EAct.Move : EAct.Idle)) sim.setEnemyAct(ed, moving ? EAct.Move : EAct.Idle);
    }
    this.goTo(ed, gx, gy, spd, dt);
  }

  private sparring(ed: EnemyData, pd: PlayerData, d: number) {
    const sim = this.sim;
    if (sim.now < ed.thinkAt || d > ed.def.aggroRange) return;
    const idx = Math.floor(ed.orbit) % ed.def.attacks.length;
    ed.orbit = Math.floor(ed.orbit) + 1;
    this.startAttack(ed, idx, pd);
  }

  private boss(ed: EnemyData, pd: PlayerData, d: number, toT: number, dt: number) {
    const sim = this.sim;
    const e = ed.e;
    const def = ed.def;
    if (sim.now >= ed.thinkAt) {
      const choice = this.pickAttack(ed, d, pd);
      if (choice !== undefined) {
        this.startAttack(ed, choice, pd);
        return;
      }
    }
    const [pmin, pmax] = def.preferred;
    let gx = pd.p.x - Math.cos(toT) * pmin;
    let gy = pd.p.y - Math.sin(toT) * pmin;
    let spd = this.speed(ed);
    if (d < pmax) {
      ed.orbit += dt * 0.7;
      const a = toT + Math.PI + Math.sin(ed.orbit) * 0.8;
      gx = pd.p.x + Math.cos(a) * pmax;
      gy = pd.p.y + Math.sin(a) * pmax;
      spd *= 0.45;
    }
    const moving = Math.hypot(gx - e.x, gy - e.y) > 6;
    if (e.act !== (moving ? EAct.Move : EAct.Idle)) sim.setEnemyAct(ed, moving ? EAct.Move : EAct.Idle);
    this.goTo(ed, gx, gy, spd, dt);
  }

  private pickAttack(ed: EnemyData, d: number, pd: PlayerData): number | undefined {
    const def = ed.def;
    let total = 0;
    const options: number[] = [];
    for (let i = 0; i < def.attacks.length; i++) {
      const a = def.attacks[i];
      if (!a.weight || ed.cooldowns[i] > 0) continue;
      if ((a.phase ?? 0) > ed.phase) continue;
      if (d > a.range || d < (a.minRange ?? 0)) continue;
      if (a.special === "blink") continue;
      if (a.special === "summon" && ed.minions.size >= 2) continue;
      if ((a.projectile || a.range > 100) && !this.sim.grid.lineClear(ed.e.x, ed.e.y, pd.p.x, pd.p.y, 1)) continue;
      options.push(i);
      total += a.weight;
    }
    if (!options.length) return undefined;
    let r = Math.random() * total;
    for (const i of options) {
      r -= def.attacks[i].weight!;
      if (r <= 0) return i;
    }
    return options[options.length - 1];
  }

  private takeToken(ed: EnemyData, sid: string): boolean {
    if (ed.token === sid) return true;
    let set = this.sim.tokens.get(sid);
    if (!set) this.sim.tokens.set(sid, (set = new Set()));
    if (set.size >= MELEE_TOKENS) return false;
    set.add(ed.id);
    ed.token = sid;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Attacks

  startAttack(ed: EnemyData, idx: number, pd?: PlayerData) {
    const sim = this.sim;
    const e = ed.e;
    const atk = ed.def.attacks[idx];
    if (pd) {
      e.aim = radToAim(Math.atan2(pd.p.y - e.y, pd.p.x - e.x));
      if (atk.targeted) {
        e.ax = pd.p.x;
        e.ay = pd.p.y;
      }
    }
    sim.setEnemyAct(ed, EAct.Attack, idx);
    e.flags &= ~EFlag.Hidden;
    ed.cooldowns[idx] = atk.cooldown;
    ed.specialFired = 0;
    if (atk.special === "judgement") this.judgementGlyphs(ed, atk);
    if (atk.special === "sigils") this.placeSigils(ed, atk);
  }

  private runAttack(ed: EnemyData, dt: number) {
    const sim = this.sim;
    const e = ed.e;
    const atk = ed.def.attacks[e.atk];
    const wind = windupTicks(atk, e.flags);
    const tick = Math.floor((sim.now - e.actStart) / TICK_MS);
    const total = wind + atk.active + atk.recovery;
    const pd = this.target(ed);

    // Track the target early in the windup, then commit so a late sidestep works.
    if (pd && tick < wind * 0.6 && !atk.targeted) {
      this.turn(ed, Math.atan2(pd.p.y - e.y, pd.p.x - e.x), 4.2 * dt);
    }
    if (atk.lunge) {
      const from = Math.floor(wind * 0.66);
      const to = wind + atk.active;
      if (tick >= from && tick < to) {
        const per = atk.lunge / (to - from);
        const a = aimToRad(e.aim);
        // Stop short of running through the target.
        const close = pd && Math.hypot(pd.p.x - e.x, pd.p.y - e.y) < ed.def.radius + 6 && !atk.special;
        if (!close) this.move(ed, Math.cos(a) * per, Math.sin(a) * per);
      }
    }
    if (tick >= wind && !ed.specialFired) {
      ed.specialFired = 1;
      this.fire(ed, atk);
    }
    // Blade Storm fires extra waves through its active window.
    if (atk.special === "bladestorm" && tick >= wind && tick < wind + atk.active && (tick - wind) % 10 === 0 && tick !== wind) {
      this.radial(ed, atk, (tick - wind) / 10);
    }
    if (tick >= total) {
      if (atk.chain !== undefined && pd && this.validTarget(ed, pd)) {
        this.startAttack(ed, atk.chain, pd);
        return;
      }
      sim.releaseToken(ed);
      sim.setEnemyAct(ed, EAct.Idle);
      // Breathing room between attacks keeps fights readable.
      const gap = ed.def.boss ? (ed.phase >= 2 ? 160 : ed.phase === 1 ? 260 : 380) : 350 + Math.random() * 450;
      ed.thinkAt = sim.now + gap;
      if (ed.def.behavior === "sparring") ed.thinkAt = sim.now + 700;
    }
  }

  private fire(ed: EnemyData, atk: EnemyAttack) {
    const sim = this.sim;
    const e = ed.e;
    if (atk.shape && atk.special !== "sigils") sim.recordAttack(ed, atk, atk.targeted ? { x: e.ax, y: e.ay } : undefined);
    if (atk.projectile && atk.special !== "bladestorm") {
      const pj = atk.projectile;
      const base = aimToRad(e.aim);
      for (let i = 0; i < pj.count; i++) {
        const a = base + (pj.count === 1 ? 0 : -pj.spread / 2 + (pj.spread * i) / (pj.count - 1));
        sim.spawnProjectile({
          kind: ed.def.behavior === "caster" ? 3 : 1, team: 1, owner: ed.id,
          x: e.x + Math.cos(a) * 14, y: e.y - 10 + Math.sin(a) * 14, angle: a,
          speed: pj.speed, range: pj.range, radius: pj.radius,
          damage: atk.damage * sim.enemyDamageMul(ed), poise: 10, knockback: atk.knockback, enemyId: ed.id, atk,
        });
      }
    }
    switch (atk.special) {
      case "bladestorm":
        this.radial(ed, atk, 0);
        break;
      case "summon":
        this.summon(ed);
        break;
      case "howl":
        for (const other of sim.enemies.values()) {
          if (other.def.behavior !== "pack" || Math.hypot(other.e.x - e.x, other.e.y - e.y) > 320) continue;
          other.e.flags |= EFlag.Enraged;
          other.enrageUntil = sim.now + 8000;
          if (!other.target) other.target = ed.target;
        }
        sim.emit("fx", { k: "howl", x: e.x, y: e.y }, e.x, e.y);
        break;
      case "blink":
        this.blink(ed);
        break;
      case "judgement":
        sim.spawnHazard({ kind: HazardKind.Judgement, team: 1, x: e.x, y: e.y, radius: 2000, delay: 0, damage: atk.damage, poise: 0, knockback: atk.knockback, heavy: true, enemyId: ed.id, life: 800 });
        break;
    }
  }

  private radial(ed: EnemyData, atk: EnemyAttack, wave: number) {
    const e = ed.e;
    const pj = atk.projectile!;
    const offset = wave * (Math.PI / pj.count);
    for (let i = 0; i < pj.count; i++) {
      const a = offset + (i / pj.count) * Math.PI * 2;
      this.sim.spawnProjectile({
        kind: 4, team: 1, owner: ed.id, x: e.x + Math.cos(a) * 20, y: e.y - 14 + Math.sin(a) * 20, angle: a,
        speed: pj.speed, range: pj.range, radius: pj.radius, damage: atk.damage * this.sim.enemyDamageMul(ed), poise: 10,
        knockback: atk.knockback, enemyId: ed.id, atk,
      });
    }
  }

  private summon(ed: EnemyData) {
    const sim = this.sim;
    const key = ed.def.minions ?? (ed.def.key === "grakk" ? ["cutpurse", "goblin"] : ["stalker", "stalker"]);
    for (const k of key) {
      if (ed.minions.size >= 3) break;
      const spot = this.freeSpotNear(ed.e.x, ed.e.y, 70, 120);
      if (!spot) continue;
      const m = sim.spawnEnemy(k, spot.x, spot.y, { level: ed.e.level, master: ed.id });
      m.target = ed.target;
      ed.minions.add(m.id);
    }
    sim.emit("fx", { k: "summon", x: ed.e.x, y: ed.e.y }, ed.e.x, ed.e.y);
  }

  private blink(ed: EnemyData) {
    const e = ed.e;
    const pd = this.target(ed);
    const away = pd ? Math.atan2(e.y - pd.p.y, e.x - pd.p.x) : Math.random() * Math.PI * 2;
    for (let i = 0; i < 10; i++) {
      const a = away + (Math.random() - 0.5) * 1.6;
      const dist = 120 + Math.random() * 50;
      const x = e.x + Math.cos(a) * dist;
      const y = e.y + Math.sin(a) * dist;
      if (!this.blockedAt(x, y, ed) && this.sim.grid.lineClear(e.x, e.y, x, y, 1)) {
        this.sim.emit("fx", { k: "blink", x: e.x, y: e.y, x2: x, y2: y }, e.x, e.y);
        e.x = Math.fround(x);
        e.y = Math.fround(y);
        return;
      }
    }
  }

  private judgementGlyphs(ed: EnemyData, atk: EnemyAttack) {
    const sim = this.sim;
    const e = ed.e;
    const until = windupTicks(atk, e.flags) * TICK_MS;
    for (let i = 0; i < 3; i++) {
      const spot = this.freeSpotNear(e.x, e.y, 140, 240);
      if (spot) sim.spawnHazard({ kind: HazardKind.Glyph, team: 1, x: spot.x, y: spot.y, radius: 38, delay: until, damage: 0, poise: 0, knockback: 0, heavy: false, safe: true, life: 700 });
    }
  }

  private placeSigils(ed: EnemyData, atk: EnemyAttack) {
    const sim = this.sim;
    const delay = windupTicks(atk, ed.e.flags) * TICK_MS + 150;
    let placed = 0;
    for (const pd of sim.players.values()) {
      if (pd.p.act === Act.Dead || Math.hypot(pd.p.x - ed.e.x, pd.p.y - ed.e.y) > 480) continue;
      sim.spawnHazard({ kind: HazardKind.Sigil, team: 1, x: pd.p.x, y: pd.p.y, radius: 54, delay, damage: atk.damage * sim.enemyDamageMul(ed), poise: 0, knockback: atk.knockback, heavy: false, enemyId: ed.id });
      placed++;
    }
    for (let i = placed; i < 5; i++) {
      const spot = this.freeSpotNear(ed.e.x, ed.e.y, 60, 260);
      if (spot) sim.spawnHazard({ kind: HazardKind.Sigil, team: 1, x: spot.x, y: spot.y, radius: 54, delay: delay + i * 120, damage: atk.damage * sim.enemyDamageMul(ed), poise: 0, knockback: atk.knockback, heavy: false, enemyId: ed.id });
    }
  }

  // ---------------------------------------------------------------------------
  // Movement

  private speed(ed: EnemyData) {
    let s = ed.def.speed;
    if (ed.e.flags & EFlag.Chilled) s *= 0.55;
    if (ed.e.flags & EFlag.Soaked) s *= 0.85;
    if (ed.e.flags & EFlag.Enraged && !ed.def.boss) s *= 1.15;
    return s;
  }

  /** Walk home, wounds and all (no free heal on the way). */
  private leash(ed: EnemyData, dt: number) {
    const e = ed.e;
    const d = Math.hypot(ed.homeX - e.x, ed.homeY - e.y);
    if (d < 12) {
      e.posture = 0;
      ed.restAt = this.sim.now + REST_DELAY_MS;
      // A Floor Boss whose challengers have all gone (or fallen) resets its arena.
      if (ed.def.boss && ed.def.boss.music !== "miniboss") this.recover(ed);
      this.sim.setEnemyAct(ed, EAct.Idle);
      return;
    }
    this.goTo(ed, ed.homeX, ed.homeY, ed.def.speed * 1.4, dt);
  }

  /** Home and left alone: after a while, a hurt enemy slowly recovers. */
  private rest(ed: EnemyData) {
    const e = ed.e;
    if (e.hp >= e.hpMax) return;
    const now = this.sim.now;
    if (!ed.restAt) ed.restAt = now + REST_DELAY_MS;
    if (now < ed.restAt) return;
    // (Twice a second, so the rate holds however small the enemy.)
    ed.restAt = now + 500;
    e.hp = Math.min(e.hpMax, e.hp + Math.max(1, Math.round(e.hpMax * REST_RATE * 0.5)));
    if (e.hp >= e.hpMax) this.recover(ed);
  }

  /** Whole again: the fight is forgotten. */
  private recover(ed: EnemyData) {
    const e = ed.e;
    e.hp = e.hpMax;
    e.posture = 0;
    ed.phase = 0;
    if (ed.def.boss) e.flags &= ~EFlag.Enraged;
    ed.contrib.clear();
    ed.restAt = 0;
  }

  private wander(ed: EnemyData, dt: number) {
    const sim = this.sim;
    const e = ed.e;
    if (ed.def.speed === 0) return;
    if (!ed.path?.length && sim.now >= ed.pathAt) {
      ed.pathAt = sim.now + 2500 + Math.random() * 4000;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 60;
      const x = ed.homeX + Math.cos(a) * r;
      const y = ed.homeY + Math.sin(a) * r;
      if (!this.blockedAt(x, y, ed)) ed.path = [{ x, y }];
    }
    const next = ed.path?.[0];
    if (!next) {
      if (e.act !== EAct.Idle) sim.setEnemyAct(ed, EAct.Idle);
      return;
    }
    if (Math.hypot(next.x - e.x, next.y - e.y) < 4) {
      ed.path!.shift();
      return;
    }
    if (e.act !== EAct.Move) sim.setEnemyAct(ed, EAct.Move);
    this.step(ed, next.x, next.y, ed.def.speed * 0.35, dt);
  }

  /** Move toward a goal, pathfinding around walls when there is no straight line. */
  private goTo(ed: EnemyData, gx: number, gy: number, speed: number, dt: number) {
    const sim = this.sim;
    const e = ed.e;
    if (this.blockedAt(gx, gy, ed)) {
      // Goal inside a wall / safe zone: aim for the reachable point along the way.
      gx = e.x + (gx - e.x) * 0.5;
      gy = e.y + (gy - e.y) * 0.5;
    }
    if (sim.grid.lineClear(e.x, e.y, gx, gy, Math.min(10, ed.def.radius * 0.6))) {
      ed.path = undefined;
      this.step(ed, gx, gy, speed, dt);
      return;
    }
    if (!ed.path?.length || sim.now >= ed.pathAt) {
      ed.pathAt = sim.now + 450 + Math.random() * 200;
      ed.path = sim.grid.find(e.x, e.y, gx, gy) ?? undefined;
      ed.path?.shift();
    }
    const next = ed.path?.[0];
    if (!next) return;
    if (Math.hypot(next.x - e.x, next.y - e.y) < 8) {
      ed.path!.shift();
      return;
    }
    this.step(ed, next.x, next.y, speed, dt);
  }

  private step(ed: EnemyData, gx: number, gy: number, speed: number, dt: number) {
    const e = ed.e;
    const dx = gx - e.x;
    const dy = gy - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const stepLen = Math.min(d, speed * dt);
    let mx = (dx / d) * stepLen;
    let my = (dy / d) * stepLen;
    // Separation so packs spread instead of stacking.
    for (const other of this.sim.enemies.values()) {
      if (other === ed || other.e.act === EAct.Dead) continue;
      const ox = e.x - other.e.x;
      const oy = e.y - other.e.y;
      const min = ed.def.radius + other.def.radius;
      const od = Math.hypot(ox, oy);
      if (od > 0 && od < min) {
        const push = ((min - od) / min) * speed * dt * 0.8;
        mx += (ox / od) * push;
        my += (oy / od) * push;
      }
    }
    if (!ed.target) this.turn(ed, Math.atan2(my, mx), TURN_RATE * dt);
    this.move(ed, mx, my);
  }

  private turn(ed: EnemyData, want: number, maxStep: number) {
    const cur = aimToRad(ed.e.aim);
    const diff = angleDiff(want, cur);
    const next = cur + Math.max(-maxStep, Math.min(maxStep, diff));
    ed.e.aim = radToAim(next);
  }

  private blockedAt(x: number, y: number, ed: EnemyData) {
    const hw = Math.min(12, ed.def.radius * 0.6);
    const hh = Math.min(8, ed.def.radius * 0.45);
    const g = this.sim.grid;
    return (
      g.isBlocked(Math.floor((x - hw) / TILE), Math.floor((y - hh) / TILE)) ||
      g.isBlocked(Math.floor((x + hw) / TILE), Math.floor((y - hh) / TILE)) ||
      g.isBlocked(Math.floor((x - hw) / TILE), Math.floor((y + hh) / TILE)) ||
      g.isBlocked(Math.floor((x + hw) / TILE), Math.floor((y + hh) / TILE))
    );
  }

  move(ed: EnemyData, dx: number, dy: number) {
    const e = ed.e;
    if (dx && !this.blockedAt(e.x + dx, e.y, ed)) e.x = Math.fround(e.x + dx);
    if (dy && !this.blockedAt(e.x, e.y + dy, ed)) e.y = Math.fround(e.y + dy);
  }

  freeSpotNear(x: number, y: number, rmin: number, rmax: number): { x: number; y: number } | undefined {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rmin + Math.random() * (rmax - rmin);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (!this.sim.grid.isBlocked(tx, ty) && this.sim.grid.lineClear(x, y, px, py, 1)) return { x: px, y: py };
    }
    return undefined;
  }
}
