import { WEAPONS, type WeaponKey } from "./combat/weapons.ts";
import { MASTERY_MAX, masteryLevel, PERK_CHOICES } from "./progression.ts";
import { Mod } from "./sim/player.ts";

/**
 * The skill tree: one tree per weapon type (its skills, combo heavy, finisher and two
 * passives) and a General tree of perks. Every node costs one skill point; points come
 * from character levels and main-story quests.
 */

export type TreeId = WeaponKey | "general";
export const TREE_IDS: TreeId[] = ["sword", "greatsword", "daggers", "spear", "staff", "general"];

export interface TreeNode {
  id: string;
  tree: TreeId;
  name: string;
  desc: string;
  kind: "skill" | "move" | "passive" | "perk";
  /** Skills: index into the weapon's skill pool. */
  skill?: number;
  /** Learn any one of these first. */
  requires: string[];
  /** Character level needed. */
  level: number;
  row: number;
  col: number;
}

const PREFIX: Record<WeaponKey, string> = { sword: "sword", greatsword: "gs", daggers: "dg", spear: "sp", staff: "st" };

const PASSIVES: Record<WeaponKey, [[string, string], [string, string]]> = {
  sword: [["Blade Reader", "Your parry window is wider with a sword."], ["Counter-Cut", "Sword ripostes deal 30% more damage."]],
  greatsword: [["Crusher", "Greatsword hits deal 30% more stagger."], ["Titan's Grip", "Greatsword attacks deal 10% more damage."]],
  daggers: [["Light Feet", "Dodging with daggers costs 30% less stamina."], ["Assassin", "Dagger backstabs and ripostes deal 40% more damage."]],
  spear: [["Long Reach", "Spear hits knock back 40% further and stagger 25% more."], ["Impaler", "Spear attacks deal 12% more damage."]],
  staff: [["Arcane Flow", "Staff skill cooldowns are 25% shorter."], ["Overcharge", "Staff attacks deal 15% more damage."]],
};

/** Row → character level needed. */
const ROW_LEVEL = [1, 2, 4, 6, 8];

function weaponTree(key: WeaponKey): TreeNode[] {
  const w = WEAPONS.find((x) => x.key === key)!;
  const p = PREFIX[key];
  const sk = (i: number, row: number, col: number, requires: string[]): TreeNode => ({
    id: w.skills[i].id!, tree: key, name: w.skills[i].name, desc: w.skills[i].desc ?? "", kind: "skill", skill: i, requires, level: ROW_LEVEL[row], row, col,
  });
  const s = (i: number) => w.skills[i].id!;
  const finisher = w.lights[w.lights.length - 1];
  return [
    sk(0, 0, 1, []),
    { id: `${p}.combo`, tree: key, name: w.comboHeavy.name, desc: `Press heavy in the middle of a combo for ${w.comboHeavy.name}.`, kind: "move", requires: [], level: 1, row: 0, col: 3 },
    sk(2, 1, 0, [s(0)]),
    { id: `${p}.p1`, tree: key, name: PASSIVES[key][0][0], desc: PASSIVES[key][0][1], kind: "passive", requires: [s(0), `${p}.combo`], level: ROW_LEVEL[1], row: 1, col: 2 },
    { id: `${p}.finisher`, tree: key, name: finisher.name, desc: `Your light chain ends with ${finisher.name}.`, kind: "move", requires: [`${p}.combo`], level: ROW_LEVEL[1], row: 1, col: 4 },
    sk(1, 2, 1, [s(2), `${p}.p1`]),
    sk(3, 2, 3, [`${p}.p1`, `${p}.finisher`]),
    { id: `${p}.p2`, tree: key, name: PASSIVES[key][1][0], desc: PASSIVES[key][1][1], kind: "passive", requires: [s(1)], level: ROW_LEVEL[3], row: 3, col: 1 },
    sk(4, 3, 3, [s(3)]),
    sk(5, 4, 2, [`${p}.p2`, s(4)]),
  ];
}

function generalTree(): TreeNode[] {
  return PERK_CHOICES.flatMap((c, row) =>
    c.options.map((o, i): TreeNode => ({ id: o.id, tree: "general", name: o.name, desc: o.desc, kind: "perk", requires: [], level: c.level, row, col: i === 0 ? 1 : 3 })),
  );
}

export const TREES: Record<TreeId, TreeNode[]> = {
  sword: weaponTree("sword"),
  greatsword: weaponTree("greatsword"),
  daggers: weaponTree("daggers"),
  spear: weaponTree("spear"),
  staff: weaponTree("staff"),
  general: generalTree(),
};

const BY_ID = new Map(Object.values(TREES).flat().map((n) => [n.id, n]));
export const treeNode = (id: string) => BY_ID.get(id);

/** One point per character level, plus points from main-story quests. */
export const skillPointsTotal = (level: number, bonus: number) => level + bonus;

/** Why a node can't be learned right now (undefined = it can). */
export function cannotLearn(id: string, learned: readonly string[], level: number, pointsLeft: number): string | undefined {
  const n = BY_ID.get(id);
  if (!n) return "Unknown skill.";
  if (learned.includes(id)) return "Already learned.";
  if (level < n.level) return `Reach level ${n.level} first.`;
  if (n.requires.length && !n.requires.some((r) => learned.includes(r))) {
    return `Learn ${n.requires.map((r) => BY_ID.get(r)?.name ?? r).join(" or ")} first.`;
  }
  if (pointsLeft <= 0) return "No skill points left. You earn one each level.";
  return undefined;
}

/** Skill-pool indices of a weapon's learned skills. */
export function learnedSkills(key: WeaponKey, learned: readonly string[]): number[] {
  return TREES[key].filter((n) => n.kind === "skill" && learned.includes(n.id)).map((n) => n.skill!);
}

/** Simulation flags from the tree for the weapon in hand. */
export function treeMods(key: WeaponKey, learned: readonly string[]): number {
  const p = PREFIX[key];
  let m = 0;
  if (learned.includes(`${p}.combo`)) m |= Mod.ComboHeavy;
  if (learned.includes(`${p}.finisher`)) m |= Mod.Finisher;
  if (learned.includes(`${p}.p1`)) {
    if (key === "sword") m |= Mod.WideParry;
    if (key === "daggers") m |= Mod.LightDodge;
    if (key === "staff") m |= Mod.QuickCast;
  }
  if (learned.includes("fleetfoot")) m |= Mod.LongDodge;
  if (learned.includes("keenEye")) m |= Mod.WideParry;
  return m;
}

/** Damage multipliers from the tree's passives for the weapon in hand, and the weapon's own mastery. */
export function combatBonus(key: WeaponKey, learned: readonly string[], weaponMastery: number) {
  const p = PREFIX[key];
  const p1 = learned.includes(`${p}.p1`);
  const p2 = learned.includes(`${p}.p2`);
  return {
    dmg: (p2 && key === "greatsword" ? 1.1 : p2 && key === "spear" ? 1.12 : p2 && key === "staff" ? 1.15 : 1) * weaponMasteryDamage(weaponMastery),
    poise: p1 && key === "greatsword" ? 1.3 : p1 && key === "spear" ? 1.25 : 1,
    knock: p1 && key === "spear" ? 1.4 : 1,
    riposte: p2 && key === "sword" ? 1.3 : p2 && key === "daggers" ? 1.4 : 1,
    backstab: p2 && key === "daggers" ? 1.4 : 1,
    masteryGlow: weaponMastery >= MASTERY_MAX,
  };
}

// ---------------------------------------------------------------------------
// Weapon mastery lives on each weapon: the one you fight with grows stronger.

/** +3% damage per mastery level above 1 (up to +27% at 10). */
export const weaponMasteryDamage = (level: number) => 1 + (Math.max(1, level) - 1) * 0.03;

export const itemMasteryLevel = (mxp: number | undefined) => masteryLevel(mxp ?? 0);

/** Main-story quests that award a skill point. */
export const QUEST_SKILL_POINTS: Record<string, number> = { q_welcome: 1, q_grakk: 1, q_undercroft: 1, q_keeper: 1, f2_causeway: 1, f2_storm: 1, f2_spire: 1 };

export { PREFIX as WEAPON_TREE_PREFIX };
