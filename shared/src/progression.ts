import { WEAPONS, type WeaponKey } from "./combat/weapons.ts";
import { Mod } from "./sim/player.ts";

export const MAX_LEVEL = 16;
/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => Math.round(85 * Math.pow(level, 1.55));
export const baseHp = (level: number) => 100 + (level - 1) * 10;
export const baseStamina = (level: number) => 100 + (level - 1) * 3;

export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  /** Step-level behaviour flag, if the perk changes shared simulation. */
  mod?: number;
}

/** Passive skills (learned from scrolls like everything else; see skillbook.ts). */
export const PERK_CHOICES: { level: number; options: [PerkDef, PerkDef] }[] = [
  {
    level: 3,
    options: [
      { id: "secondWind", name: "Second Wind", desc: "Perfect parries restore 6% of your health." },
      { id: "fleetfoot", name: "Fleetfoot", desc: "Your dodge carries you 15% further.", mod: Mod.LongDodge },
    ],
  },
  {
    level: 5,
    options: [
      { id: "riposteMaster", name: "Riposte Master", desc: "Ripostes deal 40% more damage." },
      { id: "ironSkin", name: "Iron Skin", desc: "+12 defense. Knockdowns end sooner." },
    ],
  },
  {
    level: 7,
    options: [
      { id: "executioner", name: "Executioner", desc: "+25% damage against staggered enemies." },
      { id: "deepLungs", name: "Deep Lungs", desc: "+15 maximum stamina." },
    ],
  },
  {
    level: 9,
    options: [
      { id: "unbroken", name: "Unbroken", desc: "Once every 2 minutes, a lethal blow leaves you at 1 health." },
      { id: "keenEye", name: "Keen Eye", desc: "Your parry window is wider.", mod: Mod.WideParry },
    ],
  },
  {
    level: 11,
    options: [
      { id: "momentum", name: "Momentum", desc: "Each hit in a combo deals 5% more damage (up to 25%)." },
      { id: "wardensGrace", name: "Warden's Grace", desc: "+10% maximum health." },
    ],
  },
  {
    level: 13,
    options: [
      { id: "emberblood", name: "Emberblood", desc: "Your blows have a 15% chance to set enemies burning." },
      { id: "scaleguard", name: "Scaleguard", desc: "+20 defense." },
    ],
  },
  {
    level: 15,
    options: [
      { id: "wyrmsbane", name: "Wyrmsbane", desc: "+15% damage against bosses and minibosses." },
      { id: "lastStand", name: "Last Stand", desc: "+20% damage while below 35% health." },
    ],
  },
];

export const perkById = (id: string) => PERK_CHOICES.flatMap((c) => c.options).find((p) => p.id === id);

// ---------------------------------------------------------------------------
// Weapon mastery: using a weapon class levels it up and unlocks how it plays.

export const MASTERY_MAX = 10;
const MASTERY_THRESHOLDS = [0, 60, 150, 280, 450, 680, 950, 1300, 1700, 2200];
/**
 * Mastery for felling an enemy, whatever its health: a normal kill is worth 8, so the
 * pace holds on every Floor (about 275 kills with one weapon for mastery 10). Damage
 * earns its share, so a party splits it. Minibosses and bosses are worth a lot more.
 */
export const masteryWorth = (def: { boss?: { music?: string } }, elite: boolean) =>
  def.boss ? (def.boss.music === "miniboss" ? 40 : 80) : elite ? 16 : 8;
export const masteryLevel = (xp: number) => {
  let l = 1;
  for (let i = 1; i < MASTERY_THRESHOLDS.length; i++) if (xp >= MASTERY_THRESHOLDS[i]) l = i + 1;
  return Math.min(MASTERY_MAX, l);
};
export const masteryProgress = (xp: number) => {
  const l = masteryLevel(xp);
  if (l >= MASTERY_MAX) return { level: l, into: 1, need: 1 };
  const lo = MASTERY_THRESHOLDS[l - 1];
  const hi = MASTERY_THRESHOLDS[l];
  return { level: l, into: xp - lo, need: hi - lo };
};

export interface MasteryUnlock {
  level: number;
  name: string;
  desc: string;
}

const PASSIVES: Record<WeaponKey, [MasteryUnlock, MasteryUnlock]> = {
  sword: [
    { level: 5, name: "Blade Reader", desc: "Parry window widened." },
    { level: 8, name: "Counter-Cut", desc: "Ripostes deal 30% more damage." },
  ],
  greatsword: [
    { level: 5, name: "Crusher", desc: "30% more stagger damage." },
    { level: 8, name: "Titan's Grip", desc: "10% more damage." },
  ],
  daggers: [
    { level: 5, name: "Light Feet", desc: "Dodging costs 30% less stamina." },
    { level: 8, name: "Assassin", desc: "Backstabs and ripostes deal 40% more damage." },
  ],
  spear: [
    { level: 5, name: "Long Reach", desc: "More knockback and stagger." },
    { level: 8, name: "Impaler", desc: "12% more damage." },
  ],
  staff: [
    { level: 5, name: "Arcane Flow", desc: "Skill cooldowns 25% shorter." },
    { level: 8, name: "Overcharge", desc: "15% more damage." },
  ],
};

export function masteryUnlocks(key: WeaponKey): MasteryUnlock[] {
  const w = WEAPONS.find((x) => x.key === key)!;
  const list: MasteryUnlock[] = [
    { level: 1, name: "Basics", desc: `Light chain and ${w.heavy.name}.` },
    { level: 2, name: w.comboHeavy.name, desc: "Press heavy mid-combo." },
  ];
  if (w.finisherMastery <= 10) list.push({ level: w.finisherMastery, name: w.lights[w.lights.length - 1].name, desc: "The chain gains its finisher." });
  list.push(PASSIVES[key][0]);
  list.push(PASSIVES[key][1]);
  list.push({ level: 10, name: `${w.name} Master`, desc: "Your weapon glows with mastery." });
  return list.sort((a, b) => a.level - b.level);
}

/** Simulation flags granted by mastery of the equipped weapon. */
export function masteryMods(key: WeaponKey, level: number): number {
  const w = WEAPONS.find((x) => x.key === key)!;
  let m = 0;
  if (level >= 2) m |= Mod.ComboHeavy;
  if (level >= w.finisherMastery) m |= Mod.Finisher;
  if (level >= 5 && key === "sword") m |= Mod.WideParry;
  if (level >= 5 && key === "daggers") m |= Mod.LightDodge;
  if (level >= 5 && key === "staff") m |= Mod.QuickCast;
  return m;
}

/** Server-side damage multipliers from mastery passives. */
export function masteryDamage(key: WeaponKey, level: number) {
  return {
    dmg: level >= 8 && key === "greatsword" ? 1.1 : level >= 8 && key === "spear" ? 1.12 : level >= 8 && key === "staff" ? 1.15 : 1,
    poise: level >= 5 && key === "greatsword" ? 1.3 : level >= 5 && key === "spear" ? 1.25 : 1,
    knock: level >= 5 && key === "spear" ? 1.4 : 1,
    riposte: level >= 8 && key === "sword" ? 1.3 : level >= 8 && key === "daggers" ? 1.4 : 1,
    backstab: level >= 8 && key === "daggers" ? 1.4 : 1,
    masteryGlow: level >= 10,
  };
}

/** Rewards for killing an enemy of a given level (split among contributors). */
export const killXp = (baseXp: number, enemyLevel: number, playerLevel: number) => {
  const diff = enemyLevel - playerLevel;
  const scale = diff >= 0 ? 1 + diff * 0.15 : Math.max(0.2, 1 + diff * 0.2);
  return Math.max(1, Math.round(baseXp * (1 + (enemyLevel - 1) * 0.1) * scale));
};
