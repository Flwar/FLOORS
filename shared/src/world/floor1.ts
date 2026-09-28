import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";
import { addInteriors } from "./interiors.ts";

/** Deterministic PRNG so the server and every client build the identical map. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0,1]. */
function noise(x: number, y: number, scale: number, seed: number) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * s(tx) + (c - a) * s(ty) + (a - b - c + d) * s(tx) * s(ty);
}

export const FLOOR1_W = 200;
export const FLOOR1_H = 150;

export const TOWN = { x0: 18, y0: 60, x1: 58, y1: 96 };

const px = (t: number) => t * TILE + TILE / 2;

/**
 * Floor 1 — "The Verdant Floor". A floating island: the town of Emberwatch, the Green
 * Fields, Whisperwood, the Sunken Ruins and the Hollow Caves, with alternate routes,
 * secrets and the sealed Undercroft that leads to the Floor Boss.
 */
export function buildFloor1(): WorldMap {
  const W = FLOOR1_W;
  const H = FLOOR1_H;
  const m = new WorldMap(W, H);
  m.name = "Floor 1 — The Verdant Floor";
  const rnd = mulberry32(0xf1007);
  const protect = new Uint8Array(W * H); // roads, plazas: never overwritten by scatter
  const P = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? protect[y * W + x] : 1);
  const setP = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) protect[y * W + x] = 1;
  };

  // --- Island shape: everything past a noisy rim falls away into the sky. ---------
  m.fill(0, 0, W, H, Tile.Grass);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const n = noise(x, y, 9, 11) * 5 + noise(x, y, 3, 12) * 2;
      if (edge < 2 + n) m.set(x, y, Tile.Void);
    }
  }
  // Cliff lip where land meets the void.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (m.get(x, y) === Tile.Void) continue;
      if (m.get(x, y + 1) === Tile.Void || m.get(x + 1, y) === Tile.Void || m.get(x - 1, y) === Tile.Void || m.get(x, y - 1) === Tile.Void) m.set(x, y, Tile.Cliff);
    }
  }

  // --- Regions -------------------------------------------------------------------
  const inRect = (x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number }) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
  const FOREST = { x0: 6, y0: 4, x1: 132, y1: 52 };
  const RUINS = { x0: 126, y0: 26, x1: 196, y1: 104 };
  const CAVES = { x0: 60, y0: 110, x1: 194, y1: 146 };
  const land = (x: number, y: number) => m.get(x, y) !== Tile.Void && m.get(x, y) !== Tile.Cliff;

  // Ruins: sandy ground with worn stone floor patches.
  for (let y = RUINS.y0; y < RUINS.y1; y++) {
    for (let x = RUINS.x0; x < RUINS.x1; x++) {
      if (!land(x, y)) continue;
      const edge = Math.min(x - RUINS.x0, y - RUINS.y0, RUINS.y1 - y) + noise(x, y, 6, 21) * 6;
      if (edge < 3) continue;
      m.set(x, y, noise(x, y, 7, 22) > 0.55 ? Tile.StoneFloor : Tile.Sand);
    }
  }

  // Caves: solid rock carved by cellular automata into tunnels and chambers.
  const caveMask = (x: number, y: number) => inRect(x, y, CAVES) && land(x, y) && y - CAVES.y0 + noise(x, y, 5, 31) * 5 > 2;
  let cave = new Uint8Array(W * H);
  for (let y = CAVES.y0; y < CAVES.y1; y++) for (let x = CAVES.x0; x < CAVES.x1; x++) if (caveMask(x, y)) cave[y * W + x] = rnd() < 0.47 ? 1 : 0;
  for (let it = 0; it < 5; it++) {
    const next = new Uint8Array(W * H);
    for (let y = CAVES.y0; y < CAVES.y1; y++) {
      for (let x = CAVES.x0; x < CAVES.x1; x++) {
        if (!caveMask(x, y)) continue;
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!caveMask(x + dx, y + dy) || cave[(y + dy) * W + x + dx]) walls++;
        next[y * W + x] = walls >= 5 ? 1 : 0;
      }
    }
    cave = next;
  }
  for (let y = CAVES.y0; y < CAVES.y1; y++) {
    for (let x = CAVES.x0; x < CAVES.x1; x++) {
      if (!caveMask(x, y)) continue;
      m.set(x, y, cave[y * W + x] ? Tile.Rock : Tile.CaveFloor);
    }
  }
  const carveCircle = (cx: number, cy: number, r: number, id: number) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && land(x, y)) m.set(x, y, id);
  };

  // --- Roads (carved and protected) ------------------------------------------------
  const road = (pts: [number, number][], width: number, id: number = Tile.Path) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const wob = (noise(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 8, 41) - 0.5) * 3;
        const cx = x0 + (x1 - x0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? wob : 0);
        const cy = y0 + (y1 - y0) * t + (Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? wob : 0);
        for (let dy = -width; dy <= width; dy++) {
          for (let dx = -width; dx <= width; dx++) {
            if (dx * dx + dy * dy > width * width + 0.5) continue;
            const x = Math.round(cx + dx);
            const y = Math.round(cy + dy);
            if (!land(x, y)) continue;
            const cur = m.get(x, y);
            m.set(x, y, cur === Tile.CaveFloor || cur === Tile.Rock ? Tile.CaveFloor : cur === Tile.Sand || cur === Tile.StoneFloor ? Tile.Sand : id);
            setP(x, y);
          }
        }
      }
    }
  };

  // --- Emberwatch ------------------------------------------------------------------
  const T = TOWN;
  m.fill(T.x0, T.y0, T.x1, T.y1, Tile.Cobble);
  for (let x = T.x0; x < T.x1; x++) {
    m.set(x, T.y0, Tile.Wall);
    m.set(x, T.y1 - 1, Tile.Wall);
  }
  for (let y = T.y0; y < T.y1; y++) {
    m.set(T.x0, y, Tile.Wall);
    m.set(T.x1 - 1, y, Tile.Wall);
  }
  for (let y = T.y0; y < T.y1; y++) for (let x = T.x0; x < T.x1; x++) setP(x, y);
  // Gates.
  m.fill(T.x1 - 1, 76, T.x1, 81, Tile.Path); // east
  m.fill(36, T.y0, 41, T.y0 + 1, Tile.Path); // north
  m.fill(36, T.y1 - 1, 41, T.y1, Tile.Path); // south
  // Gardens and the training yard.
  m.fill(T.x0 + 1, T.y0 + 1, T.x0 + 8, T.y0 + 12, Tile.Grass);
  m.fill(T.x0 + 2, T.y0 + 2, T.x0 + 7, T.y0 + 4, Tile.Flowers);
  m.fill(T.x1 - 9, T.y1 - 10, T.x1 - 1, T.y1 - 1, Tile.Grass);
  m.fill(T.x1 - 8, T.y1 - 4, T.x1 - 2, T.y1 - 2, Tile.Flowers);
  m.fill(20, 74, 30, 84, Tile.Path); // yard
  for (let x = 20; x < 30; x++) {
    m.set(x, 73, Tile.Fence);
    m.set(x, 84, Tile.Fence);
  }
  m.set(25, 73, Tile.Path);
  m.set(26, 73, Tile.Path);
  m.set(25, 84, Tile.Path);
  m.set(26, 84, Tile.Path);
  for (let y = 73; y <= 84; y++) m.set(30, y, y === 78 || y === 79 ? Tile.Path : Tile.Fence);

  const house = (id: string, name: string, tx: number, ty: number, tw: number, th: number) => {
    m.fill(tx, ty, tx + tw, ty + th, Tile.House);
    m.buildings.push({ id, name, tx, ty, tw, th });
  };
  house("smith", "Blacksmith", 21, 63, 6, 4);
  house("guild", "Adventurers' Guild", 30, 62, 9, 4);
  house("store", "General Store", 45, 63, 6, 4);
  house("inn", "The Hanging Lantern", 21, 87, 7, 5);
  house("storage", "Storage", 47, 86, 5, 4);
  house("scholar", "Scholar's House", 51, 69, 5, 3);
  // Plaza fountain.
  m.fill(37, 79, 39, 81, Tile.Water);

  // Town life: market stalls, the smith's yard, benches and lamps around the plaza.
  m.prop("stall", 51, 66, 2, 1, 0);
  m.prop("stall", 54, 66, 2, 1, 1);
  m.prop("crates", 53, 64);
  m.prop("barrel", 56, 64);
  m.prop("anvil", 22, 68);
  m.prop("barrel", 27, 63);
  m.prop("barrel", 27, 64, 1, 1, 1);
  m.prop("crates", 28, 63, 1, 1, 1);
  m.prop("logs", 19, 68, 2, 1);
  m.prop("planter", 31, 66);
  m.prop("planter", 37, 66);
  m.prop("board", 41, 66);
  m.prop("bench", 35, 83, 2, 1);
  m.prop("bench", 40, 76, 2, 1, 1);
  m.prop("lamp", 33, 75);
  m.prop("lamp", 49, 76);
  m.prop("lamp", 33, 86);
  m.prop("lamp", 45, 88);
  m.prop("barrel", 28, 88);
  m.prop("barrel", 28, 89, 1, 1, 1);
  m.prop("sacks", 29, 89);
  m.prop("bench", 29, 92, 2, 1);
  m.prop("rack", 29, 75);
  m.prop("hay", 29, 82);
  m.prop("hay", 20, 83, 1, 1, 1);
  m.prop("cart", 54, 84, 2, 1);
  m.prop("crates", 33, 93);
  m.prop("crates", 43, 93, 1, 1, 1);
  m.prop("sacks", 44, 93);
  m.prop("well", 50, 80, 2, 2);

  m.zones.push({ id: "green-fields", name: "Green Fields", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [1, 3], music: "fields" });

  // Roads out of town.
  road([[57, 78], [70, 77], [86, 74], [104, 70], [118, 66], [128, 64], [140, 64]], 1); // east to ruins
  road([[38, 60], [38, 50], [42, 40], [50, 30], [62, 24], [80, 20], [96, 18], [106, 20]], 1); // north into forest → bandit camp
  road([[42, 40], [32, 30], [26, 22]], 1); // branch to the wolf den
  road([[38, 95], [40, 104], [52, 110], [66, 116], [74, 120]], 1); // south to caves
  road([[118, 36], [124, 40], [132, 44], [142, 48]], 1); // forest ↔ ruins shortcut
  road([[104, 70], [108, 60], [114, 50], [118, 36]], 1); // fields → forest edge
  // Cave tunnels: main passage and the long alternate route up into the ruins.
  road([[74, 120], [86, 124], [100, 128], [116, 126], [132, 130], [148, 128], [162, 122], [166, 112], [164, 100]], 1, Tile.CaveFloor);
  road([[100, 128], [104, 138], [118, 140], [140, 140], [160, 138], [176, 134], [184, 126]], 1, Tile.CaveFloor);
  for (const [cx, cy, r] of [[86, 124, 4], [116, 126, 5], [148, 128, 5], [176, 134, 5], [184, 126, 4], [132, 140, 3]] as const) carveCircle(cx, cy, r, Tile.CaveFloor);
  // Crystals line the deep caves.
  for (let y = CAVES.y0; y < CAVES.y1; y++) {
    for (let x = CAVES.x0; x < CAVES.x1; x++) {
      if (m.get(x, y) !== Tile.Rock) continue;
      const nextToFloor = m.get(x, y + 1) === Tile.CaveFloor || m.get(x + 1, y) === Tile.CaveFloor || m.get(x - 1, y) === Tile.CaveFloor;
      if (nextToFloor && hash2(x, y, 51) < 0.07 && x > 110) m.set(x, y, Tile.Crystal);
    }
  }

  // --- Whisperwood: dense forest with clearings. ---------------------------------------
  const clearings: [number, number, number][] = [[26, 22, 6], [62, 24, 5], [84, 36, 5], [112, 22, 11], [18, 12, 4], [48, 12, 4], [96, 44, 4]];
  for (let y = FOREST.y0; y < FOREST.y1; y++) {
    for (let x = FOREST.x0; x < FOREST.x1; x++) {
      if (!land(x, y) || P(x, y) || m.get(x, y) !== Tile.Grass) continue;
      const edge = Math.min(y - FOREST.y0, FOREST.y1 - y, x - FOREST.x0, FOREST.x1 - x) + noise(x, y, 5, 61) * 6;
      if (edge < 2) continue;
      let open = false;
      for (const [cx, cy, r] of clearings) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) open = true;
      if (open) {
        if (hash2(x, y, 62) < 0.12) m.set(x, y, Tile.TallGrass);
        continue;
      }
      const density = 0.52 + noise(x, y, 6, 63) * 0.4;
      if (hash2(x, y, 64) < density) m.set(x, y, Tile.Tree);
      else if (hash2(x, y, 65) < 0.3) m.set(x, y, Tile.TallGrass);
    }
  }
  // Bandit camp palisade (north-east clearing), open to the south-west road.
  const camp = { cx: 112, cy: 22, r: 11 };
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = Math.round(camp.cx + Math.cos(a) * camp.r);
    const y = Math.round(camp.cy + Math.sin(a) * camp.r * 0.85);
    const gap = a > 3.3 && a < 3.85; // the main gate, where the forest road arrives from the west
    const gap2 = a > 1.2 && a < 1.45; // a narrow back way south, toward the ruins shortcut
    if (!gap && !gap2 && land(x, y)) m.set(x, y, Tile.Palisade);
  }
  // The back way: a trail from the south gap down to the forest-ruins shortcut.
  road([[114, 29], [115, 33], [118, 36]], 0);
  // The Forgotten Shrine: a secret clearing reachable through a single gap in the trees.
  road([[26, 22], [22, 17], [18, 12]], 0);
  m.fill(16, 10, 21, 15, Tile.StoneFloor);

  // --- Green Fields: farms, a pond, scattered trees. -----------------------------------
  const pond = { cx: 92, cy: 96, rx: 7, ry: 4 };
  for (let y = pond.cy - pond.ry; y <= pond.cy + pond.ry; y++)
    for (let x = pond.cx - pond.rx; x <= pond.cx + pond.rx; x++)
      if (((x - pond.cx) / pond.rx) ** 2 + ((y - pond.cy) / pond.ry) ** 2 <= 1 + (noise(x, y, 2, 71) - 0.5) * 0.4) m.set(x, y, Tile.Water);
  // Farm plots with fences just east of the town gate.
  for (const [fx, fy, fw, fh] of [[62, 84, 10, 7], [76, 86, 9, 8], [64, 66, 8, 6]] as const) {
    for (let x = fx; x <= fx + fw; x++) {
      if (!P(x, fy)) m.set(x, fy, Tile.Fence);
      if (!P(x, fy + fh)) m.set(x, fy + fh, Tile.Fence);
    }
    for (let y = fy; y <= fy + fh; y++) {
      if (!P(fx, y)) m.set(fx, y, Tile.Fence);
      if (!P(fx + fw, y) && y !== fy + Math.floor(fh / 2)) m.set(fx + fw, y, Tile.Fence);
    }
    for (let y = fy + 1; y < fy + fh; y++) for (let x = fx + 1; x < fx + fw; x++) m.set(x, y, Tile.Crop);
  }
  for (let y = 50; y < 110; y++) {
    for (let x = 58; x < 124; x++) {
      if (!land(x, y) || P(x, y) || m.get(x, y) !== Tile.Grass) continue;
      const r = hash2(x, y, 72);
      if (r < 0.05) m.set(x, y, Tile.TallGrass);
      else if (r < 0.075) m.set(x, y, Tile.Flowers);
      else if (r < 0.1 && noise(x, y, 7, 73) > 0.62) m.set(x, y, Tile.Tree);
    }
  }
  // Around the town walls too.
  for (let y = 50; y < 110; y++) {
    for (let x = 6; x < 60; x++) {
      if (!land(x, y) || P(x, y) || m.get(x, y) !== Tile.Grass || inRect(x, y, { x0: T.x0 - 2, y0: T.y0 - 2, x1: T.x1 + 2, y1: T.y1 + 2 })) continue;
      const r = hash2(x, y, 74);
      if (r < 0.06) m.set(x, y, Tile.TallGrass);
      else if (r < 0.14 && noise(x, y, 6, 75) > 0.55) m.set(x, y, Tile.Tree);
    }
  }
  // Fox Hollow: a hidden grove in the south-east fields behind a tree line.
  for (let y = 100; y < 110; y++) for (let x = 108; x < 122; x++) if (land(x, y) && !P(x, y)) m.set(x, y, Tile.Tree);
  for (let y = 102; y < 108; y++) for (let x = 111; x < 119; x++) if (land(x, y)) m.set(x, y, Tile.Flowers);
  m.set(110, 105, Tile.Grass);
  m.set(109, 105, Tile.Grass);
  m.set(108, 105, Tile.Grass);

  // --- Sunken Ruins: broken walls, pillars and the sealed Undercroft. -----------------
  const ruinBox = (x0: number, y0: number, w: number, h: number, seed: number) => {
    for (let x = x0; x <= x0 + w; x++)
      for (const y of [y0, y0 + h]) if (hash2(x, y, seed) > 0.28 && !P(x, y) && land(x, y)) m.set(x, y, Tile.RuinWall);
    for (let y = y0; y <= y0 + h; y++)
      for (const x of [x0, x0 + w]) if (hash2(x, y, seed + 1) > 0.28 && !P(x, y) && land(x, y)) m.set(x, y, Tile.RuinWall);
  };
  ruinBox(136, 34, 14, 10, 81);
  ruinBox(156, 30, 18, 12, 82);
  ruinBox(144, 52, 12, 9, 83);
  ruinBox(176, 42, 12, 14, 84);
  ruinBox(150, 72, 16, 12, 85);
  ruinBox(172, 78, 14, 12, 86);
  for (let i = 0; i < 70; i++) {
    const x = RUINS.x0 + 6 + Math.floor(rnd() * (RUINS.x1 - RUINS.x0 - 10));
    const y = RUINS.y0 + 6 + Math.floor(rnd() * (RUINS.y1 - RUINS.y0 - 10));
    if (!P(x, y) && (m.get(x, y) === Tile.Sand || m.get(x, y) === Tile.StoneFloor)) m.set(x, y, Tile.RuinWall);
  }
  // The Undercroft entrance: a stone court with the sealed door on its north side.
  m.fill(164, 58, 177, 68, Tile.StoneFloor);
  for (let y = 58; y < 68; y++) for (let x = 164; x < 177; x++) setP(x, y);
  m.fill(166, 56, 175, 58, Tile.RuinWall);
  road([[140, 64], [152, 64], [164, 63]], 1);
  // The Collapsed Library (secret): a walled room with one hidden gap.
  m.fill(184, 88, 194, 98, Tile.StoneFloor);
  for (let x = 183; x <= 194; x++) {
    m.set(x, 87, Tile.RuinWall);
    m.set(x, 98, Tile.RuinWall);
  }
  for (let y = 87; y <= 98; y++) {
    m.set(183, y, y === 93 ? Tile.StoneFloor : Tile.RuinWall);
    m.set(194, y, Tile.RuinWall);
  }

  // --- Zones (most specific last) -----------------------------------------------------
  m.zones.push({ id: "whisperwood", name: "Whisperwood", safe: false, ...FOREST, level: [2, 4], music: "forest" });
  m.zones.push({ id: "sunken-ruins", name: "Sunken Ruins", safe: false, ...RUINS, level: [4, 6], music: "ruins" });
  m.zones.push({ id: "hollow-caves", name: "Hollow Caves", safe: false, x0: CAVES.x0, y0: CAVES.y0 + 2, x1: CAVES.x1, y1: CAVES.y1, level: [5, 7], dark: true, music: "caves" });
  m.zones.push({ id: "bandit-camp", name: "Grakk's Camp", safe: false, x0: 100, y0: 10, x1: 125, y1: 34, level: [4, 5], music: "forest" });
  m.zones.push({ id: "wolf-den", name: "The Wolf Den", safe: false, x0: 19, y0: 16, x1: 33, y1: 28, level: [3, 4] });
  m.zones.push({ id: "undercroft-court", name: "Undercroft Court", safe: false, x0: 164, y0: 56, x1: 177, y1: 68, level: [5, 6] });
  m.zones.push({ id: "forgotten-shrine", name: "The Forgotten Shrine", safe: false, x0: 15, y0: 9, x1: 22, y1: 16, secret: true });
  m.zones.push({ id: "fox-hollow", name: "Fox Hollow", safe: false, x0: 110, y0: 101, x1: 120, y1: 109, secret: true });
  m.zones.push({ id: "collapsed-library", name: "The Collapsed Library", safe: false, x0: 184, y0: 88, x1: 194, y1: 98, secret: true });
  m.zones.push({ id: "crawlers-deep", name: "Crawler's Deep", safe: false, x0: 170, y0: 128, x1: 190, y1: 142, secret: true, dark: true });
  m.zones.push({ id: "emberwatch", name: "Emberwatch", safe: true, ...T, music: "town" });

  // --- NPCs ----------------------------------------------------------------------------
  const npc = (id: string, name: string, role: NpcDef["role"], tx: number, ty: number, look: NpcDef["look"], greeting: string) =>
    m.npcs.push({ id, name, role, x: px(tx), y: px(ty), look, greeting });
  type NpcDef = WorldMap["npcs"][number];
  npc("guildmaster", "Guildmaster Rhea", "guild", 34, 67, { skin: "#d9a77c", cloth: "#5a3f7a", trim: "#d8b35a", hair: "#2b2b30" }, "Another climber. Good. The Floor needs people who can hold a blade steady.");
  npc("smith", "Borin the Smith", "smith", 24, 68, { skin: "#c98f65", cloth: "#6b3a2a", trim: "#8a8a8a", hair: "#8a3b2a" }, "Bring me scrap and coin and I'll make that steel sing.");
  npc("merchant", "Tilde", "store", 48, 68, { skin: "#f1d0ae", cloth: "#3f6a8a", trim: "#d8b35a", hair: "#b8863b", helm: "cap" }, "Tonics, leathers, the odd charm. Coin up front.");
  npc("banker", "Old Wick", "storage", 49, 91, { skin: "#e0b890", cloth: "#4a5a3a", trim: "#c9a24a", hair: "#e8e0d0" }, "What's stored with Wick stays with Wick. Even when you fall.");
  npc("innkeep", "Marla", "inn", 25, 93, { skin: "#a8744f", cloth: "#8a4a32", trim: "#e8d8b0", hair: "#3b2a20" }, "Sit, rest. The fire's warm and the stew is mostly stew.");
  npc("tanner", "Hask the Tanner", "tanner", 44, 76, { skin: "#d9a77c", cloth: "#6b5a3a", trim: "#4a3526", hair: "#6b4226" }, "Wolf pelts. I need wolf pelts.");
  npc("scholar", "Scholar Ione", "scholar", 53, 73, { skin: "#f1d0ae", cloth: "#2e4a6a", trim: "#9fd3ff", hair: "#d9c07a", helm: "hood" }, "The ruins are older than the Floor itself. Isn't that wonderful?");
  npc("traveller", "Sella the Wanderer", "merchant", 42, 80, { skin: "#c79a74", cloth: "#7a3a5a", trim: "#f0c860", hair: "#2b2b30", helm: "hood" }, "Rare things from far floors. Look, but pay before you touch.");
  npc("warden", "Gate Warden Eld", "gate", 38, 71, { skin: "#b9b4a8", cloth: "#39424f", trim: "#f0c860", hair: "#9aa3ad", helm: "helm" }, "The Ascent Gate has been sealed since the Keeper woke below the ruins.");

  // --- Objects: chests, lore, waystones, the gates. -------------------------------------
  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "ascent-gate", kind: "gate", tx: 38, ty: 68, name: "The Ascent Gate", text: "A great stone arch. Light pours upward through it — when it's open." });
  obj({ id: "undercroft-door", kind: "door", tx: 170, ty: 59, name: "Sealed Undercroft Door", requires: "key_ruins", text: "Iron bands and old sigils. There's a keyhole shaped like a bandit's trophy." });
  obj({ id: "ws-town", kind: "waystone", tx: 42, ty: 83, name: "Emberwatch Waystone" });
  obj({ id: "ws-forest", kind: "waystone", tx: 62, ty: 27, name: "Whisperwood Waystone" });
  obj({ id: "ws-ruins", kind: "waystone", tx: 146, ty: 66, name: "Ruins Waystone" });
  obj({ id: "ws-caves", kind: "waystone", tx: 80, ty: 122, name: "Hollow Caves Waystone" });
  obj({ id: "chest-shrine", kind: "chest", tx: 18, ty: 12, name: "Shrine Offering", loot: [{ key: "charm_duelist", rarity: 2 }], gold: 40 });
  obj({ id: "chest-foxhollow", kind: "chest", tx: 115, ty: 105, name: "Fox's Hoard", loot: [{ key: "charm_feather", rarity: 2 }, { key: "tonic", qty: 2 }], gold: 25 });
  obj({ id: "chest-library", kind: "chest", tx: 189, ty: 92, name: "Scholar's Strongbox", loot: [{ key: "art_lens" }, { key: "staff_ember", rarity: 2 }], gold: 60 });
  obj({ id: "chest-deep", kind: "chest", tx: 180, ty: 134, name: "Crawler's Cache", loot: [{ key: "charm_gale", rarity: 2 }, { key: "mat_ember" }], gold: 90 });
  obj({ id: "chest-camp", kind: "chest", tx: 116, ty: 18, name: "Bandit Loot Chest", loot: [{ key: "armor_leather", rarity: 1 }, { key: "tonic", qty: 2 }], gold: 45 });
  obj({ id: "chest-den", kind: "chest", tx: 23, ty: 20, name: "Gnawed Satchel", loot: [{ key: "charm_wolf", rarity: 1 }], gold: 15 });
  obj({ id: "lore-rim", kind: "lore", tx: 104, ty: 108, name: "Weathered Marker", text: "\"The Floor floats. Below is sky. Above is the next Floor. Between is everything we have.\"" });
  obj({ id: "lore-scout", kind: "lore", tx: 96, ty: 26, name: "Scout's Journal", text: "Day 9. The bandits carry something from the ruins — a key, heavy and old. Their king wears it. Day 10. They found me." });
  obj({ id: "lore-library", kind: "lore", tx: 186, ty: 95, name: "Crumbling Tablet", text: "\"The Keeper stands at the First Gate. Parry his thrust at the instant of light and he will kneel.\"" });
  obj({ id: "lore-shrine", kind: "lore", tx: 20, ty: 11, name: "Mossy Shrine", text: "Carved into the stone: a figure deflecting a blade. Beneath it, the word WAIT." });
  obj({ id: "lore-cave", kind: "lore", tx: 148, ty: 130, name: "Surveyor's Last Note", text: "The crystals hum when something big moves in the deep. They are humming now." });

  // --- Encounters ----------------------------------------------------------------------
  const spawn = (id: string, tx: number, ty: number, enemies: string[], level: number, radius = 48, respawn = 50, elite = 0.06) =>
    m.spawns.push({ id, x: px(tx), y: px(ty), radius, enemies, respawn, elite, level });
  // Training yard (inside the walls).
  spawn("yard-dummy-a", 22, 76, ["dummy"], 1, 0, 3, 0);
  spawn("yard-dummy-b", 22, 81, ["dummy"], 1, 0, 3, 0);
  spawn("yard-sparring", 27, 78, ["sparring"], 1, 0, 3, 0);
  // Green Fields (1–3).
  spawn("f-wolves-1", 74, 60, ["wolf", "wolf"], 1, 60);
  spawn("f-wolves-2", 96, 82, ["wolf", "wolf", "wolf"], 2, 70);
  spawn("f-goblins-1", 84, 66, ["goblin", "goblin"], 1, 50);
  spawn("f-goblins-2", 106, 90, ["goblin", "archer", "goblin"], 2, 60);
  spawn("f-archers", 112, 76, ["archer", "archer"], 2, 50);
  spawn("f-bandits", 70, 102, ["cutpurse", "shieldbearer"], 3, 50);
  spawn("f-rim", 124, 100, ["goblin", "goblin", "archer"], 3, 60);
  spawn("f-west", 10, 76, ["wolf", "wolf"], 2, 50);
  spawn("f-south", 30, 104, ["goblin", "archer"], 2, 50);
  // Whisperwood (2–4).
  spawn("w-den", 26, 22, ["alpha", "wolf", "wolf", "wolf"], 4, 60, 150, 0);
  spawn("w-path-1", 46, 36, ["wolf", "wolf"], 2, 50);
  spawn("w-path-2", 70, 22, ["cutpurse", "cutpurse"], 3, 50);
  spawn("w-glade", 84, 36, ["goblin", "goblin", "archer"], 3, 50);
  spawn("w-east", 96, 44, ["shieldbearer", "cutpurse"], 3, 40);
  spawn("w-north", 48, 12, ["wolf", "wolf", "wolf"], 3, 50);
  spawn("w-camp-gate", 99, 19, ["shieldbearer", "archer"], 4, 40);
  spawn("w-camp", 112, 24, ["cutpurse", "cutpurse", "archer", "shieldbearer"], 4, 60, 60, 0.1);
  spawn("w-grakk", 114, 18, ["grakk"], 5, 0, 300, 0);
  // Sunken Ruins (4–6).
  spawn("r-west", 138, 60, ["shieldbearer", "cultist"], 4, 50);
  spawn("r-hall", 143, 39, ["cultist", "cultist", "stalker"], 5, 50);
  spawn("r-north", 164, 36, ["shieldbearer", "shieldbearer", "cultist"], 5, 60, 60, 0.12);
  spawn("r-court", 170, 64, ["stalker", "cultist", "shieldbearer"], 6, 50, 60, 0.12);
  spawn("r-east", 182, 50, ["brute", "cultist"], 6, 50, 80, 0.12);
  spawn("r-south", 158, 78, ["stalker", "stalker"], 5, 60);
  spawn("r-deep", 178, 84, ["brute", "shieldbearer", "cultist"], 6, 60, 80, 0.15);
  // Hollow Caves (5–7).
  spawn("c-mouth", 86, 124, ["brute"], 5, 30, 80);
  spawn("c-hall", 116, 126, ["stalker", "stalker", "cultist"], 6, 60);
  spawn("c-east", 148, 128, ["brute", "stalker"], 6, 60);
  spawn("c-long", 132, 140, ["cultist", "cultist", "stalker"], 6, 50);
  spawn("c-tunnel", 164, 112, ["stalker", "shieldbearer"], 6, 50);
  spawn("c-crawler", 180, 132, ["brute"], 8, 0, 600, 1);

  m.spawn = { x: px(38), y: px(84) };
  connectEverything(m);
  m.npcs.push({ id: "board1", name: "Mission Board", role: "board", x: px(41), y: px(67), look: { skin: "#000", cloth: "#000", trim: "#000", hair: "#000" }, greeting: "Missions posted by the town. Each pays gold, experience and Marks — and goes back up on the board a while after it's done." });
  addInteriors(m, [
    { building: "smith", style: "smithy", npcs: [{ id: "smith" }] },
    { building: "guild", style: "hall" },
    { building: "store", style: "shop", npcs: [{ id: "merchant" }] },
    { building: "inn", style: "inn", npcs: [{ id: "innkeep" }] },
    { building: "storage", style: "vault", npcs: [{ id: "banker" }] },
    {
      building: "scholar",
      style: "library",
      add: [{ id: "archivist1", name: "Archivist Pell", role: "archivist", shop: "scrolls1", look: { skin: "#e0b890", cloth: "#4a3a6a", trim: "#d8b35a", hair: "#9aa3ad", helm: "hood" },
        greeting: "Every skill ever written down passes through these shelves. Scrolls cost coin — and Marks, which prove you've done honest work for the town. The Mission Board pays in Marks." }],
    },
  ]);
  return m;
}

/**
 * Guarantee that every NPC, object and enemy spawn can be walked to from the spawn point.
 * Anything sealed off by scattered trees gets a small clearing and a trail cut through
 * the trees (never through walls, palisades, water or rock) to the nearest open ground.
 */
function connectEverything(m: WorldMap) {
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
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (m.get(pt.tx + dx, pt.ty + dy) === Tile.Tree) m.set(pt.tx + dx, pt.ty + dy, Tile.TallGrass);
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
        const step = t === Tile.Tree ? 4 : m.isSolidTile(nx, ny) ? Infinity : 1;
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
      if (m.get(x, y) === Tile.Tree) m.set(x, y, Tile.TallGrass);
    }
    flood(start);
  }
}
