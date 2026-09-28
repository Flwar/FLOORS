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
| 8 | Death (bag of carried gold+materials, durability loss, revive by allies, respawn) | done, tested |
| 9–11 | Inventory/equipment/loot (rarity, uniques with effects, drops with rights), XP, perks, weapon mastery | done, tested |
| 12 | Floor 1 world (town, fields, forest, camp, ruins, caves, secrets, NPCs, shops, smith, storage, waystones, quests, world events) | done |
| 13–14 | Undercroft dungeon (traps, locked hall waves, lever puzzle, Warden, Keeper with 3 phases, glyph/sigil/blade mechanics) → Floor 2 | done, tested (npm run boss) |
| 15 | Parties (invite/accept/kick/promote, frames, chat, shared XP/quests, dungeon entry, revive) | done, tested |
| 16 | Persistence (accounts, sessions, characters, anti-dup single session, linkdead) | done, tested |
| — | Achievements, player trading, ambient sound, rare-gear sparkles, relevance-limited sync | done, tested |
| — | Visible equipment: 9 armour sets, 7 helms, 13 weapon arts (per item, synced to everyone), capes, paper doll in Pack and Inspect | done |
| — | Settings (volumes, zoom, key rebinding) saved to the character; production server + hosting guide; login rate limits | done, tested |
| — | New-player guidance: tracker always names the next main-quest step; gold arrow to people, the dungeon door, or the hunting region (never exact secrets) | done |
| — | Skill tree (K): 6 skills per weapon + combo/finisher/passives + General perks; 1 point per level + main-story points; 2 equipped skills per weapon; skill icons, HUD cooldown dials, per-skill VFX | done, tested (npm run moves covers all 30 skills) |
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
| 17 | Polish | ongoing |

## Known gaps / next
- Touch controls.
- Floor 3: the Sealed Stair on Floor 2 and the stair above Vaelra are placeholders (they say so in game).
- Optional: Higgsfield art for icons/portraits/key art (needs a new key in .env.local and approval for billable generations).
