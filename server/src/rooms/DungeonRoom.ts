import type { Client } from "colyseus";
import { buildUndercroft, GATE, TILE, UNDERCROFT_ROOMS as R, type WorldMap, type WorldObject } from "@floors/shared";
import type { Character } from "../game/character.ts";
import type { EnemyData } from "../game/sim.ts";
import { InstanceRoom, inRect, type BossArena, type MinibossHall } from "./InstanceRoom.ts";

const LEVER_NAMES = ["Sun", "Moon", "Star"];
const COURT = { x: 170 * TILE + 16, y: 62 * TILE + 16 };
const inBoss = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05) < R.boss.r - 0.5;

/** One party's run through the Undercroft (Floor 1's boss dungeon). Disposed when everyone leaves. */
export class DungeonRoom extends InstanceRoom {
  readonly kind = "dungeon" as const;
  private leverOrder: number[] = [];
  private leverProgress = 0;
  private hallState: "idle" | "wave1" | "wave2" | "done" = "idle";
  private hallEnemies = new Set<string>();

  protected buildMap(): WorldMap {
    return buildUndercroft();
  }

  protected title() {
    return { name: "The Undercroft", sub: "Floor 1 — Boss Dungeon" };
  }

  /** Leaving the dungeon always returns you to the ruins' court. */
  protected exitPos(_ch: Character) {
    return { room: "world", x: COURT.x, y: COURT.y };
  }

  protected hall(): MinibossHall {
    return {
      room: R.warden, southGate: GATE.wardenSouth, northGate: GATE.wardenNorth, stage: "The Warden's Hall", after: "The Antechamber",
      victory: { title: "The Warden falls", sub: "The way down is open" },
    };
  }

  protected arena(): BossArena {
    return {
      gate: GATE.bossSouth,
      inArena: inBoss,
      stillIn: (x, y) => y < 25 * TILE && Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05) < R.boss.r + 1.5,
      stage: "The First Gate",
      intro: { name: this.boss?.def.boss?.title ?? "Aurelion", sub: "Keeper of the First Gate" },
      victory: { title: "THE FIRST GATE IS OPEN", sub: "A path of light rises toward Floor 2" },
      wipe: { title: "The Keeper waits", sub: "Learn him. Return." },
    };
  }

  protected setupInstance() {
    this.setGates((1 << GATE.hallSouth) | (1 << GATE.wardenSouth) | (1 << GATE.bossSouth));
    // A fresh riddle every run.
    this.leverOrder = [0, 1, 2].sort(() => Math.random() - 0.5);
    const tablet = this.map.object("rune-tablet")!;
    tablet.text = `Three sigils are carved above the door: first the ${LEVER_NAMES[this.leverOrder[0]]}, then the ${LEVER_NAMES[this.leverOrder[1]]}, and last the ${LEVER_NAMES[this.leverOrder[2]]}.`;
    this.state.stage = "Entrance";
    this.sim.onEnemyRemoved = (ed) => this.hallEnemies.delete(ed.id);
  }

  protected onBossKilled(ch: Character, ed: EnemyData) {
    if (ed.def.key === "aurelion") ch.data.floor = Math.max(ch.data.floor, 2);
  }

  protected tickInstance() {
    this.hallEncounter();
  }

  private hallEncounter() {
    if (this.hallState === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.hall));
    if (this.hallState === "idle") {
      if (!inside.length) return;
      this.gate(GATE.hallSouth, false);
      this.state.stage = "The Sealed Hall";
      this.emitAll("banner", { title: "The Sealed Hall", sub: "The gates slam shut behind you" });
      this.spawnWave(["shieldbearer", "shieldbearer", "cultist", "cultist"]);
      this.hallState = "wave1";
      return;
    }
    if (!this.living().length) {
      // Party wipe: reset the encounter.
      for (const id of this.hallEnemies) this.sim.removeEnemy(id);
      this.hallEnemies.clear();
      this.hallState = "idle";
      this.gate(GATE.hallSouth, true);
      return;
    }
    if (this.hallEnemies.size) return;
    if (this.hallState === "wave1") {
      this.hallState = "wave2";
      this.emitAll("banner", { title: "Another wave", sub: "" });
      this.spawnWave(["stalker", "stalker", "brute"]);
    } else if (this.hallState === "wave2") {
      this.hallState = "done";
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

  protected useObject(client: Client, obj: WorldObject) {
    if (obj.kind === "gate" && obj.id === "ascent" && this.cleared) {
      client.send("travel", { room: "floor2" });
      return;
    }
    if (obj.kind !== "lever") return;
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
  }
}
