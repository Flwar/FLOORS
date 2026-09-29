export type QuestStage =
  | { kind: "talk"; npc: string; text: string }
  | { kind: "kill"; enemy: string[]; count: number; text: string }
  | { kind: "collect"; item: string; count: number; text: string; consume?: boolean }
  | { kind: "interact"; objects: string[]; text: string }
  | { kind: "parry"; count: number; text: string }
  | { kind: "visit"; zone: string; text: string }
  /** Enter a boss dungeon; `dungeon` is its room kind ("dungeon" is the Undercroft). */
  | { kind: "dungeon"; text: string; dungeon: string };

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
  /** Marks default to 4 for main-story quests and 2 for the rest. */
  rewards: { xp: number; gold: number; marks?: number; items?: { key: string; rarity?: number; qty?: number }[]; unlockFloor?: number };
  main?: boolean;
  /** A repeatable mission from a town's Mission Board: it can be taken again after MISSION_COOLDOWN_MS. */
  mission?: boolean;
  /** The floor the quest's giver is on (default 1). */
  floor?: number;
}

/**
 * Can this quest be taken? It needs its prerequisite, unless it belongs to a higher floor
 * that is already open to you: floors open for everyone, so a floor's story starts there
 * whatever you left unfinished below.
 */
export function questOpen(q: QuestDef, done: (id: string) => boolean, floor: number) {
  if (!q.requires || done(q.requires)) return true;
  const qf = q.floor ?? 1;
  const rf = QUESTS.find((x) => x.id === q.requires)?.floor ?? 1;
  return qf > rf && floor >= qf;
}

/** A finished mission goes back on the board after this long. */
export const MISSION_COOLDOWN_MS = 15 * 60 * 1000;

/** Marks a quest pays: the currency the Archivists take for skill scrolls. */
export const questMarks = (q: QuestDef) => q.rewards.marks ?? (q.main ? 4 : 2);

/** Is a mission on the board for this character (never taken, or finished and cooled down)? */
export function missionReady(st: { done?: boolean; at?: number } | undefined, now: number) {
  return !st || (!!st.done && now - (st.at ?? 0) >= MISSION_COOLDOWN_MS);
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
    rewards: { xp: 40, gold: 20, items: [{ key: "tonic", qty: 2 }, { key: "scroll_any_kick" }] },
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
      { kind: "dungeon", dungeon: "dungeon", text: "Unseal the Undercroft (Sunken Ruins court)" },
      { kind: "kill", enemy: ["warden"], count: 1, text: "Defeat the Undercroft Warden" },
      { kind: "talk", npc: "guildmaster", text: "Return to Guildmaster Rhea" },
    ],
    rewards: { xp: 500, gold: 150, items: [{ key: "tonic", qty: 3 }, { key: "scroll_any_blink" }] },
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
    rewards: { xp: 1000, gold: 400, unlockFloor: 2, marks: 6, items: [{ key: "scroll_any_ironwill" }] },
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
  // --- Floor 2: the Gilded Terraces ------------------------------------------------------
  {
    id: "f2_arrival",
    name: "Above the Clouds",
    giver: "herald",
    main: true,
    floor: 2,
    requires: "q_keeper",
    pitch: "Welcome to the Gilded Terraces. Before anything else, learn how this floor fights. The sky lynxes hunt the terraces in prides — thin them, and you'll understand why nobody walks alone up here.",
    thanks: "You move like someone who's done this before. Good. The Causeway is next.",
    stages: [
      { kind: "visit", zone: "gilded-terraces", text: "Walk out onto the Gilded Terraces" },
      { kind: "kill", enemy: ["skylynx"], count: 6, text: "Hunt sky lynxes on the terraces" },
      { kind: "talk", npc: "herald", text: "Report to Lumen at Skyreach Landing" },
    ],
    rewards: { xp: 500, gold: 150, items: [{ key: "tonic", qty: 3 }] },
  },
  {
    id: "f2_causeway",
    name: "The Broken Causeway",
    giver: "herald",
    main: true,
    floor: 2,
    requires: "f2_arrival",
    pitch: "East of the terraces, the Causeway hangs by old wards. Wake the last wardstone at its far end, and break the Aegis knights who guard the bridges. Keep your footing — the Windcallers love a long drop.",
    thanks: "The wards are singing again. Something up in the Heights heard them too.",
    stages: [
      { kind: "visit", zone: "shattered-causeway", text: "Cross onto the Shattered Causeway" },
      { kind: "interact", objects: ["causeway-ward"], text: "Wake the wardstone at the Causeway's far end" },
      { kind: "kill", enemy: ["aegis"], count: 3, text: "Break the Gilded Aegis knights" },
      { kind: "talk", npc: "herald", text: "Return to Lumen" },
    ],
    rewards: { xp: 700, gold: 220 },
  },
  {
    id: "f2_storm",
    name: "Voice of the Storm",
    giver: "herald",
    main: true,
    floor: 2,
    requires: "f2_causeway",
    pitch: "North, in the Stormveil Heights, a shrine still speaks the storm's name. Read it. Then find the Storm Colossus in the Thunder Ring — the seal on its chest opens the Stormspire.",
    thanks: "Vaelra. So that's the name. The seal will open her door. Rest first — she won't be kind.",
    stages: [
      { kind: "visit", zone: "stormveil", text: "Climb into the Stormveil Heights" },
      { kind: "interact", objects: ["storm-shrine"], text: "Read the Shrine of the Storm" },
      { kind: "kill", enemy: ["colossus"], count: 1, text: "Defeat the Storm Colossus in the Thunder Ring" },
      { kind: "talk", npc: "herald", text: "Bring the Stormspire Seal to Lumen" },
    ],
    rewards: { xp: 1100, gold: 320, marks: 5, items: [{ key: "scroll_any_thunder" }] },
  },
  {
    id: "f2_spire",
    name: "The Stormspire",
    giver: "herald",
    main: true,
    floor: 2,
    requires: "f2_storm",
    pitch: "The Stormspire's gate waits at the top of the Heights. Inside, Vaelra, Keeper of the Storm. Learn her, the way you learned Aurelion — and the stair above will open.",
    thanks: "The storm is quiet. For the first time in a hundred years, the Terraces can hear themselves. Look up, climber.",
    stages: [
      { kind: "dungeon", dungeon: "stormspire", text: "Enter the Stormspire" },
      { kind: "kill", enemy: ["vaelra"], count: 1, text: "Defeat Vaelra, Keeper of the Storm" },
      { kind: "talk", npc: "herald", text: "Return to Lumen" },
    ],
    rewards: { xp: 2400, gold: 700, marks: 8, items: [{ key: "scroll_any_storm" }] },
  },
  {
    id: "f2_feathers",
    name: "Feathers for Fletching",
    giver: "quarter",
    floor: 2,
    requires: "q_keeper",
    pitch: "My fletchers need galefeathers. The Windcallers and the lynxes both carry them. Six should do.",
    thanks: "Perfect. These'll fly true. Take this for your trouble.",
    stages: [{ kind: "collect", item: "mat_feather", count: 6, consume: true, text: "Bring Iven 6 Galefeathers" }],
    rewards: { xp: 320, gold: 140, items: [{ key: "tonic", qty: 2 }] },
  },
  {
    id: "f2_plate",
    name: "Gilded Plate",
    giver: "skysmith",
    floor: 2,
    requires: "q_keeper",
    pitch: "The Sentinels and the Aegis knights wear plate older than this Landing. Bring me five pieces and I'll forge you something worth carrying.",
    thanks: "Ha! Look at that grain. Here — the first thing I made from it.",
    stages: [{ kind: "collect", item: "mat_gilded", count: 5, consume: true, text: "Bring Brannoc 5 Gilded Plate" }],
    rewards: { xp: 360, gold: 100, items: [{ key: "sword_knight", rarity: 2 }] },
  },
  {
    id: "f2_aviary",
    name: "The Lost Aviary",
    giver: "gardener",
    floor: 2,
    requires: "q_keeper",
    pitch: "My grandmother kept great golden birds in an aviary off the gardens' edge. No one's found it since the Sentinels woke. Would you look?",
    thanks: "It's still there… Thank you. Take her old charm — she'd want it used.",
    stages: [
      { kind: "interact", objects: ["aviary-nest"], text: "Find the lost aviary beyond the Sunken Gardens" },
      { kind: "talk", npc: "gardener", text: "Tell Maelis what you found" },
    ],
    rewards: { xp: 380, gold: 160, items: [{ key: "charm_gale", rarity: 2 }] },
  },
  {
    id: "f2_sentinels",
    name: "Silence the Sentinels",
    giver: "gardener",
    floor: 2,
    requires: "f2_aviary",
    pitch: "The Sentinels were built to tend the gardens. Now they crush anything that walks there. Put three of them to rest.",
    thanks: "The gardens are quieter already. Maybe the birds will come back.",
    stages: [
      { kind: "kill", enemy: ["sentinel"], count: 3, text: "Put 3 Gilded Sentinels to rest" },
      { kind: "talk", npc: "gardener", text: "Return to Maelis" },
    ],
    rewards: { xp: 450, gold: 180, items: [{ key: "mat_stormglass", qty: 3 }] },
  },
  // --- Floor 3: the Ember Reaches --------------------------------------------------------
  {
    id: "f3_arrival",
    name: "Where Dragons Nest",
    giver: "captain",
    main: true,
    floor: 3,
    requires: "f2_spire",
    pitch: "You climbed through the storm to get here. Good — now forget everything the storm taught you. Up here the ground burns and the sky has teeth. Walk the Ashen Slopes and cull the ashlings and magma hounds before they reach our walls.",
    thanks: "Still standing, and not even singed. Maybe you'll last. The canyon is next.",
    stages: [
      { kind: "visit", zone: "ashen-slopes", text: "Walk out onto the Ashen Slopes" },
      { kind: "kill", enemy: ["ashling", "magmahound"], count: 8, text: "Cull ashlings and magma hounds" },
      { kind: "talk", npc: "captain", text: "Report to Captain Brask in Emberhold" },
    ],
    rewards: { xp: 1400, gold: 380, items: [{ key: "tonic", qty: 3 }] },
  },
  {
    id: "f3_canyon",
    name: "Dragonbone Canyon",
    giver: "captain",
    main: true,
    floor: 3,
    requires: "f3_arrival",
    pitch: "West lies a canyon full of bones — the first dragon's, they say. Drakes nest in it now. Find the shrine at its heart, and bring down three of those drakes. Mind their breath: step out of the fire, not back into it.",
    thanks: "Three drakes. You're the first climber in years to come back from that canyon with both eyebrows.",
    stages: [
      { kind: "visit", zone: "dragonbone-canyon", text: "Enter Dragonbone Canyon" },
      { kind: "interact", objects: ["bone-shrine"], text: "Find the Shrine of the First Dragon" },
      { kind: "kill", enemy: ["drake"], count: 3, text: "Slay 3 drakes" },
      { kind: "talk", npc: "captain", text: "Return to Captain Brask" },
    ],
    rewards: { xp: 1800, gold: 450, marks: 5, items: [{ key: "scroll_any_fireball" }] },
  },
  {
    id: "f3_wastes",
    name: "Hearts of Glass",
    giver: "captain",
    main: true,
    floor: 3,
    requires: "f3_canyon",
    pitch: "East, in the Obsidian Wastes, golems of black glass guard an altar nobody can read. Ysolde thinks it will tell us who holds the Roost. Read it, and break two of the golems while you're there.",
    thanks: "Ysolde will want to hear this. Go — she's in the Keep's library, and she's been impossible all week.",
    stages: [
      { kind: "visit", zone: "obsidian-wastes", text: "Cross into the Obsidian Wastes" },
      { kind: "interact", objects: ["obsidian-altar"], text: "Read the Obsidian Altar" },
      { kind: "kill", enemy: ["obsidian"], count: 2, text: "Shatter 2 obsidian golems" },
      { kind: "talk", npc: "scholar", text: "Tell Ysolde what the altar said" },
    ],
    rewards: { xp: 2000, gold: 500 },
  },
  {
    id: "f3_wyrm",
    name: "Cindermaw",
    giver: "scholar",
    main: true,
    floor: 3,
    requires: "f3_wastes",
    pitch: "A crown of flame… that's Ignivar's mark. He rules the Roost, and his doors answer only to the sigil Cindermaw wears in its crest. Cindermaw sleeps in the Wyrmrest Caldera, north on the Heights. Wake it. Take the sigil.",
    thanks: "The Emberwyrm Sigil. You actually did it. The Roost is open to you now — and Ignivar will know it.",
    stages: [
      { kind: "visit", zone: "caldera-heights", text: "Climb the Caldera Heights" },
      { kind: "interact", objects: ["caldera-scar"], text: "Find the Scorched Stone" },
      { kind: "kill", enemy: ["cindermaw"], count: 1, text: "Defeat Cindermaw in the Wyrmrest Caldera" },
      { kind: "talk", npc: "scholar", text: "Bring the Emberwyrm Sigil to Ysolde" },
    ],
    rewards: { xp: 2800, gold: 700, marks: 6 },
  },
  {
    id: "f3_roost",
    name: "The Dragon's Roost",
    giver: "captain",
    main: true,
    floor: 3,
    requires: "f3_wyrm",
    pitch: "This is it. The Roost's gate is at the top of the Heights. Past it: the hatchery, the flame seals, Vyrmak the Dragonsworn — and Ignivar, the Ember Tyrant. Kill him, and the stair above is ours.",
    thanks: "The Tyrant is dead. Listen — the whole mountain is quiet. Emberhold will sing about this for a hundred years. So will I, and I can't sing.",
    stages: [
      { kind: "dungeon", dungeon: "roost", text: "Enter the Dragon's Roost" },
      { kind: "kill", enemy: ["ignivar"], count: 1, text: "Defeat Ignivar, the Ember Tyrant" },
      { kind: "talk", npc: "captain", text: "Return to Captain Brask" },
    ],
    rewards: { xp: 5000, gold: 1400, marks: 10 },
  },
  {
    id: "f3_scales",
    name: "Scales for the Forge",
    giver: "forgemistress",
    floor: 3,
    requires: "f2_spire",
    pitch: "Dragonscale. Six of them. The drakes in the canyon shed them when they die — they don't shed them gladly.",
    thanks: "Beautiful. Here — the first circlet I made from the last batch. It'll keep the heat off your head.",
    stages: [{ kind: "collect", item: "mat_dragonscale", count: 6, consume: true, text: "Bring Kaela 6 Dragonscales" }],
    rewards: { xp: 900, gold: 200, items: [{ key: "helm_embercirclet", rarity: 1 }] },
  },
  {
    id: "f3_embers",
    name: "Embers in the Dark",
    giver: "innkeep3",
    floor: 3,
    requires: "f2_spire",
    pitch: "The flamecallers come down the slopes at night and set the thatch alight. Five of them. Make it five fewer.",
    thanks: "Quiet nights again. Drinks are on the house — well, some of them.",
    stages: [
      { kind: "kill", enemy: ["flamecaller"], count: 5, text: "Put out 5 flamecallers" },
      { kind: "talk", npc: "innkeep3", text: "Tell Mira at the Cinder Cup" },
    ],
    rewards: { xp: 1000, gold: 300, items: [{ key: "tonic", qty: 4 }] },
  },
  {
    id: "f3_hoard",
    name: "The Dragon's Hoard",
    giver: "scholar",
    floor: 3,
    requires: "f3_canyon",
    pitch: "The shrine's carvings show an egg on a bed of gold, somewhere past the canyon's northern bones. If there's a hoard, there's history in it. Find the egg.",
    thanks: "An egg. Hatched. Recently. …I'm going to pretend I didn't hear that. Take this — you earned it.",
    stages: [
      { kind: "interact", objects: ["hoard-egg"], text: "Find the dragon egg beyond Dragonbone Canyon" },
      { kind: "talk", npc: "scholar", text: "Tell Ysolde what you found" },
    ],
    rewards: { xp: 1200, gold: 400, marks: 4, items: [{ key: "mat_emberheart", qty: 1 }] },
  },
  {
    id: "f3_golems",
    name: "Glass and Fire",
    giver: "quarter3",
    floor: 3,
    requires: "f2_spire",
    pitch: "The obsidian golems' cores burn for weeks. The keep needs fuel. Break four golems in the Wastes and I'll pay you in coin and cinderstone.",
    thanks: "That'll keep the forges hot for a month.",
    stages: [
      { kind: "kill", enemy: ["obsidian"], count: 4, text: "Break 4 obsidian golems" },
      { kind: "talk", npc: "quarter3", text: "Report to Quartermaster Sable" },
    ],
    rewards: { xp: 1100, gold: 320, items: [{ key: "mat_cinder", qty: 4 }] },
  },

  // --- Missions: repeatable work from each town's Mission Board ------------------------------
  // Floor 1 (Emberwatch)
  mission("m1_wolves", "board1", 1, "Bounty: Wolves at the Fence", "The farms want the wolf packs thinned again. Ten pelts' worth.", { kind: "kill", enemy: ["wolf", "alpha"], count: 10, text: "Hunt 10 wolves" }, 120, 60, 2),
  mission("m1_bandits", "board1", 1, "Bounty: Bandit Trouble", "Grakk's gang is back on the roads. Break up the raiding parties.", { kind: "kill", enemy: ["goblin", "archer", "cutpurse", "shieldbearer", "brute"], count: 10, text: "Defeat 10 bandits" }, 160, 80, 2),
  mission("m1_ruins", "board1", 1, "Bounty: Things in the Ruins", "The cult and the stalkers are spilling out of the ruins. Push them back.", { kind: "kill", enemy: ["cultist", "stalker"], count: 8, text: "Defeat 8 cultists or ruin stalkers" }, 220, 110, 3),
  mission("m1_scrap", "board1", 1, "Contract: Salvage", "The forge is short of scrap iron. Bandits carry plenty.", { kind: "collect", item: "mat_scrap", count: 8, consume: true, text: "Hand in 8 Scrap Iron at the board" }, 140, 90, 2),
  // Floor 2 (Skyreach)
  mission("m2_lynx", "board2", 2, "Bounty: Sky Lynx Prides", "The prides are hunting too close to the Landing. Ten will do.", { kind: "kill", enemy: ["skylynx"], count: 10, text: "Hunt 10 sky lynxes" }, 420, 150, 3),
  mission("m2_knights", "board2", 2, "Bounty: Gilded Knights", "The Skyguard and the Aegis are marching on the Causeway again.", { kind: "kill", enemy: ["skyguard", "aegis"], count: 8, text: "Defeat 8 Skyguard or Aegis knights" }, 520, 180, 3),
  mission("m2_storm", "board2", 2, "Bounty: Storm Callers", "Windcallers and storm adepts are calling lightning down on the terraces.", { kind: "kill", enemy: ["windcaller", "stormadept"], count: 8, text: "Defeat 8 windcallers or storm adepts" }, 560, 200, 4),
  mission("m2_plate", "board2", 2, "Contract: Gilded Plate", "Brannoc needs plate for the Landing's guard.", { kind: "collect", item: "mat_gilded", count: 6, consume: true, text: "Hand in 6 Gilded Plate at the board" }, 480, 220, 3),
  // Floor 3 (Emberhold)
  mission("m3_ash", "board3", 3, "Bounty: Ash and Embers", "Ashlings and magma hounds are gathering on the slopes. Scatter them.", { kind: "kill", enemy: ["ashling", "magmahound"], count: 12, text: "Defeat 12 ashlings or magma hounds" }, 900, 260, 4),
  mission("m3_drakes", "board3", 3, "Bounty: Drake Hunt", "The canyon drakes are raiding Emberhold's herds. Five of them.", { kind: "kill", enemy: ["drake"], count: 5, text: "Slay 5 drakes" }, 1200, 340, 5),
  mission("m3_golems", "board3", 3, "Bounty: Black Glass", "The obsidian golems are walking toward the road. Stop them.", { kind: "kill", enemy: ["obsidian"], count: 4, text: "Shatter 4 obsidian golems" }, 1100, 320, 5),
  mission("m3_scales", "board3", 3, "Contract: Dragonscale", "The Dragonforge always needs scales.", { kind: "collect", item: "mat_dragonscale", count: 6, consume: true, text: "Hand in 6 Dragonscales at the board" }, 1000, 380, 4),
  // --- Floor 4: the Frostvale ------------------------------------------------------------------
  {
    id: "f4_arrival",
    name: "Into the Frostvale",
    giver: "jarl",
    main: true,
    floor: 4,
    requires: "f3_roost",
    pitch: "You came up out of the fire into the snow. Good — you'll appreciate it for about an hour. The rime wolves have been circling the Snowfields for weeks. Thin the packs, and learn how the cold fights.",
    thanks: "Not bad, for someone who smells of smoke. The lake is next — the Seer has been asking for someone foolish enough.",
    stages: [
      { kind: "visit", zone: "snowfields", text: "Walk out onto the Snowfields" },
      { kind: "kill", enemy: ["rimewolf"], count: 8, text: "Thin the rime wolf packs" },
      { kind: "talk", npc: "jarl", text: "Report to Jarl Sigrun in Rimeholt" },
    ],
    rewards: { xp: 2600, gold: 520, items: [{ key: "tonic", qty: 4 }] },
  },
  {
    id: "f4_lake",
    name: "The Frozen Lake",
    giver: "jarl",
    main: true,
    floor: 4,
    requires: "f4_arrival",
    pitch: "West, past the rocks, the Frozen Lake. Ice wraiths have come up out of it, and the Seer says there's a shrine on its northern shore that knows why. Read it. Put down the wraiths you find.",
    thanks: "Something enormous, asleep under the ice. Wonderful. Go and tell Ylva — she'll be delighted, which is worse.",
    stages: [
      { kind: "visit", zone: "frozen-lake", text: "Reach the Frozen Lake" },
      { kind: "interact", objects: ["lake-shrine"], text: "Read the Shrine of the Still Water" },
      { kind: "kill", enemy: ["icewraith"], count: 4, text: "Banish 4 ice wraiths" },
      { kind: "talk", npc: "seer", text: "Tell Seer Ylva what the shrine said" },
    ],
    rewards: { xp: 3200, gold: 620, marks: 5, items: [{ key: "scroll_any_icelance" }] },
  },
  {
    id: "f4_pines",
    name: "Tracks in the Pinewood",
    giver: "seer",
    main: true,
    floor: 4,
    requires: "f4_lake",
    pitch: "The hunters in the Pinewood stopped sending word. Their post is in the east wood, past the creek. Find it — and whatever is leaving tracks that size, find that too.",
    thanks: "Yetis. Three of them, and you walked back. The Jarl will want to hear it from you.",
    stages: [
      { kind: "visit", zone: "pinewood", text: "Enter the Pinewood" },
      { kind: "interact", objects: ["hunters-post"], text: "Find the Hunters' Post" },
      { kind: "kill", enemy: ["yeti"], count: 3, text: "Bring down 3 yetis" },
      { kind: "talk", npc: "jarl", text: "Report to Jarl Sigrun" },
    ],
    rewards: { xp: 3400, gold: 680 },
  },
  {
    id: "f4_wyrm",
    name: "Glacierfang",
    giver: "jarl",
    main: true,
    floor: 4,
    requires: "f4_pines",
    pitch: "The Winter King sits in a throne of ice at the top of the Peak, behind a gate that answers only to the seal the white wyrm Glacierfang wears. It sleeps in the White Ring, north-east on the Peak. Wake it. Take the seal.",
    thanks: "The Rime Seal. Ylva needs to see it before you go in — there are things about Hrimthar she only says once.",
    stages: [
      { kind: "visit", zone: "glacier-peak", text: "Climb the Glacier Peak" },
      { kind: "interact", objects: ["kings-oath"], text: "Find the King's Oath" },
      { kind: "kill", enemy: ["glacierfang"], count: 1, text: "Defeat Glacierfang in the White Ring" },
      { kind: "talk", npc: "seer", text: "Bring the Rime Seal to Seer Ylva" },
    ],
    rewards: { xp: 4400, gold: 900, marks: 6 },
  },
  {
    id: "f4_throne",
    name: "The Winter King",
    giver: "seer",
    main: true,
    floor: 4,
    requires: "f4_wyrm",
    pitch: "The Glacier Throne. The mirrors will try to be you; the echoes will tell you the runes, if you listen; Jarnhild guards the last hall. And then him. Every fire goes out, he says. Prove him wrong.",
    thanks: "The snow stopped. For the first time in my life, the snow stopped. Look up, climber — the stair above is waiting.",
    stages: [
      { kind: "dungeon", dungeon: "glacier", text: "Enter the Glacier Throne" },
      { kind: "kill", enemy: ["hrimthar"], count: 1, text: "Defeat Hrimthar, the Winter King" },
      { kind: "talk", npc: "jarl", text: "Return to Jarl Sigrun" },
    ],
    rewards: { xp: 7600, gold: 1800, marks: 10 },
  },
  {
    id: "f4_pelts",
    name: "Warm Enough to Live",
    giver: "quarter4",
    floor: 4,
    requires: "f3_roost",
    pitch: "Six frost pelts. The wolves and the drakes wear them. I'll make you a hood that makes the wind give up.",
    thanks: "There. Pull it down over your ears — yes, like that. Try not to die in it.",
    stages: [{ kind: "collect", item: "mat_frostpelt", count: 6, consume: true, text: "Bring Ottar 6 Frost Pelts" }],
    rewards: { xp: 1600, gold: 300, items: [{ key: "helm_furhood", rarity: 1 }] },
  },
  {
    id: "f4_flagon",
    name: "Yetis at the Woodpile",
    giver: "innkeep4",
    floor: 4,
    requires: "f3_roost",
    pitch: "Three yetis have been raiding the woodpile north of the Snowfields. No wood, no fire. No fire, no Flagon. You see the problem.",
    thanks: "The fire stays lit. First round's on me — and the second, if you tell the story right.",
    stages: [
      { kind: "kill", enemy: ["yeti"], count: 3, text: "Drive off 3 yetis" },
      { kind: "talk", npc: "innkeep4", text: "Tell Old Magnus at the Frozen Flagon" },
    ],
    rewards: { xp: 1800, gold: 420, items: [{ key: "tonic", qty: 5 }] },
  },
  {
    id: "f4_cache",
    name: "The Lost Sled",
    giver: "seer",
    floor: 4,
    requires: "f4_lake",
    pitch: "Hunters went missing west of the lake years ago, hauling something heavy. The snow says they're still out there, behind the rocks where the old ice bridge was. Find what they left.",
    thanks: "A sled, a cache, and no hunters. The snow keeps what it takes. Take this — they'd want it used.",
    stages: [
      { kind: "interact", objects: ["cache-sled"], text: "Find the hunters' sled beyond the Frozen Lake" },
      { kind: "talk", npc: "seer", text: "Tell Seer Ylva what you found" },
    ],
    rewards: { xp: 2000, gold: 520, marks: 4, items: [{ key: "mat_glacialheart", qty: 1 }] },
  },
  {
    id: "f4_golems",
    name: "Hearts of Ice",
    giver: "runesmith",
    floor: 4,
    requires: "f3_roost",
    pitch: "The ice golems on the Peak are built around shards older than Rimeholt. Break four and bring me what's inside.",
    thanks: "Look at the grain in that. I'll carve runes into it for a month.",
    stages: [
      { kind: "kill", enemy: ["icegolem"], count: 4, text: "Break 4 ice golems" },
      { kind: "talk", npc: "runesmith", text: "Report to Halla the Runesmith" },
    ],
    rewards: { xp: 1900, gold: 460, items: [{ key: "mat_rimeshard", qty: 5 }] },
  },
  // Floor 4 (Rimeholt)
  mission("m4_wolves", "board4", 4, "Bounty: Rime Wolves", "The packs are back at the Snowfields' edge. Twelve pelts' worth.", { kind: "kill", enemy: ["rimewolf"], count: 12, text: "Hunt 12 rime wolves" }, 1500, 380, 4),
  mission("m4_wraiths", "board4", 4, "Bounty: Lake Wraiths", "Ice wraiths are drifting up off the Frozen Lake at night.", { kind: "kill", enemy: ["icewraith"], count: 8, text: "Banish 8 ice wraiths" }, 1800, 440, 5),
  mission("m4_yetis", "board4", 4, "Bounty: Yetis", "Yetis in the Pinewood again. Five of them, and the woodcutters want their axes back.", { kind: "kill", enemy: ["yeti"], count: 5, text: "Bring down 5 yetis" }, 2000, 480, 5),
  mission("m4_pelts", "board4", 4, "Contract: Frost Pelts", "The Outfitter needs pelts for the winter coats.", { kind: "collect", item: "mat_frostpelt", count: 6, consume: true, text: "Hand in 6 Frost Pelts at the board" }, 1600, 520, 4),
];

export const questDef = (id: string) => QUESTS.find((q) => q.id === id);

/** A repeatable mission posted on a town's Mission Board. */
function mission(id: string, board: string, floor: number, name: string, pitch: string, stage: QuestStage, xp: number, gold: number, marks: number): QuestDef {
  return { id, name, giver: board, floor, mission: true, pitch, thanks: "Mission complete. The board pays on the spot.", stages: [stage], rewards: { xp, gold, marks } };
}
