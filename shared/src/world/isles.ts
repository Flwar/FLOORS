import { TILE } from "../constants.ts";
import { Tile, type NpcDef, type WorldMap, type WorldObject } from "./map.ts";

/**
 * Helpers for building a floor out of floating isles: islands with noisy coasts, bridges,
 * pools, houses, people, places and spawns, and the finishing passes (trees, the cliff rim,
 * clearings around everything that matters). Floors 4 and up are built with these.
 */

export const px = (t: number) => t * TILE + TILE / 2;

export function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise(x: number, y: number, scale: number, seed: number) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export type Look = NpcDef["look"];

export function isleBuilder(m: WorldMap) {
  const W = m.width;
  const H = m.height;
  const protect = new Uint8Array(W * H);
  const P = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && protect[y * W + x] === 1;
  const setP = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) protect[y * W + x] = 1;
  };
  const land = (x: number, y: number) => m.get(x, y) !== Tile.Void;
  const open = (x: number, y: number) => land(x, y) && !P(x, y);
  return {
    P,
    setP,
    land,
    open,
    /** An island with a noisy coast. */
    island(cx: number, cy: number, rx: number, ry: number, seed: number, tile: number = Tile.Grass) {
      for (let y = cy - ry - 3; y <= cy + ry + 3; y++) {
        for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
          const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
          if (d < 1 + (noise(x, y, 5, seed) - 0.5) * 0.3) m.set(x, y, tile);
        }
      }
    },
    /** A protected strip of ground (bridges over the sky, roads). */
    bridge(x0: number, y0: number, x1: number, y1: number, half = 1, tile: number = Tile.StoneFloor) {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = Math.round(x0 + (x1 - x0) * t);
        const y = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            m.set(x + dx, y + dy, tile);
            setP(x + dx, y + dy);
          }
        }
      }
    },
    /** A pool (water, lava or ice, as the floor paints it) on unprotected ground. */
    pool(cx: number, cy: number, rx: number, ry: number, seed: number, tile: number = Tile.Water) {
      for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
        for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
          if (Math.hypot((x - cx) / rx, (y - cy) / ry) < 1 + (noise(x, y, 3, seed) - 0.5) * 0.35 && open(x, y)) m.set(x, y, tile);
        }
      }
    },
    /** Paint a noise-driven scatter over a rectangle of open ground. */
    scatter(x0: number, y0: number, x1: number, y1: number, pick: (x: number, y: number, t: number) => number | undefined) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!open(x, y)) continue;
          const t = pick(x, y, m.get(x, y));
          if (t !== undefined) m.set(x, y, t);
        }
      }
    },
    /** Protect a rectangle (a town) from trees and rocks. */
    protectRect(r: { x0: number; y0: number; x1: number; y1: number }) {
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) if (land(x, y)) setP(x, y);
    },
    house(id: string, name: string, tx: number, ty: number, tw: number, th: number) {
      m.fill(tx, ty, tx + tw, ty + th, Tile.House);
      m.buildings.push({ id, name, tx, ty, tw, th });
    },
    npc(id: string, name: string, role: NpcDef["role"], tx: number, ty: number, look: Look, greeting: string, shop?: string) {
      m.npcs.push({ id, name, role, x: px(tx), y: px(ty), look, greeting, shop });
    },
    board(id: string, tx: number, ty: number) {
      m.prop("board", tx, ty - 1);
      m.npcs.push({ id, name: "Mission Board", role: "board", x: px(tx), y: px(ty), look: { skin: "#000", cloth: "#000", trim: "#000", hair: "#000" }, greeting: "Missions posted by the town. Each pays gold, experience and Marks — and goes back up on the board a while after it's done." });
    },
    obj(o: Omit<WorldObject, "x" | "y"> & { tx: number; ty: number }) {
      const { tx, ty, ...rest } = o;
      m.objects.push({ ...rest, x: px(tx), y: px(ty) });
    },
    spawn(id: string, tx: number, ty: number, enemies: string[], level: number, radius = 48, respawn = 60, elite = 0.07) {
      m.spawns.push({ id, x: px(tx), y: px(ty), radius, enemies, respawn, elite, level });
    },
    /** A boss ring: a paved floor, broken pillars around it, protected from everything else. */
    arena(cx: number, cy: number, rx: number, ry: number, floor: number = Tile.StoneFloor) {
      for (let y = cy - ry - 2; y <= cy + ry + 2; y++) {
        for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
          if (!land(x, y)) continue;
          if (Math.hypot((x - cx) / rx, (y - cy) / ry) < 1) {
            m.set(x, y, floor);
            setP(x, y);
          }
        }
      }
      for (const [x, y] of [[cx - rx + 2, cy - ry + 3], [cx + rx - 2, cy - ry + 3], [cx - rx + 1, cy + 3], [cx + rx - 1, cy + 3]]) m.set(x, y, Tile.RuinWall);
    },
    /** Trees and tall grass on the open ground that's left. */
    vegetate(treeChance: number, grassChance: number, seed: number) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (m.get(x, y) !== Tile.Grass || P(x, y)) continue;
          const r = hash(x, y, seed);
          if (r < treeChance && noise(x, y, 7, seed + 1) > 0.55) m.set(x, y, Tile.Tree);
          else if (r < treeChance + grassChance) m.set(x, y, Tile.TallGrass);
        }
      }
    },
    /** The edges of the isles: open ground next to the sky becomes a cliff lip. */
    rim() {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const t = m.get(x, y);
          if (t !== Tile.Grass && t !== Tile.TallGrass && t !== Tile.Flowers) continue;
          if (m.get(x, y + 1) === Tile.Void || m.get(x - 1, y) === Tile.Void || m.get(x + 1, y) === Tile.Void || m.get(x, y - 1) === Tile.Void) m.set(x, y, Tile.Cliff);
        }
      }
    },
    /** Rock and trees must never swallow a spawn, a chest or a door. */
    clearAroundEverything() {
      const clear = (cx: number, cy: number, r: number) => {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            const t = m.get(x, y);
            if (Math.hypot(x - cx, y - cy) <= r && (t === Tile.Rock || t === Tile.Tree || t === Tile.Crystal)) m.set(x, y, Tile.Grass);
          }
        }
      };
      for (const sp of m.spawns) if (sp.radius > 0) clear(Math.floor(sp.x / TILE), Math.floor(sp.y / TILE), 2);
      for (const o of m.objects) clear(Math.floor(o.x / TILE), Math.floor(o.y / TILE), 1.5);
      for (const n of m.npcs) clear(Math.floor(n.x / TILE), Math.floor(n.y / TILE), 1.5);
    },
  };
}

/**
 * Guarantee that every NPC, object and enemy spawn can be walked to from the spawn point:
 * anything sealed off by trees or rocks gets a small clearing and the cheapest trail cut
 * through to open ground (never through the sky; through water and ruins only when `ford`
 * says so — a ford of reeds across a marsh pool, a gap broken in a line of spires).
 */
export function connectEverything(m: WorldMap, ford: { water?: boolean; ruins?: boolean } = {}) {
  const W = m.width;
  const H = m.height;
  const reach = new Uint8Array(W * H);
  const flood = (start: number) => {
    const stack = [start];
    reach[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (reach[j] || m.isSolidTile(nx, ny)) continue;
        reach[j] = 1;
        stack.push(j);
      }
    }
  };
  flood(Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE));
  const points = [...m.npcs, ...m.objects, ...m.spawns].map((q) => ({ tx: Math.floor(q.x / TILE), ty: Math.floor(q.y / TILE), spawn: "enemies" in q }));
  for (const pt of points) {
    const near = () => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (reach[(pt.ty + dy) * W + pt.tx + dx]) return true;
      return false;
    };
    if (near()) continue;
    // A clearing where the thing stands (roomier for enemy groups).
    const r = pt.spawn ? 2 : 1;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (m.get(pt.tx + dx, pt.ty + dy) === Tile.Tree || m.get(pt.tx + dx, pt.ty + dy) === Tile.Rock) m.set(pt.tx + dx, pt.ty + dy, Tile.TallGrass);
    // Cheapest way out through trees (Dijkstra; open ground is cheap, trees cost more).
    const cost = new Float64Array(W * H).fill(Infinity);
    const from = new Int32Array(W * H).fill(-1);
    const start = pt.ty * W + pt.tx;
    cost[start] = 0;
    const open: number[] = [start];
    let goal = -1;
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (cost[open[k]] < cost[open[bi]]) bi = k;
      const i = open.splice(bi, 1)[0];
      if (reach[i]) {
        goal = i;
        break;
      }
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const t = m.get(nx, ny);
        const step = t === Tile.Tree ? 4 : t === Tile.Rock ? 6 : ford.water && t === Tile.Water ? 9 : ford.ruins && t === Tile.RuinWall ? 12 : m.isSolidTile(nx, ny) ? Infinity : 1;
        const j = ny * W + nx;
        if (cost[i] + step < cost[j]) {
          cost[j] = cost[i] + step;
          from[j] = i;
          open.push(j);
        }
      }
    }
    if (goal < 0) continue;
    for (let i = goal; i !== -1; i = from[i]) {
      const x = i % W;
      const y = (i - x) / W;
      const t = m.get(x, y);
      if (t === Tile.Tree || t === Tile.Rock || (ford.water && t === Tile.Water)) m.set(x, y, Tile.TallGrass);
      else if (ford.ruins && t === Tile.RuinWall) m.set(x, y, Tile.StoneFloor);
    }
    flood(start);
  }
}
