import type { Client } from "colyseus";
import { BREAKER_LIVE_MS, BREAKERS, EAct, EG, EG_BREAKER_BIT, ENGINE_ROOMS as R, HazardKind, TILE, type WorldObject } from "@floors/shared";
import { InstanceRoom, inRect, type BossArena, type MinibossHall } from "./InstanceRoom.ts";

const WAVES: string[][] = [
  ["clockhound", "clockhound", "cogsoldier", "tinkerer"],
  ["cogsoldier", "cogsoldier", "sentry", "tinkerer"],
  // The Prototype comes off the line last (the first of this wave, always elite).
  ["steamgolem", "cogsoldier", "sentry", "clockhound"],
];
const BREAKER_MASK = 15 << EG_BREAKER_BIT;

/**
 * One party's run through the Great Engine (Floor 7's boss dungeon): the Piston Walk, the
 * Assembly Line (three waves), the Overload Room (throw all four breakers so they are live
 * at once — each holds only a few seconds — while sentries fire), Forgemaster Vulk, then the
 * Archon Engine.
 */
export class EngineRoom extends InstanceRoom {
  readonly kind = "engine";
  private line: "idle" | 0 | 1 | 2 | "done" = "idle";
  private lineEnemies = new Set<string>();
  /** When each breaker was thrown (0 = not live). */
  private liveAt = [0, 0, 0, 0];
  private overload: "waiting" | "running" | "done" = "waiting";
  private sentries = new Set<string>();

  protected hall(): MinibossHall {
    return {
      room: R.vulk, southGate: EG.vulkSouth, northGate: EG.vulkNorth, stage: "Vulk's Forge", after: "The Engine Stair",
      victory: { title: "The Forgemaster falls", sub: "The Archon Engine waits above" },
    };
  }

  protected arena(): BossArena {
    const d = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05);
    return {
      gate: EG.bossSouth,
      inArena: (x, y) => d(x, y) < R.boss.r - 0.5,
      stillIn: (x, y) => y < 27 * TILE && d(x, y) < R.boss.r + 1.5,
      stage: "The Heart of the Engine",
      intro: { name: "The Archon Engine", sub: "Keeper of the Seventh Gate" },
      victory: { title: "THE ENGINE STOPS", sub: "For the first time in a century, the Clockwork Heights fall silent" },
      wipe: { title: "The Engine runs on", sub: "Learn it. Return." },
    };
  }

  /** Steam bursts from the pistons in rows. */
  protected trapHazard() {
    return { kind: HazardKind.Steam, damage: 36, knockback: 130, radius: 18 };
  }

  protected setupInstance() {
    this.setGates((1 << EG.lineSouth) | (1 << EG.vulkSouth) | (1 << EG.bossSouth));
    this.state.stage = "The Piston Walk";
    this.sim.onEnemyRemoved = (ed) => {
      this.lineEnemies.delete(ed.id);
      this.sentries.delete(ed.id);
    };
  }

  protected tickInstance(now: number) {
    this.assemblyLine();
    this.overloadRoom(now);
  }

  private assemblyLine() {
    if (this.line === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.line));
    if (this.line === "idle") {
      if (!inside.length) return;
      this.gatherParty((x, y) => inRect(x, y, R.line), this.insideGate(EG.lineSouth), "the Assembly Line");
      this.gate(EG.lineSouth, false);
      this.state.stage = "The Assembly Line";
      this.emitAll("banner", { title: "The Assembly Line", sub: "Soldiers come off the line, fully wound" });
      this.spawnWave(0);
      return;
    }
    if (!this.living().length) {
      for (const id of this.lineEnemies) this.sim.removeEnemy(id);
      this.lineEnemies.clear();
      this.line = "idle";
      this.gate(EG.lineSouth, true);
      return;
    }
    if (this.lineEnemies.size) return;
    if (this.line < 2) {
      const next = (this.line + 1) as 1 | 2;
      this.emitAll("banner", next === 1 ? { title: "The line speeds up", sub: "More of them" } : { title: "The Prototype", sub: "The last one off the line is the one they were building toward" });
      this.spawnWave(next);
      return;
    }
    this.line = "done";
    this.gate(EG.lineSouth, true);
    this.gate(EG.lineNorth, true);
    this.emitAll("banner", { title: "The line stops", sub: "Beware the Overload Room" });
    this.state.stage = "The Overload Room";
  }

  private spawnWave(i: 0 | 1 | 2) {
    this.line = i;
    const keys = WAVES[i];
    const cx = ((R.line.x0 + R.line.x1) / 2) * TILE;
    const cy = ((R.line.y0 + R.line.y1) / 2) * TILE - 60;
    keys.forEach((k, n) => {
      const a = (n / keys.length) * Math.PI * 2;
      const proto = i === 2 && n === 0;
      const ed = this.sim.spawnEnemy(k, cx + Math.cos(a) * 140, cy + Math.sin(a) * 70, { level: 31, elite: proto || (n === 0 && Math.random() < 0.3), hpScale: proto ? 2 : undefined });
      ed.homeX = cx;
      ed.homeY = cy;
      const target = this.living()[0];
      if (target) ed.target = target.sid;
      this.lineEnemies.add(ed.id);
    });
  }

  /** The Overload Room: all four breakers live at once. Each drops out a few seconds after it's thrown. */
  private overloadRoom(now: number) {
    if (this.line !== "done" || this.overload === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.overload));
    if (this.overload === "waiting") {
      if (!inside.length) return;
      this.overload = "running";
      this.emitAll("banner", { title: "The Overload Room", sub: "Four breakers. Fourteen seconds each. Run" });
      // Two sentries guard the room from the middle.
      for (const [tx, ty] of [[42, 66], [42, 76]] as const) {
        const ed = this.sim.spawnEnemy("sentry", tx * TILE + 16, ty * TILE + 16, { level: 31 });
        ed.homeX = ed.e.x;
        ed.homeY = ed.e.y;
        ed.target = inside[0].sid;
        this.sentries.add(ed.id);
      }
      return;
    }
    // Breakers drop out when their time runs down.
    let mask = this.open;
    this.liveAt.forEach((t, i) => {
      if (t && now - t > BREAKER_LIVE_MS) {
        this.liveAt[i] = 0;
        mask &= ~(1 << (EG_BREAKER_BIT + i));
        const [bx, by] = BREAKERS[i];
        this.emitNear("fx", { k: "breakerdrop", x: bx * TILE + 16, y: by * TILE + 16 }, bx * TILE, by * TILE);
      }
    });
    if (mask !== this.open) this.setGates(mask);
    if (!this.living().length) {
      // A wipe resets the room.
      for (const id of this.sentries) this.sim.removeEnemy(id);
      this.sentries.clear();
      this.liveAt = [0, 0, 0, 0];
      this.setGates(this.open & ~BREAKER_MASK);
      this.overload = "waiting";
    }
  }

  protected useObject(client: Client, obj: WorldObject) {
    if (obj.kind !== "lever" || !obj.id.startsWith("breaker-") || this.overload !== "running") return;
    const i = Number(obj.id.split("-")[1]);
    const now = this.sim.now;
    this.liveAt[i] = now;
    this.setGates(this.open | (1 << (EG_BREAKER_BIT + i)));
    this.emitNear("fx", { k: "breaker", x: obj.x, y: obj.y }, obj.x, obj.y);
    const live = this.liveAt.filter((t) => t && now - t <= BREAKER_LIVE_MS).length;
    if (live < 4) {
      this.notify(client, `Breaker thrown — ${live} of 4 live.`, live >= 3 ? "good" : "info");
      return;
    }
    this.overload = "done";
    this.gate(EG.overNorth, true);
    for (const id of this.sentries) {
      const ed = this.sim.enemies.get(id);
      if (ed && ed.e.act !== EAct.Dead) this.sim.removeEnemy(id);
    }
    this.sentries.clear();
    this.emitAll("banner", { title: "OVERLOAD", sub: "The seal blows open. The way to the forge is clear" });
    this.emitAll("fx", { k: "overload", x: 42 * TILE, y: 70 * TILE, r: 400 });
    this.state.stage = "Vulk's Forge";
  }
}
