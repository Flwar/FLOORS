import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";
import type { GateDef } from "./undercroft.ts";

export const SANCTUM_W = 84;
export const SANCTUM_H = 150;

/** Rooms of the Abyssal Sanctum, bottom (entrance) to top (Nyxara). */
export const SANCTUM_ROOMS = {
  entrance: { x0: 34, y0: 136, x1: 51, y1: 147 },
  walk: { x0: 40, y0: 116, x1: 45, y1: 136 },
  court: { x0: 22, y0: 90, x1: 63, y1: 116 },
  moons: { x0: 20, y0: 62, x1: 65, y1: 80 },
  maelgrim: { x0: 24, y0: 38, x1: 61, y1: 54 },
  ante: { x0: 36, y0: 29, x1: 49, y1: 35 },
  boss: { cx: 42, cy: 14, r: 14 },
};

export const SG = { courtSouth: 0, courtNorth: 1, moonsNorth: 2, maelSouth: 3, maelNorth: 4, bossSouth: 5 } as const;
/** Each moon lantern's phase (0–3) rides in the synced gate mask, two bits per lantern from this bit up. */
export const SG_MOON_BIT = 16;
export const MOON_PHASES = ["New Moon", "Crescent", "Half Moon", "Full Moon"];
/** Where the four moon lanterns stand (tiles), west to east. */
export const MOON_LANTERNS: [number, number][] = [[27, 66], [36, 69], [48, 69], [57, 66]];

const px = (t: number) => t * TILE + TILE / 2;

/**
 * The Abyssal Sanctum — Floor 5's boss dungeon, a temple of black stone built inside the
 * night itself, instanced per party. Built bottom-up:
 *   entrance → the Starless Walk (void rifts open in rows) → the Hollow Court (three waves
 *   of the Queen's court) → the Hall of Moons (turn the four lanterns to the phases the Moon
 *   Dial shows; the dark sends shades while you think) → Maelgrim, the Hollow Knight →
 *   antechamber → Nyxara, Queen of the Void, on the Eclipse Throne.
 */
export function buildSanctum(): WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] } {
  const W = SANCTUM_W;
  const H = SANCTUM_H;
  const m = new WorldMap(W, H) as WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
  m.name = "The Abyssal Sanctum";
  m.theme = "shadow";
  m.gates = [];
  m.traps = [];
  m.fill(0, 0, W, H, Tile.Void);
  const R = SANCTUM_ROOMS;
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
  walk(R.walk.x0, R.walk.y0, R.walk.x1, R.walk.y1);
  room(R.court);
  walk(40, 80, 45, 90);
  room(R.moons);
  walk(40, 54, 45, 62);
  room(R.maelgrim);
  walk(40, 35, 45, 38);
  room(R.ante);

  // The Eclipse Throne: a round hall open to the starless sky, a ring of moon-shards around it.
  for (let y = 0; y < 29; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (d < R.boss.r) m.set(x, y, Tile.StoneFloor);
      else if (d < R.boss.r + 1.2 && m.get(x, y) === Tile.Void) m.set(x, y, Tile.RuinWall);
    }
  }
  walk(40, 26, 45, 29);
  for (let y = 0; y < 29; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (m.get(x, y) === Tile.StoneFloor && ((d > 9.4 && d < 10.3) || (d > 4 && d < 4.8))) m.set(x, y, Tile.Cobble);
    }
  }
  for (const [dx, dy] of [[-10, -3], [9, -3], [-10, 3], [9, 3], [-1, -11]]) m.fill(R.boss.cx + dx, R.boss.cy + dy, R.boss.cx + dx + 2, R.boss.cy + dy + 2, Tile.Crystal);

  // The Starless Walk: a narrow causeway with nothing either side.
  for (let y = R.walk.y0; y < R.walk.y1; y += 5) for (const x of [39, 45]) if (m.get(x, y) === Tile.Void) m.set(x, y, Tile.RuinWall);
  // The Hollow Court: black pillars, and two pits into the dark.
  for (const [x, y] of [[28, 96], [55, 96], [28, 108], [55, 108]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (const [x, y] of [[33, 101], [49, 101]]) m.fill(x, y, x + 3, y + 2, Tile.Void);
  for (let y = 93; y <= 113; y += 4) for (const x of [22, 62]) m.set(x, y, Tile.Crystal);
  // The Hall of Moons: moon-shard pillars at the corners, the Moon Dial in the middle.
  for (const [x, y] of [[21, 63], [64, 63], [21, 79], [64, 79]]) m.set(x, y, Tile.Crystal);
  m.fill(41, 72, 44, 75, Tile.Cobble);
  // Maelgrim's hall: great black pillars.
  for (const [x, y] of [[31, 42], [51, 42], [31, 49], [51, 49]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  // A pale runner leads through every hall toward the throne.
  const runner = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = 41; x <= 43; x++) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  };
  runner(R.court.y0, R.court.y1);
  runner(R.maelgrim.y0, R.maelgrim.y1);
  runner(R.ante.y0, R.ante.y1);

  gate(SG.courtSouth, 116);
  gate(SG.courtNorth, 90);
  gate(SG.moonsNorth, 62);
  gate(SG.maelSouth, 54);
  gate(SG.maelNorth, 38);
  gate(SG.bossSouth, 29);

  // Void rifts tear open across the Walk in rows, in a rhythm you can learn.
  for (const [row, y] of [[0, 120], [1, 125], [2, 131]] as const) for (let x = 40; x < 45; x++) m.traps.push({ x: px(x), y: px(y), row });

  m.zones.push({ id: "sanctum-inner", name: "The Abyssal Sanctum", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [23, 24], music: "sanctum", dark: 0.45 });
  m.zones.push({ id: "sanctum-maelgrim", name: "Hall of the Hollow Knight", safe: false, ...R.maelgrim, music: "miniboss", dark: 0.4 });
  m.zones.push({ id: "sanctum-boss", name: "The Eclipse Throne", safe: false, x0: R.boss.cx - R.boss.r, y0: 0, x1: R.boss.cx + R.boss.r, y1: 29, music: "boss", dark: 0.3 });

  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "brazier-0", kind: "campfire", tx: 42, ty: 141, name: "Entrance Lantern" });
  obj({ id: "brazier-1", kind: "campfire", tx: 42, ty: 58, name: "Moonlit Lantern" });
  obj({ id: "brazier-2", kind: "campfire", tx: 42, ty: 32, name: "Last Lantern" });
  obj({ id: "exit", kind: "door", tx: 42, ty: 145, name: "Down to the Spires" });
  MOON_LANTERNS.forEach(([tx, ty], i) => obj({ id: `lantern-${i}`, kind: "lever", tx, ty, name: "Moon Lantern" }));
  obj({ id: "moon-dial", kind: "lore", tx: 42, ty: 76, name: "The Moon Dial", text: "A dial of black stone, its face worn smooth." });
  obj({ id: "court-tablet", kind: "lore", tx: 42, ty: 113, name: "The Hollow Court", text: "Empty thrones in rows, facing the door. As you step in, one by one, they are not empty any more." });
  obj({ id: "lore-ante", kind: "lore", tx: 38, ty: 31, name: "The Queen's Lament", text: "\"They climbed toward the light as if it were owed to them. I only took back what was always mine: the dark before it.\"" });
  obj({ id: "ascent", kind: "gate", tx: 42, ty: 2, dest: "floor6", name: "The Starless Stair", text: "A stair of black glass rises into nothing. It will not open while the Queen sits her throne." });

  m.spawns.push({ id: "warden", x: px(42), y: px(44), radius: 0, enemies: ["maelgrim"], respawn: 0, elite: 0, level: 23 });
  m.spawns.push({ id: "boss", x: px(42), y: px(10), radius: 0, enemies: ["nyxara"], respawn: 0, elite: 0, level: 24 });
  m.spawn = { x: px(42), y: px(142) };
  return m;
}
