import type { Client } from "colyseus";
import { EAct, HazardKind, MOON_PHASES, SANCTUM_ROOMS as R, SG, SG_MOON_BIT, TILE, type WorldObject } from "@floors/shared";
import { InstanceRoom, inRect, type BossArena, type MinibossHall } from "./InstanceRoom.ts";

const WAVES: string[][] = [
  ["shade", "shade", "voidhound", "voidhound"],
  ["voidcaller", "voidcaller", "abyssalknight", "shade"],
  // The Hollow Champion rises from the last throne (the first of this wave, always elite).
  ["abyssalknight", "voidcaller", "shade", "voidhound"],
];
/** While the moons are out of line, the dark sends a shade this often (up to three at once). */
const SHADE_EVERY_MS = 12000;

/**
 * One party's descent into the Abyssal Sanctum (Floor 5's boss dungeon): the Starless Walk,
 * the Hollow Court (three waves), the Hall of Moons (turn the lanterns to the phases on the
 * Moon Dial — each lantern drags its eastern neighbour round with it; a new sky every run),
 * Maelgrim the Hollow Knight, then Nyxara, Queen of the Void.
 */
export class SanctumRoom extends InstanceRoom {
  readonly kind = "sanctum";
  private court: "idle" | 0 | 1 | 2 | "done" = "idle";
  private courtEnemies = new Set<string>();
  private target: number[] = [];
  private phases = [0, 0, 0, 0];
  private shades = new Set<string>();
  private shadeAt = 0;

  protected hall(): MinibossHall {
    return {
      room: R.maelgrim, southGate: SG.maelSouth, northGate: SG.maelNorth, stage: "Hall of the Hollow Knight", after: "The Eclipse Stair",
      victory: { title: "The Hollow Knight falls", sub: "The Queen waits above" },
    };
  }

  protected arena(): BossArena {
    const d = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05);
    return {
      gate: SG.bossSouth,
      inArena: (x, y) => d(x, y) < R.boss.r - 0.5,
      stillIn: (x, y) => y < 29 * TILE && d(x, y) < R.boss.r + 1.5,
      stage: "The Eclipse Throne",
      intro: { name: "Nyxara, Queen of the Void", sub: "Keeper of the Fifth Gate" },
      victory: { title: "THE DAWN RETURNS", sub: "For the first time in a hundred years, the sun rises over the Umbral Wilds" },
      wipe: { title: "The dark endures", sub: "Learn her. Return." },
    };
  }

  /** Void rifts tear open across the Starless Walk in rows. */
  protected trapHazard() {
    return { kind: HazardKind.Void, damage: 32, knockback: 110, radius: 18 };
  }

  protected setupInstance() {
    this.setGates((1 << SG.courtSouth) | (1 << SG.maelSouth) | (1 << SG.bossSouth));
    this.state.stage = "The Starless Walk";
    this.sim.onEnemyRemoved = (ed) => {
      this.courtEnemies.delete(ed.id);
      this.shades.delete(ed.id);
    };
    // A new sky every run: at least two lanterns must turn.
    do this.target = [0, 1, 2, 3].map(() => Math.floor(Math.random() * 4));
    while (this.target.filter((p) => p !== 0).length < 2);
    const dial = this.map.object("moon-dial");
    if (dial) {
      dial.text = `Four moons are carved into the dial, west to east: ${this.target.map((p) => MOON_PHASES[p]).join(", ")}. Beneath them, a line of verse: "Each moon drags the next one round behind it."`;
    }
    this.syncMoons();
  }

  protected tickInstance(now: number) {
    this.hollowCourt();
    this.patientDark(now);
  }

  private hollowCourt() {
    if (this.court === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.court));
    if (this.court === "idle") {
      if (!inside.length) return;
      this.gatherParty((x, y) => inRect(x, y, R.court), this.insideGate(SG.courtSouth), "the Hollow Court");
      this.gate(SG.courtSouth, false);
      this.state.stage = "The Hollow Court";
      this.emitAll("banner", { title: "The Hollow Court", sub: "The Queen's court rises from its thrones" });
      this.spawnWave(0);
      return;
    }
    if (!this.living().length) {
      for (const id of this.courtEnemies) this.sim.removeEnemy(id);
      this.courtEnemies.clear();
      this.court = "idle";
      this.gate(SG.courtSouth, true);
      return;
    }
    if (this.courtEnemies.size) return;
    if (this.court < 2) {
      const next = (this.court + 1) as 1 | 2;
      this.emitAll("banner", next === 1 ? { title: "More thrones empty", sub: "The court is not finished with you" } : { title: "The Hollow Champion", sub: "The Queen's own knight rises last" });
      this.spawnWave(next);
      return;
    }
    this.court = "done";
    this.gate(SG.courtSouth, true);
    this.gate(SG.courtNorth, true);
    this.emitAll("banner", { title: "The court is silent", sub: "Read the Moon Dial" });
    this.state.stage = "The Hall of Moons";
  }

  private spawnWave(i: 0 | 1 | 2) {
    this.court = i;
    const keys = WAVES[i];
    const cx = ((R.court.x0 + R.court.x1) / 2) * TILE;
    const cy = ((R.court.y0 + R.court.y1) / 2) * TILE - 60;
    keys.forEach((k, n) => {
      const a = (n / keys.length) * Math.PI * 2;
      const champion = i === 2 && n === 0;
      const ed = this.sim.spawnEnemy(k, cx + Math.cos(a) * 140, cy + Math.sin(a) * 70, { level: 23, elite: champion || (n === 0 && Math.random() < 0.3), hpScale: champion ? 2 : undefined });
      ed.homeX = cx;
      ed.homeY = cy;
      const target = this.living()[0];
      if (target) ed.target = target.sid;
      this.courtEnemies.add(ed.id);
    });
  }

  /** While the moons are out of line and someone stands in the Hall, the dark sends shades. */
  private patientDark(now: number) {
    if (this.court !== "done" || this.open & (1 << SG.moonsNorth)) return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.moons));
    if (!inside.length) {
      this.shadeAt = now + 4000;
      return;
    }
    if (now < this.shadeAt) return;
    this.shadeAt = now + SHADE_EVERY_MS;
    if (this.shades.size >= 3) return;
    const cx = ((R.moons.x0 + R.moons.x1) / 2) * TILE;
    const cy = (R.moons.y0 + 3) * TILE;
    const ed = this.sim.spawnEnemy("shade", cx + (Math.random() - 0.5) * 400, cy, { level: 23 });
    ed.homeX = cx;
    ed.homeY = cy;
    ed.target = inside[Math.floor(Math.random() * inside.length)].sid;
    this.shades.add(ed.id);
    if (this.shades.size === 1) this.emitAll("banner", { title: "The dark is patient", sub: "Line up the moons" });
  }

  private syncMoons() {
    let mask = this.open & ~(0xff << SG_MOON_BIT);
    this.phases.forEach((p, i) => (mask |= p << (SG_MOON_BIT + i * 2)));
    this.setGates(mask);
  }

  /** The moon lanterns: each turn moves its moon one phase on, and drags its eastern neighbour with it. */
  protected useObject(client: Client, obj: WorldObject) {
    if (obj.kind !== "lever" || !obj.id.startsWith("lantern-") || this.open & (1 << SG.moonsNorth)) return;
    if (this.court !== "done") return;
    const i = Number(obj.id.split("-")[1]);
    this.phases[i] = (this.phases[i] + 1) % 4;
    if (i < 3) this.phases[i + 1] = (this.phases[i + 1] + 1) % 4;
    this.syncMoons();
    this.emitNear("fx", { k: "lever", x: obj.x, y: obj.y }, obj.x, obj.y);
    this.emitNear("fx", { k: "voidburst", x: obj.x, y: obj.y - 20 }, obj.x, obj.y);
    const right = this.phases.filter((p, n) => p === this.target[n]).length;
    if (right < 4) {
      this.notify(client, `The lantern turns to the ${MOON_PHASES[this.phases[i]]}${i < 3 ? `, and drags its neighbour to the ${MOON_PHASES[this.phases[i + 1]]}` : ""}. (${right} of 4 moons match the dial.)`, right >= 3 ? "good" : "info");
      return;
    }
    this.gate(SG.moonsNorth, true);
    for (const id of this.shades) {
      const ed = this.sim.enemies.get(id);
      if (ed && ed.e.act !== EAct.Dead) this.sim.removeEnemy(id);
    }
    this.shades.clear();
    this.emitAll("banner", { title: "The moons align", sub: "Moonlight floods the hall, and the dark flees" });
    this.state.stage = "Hall of the Hollow Knight";
  }
}
