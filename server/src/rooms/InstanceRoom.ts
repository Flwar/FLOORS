import type { Client } from "colyseus";
import { Act, applyGates, EAct, EFlag, HazardKind, TILE, type GateDef, type WorldMap, type WorldObject } from "@floors/shared";
import type { Character } from "../game/character.ts";
import { questEvent } from "../game/quests.ts";
import type { EnemyData } from "../game/sim.ts";
import { GameRoom } from "./GameRoom.ts";

export type GatedMap = WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
type Rect = { x0: number; y0: number; x1: number; y1: number };

export const inRect = (x: number, y: number, r: Rect) => x >= r.x0 * TILE && x < r.x1 * TILE && y >= r.y0 * TILE && y < r.y1 * TILE;

/** How an instance's miniboss hall works: sealed behind you, open ahead once it falls. */
export interface MinibossHall {
  room: Rect;
  southGate: number;
  northGate: number;
  stage: string;
  after: string;
  victory: { title: string; sub: string };
}

/** How the final boss arena works. */
export interface BossArena {
  gate: number;
  inArena: (x: number, y: number) => boolean;
  /** Knockback can pin a player against the sealed gate: they still count as fighting. */
  stillIn: (x: number, y: number) => boolean;
  stage: string;
  intro: { name: string; sub: string };
  victory: { title: string; sub: string };
  wipe: { title: string; sub: string };
}

/**
 * A party's run through a boss dungeon: braziers as checkpoints, sealing gates, a miniboss
 * hall and a boss arena that reset on a wipe, bosses that scale with the party.
 * Subclasses add their own encounters and puzzles.
 */
export abstract class InstanceRoom extends GameRoom {
  abstract readonly kind: "dungeon" | "stormspire";
  protected allowed = new Set<string>();
  protected checkpoint = "brazier-0";
  protected open = 0;
  protected miniboss?: EnemyData;
  protected boss?: EnemyData;
  protected cleared = false;
  private minibossFight = false;
  private bossFight = false;
  private bossWipeAt = 0;
  private trapAt = [400, 1200, 2000];

  protected abstract title(): { name: string; sub: string };
  /** Where leaving the instance puts you. */
  protected abstract exitPos(ch: Character): NonNullable<Character["data"]["pos"]>;
  protected abstract hall(): MinibossHall;
  protected abstract arena(): BossArena;
  /** Instance-specific setup (starting gates, puzzles). */
  protected abstract setupInstance(): void;
  /** Instance-specific ticking (encounters). */
  protected tickInstance(_now: number) {}
  /** Instance-specific objects (levers, the ascent). */
  protected useObject(_client: Client, _obj: WorldObject) {}
  /** Trap hazards: what fires on each trap row. */
  protected trapHazard(): { kind: number; damage: number; knockback: number; radius: number } {
    return { kind: HazardKind.Hex, damage: 14, knockback: 70, radius: 14 };
  }

  protected get gmap() {
    return this.map as GatedMap;
  }

  protected setup(options: { allowed?: string[] }) {
    this.autoDispose = true;
    for (const k of options.allowed ?? []) this.allowed.add(k);
    for (const def of this.map.spawns) {
      const ed = this.sim.spawnEnemy(def.enemies[0], def.x, def.y, { level: def.level });
      ed.homeX = def.x;
      ed.homeY = def.y;
      if (def.id === "warden") this.miniboss = ed;
      else this.boss = ed;
    }
    this.onMessage("interact", (client, id: string) => this.interact(client, String(id)));
    this.onDev("dev:teleport", (client, pos: { x: number; y: number }) => {
      const me = this.player(client);
      if (me && Number.isFinite(pos?.x)) {
        me.p.x = Math.fround(pos.x);
        me.p.y = Math.fround(pos.y);
      }
    });
    this.onDev("dev:heal", (client) => {
      const me = this.player(client);
      if (me) me.p.hp = me.p.hpMax;
    });
    this.onDev("dev:kill", (client) => {
      const pd = this.sim.players.get(client.sessionId);
      if (pd && pd.p.act !== Act.Dead) this.sim.killPlayer(pd);
    });
    this.onDev("dev:killnear", (client, radius: number) => {
      const me = this.player(client);
      if (!me) return;
      for (const ed of [...this.sim.enemies.values()]) {
        if (ed.e.act === EAct.Dead || Math.hypot(ed.e.x - me.p.x, ed.e.y - me.p.y) > (Number(radius) || 600)) continue;
        this.sim.damageEnemy(ed, me.pd, 99999, 0, 0, 0);
      }
    });
    this.onDev("dev:bossatk", (client, name: string) => {
      const ed = this.boss;
      const pd = this.sim.players.get(client.sessionId);
      const idx = ed?.def.attacks.findIndex((a) => a.name === name) ?? -1;
      if (ed && pd && idx >= 0 && ed.e.act !== EAct.Dead) this.sim.ai.startAttack(ed, idx, pd);
    });
    this.onDev("dev:bosshp", (_client, msg: { boss?: string; frac: number }) => {
      const ed = msg?.boss === "warden" ? this.miniboss : this.boss;
      if (!ed || ed.e.act === EAct.Dead) return;
      ed.e.hp = Math.max(1, Math.round(ed.e.hpMax * Number(msg.frac)));
      this.sim.checkPhase(ed);
    });
    this.setupInstance();
  }

  async onAuth(client: Client, options: Parameters<GameRoom["onAuth"]>[1], context?: Parameters<GameRoom["onAuth"]>[2]) {
    const auth = await super.onAuth(client, options, context);
    if (this.allowed.size && !this.allowed.has(auth.key) && !auth.key.startsWith("g:")) throw new Error("This expedition isn't yours.");
    return auth;
  }

  protected spawnPoint(_ch: Character, _respawn: boolean) {
    const b = this.map.object(this.checkpoint)!;
    return { x: b.x + (Math.random() - 0.5) * 40, y: b.y + 26 };
  }

  protected onPlayerJoined(sid: string, ch: Character) {
    const updates = questEvent(ch, { kind: "dungeon", dungeon: this.kind });
    if (updates.length) this.clients.getById(sid)?.send("quest", updates);
    const t = this.title();
    this.clients.getById(sid)?.send("discover", { name: t.name, secret: false, sub: t.sub });
  }

  protected onPlayerLeft(_sid: string, ch: Character) {
    ch.data.pos = { ...this.exitPos(ch), hp: ch.data.pos?.hp };
  }

  protected onKillRewards(ch: Character, ed: EnemyData) {
    const sid = [...this.chars.entries()].find(([, c]) => c === ch)?.[0];
    const updates = questEvent(ch, { kind: "kill", enemy: ed.def.key });
    this.onBossKilled(ch, ed);
    ch.dirty = true;
    if (sid && updates.length) this.clients.getById(sid)?.send("quest", updates);
    if (sid) this.save(sid);
  }

  /** Per-character rewards for a boss kill (e.g. unlocking a floor). */
  protected onBossKilled(_ch: Character, _ed: EnemyData) {}

  // ---------------------------------------------------------------------------
  // Gates

  protected setGates(mask: number) {
    const prev = this.open;
    this.open = mask;
    this.state.gates = mask;
    applyGates(this.gmap, mask);
    for (const g of this.gmap.gates) {
      if (((prev ^ mask) & (1 << g.id)) === 0 && prev !== 0) continue;
      const open = (mask & (1 << g.id)) !== 0;
      for (const [x, y] of g.tiles) this.sim.grid.setBlocked(x, y, !open);
    }
  }

  protected gate(id: number, open: boolean) {
    const mask = open ? this.open | (1 << id) : this.open & ~(1 << id);
    if (mask === this.open) return;
    this.setGates(mask);
    const g = this.gmap.gates.find((x) => x.id === id)!;
    const [tx, ty] = g.tiles[Math.floor(g.tiles.length / 2)];
    this.emitNear("fx", { k: open ? "gateOpen" : "gateClose", x: tx * TILE + 16, y: ty * TILE + 16 }, tx * TILE, ty * TILE);
  }

  protected living() {
    return [...this.sim.players.values()].filter((pd) => pd.p.act !== Act.Dead);
  }

  protected emitAll(type: string, data: Record<string, unknown>) {
    this.broadcast(type, data);
  }

  // ---------------------------------------------------------------------------
  // Ticking

  protected tickRoom(now: number) {
    this.traps(now);
    this.tickInstance(now);
    this.minibossTick();
    this.bossTick(now);
  }

  /** Trap rows fire in a staggered rhythm the player can read and time. */
  private traps(now: number) {
    const hz = this.trapHazard();
    for (let row = 0; row < 3; row++) {
      if (now < this.trapAt[row]) continue;
      this.trapAt[row] = Math.max(this.trapAt[row] + 2400, now);
      for (const t of this.gmap.traps) {
        if (t.row !== row) continue;
        this.sim.spawnHazard({ kind: hz.kind, team: 1, x: t.x, y: t.y, radius: hz.radius, delay: 700, damage: hz.damage, poise: 0, knockback: hz.knockback, heavy: false, life: 300 });
      }
    }
  }

  private minibossTick() {
    const w = this.miniboss;
    const h = this.hall();
    if (!w || w.e.act === EAct.Dead) {
      if (this.minibossFight) {
        this.minibossFight = false;
        this.gate(h.southGate, true);
        this.gate(h.northGate, true);
        this.emitAll("banner", h.victory);
        this.state.stage = h.after;
      }
      return;
    }
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, h.room));
    if (!this.minibossFight && inside.length) {
      this.minibossFight = true;
      this.gate(h.southGate, false);
      this.state.stage = h.stage;
      this.scaleBoss(w);
      w.target = inside[0].sid;
      w.e.flags |= EFlag.Aggro;
    } else if (this.minibossFight && !inside.length) {
      // Wiped (or fled through death): the miniboss resets.
      this.minibossFight = false;
      this.resetBoss(w);
      this.gate(h.southGate, true);
    }
  }

  private bossTick(now: number) {
    const b = this.boss;
    const a = this.arena();
    if (!b || this.cleared) return;
    if (b.e.act === EAct.Dead) {
      this.cleared = true;
      this.bossFight = false;
      this.state.bossActive = false;
      this.state.stage = "cleared";
      this.gate(a.gate, true);
      this.sim.clearHazards();
      this.emitAll("victory", { boss: b.def.name, title: a.victory.title, sub: a.victory.sub });
      return;
    }
    const inside = this.living().filter((pd) => a.inArena(pd.p.x, pd.p.y));
    const stillIn = this.living().filter((pd) => a.stillIn(pd.p.x, pd.p.y));
    if (!this.bossFight && inside.length) {
      this.bossFight = true;
      this.state.bossActive = true;
      this.state.stage = a.stage;
      this.scaleBoss(b);
      this.emitAll("bossIntro", a.intro);
      // The party gets a moment to step inside before the gate falls.
      this.clock.setTimeout(() => {
        if (this.bossFight) this.gate(a.gate, false);
      }, 2500);
      b.target = inside[0].sid;
      b.e.flags |= EFlag.Aggro;
      return;
    }
    if (this.bossFight) {
      if (stillIn.length) this.bossWipeAt = 0;
      else if (!this.bossWipeAt) this.bossWipeAt = now + 3000;
      else if (now > this.bossWipeAt) {
        this.bossFight = false;
        this.state.bossActive = false;
        this.bossWipeAt = 0;
        this.resetBoss(b);
        this.sim.clearHazards();
        this.gate(a.gate, true);
        this.emitAll("banner", a.wipe);
      }
    }
  }

  /** Bosses scale with the party so a group fight stays a fight. */
  protected scaleBoss(ed: EnemyData) {
    const n = Math.max(1, this.sim.players.size);
    const base = ed.def.hp * (1 + (ed.e.level - 1) * 0.12);
    ed.e.hpMax = Math.min(65535, Math.round(base * (1 + 0.65 * (n - 1))));
    ed.e.hp = ed.e.hpMax;
  }

  protected resetBoss(ed: EnemyData) {
    const e = ed.e;
    e.hp = e.hpMax;
    e.posture = 0;
    e.flags = 0;
    ed.phase = 0;
    ed.target = undefined;
    ed.contrib.clear();
    ed.attacks.length = 0;
    e.x = Math.fround(ed.homeX);
    e.y = Math.fround(ed.homeY);
    this.sim.setEnemyAct(ed, EAct.Idle);
    for (const id of ed.minions) this.sim.removeEnemy(id);
    ed.minions.clear();
  }

  // ---------------------------------------------------------------------------

  private interact(client: Client, id: string) {
    const me = this.player(client);
    const obj = this.map.object(id);
    if (!me || !obj || me.p.act === Act.Dead) return;
    if (Math.hypot(obj.x - me.p.x, obj.y - me.p.y) > 60) return;
    switch (obj.kind) {
      case "campfire":
        this.checkpoint = obj.id;
        me.p.hp = me.p.hpMax;
        this.emitNear("fx", { k: "brazier", x: obj.x, y: obj.y }, obj.x, obj.y);
        this.emitAll("banner", { title: obj.name, sub: "Your party will return here if they fall" });
        return;
      case "lore":
        client.send("lore", { name: obj.name, text: obj.text });
        return;
      case "door":
        if (obj.id === "exit") {
          if (!this.cleared && me.pd.combatUntil > this.sim.now) return this.notify(client, "Not while enemies hunt you.", "error");
          client.send("travel", { room: this.exitPos(me.ch).room });
        }
        return;
      default:
        this.useObject(client, obj);
    }
  }
}
