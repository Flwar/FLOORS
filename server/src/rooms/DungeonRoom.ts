import type { Client } from "colyseus";
import {
  Act, applyGates, buildUndercroft, EAct, EFlag, GATE, HazardKind, TILE, UNDERCROFT_ROOMS as R, type GateDef, type WorldMap,
} from "@floors/shared";
import type { Character } from "../game/character.ts";
import { questEvent } from "../game/quests.ts";
import type { EnemyData } from "../game/sim.ts";
import { DEV, GameRoom } from "./GameRoom.ts";

type UMap = WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };

const LEVER_NAMES = ["Sun", "Moon", "Star"];
const COURT = { x: 170 * TILE + 16, y: 62 * TILE + 16 };
const inRect = (x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number }) => x >= r.x0 * TILE && x < r.x1 * TILE && y >= r.y0 * TILE && y < r.y1 * TILE;
const inBoss = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05) < R.boss.r - 0.5;

/** One party's run through the Undercroft. Disposed when everyone leaves. */
export class DungeonRoom extends GameRoom {
  readonly kind = "dungeon" as const;
  private allowed = new Set<string>();
  private checkpoint = "brazier-0";
  private open = 0;
  private leverOrder: number[] = [];
  private leverProgress = 0;
  private hall: "idle" | "wave1" | "wave2" | "done" = "idle";
  private hallEnemies = new Set<string>();
  private warden?: EnemyData;
  private boss?: EnemyData;
  private wardenFight = false;
  private bossFight = false;
  private bossWipeAt = 0;
  private trapAt = [400, 1200, 2000];
  private cleared = false;

  protected buildMap(): WorldMap {
    return buildUndercroft();
  }

  private get umap() {
    return this.map as UMap;
  }

  protected setup(options: { allowed?: string[] }) {
    this.autoDispose = true;
    for (const k of options.allowed ?? []) this.allowed.add(k);
    this.setGates((1 << GATE.hallSouth) | (1 << GATE.wardenSouth) | (1 << GATE.bossSouth));
    // A fresh riddle every run.
    this.leverOrder = [0, 1, 2].sort(() => Math.random() - 0.5);
    const tablet = this.map.object("rune-tablet")!;
    tablet.text = `Three sigils are carved above the door: first the ${LEVER_NAMES[this.leverOrder[0]]}, then the ${LEVER_NAMES[this.leverOrder[1]]}, and last the ${LEVER_NAMES[this.leverOrder[2]]}.`;
    this.state.stage = "Entrance";
    for (const def of this.map.spawns) {
      const ed = this.sim.spawnEnemy(def.enemies[0], def.x, def.y, { level: def.level });
      ed.homeX = def.x;
      ed.homeY = def.y;
      if (def.id === "warden") this.warden = ed;
      else this.boss = ed;
    }
    this.sim.onEnemyRemoved = (ed) => this.hallEnemies.delete(ed.id);
    this.onMessage("interact", (client, id: string) => this.interact(client, String(id)));
    if (DEV) {
      this.onMessage("dev:teleport", (client, pos: { x: number; y: number }) => {
        const me = this.player(client);
        if (me && Number.isFinite(pos?.x)) {
          me.p.x = Math.fround(pos.x);
          me.p.y = Math.fround(pos.y);
        }
      });
      this.onMessage("dev:heal", (client) => {
        const me = this.player(client);
        if (me) me.p.hp = me.p.hpMax;
      });
      this.onMessage("dev:kill", (client) => {
        const pd = this.sim.players.get(client.sessionId);
        if (pd && pd.p.act !== Act.Dead) this.sim.killPlayer(pd);
      });
      this.onMessage("dev:bossatk", (client, name: string) => {
        const ed = this.boss;
        const pd = this.sim.players.get(client.sessionId);
        const idx = ed?.def.attacks.findIndex((a) => a.name === name) ?? -1;
        if (ed && pd && idx >= 0 && ed.e.act !== EAct.Dead) this.sim.ai.startAttack(ed, idx, pd);
      });
      this.onMessage("dev:bosshp", (_client, msg: { boss?: string; frac: number }) => {
        const ed = msg?.boss === "warden" ? this.warden : this.boss;
        if (!ed || ed.e.act === EAct.Dead) return;
        ed.e.hp = Math.max(1, Math.round(ed.e.hpMax * Number(msg.frac)));
        this.sim.checkPhase(ed);
      });
    }
  }

  async onAuth(client: Client, options: Parameters<GameRoom["onAuth"]>[1]) {
    const auth = await super.onAuth(client, options);
    if (this.allowed.size && !this.allowed.has(auth.key) && !auth.key.startsWith("g:")) throw new Error("This expedition isn't yours.");
    return auth;
  }

  protected spawnPoint(_ch: Character, _respawn: boolean) {
    const b = this.map.object(this.checkpoint)!;
    return { x: b.x + (Math.random() - 0.5) * 40, y: b.y + 26 };
  }

  protected onPlayerJoined(sid: string, ch: Character) {
    const updates = questEvent(ch, { kind: "dungeon" });
    if (updates.length) this.clients.getById(sid)?.send("quest", updates);
    this.clients.getById(sid)?.send("discover", { name: "The Undercroft", secret: false, sub: "Floor 1 — Boss Dungeon" });
  }

  /** Leaving the dungeon always returns you to the ruins' court. */
  protected onPlayerLeft(_sid: string, ch: Character) {
    ch.data.pos = { room: "world", x: COURT.x, y: COURT.y, hp: ch.data.pos?.hp };
  }

  protected onKillRewards(ch: Character, ed: EnemyData) {
    const sid = [...this.chars.entries()].find(([, c]) => c === ch)?.[0];
    const updates = questEvent(ch, { kind: "kill", enemy: ed.def.key });
    if (ed.def.boss && !ch.data.bossKills.includes(ed.def.key)) ch.data.bossKills.push(ed.def.key);
    if (ed.def.key === "aurelion") ch.data.floor = Math.max(ch.data.floor, 2);
    ch.dirty = true;
    if (sid && updates.length) this.clients.getById(sid)?.send("quest", updates);
    if (sid) this.save(sid);
  }

  // ---------------------------------------------------------------------------

  private setGates(mask: number) {
    const prev = this.open;
    this.open = mask;
    this.state.gates = mask;
    applyGates(this.umap, mask);
    for (const g of this.umap.gates) {
      if (((prev ^ mask) & (1 << g.id)) === 0 && prev !== 0) continue;
      const open = (mask & (1 << g.id)) !== 0;
      for (const [x, y] of g.tiles) this.sim.grid.setBlocked(x, y, !open);
    }
  }

  private gate(id: number, open: boolean) {
    const mask = open ? this.open | (1 << id) : this.open & ~(1 << id);
    if (mask === this.open) return;
    this.setGates(mask);
    const g = this.umap.gates.find((x) => x.id === id)!;
    const [tx, ty] = g.tiles[Math.floor(g.tiles.length / 2)];
    this.emitNear("fx", { k: open ? "gateOpen" : "gateClose", x: tx * TILE + 16, y: ty * TILE + 16 }, tx * TILE, ty * TILE);
  }

  private living() {
    return [...this.sim.players.values()].filter((pd) => pd.p.act !== Act.Dead);
  }

  protected tickRoom(now: number) {
    this.traps(now);
    this.hallEncounter();
    this.wardenFightTick();
    this.bossFightTick(now);
  }

  /** Spike rows fire in a staggered rhythm the player can read and time. */
  private traps(now: number) {
    for (let row = 0; row < 3; row++) {
      if (now < this.trapAt[row]) continue;
      this.trapAt[row] = Math.max(this.trapAt[row] + 2400, now);
      for (const t of this.umap.traps) {
        if (t.row !== row) continue;
        this.sim.spawnHazard({ kind: HazardKind.Hex, team: 1, x: t.x, y: t.y, radius: 14, delay: 700, damage: 14, poise: 0, knockback: 70, heavy: false, life: 300 });
      }
    }
  }

  private hallEncounter() {
    if (this.hall === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.hall));
    if (this.hall === "idle") {
      if (!inside.length) return;
      this.gate(GATE.hallSouth, false);
      this.state.stage = "The Sealed Hall";
      this.emitAll("banner", { title: "The Sealed Hall", sub: "The gates slam shut behind you" });
      this.spawnWave(["shieldbearer", "shieldbearer", "cultist", "cultist"]);
      this.hall = "wave1";
      return;
    }
    if (!this.living().length) {
      // Party wipe: reset the encounter.
      for (const id of this.hallEnemies) this.sim.removeEnemy(id);
      this.hallEnemies.clear();
      this.hall = "idle";
      this.gate(GATE.hallSouth, true);
      return;
    }
    if (this.hallEnemies.size) return;
    if (this.hall === "wave1") {
      this.hall = "wave2";
      this.emitAll("banner", { title: "Another wave", sub: "" });
      this.spawnWave(["stalker", "stalker", "brute"]);
    } else if (this.hall === "wave2") {
      this.hall = "done";
      this.gate(GATE.hallSouth, true);
      this.gate(GATE.hallNorth, true);
      this.emitAll("banner", { title: "Hall cleared", sub: "The north gate grinds open" });
      this.state.stage = "The Rune Chamber";
    }
  }

  private spawnWave(keys: string[]) {
    const cx = ((R.hall.x0 + R.hall.x1) / 2) * TILE;
    const cy = ((R.hall.y0 + R.hall.y1) / 2) * TILE - 60;
    keys.forEach((k, i) => {
      const a = (i / keys.length) * Math.PI * 2;
      const ed = this.sim.spawnEnemy(k, cx + Math.cos(a) * 120, cy + Math.sin(a) * 60, { level: 6, elite: i === 0 && Math.random() < 0.3 });
      ed.homeX = cx;
      ed.homeY = cy;
      const target = this.living()[0];
      if (target) ed.target = target.sid;
      this.hallEnemies.add(ed.id);
    });
  }

  private wardenFightTick() {
    const w = this.warden;
    if (!w || w.e.act === EAct.Dead) {
      if (this.wardenFight) {
        this.wardenFight = false;
        this.gate(GATE.wardenSouth, true);
        this.gate(GATE.wardenNorth, true);
        this.emitAll("banner", { title: "The Warden falls", sub: "The way down is open" });
        this.state.stage = "The Antechamber";
      }
      return;
    }
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.warden));
    if (!this.wardenFight && inside.length) {
      this.wardenFight = true;
      this.gate(GATE.wardenSouth, false);
      this.state.stage = "The Warden's Hall";
      this.scaleBoss(w);
      w.target = inside[0].sid;
      w.e.flags |= EFlag.Aggro;
    } else if (this.wardenFight && !inside.length) {
      // Wiped (or fled through death): the Warden resets.
      this.wardenFight = false;
      this.resetBoss(w);
      this.gate(GATE.wardenSouth, true);
    }
  }

  private bossFightTick(now: number) {
    const b = this.boss;
    if (!b || this.cleared) return;
    if (b.e.act === EAct.Dead) {
      this.cleared = true;
      this.bossFight = false;
      this.state.bossActive = false;
      this.state.stage = "cleared";
      this.gate(GATE.bossSouth, true);
      this.sim.clearHazards();
      this.emitAll("victory", { boss: b.def.name, title: "THE FIRST GATE IS OPEN", sub: "A path of light rises toward Floor 2" });
      return;
    }
    const inside = this.living().filter((pd) => inBoss(pd.p.x, pd.p.y));
    // Anyone alive north of the sealed gate is still in the fight (knockback can pin you against it).
    const stillIn = this.living().filter((pd) => pd.p.y < 25 * TILE && Math.hypot(pd.p.x / TILE - R.boss.cx, (pd.p.y / TILE - R.boss.cy) * 1.05) < R.boss.r + 1.5);
    if (!this.bossFight && inside.length) {
      this.bossFight = true;
      this.state.bossActive = true;
      this.state.stage = "The First Gate";
      this.scaleBoss(b);
      this.emitAll("bossIntro", { name: b.def.boss!.title, sub: "Keeper of the First Gate" });
      // The party gets a moment to step inside before the gate falls.
      this.clock.setTimeout(() => {
        if (this.bossFight) this.gate(GATE.bossSouth, false);
      }, 2500);
      b.target = inside[0].sid;
      b.e.flags |= EFlag.Aggro;
      return;
    }
    if (this.bossFight) {
      if (stillIn.length) {
        this.bossWipeAt = 0;
      } else if (!this.bossWipeAt) {
        this.bossWipeAt = now + 3000;
      } else if (now > this.bossWipeAt) {
        this.bossFight = false;
        this.state.bossActive = false;
        this.bossWipeAt = 0;
        this.resetBoss(b);
        this.sim.clearHazards();
        this.gate(GATE.bossSouth, true);
        this.emitAll("banner", { title: "The Keeper waits", sub: "Learn him. Return." });
      }
    }
  }

  /** Bosses scale with the party so a group fight stays a fight. */
  private scaleBoss(ed: EnemyData) {
    const n = Math.max(1, this.sim.players.size);
    const base = ed.def.hp * (1 + (ed.e.level - 1) * 0.12);
    ed.e.hpMax = Math.min(65535, Math.round(base * (1 + 0.65 * (n - 1))));
    ed.e.hp = ed.e.hpMax;
  }

  private resetBoss(ed: EnemyData) {
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
      case "lever": {
        const idx = Number(obj.id.split("-")[1]);
        if (this.open & (1 << GATE.puzzleNorth)) return;
        this.emitNear("fx", { k: "lever", x: obj.x, y: obj.y }, obj.x, obj.y);
        if (idx === this.leverOrder[this.leverProgress]) {
          this.leverProgress++;
          this.notify(client, `The ${LEVER_NAMES[idx]} sigil glows.`, "good");
          if (this.leverProgress === 3) {
            this.gate(GATE.puzzleNorth, true);
            this.emitAll("banner", { title: "The runes answer", sub: "The north gate opens" });
            this.state.stage = "The Warden's Hall";
          }
        } else {
          this.leverProgress = 0;
          this.emitAll("banner", { title: "Wrong sigil", sub: "Something stirs in the dark" });
          const cx = ((R.puzzle.x0 + R.puzzle.x1) / 2) * TILE;
          const cy = ((R.puzzle.y0 + R.puzzle.y1) / 2) * TILE;
          for (let i = 0; i < 2; i++) {
            const ed = this.sim.spawnEnemy("stalker", cx + (i ? 120 : -120), cy, { level: 6 });
            ed.homeX = cx;
            ed.homeY = cy;
            ed.target = client.sessionId;
          }
        }
        return;
      }
      case "gate":
        if (obj.id === "ascent" && this.cleared) client.send("travel", { room: "floor2" });
        return;
      case "door":
        if (obj.id === "exit") {
          if (me.pd.combatUntil > this.sim.now) return this.notify(client, "Not while enemies hunt you.", "error");
          client.send("travel", { room: "world" });
        }
        return;
    }
  }

  private emitAll(type: string, data: Record<string, unknown>) {
    this.broadcast(type, data);
  }
}
