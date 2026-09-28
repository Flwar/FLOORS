import type { Client } from "colyseus";
import { buildStormspire, HazardKind, SS_CONDUIT_BIT, SS_GATE, STORMSPIRE_ROOMS as R, TILE, type WorldMap, type WorldObject } from "@floors/shared";
import type { Character } from "../game/character.ts";
import { InstanceRoom, inRect, type BossArena, type MinibossHall } from "./InstanceRoom.ts";

const CONDUITS = ["West", "High", "East"];

/**
 * One party's climb of the Stormspire (Floor 2's boss dungeon): the lightning bridge, an
 * ambush in the Gallery, three conduits to overcharge, Kael the Stormwarden, then Vaelra.
 */
export class StormspireRoom extends InstanceRoom {
  readonly kind = "stormspire" as const;
  private galleryState: "idle" | "wave1" | "wave2" | "done" = "idle";
  private galleryEnemies = new Set<string>();
  private conduits = new Set<number>();

  protected buildMap(): WorldMap {
    return buildStormspire();
  }

  protected title() {
    return { name: "The Stormspire", sub: "Floor 2 — Boss Dungeon" };
  }

  /** Leaving puts you back outside the Stormspire Gate. */
  protected exitPos(_ch: Character) {
    return { room: "floor2", x: 0, y: 0, via: "stormspire-door" };
  }

  protected hall(): MinibossHall {
    return {
      room: R.warden, southGate: SS_GATE.wardenSouth, northGate: SS_GATE.wardenNorth, stage: "Hall of the Stormwarden", after: "The Stair to the Eye",
      victory: { title: "The Stormwarden falls", sub: "The last stair is open" },
    };
  }

  protected arena(): BossArena {
    const d = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05);
    return {
      gate: SS_GATE.bossSouth,
      inArena: (x, y) => d(x, y) < R.boss.r - 0.5,
      stillIn: (x, y) => y < 25 * TILE && d(x, y) < R.boss.r + 1.5,
      stage: "The Eye of the Storm",
      intro: { name: "Vaelra, Keeper of the Storm", sub: "Keeper of the Second Gate" },
      victory: { title: "THE STORM BREAKS", sub: "The Gilded Terraces are free — and the stair above stirs" },
      wipe: { title: "The storm waits", sub: "Learn her. Return." },
    };
  }

  /** Lightning rakes the bridge: pale circles, then the bolt. */
  protected trapHazard() {
    return { kind: HazardKind.Lightning, damage: 18, knockback: 90, radius: 16 };
  }

  protected setupInstance() {
    this.setGates((1 << SS_GATE.gallerySouth) | (1 << SS_GATE.wardenSouth) | (1 << SS_GATE.bossSouth));
    this.state.stage = "The Lightning Bridge";
    this.sim.onEnemyRemoved = (ed) => this.galleryEnemies.delete(ed.id);
  }

  protected tickInstance() {
    this.gallery();
  }

  private gallery() {
    if (this.galleryState === "done") return;
    const inside = this.living().filter((pd) => inRect(pd.p.x, pd.p.y, R.gallery));
    if (this.galleryState === "idle") {
      if (!inside.length) return;
      this.gate(SS_GATE.gallerySouth, false);
      this.state.stage = "The Gallery";
      this.emitAll("banner", { title: "The Gallery", sub: "The Skyguard were waiting" });
      this.spawnWave(["skyguard", "skyguard", "stormadept", "stormadept"]);
      this.galleryState = "wave1";
      return;
    }
    if (!this.living().length) {
      for (const id of this.galleryEnemies) this.sim.removeEnemy(id);
      this.galleryEnemies.clear();
      this.galleryState = "idle";
      this.gate(SS_GATE.gallerySouth, true);
      return;
    }
    if (this.galleryEnemies.size) return;
    if (this.galleryState === "wave1") {
      this.galleryState = "wave2";
      this.emitAll("banner", { title: "The Aegis advance", sub: "" });
      this.spawnWave(["aegis", "aegis", "windcaller", "windcaller"]);
    } else if (this.galleryState === "wave2") {
      this.galleryState = "done";
      this.gate(SS_GATE.gallerySouth, true);
      this.gate(SS_GATE.galleryNorth, true);
      this.emitAll("banner", { title: "The Gallery falls silent", sub: "Climb to the Conduits" });
      this.state.stage = "The Conduits";
    }
  }

  private spawnWave(keys: string[]) {
    const cx = ((R.gallery.x0 + R.gallery.x1) / 2) * TILE;
    const cy = ((R.gallery.y0 + R.gallery.y1) / 2) * TILE - 60;
    keys.forEach((k, i) => {
      const a = (i / keys.length) * Math.PI * 2;
      const ed = this.sim.spawnEnemy(k, cx + Math.cos(a) * 130, cy + Math.sin(a) * 70, { level: 11, elite: i === 0 && Math.random() < 0.3 });
      ed.homeX = cx;
      ed.homeY = cy;
      const target = this.living()[0];
      if (target) ed.target = target.sid;
      this.galleryEnemies.add(ed.id);
    });
  }

  protected useObject(client: Client, obj: WorldObject) {
    if (obj.kind === "gate" && obj.id === "ascent") {
      client.send("lore", { name: obj.name, text: obj.text ?? "" });
      return;
    }
    if (obj.kind !== "lever") return;
    const idx = Number(obj.id.split("-")[1]);
    if (this.conduits.has(idx) || this.open & (1 << SS_GATE.conduitsNorth)) return;
    this.conduits.add(idx);
    this.setGates(this.open | (1 << (SS_CONDUIT_BIT + idx)));
    this.emitNear("fx", { k: "lever", x: obj.x, y: obj.y }, obj.x, obj.y);
    this.emitNear("fx", { k: "blizzard", x: obj.x, y: obj.y, r: 60 }, obj.x, obj.y);
    this.notify(client, `The ${CONDUITS[idx]} Conduit roars awake.`, "good");
    // The storm does not like to be woken: each conduit draws its defenders.
    const keys = idx === 1 ? ["stormadept", "skyguard"] : ["stormadept", "skylynx"];
    keys.forEach((k, i) => {
      const ed = this.sim.spawnEnemy(k, obj.x + (i ? 90 : -90), obj.y + 40, { level: 11 });
      ed.homeX = obj.x;
      ed.homeY = obj.y + 40;
      ed.target = client.sessionId;
    });
    if (this.conduits.size === 3) {
      this.gate(SS_GATE.conduitsNorth, true);
      this.emitAll("banner", { title: "The Conduits blaze", sub: "The way to the Stormwarden opens" });
      this.state.stage = "Hall of the Stormwarden";
    }
  }
}
