import * as Phaser from "phaser";
import { ENEMIES, LOOT, QUESTS, questOpen, TILE, type QuestDef, type QuestStage, type WorldMap, type Zone, routeVia } from "@floors/shared";
import type { InvView } from "../ui/ui.ts";

/** A quest shown in the tracker: the one you are on, or (for the main story) the next to pick up. */
export interface Tracked {
  quest: QuestDef;
  /** Not yet accepted: go and see the giver. */
  offered: boolean;
  stage?: QuestStage;
  progress: number;
}

/** The main quest the player is on, or the next one they can pick up. */
export function mainObjective(inv: InvView, here?: number): { quest: QuestDef; offered: boolean } | undefined {
  const active = QUESTS.filter((q) => q.main && inv.quests[q.id] && !inv.quests[q.id].done);
  const next = QUESTS.filter((q) => q.main && !inv.quests[q.id] && questOpen(q, (id) => !!inv.quests[id]?.done, inv.floor));
  // The story of the floor you're standing on comes first: floors open for everyone, so a
  // climber can be on Floor 2 with Floor 1's story still unfinished.
  const on = (q: QuestDef) => !here || (q.floor ?? 1) === here;
  const a = active.find(on) ?? (here ? undefined : active[0]);
  if (a) return { quest: a, offered: false };
  const n = next.find(on);
  if (n) return { quest: n, offered: true };
  if (active[0]) return { quest: active[0], offered: false };
  return next[0] ? { quest: next[0], offered: true } : undefined;
}

/** Main story first, then side quests in progress. */
export function trackedQuests(inv: InvView, here?: number): Tracked[] {
  const out: Tracked[] = [];
  const main = mainObjective(inv, here);
  if (main) {
    const st = inv.quests[main.quest.id];
    out.push({ quest: main.quest, offered: main.offered, stage: st ? main.quest.stages[st.stage] : undefined, progress: st?.progress ?? 0 });
  }
  for (const q of QUESTS) {
    const st = inv.quests[q.id];
    if (q.main || !st || st.done) continue;
    out.push({ quest: q, offered: false, stage: q.stages[st.stage], progress: st.progress });
  }
  return out.slice(0, 4);
}

export function countItem(inv: InvView, key: string) {
  let n = 0;
  for (const it of inv.inventory) if (it?.key === key) n += it.qty;
  return n;
}

/** Enemies that can drop an item (for "bring me N of these"). */
function dropsFrom(item: string): string[] {
  return Object.values(ENEMIES)
    .filter((d) => LOOT[d.loot]?.rolls.some((r) => r.pool.some((p) => p.key === item)))
    .map((d) => d.key);
}

export interface QuestTarget {
  x: number;
  y: number;
  /** A person (their own "!" / "?" marker already floats above them). */
  person: boolean;
  /** Where it is, for the tracker ("Whisperwood"). */
  area?: string;
  /** The way there is through a door first (into or out of a building). */
  door?: boolean;
}

/**
 * Where a tracked quest wants you to go. People, bosses and the dungeon door are exact.
 * Hidden places point to the area around them, never the exact spot.
 */
export function questTarget(map: WorldMap, inv: InvView, t: Tracked, px: number, py: number, route = true): QuestTarget | undefined {
  const raw = rawTarget(map, inv, t, px, py);
  if (!raw || !route) return raw;
  // Through the right door: out of the building you're in, or into the one it's in.
  const r = routeVia(map, px, py, raw.x, raw.y);
  if (r.x === raw.x && r.y === raw.y) return raw;
  const inside = map.indoors(py);
  return { x: r.x, y: r.y, person: false, door: true, area: inside ? "out the door" : `inside the ${map.zoneAt(raw.x, raw.y)?.name ?? "building"}` };
}

function rawTarget(map: WorldMap, inv: InvView, t: Tracked, px: number, py: number): QuestTarget | undefined {
  const zonesAt = (x: number, y: number) => {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return map.zones
      .filter((z) => tx >= z.x0 && tx < z.x1 && ty >= z.y0 && ty < z.y1 && !(z.x0 === 0 && z.y0 === 0 && z.x1 >= map.width))
      .sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0));
  };
  const areaName = (x: number, y: number) => zonesAt(x, y).find((z) => !z.secret)?.name;
  const at = (x: number, y: number, person = false): QuestTarget => ({ x, y, person, area: areaName(x, y) });
  /** Secret places: the surrounding (public) area instead. */
  const soft = (x: number, y: number): QuestTarget => {
    const zs = zonesAt(x, y);
    if (!zs[0]?.secret) return at(x, y);
    const pub: Zone | undefined = zs.find((z) => !z.secret);
    if (!pub) return at(x, y);
    return { x: ((pub.x0 + pub.x1) / 2) * TILE, y: ((pub.y0 + pub.y1) / 2) * TILE, person: false, area: pub.name };
  };
  const npc = (id: string) => {
    const n = map.npcs.find((q) => q.id === id);
    return n ? at(n.x, n.y, true) : undefined;
  };
  const nearestSpawn = (keys: string[]) => {
    let best: QuestTarget | undefined;
    let bestD = Infinity;
    for (const s of map.spawns) {
      if (!s.enemies.some((e) => keys.includes(e))) continue;
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bestD) {
        bestD = d;
        best = soft(s.x, s.y);
      }
    }
    return best;
  };
  const door = map.objects.find((ob) => ob.kind === "door");
  const doorTarget = door ? at(door.x, door.y) : undefined;

  // A quest on another floor: point at the gate that leads there.
  const here = mapFloor(map);
  const want = t.quest.floor ?? 1;
  if (here && want !== here) {
    const up = map.objects.find((o) => o.kind === "gate" && (o.id === "ascent-gate" || o.dest === `floor${here + 1}`));
    const down = map.objects.find((o) => o.kind === "gate" && o.dest === (here === 2 ? "world" : `floor${here - 1}`));
    const gate = want > here ? up : down;
    return gate ? { ...at(gate.x, gate.y), area: want > here ? `the way up (${gate.name})` : `the way down (${gate.name})` } : undefined;
  }

  if (t.offered) return npc(t.quest.giver);
  const stage = t.stage;
  if (!stage) return undefined;
  switch (stage.kind) {
    case "talk":
      return npc(stage.npc);
    case "parry":
      return nearestSpawn(["sparring"]);
    case "kill":
      return nearestSpawn(stage.enemy) ?? doorTarget;
    case "collect":
      if (countItem(inv, stage.item) >= stage.count) return npc(t.quest.giver);
      return nearestSpawn(dropsFrom(stage.item));
    case "interact": {
      const ob = map.objects.find((x) => stage.objects.includes(x.id));
      return ob ? soft(ob.x, ob.y) : undefined;
    }
    case "visit": {
      const z = map.zones.find((x) => x.id === stage.zone);
      return z ? { x: ((z.x0 + z.x1) / 2) * TILE, y: ((z.y0 + z.y1) / 2) * TILE, person: false, area: z.secret ? undefined : z.name } : undefined;
    }
    case "dungeon": {
      const d = map.objects.find((ob) => ob.kind === "door" && ob.id !== "exit" && (stage.dungeon === "dungeon" ? ob.dest !== "stormspire" && ob.dest !== "roost" : ob.dest === stage.dungeon));
      return d ? at(d.x, d.y) : doorTarget;
    }
    default:
      return undefined;
  }
}

/** Which floor a map is (0 for dungeons). */
export function mapFloor(map: WorldMap) {
  return map.name.startsWith("Floor 3") ? 3 : map.name.startsWith("Floor 2") ? 2 : map.name.startsWith("Floor 1") ? 1 : 0;
}

export const MAIN_COLOR = 0xf2d27a;
export const SIDE_COLOR = 0x9fd3ff;

/**
 * Quest markers: an arrow circling the player for each tracked quest (gold for the story,
 * blue for side quests), and a floating pin over destinations that are on screen.
 */
export class QuestMarkers {
  private g: Phaser.GameObjects.Graphics;
  private pins: Phaser.GameObjects.Graphics;
  private angles: number[] = [];
  private alphas: number[] = [];
  private t = 0;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(1e6 - 2);
    this.pins = scene.add.graphics().setDepth(1e6 - 2);
  }

  update(dtMs: number, px: number, py: number, targets: ({ x: number; y: number; main: boolean; person: boolean } | undefined)[], view: Phaser.Geom.Rectangle) {
    this.t += dtMs;
    const g = this.g;
    const pg = this.pins;
    g.clear();
    pg.clear();
    for (let i = 0; i < Math.max(targets.length, this.alphas.length); i++) {
      const tg = targets[i];
      const d = tg ? Math.hypot(tg.x - px, tg.y - py) : 0;
      const want = tg && d > 150 ? 0.92 : 0;
      this.alphas[i] = (this.alphas[i] ?? 0) + (want - (this.alphas[i] ?? 0)) * (1 - Math.pow(0.004, dtMs / 1000));
      const alpha = this.alphas[i];
      if (!tg) continue;
      const color = tg.main ? MAIN_COLOR : SIDE_COLOR;
      // Pin over the destination when it's on screen (people already wear a marker).
      if (!tg.person && tg.x > view.x - 20 && tg.x < view.right + 20 && tg.y > view.y - 40 && tg.y < view.bottom + 20 && d > 40) {
        const bob = Math.sin(this.t / 300 + i) * 3;
        const pulse = (this.t / 1400 + i * 0.3) % 1;
        pg.lineStyle(2, color, 0.6 * (1 - pulse));
        pg.strokeEllipse(tg.x, tg.y, 20 + pulse * 30, (20 + pulse * 30) * 0.5);
        const y = tg.y - 34 + bob;
        pg.fillStyle(0x1d1a17, 0.9);
        pg.fillTriangle(tg.x - 9, y - 2, tg.x + 9, y - 2, tg.x, y + 13);
        pg.fillCircle(tg.x, y - 6, 9.5);
        pg.fillStyle(color, 1);
        pg.fillTriangle(tg.x - 6.5, y - 2, tg.x + 6.5, y - 2, tg.x, y + 10);
        pg.fillCircle(tg.x, y - 6, 7);
        pg.fillStyle(0xffffff, 0.85);
        pg.fillCircle(tg.x, y - 6, 2.6);
      }
      if (alpha < 0.02) continue;
      const a = Math.atan2(tg.y - py, tg.x - px);
      if (this.angles[i] === undefined) this.angles[i] = a;
      this.angles[i] += Phaser.Math.Angle.Wrap(a - this.angles[i]) * (1 - Math.pow(0.001, dtMs / 1000));
      const ang = this.angles[i];
      const r = (tg.main ? 44 : 38) + Math.sin(this.t / 260 + i) * 2;
      const cx = px + Math.cos(ang) * r;
      const cy = py - 16 + Math.sin(ang) * r;
      const tip = (len: number, side: number) => ({
        x: cx + Math.cos(ang) * len + Math.cos(ang + Math.PI / 2) * side,
        y: cy + Math.sin(ang) * len + Math.sin(ang + Math.PI / 2) * side,
      });
      const s = tg.main ? 1 : 0.8;
      const pts = (k: number) => [tip(7 * k * s, 0), tip(-4 * k * s, 5.5 * k * s), tip(-1.5 * k * s, 0), tip(-4 * k * s, -5.5 * k * s)] as Phaser.Math.Vector2[];
      g.fillStyle(0x1d1a17, alpha * 0.85);
      g.fillPoints(pts(1.3), true);
      g.fillStyle(color, alpha);
      g.fillPoints(pts(1), true);
    }
  }

  destroy() {
    this.g.destroy();
    this.pins.destroy();
  }
}

/** "north-west" style direction from one point to another (screen up is north). */
export function compass(dx: number, dy: number) {
  const names = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
  const i = Math.round(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return names[i];
}
