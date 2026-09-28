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
  { id: "master-of-arms", name: "Master of Arms", desc: "Reach mastery 10 with a weapon.", test: (c) => c.maxMastery >= 10 },
  { id: "seasoned", name: "Seasoned", desc: "Reach level 8.", test: (c) => c.level >= 8 },
  { id: "hoarder", name: "Deep Pockets", desc: "Carry 1,000 gold.", test: (c) => c.gold >= 1000 },
];

export const ACHIEVEMENTS: AchievementDef[] = DEFS.map(({ id, name, desc }) => ({ id, name, desc }));

/** Achievements newly satisfied (not yet in `earned`). */
export function newAchievements(c: AchievementContext, earned: string[]): AchievementDef[] {
  return DEFS.filter((d) => !earned.includes(d.id) && d.test(c)).map(({ id, name, desc }) => ({ id, name, desc }));
}
