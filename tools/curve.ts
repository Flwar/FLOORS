/**
 * Difficulty curve (npm run curve): seconds to kill each enemy, and seconds it takes to kill
 * you, for a typically geared climber of the enemy's level (monsters rise to meet you, so
 * on-level is the normal case). Targets, from how MMOs and ARPGs pace PvE:
 *   normal enemy  ~6–12 s    elite ~2–3× that    miniboss 45–90 s    floor boss 3–5 min
 * and you should outlast a normal enemy several times over.
 */
import { baseHp, ENEMIES, enemyDamageScale, enemyMaxHp, WEAPONS, type WeaponKey } from "@floors/shared";

/** What a climber of level L typically wields: tier power, rarity bonus, upgrades, mastery, defense, bonus health. */
function kit(L: number) {
  if (L <= 2) return { power: 100, rarity: 0, plus: 0, mastery: 1, def: 10, hp: 0 };
  if (L <= 4) return { power: 122, rarity: 0.06, plus: 1, mastery: 2, def: 18, hp: 4 };
  if (L <= 6) return { power: 132, rarity: 0.06, plus: 2, mastery: 3, def: 40, hp: 18 };
  if (L <= 8) return { power: 146, rarity: 0.12, plus: 2, mastery: 4, def: 54, hp: 28 };
  if (L <= 10) return { power: 156, rarity: 0.12, plus: 3, mastery: 5, def: 64, hp: 36 };
  if (L <= 12) return { power: 164, rarity: 0.12, plus: 3, mastery: 6, def: 74, hp: 48 };
  if (L <= 14) return { power: 184, rarity: 0.12, plus: 3, mastery: 7, def: 90, hp: 60 };
  if (L <= 16) return { power: 196, rarity: 0.2, plus: 4, mastery: 8, def: 104, hp: 72 };
  if (L <= 18) return { power: 206, rarity: 0.2, plus: 4, mastery: 9, def: 118, hp: 84 };
  if (L <= 20) return { power: 220, rarity: 0.25, plus: 4, mastery: 10, def: 130, hp: 96 };
  if (L <= 22) return { power: 230, rarity: 0.25, plus: 4, mastery: 10, def: 146, hp: 108 };
  if (L <= 24) return { power: 240, rarity: 0.3, plus: 5, mastery: 10, def: 160, hp: 120 };
  if (L <= 26) return { power: 252, rarity: 0.3, plus: 5, mastery: 10, def: 176, hp: 132 };
  if (L <= 28) return { power: 262, rarity: 0.35, plus: 5, mastery: 10, def: 190, hp: 144 };
  if (L <= 30) return { power: 276, rarity: 0.35, plus: 5, mastery: 10, def: 206, hp: 156 };
  if (L <= 32) return { power: 288, rarity: 0.4, plus: 5, mastery: 10, def: 222, hp: 168 };
  if (L <= 34) return { power: 300, rarity: 0.4, plus: 5, mastery: 10, def: 238, hp: 180 };
  return { power: 312, rarity: 0.45, plus: 5, mastery: 10, def: 254, hp: 192 };
}

/** Sustained light-chain damage per second, before multipliers. */
function chainDps(key: WeaponKey) {
  const w = WEAPONS.find((x) => x.key === key)!;
  let dmg = 0;
  let ticks = 0;
  for (const m of w.lights) {
    dmg += m.damage;
    ticks += Math.max(m.comboFrom ?? 0, m.startup + m.active);
  }
  ticks += w.lights[w.lights.length - 1].recovery;
  return dmg / (ticks / 60);
}

/** Share of a fight spent actually hitting (the rest is dodging, parrying and positioning). */
const UPTIME = 0.5;
/** Share of an enemy's attacks that land on a reasonable player. */
const TAKEN = 0.5;

const rows: [string, number][] = [
  ["wolf", 2], ["goblin", 2], ["archer", 3], ["cutpurse", 3], ["shieldbearer", 4], ["alpha", 4], ["cultist", 5], ["stalker", 5], ["brute", 6],
  ["grakk", 5], ["warden", 6], ["aurelion", 7],
  ["skylynx", 9], ["skyguard", 10], ["windcaller", 10], ["aegis", 11], ["stormadept", 11], ["sentinel", 12],
  ["colossus", 11], ["stormwarden", 11], ["vaelra", 12],
  ["ashling", 12], ["magmahound", 13], ["flamecaller", 13], ["emberguard", 14], ["obsidian", 14], ["drake", 14],
  ["cindermaw", 15], ["vyrmak", 15], ["ignivar", 16],
  ["rimewolf", 16], ["icewraith", 17], ["rimeguard", 18], ["yeti", 17], ["icegolem", 19], ["frostdrake", 18],
  ["glacierfang", 19], ["jarnhild", 19], ["hrimthar", 20],
  ["shade", 20], ["voidhound", 20], ["voidcaller", 21], ["abyssalknight", 22], ["voidgolem", 22], ["umbraldrake", 22],
  ["nightwing", 23], ["maelgrim", 23], ["nyxara", 24],
  ["brinehound", 24], ["drowned", 24], ["siren", 25], ["merrowguard", 26], ["coralgolem", 26], ["seadrake", 26],
  ["scylla", 27], ["blackbrine", 27], ["thalassa", 28],
  ["clockhound", 28], ["tinkerer", 29], ["cogsoldier", 29], ["sentry", 29], ["steamgolem", 30], ["brassdrake", 30],
  ["gearwyrm", 31], ["vulk", 31], ["archon", 32],
  ["sandjackal", 32], ["sunpriest", 33], ["tombguard", 33], ["sandwraith", 33], ["sandgolem", 34], ["sundrake", 34],
  ["sandmaw", 35], ["nephra", 35], ["solkaris", 36],
];
console.log("enemy          lvl    hp | sword ttk  gs ttk | you die in | kit");
for (const [key, L] of rows) {
  const def = ENEMIES.find((e) => e.key === key);
  if (!def) continue;
  const k = kit(L);
  const mult = (k.power / 100) * (1 + k.rarity) * (1 + 0.05 * k.plus) * (1 + 0.04 * (L - 1)) * (1 + 0.03 * (k.mastery - 1));
  const hp = enemyMaxHp(def, L);
  const ttk = (w: WeaponKey) => hp / (chainDps(w) * mult * UPTIME * (1 - def.armor));
  const real = def.attacks.filter((a) => a.damage > 0);
  const avgDmg = (real.reduce((n, a) => n + a.damage, 0) / Math.max(1, real.length)) * enemyDamageScale(def, L);
  const cycle = real.reduce((n, a) => n + (a.windup + a.active + a.recovery + (a.cooldown ?? 0) * 0.5) / 60, 0) / Math.max(1, real.length);
  const perHit = (avgDmg * 100) / (100 + k.def);
  const ttd = (baseHp(L) + k.hp) / ((perHit / cycle) * TAKEN);
  const fmt = (s: number) => (s >= 90 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(1)} s`).padStart(8);
  console.log(`${key.padEnd(13)} ${String(L).padStart(3)} ${String(hp).padStart(6)} | ${fmt(ttk("sword"))} ${fmt(ttk("greatsword"))} | ${fmt(ttd)}   | T${k.power} +${Math.round(k.rarity * 100)}% +${k.plus} m${k.mastery}`);
}
