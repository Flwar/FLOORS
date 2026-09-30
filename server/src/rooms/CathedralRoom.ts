import type { Client } from "colyseus";
import { Act, CATHEDRAL_ROOMS as R, CG, CG_FLOOD_ID, CG_VALVE_BIT, HazardKind, SLUICE_VALVES, TIDE_ROWS, TILE, type WorldObject } from "@floors/shared";
import { InstanceRoom, inRect, type BossArena, type MinibossHall } from "./InstanceRoom.ts";

const WAVES: string[][] = [
  ["drowned", "drowned", "brinehound", "brinehound"],
  ["siren", "siren", "drowned", "merrowguard"],
  // The Drowned Bishop rises from the altar last (the first of this wave, always elite).
  ["merrowguard", "siren", "drowned", "brinehound"],
];
/** The tide climbs one row this often once it starts. */
const TIDE_EVERY_MS = 2200;
/** Every this often, something climbs out of the rising water. */
const DROWNED_EVERY_MS = 9000;
const FLOOD_MASK = ((1 << TIDE_ROWS) - 1) << CG_FLOOD_ID;
const VALVE_MASK = 7 << CG_VALVE_BIT;

/**
 * One party's dive into the Drowned Cathedral (Floor 6's boss dungeon): the Sunken Stair,
 * the Nave of the Drowned (three waves), the Rising Tide (the hall floods row by row from
 * the south; turn the three sluice valves before the sea fills it, or it carries everyone
 * back to the Nave and the tide starts again), Captain Blackbrine, then Thalassa.
 */
export class CathedralRoom extends InstanceRoom {
  readonly kind = "cathedral";
  private nave: "idle" | 0 | 1 | 2 | "done" = "idle";
  private naveEnemies = new Set<string>();
  /** The Rising Tide: rows flooded so far, when the next rises, and the valves turned. */
  private tide: "waiting" | "rising" | "held" = "waiting";
  private flooded = 0;
  private nextRise = 0;
  private nextDrowned = 0;
  private valves = 0;
  private tideEnemies = new Set<string>();

  protected hall(): MinibossHall {
    return {
      room: R.captain, southGate: CG.captSouth, northGate: CG.captNorth, stage: "The Captain's Deck", after: "The Leviathan Stair",
      victory: { title: "Blackbrine goes down with his ship", sub: "The Leviathan Queen waits above" },
    };
  }

  protected arena(): BossArena {
    const d = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05);
    return {
      gate: CG.bossSouth,
      inArena: (x, y) => d(x, y) < R.boss.r - 0.5,
      stillIn: (x, y) => y < 27 * TILE && d(x, y) < R.boss.r + 1.5,
      stage: "The Leviathan's Throne",
      intro: { name: "Thalassa, the Leviathan Queen", sub: "Keeper of the Sixth Gate" },
      victory: { title: "THE TIDE TURNS", sub: "The sea draws back from the Drowned Isles" },
      wipe: { title: "The sea keeps you", sub: "Learn her. Return." },
    };
  }

  /** The sea bursts up through the Sunken Stair in rows. */
  protected trapHazard() {
    return { kind: HazardKind.Tide, damage: 34, knockback: 130, radius: 18 };
  }

  protected setupInstance() {
    this.setGates((1 << CG.naveSouth) | (1 << CG.captSouth) | (1 << CG.bossSouth) | FLOOD_MASK);
    this.state.stage = "The Sunken Stair";
    this.sim.onEnemyRemoved = (ed) => {
      this.naveEnemies.delete(ed.id);
      this.tideEnemies.delete(ed.id);
    };
  }

  protected tickInstance(now: number) {
    this.theNave();
    this.risingTide(now);
  }

  private theNave() {
    if (this.nave === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.nave));
    if (this.nave === "idle") {
      if (!inside.length) return;
      this.gatherParty((x, y) => inRect(x, y, R.nave), this.insideGate(CG.naveSouth), "the Nave of the Drowned");
      this.gate(CG.naveSouth, false);
      this.state.stage = "The Nave of the Drowned";
      this.emitAll("banner", { title: "The Nave of the Drowned", sub: "The congregation stands" });
      this.spawnWave(0);
      return;
    }
    if (!this.living().length) {
      for (const id of this.naveEnemies) this.sim.removeEnemy(id);
      this.naveEnemies.clear();
      this.nave = "idle";
      this.gate(CG.naveSouth, true);
      return;
    }
    if (this.naveEnemies.size) return;
    if (this.nave < 2) {
      const next = (this.nave + 1) as 1 | 2;
      this.emitAll("banner", next === 1 ? { title: "More rise from the pews", sub: "The sermon is not over" } : { title: "The Drowned Bishop", sub: "The last to rise, and the worst" });
      this.spawnWave(next);
      return;
    }
    this.nave = "done";
    this.gate(CG.naveSouth, true);
    this.gate(CG.naveNorth, true);
    this.emitAll("banner", { title: "The pews are empty", sub: "Beware the tide" });
    this.state.stage = "The Rising Tide";
  }

  private spawnWave(i: 0 | 1 | 2) {
    this.nave = i;
    const keys = WAVES[i];
    const cx = ((R.nave.x0 + R.nave.x1) / 2) * TILE;
    const cy = ((R.nave.y0 + R.nave.y1) / 2) * TILE - 60;
    keys.forEach((k, n) => {
      const a = (n / keys.length) * Math.PI * 2;
      const bishop = i === 2 && n === 0;
      const ed = this.sim.spawnEnemy(k, cx + Math.cos(a) * 140, cy + Math.sin(a) * 70, { level: 27, elite: bishop || (n === 0 && Math.random() < 0.3), hpScale: bishop ? 2 : undefined });
      ed.homeX = cx;
      ed.homeY = cy;
      const target = this.living()[0];
      if (target) ed.target = target.sid;
      this.naveEnemies.add(ed.id);
    });
  }

  /** The Rising Tide: the hall floods from the south, one row at a time, until three valves are turned. */
  private risingTide(now: number) {
    if (this.nave !== "done" || this.tide === "held") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.tide));
    if (this.tide === "waiting") {
      if (!inside.length) return;
      this.tide = "rising";
      this.nextRise = now + 3000;
      this.nextDrowned = now + DROWNED_EVERY_MS;
      this.emitAll("banner", { title: "The Rising Tide", sub: "Turn the three sluice valves before the sea fills the hall" });
      return;
    }
    if (!inside.length && !this.living().length) return this.resetTide();
    if (now >= this.nextDrowned) {
      this.nextDrowned = now + DROWNED_EVERY_MS;
      if (this.tideEnemies.size < 3 && inside.length) {
        const y = (R.tide.y1 - this.flooded - 2) * TILE;
        const ed = this.sim.spawnEnemy("drowned", (R.tide.x0 + 6 + Math.random() * (R.tide.x1 - R.tide.x0 - 12)) * TILE, y, { level: 27 });
        ed.homeX = ed.e.x;
        ed.homeY = ed.e.y;
        ed.target = inside[0].sid;
        this.tideEnemies.add(ed.id);
      }
    }
    if (now < this.nextRise) return;
    this.nextRise = now + TIDE_EVERY_MS;
    if (this.flooded >= TIDE_ROWS) return this.washOut();
    // One more row goes under. Anyone standing in it is swept north.
    const row = R.tide.y1 - 1 - this.flooded;
    this.flooded++;
    this.setGates(this.open & ~(1 << (CG_FLOOD_ID + this.flooded - 1)));
    const sweep = (b: { x: number; y: number }) => {
      const tx = Math.floor(b.x / TILE);
      if (Math.floor(b.y / TILE) !== row || tx < R.tide.x0 || tx >= R.tide.x1) return false;
      const to = this.dryTileNorth(tx, row);
      b.x = Math.fround(to.x);
      b.y = Math.fround(to.y);
      return true;
    };
    for (const pd of this.sim.players.values()) {
      if (pd.p.act !== Act.Dead && sweep(pd.p)) pd.p.hp = Math.max(1, pd.p.hp - Math.round(pd.p.hpMax * 0.05));
    }
    for (const ed of this.sim.enemies.values()) sweep(ed.e);
    this.emitAll("fx", { k: "tiderise", x: ((R.tide.x0 + R.tide.x1) / 2) * TILE, y: row * TILE + 16, r: (R.tide.x1 - R.tide.x0) * 16 });
    if (this.flooded === TIDE_ROWS - 4) this.emitAll("banner", { title: "The sea is nearly in", sub: "Hurry" });
  }

  /** The nearest dry tile north of a flooding row (never inside a pillar). */
  private dryTileNorth(tx: number, row: number) {
    for (let dy = 1; dy <= 5; dy++) {
      for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
        if (!this.gmap.isSolidTile(tx + dx, row - dy)) return { x: (tx + dx) * TILE + TILE / 2, y: (row - dy) * TILE + TILE / 2 };
      }
    }
    return { x: 42 * TILE + TILE / 2, y: (R.tide.y0 + 1) * TILE };
  }

  /** The tide filled the hall: the sea carries everyone inside back to the Nave. */
  private washOut() {
    const back = { x: 42 * TILE + 16, y: (R.nave.y0 + 4) * TILE };
    for (const pd of this.sim.players.values()) {
      if (pd.p.act === Act.Dead || !inRect(pd.p.x, pd.p.y, { ...R.tide, y1: R.tide.y1 + 8 })) continue;
      pd.p.x = Math.fround(back.x + (Math.random() - 0.5) * 60);
      pd.p.y = Math.fround(back.y + Math.random() * 30);
      pd.p.hp = Math.max(1, pd.p.hp - Math.round(pd.p.hpMax * 0.2));
    }
    this.emitAll("banner", { title: "The sea takes you", sub: "The tide draws back. Try again" });
    this.resetTide();
  }

  private resetTide() {
    for (const id of this.tideEnemies) this.sim.removeEnemy(id);
    this.tideEnemies.clear();
    this.tide = "waiting";
    this.flooded = 0;
    this.valves = 0;
    this.setGates((this.open | FLOOD_MASK) & ~VALVE_MASK);
  }

  /** The sluice valves: three turned, and the sea drains out of the hall. */
  protected useObject(client: Client, obj: WorldObject) {
    if (obj.kind !== "lever" || !obj.id.startsWith("valve-") || this.tide === "held") return;
    if (this.nave !== "done") return;
    const i = Number(obj.id.split("-")[1]);
    if (this.valves & (1 << i)) return;
    const [vx, vy] = SLUICE_VALVES[i];
    if (this.gmap.isSolidTile(vx, vy)) return this.notify(client, "The valve is under the water.", "error");
    this.valves |= 1 << i;
    this.setGates(this.open | (1 << (CG_VALVE_BIT + i)));
    this.emitNear("fx", { k: "lever", x: obj.x, y: obj.y }, obj.x, obj.y);
    const left = 3 - [0, 1, 2].filter((n) => this.valves & (1 << n)).length;
    if (left) {
      this.notify(client, `The valve groans shut. ${left} to go.`, "good");
      if (this.tide === "waiting") {
        this.tide = "rising";
        this.nextRise = this.sim.now + 3000;
      }
      return;
    }
    this.tide = "held";
    this.setGates((this.open | FLOOD_MASK) | (1 << CG.tideNorth));
    for (const id of this.tideEnemies) this.sim.removeEnemy(id);
    this.tideEnemies.clear();
    this.emitAll("banner", { title: "The tide is held", sub: "The water drains from the hall. The way up is open" });
    this.emitAll("fx", { k: "tidedrain", x: ((R.tide.x0 + R.tide.x1) / 2) * TILE, y: ((R.tide.y0 + R.tide.y1) / 2) * TILE, r: 300 });
    this.state.stage = "The Captain's Deck";
  }
}
