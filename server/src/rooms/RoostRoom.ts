import type { Client } from "colyseus";
import { buildRoost, HazardKind, RG, RG_SEAL_BIT, ROOST_ROOMS as R, SEAL_WINDOW, TILE, type WorldMap, type WorldObject } from "@floors/shared";
import type { Character } from "../game/character.ts";
import type { EnemyData } from "../game/sim.ts";
import { openFloor } from "../game/floors.ts";
import { InstanceRoom, inRect, type BossArena, type MinibossHall } from "./InstanceRoom.ts";

const SEALS = ["Ash", "Flame", "Cinder"];
const WAVES: string[][] = [
  ["drake", "ashling", "ashling", "magmahound"],
  ["emberguard", "emberguard", "flamecaller", "flamecaller"],
  // The brood-mother comes last (the first of a wave is sometimes elite; she always is).
  ["drake", "drake", "ashling", "ashling"],
];

/**
 * One party's assault on the Dragon's Roost (Floor 3's boss dungeon): the lava bridge,
 * the hatchery's brood in three waves, three flame seals to light before the first gutters
 * out, Vyrmak the Dragonsworn, then Ignivar, the Ember Tyrant.
 */
export class RoostRoom extends InstanceRoom {
  readonly kind = "roost" as const;
  private hatch: "idle" | 0 | 1 | 2 | "done" = "idle";
  private hatchEnemies = new Set<string>();
  private lit = new Set<number>();
  private sealsUntil = 0;

  protected buildMap(): WorldMap {
    return buildRoost();
  }

  protected title() {
    return { name: "The Dragon's Roost", sub: "Floor 3 — Boss Dungeon" };
  }

  /** Leaving puts you back outside the Roost Gate. */
  protected exitPos(_ch: Character) {
    return { room: "floor3", x: 0, y: 0, via: "roost-door" };
  }

  protected hall(): MinibossHall {
    return {
      room: R.vyrmak, southGate: RG.vyrmakSouth, northGate: RG.vyrmakNorth, stage: "Hall of the Dragonsworn", after: "The Tyrant's Stair",
      victory: { title: "The Dragonsworn falls", sub: "Only the Tyrant remains" },
    };
  }

  protected arena(): BossArena {
    const d = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05);
    return {
      gate: RG.bossSouth,
      inArena: (x, y) => d(x, y) < R.boss.r - 0.5,
      stillIn: (x, y) => y < 29 * TILE && d(x, y) < R.boss.r + 1.5,
      stage: "The Caldera Throne",
      intro: { name: "Ignivar, the Ember Tyrant", sub: "Keeper of the Third Gate" },
      victory: { title: "THE TYRANT FALLS", sub: "The Ember Reaches are free — the dragons are leaderless" },
      wipe: { title: "The fire waits", sub: "Learn him. Return." },
    };
  }

  /** Geysers of magma burst through the bridge in rows. */
  protected trapHazard() {
    return { kind: HazardKind.Meteor, damage: 26, knockback: 110, radius: 18 };
  }

  protected setupInstance() {
    this.setGates((1 << RG.hatcherySouth) | (1 << RG.vyrmakSouth) | (1 << RG.bossSouth));
    this.state.stage = "The Lava Bridge";
    this.sim.onEnemyRemoved = (ed) => this.hatchEnemies.delete(ed.id);
  }

  protected tickInstance(now: number) {
    this.hatchery();
    this.seals(now);
  }

  /** The Floor Boss of Floor 3 is dead: the next floor would open here (when it exists). */
  protected onCleared(boss: EnemyData) {
    const by = this.climbers();
    if (by.length) openFloor(4, by, boss.def.name);
  }

  // --- The Hatchery ---------------------------------------------------------------

  private hatchery() {
    if (this.hatch === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.hatchery));
    if (this.hatch === "idle") {
      if (!inside.length) return;
      this.gatherParty((x, y) => inRect(x, y, R.hatchery), this.insideGate(RG.hatcherySouth), "the Hatchery");
      this.gate(RG.hatcherySouth, false);
      this.state.stage = "The Hatchery";
      this.emitAll("banner", { title: "The Hatchery", sub: "The eggs are hatching" });
      this.spawnWave(0);
      return;
    }
    if (!this.living().length) {
      // Wiped: the brood settles and the hatchery resets.
      for (const id of this.hatchEnemies) this.sim.removeEnemy(id);
      this.hatchEnemies.clear();
      this.hatch = "idle";
      this.gate(RG.hatcherySouth, true);
      return;
    }
    if (this.hatchEnemies.size) return;
    if (this.hatch < 2) {
      const next = (this.hatch + 1) as 1 | 2;
      this.emitAll("banner", next === 1 ? { title: "The Dragonsworn arrive", sub: "" } : { title: "The Brood-Mother", sub: "She wants her eggs back" });
      this.spawnWave(next);
      return;
    }
    this.hatch = "done";
    this.gate(RG.hatcherySouth, true);
    this.gate(RG.hatcheryNorth, true);
    this.emitAll("banner", { title: "The Hatchery falls silent", sub: "Climb to the Flame Seals" });
    this.state.stage = "The Flame Seals";
  }

  private spawnWave(i: 0 | 1 | 2) {
    this.hatch = i;
    const keys = WAVES[i];
    const cx = ((R.hatchery.x0 + R.hatchery.x1) / 2) * TILE;
    const cy = ((R.hatchery.y0 + R.hatchery.y1) / 2) * TILE - 60;
    keys.forEach((k, n) => {
      const a = (n / keys.length) * Math.PI * 2;
      const mother = i === 2 && n === 0;
      const ed = this.sim.spawnEnemy(k, cx + Math.cos(a) * 140, cy + Math.sin(a) * 70, { level: 15, elite: mother || (n === 0 && Math.random() < 0.3), hpScale: mother ? 2 : undefined });
      ed.homeX = cx;
      ed.homeY = cy;
      const target = this.living()[0];
      if (target) ed.target = target.sid;
      this.hatchEnemies.add(ed.id);
    });
  }

  // --- The Flame Seals --------------------------------------------------------------

  /** Seals burn for SEAL_WINDOW seconds: all three must be lit before the first gutters out. */
  private seals(now: number) {
    if (!this.lit.size || this.lit.size === 3 || now < this.sealsUntil) return;
    this.lit.clear();
    this.setGates(this.open & ~(7 << RG_SEAL_BIT));
    this.emitAll("banner", { title: "The seals gutter out", sub: "Light all three together" });
  }

  protected useObject(client: Client, obj: WorldObject) {
    if (obj.kind === "gate" && obj.id === "ascent") {
      client.send("lore", { name: obj.name, text: obj.text ?? "" });
      return;
    }
    if (obj.kind !== "lever") return;
    const idx = Number(obj.id.split("-")[1]);
    if (this.lit.has(idx) || this.open & (1 << RG.sealsNorth)) return;
    if (!this.lit.size) this.sealsUntil = this.sim.now + SEAL_WINDOW * 1000;
    this.lit.add(idx);
    this.setGates(this.open | (1 << (RG_SEAL_BIT + idx)));
    this.emitNear("fx", { k: "lever", x: obj.x, y: obj.y }, obj.x, obj.y);
    this.emitNear("fx", { k: "fireburst", x: obj.x, y: obj.y }, obj.x, obj.y);
    const left = Math.max(0, Math.ceil((this.sealsUntil - this.sim.now) / 1000));
    this.notify(client, this.lit.size < 3 ? `The Seal of ${SEALS[idx]} blazes. ${3 - this.lit.size} to go — ${left} seconds before it gutters.` : `The Seal of ${SEALS[idx]} blazes.`, "good");
    // The brood answers the flame.
    const keys = idx === 1 ? ["drake"] : ["ashling", "magmahound"];
    keys.forEach((k, i) => {
      const ed = this.sim.spawnEnemy(k, obj.x + (i ? 90 : -90), obj.y + 50, { level: 15 });
      ed.homeX = obj.x;
      ed.homeY = obj.y + 50;
      ed.target = client.sessionId;
    });
    if (this.lit.size === 3) {
      this.gate(RG.sealsNorth, true);
      this.emitAll("banner", { title: "The seals blaze as one", sub: "The way to the Dragonsworn opens" });
      this.state.stage = "Hall of the Dragonsworn";
    }
  }
}
