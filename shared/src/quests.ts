export type QuestStage =
  | { kind: "talk"; npc: string; text: string }
  | { kind: "kill"; enemy: string[]; count: number; text: string }
  | { kind: "collect"; item: string; count: number; text: string; consume?: boolean }
  | { kind: "interact"; objects: string[]; text: string }
  | { kind: "parry"; count: number; text: string }
  | { kind: "visit"; zone: string; text: string }
  | { kind: "dungeon"; text: string };

export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  /** Shown when offered. */
  pitch: string;
  /** Shown when handed in. */
  thanks: string;
  requires?: string;
  stages: QuestStage[];
  rewards: { xp: number; gold: number; items?: { key: string; rarity?: number; qty?: number }[]; unlockFloor?: number };
  main?: boolean;
}

export const QUESTS: QuestDef[] = [
  {
    id: "q_welcome",
    name: "First Steps",
    giver: "guildmaster",
    main: true,
    pitch: "Before you walk out that gate, show me you can read a blade. The Sparring Knight in the yard swings slow and honest. Parry him three times — press Q just before his strike lands. Gold glint: parry it. Red glint: get out of the way.",
    thanks: "Good hands. Out there, nothing swings that honestly. Take these tonics — drink them with R, and choose your moment.",
    stages: [
      { kind: "parry", count: 3, text: "Parry the Sparring Knight 3 times" },
      { kind: "talk", npc: "guildmaster", text: "Report to Guildmaster Rhea" },
    ],
    rewards: { xp: 40, gold: 20, items: [{ key: "tonic", qty: 2 }] },
  },
  {
    id: "q_wolves",
    name: "Howls at the Door",
    giver: "guildmaster",
    main: true,
    requires: "q_welcome",
    pitch: "The wolves have grown bold since something woke under the ruins. Thin the packs in the fields, then find their alpha — its den is north-west in Whisperwood. Wolves circle and wait for an opening. Don't give them one.",
    thanks: "The farmers will sleep tonight. That fang is yours — it steadies the breath.",
    stages: [
      { kind: "kill", enemy: ["wolf"], count: 6, text: "Hunt grey wolves" },
      { kind: "kill", enemy: ["alpha"], count: 1, text: "Slay the Alpha Wolf in its den (Whisperwood, north-west)" },
      { kind: "talk", npc: "guildmaster", text: "Return to Guildmaster Rhea" },
    ],
    rewards: { xp: 150, gold: 60, items: [{ key: "charm_wolf", rarity: 1 }] },
  },
  {
    id: "q_scouts",
    name: "Missing Scouts",
    giver: "guildmaster",
    main: true,
    requires: "q_wolves",
    pitch: "I sent two scouts toward the bandit camp in the north-east of Whisperwood. Neither came back. Find out what happened to them.",
    thanks: "A key from the ruins, worn by their king... So Grakk found a way into the Undercroft. That changes everything.",
    stages: [
      { kind: "interact", objects: ["lore-scout"], text: "Search the woods near the bandit camp for the scouts" },
      { kind: "talk", npc: "guildmaster", text: "Tell Guildmaster Rhea what you found" },
    ],
    rewards: { xp: 120, gold: 40 },
  },
  {
    id: "q_grakk",
    name: "The Bandit King",
    giver: "guildmaster",
    main: true,
    requires: "q_scouts",
    pitch: "Grakk holds the key to the sealed Undercroft door in the Sunken Ruins. Take it from him. He's strong, and he fights with his whole gang — when he roars, more will come.",
    thanks: "You beat Grakk? Then the key is yours. The Undercroft door waits in the ruins' court, east of here.",
    stages: [
      { kind: "kill", enemy: ["grakk"], count: 1, text: "Defeat Grakk, the Bandit King (Grakk's Camp)" },
      { kind: "talk", npc: "guildmaster", text: "Return to Guildmaster Rhea" },
    ],
    rewards: { xp: 300, gold: 120 },
  },
  {
    id: "q_undercroft",
    name: "Beneath the Ruins",
    giver: "guildmaster",
    main: true,
    requires: "q_grakk",
    pitch: "Use the key. Beneath the ruins waits a Warden, and past it — if the old tablets are right — the Keeper of the First Gate. Take friends. Rest at the braziers.",
    thanks: "The Warden has fallen. Only the Keeper remains between us and the Floor above.",
    stages: [
      { kind: "dungeon", text: "Unseal the Undercroft (Sunken Ruins court)" },
      { kind: "kill", enemy: ["warden"], count: 1, text: "Defeat the Undercroft Warden" },
      { kind: "talk", npc: "guildmaster", text: "Return to Guildmaster Rhea" },
    ],
    rewards: { xp: 500, gold: 150, items: [{ key: "tonic", qty: 3 }] },
  },
  {
    id: "q_keeper",
    name: "The First Gate",
    giver: "guildmaster",
    main: true,
    requires: "q_undercroft",
    pitch: "Aurelion, the Keeper, guards the way up. Learn him. Parry the thrust at the instant of light. Stand in the glyphs when he passes judgement. And then — climb.",
    thanks: "The Ascent Gate is open. There's a whole world above us. Go and see it — then come back and tell me.",
    stages: [
      { kind: "kill", enemy: ["aurelion"], count: 1, text: "Defeat Aurelion, Keeper of the First Gate" },
      { kind: "talk", npc: "warden", text: "Tell Gate Warden Eld the Keeper has fallen" },
    ],
    rewards: { xp: 1000, gold: 400, unlockFloor: 2 },
  },
  {
    id: "q_pelts",
    name: "Tanner's Request",
    giver: "tanner",
    pitch: "Five wolf pelts. Good ones. I'll pay, and I'll throw in a jerkin that'll actually stop a bite.",
    thanks: "Beautiful. Here — wear it well.",
    stages: [{ kind: "collect", item: "mat_pelt", count: 5, consume: true, text: "Bring Hask 5 Wolf Pelts" }],
    rewards: { xp: 80, gold: 60, items: [{ key: "armor_leather", rarity: 1 }] },
  },
  {
    id: "q_scrap",
    name: "Metal for the Forge",
    giver: "smith",
    pitch: "Goblins and brutes carry scrap. Bring me six pieces and I'll forge you something worth swinging.",
    thanks: "Good iron hides in bad hands. Here's a blade to prove it.",
    stages: [{ kind: "collect", item: "mat_scrap", count: 6, consume: true, text: "Bring Borin 6 Iron Scrap" }],
    rewards: { xp: 90, gold: 40, items: [{ key: "sword_iron", rarity: 1 }] },
  },
  {
    id: "q_echoes",
    name: "Echoes in Stone",
    giver: "scholar",
    pitch: "There are carvings older than the town. A shrine hidden in the far north-west of Whisperwood, and a library somewhere in the ruins that nobody can find. Read them for me.",
    thanks: "\"Wait,\" and \"the instant of light\"... They were teaching people to parry the Keeper. Take this — it'll carry you further when you dodge.",
    stages: [
      { kind: "interact", objects: ["lore-shrine"], text: "Find the hidden shrine in Whisperwood" },
      { kind: "interact", objects: ["lore-library"], text: "Find the lost library in the Sunken Ruins" },
      { kind: "talk", npc: "scholar", text: "Return to Scholar Ione" },
    ],
    rewards: { xp: 260, gold: 80, items: [{ key: "charm_gale", rarity: 2 }] },
  },
  {
    id: "q_cult",
    name: "The Hollow Faith",
    giver: "scholar",
    requires: "q_echoes",
    pitch: "The cultists pray toward the caves. Break their numbers and find out what they're praying to.",
    thanks: "Something big moving in the deep... and they worship it. Stay away from Crawler's Deep unless you're ready.",
    stages: [
      { kind: "kill", enemy: ["cultist"], count: 8, text: "Defeat Hollow Cultists" },
      { kind: "visit", zone: "hollow-caves", text: "Enter the Hollow Caves" },
      { kind: "talk", npc: "scholar", text: "Return to Scholar Ione" },
    ],
    rewards: { xp: 280, gold: 90, items: [{ key: "tonic", qty: 3 }] },
  },
];

export const questDef = (id: string) => QUESTS.find((q) => q.id === id);
