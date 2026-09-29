# Build plan and status

Spec: [BRIEF.md](BRIEF.md) (owner override: 2D, not 2.5D 3D). Work follows the brief's
priority order; each phase is run, tested (including multiplayer) and polished before
the next starts.

## Stack
- `client/` — Phaser 4 + Vite, TypeScript. All art, animation, effects, audio and music are
  generated in code (no downloaded assets). DOM overlay for HUD and UI panels.
- `server/` — Colyseus 0.18, 60 Hz fixed-step simulation, 30 Hz patches. Rooms: `world`
  (persistent Floor 1), `floor2` (persistent Floor 2, the Gilded Terraces), and per-party
  instances `dungeon` (the Undercroft) and `stormspire` (the Stormspire), both built on
  `InstanceRoom` (gates, braziers, miniboss hall, boss arena, wipe reset, party scaling).
  Node's built-in SQLite (`data/floors.db`) stores accounts, sessions and characters.
- `shared/` — code both sides run: the deterministic player step (movement, combos,
  dodge, parry, buffering), weapon/enemy frame data, maps, items, loot, quests, progression.
- `tools/` — headless test bots and headless-Edge visual scenarios.

## Running
```
npm run dev:server          # ws://localhost:2567
npm run dev:client          # http://localhost:5173   (dev: ?guest=Name skips login)
npm run build && npm start  # production: one port serves page + game (see HOSTING.md)
npm run smoke               # movement/collision/anti-cheat with two bots
npm run combat              # frame data, parry/perfect/early, dodge i-frames vs the Sparring Knight
npm run journey             # account → quest → loot → gear → shop → storage → death/bag → persistence → party → dungeon
npm run moves               # every weapon: light chain, heavy, combo heavy, both skills
npm run boss                # Floor Boss: intro, sealed gate, wipe reset, phases, glyphs, victory, Floor 2 unlock
npm run events | trade | interest   # world events, player trading, per-client relevance
npm run settings            # rebinding, wheel zoom, settings saved to the character (browser)
npx tsx tools/prod.ts <url> # production build: accounts, no guests/cheats, login limits
npm run reach               # every NPC, object and spawn on every map (both floors, both dungeons) can be walked to
npm run party               # party dungeons: whoever is outside when a hall or arena seals is brought in
npm run worldfloor          # floors open for the whole server (use a fresh FLOORS_DB): boss kill, announcement, admin seal/reopen
npm run social              # sitting on benches/the ground, resting, speech bubbles, emotes, /roll, /who
npm run curve               # seconds to kill each enemy (and to be killed) for an on-level, typically geared climber
npm run loot                # per-kill odds of rare / epic / legendary gear from each loot table
npm run mechanics           # gear set bonuses (2 and 3 pieces) and elite affixes (Frenzied, Warded, Volatile, Packleader)
npm run floor5              # Floor 5 end to end: Starless Stair → Duskhollow → the Chapel's Archivist → umbral drakes → Nightwing's Moon Sigil → the Abyssal Sanctum (Hollow Court, Hall of Moons, Maelgrim, Nyxara's eclipse) → back out
npm run floor4              # Floor 4 end to end: Frozen Stair → Rimeholt → the Longhall's Archivist → frost drakes → Glacierfang's Rime Seal → the Glacier Throne (Hall of Mirrors, echo-stone runes, Jarnhild, Hrimthar) → back out
npm run floor3              # scrolls, Marks, interiors, the Mission Board, then Floor 3 end to end: Ember Stair → Emberhold → drakes → Cindermaw's sigil → the Dragon's Roost (Hatchery, Flame Seals, Vyrmak, Ignivar) → back out
npm run floor2              # Floor 2 end to end: Ascent Gate → Herald → lynxes → Colossus seal → Stormspire (Gallery, Conduits, Kael, Vaelra) → back out
npx tsx tools/fps.ts        # frame rate per area (GPU=1 for real GPU)
npm run latency             # prediction under lag (start a server with COLYSEUS_LATENCY=150 PORT=2568, SERVER=ws://localhost:2568)
npx tsx tools/scenario.ts <yard|tour|dungeon|floor2> <outDir>   # screenshots
npx tsx tools/outfits.ts <outDir>   # every armour/helm/weapon look: front, back, side, Pack and Inspect dolls
```

## Netcode model
- The local player is predicted with the shared step and reconciled against the server
  (Colyseus `Reconciler`); remote players/enemies are interpolated 100 ms in the past.
- Player attacks hit what the attacker saw (enemy positions rewound to the input's renderTime).
- Enemy attacks are judged in the **defender's** view: each input carries the server time the
  client was viewing; parry/dodge windows are measured against the moment the defender saw the
  swing land. A stalled client is forced forward after 300 ms, so going quiet is never a shield.
- Verified at 150 ms RTT: server judgement time matches the client's view to the millisecond.

## Status (2026-09-28)
| # | Phase | Status |
|---|-------|--------|
| 1 | Movement + camera (8-way, sprint/stamina, collision, prediction, look-ahead) | done, tested |
| 2 | Animation (paper-doll rigs, blended poses, per-move swing arcs, wolves, props) | done |
| 3 | Core combat (5 weapons × chain/heavy/combo-heavy/2 skills, frame data, hitstop, trails, sparks, sound) | done, tested |
| 4 | Enemy combat (11 archetypes + 3 bosses, telegraphs, tokens, leash, pathfinding) | done |
| 5–6 | Dodge (i-frames) and parry (normal/perfect, riposte, boss posture, projectile reflect) | done, tested under lag |
| 7 | Multiplayer sync (defender-view judgement, rewind, relevance-limited events) | done, tested |
| 8 | Death (bag of carried gold+materials, revive by allies, respawn). Owner override: no gear durability (removed 2026-09-28) | done, tested |
| 9–11 | Inventory/equipment/loot (rarity, uniques with effects, drops with rights), XP, perks, weapon mastery | done, tested |
| 12 | Floor 1 world (town, fields, forest, camp, ruins, caves, secrets, NPCs, shops, smith, storage, waystones, quests, world events) | done |
| 13–14 | Undercroft dungeon (traps, locked hall waves, lever puzzle, Warden, Keeper with 3 phases, glyph/sigil/blade mechanics) → Floor 2 | done, tested (npm run boss) |
| 15 | Parties (invite/accept/kick/promote, frames, chat, shared XP/quests, dungeon entry, revive) | done, tested |
| 16 | Persistence (accounts, sessions, characters, anti-dup single session, linkdead) | done, tested |
| — | Achievements, player trading, ambient sound, rare-gear sparkles, relevance-limited sync | done, tested |
| — | Visible equipment: 9 armour sets, 7 helms, 13 weapon arts (per item, synced to everyone), capes, paper doll in Pack and Inspect | done |
| — | Settings (volumes, zoom, key rebinding) saved to the character; production server + hosting guide; login rate limits | done, tested |
| — | New-player guidance: tracker always names the next main-quest step; gold arrow to people, the dungeon door, or the hunting region (never exact secrets) | done |
| — | Skill tree (K): 6 skills per weapon + combo/finisher/passives + General perks; 1 point per level + main-story points; 2 equipped skills per weapon; skill icons, HUD cooldown dials, per-skill VFX | superseded by skill scrolls (below) |
| — | Weapon mastery per weapon item (Item.mxp): +3% damage per level, glow at 10 | done |
| — | Quest panel with icons/progress/directions; markers for every quest; parchment world map sold by Tilde (35g) | done |
| — | Admin panel for FLOORS_ADMINS (default Ofir): players, teleport, events, spawns, items, quests, stats | done, tested in production mode |
| — | Pack: paper doll + stats, filter tabs, sort, drag-and-drop (equip, rearrange, merge stacks, bank, trade, sell, drop); item cards compare with what you wear and show weapon mastery | done, tested (drag in the browser) |
| — | First-play tutorial: 13 steps taught by doing (move, sprint, Rhea, attack, heavy, dodge, parry, learn and use a skill, pack, tonics); skippable, remembered on the character | done, tested |
| — | Difficulty: ENEMY_TUNING in enemies/defs.ts (normal 2.2× HP / 1.7× damage, +16% HP and +9% damage per level; bosses keep their HP curve but hit 1.35× harder; elites 2× HP; per-enemy corrections for goblin, cutpurse, shieldbearer, alpha, brute; XP ×1.6). Target: an on-level normal enemy takes 7–14 light hits and takes longer to kill you than you take to kill it. Out-of-combat regen 2%/s | done, tested (combat, journey, boss) |
| — | Second wave of gear: 11 weapons, 4 armour sets, 4 helms, each with its own art; T3 loot pool for elites and bosses | done |
| — | Map fixes: Grakk's camp gate faces the road; the builder carves trails to anything sealed in by trees (fixed the Missing Scouts objective) | done, tested (npm run reach) |
| — | Floor 2, the Gilded Terraces (170×140 sky islands): Skyreach Landing (Herald, Quartermaster, Skysmith, vault, inn), Gilded Terraces, Sunken Gardens, Hidden Aviary (secret), Shattered Causeway, Stormveil Heights, the Thunder Ring. 7 new enemies (sky lynx, Skyguard lancer, Gilded Aegis, windcaller, storm adept, sentinel) and the Storm Colossus world miniboss, which drops the Stormspire Seal. 4 main + 4 side quests, 5 waystones, 3 chests, 4 inscriptions, its own shops, map (60g), music, ambience and world events (Stormfront, Lynx Pride, merchant) | done, tested (npm run floor2, reach) |
| — | The Stormspire (Floor 2 boss dungeon): lightning bridge, Gallery ambush (2 waves), three conduits to wake, Kael the Stormwarden, Vaelra, Keeper of the Storm (3 phases: chain lightning, Thunderfall sigils, Eye of the Storm, Maelstrom, summons). Drops the Heart of the Storm | done, tested (npm run floor2) |
| — | Floor 2 tuning (tools/_curve.ts): Skyguard, Aegis and Sentinel HP corrections; Vaelra ~285 s solo at L12. Weapon mastery is paced per kill (normal 10, elite 20, miniboss 50, boss 100; ~220 normal kills to mastery 10 on any floor) instead of raw damage | done |
| — | Floor 2 achievements (Above the Clouds, Where the Birds Go, Sky Plunder, Skyward Roads, Thunder Breaker, The Last Watch, The Storm Breaks); world minibosses now count as boss kills (fixes Bandit Bane) | done |
| — | The Stormglass set (Floor 2's own tier-4 gear, each with its own art): Stormglass Blade, Thunderhewn Greatblade, Galecutter Knives, Skyguard Lance, Stormcaller's Rod; Gilded Aegis Plate, Skyguard Harness, Stormweave Robes; Winged Helm, Storm Diadem. Sold by the Skysmith and Quartermaster, dropped by Floor 2 elites and bosses, upgraded with Gilded Plate / Stormglass / Galefeather | done, tested (npm run floor2) |
| — | Room changes no longer drop the first messages (character sheet, settings, arrival banner): the session buffers them until the scene is listening. Terrain chunks are per map (no Floor 1 ground on Floor 2). Admin "go to player" works across floors | done, tested |
| — | Party dungeons: when a wave hall, miniboss hall or boss arena seals, living party members still outside are brought in (with a warp effect and a notice); gates, warps, braziers and levers now have effects and sound | done, tested (npm run party) |
| — | Floors open for everyone: the first party to beat Aurelion opens Floor 2 for the whole server (saved; offline players get it at login; old servers where Aurelion already fell start open). Every online player sees a celebration (golden title, rays, the camera sweeps to the Ascent Gate as it erupts). Admins can seal/open Floor 2 in the panel (World tab); sealing sends players up there back to the Ascent Gate. Boss kills in dungeons count for the whole run (downed or far-away members too) | done, tested (npm run worldfloor, party) |
| — | Social: sit on benches and logs (F) or anywhere (X, /sit); resting heals 3× faster; speech bubbles over whoever talks; emotes /wave /cheer /dance /bow /laugh with their own poses; /roll, /who, /help | done, tested (npm run social) |
| — | 50 skills: 4 new per weapon on two new tree rows (levels 10 and 12), each with its own icon and effects; new mechanics Bloodlust (hits heal), Life Drain (a healing beam) and Death Mark (+30% damage taken). Every character's tree was reset once (TREE_VERSION 2) with all points refunded | done, tested (npm run moves) |
| — | Third gear wave: 15 weapons (3 per type, tiers 1–4) and 6 armours + 3 helms, each with its own art, in the Floor 1/Floor 2 loot pools and shops | done |
| — | Harder progression: XP curve ~1.5× (85·L^1.55), kill XP ×1.3 (was 1.6), equipment chance drops ×0.65, equipment shop prices ×1.3, upgrades +5% each (was 6%) and ~50% dearer, mastery 8 per normal kill (~275 kills to mastery 10) | done, tested |
| — | Loot rarity: epic and legendary are events. Legendary about 1 in 25–35 floor-boss kills, 1 in 75–115 miniboss kills, 1 in 600 elites, ~1 in 10,000 normal kills; no guaranteed epics; named uniques 1.5–5% | done (npm run loot simulates the odds) |
| — | PvE pacing (researched: WoW level gaps, Path of Exile exponential monster scaling, Diablo 4 level scaling): normal enemies take ~6–12 s at level (npm run curve), bosses unchanged; enemy health +20%/level to keep pace with player power; blows glance on enemies 3+ levels above you and above-level enemies hit harder; normal enemies rise to (your level − 1) when they engage you, up to the floor's cap (Floor 1: 8, Floor 2: 12), and settle back when they lose interest; greatsword lights −12% | done, tested |
| — | Skill scrolls replace the skill tree: 96 skills (12 per weapon type, 22 universal skills any weapon can use, 14 passives), each with a rarity. Skills are learned by reading scrolls (used up; a skill can't be learned twice; scrolls can be sold and traded). Two slots per weapon type hold that weapon's skills or universal ones. Combo heavy, finisher and weapon passives now come from weapon mastery (2 / 4 / 5 / 8). Old characters keep every skill they had learned; unspent points became 3 Marks each | done, tested (npm run moves covers all 96, floor3) |
| — | Marks and missions: a new currency from quests (4 main / 2 side, more for big ones), achievements (2), first boss victories (3 miniboss / 6 boss) and missions. Each town has a Mission Board of repeatable missions (4 per floor, 15-minute cooldown). Archivists sell scrolls for gold + Marks: Floor 1 common/uncommon, Floor 2 rare, Floor 3 epic; legendaries are never sold. Scrolls also drop (0.4% normal, 3% elite, 30% miniboss, 60% boss; Aurelion/Vaelra/Ignivar carry legendaries at 3/5/10%, and Ignivar's first defeat always gives one); the travelling merchant sometimes carries one for gold alone | done, tested (npm run floor3) |
| — | Floor abilities: every floor has arts of its own (Floor 1: Hatchet Volley, Hunter's Snare, Wolf's Howl, Radiant Burst; Floor 2: Gale Step, Wind Wall, Thunderclap, Storm Call; Floor 3: Fireball, Drakeblood, Eruption, Wrath of the Wyrm, Phoenix Rite), sold only by that floor's Archivist and carried only by its enemies; each Archivist also stocks 20–35 regular scrolls. New mechanics: Burning (fire damage over time), Empower (+15–30% damage), Meteor Storm, Storm Call (chain lightning), Phoenix Rite; four passives at levels 13/15 | done, tested (npm run moves) |
| — | Building interiors: every house on Floors 1–3 has a furnished room (shop, smithy, inn, vault, library, guild hall) with counters, shelves, hearths, tables and benches. Doors (E) take you in and out; shopkeepers, the smith, the vaultkeeper, the innkeeper and the Archivists work indoors. Quest arrows lead through the right door; the map shows you at the building while you're inside | done, tested (npm run reach, floor3) |
| — | Floor 3, the Ember Reaches (180×150 volcanic isles, levels 12–16): Emberhold (Captain Brask, Quartermaster Sable, Kaela of the Dragonforge, the vault, the Cinder Cup, Ysolde and Archivist Corvane in the Keep), Ashen Slopes, Dragonbone Canyon (dragon skeleton, a hidden Dragon's Hoard behind a rib bridge), Obsidian Wastes, Caldera Heights with Cindermaw's caldera. Enemies: ashling, magma hound, flamecaller, emberguard, obsidian golem, drake, Cindermaw (world miniboss, drops the Emberwyrm Sigil). 5 main + 4 side quests, 4 missions, 5 waystones, 3 chests, 5 inscriptions, its own music, ash-and-lava ground, charred forests, an ember sky and world events (Dragon Raid, the Caldera Wakes, merchant). Vaelra's fall opens it for everyone; level cap raised to 16 | done, tested (npm run floor3, reach, curve) |
| — | The Dragon's Roost (Floor 3's boss dungeon): lava bridge with erupting geysers, the Hatchery (3 waves ending with the Brood-Mother), three Flame Seals that must all be lit within 30 seconds, Vyrmak the Dragonsworn, and Ignivar, the Ember Tyrant (3 phases: Dragonfire, Tail Crush, Wing Tempest, Meteor Rain, Skyfall Dive, Molten Roar, Sweeping Flame, Inferno, the brood). Dragons have their own animated rig (neck, jaw, horns, bat wings that fold and beat, two-part tail) and breathe real fire. The Dragonscale set (tier 5: 5 weapons, 3 armours, 2 helms, 2 legendaries) with dragon materials | done, tested (npm run floor3) |
| — | Custom cursors: a gold arrow, a pointing gauntlet over anything clickable, grab/grabbing when dragging items; over the world an aiming reticle that turns into crossed swords over enemies, a speech bubble over people, a hand over doors, chests and seats, a purse over loot and a magnifier over other players | done |
| — | One tower table (shared/src/tower.ts): every floor's rooms, dungeon, stairs, level cap, sky, music, map and Floor Boss in one place; world rooms for every floor are one generic class; dungeons get their title, exit, floor opening and stair up from it. A new floor is its content plus one entry. Shared isle-building helpers (shared/src/world/isles.ts) | done, tested (npm run reach covers every map in the tower) |
| — | Floor 4, the Frostvale (180×150 snow isles, levels 16–20): Rimeholt (Jarl Sigrun, Ottar the Outfitter, Halla the Runesmith, the Frost Vault, the Frozen Flagon, Seer Ylva and Archivist Tove in the Longhall, a Mission Board), the Snowfields, the Frozen Lake (with a hidden Hunters' Cache), the Pinewood, the Glacier Peak with Glacierfang's White Ring. Enemies: rime wolf, yeti, ice wraith, rimeguard, ice golem, frost drake, Glacierfang the White Wyrm (world miniboss, drops the Rime Seal). 5 main + 4 side quests, 4 missions, 5 waystones, 3 chests, 5 inscriptions, world events (Winter Moon Hunt, White Storm, merchant), snow ground, frozen lakes, snowy pines, falling snow, its own music and wind. Hrimthar's fall will open Floor 5; level cap 20 | done, tested (npm run floor4, reach, curve) |
| — | The Glacier Throne (Floor 4's boss dungeon): icicle bridge, the Hall of Mirrors (3 waves ending with the Frozen Champion), the Hall of Echoes (four echo stones each tell one step of a rune order that changes every run; a wrong rune shatters them and summons wraiths), Jarnhild the Frost Giant, Hrimthar the Winter King (3 phases: Kingsblade, Glacial Stomp, Blizzard, Frozen Leap, Ice Spikes, Winter's Wrath, Absolute Cold, wraiths). The Frostforged set (tier 6) with frost materials; Winterbane and the Mantle of the Winter King | done, tested (npm run floor4) |
| — | Chill: a new status (skills, hail, Frostblood) — chilled enemies move 45% slower and wind up 20% slower, shown with frost. 10 frost weapon skills (2 per weapon), the Frostvale's floor abilities (Ice Lance, Glacial Prison, Hailstorm, Absolute Zero), passives Frostblood and Glacial Hide. Frost dragons breathe cold. Every floor's first Floor Boss kill after Floor 2 gives a legendary scroll | done, tested (npm run moves) |
| — | Floor 5, the Umbral Wilds (180×150 isles under a starless sky, levels 20–24): Duskhollow, lantern-lit (Lanternwarden Isolde, Corvin at the Nightmarket, Mira the Moonsmith, the Umbral Vault, the Last Lantern, the Blind Oracle and Archivist Elowen in the Lantern Chapel, a Mission Board), the Gloaming (a twilight forest of shadow-oaks), the Weeping Marsh (with the hidden Moonwell beyond the willows), the Shattered Moon, the Night Spires with Nightwing's Perch. Enemies: shade, void hound, voidcaller, abyssal knight, void golem, umbral drake, Nightwing the Void Wyrm (world miniboss, drops the Moon Sigil). 5 main + 4 side quests, 4 missions, 5 waystones, 3 chests (the Moonstone Charm), 5 inscriptions, world events (Blood Moon, Eclipse Tide, merchant). Twilight darkness by zone (lanterns, moon shards and glowing things light it), dusk moss, black water full of stars, rising motes, its own music and ambience. Level cap 24 | done, tested (npm run floor5, reach, curve) |
| — | The Abyssal Sanctum (Floor 5's boss dungeon): the Starless Walk (void rifts in rows), the Hollow Court (3 waves ending with the Hollow Champion), the Hall of Moons (turn four moon lanterns to the phases on the Moon Dial — each drags its eastern neighbour round; a new sky every run, and the dark sends shades while you think), Maelgrim the Hollow Knight, Nyxara Queen of the Void (3 phases; Total Eclipse puts out the sun and only pools of moonlight are safe). The Eclipse set (tier 7) with void materials; the Scepter of the Void Queen and the Veil of Night | done, tested (npm run floor5) |
| — | Curse: a new status — cursed enemies deal 30% less damage and take 10% more, shown with violet wisps. 10 void weapon skills (2 per weapon), the Umbral Wilds' floor abilities (Shadow Bolt, Soul Siphon, Void Rift, Eclipse), passives Umbral Touch and Nightveil (one blow in ten passes through you). Void dragons breathe the dark | done, tested (npm run moves) |
| — | Mechanics pass: **perfect dodges** (a dodge that evades in its first 4 ticks refunds stamina and readies a counter: the next blow within 1.5 s deals 50% more and crits; practise it on the Sparring Knight); **elite affixes** (three in four elites are Vampiric, Frenzied, Warded, Volatile or a Packleader — named, aura-coloured, worth 30% more XP); **gear sets** (each floor's own gear: two pieces add health and defense, all three add the set's power — Stormglass lightning, Dragonscale burning, Frostforged chill, Eclipse curses — shown in item tooltips) | done, tested (npm run mechanics, combat) |
| 17 | Polish | ongoing |

## Known gaps / next
- Touch controls.
- Floor 3: the Sealed Stair on Floor 2 and the stair above Vaelra are placeholders (they say so in game).
- Optional: Higgsfield art for icons/portraits/key art (needs a new key in .env.local and approval for billable generations).
