import { addInteriors } from "./interiors.ts";
import { connectEverything, hash, isleBuilder, noise, px } from "./isles.ts";
import { Tile, WorldMap } from "./map.ts";

/** Saltmere's boardwalks: the town's safe rectangle. */
export const SALTMERE = { x0: 18, y0: 112, x1: 76, y1: 146 };

/**
 * Floor 6 — the Drowned Isles: a ring of isles around a great lagoon, where the sea has
 * climbed the tower. Grass here is sea-grass over sand, water is bright and clear, the
 * trees are kelp and palms, and the crystals are coral (the renderer paints them so).
 *   Saltmere (south-west, safe, on stilts) → the Tidepools (south-east, with the hidden Pearl
 *   Grotto beyond), the Coral Gardens (west), the Lagoon (centre), the Wreck Coast (east),
 *   the Kelp Forest (north-west), the Stormbreak Cliffs (north-east, Scylla's Maw)
 *   → the Drowned Cathedral (the floor's dungeon).
 */
export function buildFloor6(): WorldMap {
  const W = 180;
  const H = 150;
  const m = new WorldMap(W, H);
  m.name = "Floor 6 — The Drowned Isles";
  m.theme = "tide";
  m.fill(0, 0, W, H, Tile.Void);
  const b = isleBuilder(m);

  // --- Islands ---------------------------------------------------------------------------
  b.island(46, 129, 27, 15, 101); // Saltmere
  b.island(128, 124, 25, 16, 102); // the Tidepools
  b.island(170, 128, 6, 6, 103); // the Pearl Grotto (secret)
  b.island(30, 82, 21, 21, 104); // the Coral Gardens
  b.island(92, 84, 30, 22, 105); // the Lagoon
  b.island(154, 78, 19, 22, 106); // the Wreck Coast
  b.island(42, 38, 25, 15, 107); // the Kelp Forest
  b.island(130, 34, 30, 14, 108); // the Stormbreak Cliffs
  b.island(90, 11, 11, 7, 109); // the Drowned Cathedral

  // --- Bridges: long piers of old planking over the sea ----------------------------------
  b.bridge(72, 130, 104, 126, 1, Tile.Floorboards);
  b.bridge(40, 114, 34, 102, 1, Tile.Floorboards);
  b.bridge(50, 84, 63, 84, 1, Tile.Floorboards);
  b.bridge(121, 82, 136, 80, 1, Tile.Floorboards);
  b.bridge(116, 110, 106, 104, 1, Tile.Floorboards);
  b.bridge(76, 64, 58, 50, 1, Tile.Floorboards);
  b.bridge(108, 64, 118, 46, 1, Tile.Floorboards);
  b.bridge(62, 30, 81, 13, 1, Tile.Floorboards);
  b.bridge(112, 28, 99, 13, 1, Tile.Floorboards);
  // The Grotto's way in: a sunken pier behind the Tidepools' eastern rocks.
  b.bridge(152, 126, 168, 128, 0, Tile.Floorboards);

  // --- Saltmere (town, built out over the water on stilts) ------------------------------
  const T = SALTMERE;
  b.protectRect(T);
  m.fill(28, 121, 66, 139, Tile.Floorboards);
  b.house("hall6", "The Tidehall", 38, 116, 10, 4);
  b.house("quarter6", "The Chandlery", 25, 121, 6, 4);
  b.house("forge6", "The Pearlforge", 58, 121, 6, 4);
  b.house("vault6", "The Strongbox", 26, 131, 5, 3);
  b.house("inn6", "The Salted Anchor", 56, 131, 7, 4);
  for (const [x, y] of [[33, 123], [53, 123], [33, 134], [53, 134], [43, 139]] as const) m.prop("lamp", x, y);
  m.prop("crates", 36, 130);
  m.prop("barrel", 36, 131);
  m.prop("barrel", 50, 130);
  m.prop("sacks", 50, 131);
  m.prop("stall", 40, 128, 2, 1);
  m.prop("stall", 45, 128, 2, 1);
  m.prop("logs", 62, 138, 2, 1);
  m.prop("anvil", 61, 126);
  m.prop("rack", 64, 126);
  m.prop("well", 43, 133, 2, 2);
  // Open water between the piers.
  for (const [x0, y0, x1, y1] of [[22, 140, 30, 144], [60, 140, 70, 144]] as const) b.scatter(x0, y0, x1, y1, () => Tile.Water);

  // --- The Tidepools --------------------------------------------------------------------
  b.bridge(104, 126, 140, 124, 1, Tile.Sand);
  b.bridge(128, 124, 116, 110, 1, Tile.Sand);
  b.scatter(104, 108, 152, 140, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 4, 110);
    return n > 0.64 ? Tile.Water : n > 0.56 && hash(x, y, 111) < 0.5 ? Tile.Rock : n < 0.4 ? Tile.Sand : undefined;
  });
  // Rocks hide the sunken pier to the Grotto.
  for (const [x, y] of [[150, 125], [151, 127], [150, 129]] as const) if (b.open(x, y)) m.set(x, y, Tile.Rock);
  // The Grotto: pearl-white sand and coral around a still pool.
  b.scatter(164, 122, 176, 134, (x, y) => (Math.hypot(x - 170, y - 128) < 2 ? Tile.Water : hash(x, y, 112) < 0.12 ? Tile.Crystal : Tile.Sand));

  // --- The Coral Gardens ----------------------------------------------------------------
  b.bridge(34, 102, 30, 64, 1, Tile.Sand);
  b.bridge(30, 84, 50, 84, 0, Tile.Sand);
  b.scatter(9, 61, 51, 103, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 5, 113);
    return n > 0.62 ? (hash(x, y, 114) < 0.55 ? Tile.Crystal : Tile.Water) : n < 0.3 ? Tile.Sand : n < 0.36 && hash(x, y, 115) < 0.4 ? Tile.Flowers : undefined;
  });

  // --- The Lagoon -----------------------------------------------------------------------
  // A round lagoon in the middle of the isle, with a sandy shore road around it.
  for (let y = 62; y <= 106; y++) {
    for (let x = 62; x <= 122; x++) {
      if (!b.open(x, y)) continue;
      const d = Math.hypot((x - 92) / 15, (y - 84) / 11);
      if (d < 1 + (noise(x, y, 4, 116) - 0.5) * 0.2) m.set(x, y, Tile.Water);
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = Math.round(92 + Math.cos(a) * 18.5);
    const y = Math.round(84 + Math.sin(a) * 14);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (b.land(x + dx, y + dy)) m.set(x + dx, y + dy, Tile.Sand);
  }
  b.bridge(63, 84, 74, 84, 1, Tile.Sand);
  b.bridge(110, 84, 121, 82, 1, Tile.Sand);
  b.bridge(92, 70, 92, 62, 1, Tile.Sand);
  b.bridge(92, 98, 108, 104, 1, Tile.Sand);
  b.scatter(62, 62, 122, 106, (x, y, t) => (t === Tile.Grass && noise(x, y, 5, 117) > 0.7 && hash(x, y, 118) < 0.6 ? Tile.Tree : undefined));

  // --- The Wreck Coast ------------------------------------------------------------------
  b.bridge(136, 80, 154, 78, 1, Tile.Sand);
  b.bridge(154, 78, 154, 60, 1, Tile.Sand);
  b.bridge(154, 78, 160, 96, 1, Tile.Sand);
  // Wrecks: the broken hulls of ships the sea threw up here.
  for (const [cx, cy, len] of [[146, 66, 8], [163, 86, 9], [146, 92, 6]] as const) {
    for (let i = 0; i < len; i++) {
      const w = Math.round(Math.sin((i / (len - 1)) * Math.PI) * 2.5);
      for (const side of [-1, 1]) if (b.open(cx + i, cy + side * (w + 1))) m.set(cx + i, cy + side * (w + 1), Tile.RuinWall);
      for (let k = -w; k <= w; k++) if (b.open(cx + i, cy + k)) m.set(cx + i, cy + k, Tile.Floorboards);
    }
  }
  b.scatter(136, 56, 173, 100, (x, y, t) => (t === Tile.Grass ? (noise(x, y, 6, 119) < 0.45 ? Tile.Sand : noise(x, y, 6, 119) > 0.74 ? Tile.Rock : undefined) : undefined));

  // --- The Kelp Forest ------------------------------------------------------------------
  b.bridge(58, 50, 42, 38, 1, Tile.Sand);
  b.bridge(42, 38, 62, 30, 1, Tile.Sand);
  b.bridge(42, 38, 24, 34, 1, Tile.Sand);
  b.scatter(17, 23, 67, 53, (x, y, t) => (t === Tile.Grass && noise(x, y, 4, 120) > 0.5 && hash(x, y, 121) < 0.65 ? Tile.Tree : undefined));
  b.pool(30, 44, 4, 3, 122);
  b.pool(52, 30, 3, 2, 123);

  // --- The Stormbreak Cliffs ------------------------------------------------------------
  b.bridge(118, 46, 126, 36, 1, Tile.StoneFloor);
  b.bridge(112, 28, 130, 34, 1, Tile.StoneFloor);
  const CX = 142;
  const CY = 32;
  b.arena(CX, CY, 10, 8);
  b.scatter(100, 20, 160, 48, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 5, 124);
    return n > 0.68 ? Tile.Rock : n < 0.3 ? Tile.StoneFloor : undefined;
  });
  b.pool(114, 40, 3, 2, 125);

  // --- The Drowned Cathedral (approach) -------------------------------------------------
  b.scatter(80, 5, 100, 17, () => Tile.StoneFloor);
  for (const [x, y] of [[83, 7], [97, 7], [83, 13], [97, 13]]) m.set(x, y, Tile.RuinWall);

  // --- Palms and sea-grass, then the rim ------------------------------------------------
  b.vegetate(0.04, 0.07, 126);
  b.rim();

  // --- Zones ----------------------------------------------------------------------------
  m.zones.push({ id: "drowned-isles", name: "The Drowned Isles", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [24, 26], music: "tide" });
  m.zones.push({ id: "tidepools", name: "The Tidepools", safe: false, x0: 100, y0: 106, x1: 156, y1: 144, level: [24, 25], music: "tide" });
  m.zones.push({ id: "coral-gardens", name: "The Coral Gardens", safe: false, x0: 7, y0: 60, x1: 53, y1: 105, level: [25, 26], music: "tide" });
  m.zones.push({ id: "lagoon", name: "The Lagoon", safe: false, x0: 60, y0: 60, x1: 124, y1: 108, level: [24, 25], music: "tide" });
  m.zones.push({ id: "wreck-coast", name: "The Wreck Coast", safe: false, x0: 134, y0: 54, x1: 175, y1: 102, level: [25, 27], music: "tide" });
  m.zones.push({ id: "kelp-forest", name: "The Kelp Forest", safe: false, x0: 15, y0: 21, x1: 69, y1: 55, level: [26, 27], music: "tide" });
  m.zones.push({ id: "stormbreak", name: "The Stormbreak Cliffs", safe: false, x0: 98, y0: 18, x1: 162, y1: 50, level: [26, 27], music: "cathedral" });
  m.zones.push({ id: "scyllas-maw", name: "Scylla's Maw", safe: false, x0: 129, y0: 22, x1: 156, y1: 42, level: [27, 27], music: "cathedral" });
  m.zones.push({ id: "drowned-cathedral", name: "The Drowned Cathedral", safe: false, x0: 76, y0: 0, x1: 104, y1: 20, level: [27, 28], music: "cathedral" });
  m.zones.push({ id: "pearl-grotto", name: "The Pearl Grotto", safe: false, x0: 158, y0: 116, x1: 180, y1: 140, secret: true });
  m.zones.push({ id: "saltmere", name: "Saltmere", safe: true, ...T, music: "saltmere" });

  // --- People ---------------------------------------------------------------------------
  b.npc("harbormaster", "Harbormaster Oona", "guild", 43, 124, { skin: "#c98f65", cloth: "#2a4a6a", trim: "#f0d890", hair: "#e8e0d0", helm: "cap" },
    "Saltmere floats because we keep bailing. Welcome aboard, climber — mind the gaps in the boards, and mind the things under them more.");
  b.npc("quarter6", "Pell the Chandler", "store", 28, 126, { skin: "#e0b890", cloth: "#5a4a3a", trim: "#8ff0e0", hair: "#8a6a4a" },
    "Rope, oil, tonics, charts. Everything a sailor needs, and a few things a sailor shouldn't.", "store6");
  b.npc("pearlsmith", "Marisol the Pearlsmith", "smith", 61, 126, { skin: "#8a5a3a", cloth: "#2a5a6a", trim: "#f0d890", hair: "#1e1a1a" },
    "Coral, brine pearls, and if you're brave, a leviathan's scale. I set them into steel so it never rusts.", "smith6");
  b.npc("vault6", "Old Barnaby", "storage", 28, 135, { skin: "#d9a77c", cloth: "#3a4a5a", trim: "#c9a24a", hair: "#e8e0d0" },
    "Locked, chained and sunk in the harbour. Nobody's ever stolen from the Strongbox. Nobody's ever found it.");
  b.npc("innkeep6", "Mags of the Anchor", "inn", 59, 136, { skin: "#f1d0ae", cloth: "#6b2a2a", trim: "#e8d8b0", hair: "#b8463b" },
    "Grog, chowder, and a dry bed. Two of those three are guaranteed.");
  b.npc("tidesage", "Tidesage Neria", "lore", 42, 131, { skin: "#bfe8e0", cloth: "#2a6a7a", trim: "#f0d890", hair: "#8ff0e0", helm: "hood" },
    "The sea remembers the tower before the tower remembered itself. Listen to the tide, and it will tell you where it's going.");
  b.npc("caravan6", "Sella the Wanderer", "merchant", 47, 137, { skin: "#c79a74", cloth: "#7a3a5a", trim: "#f0c860", hair: "#2b2b30", helm: "hood" },
    "Finally, a floor with a beach. I'm not selling anything today. Kidding! Look, look.");
  b.board("board6", 48, 124);

  // --- Places ---------------------------------------------------------------------------
  b.obj({ id: "descent6", kind: "gate", tx: 38, ty: 141, name: "The Descent", text: "The stairs down to the Umbral Wilds are dark and dry. You can hear the lanterns hiss.", dest: "floor5" });
  b.obj({ id: "ws-saltmere", kind: "waystone", tx: 49, ty: 133, name: "Saltmere Waystone" });
  b.obj({ id: "ws-tidepools", kind: "waystone", tx: 126, ty: 122, name: "Tidepool Waystone" });
  b.obj({ id: "ws-coral", kind: "waystone", tx: 33, ty: 84, name: "Coral Waystone" });
  b.obj({ id: "ws-wrecks", kind: "waystone", tx: 156, ty: 78, name: "Wreck Coast Waystone" });
  b.obj({ id: "ws-cliffs", kind: "waystone", tx: 124, ty: 38, name: "Stormbreak Waystone" });
  b.obj({ id: "sunken-bell", kind: "lore", tx: 92, ty: 67, name: "The Sunken Bell", text: "A bronze bell half-buried in the sand of the lagoon shore. At high tide, the fishermen say, it rings on its own." });
  b.obj({ id: "coral-idol", kind: "lore", tx: 26, ty: 72, name: "The Coral Idol", text: "A statue of a woman with a serpent's tail, grown out of living coral. Someone leaves fresh fish at her feet." });
  b.obj({ id: "captains-log", kind: "lore", tx: 150, ty: 66, name: "A Captain's Log", text: "The last page: \"The sea is climbing the tower. We sailed UP to get here. God help us, the Captain wants to sail higher.\" — signed, first mate of the Blackbrine." });
  b.obj({ id: "storm-altar", kind: "lore", tx: 122, ty: 30, name: "The Storm Altar", text: "Carved in the cliff above the Maw: SHE WHO DRINKS THE TIDE. FEED HER, OR BE FED TO HER." });
  b.obj({ id: "pearl-shrine", kind: "lore", tx: 170, ty: 124, name: "The Pearl Shrine", text: "A giant clam, open, holding a pearl the size of your head. It is warm, and very slowly, it breathes." });
  b.obj({ id: "grotto-chest", kind: "chest", tx: 174, ty: 130, name: "The Pearl Hoard", gold: 860, loot: [{ key: "mat_leviathanscale", qty: 2 }, { key: "mat_brinepearl", qty: 4 }, { key: "charm_tide", rarity: 3 }] });
  b.obj({ id: "wreck-chest", kind: "chest", tx: 164, ty: 86, name: "Captain's Strongbox", gold: 340, loot: [{ key: "mat_coral", qty: 4 }, { key: "tonic", qty: 2 }] });
  b.obj({ id: "kelp-chest", kind: "chest", tx: 24, ty: 30, name: "Tangled Chest", gold: 360, loot: [{ key: "mat_brinepearl", qty: 4 }, { key: "mat_coral", qty: 2 }] });
  b.obj({ id: "cathedral-door", kind: "door", tx: 90, ty: 8, name: "The Cathedral Doors", requires: "key_cathedral", text: "Great doors of green bronze, streaming with seawater that comes from nowhere. A keyhole crusted with barnacles waits — Scylla swallowed the key.", dest: "cathedral" });
  b.obj({ id: "sealed-stair7", kind: "gate", tx: 97, ty: 11, name: "The Stair of Tides", text: "A spiral stair of wet stone climbs into a sky full of spray. Floor 7 is not open to you yet.", dest: "floor7" });

  // --- Enemies --------------------------------------------------------------------------
  b.spawn("t-hounds-a", 118, 128, ["brinehound", "brinehound", "brinehound"], 24, 56);
  b.spawn("t-hounds-b", 138, 118, ["brinehound", "brinehound"], 24);
  b.spawn("t-drowned-a", 130, 132, ["drowned", "drowned"], 24);
  b.spawn("t-siren", 144, 128, ["siren", "drowned"], 25);
  b.spawn("l-drowned", 76, 72, ["drowned", "drowned", "brinehound"], 24, 50);
  b.spawn("l-siren-a", 110, 96, ["siren", "siren"], 25);
  b.spawn("l-guard", 72, 98, ["merrowguard"], 25, 40, 80);
  b.spawn("c-guard-a", 22, 90, ["merrowguard", "siren"], 25);
  b.spawn("c-golem", 38, 70, ["coralgolem"], 26, 30, 90);
  b.spawn("c-hounds", 18, 76, ["brinehound", "brinehound", "brinehound"], 25, 56);
  b.spawn("c-drake", 38, 96, ["seadrake"], 26, 30, 90);
  b.spawn("w-drowned", 150, 72, ["drowned", "drowned", "drowned"], 26, 56);
  b.spawn("w-guard", 160, 92, ["merrowguard", "merrowguard"], 26);
  b.spawn("w-golem", 146, 86, ["coralgolem", "siren"], 26);
  b.spawn("k-drakes", 30, 34, ["seadrake", "seadrake"], 27, 40, 100);
  b.spawn("k-sirens", 50, 44, ["siren", "siren", "merrowguard"], 26);
  b.spawn("k-hounds", 34, 46, ["brinehound", "brinehound", "brinehound"], 26, 56);
  b.spawn("s-golem", 110, 36, ["coralgolem", "merrowguard"], 27);
  b.spawn("s-drake", 124, 44, ["seadrake"], 27, 30, 90);
  b.spawn("scylla", CX, CY, ["scylla"], 27, 10, 600, 0);
  b.spawn("t-guard", 90, 14, ["merrowguard", "siren", "coralgolem"], 28, 40, 80, 0.2);

  b.clearAroundEverything();
  m.spawn = { x: px(43), y: px(130) };
  connectEverything(m, { water: true, ruins: true });
  addInteriors(m, [
    {
      building: "hall6",
      style: "library",
      npcs: [{ id: "tidesage", at: [8, 2] }],
      add: [{ id: "archivist6", name: "Archivist Coralie", role: "archivist", shop: "scrolls6", at: [2, 2], look: { skin: "#d9a77c", cloth: "#2a5a6a", trim: "#f0d890", hair: "#2b2b30", helm: "cap" },
        greeting: "The Tidehall keeps what the sea taught us: waves and whirlpools, and the Leviathan's own call, if anyone lives to bring it back. Marks, please. Salt-dried ones are fine." }],
    },
    { building: "quarter6", style: "shop", npcs: [{ id: "quarter6" }] },
    { building: "forge6", style: "smithy", npcs: [{ id: "pearlsmith" }] },
    { building: "vault6", style: "vault", npcs: [{ id: "vault6" }] },
    { building: "inn6", style: "inn", npcs: [{ id: "innkeep6" }] },
  ]);
  return m;
}
