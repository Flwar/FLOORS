# Build plan and status

Spec: [BRIEF.md](BRIEF.md) (owner override: 2D, not 2.5D 3D). Work follows the brief's
priority order; each phase is run, tested (including multiplayer) and polished before
the next starts.

## Stack
- `client/` — Phaser 4 + Vite, TypeScript. All art, animation, effects, audio and music are
  generated in code (no downloaded assets). DOM overlay for HUD and UI panels.
- `server/` — Colyseus 0.18, 60 Hz fixed-step simulation, 30 Hz patches. Rooms: `world`
  (persistent Floor 1), `dungeon` (per-party Undercroft instance), `floor2` (Skyreach Landing).
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
| 17 | Polish | ongoing |

## Known gaps / next
- Touch controls.
- Floor 2 is a landing area only (by design: build Floor 1 well first).
- Optional: Higgsfield art for icons/portraits/key art (needs a new key in .env.local and approval for billable generations).
