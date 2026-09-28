# Game brief — online action RPG (governing spec)

This is the owner's master brief, condensed but complete. It governs every design
decision. **Owner override:** the game is **2D** (top-down, slight 3/4 view, sprites),
not the 2.5D low-poly 3D the original brief describes. Everything else stands.

Core fantasy: *Start weak. Explore. Fight. Survive. Find powerful gear. Master combat.
Defeat the floor boss. Unlock the next floor. Keep climbing.* Gameplay over menus.
Not D&D, not turn-based, not text, not a UI demo, not a basic MMO template.

## 1. World
- A huge floating structure made of stacked **floors**; each floor is its own region
  (towns, wilderness, forests, ruins, caves, dungeons, hidden areas, enemy camps,
  elites, quests, secrets, rare encounters, world events, a floor dungeon, a **Floor Boss**).
- Players start on Floor 1; only Floor 1 is open. Beating the Floor Boss unlocks the next floor.
- Each floor feels different. Build **one excellent floor** first — no empty floors.

## 2. Persistent online world
- The world itself is multiplayer — no create-room / join-code flow.
- See other players, move/fight/explore together, parties, dungeons, bosses, inspect,
  communicate, revive/help. Characters persist; logout never resets progress.

## 3–7. Combat (most important system)
- Responsive, smooth, fast, satisfying, readable, **skill-based** (not stat-based) —
  a skilled player beats stronger enemies.
- Actions: move, sprint, basic attack, combo, heavy, dodge, parry, block where
  appropriate, abilities, weapon skills.
- Feedback: hit reactions, animation blending, impact FX, sound, particles, subtle
  camera response, enemy reactions, readable telegraphs. Never trade responsiveness
  for pretty animation.
- **Dodge:** extremely responsive, directional, brief i-frames, stamina cost, cancel
  rules; no endless spam — timing matters.
- **Parry:** higher skill ceiling than dodge. Press shortly before a hit lands. Success
  blocks, gives strong audio/visual feedback, staggers normal enemies, opens a counter.
  Perfect parries reward more. Bosses: parry interacts with specific attacks, never
  trivialises the fight. Bad timing leaves you vulnerable. Must feel SATISFYING.
- **Weapons change gameplay** — Sword (balanced, fast, strong parry), Greatsword (slow,
  heavy, big stagger, long recovery), Daggers (very fast, short, mobile), Spear (reach,
  spacing), Staff (magic, different rhythm). Each: own animations, timings, combos,
  heavies, abilities, strengths, weaknesses. Never the same attack with new numbers.
- **Combos** flow with decisions (light→light→heavy, light→dodge→counter,
  parry→counter, ability→combo). No long automatic strings; player stays in control.

## 8–10. Enemies and bosses
- Archetypes: aggressive melee, defensive, ranged, fast assassin, heavy, caster, pack,
  elite. AI understands distance, range, cooldowns, positioning, player actions,
  nearby allies. Telegraph dangerous attacks; behaviour is learnable.
- Bosses: unique look, arena, attacks, patterns, **phases**, telegraphs, mechanics,
  music, rewards. Never "normal enemy × 50 HP". Win by learning the fight.
- **Floor Boss is an event:** requires exploration/preparation; boss dungeon with
  enemies, puzzles, minibosses, checkpoints, environmental storytelling; cinematic
  arena entrance, title card, music change; victory opens the next floor — one of the
  most satisfying moments in the game.

## 11–14. Loot, drops, death
- Weapons, armor, accessories, materials, consumables, rare artifacts. Rarity
  Common→Uncommon→Rare→Epic→Legendary. Not a loot explosion; rare means rare.
- Items drop physically in the world: distinct sound, subtle rarity effect, info on
  approach, pick up. No casino / loot-box presentation.
- Death matters (durability loss, temporary penalty, lose some carried resources,
  chance to drop non-essential items) but never account-ruining; progression items
  protected. "I don't want to die", not "one death ruins me".
- Dropped-on-death items stay at the death spot for a limited time; clear rules for
  others. Guard against duplication, disconnect exploits, fake deaths, rollback
  exploits. **All valuable state server-authoritative.**

## 15–18. Progression
- Levels, equipment, weapon mastery, abilities, exploration, boss progress,
  achievements — progression unlocks **gameplay changes**, not just +2 damage.
- **Weapon mastery** per category unlocks attacks, passives, abilities, combo variants.
- **Abilities** complement weapon play; they create decisions, not cooldown rotation.
- **Exploration rewarded:** caves, treasure, elites, rare NPCs, shortcuts, lore, secret
  bosses, rare resources, hidden quests, unusual gear. "What is that?" → go look.

## 19–25. Floor 1 content
- **Safe town:** spawn, shops, NPCs, quests, storage, equipment services, social area.
  Enemies cannot enter safe zones; leaving town must feel meaningful.
- Areas (non-linear, with alternate routes, secrets, optional areas):
  Town → Green Fields → Forest → Ruins → Cave System → Boss Dungeon.
- **Quests** beyond "kill 10 wolves": exploration, hunts, minibosses, missing NPCs,
  hidden locations, dangerous deliveries, investigations, dungeon objectives.
- **World events:** powerful enemy appears, village attacked, rare spawn, hidden
  dungeon opens, travelling merchant. Nearby players join in.
- **Parties:** invite, leave, kick, leader, party HP display, shared quest progress,
  party chat, dungeon entry. Small party size.
- **Dungeons:** more dangerous than the overworld; encounters, minibosses, traps,
  puzzles, secrets, loot, boss. Some solo, some party-oriented.

## 26–31. Presentation
- Stylised, readable, beautiful, atmospheric, performant, cohesive; its own identity.
  No mismatched assets, no placeholder shapes in the shipped game, no photorealism.
- Camera: smooth follow, combat always readable, frames bosses, subtle feedback,
  sparing screen shake.
- **Animation quality is critical:** idle, walk, run, sprint, attack, heavy, combo,
  dodge, parry, hit reaction, death, abilities — with smooth transitions, not
  disconnected clips.
- Social towns: see, inspect, party, chat, show off equipment. **Equipment is visible
  on the character.** Rare gear on another player should be exciting.
- Clean UI; the screen shows the game. HUD: health, stamina/resource, abilities,
  buffs/debuffs, objective, party. Menus: inventory, character, equipment, quests,
  map, settings, party — no giant panels.
- Floor map revealed through exploration: towns, landmarks, dungeon entrances,
  quests, party members. Secrets are never auto-revealed.

## 32–36. Technical
- **Server authoritative:** damage, health, enemy state, drops, inventory, XP, loot,
  boss progression, death, trading, currency. Never trust the client.
- **Persist:** account, character, level, XP, equipment, inventory, weapon mastery,
  abilities, quests, boss progression, discovered areas, settings.
- Performance: many players and enemies; optimise sync, AI, effects, assets,
  animation, world loading. **Relevance/distance-based networking.**
- World split into regions/chunks; load only what is needed; smooth transitions.
- Sound: swings, impacts, parry, **perfect parry** (instantly recognisable), dodge,
  footsteps, enemies, abilities, ambience, loot, boss music.

## 37. First playable (vertical slice)
Account/character persistence, online multiplayer, movement, polished animation, town,
wilderness, enemies, real-time combat, dodge, parry, multiple weapon behaviours, loot,
inventory, equipment, XP, death, parties, a dungeon, a miniboss, the Floor 1 boss, and
the unlocked next-floor gate. Polished enough that a player understands why the full
game would be fun.

## 38–41. Process rules
- **Never fake systems.** A Party button isn't parties; 10,000 HP isn't a boss; +20
  damage isn't a weapon system; a dodge animation isn't a dodge system.
- Keep asking: does moving / attacking / hitting / parrying / dodging / rare loot /
  danger / boss victory feel good? If not, **polish before expanding**.
- Work phase by phase. After each phase: build/run, fix compile and runtime errors,
  test in real gameplay, check multiplayer, polish, then continue. Never claim a
  feature is complete without testing it.
- Priority: 1 movement+camera · 2 animation · 3 core combat · 4 enemy combat ·
  5 dodge · 6 parry · 7 multiplayer sync · 8 death · 9 inventory/equipment · 10 loot ·
  11 progression · 12 Floor 1 world · 13 dungeon · 14 boss · 15 parties ·
  16 persistence · 17 polish · 18 more content.

**Final vision:** log in, see adventurers preparing in town, equip, leave the safe zone,
fight with timing and skill, dodge, perfectly parry, find gear, discover secrets, grow
stronger, meet players, form a party, find the Floor Dungeon, fight through it, learn
and defeat the boss — a path opens upward, and there is a whole world above waiting.
**Make the combat feel amazing first. Make Floor 1 feel like a real game. Then expand upward.**
