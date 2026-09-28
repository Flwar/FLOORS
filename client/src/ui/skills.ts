import {
  cannotLearn, itemBase, itemMasteryLevel, keyLabel, NO_SKILL, TREE_IDS, TREES, weaponMasteryDamage, WEAPONS, type Item, type TreeId, type TreeNode, type WeaponKey,
} from "@floors/shared";
import { itemIcon } from "./icons.ts";
import { skillIcon } from "./skillIcons.ts";
import { iconImg, uiIcon, type UiIconName } from "./uiIcons.ts";

/** What the Skills panel needs from the character view. */
export interface SkillView {
  level: number;
  tree: string[];
  points: { total: number; left: number };
  resetCost: number;
  gold: number;
  loadout: Record<WeaponKey, [number, number]>;
  equipment: { weapon?: Item };
}

const TAB_ITEM: Record<WeaponKey, string> = { sword: "sword_iron", greatsword: "greatsword_iron", daggers: "daggers_twin", spear: "spear_hunting", staff: "staff_oak" };
const KIND_LABEL: Record<TreeNode["kind"], string> = { skill: "Skill", move: "Combo move", passive: "Passive", perk: "Perk" };

// Remembered between re-renders.
let tab: TreeId | undefined;
const selected = new Map<TreeId, string>();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const el = <T extends HTMLElement = HTMLElement>(html: string) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
};

function nodeIcon(n: TreeNode, px: number): string {
  if (n.kind === "skill") return skillIcon(n.id, px);
  const icon: UiIconName = n.kind === "move" ? "sword" : n.kind === "passive" ? "star" : "xp";
  return uiIcon(icon, px);
}

function state(n: TreeNode, v: SkillView): "learned" | "open" | "locked" {
  if (v.tree.includes(n.id)) return "learned";
  return cannotLearn(n.id, v.tree, v.level, Math.max(1, v.points.left)) ? "locked" : "open";
}

/**
 * The Skills panel body. `send` talks to the server; `keys` are the labels of the two
 * skill-slot bindings.
 */
export function renderSkills(v: SkillView, send: (type: string, msg?: unknown) => void, keys: [string, string]): HTMLElement {
  const inHand = (v.equipment.weapon && itemBase(v.equipment.weapon.key)?.weapon) || "sword";
  tab ??= inHand;
  const t = tab;
  const body = el(`<div class="skills"></div>`);

  // Header: points and reset.
  const head = el(`<div class="sk-head">
    <div class="sk-points${v.points.left ? " has" : ""}">${iconImg("xp", 26)}<div><b>${v.points.left}</b> skill point${v.points.left === 1 ? "" : "s"} to spend<span>One per level, more from the main story · ${v.points.total - v.points.left} spent</span></div></div>
    <button class="ghost sk-reset" ${v.tree.length ? "" : "disabled"}>Reset all (${v.resetCost} gold)</button>
  </div>`);
  head.querySelector(".sk-reset")!.addEventListener("click", () => {
    if (confirm(`Unlearn every skill and get all your points back for ${v.resetCost} gold?`)) send("tree:reset");
  });
  body.append(head);

  // Tabs.
  const tabs = el(`<div class="sk-tabs"></div>`);
  for (const id of TREE_IDS) {
    const count = TREES[id].filter((n) => v.tree.includes(n.id)).length;
    const name = id === "general" ? "General" : WEAPONS.find((w) => w.key === id)!.name;
    const icon = id === "general" ? uiIcon("character", 22) : itemIcon(TAB_ITEM[id], 0);
    const b = el(`<button class="sk-tab${id === t ? " on" : ""}${id === inHand ? " hand" : ""}"><img src="${icon}" alt=""><span>${name}</span><small>${count}/${TREES[id].length}</small></button>`);
    b.addEventListener("click", () => {
      tab = id;
      body.replaceWith(renderSkills(v, send, keys));
    });
    tabs.append(b);
  }
  body.append(tabs);

  const main = el(`<div class="sk-main"></div>`);
  // Tree grid with connectors.
  const nodes = TREES[t];
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  const CW = 84;
  const RH = 86;
  const grid = el(`<div class="sk-tree" style="width:${CW * 5}px;height:${RH * rows}px"></div>`);
  const pos = (n: TreeNode) => ({ x: n.col * CW + CW / 2, y: n.row * RH + 34 });
  const lines: string[] = [];
  for (const n of nodes) {
    for (const r of n.requires) {
      const from = nodes.find((q) => q.id === r);
      if (!from) continue;
      const a = pos(from);
      const b = pos(n);
      const lit = v.tree.includes(r) && v.tree.includes(n.id);
      const open = v.tree.includes(r);
      lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${lit ? "lit" : open ? "open" : ""}"/>`);
    }
  }
  grid.append(el(`<svg class="sk-lines" width="${CW * 5}" height="${RH * rows}">${lines.join("")}</svg>`));
  if (t === "general") {
    for (let r = 0; r < rows; r++) {
      const lvl = nodes.find((n) => n.row === r)?.level;
      grid.append(el(`<div class="sk-rowlvl" style="top:${r * RH + 26}px">Lv ${lvl}</div>`));
    }
  }
  const sel = selected.get(t) ?? nodes.find((n) => state(n, v) === "open")?.id ?? nodes[0].id;
  for (const n of nodes) {
    const st = state(n, v);
    const p = pos(n);
    const b = el(`<button class="sk-node ${st}${n.id === sel ? " sel" : ""} k-${n.kind}" style="left:${p.x - 29}px;top:${p.y - 29}px" title="${esc(n.name)}">
      <img src="${nodeIcon(n, 50)}" alt="">${st === "locked" ? `<span class="sk-lock">${iconImg("lock", 16)}</span>` : ""}${st === "learned" ? `<span class="sk-tick">${iconImg("check", 16)}</span>` : ""}
      <span class="sk-label">${esc(n.name)}</span></button>`);
    b.addEventListener("click", () => {
      selected.set(t, n.id);
      body.replaceWith(renderSkills(v, send, keys));
    });
    b.addEventListener("dblclick", () => {
      if (st === "open") send("tree:learn", n.id);
    });
    grid.append(b);
  }
  main.append(grid);

  // Details card.
  const n = nodes.find((q) => q.id === sel)!;
  const st = state(n, v);
  const why = cannotLearn(n.id, v.tree, v.level, v.points.left);
  const card = el(`<div class="sk-card">
    <div class="sk-card-head"><img src="${nodeIcon(n, 64)}" alt=""><div><div class="sk-kind">${KIND_LABEL[n.kind]}${n.tree !== "general" ? ` · ${WEAPONS.find((w) => w.key === n.tree)!.name}` : ""}</div><h3>${esc(n.name)}</h3></div></div>
    <p class="sk-desc">${esc(n.desc)}</p>
    <div class="sk-stats"></div>
    <div class="sk-actions"></div>
  </div>`);
  const stats = card.querySelector(".sk-stats")!;
  if (n.kind === "skill") {
    const w = WEAPONS.find((q) => q.key === n.tree)!;
    const m = w.skills[n.skill!];
    const row = (icon: UiIconName, label: string, val: string) => stats.append(el(`<div>${iconImg(icon, 16)}<span>${label}</span><b>${val}</b></div>`));
    if (m.damage) row("kill", "Damage", String(m.damage));
    row("cooldown", "Cooldown", `${((m.cooldown ?? 0) / 60).toFixed(m.cooldown && m.cooldown % 60 ? 1 : 0)} s`);
    row("stamina", "Stamina", String(m.stamina));
    if (m.iframes) row("parry", "Untouchable", `${Math.round(((m.iframes[1] - m.iframes[0]) / 60) * 1000)} ms`);
    if (m.superArmor) row("shield", "Unstoppable", "while striking");
  }
  const req = n.requires.length ? `Needs ${n.requires.map((r) => TREES[t].find((q) => q.id === r)?.name ?? r).join(" or ")}` : "";
  stats.append(el(`<div class="sk-req">${iconImg("character", 16)}<span>Level ${n.level}${req ? ` · ${esc(req)}` : ""}</span></div>`));

  const actions = card.querySelector(".sk-actions")!;
  if (st === "learned") {
    actions.append(el(`<div class="sk-learned">${iconImg("check", 18)} Learned</div>`));
    if (n.kind === "skill") {
      const wk = n.tree as WeaponKey;
      const lo = v.loadout[wk] ?? [NO_SKILL, NO_SKILL];
      for (const slot of [0, 1]) {
        const on = lo[slot] === n.skill;
        const b = el(`<button class="${on ? "ghost" : ""}">${on ? `In slot ${keys[slot]}` : `Equip to slot ${keys[slot]}`}</button>`);
        if (!on) b.addEventListener("click", () => send("skills:equip", { weapon: wk, slot, index: n.skill }));
        actions.append(b);
      }
    }
  } else {
    const b = el(`<button class="sk-learn" ${why ? "disabled" : ""}>${iconImg("xp", 18)} Learn · 1 point</button>`);
    b.addEventListener("click", () => send("tree:learn", n.id));
    actions.append(b);
    if (why) actions.append(el(`<div class="sk-why">${esc(why)}</div>`));
  }

  // The weapon in hand: its mastery and its two skill slots.
  const side = el(`<div class="sk-side"></div>`);
  side.append(card);
  if (t !== "general") {
    const wk = t as WeaponKey;
    const lo = v.loadout[wk] ?? [NO_SKILL, NO_SKILL];
    const w = WEAPONS.find((q) => q.key === wk)!;
    const slots = el(`<div class="sk-slots"><h4>Equipped ${w.name} skills</h4><div class="sk-slot-row"></div></div>`);
    const row = slots.querySelector(".sk-slot-row")!;
    lo.forEach((idx, slot) => {
      const m = idx !== NO_SKILL ? w.skills[idx] : undefined;
      const s = el(`<div class="sk-slot${m ? "" : " empty"}"><kbd>${esc(keys[slot])}</kbd>${m ? `<img src="${skillIcon(m.id!, 44)}" alt="">` : "<span>+</span>"}<small>${m ? esc(m.name) : "Empty"}</small></div>`);
      if (m) {
        s.title = "Click to empty this slot";
        s.addEventListener("click", () => send("skills:equip", { weapon: wk, slot, index: NO_SKILL }));
      }
      row.append(s);
    });
    if (wk === inHand && v.equipment.weapon) {
      const lvl = itemMasteryLevel(v.equipment.weapon.mxp);
      const bonus = Math.round((weaponMasteryDamage(lvl) - 1) * 100);
      slots.append(el(`<div class="sk-mastery">${iconImg("sword", 16)}<span>Your ${esc(itemBase(v.equipment.weapon.key)?.name ?? w.name)}: mastery ${lvl}/10${bonus ? ` (+${bonus}% damage)` : ""}</span></div>`));
    } else slots.append(el(`<div class="sk-mastery dim">Equip a ${w.name.toLowerCase()} to use these skills.</div>`));
    side.append(slots);
  }
  main.append(side);
  body.append(main);
  body.append(el(`<div class="hint">Click a skill to see it · Double-click or press Learn to spend a point · Skills fire with ${esc(keys[0])} and ${esc(keys[1])}</div>`));
  return body;
}

export { keyLabel };
