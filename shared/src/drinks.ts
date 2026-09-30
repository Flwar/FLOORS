/**
 * Drinks at the bar: every innkeeper pours the same four. A drink lasts a while and does one
 * thing well; ordering another replaces it. The price rises with the floor (the higher the
 * tower, the further the barrels were carried).
 */
export interface DrinkDef {
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
  /** Colour of its chip on the HUD (and of the drink). */
  color: string;
}

export const DRINKS: DrinkDef[] = [
  { id: "ale", name: "Ironbark Ale", desc: "+12% maximum health.", hpPct: 0.12, color: "#c98f3a" },
  { id: "whisky", name: "Dragonfire Whisky", desc: "Your blows land 8% harder.", dmgPct: 0.08, color: "#ff7a3a" },
  { id: "mead", name: "Honey Mead", desc: "+25 maximum stamina.", stamina: 25, color: "#f2c94c" },
  { id: "cider", name: "Hunter's Cider", desc: "+10% experience from kills.", xpPct: 0.1, color: "#9fe08a" },
];

/** How long a drink lasts. */
export const DRINK_MS = 20 * 60 * 1000;
export const drinkById = (id: string | undefined) => DRINKS.find((m) => m.id === id);
/** What a drink costs at a bar on this floor. */
export const drinkPrice = (floor: number) => 20 + Math.max(0, floor - 1) * 30;
