import * as Phaser from "phaser";
import { QUESTS, TILE, type QuestDef, type WorldMap } from "@floors/shared";
import type { InvView } from "../ui/ui.ts";

/** The main quest the player is on, or the next one they can pick up. */
export function mainObjective(inv: InvView): { quest: QuestDef; offered: boolean } | undefined {
  const active = QUESTS.find((q) => q.main && inv.quests[q.id] && !inv.quests[q.id].done);
  if (active) return { quest: active, offered: false };
  const next = QUESTS.find((q) => q.main && !inv.quests[q.id] && (!q.requires || inv.quests[q.requires]?.done));
  return next ? { quest: next, offered: true } : undefined;
}

type Point = { x: number; y: number };

/**
 * Where the arrow should point. People and the dungeon door are exact; hunting and
 * searching point at the region only, and stop once you are in it, so exploring stays yours.
 */
export function objectiveTarget(map: WorldMap, inv: InvView, px: number, py: number): Point | undefined {
  const o = mainObjective(inv);
  if (!o) return undefined;
  const npc = (id: string) => map.npcs.find((n) => n.id === id);
  const zoneAt = (x: number, y: number) => {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return map.zones.find((z) => tx >= z.x0 && tx < z.x1 && ty >= z.y0 && ty < z.y1);
  };
  const region = (x: number, y: number): Point | undefined => {
    const z = zoneAt(x, y);
    if (!z) return { x, y };
    if (zoneAt(px, py) === z) return undefined;
    return { x: ((z.x0 + z.x1) / 2) * TILE, y: ((z.y0 + z.y1) / 2) * TILE };
  };
  const door = map.objects.find((ob) => ob.kind === "door");
  if (o.offered) return npc(o.quest.giver);
  const stage = o.quest.stages[inv.quests[o.quest.id].stage];
  if (!stage) return undefined;
  switch (stage.kind) {
    case "talk":
      return npc(stage.npc);
    case "parry": {
      const s = map.spawns.find((sp) => sp.enemies.includes("sparring"));
      return s && Math.hypot(s.x - px, s.y - py) > 120 ? s : undefined;
    }
    case "kill": {
      let best: Point | undefined;
      let bestD = Infinity;
      for (const s of map.spawns) {
        if (!s.enemies.some((e) => stage.enemy.includes(e))) continue;
        const d = Math.hypot(s.x - px, s.y - py);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      if (best) return region(best.x, best.y);
      // Dungeon bosses: lead the way to the dungeon.
      return door;
    }
    case "interact": {
      const ob = map.objects.find((x) => stage.objects.includes(x.id));
      return ob ? region(ob.x, ob.y) : undefined;
    }
    case "visit": {
      const z = map.zones.find((x) => x.id === stage.zone);
      return z && zoneAt(px, py) !== z ? { x: ((z.x0 + z.x1) / 2) * TILE, y: ((z.y0 + z.y1) / 2) * TILE } : undefined;
    }
    case "dungeon":
      return door;
    default:
      return undefined;
  }
}

/** A small gold arrow circling the player, pointing at the current objective. */
export class ObjectiveArrow {
  private g: Phaser.GameObjects.Graphics;
  private alpha = 0;
  private angle = 0;
  private t = 0;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(1e6 - 2);
  }

  update(dtMs: number, px: number, py: number, target: Point | undefined) {
    this.t += dtMs;
    const d = target ? Math.hypot(target.x - px, target.y - py) : 0;
    const want = target && d > 150 ? 0.9 : 0;
    this.alpha += (want - this.alpha) * (1 - Math.pow(0.004, dtMs / 1000));
    const g = this.g;
    g.clear();
    if (this.alpha < 0.02 || !target) return;
    const a = Math.atan2(target.y - py, target.x - px);
    // Turn smoothly, the short way round.
    const diff = Phaser.Math.Angle.Wrap(a - this.angle);
    this.angle += diff * (1 - Math.pow(0.001, dtMs / 1000));
    const r = 44 + Math.sin(this.t / 260) * 2;
    const cx = px + Math.cos(this.angle) * r;
    const cy = py - 16 + Math.sin(this.angle) * r;
    const tip = (len: number, side: number) => ({
      x: cx + Math.cos(this.angle) * len + Math.cos(this.angle + Math.PI / 2) * side,
      y: cy + Math.sin(this.angle) * len + Math.sin(this.angle + Math.PI / 2) * side,
    });
    const pts = (s: number) => [tip(7 * s, 0), tip(-4 * s, 5.5 * s), tip(-1.5 * s, 0), tip(-4 * s, -5.5 * s)];
    g.fillStyle(0x1d1a17, this.alpha * 0.85);
    g.fillPoints(pts(1.3) as Phaser.Math.Vector2[], true);
    g.fillStyle(0xf2d27a, this.alpha);
    g.fillPoints(pts(1) as Phaser.Math.Vector2[], true);
  }

  destroy() {
    this.g.destroy();
  }
}
