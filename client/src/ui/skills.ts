import {
  FLOOR_NAMES, itemBase, itemMasteryLevel, keyLabel, masteryUnlocks, NO_SKILL, RARITY_COLORS, RARITY_NAMES, SCROLL_PRICE, scrollSource, SKILLBOOK, skillMove,
  usableWith, weaponMasteryDamage, WEAPONS, type Item, type SkillEntry, type WeaponKey,
} from "@floors/shared";
import { itemIcon } from "./icons.ts";
import { passiveIcon, skillIcon } from "./skillIcons.ts";
import { iconImg, type UiIconName } from "./uiIcons.ts";

/** What the Skills panel needs from the character view. */
export interface SkillView {
  level: number;
  skills: string[];
  marks: number;
  gold: number;
  loadout: Record<WeaponKey, [number, number]>;
  equipment: { weapon?: Item };
}

type Tab = WeaponKey | "universal" | "passive";
const TABS: Tab[] = ["sword", "greatsword", "daggers", "spear", "staff", "universal", "passive"];
const TAB_ITEM: Record<WeaponKey, string> = { sword: "sword_iron", greatsword: "greatsword_iron", daggers: "daggers_twin", spear: "spear_hunting", staff: "staff_oak" };

// Remembered between re-renders.
let tab: Tab | undefined;
const selected = new Map<Tab, string>();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const el = <T extends HTMLElement = HTMLElement>(html: string) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
};

/** A skill book entry's icon. */
export function entryIcon(e: SkillEntry, px: number): string {
  return e.kind === "passive" ? passiveIcon(e.id, px) : skillIcon(e.id, px);
}

const inTab = (e: SkillEntry, t: Tab) => (t === "passive" ? e.kind === "passive" : t === "universal" ? e.kind === "skill" && !e.weapon : e.weapon === t);
const tabName = (t: Tab) => (t === "universal" ? "Every weapon" : t === "passive" ? "Passives" : WEAPONS.find((w) => w.key === t)!.name);

/**
 * The Skill Book: every skill in the game, grouped by weapon, with the ones you know lit
 * up. Skills are learned by reading scrolls; here you see what each does, where its scroll
 * can be found, and which two sit in your slots. `send` talks to the server; `keys` are the
 * labels of the two skill-slot bindings.
 */
export function renderSkills(v: SkillView, send: (type: string, msg?: unknown) => void, keys: [string, string]): HTMLElement {
  const inHand: WeaponKey = (v.equipment.weapon && itemBase(v.equipment.weapon.key)?.weapon) || "sword";
  tab ??= inHand;
  const t = tab;
  const known = new Set(v.skills);
  const body = el(`<div class="skills"></div>`);
  const rerender = () => body.replaceWith(renderSkills(v, send, keys));

  // Header: how many you know, and your Marks.
  const total = SKILLBOOK.length;
  body.append(el(`<div class="sk-head">
    <div class="sk-points has">${iconImg("skills", 26)}<div><b>${known.size}</b> of ${total} skills known<span>Read skill scrolls to learn skills. Scrolls come from missions, quests, the Archivists and rare drops. F1–F3: floor abilities, found only on their floor.</span></div></div>
    <div class="sk-marks" title="Marks: earned from missions and quests, spent on scrolls at the Archivists">${iconImg("star", 22)}<b>${v.marks}</b><span>Marks</span></div>
  </div>`));

  // Tabs.
  const tabs = el(`<div class="sk-tabs"></div>`);
  for (const id of TABS) {
    const list = SKILLBOOK.filter((e) => inTab(e, id));
    const count = list.filter((e) => known.has(e.id)).length;
    const icon = id === "universal" ? iconImg("star", 26) : id === "passive" ? iconImg("character", 26) : `<img src="${itemIcon(TAB_ITEM[id], 0)}" alt="">`;
    const b = el(`<button class="sk-tab${id === t ? " on" : ""}${id === inHand ? " hand" : ""}">${icon}<span>${tabName(id)}</span><small>${count}/${list.length}</small></button>`);
    b.addEventListener("click", () => {
      tab = id;
      rerender();
    });
    tabs.append(b);
  }
  body.append(tabs);

  const main = el(`<div class="sk-main"></div>`);
  const entries = SKILLBOOK.filter((e) => inTab(e, t)).sort((a, b) => a.rarity - b.rarity);
  const sel = entries.find((e) => e.id === selected.get(t)) ?? entries.find((e) => known.has(e.id)) ?? entries[0];
  const grid = el(`<div class="sk-grid"></div>`);
  for (const e of entries) {
    const have = known.has(e.id);
    const b = el(`<button class="sk-tile${have ? " known" : ""}${e === sel ? " sel" : ""}" style="--rc:${RARITY_COLORS[e.rarity]}" title="${esc(e.name)}">
      <img src="${entryIcon(e, 50)}" alt="">${have ? "" : `<span class="sk-lock">${iconImg("lock", 16)}</span>`}${e.floor ? `<span class="sk-floor" title="Floor ability of ${esc(FLOOR_NAMES[e.floor])}">F${e.floor}</span>` : ""}
      <span class="sk-label">${esc(e.name)}</span></button>`);
    b.addEventListener("click", () => {
      selected.set(t, e.id);
      rerender();
    });
    grid.append(b);
  }
  main.append(grid);

  // Details card.
  const side = el(`<div class="sk-side"></div>`);
  if (sel) side.append(card(sel, v, known.has(sel.id), inHand, t, send, keys));
  // Slots: the tab's weapon (or the weapon in hand for universal skills and passives).
  const wk: WeaponKey = t === "universal" || t === "passive" ? inHand : t;
  const lo = v.loadout[wk] ?? [NO_SKILL, NO_SKILL];
  const w = WEAPONS.find((q) => q.key === wk)!;
  const slots = el(`<div class="sk-slots"><h4>Equipped ${w.name} skills</h4><div class="sk-slot-row"></div></div>`);
  const row = slots.querySelector(".sk-slot-row")!;
  lo.forEach((idx, slot) => {
    const m = idx !== NO_SKILL ? skillMove(w.id, idx) : undefined;
    const s = el(`<div class="sk-slot${m ? "" : " empty"}"><kbd>${esc(keys[slot])}</kbd>${m ? `<img src="${skillIcon(m.id!, 44)}" alt="">` : "<span>+</span>"}<small>${m ? esc(m.name) : "Empty"}</small></div>`);
    if (m) {
      s.title = "Click to empty this slot";
      s.addEventListener("click", () => send("skills:equip", { weapon: wk, slot, index: NO_SKILL }));
    }
    row.append(s);
  });
  // Mastery: what this weapon type unlocks as you master it.
  if (t !== "universal" && t !== "passive") {
    const lvl = wk === inHand && v.equipment.weapon ? itemMasteryLevel(v.equipment.weapon.mxp) : 0;
    const list = el(`<div class="sk-unlocks"><h4>Mastery unlocks</h4></div>`);
    for (const u of masteryUnlocks(wk)) list.append(el(`<div class="${lvl >= u.level ? "got" : ""}"><b>${u.level}</b><span>${esc(u.name)}</span><small>${esc(u.desc)}</small></div>`));
    slots.append(list);
    if (wk === inHand && v.equipment.weapon) {
      const bonus = Math.round((weaponMasteryDamage(lvl) - 1) * 100);
      slots.append(el(`<div class="sk-mastery">${iconImg("sword", 16)}<span>Your ${esc(itemBase(v.equipment.weapon.key)?.name ?? w.name)}: mastery ${lvl}/10${bonus ? ` (+${bonus}% damage)` : ""}</span></div>`));
    } else slots.append(el(`<div class="sk-mastery dim">Equip a ${w.name.toLowerCase()} to use these skills.</div>`));
  }
  side.append(slots);
  main.append(side);
  body.append(main);
  body.append(el(`<div class="hint">Right-click a scroll in your pack (or click it) to read it · Skills fire with ${esc(keys[0])} and ${esc(keys[1])} · Universal skills work with every weapon</div>`));
  return body;
}

function card(e: SkillEntry, v: SkillView, have: boolean, inHand: WeaponKey, t: Tab, send: (type: string, msg?: unknown) => void, keys: [string, string]) {
  const kind = e.kind === "passive" ? "Passive" : e.weapon ? `${WEAPONS.find((w) => w.key === e.weapon)!.name} skill` : e.floor ? `Floor ${e.floor} ability · every weapon` : "Skill · every weapon";
  const c = el(`<div class="sk-card">
    <div class="sk-card-head"><img src="${entryIcon(e, 64)}" alt=""><div><div class="sk-kind"><span style="color:${RARITY_COLORS[e.rarity]}">${RARITY_NAMES[e.rarity]}</span> · ${kind}</div><h3>${esc(e.name)}</h3></div></div>
    <p class="sk-desc">${esc(e.desc)}</p>
    <div class="sk-stats"></div>
    <div class="sk-actions"></div>
  </div>`);
  const stats = c.querySelector(".sk-stats")!;
  const m = e.move;
  if (m) {
    const row = (icon: UiIconName, label: string, val: string) => stats.append(el(`<div>${iconImg(icon, 16)}<span>${label}</span><b>${val}</b></div>`));
    if (m.damage) row("kill", "Damage", String(m.damage));
    row("cooldown", "Cooldown", `${((m.cooldown ?? 0) / 60).toFixed(m.cooldown && m.cooldown % 60 ? 1 : 0)} s`);
    row("stamina", "Stamina", String(m.stamina));
    if (m.iframes) row("parry", "Untouchable", `${Math.round(((m.iframes[1] - m.iframes[0]) / 60) * 1000)} ms`);
    if (m.superArmor) row("shield", "Unstoppable", "while striking");
  }
  const actions = c.querySelector(".sk-actions")!;
  if (have) {
    actions.append(el(`<div class="sk-learned">${iconImg("check", 18)} ${e.kind === "passive" ? "Known — always active" : "Known"}</div>`));
    if (e.kind === "skill") {
      const wk: WeaponKey = e.weapon ?? (t !== "universal" && t !== "passive" ? t : inHand);
      if (usableWith(e, wk)) {
        const lo = v.loadout[wk] ?? [NO_SKILL, NO_SKILL];
        for (const slot of [0, 1]) {
          const on = lo[slot] === e.index;
          const b = el(`<button class="${on ? "ghost" : ""}">${on ? `In slot ${esc(keys[slot])}` : `Equip to slot ${esc(keys[slot])}`}${e.weapon ? "" : ` (${WEAPONS.find((w) => w.key === wk)!.name.toLowerCase()})`}</button>`);
          if (!on) b.addEventListener("click", () => send("skills:equip", { weapon: wk, slot, index: e.index }));
          actions.append(b);
        }
      }
    }
  } else {
    const price = SCROLL_PRICE[e.rarity];
    actions.append(el(`<div class="sk-where"><img src="${itemIcon(e.scroll, e.rarity)}" alt=""><div><b>Find its scroll</b><span>${esc(scrollSource(e))}</span>${price ? `<small>Archivist price: ${price.gold} gold + ${price.marks} Marks</small>` : ""}</div></div>`));
  }
  return c;
}

export { keyLabel };
