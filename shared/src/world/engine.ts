import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";
import type { GateDef } from "./undercroft.ts";

export const ENGINE_W = 84;
export const ENGINE_H = 150;

/** Rooms of the Great Engine, bottom (entrance) to top (the Archon). */
export const ENGINE_ROOMS = {
  entrance: { x0: 34, y0: 136, x1: 51, y1: 147 },
  pistons: { x0: 40, y0: 116, x1: 45, y1: 136 },
  line: { x0: 22, y0: 90, x1: 63, y1: 116 },
  overload: { x0: 18, y0: 60, x1: 67, y1: 82 },
  vulk: { x0: 24, y0: 36, x1: 61, y1: 52 },
  ante: { x0: 36, y0: 27, x1: 49, y1: 33 },
  boss: { cx: 42, cy: 13, r: 13 },
};

export const EG = { lineSouth: 0, lineNorth: 1, overNorth: 2, vulkSouth: 3, vulkNorth: 4, bossSouth: 5 } as const;
/** Live breakers ride in the synced gate mask from this bit up (one per breaker). */
export const EG_BREAKER_BIT = 16;
/** The four breakers (tiles), and how long each stays live once thrown. */
export const BREAKERS: [number, number][] = [[28, 64], [56, 64], [28, 78], [56, 78]];
export const BREAKER_LIVE_MS = 14000;

const px = (t: number) => t * TILE + TILE / 2;

/**
 * The Great Engine — Floor 7's boss dungeon, the machine inside the tower, instanced per
 * party. Built bottom-up:
 *   entrance → the Piston Walk (steam bursts in rows) → the Assembly Line (three waves) → the
 *   Overload Room (throw all four breakers so they are live at once — each stays live only a
 *   few seconds — while the sentries fire) → Forgemaster Vulk → antechamber → the Archon Engine.
 */
export function buildEngine(): WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] } {
  const W = ENGINE_W;
  const H = ENGINE_H;
  const m = new WorldMap(W, H) as WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
  m.name = "The Great Engine";
  m.theme = "brass";
  m.gates = [];
  m.traps = [];
  m.fill(0, 0, W, H, Tile.Void);
  const R = ENGINE_ROOMS;
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
  walk(R.pistons.x0, R.pistons.y0, R.pistons.x1, R.pistons.y1);
  room(R.line);
  walk(40, 82, 45, 90);
  room(R.overload);
  walk(40, 52, 45, 60);
  room(R.vulk);
  walk(40, 33, 45, 36);
  room(R.ante);

  // The Archon's chamber: a round engine room, its great gears set into the floor.
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
      if (m.get(x, y) === Tile.StoneFloor && ((d > 9 && d < 9.9) || (d > 4.2 && d < 5))) m.set(x, y, Tile.Cobble);
    }
  }
  for (const [dx, dy] of [[-9, -4], [8, -4], [-9, 4], [8, 4]]) m.fill(R.boss.cx + dx, R.boss.cy + dy, R.boss.cx + dx + 2, R.boss.cy + dy + 2, Tile.Crystal);

  // The Piston Walk: a gantry over the drop, pistons on either side.
  for (let y = R.pistons.y0; y < R.pistons.y1; y += 5) for (const x of [39, 45]) if (m.get(x, y) === Tile.Void) m.set(x, y, Tile.RuinWall);
  // The Assembly Line: two conveyor lanes (cobble) between machines.
  for (const [x, y] of [[28, 96], [55, 96], [28, 108], [55, 108]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (let x = R.line.x0; x < R.line.x1; x++) for (const y of [100, 106]) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  for (let y = 93; y <= 113; y += 4) for (const x of [22, 62]) m.set(x, y, Tile.Crystal);
  // The Overload Room: machinery blocks between the breakers, so the run is never straight.
  for (const [x, y, w, h] of [[36, 63, 3, 4], [46, 63, 3, 4], [36, 75, 3, 4], [46, 75, 3, 4], [24, 70, 4, 2], [57, 70, 4, 2], [41, 69, 3, 3]] as const) m.fill(x, y, x + w, y + h, Tile.RuinWall);
  // Vulk's forge: great anvils.
  for (const [x, y] of [[31, 40], [51, 40], [31, 47], [51, 47]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  const runner = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = 41; x <= 43; x++) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  };
  runner(R.vulk.y0, R.vulk.y1);
  runner(R.ante.y0, R.ante.y1);

  gate(EG.lineSouth, 116);
  gate(EG.lineNorth, 90);
  gate(EG.overNorth, 60);
  gate(EG.vulkSouth, 52);
  gate(EG.vulkNorth, 36);
  gate(EG.bossSouth, 27);

  // Steam bursts from the pistons in rows, in a rhythm you can learn.
  for (const [row, y] of [[0, 120], [1, 125], [2, 131]] as const) for (let x = 40; x < 45; x++) m.traps.push({ x: px(x), y: px(y), row });

  m.zones.push({ id: "engine-inner", name: "The Great Engine", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [31, 32], music: "engine" });
  m.zones.push({ id: "engine-vulk", name: "Vulk's Forge", safe: false, ...R.vulk, music: "miniboss" });
  m.zones.push({ id: "engine-boss", name: "The Heart of the Engine", safe: false, x0: R.boss.cx - R.boss.r, y0: 0, x1: R.boss.cx + R.boss.r, y1: 27, music: "boss" });

  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "brazier-0", kind: "campfire", tx: 42, ty: 141, name: "Entrance Furnace" });
  obj({ id: "brazier-1", kind: "campfire", tx: 42, ty: 56, name: "Pilot Light" });
  obj({ id: "brazier-2", kind: "campfire", tx: 42, ty: 30, name: "Last Furnace" });
  obj({ id: "exit", kind: "door", tx: 42, ty: 145, name: "Down to the Rails" });
  BREAKERS.forEach(([tx, ty], i) => obj({ id: `breaker-${i}`, kind: "lever", tx, ty, name: "Breaker" }));
  obj({ id: "overload-plate", kind: "lore", tx: 42, ty: 80, name: "The Warning Plate", text: "DANGER. ALL FOUR BREAKERS MUST BE LIVE TOGETHER TO RELEASE THE SEAL. EACH HOLDS FOR FOURTEEN SECONDS. RUN." });
  obj({ id: "line-plate", kind: "lore", tx: 42, ty: 113, name: "The Assembly Line", text: "Soldiers of brass come off the line in rows, fully wound. The line has been running, unattended, for a century." });
  obj({ id: "lore-ante", kind: "lore", tx: 38, ty: 29, name: "The Archon's Question", text: "Carved into the door, over and over: WHAT IS THE TOWER FOR? WHAT IS THE TOWER FOR? WHAT IS THE TOWER FOR?" });
  obj({ id: "ascent", kind: "gate", tx: 42, ty: 2, dest: "floor8", name: "The Endless Stair", text: "A stair of brass that builds itself one step ahead. It will not open while the Archon Engine runs." });

  m.spawns.push({ id: "warden", x: px(42), y: px(44), radius: 0, enemies: ["vulk"], respawn: 0, elite: 0, level: 31 });
  m.spawns.push({ id: "boss", x: px(42), y: px(10), radius: 0, enemies: ["archon"], respawn: 0, elite: 0, level: 32 });
  m.spawn = { x: px(42), y: px(142) };
  return m;
}
