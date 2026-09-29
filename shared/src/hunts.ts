/**
 * Hunter's Lore: the more of a kind you've slain, the better you know how to kill it. Ranks at
 * 25, 100 and 300 kills add 3%, 6% and then 10% damage against that kind (elites included).
 */
export const HUNT_RANKS = [25, 100, 300];
export const HUNT_BONUS = [0, 0.03, 0.06, 0.1];
export const HUNT_TITLES = ["", "Familiar", "Seasoned", "Master"];

export function huntRank(kills = 0) {
  let r = 0;
  for (const t of HUNT_RANKS) if (kills >= t) r++;
  return r;
}
export const huntBonus = (kills?: number) => HUNT_BONUS[huntRank(kills)];
