import { addInteriors } from "./interiors.ts";
import { connectEverything, hash, isleBuilder, noise, px } from "./isles.ts";
import { Tile, WorldMap } from "./map.ts";

/** Sunwell's streets: the town's safe rectangle. */
export const SUNWELL = { x0: 62, y0: 112, x1: 118, y1: 146 };

/**
 * Floor 8 — the Sunscorched Sands: desert isles under a sun that never sets, and the tombs of
 * the kings who worshipped it. The ground is sand, the water is oasis-green, the trees are
 * palms, the rocks are sandstone, and the crystals are obelisks and shards of desert glass
 * (the renderer paints them so).
 *   Sunwell (south, safe) → the Dune Sea (centre), the Scorpion Canyons (south-west), the
 *   Glass Flats (west, with the hidden Mirage Oasis beyond), the Sunken Colossus (east), the
 *   Sunspire Heights (north, Sandmaw's lair) → the Sun Pyramid (the floor's dungeon).
 */
export function buildFloor8(): WorldMap {
  const W = 180;
  const H = 150;
  const m = new WorldMap(W, H);
  m.name = "Floor 8 — The Sunscorched Sands";
  m.theme = "sand";
  m.fill(0, 0, W, H, Tile.Void);
  const b = isleBuilder(m);

  // --- Islands ---------------------------------------------------------------------------
  b.island(90, 129, 28, 15, 151); // Sunwell
  b.island(90, 86, 36, 20, 152); // the Dune Sea
  b.island(46, 132, 24, 12, 153); // the Scorpion Canyons
  b.island(34, 92, 21, 20, 154); // the Glass Flats
  b.island(11, 50, 8, 7, 155); // the Mirage Oasis (secret)
  b.island(152, 82, 21, 21, 156); // the Sunken Colossus
  b.island(92, 38, 44, 14, 157); // the Sunspire Heights
  b.island(90, 11, 11, 7, 158); // the Sun Pyramid

  // --- Causeways of old sandstone over the drop --------------------------------------------
  b.bridge(90, 115, 90, 104, 2, Tile.StoneFloor);
  b.bridge(114, 118, 140, 98, 1, Tile.StoneFloor);
  b.bridge(56, 92, 60, 90, 1, Tile.StoneFloor);
  b.bridge(68, 104, 56, 124, 1, Tile.StoneFloor);
  b.bridge(124, 84, 134, 82, 1, Tile.StoneFloor);
  b.bridge(90, 68, 90, 51, 2, Tile.StoneFloor);
  b.bridge(90, 24, 90, 17, 2, Tile.StoneFloor);
  // The Mirage's way in: a buried road behind the Glass Flats' northern rocks.
  b.bridge(22, 74, 13, 56, 1, Tile.StoneFloor);

  // --- Sunwell (town) ---------------------------------------------------------------------
  const T = SUNWELL;
  b.protectRect(T);
  m.fill(70, 120, 110, 139, Tile.Cobble);
  b.house("hall8", "The Hall of the Sun", 85, 116, 10, 4);
  b.house("quarter8", "The Bazaar", 71, 121, 6, 4);
  b.house("forge8", "The Sunforge", 103, 121, 6, 4);
  b.house("vault8", "The Cistern Vault", 72, 131, 5, 3);
  b.house("inn8", "The Cool Well", 101, 131, 7, 4);
  for (const [x, y] of [[76, 123], [98, 123], [76, 134], [98, 134], [88, 139]] as const) m.prop("lamp", x, y);
  m.prop("sacks", 77, 129);
  m.prop("sacks", 77, 130);
  m.prop("barrel", 98, 129);
  m.prop("crates", 98, 130);
  m.prop("anvil", 106, 126);
  m.prop("rack", 109, 126);
  m.prop("cart", 83, 136, 2, 1);
  m.prop("stall", 84, 127, 2, 1);
  m.prop("stall", 93, 127, 2, 1);
  m.prop("well", 88, 131, 2, 2);
  for (const [x, y] of [[81, 131], [96, 131], [81, 125], [96, 125]] as const) m.prop("planter", x, y);

  // --- The Dune Sea -----------------------------------------------------------------------
  b.bridge(90, 104, 90, 68, 1, Tile.Path);
  b.bridge(90, 88, 58, 90, 1, Tile.Path);
  b.bridge(90, 86, 124, 84, 1, Tile.Path);
  b.bridge(80, 96, 68, 104, 1, Tile.Path);
  // Dunes in long ridges, and sandstone breaking through them.
  b.scatter(54, 66, 126, 108, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const ridge = Math.sin(x * 0.28 + noise(x, y, 9, 159) * 4);
    const n = noise(x, y, 6, 160);
    return n > 0.78 ? Tile.Rock : ridge > 0.35 ? Tile.Sand : undefined;
  });

  // --- The Scorpion Canyons ---------------------------------------------------------------
  b.bridge(56, 124, 46, 132, 1, Tile.Path);
  b.bridge(46, 132, 28, 134, 1, Tile.Path);
  b.bridge(46, 132, 58, 140, 1, Tile.Path);
  b.scatter(22, 120, 70, 144, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 4, 161);
    return n > 0.62 ? Tile.Rock : n < 0.34 ? Tile.Sand : undefined;
  });

  // --- The Glass Flats --------------------------------------------------------------------
  b.bridge(56, 92, 34, 92, 1, Tile.Path);
  b.bridge(34, 92, 34, 110, 1, Tile.Path);
  b.bridge(34, 92, 24, 76, 1, Tile.Path);
  b.bridge(24, 76, 22, 74, 1, Tile.Path);
  // Sand the sun melted into glass: shards stand up out of the flats.
  b.scatter(13, 72, 55, 112, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 5, 162);
    // (Scattered, not a forest: most of the melted ground is open glass-sand.)
    if (n > 0.66) return hash(x, y, 170) < 0.28 ? Tile.Crystal : hash(x, y, 171) < 0.12 ? Tile.Rock : Tile.Sand;
    return n < 0.3 ? Tile.StoneFloor : n < 0.42 ? Tile.Sand : undefined;
  });
  // Rocks hide the buried road to the Mirage.
  for (const [x, y] of [[20, 72], [21, 71], [24, 72], [25, 73]] as const) if (b.open(x, y)) m.set(x, y, Tile.Rock);
  // The Mirage Oasis: green water under palms, where there shouldn't be anything at all.
  b.pool(11, 49, 3, 2, 163);
  b.scatter(4, 44, 18, 56, (x, y, t) => (t === Tile.Grass && hash(x, y, 164) < 0.1 ? Tile.Tree : undefined));

  // --- The Sunken Colossus ----------------------------------------------------------------
  b.bridge(134, 82, 152, 82, 1, Tile.Path);
  b.bridge(152, 82, 152, 64, 1, Tile.Path);
  b.bridge(152, 82, 160, 98, 1, Tile.Path);
  b.bridge(152, 72, 166, 70, 1, Tile.Path);
  // The fallen statue: a long body of sandstone blocks, an outflung arm, a face in the sand.
  for (let x = 140; x < 168; x++) for (const y of [77, 78]) if (b.open(x, y) && hash(x, y, 165) < 0.8) m.set(x, y, Tile.RuinWall);
  for (let y = 66; y < 77; y++) if (b.open(145, y) && hash(145, y, 166) < 0.85) m.set(145, y, Tile.RuinWall);
  b.scatter(132, 62, 174, 102, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 5, 167);
    return n > 0.74 ? Tile.RuinWall : n < 0.36 ? Tile.Sand : n < 0.44 ? Tile.StoneFloor : undefined;
  });

  // --- The Sunspire Heights ---------------------------------------------------------------
  b.bridge(90, 51, 90, 25, 1, Tile.StoneFloor);
  b.bridge(90, 38, 116, 36, 1, Tile.StoneFloor);
  b.bridge(90, 36, 60, 36, 1, Tile.StoneFloor);
  const CX = 122;
  const CY = 36;
  b.arena(CX, CY, 10, 8, Tile.Sand);
  // Sunspires: needles of rock, and obelisks in a line along the old processional way.
  for (let x = 56; x < 118; x += 6) for (const y of [32, 41]) if (b.open(x, y)) m.set(x, y, Tile.Crystal);
  b.scatter(48, 24, 136, 52, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 5, 168);
    return n > 0.72 ? Tile.Rock : n < 0.32 ? Tile.Sand : undefined;
  });

  // --- The Sun Pyramid (approach) ---------------------------------------------------------
  b.scatter(80, 5, 100, 17, () => Tile.StoneFloor);
  for (const [x, y] of [[83, 7], [97, 7], [83, 13], [97, 13]]) m.set(x, y, Tile.Crystal);

  // --- Palms at the edges of things, and dry scrub; then the rim --------------------------
  b.vegetate(0.02, 0.04, 169);
  b.rim();

  // --- Zones ------------------------------------------------------------------------------
  m.zones.push({ id: "sunscorched-sands", name: "The Sunscorched Sands", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [32, 34], music: "sands" });
  m.zones.push({ id: "dune-sea", name: "The Dune Sea", safe: false, x0: 54, y0: 66, x1: 126, y1: 110, level: [32, 33], music: "sands" });
  m.zones.push({ id: "scorpion-canyons", name: "The Scorpion Canyons", safe: false, x0: 20, y0: 118, x1: 72, y1: 146, level: [32, 33], music: "sands" });
  m.zones.push({ id: "glass-flats", name: "The Glass Flats", safe: false, x0: 11, y0: 70, x1: 57, y1: 114, level: [33, 34], music: "sands" });
  m.zones.push({ id: "sunken-colossus", name: "The Sunken Colossus", safe: false, x0: 130, y0: 60, x1: 176, y1: 104, level: [34, 35], music: "sands" });
  m.zones.push({ id: "sunspire-heights", name: "The Sunspire Heights", safe: false, x0: 46, y0: 22, x1: 138, y1: 54, level: [34, 35], music: "pyramid" });
  m.zones.push({ id: "sandmaw-lair", name: "Sandmaw's Hollow", safe: false, x0: 110, y0: 26, x1: 135, y1: 46, level: [35, 35], music: "pyramid" });
  m.zones.push({ id: "sun-pyramid", name: "The Sun Pyramid", safe: false, x0: 76, y0: 0, x1: 104, y1: 20, level: [35, 36], music: "pyramid" });
  m.zones.push({ id: "mirage-oasis", name: "The Mirage Oasis", safe: false, x0: 0, y0: 40, x1: 20, y1: 58, secret: true });
  m.zones.push({ id: "sunwell", name: "Sunwell", safe: true, ...T, music: "sunwell" });

  // --- People -----------------------------------------------------------------------------
  b.npc("vizier", "Vizier Amara", "guild", 90, 124, { skin: "#a8744f", cloth: "#e8d8a8", trim: "#e8c040", hair: "#1e1a1a", helm: "hood" },
    "Welcome to Sunwell, climber. Drink first — everyone who comes up those stairs forgets to. Then we'll talk about the sun.");
  b.npc("quarter8", "Zahir the Trader", "store", 74, 126, { skin: "#8a5a3a", cloth: "#6a3a5a", trim: "#f0c860", hair: "#1e1a1a", helm: "cap" },
    "Water, tonics, maps, silk. Everything up here costs more than it should, friend, and I'm the only one honest enough to say so.", "store8");
  b.npc("sunsmith", "Tamsin of the Sunforge", "smith", 106, 126, { skin: "#c98f65", cloth: "#5a3a2a", trim: "#ffb030", hair: "#e8c867" },
    "The Sunforge doesn't need coal. We work sunstone in the heat of the day and let the light do the rest. Bring me scarab shells and I'll make you something that shines.", "smith8");
  b.npc("vault8", "Keeper Idris", "storage", 74, 135, { skin: "#6a4a3a", cloth: "#2a4a5a", trim: "#c9a24a", hair: "#e8e0d0" },
    "The cisterns are the coolest place on the floor, and the safest. Water and gold both keep better underground.");
  b.npc("innkeep8", "Old Yusra", "inn", 104, 136, { skin: "#a8744f", cloth: "#7a4a2a", trim: "#e8d8b0", hair: "#e8e0d0", helm: "hood" },
    "Sit in the shade, child. The Cool Well is the only place under this sky where nobody's in a hurry.");
  b.npc("astronomer", "The Star-Reader", "lore", 86, 134, { skin: "#8a5a3a", cloth: "#1e2a4a", trim: "#f0d890", hair: "#e8e0d0", helm: "hood" },
    "The sun has not set here for a thousand years. I still watch the sky. One day there will be stars, and someone should be ready to read them.");
  b.npc("caravan8", "Sella the Wanderer", "merchant", 93, 137, { skin: "#c79a74", cloth: "#7a3a5a", trim: "#f0c860", hair: "#2b2b30", helm: "hood" },
    "Sand in the wheels, sand in the wares, sand in my teeth. Buy something before it all turns into sand.");
  b.board("board8", 96, 124);

  // --- Places -----------------------------------------------------------------------------
  b.obj({ id: "descent8", kind: "gate", tx: 90, ty: 141, name: "The Descent", text: "The tick of a thousand gears drifts up the stairs from the Clockwork Heights.", dest: "floor7" });
  b.obj({ id: "ws-sunwell", kind: "waystone", tx: 95, ty: 131, name: "Sunwell Waystone" });
  b.obj({ id: "ws-dunes", kind: "waystone", tx: 93, ty: 86, name: "Dune Sea Waystone" });
  b.obj({ id: "ws-glass", kind: "waystone", tx: 37, ty: 92, name: "Glass Flats Waystone" });
  b.obj({ id: "ws-colossus", kind: "waystone", tx: 152, ty: 85, name: "Colossus Waystone" });
  b.obj({ id: "ws-sunspire", kind: "waystone", tx: 86, ty: 40, name: "Sunspire Waystone" });
  b.obj({ id: "buried-sun", kind: "lore", tx: 86, ty: 80, name: "The Buried Sun", text: "A disc of beaten gold as wide as a house, half sunk in a dune. It is hot to the touch — hotter than the sand around it — and it hums." });
  b.obj({ id: "glass-garden", kind: "lore", tx: 28, ty: 86, name: "The Glass Garden", text: "The sand here was melted into glass so fast it caught the shapes of people running. Whatever the sun did, it did it in a single noon." });
  b.obj({ id: "colossus-face", kind: "lore", tx: 158, ty: 72, name: "The Colossus's Face", text: "A stone face as big as a hall, lying on its cheek in the sand. Someone carved into its brow: HE WANTED IT TO BE NOON FOREVER. IT IS." });
  b.obj({ id: "canyon-bones", kind: "lore", tx: 40, ty: 138, name: "The Caravan's End", text: "A caravan's bones, picked white by jackals, and a water-skin with one line stitched on it: THE WELLS ARE LYING." });
  b.obj({ id: "kings-edict", kind: "lore", tx: 104, ty: 32, name: "The King's Edict", text: "An edict carved on a sunspire: BY ORDER OF SOLKARIS, THE SUN SHALL NOT SET. THE NIGHT IS EXILED. THE STARS ARE FORBIDDEN." });
  b.obj({ id: "mirage-journal", kind: "lore", tx: 9, ty: 47, name: "The Mapmaker's Journal", text: "\"Every map says there's nothing out here. Every map is wrong. The water is real. I drank it. I'm staying.\"" });
  b.obj({ id: "mirage-chest", kind: "chest", tx: 14, ty: 53, name: "The Mapmaker's Cache", gold: 1040, loot: [{ key: "mat_solarheart", qty: 2 }, { key: "mat_scarab", qty: 4 }, { key: "charm_scarab", rarity: 3 }] });
  b.obj({ id: "canyon-chest", kind: "chest", tx: 28, ty: 134, name: "Caravan Strongbox", gold: 420, loot: [{ key: "mat_sunstone", qty: 4 }, { key: "tonic", qty: 2 }] });
  b.obj({ id: "colossus-chest", kind: "chest", tx: 166, ty: 66, name: "Offering Urn", gold: 440, loot: [{ key: "mat_scarab", qty: 4 }, { key: "mat_sunstone", qty: 2 }] });
  b.obj({ id: "pyramid-door", kind: "door", tx: 90, ty: 8, name: "The Pyramid Door", requires: "key_pyramid", text: "A slab of gold-faced stone with a round hollow at its centre, shaped like a sun. It will open for the Solar Seal.", dest: "pyramid" });
  b.obj({ id: "sealed-stair9", kind: "gate", tx: 97, ty: 11, name: "The Stair of Stars", text: "A stair of dark stone, cold even here, climbing into a patch of night sky. Floor 9 is not open to you yet.", dest: "floor9" });

  // --- Enemies ----------------------------------------------------------------------------
  b.spawn("d-jackals-a", 76, 94, ["sandjackal", "sandjackal", "sandjackal"], 32, 56);
  b.spawn("d-wraiths", 104, 90, ["sandwraith", "sunpriest"], 32);
  b.spawn("d-priests", 96, 76, ["sunpriest", "sandjackal"], 33);
  b.spawn("d-golem", 70, 82, ["sandgolem"], 33, 30, 90);
  b.spawn("c-jackals", 40, 128, ["sandjackal", "sandjackal"], 32, 56);
  b.spawn("c-guards", 56, 138, ["tombguard", "tombguard"], 33);
  b.spawn("c-wraith", 34, 140, ["sandwraith", "sandjackal"], 33);
  b.spawn("g-priests", 22, 96, ["sunpriest", "sunpriest"], 33);
  b.spawn("g-golem", 40, 104, ["sandgolem", "sandwraith"], 34);
  b.spawn("g-drake", 26, 110, ["sundrake"], 34, 30, 90);
  b.spawn("k-drakes", 150, 64, ["sundrake", "sundrake"], 35, 40, 100);
  b.spawn("k-guards", 162, 86, ["tombguard", "tombguard", "sunpriest"], 34);
  b.spawn("k-golem", 144, 90, ["sandgolem", "tombguard"], 34);
  b.spawn("s-golem", 104, 44, ["sandgolem", "tombguard"], 35);
  b.spawn("s-priests", 70, 30, ["sunpriest", "sunpriest", "sandwraith"], 35);
  b.spawn("s-drake", 64, 44, ["sundrake"], 35, 30, 90);
  b.spawn("sandmaw", CX, CY, ["sandmaw"], 35, 10, 600, 0);
  b.spawn("p-guard", 90, 14, ["tombguard", "sunpriest", "sandgolem"], 36, 40, 80, 0.2);

  b.clearAroundEverything();
  m.spawn = { x: px(90), y: px(130) };
  connectEverything(m, { water: true, ruins: true });
  addInteriors(m, [
    {
      building: "hall8",
      style: "library",
      npcs: [{ id: "astronomer", at: [8, 2] }],
      add: [{ id: "archivist8", name: "Archivist Nadir", role: "archivist", shop: "scrolls8", at: [2, 2], look: { skin: "#8a5a3a", cloth: "#e8d8a8", trim: "#e8c040", hair: "#1e1a1a", helm: "hood" },
        greeting: "The Hall keeps the arts of the sun: sunbolts and sandstorms, the scarab's shell, and the Pharaoh's own noon, if anyone ever takes it from him. Marks, please. The sand is free." }],
    },
    { building: "quarter8", style: "shop", npcs: [{ id: "quarter8" }] },
    { building: "forge8", style: "smithy", npcs: [{ id: "sunsmith" }] },
    { building: "vault8", style: "vault", npcs: [{ id: "vault8" }] },
    { building: "inn8", style: "inn", npcs: [{ id: "innkeep8" }] },
  ]);
  return m;
}
