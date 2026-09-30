/**
 * Loot odds (npm run loot [rolls] [tables…]): per-kill chance of a rare, epic or legendary
 * piece of equipment from each loot table, simulated. Use it when tuning drops.
 */
import { itemBase, LOOT, rollLoot } from "@floors/shared";
import "@floors/shared";
const N = Number(process.argv[2] ?? 200000);
const tables = process.argv.slice(3).length ? process.argv.slice(3) : ["goblin", "bandit", "brute", "elite", "grakk", "warden", "aurelion", "f2soldier", "f2construct", "stormwarden", "colossus", "vaelra", "f3beast", "f3soldier", "f3construct", "f3drake", "cindermaw", "vyrmak", "ignivar"];
const pct = (n: number) => (n / N * 100).toFixed(n / N < 0.01 ? 2 : 1).padStart(6) + "%";
console.log("table        rare+     epic   legendary  (per kill, equipment only)");
for (const t of tables) {
  if (!LOOT[t]) continue;
  let rare = 0, epic = 0, leg = 0;
  for (let i = 0; i < N; i++) {
    const d = rollLoot(t, { elite: t === "elite" ? false : false });
    let r = -1;
    for (const it of d.items) {
      const b = itemBase(it.key);
      if (!b || !["weapon", "armor", "helm", "charm"].includes(b.kind)) continue;
      r = Math.max(r, it.rarity);
    }
    if (r >= 2) rare++;
    if (r >= 3) epic++;
    if (r >= 4) leg++;
  }
  console.log(`${t.padEnd(12)} ${pct(rare)} ${pct(epic)} ${pct(leg)}`);
}
