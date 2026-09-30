import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";
import type { GateDef } from "./undercroft.ts";

export const PYRAMID_W = 84;
export const PYRAMID_H = 150;

/** Rooms of the Sun Pyramid, bottom (entrance) to top (the Sun Pharaoh). */
export const PYRAMID_ROOMS = {
  entrance: { x0: 34, y0: 136, x1: 51, y1: 147 },
  stair: { x0: 40, y0: 116, x1: 45, y1: 136 },
  kings: { x0: 22, y0: 90, x1: 63, y1: 116 },
  sun: { x0: 18, y0: 60, x1: 67, y1: 82 },
  nephra: { x0: 24, y0: 36, x1: 61, y1: 52 },
  ante: { x0: 36, y0: 27, x1: 49, y1: 33 },
  boss: { cx: 42, cy: 13, r: 13 },
};

export const PG = { kingsSouth: 0, kingsNorth: 1, sunNorth: 2, nephraSouth: 3, nephraNorth: 4, bossSouth: 5 } as const;
/** Lit altars ride in the synced gate mask from this bit up (one per altar). */
export const PG_ALTAR_BIT = 16;
/** The four dark altars (tiles) at the Sun Chamber's corners, and the Sunwell at its heart. */
export const SUN_ALTARS: [number, number][] = [[23, 64], [61, 64], [23, 78], [61, 78]];
export const SUNWELL_TILE: [number, number] = [42, 71];
/** How long the sun lasts in mortal hands once taken from the Sunwell. */
export const SUN_CARRY_MS = 10000;

const px = (t: number) => t * TILE + TILE / 2;

/**
 * The Sun Pyramid — Floor 8's boss dungeon, the tomb of the kings who stopped the sun,
 * instanced per party. Built bottom-up:
 *   entrance → the Sandfall Stair (sunbeams through the slits in rows) → the Hall of Kings (three
 *   waves) → the Sun Chamber (carry the sun from the Sunwell to each of four dark altars before
 *   it burns out in your hands, while the tomb wakes) → Nephra the Embalmer → antechamber →
 *   Solkaris, the Sun Pharaoh.
 */
export function buildPyramid(): WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] } {
  const W = PYRAMID_W;
  const H = PYRAMID_H;
  const m = new WorldMap(W, H) as WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
  m.name = "The Sun Pyramid";
  m.theme = "sand";
  m.gates = [];
  m.traps = [];
  m.fill(0, 0, W, H, Tile.Void);
  const R = PYRAMID_ROOMS;
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
  room(R.kings);
  walk(40, 82, 45, 90);
  room(R.sun);
  walk(40, 52, 45, 60);
  room(R.nephra);
  walk(40, 33, 45, 36);
  room(R.ante);

  // The Pharaoh's throne room: round, gold-inlaid, four obelisks casting the only shade.
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

  // The Sandfall Stair: a narrow way up between walls slotted for the sun.
  for (let y = R.stair.y0; y < R.stair.y1; y += 5) for (const x of [39, 45]) if (m.get(x, y) === Tile.Void) m.set(x, y, Tile.RuinWall);
  // The Hall of Kings: statues of the old kings along a gold runner.
  for (const [x, y] of [[27, 94], [56, 94], [27, 104], [56, 104], [27, 111], [56, 111]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (let y = R.kings.y0; y < R.kings.y1; y++) for (let x = 41; x <= 43; x++) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  for (let y = 93; y <= 113; y += 4) for (const x of [22, 62]) m.set(x, y, Tile.Crystal);
  // The Sun Chamber: pillars between the Sunwell and the altars, so no run is ever straight.
  for (const [x, y, w, h] of [[32, 63, 3, 4], [50, 63, 3, 4], [32, 75, 3, 4], [50, 75, 3, 4], [27, 70, 3, 2], [55, 70, 3, 2], [38, 66, 2, 2], [46, 66, 2, 2], [38, 76, 2, 2], [46, 76, 2, 2]] as const) m.fill(x, y, x + w, y + h, Tile.RuinWall);
  // Nephra's embalming hall: four open sarcophagi.
  for (const [x, y] of [[31, 40], [51, 40], [31, 47], [51, 47]]) m.fill(x, y, x + 3, y + 2, Tile.RuinWall);
  const runner = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = 41; x <= 43; x++) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  };
  runner(R.nephra.y0, R.nephra.y1);
  runner(R.ante.y0, R.ante.y1);

  gate(PG.kingsSouth, 116);
  gate(PG.kingsNorth, 90);
  gate(PG.sunNorth, 60);
  gate(PG.nephraSouth, 52);
  gate(PG.nephraNorth, 36);
  gate(PG.bossSouth, 27);

  // Sunbeams fall through the slits in rows, in a rhythm you can learn.
  for (const [row, y] of [[0, 120], [1, 125], [2, 131]] as const) for (let x = 40; x < 45; x++) m.traps.push({ x: px(x), y: px(y), row });

  m.zones.push({ id: "pyramid-inner", name: "The Sun Pyramid", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [35, 36], music: "pyramid" });
  m.zones.push({ id: "pyramid-nephra", name: "The Embalming Hall", safe: false, ...R.nephra, music: "miniboss" });
  m.zones.push({ id: "pyramid-boss", name: "The Throne of the Sun", safe: false, x0: R.boss.cx - R.boss.r, y0: 0, x1: R.boss.cx + R.boss.r, y1: 27, music: "boss" });

  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "brazier-0", kind: "campfire", tx: 42, ty: 141, name: "Entrance Brazier" });
  obj({ id: "brazier-1", kind: "campfire", tx: 42, ty: 56, name: "Brazier of the Dawn" });
  obj({ id: "brazier-2", kind: "campfire", tx: 42, ty: 30, name: "Last Brazier" });
  obj({ id: "exit", kind: "door", tx: 42, ty: 145, name: "Down to the Sands" });
  SUN_ALTARS.forEach(([tx, ty], i) => obj({ id: `altar-${i}`, kind: "lever", tx, ty, name: "Sun Altar" }));
  obj({ id: "sunwell", kind: "lever", tx: SUNWELL_TILE[0], ty: SUNWELL_TILE[1], name: "The Sunwell" });
  obj({ id: "sun-plate", kind: "lore", tx: 42, ty: 80, name: "The Priests' Warning", text: "CARRY THE SUN FROM THE WELL TO THE FOUR DARK ALTARS, ONE BY ONE. IT DOES NOT LAST IN MORTAL HANDS. THE DEAD WILL NOT LIKE THE LIGHT." });
  obj({ id: "kings-plate", kind: "lore", tx: 42, ty: 113, name: "The Hall of Kings", text: "Every king who kept the sun is buried here, standing up, facing the door. Some of them are not as buried as they should be." });
  obj({ id: "lore-ante", kind: "lore", tx: 38, ty: 29, name: "The Pharaoh's Decree", text: "Carved above the door in gold: I HAVE ENDED THE NIGHT. I HAVE ENDED FEAR. NOTHING WILL EVER HIDE FROM ME AGAIN." });
  obj({ id: "ascent", kind: "gate", tx: 42, ty: 2, dest: "floor9", name: "The Stair of Stars", text: "A stair of dark stone climbing into a patch of real night. It will not open while the Sun Pharaoh reigns." });

  m.spawns.push({ id: "warden", x: px(42), y: px(44), radius: 0, enemies: ["nephra"], respawn: 0, elite: 0, level: 35 });
  m.spawns.push({ id: "boss", x: px(42), y: px(10), radius: 0, enemies: ["solkaris"], respawn: 0, elite: 0, level: 36 });
  m.spawn = { x: px(42), y: px(142) };
  return m;
}
