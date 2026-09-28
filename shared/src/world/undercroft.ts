import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";

export const UNDERCROFT_W = 90;
export const UNDERCROFT_H = 140;

/** Gate tiles for each portcullis, by id. Closed = Tile.Gate, open = Tile.StoneFloor. */
export interface GateDef {
  id: number;
  tiles: [number, number][];
}

export const UNDERCROFT_ROOMS = {
  entrance: { x0: 37, y0: 124, x1: 54, y1: 137 },
  traps: { x0: 43, y0: 108, x1: 48, y1: 124 },
  hall: { x0: 28, y0: 88, x1: 63, y1: 108 },
  puzzle: { x0: 30, y0: 64, x1: 61, y1: 78 },
  warden: { x0: 26, y0: 37, x1: 65, y1: 56 },
  ante: { x0: 39, y0: 26, x1: 52, y1: 36 },
  boss: { cx: 45, cy: 13, r: 12 },
};

export const GATE = { hallNorth: 0, puzzleNorth: 1, wardenSouth: 2, wardenNorth: 3, bossSouth: 4, hallSouth: 5 } as const;

const px = (t: number) => t * TILE + TILE / 2;

/**
 * The Undercroft — the Floor 1 boss dungeon, instanced per party. Built bottom-up:
 * entrance → trap corridor → locked hall → lever puzzle → Warden → antechamber → the Keeper.
 */
export function buildUndercroft(): WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] } {
  const W = UNDERCROFT_W;
  const H = UNDERCROFT_H;
  const m = new WorldMap(W, H) as WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
  m.name = "The Undercroft";
  m.gates = [];
  m.traps = [];
  m.fill(0, 0, W, H, Tile.Rock);
  const R = UNDERCROFT_ROOMS;
  const room = (r: { x0: number; y0: number; x1: number; y1: number }) => {
    m.fill(r.x0, r.y0, r.x1, r.y1, Tile.StoneFloor);
    for (let x = r.x0 - 1; x <= r.x1; x++) {
      if (m.get(x, r.y0 - 1) === Tile.Rock) m.set(x, r.y0 - 1, Tile.RuinWall);
      if (m.get(x, r.y1) === Tile.Rock) m.set(x, r.y1, Tile.RuinWall);
    }
    for (let y = r.y0 - 1; y <= r.y1; y++) {
      if (m.get(r.x0 - 1, y) === Tile.Rock) m.set(r.x0 - 1, y, Tile.RuinWall);
      if (m.get(r.x1, y) === Tile.Rock) m.set(r.x1, y, Tile.RuinWall);
    }
  };
  const corridor = (x0: number, y0: number, x1: number, y1: number) => m.fill(x0, y0, x1, y1, Tile.StoneFloor);
  const gate = (id: number, y: number, x0 = 43, x1 = 48) => {
    const tiles: [number, number][] = [];
    for (let x = x0; x < x1; x++) tiles.push([x, y]);
    m.gates.push({ id, tiles });
  };

  room(R.entrance);
  corridor(43, 108, 48, 124);
  room(R.hall);
  corridor(43, 78, 48, 88);
  room(R.puzzle);
  corridor(43, 56, 48, 64);
  room(R.warden);
  corridor(43, 36, 48, 37);
  room(R.ante);
  // The boss arena: a great round chamber with four pillars.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (d < R.boss.r) m.set(x, y, Tile.StoneFloor);
      else if (d < R.boss.r + 1.2 && m.get(x, y) === Tile.Rock) m.set(x, y, Tile.RuinWall);
    }
  }
  corridor(43, 24, 48, 27);
  for (const [dx, dy] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) m.fill(R.boss.cx + dx, R.boss.cy + dy, R.boss.cx + dx + 2, R.boss.cy + dy + 2, Tile.RuinWall);
  // Pillars in the Warden's arena and the hall.
  for (const [x, y] of [[33, 42], [56, 42], [33, 50], [56, 50]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (const [x, y] of [[34, 94], [55, 94], [34, 102], [55, 102]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);

  gate(GATE.hallSouth, 108);
  gate(GATE.hallNorth, 88);
  gate(GATE.puzzleNorth, 64);
  gate(GATE.wardenSouth, 56);
  gate(GATE.wardenNorth, 37);
  gate(GATE.bossSouth, 25);

  for (const [row, y] of [[0, 112], [1, 116], [2, 120]] as const) for (let x = 43; x < 48; x++) m.traps.push({ x: px(x), y: px(y), row });

  m.zones.push({ id: "undercroft", name: "The Undercroft", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [6, 8], dark: true, music: "dungeon" });
  m.zones.push({ id: "uc-warden", name: "The Warden's Hall", safe: false, ...R.warden, dark: true, music: "miniboss" });
  m.zones.push({ id: "uc-boss", name: "The First Gate", safe: false, x0: R.boss.cx - R.boss.r, y0: 0, x1: R.boss.cx + R.boss.r, y1: 25, music: "boss" });

  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "brazier-0", kind: "campfire", tx: 45, ty: 128, name: "Entrance Brazier" });
  obj({ id: "brazier-1", kind: "campfire", tx: 45, ty: 60, name: "Warden's Brazier" });
  obj({ id: "brazier-2", kind: "campfire", tx: 45, ty: 31, name: "Last Brazier" });
  obj({ id: "exit", kind: "door", tx: 45, ty: 135, name: "Stairs to the Surface" });
  obj({ id: "lever-0", kind: "lever", tx: 34, ty: 70, name: "Sun Lever" });
  obj({ id: "lever-1", kind: "lever", tx: 45, ty: 66, name: "Moon Lever" });
  obj({ id: "lever-2", kind: "lever", tx: 56, ty: 70, name: "Star Lever" });
  obj({ id: "rune-tablet", kind: "lore", tx: 45, ty: 76, name: "Rune Tablet" });
  obj({ id: "lore-ante", kind: "lore", tx: 41, ty: 28, name: "Keeper's Oath", text: "\"I hold the First Gate until one learns me. When the light gathers on my blade, meet it.\"" });
  obj({ id: "ascent", kind: "gate", tx: 45, ty: 13, name: "The Ascent" });

  m.spawns.push({ id: "warden", x: px(45), y: px(42), radius: 0, enemies: ["warden"], respawn: 0, elite: 0, level: 7 });
  m.spawns.push({ id: "aurelion", x: px(45), y: px(9), radius: 0, enemies: ["aurelion"], respawn: 0, elite: 0, level: 8 });
  m.spawn = { x: px(45), y: px(132) };
  return m;
}

/** Apply a gate-open bitmask to the map's tiles (server and client both call this). */
export function applyGates(m: WorldMap & { gates: GateDef[] }, openMask: number) {
  for (const g of m.gates) {
    const open = (openMask & (1 << g.id)) !== 0;
    for (const [x, y] of g.tiles) m.set(x, y, open ? Tile.StoneFloor : Tile.Gate);
  }
}
