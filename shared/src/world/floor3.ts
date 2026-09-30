import { TILE } from "../constants.ts";
import { addInteriors } from "./interiors.ts";
import { Tile, WorldMap, type WorldObject } from "./map.ts";

const px = (t: number) => t * TILE + TILE / 2;

function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number, scale: number, seed: number) {
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

/** Where the Emberhold keep's courtyard is (the town's safe rectangle). */
export const EMBERHOLD = { x0: 70, y0: 118, x1: 111, y1: 142 };

/**
 * Floor 3 — the Ember Reaches: volcanic isles over a burning sky, where the dragons nest.
 * Grass here is ash, water is lava (the renderer paints them so).
 *   Emberhold (south, safe) → the Ashen Slopes (centre) → Dragonbone Canyon (west, with a
 *   hidden hoard), the Obsidian Wastes (east), the Caldera Heights (north, Cindermaw's
 *   ring) → the Dragon's Roost (the floor's dungeon).
 */
export function buildFloor3(): WorldMap {
  const W = 180;
  const H = 150;
  const m = new WorldMap(W, H);
  m.name = "Floor 3 — The Ember Reaches";
  m.theme = "ember";
  m.fill(0, 0, W, H, Tile.Void);
  const protect = new Uint8Array(W * H);
  const P = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && protect[y * W + x] === 1;
  const setP = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) protect[y * W + x] = 1;
  };
  const island = (cx: number, cy: number, rx: number, ry: number, seed: number, tile: number = Tile.Grass) => {
    for (let y = cy - ry - 3; y <= cy + ry + 3; y++) {
      for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d < 1 + (noise(x, y, 5, seed) - 0.5) * 0.3) m.set(x, y, tile);
      }
    }
  };
  const bridge = (x0: number, y0: number, x1: number, y1: number, half = 1, tile: number = Tile.StoneFloor) => {
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
  };
  const land = (x: number, y: number) => m.get(x, y) !== Tile.Void;
  const open = (x: number, y: number) => land(x, y) && !P(x, y);
  /** A pool of lava (drawn as lava on this floor), keeping clear of protected ground. */
  const lava = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
      for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
        if (Math.hypot((x - cx) / rx, (y - cy) / ry) < 1 + (noise(x, y, 3, seed) - 0.5) * 0.35 && open(x, y)) m.set(x, y, Tile.Water);
      }
    }
  };

  // --- Islands ---------------------------------------------------------------
  island(90, 130, 22, 13, 1); // Emberhold
  island(90, 88, 46, 24, 2); // Ashen Slopes
  island(30, 84, 20, 25, 3); // Dragonbone Canyon
  island(9, 52, 7, 6, 4); // The Dragon's Hoard (secret)
  island(152, 80, 21, 23, 5); // Obsidian Wastes
  island(90, 38, 42, 15, 6); // Caldera Heights
  island(90, 11, 11, 7, 7); // The Dragon's Roost

  // --- Bridges ---------------------------------------------------------------
  bridge(101, 121, 101, 106, 2); // Emberhold → slopes (east of the Keep)
  bridge(47, 88, 52, 88, 1); // slopes → canyon
  bridge(133, 86, 138, 84, 1); // slopes → wastes
  bridge(90, 65, 90, 52, 2); // slopes → heights
  bridge(90, 24, 90, 17, 2); // heights → the roost
  // The hoard's way in: a crumbling rib-bridge behind the canyon's northern bones.
  bridge(20, 64, 12, 56, 1, Tile.Path);

  // --- Emberhold (town) ---------------------------------------------------------
  const T = EMBERHOLD;
  for (let y = T.y0; y < T.y1; y++) for (let x = T.x0; x < T.x1; x++) if (land(x, y)) setP(x, y);
  m.fill(78, 123, 103, 137, Tile.StoneFloor);
  const house = (id: string, name: string, tx: number, ty: number, tw: number, th: number) => {
    m.fill(tx, ty, tx + tw, ty + th, Tile.House);
    m.buildings.push({ id, name, tx, ty, tw, th });
  };
  house("emberkeep", "Emberhold Keep", 85, 118, 10, 4);
  house("quarter3", "Quartermaster", 72, 122, 6, 4);
  house("forge3", "The Dragonforge", 103, 122, 6, 4);
  house("vault3", "Ember Vault", 73, 131, 5, 3);
  house("inn3", "The Cinder Cup", 103, 131, 6, 4);
  m.prop("lamp", 80, 125);
  m.prop("lamp", 100, 125);
  m.prop("lamp", 82, 136);
  m.prop("lamp", 98, 136);
  m.prop("bench", 86, 134, 2, 1);
  m.prop("bench", 93, 134, 2, 1);
  m.prop("anvil", 101, 127);
  m.prop("rack", 108, 127, 1, 1);
  m.prop("crates", 79, 128);
  m.prop("barrel", 78, 131);
  m.prop("sacks", 107, 136);
  m.prop("board", 94, 123);
  m.prop("skull", 86, 138, 3, 2);

  // --- Ashen Slopes ---------------------------------------------------------------
  // A road from Emberhold to the heights bridge, crossing the ash fields.
  bridge(90, 109, 90, 66, 1, Tile.Path);
  bridge(101, 105, 91, 97, 1, Tile.Path);
  bridge(90, 90, 53, 88, 0, Tile.Path);
  bridge(90, 88, 132, 86, 0, Tile.Path);
  lava(64, 78, 5, 3, 21);
  lava(118, 98, 6, 3, 22);
  lava(104, 74, 3, 2, 23);
  for (let y = 66; y <= 110; y++) {
    for (let x = 46; x <= 134; x++) {
      if (!open(x, y) || m.get(x, y) !== Tile.Grass) continue;
      const n = noise(x, y, 7, 24);
      if (n > 0.72) m.set(x, y, Tile.Rock);
    }
  }
  // Charred stumps of the old forest, and ribs of something huge half-buried in the ash.
  for (const [x, y] of [[70, 96], [110, 82], [58, 70], [122, 70], [76, 104]] as const) if (open(x, y) && open(x, y + 1)) m.prop("ribs", x, y, 1, 1, x % 2);

  // --- Dragonbone Canyon ------------------------------------------------------------
  // A canyon floor ringed with basalt; a dragon's skeleton lies along its length.
  for (let y = 60; y <= 108; y++) {
    for (let x = 10; x <= 50; x++) {
      if (!open(x, y)) continue;
      const n = noise(x, y, 5, 31);
      const d = Math.hypot((x - 30) / 20, (y - 84) / 25);
      if (d > 0.72 && n > 0.45) m.set(x, y, Tile.Rock);
    }
  }
  bridge(46, 88, 30, 84, 1, Tile.Path);
  bridge(30, 84, 30, 66, 1, Tile.Path);
  bridge(30, 66, 20, 64, 1, Tile.Path);
  for (let i = 0; i < 6; i++) {
    const y = 72 + i * 4;
    for (const x of [24, 36]) if (open(x, y) && open(x, y + 1)) m.prop("ribs", x, y, 1, 1, x < 30 ? 0 : 1);
  }
  if (open(29, 97) && open(31, 98)) m.prop("skull", 29, 97, 3, 2);
  // A screen of bone and basalt hides the rib-bridge to the hoard.
  for (const [x, y] of [[18, 66], [19, 67], [22, 65], [23, 66]] as const) if (open(x, y)) m.set(x, y, Tile.Rock);

  // --- The Dragon's Hoard (secret) ----------------------------------------------------
  for (let y = 47; y <= 57; y++) for (let x = 3; x <= 15; x++) if (open(x, y) && hash(x, y, 40) < 0.12) m.set(x, y, Tile.Crystal);

  // --- Obsidian Wastes ---------------------------------------------------------------
  for (let y = 58; y <= 104; y++) {
    for (let x = 132; x <= 174; x++) {
      if (!open(x, y)) continue;
      const n = noise(x, y, 5, 51);
      if (n > 0.66) m.set(x, y, Tile.Rock);
      else if (n > 0.58 && hash(x, y, 52) < 0.4) m.set(x, y, Tile.Crystal);
      else if (n < 0.36) m.set(x, y, Tile.StoneFloor);
    }
  }
  bridge(138, 84, 152, 80, 1, Tile.StoneFloor);
  bridge(152, 80, 152, 64, 1, Tile.StoneFloor);
  bridge(152, 80, 160, 96, 1, Tile.StoneFloor);
  lava(162, 72, 3, 2, 53);
  lava(144, 96, 4, 2, 54);

  // --- Caldera Heights ---------------------------------------------------------------
  for (let y = 23; y <= 53; y++) {
    for (let x = 48; x <= 132; x++) {
      if (!open(x, y)) continue;
      const n = noise(x, y, 6, 61);
      if (n > 0.68) m.set(x, y, Tile.Rock);
      else if (n < 0.34) m.set(x, y, Tile.StoneFloor);
    }
  }
  bridge(90, 52, 90, 25, 1, Tile.StoneFloor);
  bridge(90, 40, 64, 36, 1, Tile.StoneFloor);
  bridge(90, 36, 112, 34, 1, Tile.StoneFloor);
  // Wyrmrest Caldera: a ring of basalt around Cindermaw's floor, with a moat of lava.
  const CX = 118;
  const CY = 34;
  for (let y = CY - 10; y <= CY + 10; y++) {
    for (let x = CX - 12; x <= CX + 12; x++) {
      if (!land(x, y)) continue;
      const d = Math.hypot((x - CX) / 10, (y - CY) / 8);
      if (d < 1) {
        m.set(x, y, Tile.StoneFloor);
        setP(x, y);
      }
    }
  }
  for (const [x, y] of [[CX - 8, CY - 5], [CX + 8, CY - 5], [CX - 9, CY + 3], [CX + 9, CY + 3]] as const) {
    m.set(x, y, Tile.RuinWall);
  }
  lava(70, 30, 4, 2, 62);
  lava(104, 46, 3, 2, 63);

  // --- The Dragon's Roost (approach) ---------------------------------------------------
  for (let y = 5; y <= 17; y++) for (let x = 80; x <= 100; x++) if (open(x, y)) m.set(x, y, Tile.StoneFloor);
  for (const [x, y] of [[83, 7], [97, 7], [83, 13], [97, 13]]) m.set(x, y, Tile.RuinWall);

  // --- Ash and charred trees on open ground --------------------------------------------
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (m.get(x, y) !== Tile.Grass || P(x, y)) continue;
      const r = hash(x, y, 70);
      if (r < 0.035 && noise(x, y, 7, 71) > 0.58) m.set(x, y, Tile.Tree);
      else if (r < 0.08) m.set(x, y, Tile.TallGrass);
    }
  }

  // --- Rim: the edges of the isles over the burning sky ---------------------------------
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = m.get(x, y);
      if (t !== Tile.Grass && t !== Tile.TallGrass && t !== Tile.Flowers) continue;
      if (m.get(x, y + 1) === Tile.Void || m.get(x - 1, y) === Tile.Void || m.get(x + 1, y) === Tile.Void || m.get(x, y - 1) === Tile.Void) m.set(x, y, Tile.Cliff);
    }
  }

  // --- Zones -----------------------------------------------------------------------------
  m.zones.push({ id: "ember-reaches", name: "The Ember Reaches", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [12, 14], music: "ember" });
  m.zones.push({ id: "ashen-slopes", name: "Ashen Slopes", safe: false, x0: 44, y0: 64, x1: 136, y1: 112, level: [12, 13], music: "ember" });
  m.zones.push({ id: "dragonbone-canyon", name: "Dragonbone Canyon", safe: false, x0: 8, y0: 58, x1: 50, y1: 110, level: [13, 14], music: "ember" });
  m.zones.push({ id: "obsidian-wastes", name: "Obsidian Wastes", safe: false, x0: 130, y0: 56, x1: 176, y1: 106, level: [13, 15], music: "ember" });
  m.zones.push({ id: "caldera-heights", name: "Caldera Heights", safe: false, x0: 46, y0: 22, x1: 134, y1: 56, level: [14, 15], music: "dragon" });
  m.zones.push({ id: "wyrmrest", name: "Wyrmrest Caldera", safe: false, x0: 106, y0: 25, x1: 131, y1: 44, level: [15, 15], music: "dragon" });
  m.zones.push({ id: "dragons-roost", name: "The Dragon's Roost", safe: false, x0: 76, y0: 0, x1: 104, y1: 20, level: [15, 16], music: "dragon" });
  m.zones.push({ id: "dragons-hoard", name: "The Dragon's Hoard", safe: false, x0: 0, y0: 44, x1: 18, y1: 60, secret: true });
  m.zones.push({ id: "emberhold", name: "Emberhold", safe: true, ...T, music: "emberhold" });

  // --- People -------------------------------------------------------------------------
  const npc = (id: string, name: string, role: "store" | "smith" | "storage" | "guild" | "inn" | "lore" | "merchant", tx: number, ty: number, look: { skin: string; cloth: string; trim: string; hair: string; helm?: "none" | "hood" | "cap" | "helm" | "crown" }, greeting: string, shop?: string) =>
    m.npcs.push({ id, name, role, x: px(tx), y: px(ty), look, greeting, shop });
  npc("captain", "Captain Brask", "guild", 90, 124, { skin: "#a8744f", cloth: "#5a1e1a", trim: "#e8b840", hair: "#2b2b30", helm: "helm" },
    "Welcome to Emberhold, climber. Everything up here burns — the ground, the sky, and anyone who forgets the dragons.");
  npc("quarter3", "Quartermaster Sable", "store", 75, 127, { skin: "#e0b890", cloth: "#3a3434", trim: "#e8b840", hair: "#8a3b2a", helm: "cap" },
    "Water's scarcer than steel up here. So are good maps.", "store3");
  npc("forgemistress", "Kaela of the Dragonforge", "smith", 106, 127, { skin: "#7a5236", cloth: "#3a1a14", trim: "#ff8a3a", hair: "#e8e0d0" },
    "Bring me dragonscale and cinderstone and I'll make you something the dragons will remember.", "smith3");
  npc("vault3", "Vaultkeeper Odran", "storage", 76, 135, { skin: "#d9a77c", cloth: "#4a3a2a", trim: "#c9a24a", hair: "#3b2a20" },
    "The vaults run all the way down the tower. Your things are safe here too.");
  npc("innkeep3", "Mira of the Cinder Cup", "inn", 105, 136, { skin: "#f1d0ae", cloth: "#6b1e3a", trim: "#e8d8b0", hair: "#b8863b" },
    "Sit. Drink. The dragons don't fly at night — mostly.");
  npc("scholar", "Ysolde the Dragon-Scholar", "lore", 84, 132, { skin: "#c79a74", cloth: "#2a3a5a", trim: "#e8c867", hair: "#e8e0d0", helm: "hood" },
    "Every bone in that canyon has a name. I intend to learn all of them before the living ones learn mine.");
  npc("caravan3", "Sella the Wanderer", "merchant", 92, 138, { skin: "#c79a74", cloth: "#7a3a5a", trim: "#f0c860", hair: "#2b2b30", helm: "hood" },
    "Even here? The heat is terrible for business. The prices, however…");

  // --- Places --------------------------------------------------------------------------
  const obj = (o: Omit<WorldObject, "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "descent3", kind: "gate", tx: 90, ty: 140, name: "The Descent", text: "Cool air rises from the stairs down to the Gilded Terraces.", dest: "floor2" });
  obj({ id: "ws-emberhold", kind: "waystone", tx: 96, ty: 128, name: "Emberhold Waystone" });
  obj({ id: "ws-slopes", kind: "waystone", tx: 93, ty: 86, name: "Slopes Waystone" });
  obj({ id: "ws-canyon", kind: "waystone", tx: 33, ty: 84, name: "Canyon Waystone" });
  obj({ id: "ws-wastes", kind: "waystone", tx: 155, ty: 80, name: "Wastes Waystone" });
  obj({ id: "ws-caldera", kind: "waystone", tx: 86, ty: 40, name: "Caldera Waystone" });
  obj({ id: "ash-monument", kind: "lore", tx: 87, ty: 76, name: "The Ash Monument", text: "A statue of a knight, melted to the waist. The plinth reads: THEY CAME FROM THE SKY. WE DID NOT HOLD." });
  obj({ id: "bone-shrine", kind: "lore", tx: 30, ty: 76, name: "Shrine of the First Dragon", text: "Offerings of coin and scale lie before a skull the size of a house. Someone still tends it." });
  obj({ id: "obsidian-altar", kind: "lore", tx: 158, ty: 88, name: "Obsidian Altar", text: "Black glass, still warm, carved with a crown of flame. The golems here were built to guard it — and they remember." });
  obj({ id: "caldera-scar", kind: "lore", tx: 102, ty: 32, name: "The Scorched Stone", text: "Claw marks, each longer than you are tall, gouged into the rock around Cindermaw's caldera." });
  obj({ id: "hoard-egg", kind: "lore", tx: 8, ty: 51, name: "The Dragon Egg", text: "An egg as tall as your chest, cracked and cold, lying on a bed of gold. Whatever hatched from it is out there." });
  obj({ id: "hoard-chest", kind: "chest", tx: 11, ty: 54, name: "Dragon's Hoard", gold: 480, loot: [{ key: "mat_emberheart", qty: 2 }, { key: "mat_dragonscale", qty: 4 }, { key: "charm_gale", rarity: 2 }] });
  obj({ id: "canyon-chest", kind: "chest", tx: 36, ty: 100, name: "Scale-Buried Chest", gold: 200, loot: [{ key: "mat_dragonscale", qty: 3 }, { key: "tonic", qty: 2 }] });
  obj({ id: "wastes-chest", kind: "chest", tx: 166, ty: 64, name: "Obsidian Coffer", gold: 220, loot: [{ key: "mat_cinder", qty: 4 }] });
  obj({ id: "roost-door", kind: "door", tx: 90, ty: 8, name: "The Roost Gate", requires: "key_roost", text: "Twin doors of blackened bronze, carved with dragons. A sigil-shaped hollow waits between them — Cindermaw wears the sigil.", dest: "roost" });
  obj({ id: "sealed-stair4", kind: "gate", tx: 97, ty: 11, name: "The Frozen Stair", text: "The stair climbs out of the smoke into cold white air. Snow drifts down it.", dest: "floor4" });

  // --- Enemies -------------------------------------------------------------------------
  const spawn = (id: string, tx: number, ty: number, enemies: string[], level: number, radius = 48, respawn = 60, elite = 0.07) =>
    m.spawns.push({ id, x: px(tx), y: px(ty), radius, enemies, respawn, elite, level });
  spawn("s-ash-a", 76, 98, ["ashling", "ashling", "ashling"], 12, 56);
  spawn("s-ash-b", 106, 92, ["ashling", "ashling"], 12);
  spawn("s-hound-a", 66, 86, ["magmahound", "magmahound", "magmahound"], 12, 56);
  spawn("s-hound-b", 116, 82, ["magmahound", "magmahound"], 13);
  spawn("s-caller-a", 84, 72, ["flamecaller", "ashling"], 13);
  spawn("s-caller-b", 100, 70, ["flamecaller", "magmahound"], 13);
  spawn("c-drake-a", 30, 92, ["drake"], 13, 30, 90);
  spawn("c-drake-b", 26, 72, ["drake", "ashling"], 14, 30, 90);
  spawn("c-drake-c", 38, 80, ["drake"], 14, 30, 90);
  spawn("c-hound", 36, 102, ["magmahound", "magmahound"], 13);
  spawn("w-golem-a", 148, 70, ["obsidian"], 14, 30, 90);
  spawn("w-golem-b", 160, 90, ["obsidian"], 14, 30, 90);
  spawn("w-caller", 152, 96, ["flamecaller", "flamecaller"], 14);
  spawn("w-guard", 164, 76, ["emberguard", "flamecaller"], 15);
  spawn("h-guard-a", 70, 40, ["emberguard", "emberguard"], 14);
  spawn("h-guard-b", 100, 44, ["emberguard", "flamecaller"], 15);
  spawn("h-drake", 64, 32, ["drake", "drake"], 15, 40, 100);
  spawn("h-golem", 80, 30, ["obsidian"], 15, 30, 100);
  spawn("cindermaw", CX, CY, ["cindermaw"], 15, 10, 600, 0);
  spawn("r-guard", 90, 14, ["emberguard", "flamecaller", "drake"], 16, 40, 80, 0.2);

  // Scattered rock and dead trees must never swallow a spawn, a chest or a door: clear the ground around them.
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

  m.spawn = { x: px(90), y: px(131) };
  m.npcs.push({ id: "board3", name: "Mission Board", role: "board", x: px(94), y: px(124), look: { skin: "#000", cloth: "#000", trim: "#000", hair: "#000" }, greeting: "Missions posted by the town. Each pays gold, experience and Marks — and goes back up on the board a while after it's done." });
  addInteriors(m, [
    {
      building: "emberkeep",
      style: "library",
      npcs: [{ id: "scholar", at: [8, 4] }],
      add: [{ id: "archivist3", name: "Archivist Corvane", role: "archivist", shop: "scrolls3", look: { skin: "#a8744f", cloth: "#3a1a14", trim: "#ff8a3a", hair: "#e8e0d0", helm: "hood" },
        greeting: "Dragon-lore, fire-arts, the old epics. Nothing in this room is cheap, and nothing in it is safe. Marks and gold." }],
    },
    { building: "quarter3", style: "shop", npcs: [{ id: "quarter3" }] },
    { building: "forge3", style: "smithy", npcs: [{ id: "forgemistress" }] },
    { building: "vault3", style: "vault", npcs: [{ id: "vault3" }] },
    { building: "inn3", style: "inn", npcs: [{ id: "innkeep3" }] },
  ]);
  return m;
}
