import type { Client } from "colyseus";
import { Act, EAct, HazardKind, PG, PG_ALTAR_BIT, PYRAMID_ROOMS as R, SUN_ALTARS, SUN_CARRY_MS, SUNWELL_TILE, TILE, type WorldObject } from "@floors/shared";
import { InstanceRoom, inRect, type BossArena, type MinibossHall } from "./InstanceRoom.ts";

const WAVES: string[][] = [
  ["sandjackal", "sandjackal", "tombguard", "sunpriest"],
  ["tombguard", "tombguard", "sandwraith", "sunpriest"],
  // The Risen King steps down from his niche last (the first of this wave, always elite).
  ["tombguard", "sandgolem", "sandwraith", "sunpriest"],
];
const ALTAR_MASK = 15 << PG_ALTAR_BIT;
const px = (t: number) => t * TILE + TILE / 2;

/**
 * One party's run through the Sun Pyramid (Floor 8's boss dungeon): the Sandfall Stair, the
 * Hall of Kings (three waves), the Sun Chamber (take the sun from the well and carry it to each
 * of the four dark altars before it burns out in your hands, while the tomb wakes), Nephra the
 * Embalmer, then Solkaris, the Sun Pharaoh.
 */
export class PyramidRoom extends InstanceRoom {
  readonly kind = "pyramid";
  private hall_: "idle" | 0 | 1 | 2 | "done" = "idle";
  private hallEnemies = new Set<string>();
  private chamber: "waiting" | "running" | "done" = "waiting";
  private tombEnemies = new Set<string>();
  /** Who holds the sun, and when it burns out in their hands. */
  private carrier?: string;
  private carryUntil = 0;
  private carryFxAt = 0;

  protected hall(): MinibossHall {
    return {
      room: R.nephra, southGate: PG.nephraSouth, northGate: PG.nephraNorth, stage: "The Embalming Hall", after: "The Pharaoh's Stair",
      victory: { title: "The Embalmer is undone", sub: "The Sun Pharaoh waits above" },
    };
  }

  protected arena(): BossArena {
    const d = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05);
    return {
      gate: PG.bossSouth,
      inArena: (x, y) => d(x, y) < R.boss.r - 0.5,
      stillIn: (x, y) => y < 27 * TILE && d(x, y) < R.boss.r + 1.5,
      stage: "The Throne of the Sun",
      intro: { name: "Solkaris, the Sun Pharaoh", sub: "Keeper of the Eighth Gate" },
      victory: { title: "THE SUN SETS", sub: "For the first time in a thousand years, night falls on the Sunscorched Sands" },
      wipe: { title: "It is still noon", sub: "Learn him. Return." },
    };
  }

  /** Sunbeams fall through the stair's slits in rows. */
  protected trapHazard() {
    return { kind: HazardKind.Sun, damage: 38, knockback: 130, radius: 18 };
  }

  protected setupInstance() {
    this.setGates((1 << PG.kingsSouth) | (1 << PG.nephraSouth) | (1 << PG.bossSouth));
    this.state.stage = "The Sandfall Stair";
    this.sim.onEnemyRemoved = (ed) => {
      this.hallEnemies.delete(ed.id);
      this.tombEnemies.delete(ed.id);
    };
  }

  protected tickInstance(now: number) {
    this.hallOfKings();
    this.sunChamber(now);
  }

  // --- The Hall of Kings --------------------------------------------------------------------

  private hallOfKings() {
    if (this.hall_ === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.kings));
    if (this.hall_ === "idle") {
      if (!inside.length) return;
      this.gatherParty((x, y) => inRect(x, y, R.kings), this.insideGate(PG.kingsSouth), "the Hall of Kings");
      this.gate(PG.kingsSouth, false);
      this.state.stage = "The Hall of Kings";
      this.emitAll("banner", { title: "The Hall of Kings", sub: "The dead kings' servants step out of their niches" });
      this.spawnWave(0);
      return;
    }
    if (!this.living().length) {
      for (const id of this.hallEnemies) this.sim.removeEnemy(id);
      this.hallEnemies.clear();
      this.hall_ = "idle";
      this.gate(PG.kingsSouth, true);
      return;
    }
    if (this.hallEnemies.size) return;
    if (this.hall_ < 2) {
      const next = (this.hall_ + 1) as 1 | 2;
      this.emitAll("banner", next === 1 ? { title: "More of them wake", sub: "The niches empty, one by one" } : { title: "The Risen King", sub: "The last king in the hall steps down from his throne" });
      this.spawnWave(next);
      return;
    }
    this.hall_ = "done";
    this.gate(PG.kingsSouth, true);
    this.gate(PG.kingsNorth, true);
    this.emitAll("banner", { title: "The hall falls quiet", sub: "Ahead: the Sun Chamber" });
    this.state.stage = "The Sun Chamber";
  }

  private spawnWave(i: 0 | 1 | 2) {
    this.hall_ = i;
    const keys = WAVES[i];
    const cx = ((R.kings.x0 + R.kings.x1) / 2) * TILE;
    const cy = ((R.kings.y0 + R.kings.y1) / 2) * TILE - 60;
    keys.forEach((k, n) => {
      const a = (n / keys.length) * Math.PI * 2;
      const king = i === 2 && n === 0;
      const ed = this.sim.spawnEnemy(k, cx + Math.cos(a) * 140, cy + Math.sin(a) * 70, { level: 35, elite: king || (n === 0 && Math.random() < 0.3), hpScale: king ? 2.2 : undefined });
      ed.homeX = cx;
      ed.homeY = cy;
      const target = this.living()[0];
      if (target) ed.target = target.sid;
      this.hallEnemies.add(ed.id);
    });
  }

  // --- The Sun Chamber ----------------------------------------------------------------------

  private lit() {
    let n = 0;
    for (let i = 0; i < SUN_ALTARS.length; i++) if (this.open & (1 << (PG_ALTAR_BIT + i))) n++;
    return n;
  }

  /** The tomb wakes: one of the dead climbs out, near `x, y`, and goes for the living. */
  private rise(key: string, tx: number, ty: number) {
    const ed = this.sim.spawnEnemy(key, px(tx), px(ty), { level: 35 });
    ed.homeX = ed.e.x;
    ed.homeY = ed.e.y;
    const target = this.living()[0];
    if (target) ed.target = target.sid;
    this.tombEnemies.add(ed.id);
  }

  private sunChamber(now: number) {
    if (this.hall_ !== "done" || this.chamber === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.sun));
    if (this.chamber === "waiting") {
      if (!inside.length) return;
      this.chamber = "running";
      this.emitAll("banner", { title: "The Sun Chamber", sub: "Take the sun from the well. Carry it to the dark altars before it burns out" });
      this.rise("tombguard", 42, 63);
      this.rise("tombguard", 42, 79);
      return;
    }
    // The sun in someone's hands: it burns, and then it burns out.
    if (this.carrier) {
      const pd = this.sim.players.get(this.carrier);
      if (!pd || pd.p.act === Act.Dead) this.dropSun(false);
      else if (now > this.carryUntil) this.dropSun(true);
      else if (now >= this.carryFxAt) {
        this.carryFxAt = now + 240;
        this.emitNear("fx", { k: "suncarry", x: pd.p.x, y: pd.p.y, p: pd.sid, ms: Math.max(0, this.carryUntil - now) }, pd.p.x, pd.p.y);
      }
    }
    if (!this.living().length) {
      // A wipe puts the altars out again.
      for (const id of this.tombEnemies) this.sim.removeEnemy(id);
      this.tombEnemies.clear();
      this.carrier = undefined;
      this.setGates(this.open & ~ALTAR_MASK);
      this.chamber = "waiting";
    }
  }

  /** The sun leaves the carrier's hands: burnt out (too slow), or dropped (they fell). */
  private dropSun(burnt: boolean) {
    const sid = this.carrier!;
    this.carrier = undefined;
    const pd = this.sim.players.get(sid);
    if (pd) this.emitNear("fx", { k: "sunfade", x: pd.p.x, y: pd.p.y }, pd.p.x, pd.p.y);
    const c = this.clients.getById(sid);
    if (c && burnt) this.notify(c, "The sun burns out in your hands. Take it from the well again — and be quicker.", "error");
  }

  protected useObject(client: Client, obj: WorldObject) {
    if (obj.kind !== "lever" || this.chamber !== "running") return;
    const sid = client.sessionId;
    const now = this.sim.now;
    if (obj.id === "sunwell") {
      if (this.carrier && this.carrier !== sid) return this.notify(client, "Someone already carries the sun.", "error");
      this.carrier = sid;
      this.carryUntil = now + SUN_CARRY_MS;
      this.carryFxAt = 0;
      this.emitNear("fx", { k: "suntaken", x: obj.x, y: obj.y }, obj.x, obj.y);
      this.notify(client, `You hold the sun. Carry it to a dark altar — it burns out in ${SUN_CARRY_MS / 1000} seconds.`, "good");
      return;
    }
    if (!obj.id.startsWith("altar-")) return;
    const i = Number(obj.id.split("-")[1]);
    if (this.open & (1 << (PG_ALTAR_BIT + i))) return this.notify(client, "This altar already burns.");
    if (this.carrier !== sid) return this.notify(client, "The altar is cold and dark. It needs the sun from the well.", "error");
    this.carrier = undefined;
    this.setGates(this.open | (1 << (PG_ALTAR_BIT + i)));
    this.emitNear("fx", { k: "altarlit", x: obj.x, y: obj.y }, obj.x, obj.y);
    const lit = this.lit();
    if (lit < SUN_ALTARS.length) {
      this.notify(client, `The altar blazes — ${lit} of ${SUN_ALTARS.length} burn.`, "good");
      // The light wakes the dead: one climbs out beside the altar, and a wraith rises by the well.
      const [ax, ay] = SUN_ALTARS[i];
      this.rise(lit >= 2 ? "sandwraith" : "tombguard", ax + (ax < 42 ? 3 : -3), ay);
      if (lit >= 2) this.rise("sandwraith", SUNWELL_TILE[0], SUNWELL_TILE[1] + (ay < 71 ? 4 : -4));
      return;
    }
    this.chamber = "done";
    this.gate(PG.sunNorth, true);
    for (const id of this.tombEnemies) {
      const ed = this.sim.enemies.get(id);
      if (ed && ed.e.act !== EAct.Dead) this.sim.removeEnemy(id);
    }
    this.tombEnemies.clear();
    this.emitAll("banner", { title: "THE CHAMBER BLAZES", sub: "The dead fall back to dust. The way to the Embalmer is open" });
    this.emitAll("fx", { k: "sunchamber", x: px(42), y: px(71), r: 420 });
    this.state.stage = "The Embalming Hall";
  }
}
