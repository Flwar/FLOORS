/**
 * Inn meals: every innkeeper serves the same four dishes. A meal lasts a while and does one
 * thing well; eating another replaces it. The price rises with the floor (better kitchens,
 * dearer ingredients).
 */
export interface MealDef {
  id: string;
  name: string;
  desc: string;
  /** Extra maximum health (0.12 = +12%). */
  hpPct?: number;
  /** Extra damage (0.08 = +8%). */
  dmgPct?: number;
  /** Extra maximum stamina. */
  stamina?: number;
  /** Extra experience from kills (0.1 = +10%). */
  xpPct?: number;
  /** Colour of its chip on the HUD. */
  color: string;
}

export const MEALS: MealDef[] = [
  { id: "stew", name: "Hearty Stew", desc: "+12% maximum health.", hpPct: 0.12, color: "#c98f65" },
  { id: "skewers", name: "Spiced Skewers", desc: "Your blows land 8% harder.", dmgPct: 0.08, color: "#ff8a5a" },
  { id: "honeycakes", name: "Honey Cakes", desc: "+25 maximum stamina.", stamina: 25, color: "#f2c94c" },
  { id: "breakfast", name: "Hunter's Breakfast", desc: "+10% experience from kills.", xpPct: 0.1, color: "#9fe08a" },
];

/** How long a meal lasts. */
export const MEAL_MS = 20 * 60 * 1000;
export const mealById = (id: string | undefined) => MEALS.find((m) => m.id === id);
/** What a meal costs at an inn on this floor. */
export const mealPrice = (floor: number) => 20 + Math.max(0, floor - 1) * 30;
