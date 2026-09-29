import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";
import type { GateDef } from "./undercroft.ts";

export const CATHEDRAL_W = 84;
export const CATHEDRAL_H = 150;

/** Rooms of the Drowned Cathedral, bottom (entrance) to top (Thalassa). */
export const CATHEDRAL_ROOMS = {
  entrance: { x0: 34, y0: 136, x1: 51, y1: 147 },
  stair: { x0: 40, y0: 116, x1: 45, y1: 136 },
  nave: { x0: 22, y0: 90, x1: 63, y1: 116 },
  tide: { x0: 16, y0: 58, x1: 69, y1: 82 },
  captain: { x0: 24, y0: 36, x1: 61, y1: 52 },
  ante: { x0: 36, y0: 27, x1: 49, y1: 33 },
  boss: { cx: 42, cy: 13, r: 13 },
};

export const CG = { naveSouth: 0, naveNorth: 1, tideNorth: 2, captSouth: 3, captNorth: 4, bossSouth: 5 } as const;
/** The Rising Tide: flood rows are gates from this id up (0 = the southernmost row). */
export const CG_FLOOD_ID = 8;
export const TIDE_ROWS = 16;
/** Turned sluice valves ride in the synced gate mask from this bit up (one per valve). */
export const CG_VALVE_BIT = 24;
/** The three sluice valves (tiles): south-west (floods first), north-west, north-east. */
export const SLUICE_VALVES: [number, number][] = [[19, 77], [19, 61], [66, 62]];

const px = (t: number) => t * TILE + TILE / 2;

/**
 * The Drowned Cathedral — Floor 6's boss dungeon, a sunken temple the sea still pours into,
 * instanced per party. Built bottom-up:
 *   entrance → the Sunken Stair (the sea bursts up through it in rows) → the Nave of the
 *   Drowned (three waves) → the Rising Tide (the hall floods row by row: turn the three
 *   sluice valves before the water fills it, or the sea carries you back) → Captain
 *   Blackbrine → antechamber → Thalassa, the Leviathan Queen.
 */
export function buildCathedral(): WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] } {
  const W = CATHEDRAL_W;
  const H = CATHEDRAL_H;
  const m = new WorldMap(W, H) as WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
  m.name = "The Drowned Cathedral";
  m.theme = "tide";
  m.gates = [];
  m.traps = [];
  m.fill(0, 0, W, H, Tile.Void);
  const R = CATHEDRAL_ROOMS;
  const room = (r: { x0: number; y0: number; x1: number; y1: number }) => {
    m.fill(r.x0, r.y0, r.x1, r.y1, Tile.StoneFloor);
    for (let x = r.x0 - 1; x <= r.x1; x++) {
      if (m.get(x, r.y0 - 1) === Tile.Void) m.set(x, r.y0 - 1, Tile.RuinWall);
      if (m.get(x, r.y1) === Tile.Void) m.set(x, r.y1, Tile.RuinWall);
    }
    for (let y = r.y0 - 1; y <= r.y1; y++) {
      if (m.get(r.x0 - 1, y) === Tile.Void) m.set(r.x0 - 1, y, Tile.RuinWall);
      if (m.get(r.x1, y) === Tile.Void) m.set(r.x1, y, Tile.RuinWall);
    }
  };
  const walk = (x0: number, y0: number, x1: number, y1: number) => m.fill(x0, y0, x1, y1, Tile.StoneFloor);
  const gate = (id: number, y: number, x0 = 40, x1 = 45) => {
    const tiles: [number, number][] = [];
    for (let x = x0; x < x1; x++) tiles.push([x, y]);
    m.gates.push({ id, tiles });
  };

  room(R.entrance);
  walk(R.stair.x0, R.stair.y0, R.stair.x1, R.stair.y1);
  room(R.nave);
  walk(40, 82, 45, 90);
  room(R.tide);
  walk(40, 52, 45, 58);
  room(R.captain);
  walk(40, 33, 45, 36);
  room(R.ante);

  // Thalassa's throne: a round hall open to the sea, a ring of coral around it.
  for (let y = 0; y < 27; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (d < R.boss.r) m.set(x, y, Tile.StoneFloor);
      else if (d < R.boss.r + 1.2 && m.get(x, y) === Tile.Void) m.set(x, y, Tile.RuinWall);
    }
  }
  walk(40, 24, 45, 27);
  for (let y = 0; y < 27; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (m.get(x, y) === Tile.StoneFloor && d > 8.4 && d < 9.3) m.set(x, y, Tile.Cobble);
    }
  }
  for (const [dx, dy] of [[-9, -4], [8, -4], [-9, 4], [8, 4]]) m.fill(R.boss.cx + dx, R.boss.cy + dy, R.boss.cx + dx + 2, R.boss.cy + dy + 2, Tile.Crystal);

  // The Sunken Stair: broken pillars along a causeway over the sea.
  for (let y = R.stair.y0; y < R.stair.y1; y += 5) for (const x of [39, 45]) if (m.get(x, y) === Tile.Void) m.set(x, y, Tile.RuinWall);
  // The Nave: rows of drowned pews (pillars) and two flooded pits.
  for (const [x, y] of [[28, 96], [55, 96], [28, 108], [55, 108]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (const [x, y] of [[33, 101], [49, 101]]) m.fill(x, y, x + 3, y + 2, Tile.Water);
  for (let y = 93; y <= 113; y += 4) for (const x of [22, 62]) m.set(x, y, Tile.Crystal);
  // The Rising Tide: side chapels for the valves, pillars down the middle.
  for (const [x, y] of [[30, 66], [53, 66], [30, 74], [53, 74]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  // Blackbrine's hall: a ship's deck of planks between great pillars.
  m.fill(R.captain.x0, R.captain.y0, R.captain.x1, R.captain.y1, Tile.Floorboards);
  for (const [x, y] of [[31, 40], [51, 40], [31, 47], [51, 47]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  // A pale runner leads through every hall toward the throne.
  const runner = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = 41; x <= 43; x++) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  };
  runner(R.nave.y0, R.nave.y1);
  runner(R.ante.y0, R.ante.y1);

  gate(CG.naveSouth, 116);
  gate(CG.naveNorth, 90);
  gate(CG.tideNorth, 58);
  gate(CG.captSouth, 52);
  gate(CG.captNorth, 36);
  gate(CG.bossSouth, 27);
  // The flood rows, south to north: open, they are floor; closed, they are sea.
  for (let k = 0; k < TIDE_ROWS; k++) {
    const y = R.tide.y1 - 1 - k;
    const tiles: [number, number][] = [];
    for (let x = R.tide.x0; x < R.tide.x1; x++) {
      const t = m.get(x, y);
      if (t === Tile.StoneFloor || t === Tile.Cobble) {
        m.set(x, y, Tile.StoneFloor);
        tiles.push([x, y]);
      }
    }
    m.gates.push({ id: CG_FLOOD_ID + k, tiles, closedTile: Tile.Water, openTile: Tile.StoneFloor });
  }

  // The sea bursts up through the Stair in rows, in a rhythm you can learn.
  for (const [row, y] of [[0, 120], [1, 125], [2, 131]] as const) for (let x = 40; x < 45; x++) m.traps.push({ x: px(x), y: px(y), row });

  m.zones.push({ id: "cathedral-inner", name: "The Drowned Cathedral", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [27, 28], music: "cathedral" });
  m.zones.push({ id: "cathedral-captain", name: "The Captain's Deck", safe: false, ...R.captain, music: "miniboss" });
  m.zones.push({ id: "cathedral-boss", name: "The Leviathan's Throne", safe: false, x0: R.boss.cx - R.boss.r, y0: 0, x1: R.boss.cx + R.boss.r, y1: 27, music: "boss" });

  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "brazier-0", kind: "campfire", tx: 42, ty: 141, name: "Entrance Brazier" });
  obj({ id: "brazier-1", kind: "campfire", tx: 42, ty: 55, name: "Dry Brazier" });
  obj({ id: "brazier-2", kind: "campfire", tx: 42, ty: 30, name: "Last Brazier" });
  obj({ id: "exit", kind: "door", tx: 42, ty: 145, name: "Down to the Cliffs" });
  SLUICE_VALVES.forEach(([tx, ty], i) => obj({ id: `valve-${i}`, kind: "lever", tx, ty, name: "Sluice Valve" }));
  obj({ id: "tide-tablet", kind: "lore", tx: 42, ty: 79, name: "The Tide Tablet", text: "Carved above the drain: WHEN THE BELL TOLLS, THE SEA COMES IN. THREE VALVES HOLD IT BACK. THE LOWEST DROWNS FIRST." });
  obj({ id: "nave-tablet", kind: "lore", tx: 42, ty: 113, name: "The Drowned Pews", text: "Rows of pews, and in them the congregation, still waiting for the sermon. As you step in, they stand up." });
  obj({ id: "lore-ante", kind: "lore", tx: 38, ty: 29, name: "The Queen's Psalm", text: "\"You climbed out of the sea once. Everything does, eventually. Everything comes back.\"" });
  obj({ id: "ascent", kind: "gate", tx: 42, ty: 2, dest: "floor7", name: "The Stair of Tides", text: "A stair of wet stone spirals up into spray. It will not open while the Leviathan Queen holds her throne." });

  m.spawns.push({ id: "warden", x: px(42), y: px(44), radius: 0, enemies: ["blackbrine"], respawn: 0, elite: 0, level: 27 });
  m.spawns.push({ id: "boss", x: px(42), y: px(10), radius: 0, enemies: ["thalassa"], respawn: 0, elite: 0, level: 28 });
  m.spawn = { x: px(42), y: px(142) };
  return m;
}
