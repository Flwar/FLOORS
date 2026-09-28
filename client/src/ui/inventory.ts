import { itemBase, itemMasteryLevel, itemName, type EquipSlot, type Item, type ItemKind } from "@floors/shared";
import { goldIcon, itemIcon } from "./icons.ts";
import { iconImg } from "./uiIcons.ts";
import type { InvView } from "./ui.ts";

/**
 * The Pack: a paper doll with its equipment slots, your stats, and a bag you can sort,
 * filter and drag items around in. Dragging works across panels: onto equipment slots,
 * other bag slots, the bank, a trade offer, a shop (to sell) or the world (to drop).
 */

export type PackFilter = "all" | "gear" | "tonics" | "materials" | "quest";

export interface PackContext {
  inv: InvView;
  mode: string;
  filter: PackFilter;
  setFilter(f: PackFilter): void;
  /** uids the player has already looked at (anything else wears a "new" dot). */
  seen: Set<string>;
  send(type: string, msg?: unknown): void;
  doll(eq: Partial<Record<EquipSlot, Item>>): HTMLCanvasElement;
  use(it: Item): void;
  menu(it: Item, x: number, y: number): void;
  tooltip(it: Item, x: number, y: number): void;
  hideTooltip(): void;
  upgrade(it: Item): void;
  toast(text: string, kind?: "good" | "error"): void;
  /** Add an item to your trade offer, if a trade is open. */
  offer(it: Item): void;
}

const GEAR: ItemKind[] = ["weapon", "armor", "helm", "charm"];
/** Faint silhouette shown in an empty equipment slot. */
const PLACEHOLDER: Record<EquipSlot, string> = { weapon: "sword_iron", armor: "armor_padded", helm: "helm_cap", charm: "charm_wolf" };
const SLOT_NAME: Record<EquipSlot, string> = { weapon: "Weapon", armor: "Armour", helm: "Helm", charm: "Charm" };

function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function matches(it: Item, f: PackFilter) {
  const k = itemBase(it.key)?.kind;
  if (f === "all" || !k) return true;
  if (f === "gear") return GEAR.includes(k);
  if (f === "tonics") return k === "consumable";
  if (f === "materials") return k === "material";
  return k === "key" || k === "artifact";
}

/** One item cell's contents: icon and badges. */
function cellInner(it: Item, isNew: boolean) {
  const lvl = itemBase(it.key)?.kind === "weapon" ? itemMasteryLevel(it.mxp) : 0;
  return `<img class="pk-icon" src="${itemIcon(it.key, it.rarity)}" alt="" draggable="false">
    ${it.qty > 1 ? `<span class="pk-qty">${it.qty}</span>` : ""}
    ${it.plus ? `<span class="pk-plus">+${it.plus}</span>` : ""}
    ${it.dur <= 0 ? `<span class="pk-broken" title="Broken">!</span>` : ""}
    ${lvl >= 2 ? `<span class="pk-mastery" title="Weapon mastery">★${lvl}</span>` : ""}
    ${isNew ? `<span class="pk-new"></span>` : ""}`;
}

// ---------------------------------------------------------------------------
// Drag and drop

type DragSource = { kind: "bag"; index: number; item: Item } | { kind: "equip"; slot: EquipSlot; item: Item } | { kind: "bank"; item: Item };

let drag: { src: DragSource; ghost: HTMLElement; srcEl: HTMLElement; over?: HTMLElement } | undefined;
/** Set when a drag just ended, so the click that follows the pointerup is ignored. */
let justDragged = 0;

function canEquipTo(it: Item, slot: EquipSlot) {
  return itemBase(it.key)?.kind === slot;
}

function beginDrag(ctx: PackContext, src: DragSource, srcEl: HTMLElement, e: PointerEvent) {
  const ghost = el(`<div class="pk-ghost r${src.item.rarity}"><img src="${itemIcon(src.item.key, src.item.rarity)}" alt=""></div>`);
  document.body.append(ghost);
  drag = { src, ghost, srcEl };
  srcEl.classList.add("pk-lifted");
  document.body.classList.add("pk-dragging");
  // Light up the equipment slot this item belongs in.
  const kind = itemBase(src.item.key)?.kind;
  document.querySelectorAll<HTMLElement>(".pk-equip").forEach((s) => s.classList.toggle("pk-accepts", s.dataset.slot === kind));
  moveGhost(e.clientX, e.clientY);
  ctx.hideTooltip();
}

function moveGhost(x: number, y: number) {
  if (!drag) return;
  drag.ghost.style.left = `${x}px`;
  drag.ghost.style.top = `${y}px`;
  const under = document.elementFromPoint(x, y) as HTMLElement | null;
  const target = under?.closest<HTMLElement>("[data-drop]") ?? under?.closest<HTMLElement>(".panel") ?? undefined;
  if (target !== drag.over) {
    drag.over?.classList.remove("pk-over");
    drag.over = target;
    target?.classList.add("pk-over");
  }
}

function endDrag(ctx: PackContext, x: number, y: number) {
  const d = drag;
  if (!d) return;
  drag = undefined;
  justDragged = performance.now();
  d.ghost.remove();
  d.srcEl.classList.remove("pk-lifted");
  d.over?.classList.remove("pk-over");
  document.body.classList.remove("pk-dragging");
  document.querySelectorAll(".pk-accepts").forEach((s) => s.classList.remove("pk-accepts"));
  const under = document.elementFromPoint(x, y) as HTMLElement | null;
  const it = d.src.item;
  const drop = under?.closest<HTMLElement>("[data-drop]");
  // From storage: anywhere on the pack takes it out.
  if (d.src.kind === "bank") {
    if (drop?.dataset.drop?.startsWith("bag") || under?.closest('.panel[data-id="inventory"]')) ctx.send("bank:withdraw", { uid: it.uid });
    return;
  }
  if (drop) {
    const [kind, arg] = (drop.dataset.drop ?? "").split(":");
    if (kind === "bag") {
      const to = Number(arg);
      if (d.src.kind === "bag") ctx.send("inv:move", { from: d.src.index, to });
      else ctx.send("inv:unequipTo", { slot: d.src.slot, to });
      return;
    }
    if (kind === "equip") {
      const slot = arg as EquipSlot;
      if (d.src.kind === "equip") return;
      if (!canEquipTo(it, slot)) return ctx.toast(`That doesn't go in the ${SLOT_NAME[slot].toLowerCase()} slot.`, "error");
      ctx.send("equip", it.uid);
      return;
    }
  }
  const panel = under?.closest<HTMLElement>(".panel");
  const id = panel?.dataset.id;
  if (d.src.kind !== "bag") return;
  if (id === "bank") return ctx.send("bank:deposit", { uid: it.uid });
  if (id === "trade") return ctx.offer(it);
  if (id === "dialog" && (ctx.mode === "shop" || ctx.mode === "sell")) return ctx.send("shop:sell", it.uid);
  // Released over the world: drop it on the ground (never bound items).
  if (!panel && under?.closest("#game")) {
    if (itemBase(it.key)?.bound) return ctx.toast("You can't drop that — it's bound to you.", "error");
    if (confirm(`Drop ${itemName(it)} on the ground?`)) ctx.send("discard", it.uid);
  }
}

/** Make a cell draggable; `onClick` still fires for plain clicks. */
function draggable(ctx: PackContext, cell: HTMLElement, src: DragSource, onClick: () => void) {
  cell.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) {
        started = true;
        beginDrag(ctx, src, cell, ev);
      }
      if (started) moveGhost(ev.clientX, ev.clientY);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (started) endDrag(ctx, ev.clientX, ev.clientY);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
  cell.addEventListener("click", () => {
    if (performance.now() - justDragged < 250) return;
    onClick();
  });
}

/** A storage (bank) slot in the same style as the pack; drag or click it to take the item out. */
export function bankCell(ctx: Pick<PackContext, "send" | "tooltip" | "hideTooltip" | "toast">, it: Item | null): HTMLElement {
  const cell = el(`<div class="pk-cell ${it ? `r${it.rarity}` : "empty"}"></div>`);
  if (!it) return cell;
  cell.innerHTML = cellInner(it, false);
  cell.addEventListener("mouseenter", (e) => ctx.tooltip(it, e.clientX, e.clientY));
  cell.addEventListener("mouseleave", () => ctx.hideTooltip());
  const full: PackContext = { ...ctx, inv: undefined as never, mode: "bank", filter: "all", setFilter: () => {}, seen: new Set(), doll: () => document.createElement("canvas"), use: () => {}, menu: () => {}, upgrade: () => {}, offer: () => {} };
  draggable(full, cell, { kind: "bank", item: it }, () => ctx.send("bank:withdraw", { uid: it.uid }));
  return cell;
}

// ---------------------------------------------------------------------------

export function buildPack(ctx: PackContext): HTMLElement {
  const inv = ctx.inv;
  const root = el(`<div class="pack"></div>`);

  // Left: the character, their gear and what it adds up to.
  const left = el(`<div class="pk-left"><div class="pk-doll"><div class="pk-col"></div><div class="pk-figure"></div><div class="pk-col"></div></div></div>`);
  left.querySelector(".pk-figure")!.append(ctx.doll(inv.equipment));
  const cols = left.querySelectorAll<HTMLElement>(".pk-col");
  const side: Record<EquipSlot, number> = { helm: 0, armor: 0, weapon: 1, charm: 1 };
  for (const slot of ["helm", "armor", "weapon", "charm"] as EquipSlot[]) {
    const it = inv.equipment[slot];
    const cell = el(`<div class="pk-cell pk-equip ${it ? `r${it.rarity}` : "empty"}" data-drop="equip:${slot}" data-slot="${slot}"></div>`);
    cell.innerHTML = it ? cellInner(it, false) : `<img class="pk-ghostslot" src="${itemIcon(PLACEHOLDER[slot], 0)}" alt="" draggable="false">`;
    const label = el(`<div class="pk-slotname">${esc(it ? itemName(it) : SLOT_NAME[slot])}</div>`);
    if (it) {
      label.style.color = `var(--r${it.rarity})`;
      cell.addEventListener("mouseenter", (e) => ctx.tooltip(it, e.clientX, e.clientY));
      cell.addEventListener("mouseleave", () => ctx.hideTooltip());
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        ctx.send("unequip", slot);
      });
      draggable(ctx, cell, { kind: "equip", slot, item: it }, () => (ctx.mode === "smith" ? ctx.upgrade(it) : ctx.send("unequip", slot)));
    }
    const wrap = el(`<div class="pk-slot"></div>`);
    wrap.append(cell, label);
    cols[side[slot]].append(wrap);
  }
  const d = inv.derived;
  left.append(el(`<div class="pk-stats">
    <div class="pk-stat">${iconImg("sword", 20)}<b>${d.atk}</b><span>Power</span></div>
    <div class="pk-stat">${iconImg("shield", 20)}<b>${d.defense}</b><span>Defense</span></div>
    <div class="pk-stat">${iconImg("heart", 20)}<b>${d.hpMax}</b><span>Health</span></div>
    <div class="pk-stat">${iconImg("stamina", 20)}<b>${d.staminaMax}</b><span>Stamina</span></div>
  </div>`));

  // Right: filters, the bag, gold.
  const right = el(`<div class="pk-right"></div>`);
  const tabs = el(`<div class="pk-tabs"></div>`);
  const tabDefs: [PackFilter, string, Parameters<typeof iconImg>[0]][] = [["all", "All", "pack"], ["gear", "Gear", "sword"], ["tonics", "Tonics", "heart"], ["materials", "Materials", "collect"], ["quest", "Keepsakes", "quest"]];
  for (const [f, name, icon] of tabDefs) {
    const b = el(`<button class="pk-tab${ctx.filter === f ? " on" : ""}" title="${name}">${iconImg(icon, 16)}<span>${name}</span></button>`);
    b.addEventListener("click", () => ctx.setFilter(f));
    tabs.append(b);
  }
  const sort = el(`<button class="pk-sort" title="Sort: gear first, best first">${iconImg("check", 14)}<span>Sort</span></button>`);
  sort.addEventListener("click", () => ctx.send("inv:sort"));
  tabs.append(sort);
  right.append(tabs);

  const bag = el(`<div class="pk-bag"></div>`);
  inv.inventory.forEach((it, index) => {
    const cell = el(`<div class="pk-cell ${it ? `r${it.rarity}` : "empty"}" data-drop="bag:${index}"></div>`);
    if (it) {
      const isNew = !ctx.seen.has(it.uid);
      cell.innerHTML = cellInner(it, isNew);
      if (!matches(it, ctx.filter)) cell.classList.add("pk-dim");
      cell.addEventListener("mouseenter", (e) => {
        ctx.seen.add(it.uid);
        cell.querySelector(".pk-new")?.remove();
        ctx.tooltip(it, e.clientX, e.clientY);
      });
      cell.addEventListener("mouseleave", () => ctx.hideTooltip());
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        ctx.menu(it, e.clientX, e.clientY);
      });
      draggable(ctx, cell, { kind: "bag", index, item: it }, () => ctx.use(it));
    }
    bag.append(cell);
  });
  right.append(bag);

  const used = inv.inventory.filter(Boolean).length;
  const hint =
    ctx.mode === "trade" ? "Drag or click items to offer them."
    : ctx.mode === "shop" || ctx.mode === "sell" ? "Drag or click an item to sell it."
    : ctx.mode === "smith" ? "Click an item to upgrade it."
    : ctx.mode === "bank" ? "Drag or click an item to store it."
    : "Drag to equip or rearrange · Click to use · Right-click for more";
  right.append(el(`<div class="pk-foot"><div class="pk-gold"><img src="${goldIcon()}" alt=""><b>${inv.gold}</b></div><div class="pk-space${used >= inv.inventory.length ? " full" : ""}">${used}/${inv.inventory.length}</div></div>`));
  right.append(el(`<div class="pk-hint">${hint}</div>`));

  root.append(left, right);
  return root;
}
