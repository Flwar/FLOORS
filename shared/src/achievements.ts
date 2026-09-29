/** Achievements: milestones earned from what a character has actually done. */
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
}

export interface AchievementContext {
  kills: number;
  perfects: number;
  parries: number;
  deaths: number;
  discovered: string[];
  bossKills: string[];
  gold: number;
  maxMastery: number;
  level: number;
  floor: number;
}

interface Def extends AchievementDef {
  test: (c: AchievementContext) => boolean;
}

const SECRETS = ["zone:forgotten-shrine", "zone:fox-hollow", "zone:collapsed-library", "zone:crawlers-deep"];
const CHESTS = ["chest:chest-shrine", "chest:chest-foxhollow", "chest:chest-library", "chest:chest-deep", "chest:chest-camp", "chest:chest-den"];
const LORE = ["lore:lore-rim", "lore:lore-scout", "lore:lore-library", "lore:lore-shrine", "lore:lore-cave"];
const WAYSTONES = ["ws:ws-town", "ws:ws-forest", "ws:ws-ruins", "ws:ws-caves"];
const SKY_CHESTS = ["chest:aviary-chest", "chest:causeway-chest", "chest:heights-chest"];
const SKY_WAYSTONES = ["ws:ws-landing", "ws:ws-terraces", "ws:ws-gardens", "ws:ws-causeway", "ws:ws-heights"];
const EMBER_CHESTS = ["chest:hoard-chest", "chest:canyon-chest", "chest:wastes-chest"];
const EMBER_WAYSTONES = ["ws:ws-emberhold", "ws:ws-slopes", "ws:ws-canyon", "ws:ws-wastes", "ws:ws-caldera"];
const FROST_CHESTS = ["chest:cache-chest", "chest:lake-chest", "chest:pine-chest"];
const UMBRAL_CHESTS = ["chest:moonwell-chest", "chest:marsh-chest", "chest:crater-chest"];
const UMBRAL_WAYSTONES = ["ws:ws-duskhollow", "ws:ws-gloaming", "ws:ws-marsh", "ws:ws-moon", "ws:ws-spires"];
const FROST_WAYSTONES = ["ws:ws-rimeholt", "ws:ws-snowfields", "ws:ws-lake", "ws:ws-pinewood", "ws:ws-peak"];
const has = (c: AchievementContext, list: string[]) => list.every((k) => c.discovered.includes(k));

const DEFS: Def[] = [
  { id: "first-blood", name: "First Blood", desc: "Defeat an enemy.", test: (c) => c.kills >= 1 },
  { id: "hunter", name: "Hunter", desc: "Defeat 100 enemies.", test: (c) => c.kills >= 100 },
  { id: "steady-hands", name: "Steady Hands", desc: "Land a perfect parry.", test: (c) => c.perfects >= 1 },
  { id: "blade-reader", name: "Blade Reader", desc: "Land 50 perfect parries.", test: (c) => c.perfects >= 50 },
  { id: "wall-of-steel", name: "Wall of Steel", desc: "Parry 200 attacks.", test: (c) => c.parries >= 200 },
  { id: "explorer", name: "Explorer", desc: "Find every secret area on Floor 1.", test: (c) => has(c, SECRETS) },
  { id: "treasure-hunter", name: "Treasure Hunter", desc: "Open every hidden chest on Floor 1.", test: (c) => has(c, CHESTS) },
  { id: "scholar", name: "Loremaster", desc: "Read every inscription on Floor 1.", test: (c) => has(c, LORE) },
  { id: "well-travelled", name: "Well Travelled", desc: "Attune every waystone on Floor 1.", test: (c) => has(c, WAYSTONES) },
  { id: "bandit-bane", name: "Bandit Bane", desc: "Defeat Grakk, the Bandit King.", test: (c) => c.bossKills.includes("grakk") },
  { id: "wardens-end", name: "Warden's End", desc: "Defeat the Undercroft Warden.", test: (c) => c.bossKills.includes("warden") },
  { id: "first-gate", name: "The First Gate", desc: "Defeat Aurelion and open the way to Floor 2.", test: (c) => c.bossKills.includes("aurelion") },
  // Floor 2
  { id: "skyreach", name: "Above the Clouds", desc: "Set foot on Floor 2.", test: (c) => c.discovered.includes("zone:skyreach") || c.discovered.includes("zone:gilded-terraces") },
  { id: "hidden-aviary", name: "Where the Birds Go", desc: "Find the Hidden Aviary on Floor 2.", test: (c) => c.discovered.includes("zone:hidden-aviary") },
  { id: "sky-treasure", name: "Sky Plunder", desc: "Open every chest on Floor 2.", test: (c) => has(c, SKY_CHESTS) },
  { id: "sky-roads", name: "Skyward Roads", desc: "Attune every waystone on Floor 2.", test: (c) => has(c, SKY_WAYSTONES) },
  { id: "thunder-breaker", name: "Thunder Breaker", desc: "Topple the Storm Colossus.", test: (c) => c.bossKills.includes("colossus") },
  { id: "last-watch", name: "The Last Watch", desc: "Defeat Kael, the Stormwarden.", test: (c) => c.bossKills.includes("stormwarden") },
  { id: "storm-breaks", name: "The Storm Breaks", desc: "Defeat Vaelra, Keeper of the Storm.", test: (c) => c.bossKills.includes("vaelra") },
  // Floor 3
  { id: "ember-reaches", name: "Into the Fire", desc: "Set foot on Floor 3.", test: (c) => c.discovered.includes("zone:ember-reaches") },
  { id: "dragons-hoard", name: "Hoard Finder", desc: "Find the Dragon's Hoard on Floor 3.", test: (c) => c.discovered.includes("zone:dragons-hoard") },
  { id: "ember-treasure", name: "Scorched Plunder", desc: "Open every chest on Floor 3.", test: (c) => has(c, EMBER_CHESTS) },
  { id: "ember-roads", name: "Ashen Roads", desc: "Attune every waystone on Floor 3.", test: (c) => has(c, EMBER_WAYSTONES) },
  { id: "red-wyrm", name: "Wyrmslayer", desc: "Defeat Cindermaw, the Red Wyrm.", test: (c) => c.bossKills.includes("cindermaw") },
  { id: "dragonsworn", name: "Oathbreaker", desc: "Defeat Vyrmak the Dragonsworn.", test: (c) => c.bossKills.includes("vyrmak") },
  { id: "tyrant", name: "The Tyrant Falls", desc: "Defeat Ignivar, Tyrant of the Ember Sky.", test: (c) => c.bossKills.includes("ignivar") },
  // Floor 4
  { id: "frostvale", name: "Out of the Fire", desc: "Set foot on Floor 4.", test: (c) => c.discovered.includes("zone:frostvale") },
  { id: "hunters-cache", name: "Lost and Found", desc: "Find the Hunters' Cache on Floor 4.", test: (c) => c.discovered.includes("zone:hunters-cache") },
  { id: "frost-treasure", name: "Frozen Plunder", desc: "Open every chest on Floor 4.", test: (c) => has(c, FROST_CHESTS) },
  { id: "frost-roads", name: "Snowbound Roads", desc: "Attune every waystone on Floor 4.", test: (c) => has(c, FROST_WAYSTONES) },
  { id: "white-wyrm", name: "Whitefang", desc: "Defeat Glacierfang, the White Wyrm.", test: (c) => c.bossKills.includes("glacierfang") },
  { id: "giant", name: "Giantfeller", desc: "Defeat Jarnhild the Frost Giant.", test: (c) => c.bossKills.includes("jarnhild") },
  { id: "winter-breaks", name: "Winter Breaks", desc: "Defeat Hrimthar, the Winter King.", test: (c) => c.bossKills.includes("hrimthar") },
  { id: "veteran", name: "Veteran", desc: "Reach level 16.", test: (c) => c.level >= 16 },
  // Floor 5
  { id: "umbral", name: "Into the Dark", desc: "Set foot on Floor 5.", test: (c) => c.discovered.includes("zone:umbral-wilds") },
  { id: "moonwell", name: "Moonlight Remembered", desc: "Find the Moonwell on Floor 5.", test: (c) => c.discovered.includes("zone:moonwell") },
  { id: "umbral-treasure", name: "Plunder in the Dark", desc: "Open every chest on Floor 5.", test: (c) => has(c, UMBRAL_CHESTS) },
  { id: "umbral-roads", name: "Lantern Roads", desc: "Attune every waystone on Floor 5.", test: (c) => has(c, UMBRAL_WAYSTONES) },
  { id: "void-wyrm", name: "Wyrm of the Void", desc: "Defeat Nightwing, the Void Wyrm.", test: (c) => c.bossKills.includes("nightwing") },
  { id: "hollow-knight", name: "Hollowed Out", desc: "Defeat Maelgrim, the Hollow Knight.", test: (c) => c.bossKills.includes("maelgrim") },
  { id: "dawn-returns", name: "The Dawn Returns", desc: "Defeat Nyxara, Queen of the Void.", test: (c) => c.bossKills.includes("nyxara") },
  { id: "champion", name: "Champion of the Tower", desc: "Reach level 24.", test: (c) => c.level >= 24 },
  { id: "master-of-arms", name: "Master of Arms", desc: "Reach mastery 10 with a weapon.", test: (c) => c.maxMastery >= 10 },
  { id: "seasoned", name: "Seasoned", desc: "Reach level 8.", test: (c) => c.level >= 8 },
  { id: "hoarder", name: "Deep Pockets", desc: "Carry 1,000 gold.", test: (c) => c.gold >= 1000 },
];

export const ACHIEVEMENTS: AchievementDef[] = DEFS.map(({ id, name, desc }) => ({ id, name, desc }));

/** Achievements newly satisfied (not yet in `earned`). */
export function newAchievements(c: AchievementContext, earned: string[]): AchievementDef[] {
  return DEFS.filter((d) => !earned.includes(d.id) && d.test(c)).map(({ id, name, desc }) => ({ id, name, desc }));
}
