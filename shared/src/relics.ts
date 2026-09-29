import { floorDef } from "./tower.ts";

/**
 * Floor Boss trophies. Each Floor Boss leaves its trophy only with the one who defeated it,
 * and the trophy keeps a little of the boss's power for them:
 *   - the Fragment of the First Gate (Aurelion, Keeper of the First Gate) opens the way to the
 *     town of any floor that's open to you;
 *   - every other trophy takes you home to its own floor's town.
 * They share one cooldown, don't work mid-fight, and can't reach into a dungeon.
 */
export const RELICS: Record<string, { floor: number; gate?: boolean }> = {
  art_gatestone: { floor: 1, gate: true },
  art_stormheart: { floor: 2 },
  art_dragonheart: { floor: 3 },
  art_wintercrown: { floor: 4 },
  art_eclipse: { floor: 5 },
  art_tidecrown: { floor: 6 },
  art_archoncore: { floor: 7 },
};

/** How long a trophy needs before it will carry you again (shared by all of them). */
export const RELIC_COOLDOWN_MS = 5 * 60 * 1000;

export const relicOf = (key: string | undefined) => (key ? RELICS[key] : undefined);

/** What a trophy does, for its tooltip. */
export function relicPower(key: string): string | undefined {
  const r = RELICS[key];
  if (!r) return undefined;
  if (r.gate) return "Use: step through the First Gate to the town of any floor that's open to you.";
  const f = floorDef(r.floor);
  return f ? `Use: return to ${f.town}, on Floor ${r.floor}.` : undefined;
}
