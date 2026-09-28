import { TILE, type SpawnDef } from "@floors/shared";
import type { EnemyData, Sim } from "./sim.ts";

interface Slot {
  key: string;
  enemyId?: string;
  respawnAt: number;
}

interface Group {
  def: SpawnDef;
  slots: Slot[];
}

/** Keeps each authored encounter populated, respawning members after a delay. */
export class Spawners {
  private groups: Group[];
  private bySpawner = new Map<string, Group>();

  constructor(private sim: Sim, defs: SpawnDef[]) {
    this.groups = defs.map((def) => ({ def, slots: def.enemies.map((key) => ({ key, respawnAt: 0 })) }));
    for (const g of this.groups) this.bySpawner.set(g.def.id, g);
  }

  update(now: number) {
    for (const g of this.groups) {
      for (const slot of g.slots) {
        if (slot.enemyId || now < slot.respawnAt) continue;
        const spot = this.spot(g.def);
        const elite = Math.random() < g.def.elite;
        const ed = this.sim.spawnEnemy(slot.key, spot.x, spot.y, { level: g.def.level, elite, spawner: g.def.id });
        ed.homeX = g.def.x;
        ed.homeY = g.def.y;
        slot.enemyId = ed.id;
      }
    }
  }

  onRemoved(ed: EnemyData) {
    if (!ed.spawner) return;
    const g = this.bySpawner.get(ed.spawner);
    const slot = g?.slots.find((s) => s.enemyId === ed.id);
    if (!g || !slot) return;
    slot.enemyId = undefined;
    slot.respawnAt = this.sim.now + g.def.respawn * 1000;
  }

  private spot(def: SpawnDef) {
    if (def.radius <= 0) return { x: def.x, y: def.y };
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * def.radius;
      const x = def.x + Math.cos(a) * r;
      const y = def.y + Math.sin(a) * r;
      if (!this.sim.grid.isBlocked(Math.floor(x / TILE), Math.floor(y / TILE))) return { x, y };
    }
    return { x: def.x, y: def.y };
  }
}
