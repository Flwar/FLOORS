import type { Client } from "colyseus";
import { GG, GG_RUNE_BIT, GLACIER_ROOMS as R, HazardKind, RUNES, TILE, type WorldObject } from "@floors/shared";
import { InstanceRoom, inRect, type BossArena, type MinibossHall } from "./InstanceRoom.ts";

const ORDINAL = ["first", "second", "third", "last"];
const WAVES: string[][] = [
  ["icewraith", "icewraith", "rimewolf", "rimewolf"],
  ["rimeguard", "rimeguard", "icewraith", "icewraith"],
  // The Frozen Champion steps out of the mirrors last (the first of this wave, always elite).
  ["yeti", "yeti", "icewraith", "rimeguard"],
];

/**
 * One party's climb of the Glacier Throne (Floor 4's boss dungeon): the icicle bridge,
 * the Hall of Mirrors (three waves), the Hall of Echoes (read the echo stones, strike the
 * runes in their order — a new order every run), Jarnhild the Frost Giant, then Hrimthar.
 */
export class GlacierRoom extends InstanceRoom {
  readonly kind = "glacier";
  private mirrors: "idle" | 0 | 1 | 2 | "done" = "idle";
  private mirrorEnemies = new Set<string>();
  private order: number[] = [];
  private struck = 0;

  protected hall(): MinibossHall {
    return {
      room: R.jarnhild, southGate: GG.jarnSouth, northGate: GG.jarnNorth, stage: "Hall of the Frost Giant", after: "The Winter Stair",
      victory: { title: "The Frost Giant falls", sub: "The Winter King waits above" },
    };
  }

  protected arena(): BossArena {
    const d = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05);
    return {
      gate: GG.bossSouth,
      inArena: (x, y) => d(x, y) < R.boss.r - 0.5,
      stillIn: (x, y) => y < 29 * TILE && d(x, y) < R.boss.r + 1.5,
      stage: "The Winter Throne",
      intro: { name: "Hrimthar, the Winter King", sub: "Keeper of the Fourth Gate" },
      victory: { title: "WINTER BREAKS", sub: "The snow stops falling on the Frostvale" },
      wipe: { title: "Winter waits", sub: "Learn him. Return." },
    };
  }

  /** Icicles fall across the bridge in rows. */
  protected trapHazard() {
    return { kind: HazardKind.Frost, damage: 28, knockback: 100, radius: 18 };
  }

  protected setupInstance() {
    this.setGates((1 << GG.mirrorsSouth) | (1 << GG.jarnSouth) | (1 << GG.bossSouth));
    this.state.stage = "The Icicle Bridge";
    this.sim.onEnemyRemoved = (ed) => this.mirrorEnemies.delete(ed.id);
    // A new rune order every run, told by the echo stones (each tells one step, in a shuffled place).
    this.order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const places = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    places.forEach((stone, step) => {
      const o = this.map.object(`echo-${stone}`);
      if (o) o.text = `The ice speaks, faint and cold: "The ${ORDINAL[step]} rune is the ${RUNES[this.order[step]]}."`;
    });
  }

  protected tickInstance() {
    this.hallOfMirrors();
  }

  private hallOfMirrors() {
    if (this.mirrors === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.mirrors));
    if (this.mirrors === "idle") {
      if (!inside.length) return;
      this.gatherParty((x, y) => inRect(x, y, R.mirrors), this.insideGate(GG.mirrorsSouth), "the Hall of Mirrors");
      this.gate(GG.mirrorsSouth, false);
      this.state.stage = "The Hall of Mirrors";
      this.emitAll("banner", { title: "The Hall of Mirrors", sub: "Your reflections step out of the ice" });
      this.spawnWave(0);
      return;
    }
    if (!this.living().length) {
      for (const id of this.mirrorEnemies) this.sim.removeEnemy(id);
      this.mirrorEnemies.clear();
      this.mirrors = "idle";
      this.gate(GG.mirrorsSouth, true);
      return;
    }
    if (this.mirrorEnemies.size) return;
    if (this.mirrors < 2) {
      const next = (this.mirrors + 1) as 1 | 2;
      this.emitAll("banner", next === 1 ? { title: "The mirrors crack", sub: "More of them" } : { title: "The Frozen Champion", sub: "The last reflection is the strongest" });
      this.spawnWave(next);
      return;
    }
    this.mirrors = "done";
    this.gate(GG.mirrorsSouth, true);
    this.gate(GG.mirrorsNorth, true);
    this.emitAll("banner", { title: "The mirrors are still", sub: "Listen to the echoes" });
    this.state.stage = "The Hall of Echoes";
  }

  private spawnWave(i: 0 | 1 | 2) {
    this.mirrors = i;
    const keys = WAVES[i];
    const cx = ((R.mirrors.x0 + R.mirrors.x1) / 2) * TILE;
    const cy = ((R.mirrors.y0 + R.mirrors.y1) / 2) * TILE - 60;
    keys.forEach((k, n) => {
      const a = (n / keys.length) * Math.PI * 2;
      const champion = i === 2 && n === 0;
      const ed = this.sim.spawnEnemy(k, cx + Math.cos(a) * 140, cy + Math.sin(a) * 70, { level: 19, elite: champion || (n === 0 && Math.random() < 0.3), hpScale: champion ? 2 : undefined });
      ed.homeX = cx;
      ed.homeY = cy;
      const target = this.living()[0];
      if (target) ed.target = target.sid;
      this.mirrorEnemies.add(ed.id);
    });
  }

  /** The runes: strike them in the order the echo stones tell. A wrong rune shatters them all. */
  protected useObject(client: Client, obj: WorldObject) {
    if (obj.kind !== "lever" || this.open & (1 << GG.echoesNorth)) return;
    const rune = Number(obj.id.split("-")[1]);
    if (this.open & (1 << (GG_RUNE_BIT + rune))) return;
    this.emitNear("fx", { k: "lever", x: obj.x, y: obj.y }, obj.x, obj.y);
    if (rune === this.order[this.struck]) {
      this.struck++;
      this.setGates(this.open | (1 << (GG_RUNE_BIT + rune)));
      this.emitNear("fx", { k: "iceburst", x: obj.x, y: obj.y }, obj.x, obj.y);
      this.notify(client, `The Rune of the ${RUNES[rune]} rings like a bell.`, "good");
      if (this.struck === 4) {
        this.gate(GG.echoesNorth, true);
        this.emitAll("banner", { title: "The runes answer", sub: "The way to the Frost Giant opens" });
        this.state.stage = "Hall of the Frost Giant";
      }
      return;
    }
    // Wrong: the runes go dark, and the ice sends something to punish you.
    this.struck = 0;
    this.setGates(this.open & ~(15 << GG_RUNE_BIT));
    this.emitAll("banner", { title: "The runes shatter", sub: "Listen to the echoes again" });
    const cx = ((R.echoes.x0 + R.echoes.x1) / 2) * TILE;
    const cy = ((R.echoes.y0 + R.echoes.y1) / 2) * TILE;
    for (let i = 0; i < 2; i++) {
      const ed = this.sim.spawnEnemy("icewraith", cx + (i ? 140 : -140), cy, { level: 19 });
      ed.homeX = cx;
      ed.homeY = cy;
      ed.target = client.sessionId;
    }
  }
}
