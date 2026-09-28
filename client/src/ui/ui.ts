import {
  ACHIEVEMENTS, BIND_ACTIONS, BIND_LABELS, DEFAULT_WEAPON_ART, EQUIP_SLOTS, isBindableCode, keyLabel, ZOOM_MAX, ZOOM_MIN, type BindAction, itemBase, itemName, itemStats, masteryProgress, masteryUnlocks, MAX_LEVEL, PERK_CHOICES, questDef, QUESTS, RARITY_COLORS,
  RARITY_NAMES, repairCost, sellPrice, upgradeCost, WEAPONS, type EquipSlot, type Item, type WeaponKey,
} from "@floors/shared";
import type { Room } from "@colyseus/sdk";
import { sfx } from "../audio/sfx.ts";
import { drawFigure, weaponSize, type WeaponArt } from "../art/characters.ts";
import { personLook } from "../art/looks.ts";
import { mainObjective } from "../render/objective.ts";
import { settings } from "../settings.ts";
import { goldIcon, itemIcon } from "./icons.ts";

export interface InvView {
  key: string;
  name: string;
  level: number;
  xp: number;
  xpNext: number;
  gold: number;
  inventory: (Item | null)[];
  equipment: Partial<Record<EquipSlot, Item>>;
  mastery: Partial<Record<WeaponKey, number>>;
  perks: string[];
  pendingPerk?: number;
  quests: Record<string, { stage: number; progress: number; done?: boolean }>;
  discovered: string[];
  bossKills: string[];
  floor: number;
  stats: { kills: number; deaths: number; parries: number; perfects: number };
  achievements: string[];
  derived: { atk: number; defense: number; hpMax: number; staminaMax: number };
}

export interface DialogMsg {
  npc: string;
  name: string;
  role: string;
  greeting: string;
  offers: { id: string; name: string; pitch: string; main: boolean }[];
  done: { id: string; name: string; thanks: string }[];
  services: string[];
  shop?: { key: string; price: number; rarity?: number }[];
}

type Mode = "none" | "shop" | "smith" | "bank" | "sell" | "trade";

export interface TradeMsg {
  closed?: boolean;
  done?: boolean;
  reason?: string;
  partner?: string;
  mine?: { items: Item[]; gold: number; ready: boolean };
  theirs?: { items: Item[]; gold: number; ready: boolean };
}

const el = (html: string) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * All DOM game UI: panels (inventory, character, quests, map, party, settings),
 * NPC dialog and services, chat, toasts, tooltips.
 */
export class GameUI {
  inv?: InvView;
  bank: (Item | null)[] = [];
  bankGold = 0;
  private dialog?: DialogMsg;
  private mode: Mode = "none";
  private open = new Set<string>();
  private root = document.getElementById("ui")!;
  private tooltip = el(`<div class="tooltip hidden"></div>`);
  private toasts = el(`<div class="toasts"></div>`);
  private chatLog = el(`<div class="chat-log"></div>`);
  private chatInput = el(`<input class="chat-input hidden" maxlength="160" placeholder="Say something… (/p party, /w world)">`) as HTMLInputElement;
  private partyEl = el(`<div class="party-frames"></div>`);
  private trackerEl = el(`<div class="tracker"></div>`);
  private xpBar = el(`<div class="xpbar"><div class="fill"></div></div>`);
  onBlockChange?: (blocked: boolean) => void;
  onMap?: () => void;
  mapRender?: (canvas: HTMLCanvasElement) => void;
  partyStatus: { key: string; name: string; online: boolean; leader: boolean; hp?: number; hpMax?: number; dead?: boolean; sid?: string; here?: boolean; level?: number; room?: string }[] = [];
  party?: { id: string; leader: string; members: { key: string; name: string; online: boolean }[] };

  constructor(private getRoom: () => Room | undefined) {
    this.root.append(this.tooltip, this.toasts, this.partyEl, this.trackerEl, this.xpBar);
    const chat = el(`<div class="chat"></div>`);
    chat.append(this.chatLog, this.chatInput);
    this.root.append(chat);
    this.chatInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        this.sendChat(this.chatInput.value);
        this.chatInput.value = "";
        this.closeChat();
      } else if (e.key === "Escape") this.closeChat();
    });
    window.addEventListener("keydown", (e) => this.hotkey(e));
    document.addEventListener("mousemove", (e) => {
      if (!this.tooltip.classList.contains("hidden")) this.placeTooltip(e.clientX, e.clientY);
    });
  }

  private get room() {
    return this.getRoom();
  }

  get blocking() {
    return this.open.size > 0 || !this.chatInput.classList.contains("hidden");
  }

  private updateBlock() {
    this.onBlockChange?.(this.blocking);
  }

  private hotkey(e: KeyboardEvent) {
    if (this.capture) return;
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      this.openChat();
      return;
    }
    if (e.code === "Escape") {
      if (this.open.size) this.closeAll();
      else this.toggle("settings");
      return;
    }
    const b = settings.value.bindings;
    const panel = (["pack", "character", "quests", "map", "party"] as const).find((a) => b[a].includes(e.code));
    if (!panel || e.repeat) return;
    e.preventDefault();
    this.toggle(panel === "pack" ? "inventory" : panel);
  }

  // ---------------------------------------------------------------------------
  // Panels

  toggle(id: string, force?: boolean) {
    const want = force ?? !this.open.has(id);
    this.root.querySelector(`.panel[data-id="${id}"]`)?.remove();
    if (!want) {
      if (id === "settings") this.capture?.stop();
      this.open.delete(id);
      if (id === "dialog") this.mode = "none";
      this.updateBlock();
      this.hideTooltip();
      return;
    }
    this.open.add(id);
    sfx.ui();
    this.render(id);
    this.updateBlock();
  }

  closeAll() {
    for (const id of [...this.open]) this.toggle(id, false);
    this.mode = "none";
  }

  private refresh() {
    for (const id of this.open) this.render(id);
    this.renderTracker();
    this.renderXp();
  }

  private panel(id: string, title: string, body: HTMLElement, cls = "") {
    this.root.querySelector(`.panel[data-id="${id}"]`)?.remove();
    const p = el(`<div class="panel ${cls}" data-id="${id}"><div class="panel-head"><span>${esc(title)}</span><button class="x" aria-label="Close">×</button></div></div>`);
    p.querySelector(".x")!.addEventListener("click", () => this.toggle(id, false));
    p.append(body);
    this.root.append(p);
    return p;
  }

  private render(id: string) {
    switch (id) {
      case "inventory":
        return this.renderInventory();
      case "character":
        return this.renderCharacter();
      case "quests":
        return this.renderQuests();
      case "map":
        return this.renderMap();
      case "party":
        return this.renderParty();
      case "settings":
        return this.renderSettings();
      case "dialog":
        return this.renderDialog();
      case "bank":
        return this.renderBank();
      case "trade":
        return this.renderTrade();
    }
  }

  // --- Inventory & equipment ----------------------------------------------------

  private slotEl(it: Item | null | undefined, label?: string) {
    const s = el(`<div class="slot-cell${it ? ` r${it.rarity}` : " empty"}">${label && !it ? `<span class="slot-label">${label}</span>` : ""}</div>`);
    if (it) {
      s.innerHTML = `<img src="${itemIcon(it.key, it.rarity)}" alt="">${it.qty > 1 ? `<span class="qty">${it.qty}</span>` : ""}${it.plus ? `<span class="plus">+${it.plus}</span>` : ""}${it.dur <= 0 ? `<span class="broken">!</span>` : ""}`;
      s.addEventListener("mouseenter", (e) => this.showTooltip(it, e.clientX, e.clientY));
      s.addEventListener("mouseleave", () => this.hideTooltip());
    }
    return s;
  }

  private renderInventory() {
    const inv = this.inv;
    if (!inv) return;
    const body = el(`<div class="inv"></div>`);
    // Paper doll between the slots: helm and armour on the left, weapon and charm on the right.
    const equip = el(`<div class="gear"><div class="gear-col"></div><div class="doll"></div><div class="gear-col"></div></div>`);
    const cols = equip.querySelectorAll<HTMLElement>(".gear-col");
    equip.querySelector(".doll")!.append(this.doll(inv.equipment, this.room?.sessionId));
    const side: Record<EquipSlot, number> = { helm: 0, armor: 0, weapon: 1, charm: 1 };
    for (const slot of ["helm", "armor", "weapon", "charm"] as EquipSlot[]) {
      const it = inv.equipment[slot];
      const cell = this.slotEl(it, slot);
      cell.title = "";
      if (it) {
        cell.addEventListener("click", () => {
          if (this.mode === "smith") return this.upgrade(it);
          this.room?.send("unequip", slot);
        });
        cell.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.room?.send("unequip", slot);
        });
      }
      const row = el(`<div class="gear-slot"><span class="equip-name">${it ? esc(itemName(it)) : slot[0].toUpperCase() + slot.slice(1)}</span></div>`);
      if (it) (row.firstElementChild as HTMLElement).style.color = RARITY_COLORS[it.rarity];
      row.prepend(cell);
      cols[side[slot]].append(row);
    }
    const stats = el(`<div class="inv-stats">
      <div><b>${inv.derived.atk}</b> Power</div><div><b>${inv.derived.defense}</b> Defense</div>
      <div><b>${inv.derived.hpMax}</b> Health</div><div><b>${inv.derived.staminaMax}</b> Stamina</div>
      <div class="gold"><img src="${goldIcon()}" alt=""> ${inv.gold}</div></div>`);
    const grid = el(`<div class="grid"></div>`);
    inv.inventory.forEach((it) => {
      const cell = this.slotEl(it);
      if (it) {
        cell.addEventListener("click", () => this.useItem(it));
        cell.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.itemMenu(it, e.clientX, e.clientY);
        });
      }
      grid.append(cell);
    });
    const hint = this.mode === "trade" ? "Click items to add them to — or take them back from — your offer." : this.mode === "shop" || this.mode === "sell" ? "Click an item to sell it." : this.mode === "smith" ? "Click an item to upgrade it." : this.mode === "bank" ? "Click an item to store it." : "Click to equip or use · Right-click for more";
    body.append(equip, stats, grid, el(`<div class="hint">${hint}</div>`));
    this.panel("inventory", "Pack", body, "right");
  }

  /** A character as others see them, wearing `eq`. `sid` picks their colours. */
  private doll(eq: Partial<Record<EquipSlot, Item>>, sid?: string) {
    const who = sid ? (this.room?.state.players.get(sid) as { hue: number } | undefined) : undefined;
    const look = personLook(who?.hue ?? 0, eq.armor ? itemBase(eq.armor.key)?.look ?? 0 : 0, eq.helm ? itemBase(eq.helm.key)?.look ?? 0 : 0);
    const wb = eq.weapon ? itemBase(eq.weapon.key) : undefined;
    const art: WeaponArt = wb?.art ?? DEFAULT_WEAPON_ART[wb?.weapon ?? "sword"];
    const W = 156;
    const H = 190;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const c = document.createElement("canvas");
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    // Fit the figure plus an upright weapon: world units from the weapon tip down to the feet.
    const { w, grip } = weaponSize(art);
    const top = Math.min(-44, -12 - (w - grip) / 2);
    const k = (c.height * 0.94) / (6 - top);
    drawFigure(g, look, art, eq.weapon?.rarity ?? 0, c.width / 2 + 4 * k, c.height - 6 * k, k / 2, -Math.PI / 2 - 0.12);
    return c;
  }

  private useItem(it: Item) {
    const b = itemBase(it.key);
    if (!b) return;
    if (this.mode === "shop" || this.mode === "sell") {
      const price = sellPrice(it);
      if (price > 0) this.room?.send("shop:sell", it.uid);
      return;
    }
    if (this.mode === "smith") return this.upgrade(it);
    if (this.mode === "trade" && this.trade?.mine) {
      const uids = this.trade.mine.items.map((x) => x.uid);
      const next = uids.includes(it.uid) ? uids.filter((u) => u !== it.uid) : [...uids, it.uid];
      this.room?.send("trade:offer", { uids: next, gold: this.trade.mine.gold });
      return;
    }
    if (this.mode === "bank") {
      this.room?.send("bank:deposit", { uid: it.uid });
      return;
    }
    if (b.kind === "weapon" || b.kind === "armor" || b.kind === "helm" || b.kind === "charm") this.room?.send("equip", it.uid);
    else if (b.kind === "consumable") this.toast("Drink tonics with R — it takes a moment, so choose it well.");
    else if (b.kind === "key") this.toast(b.desc);
  }

  private upgrade(it: Item) {
    const cost = upgradeCost(it);
    if (!cost) return this.toast("That can't be improved further.", "error");
    const mats = cost.mats.map((m) => `${m.qty} ${itemBase(m.key)?.name}`).join(", ");
    if (confirm(`Upgrade ${itemName(it)} to +${it.plus + 1} for ${cost.gold} gold and ${mats}?`)) this.room?.send("smith:upgrade", it.uid);
  }

  private itemMenu(it: Item, x: number, y: number) {
    this.root.querySelector(".menu")?.remove();
    const b = itemBase(it.key);
    const m = el(`<div class="menu"></div>`);
    const add = (label: string, fn: () => void) => {
      const btn = el(`<button>${label}</button>`);
      btn.addEventListener("click", () => {
        m.remove();
        fn();
      });
      m.append(btn);
    };
    if (b && (b.kind === "weapon" || b.kind === "armor" || b.kind === "helm" || b.kind === "charm")) add("Equip", () => this.room?.send("equip", it.uid));
    if (!b?.bound) add("Drop", () => confirm(`Drop ${itemName(it)} on the ground?`) && this.room?.send("discard", it.uid));
    add("Cancel", () => {});
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
    this.root.append(m);
    setTimeout(() => document.addEventListener("click", () => m.remove(), { once: true }), 0);
  }

  // --- Tooltip -------------------------------------------------------------------

  private showTooltip(it: Item, x: number, y: number) {
    const b = itemBase(it.key);
    if (!b) return;
    const st = itemStats(it);
    const lines: string[] = [];
    const kind = b.kind === "weapon" ? `${WEAPONS.find((w) => w.key === b.weapon)?.name}` : b.kind[0].toUpperCase() + b.kind.slice(1);
    lines.push(`<div class="tt-name" style="color:${RARITY_COLORS[it.rarity]}">${esc(itemName(it))}</div>`);
    lines.push(`<div class="tt-kind">${b.kind === "weapon" || b.kind === "armor" || b.kind === "helm" || b.kind === "charm" ? RARITY_NAMES[it.rarity] + " " : ""}${kind}</div>`);
    if (b.kind === "weapon") lines.push(`<div>${Math.round(st.power)} Power</div>`);
    if (st.defense) lines.push(`<div>${Math.round(st.defense)} Defense</div>`);
    if (st.hp) lines.push(`<div>+${Math.round(st.hp)} Health</div>`);
    if (st.stamina) lines.push(`<div>${st.stamina > 0 ? "+" : ""}${Math.round(st.stamina)} Stamina</div>`);
    if (b.kind === "weapon") lines.push(`<div class="tt-dim">${esc(WEAPONS.find((w) => w.key === b.weapon)?.blurb ?? "")}</div>`);
    if (b.effect) lines.push(`<div class="tt-effect">${esc(b.desc)}</div>`);
    else lines.push(`<div class="tt-desc">${esc(b.desc)}</div>`);
    if (b.kind === "weapon" || b.kind === "armor" || b.kind === "helm" || b.kind === "charm") lines.push(`<div class="tt-dim">Durability ${it.dur}%${it.dur <= 0 ? " — broken! Repair at the smith." : ""}</div>`);
    if (b.bound) lines.push(`<div class="tt-dim">Bound — never lost on death.</div>`);
    const price = sellPrice(it);
    if (price) lines.push(`<div class="tt-dim">Sells for ${price} gold</div>`);
    this.tooltip.innerHTML = lines.join("");
    this.tooltip.classList.remove("hidden");
    this.placeTooltip(x, y);
  }

  private placeTooltip(x: number, y: number) {
    const r = this.tooltip.getBoundingClientRect();
    this.tooltip.style.left = `${Math.min(window.innerWidth - r.width - 8, x + 16)}px`;
    this.tooltip.style.top = `${Math.min(window.innerHeight - r.height - 8, y + 12)}px`;
  }

  private hideTooltip() {
    this.tooltip.classList.add("hidden");
  }

  // --- Character ----------------------------------------------------------------

  private renderCharacter() {
    const inv = this.inv;
    if (!inv) return;
    const body = el(`<div class="char"></div>`);
    body.append(el(`<div class="char-top"><div class="char-name">${esc(inv.name)}</div><div>Level ${inv.level}${inv.level < MAX_LEVEL ? ` · ${inv.xp}/${inv.xpNext} XP` : " (max)"}</div>
      <div class="tt-dim">Kills ${inv.stats.kills} · Parries ${inv.stats.parries} (${inv.stats.perfects} perfect) · Deaths ${inv.stats.deaths}</div></div>`));
    // Perks
    const perks = el(`<div class="section"><h4>Perks</h4></div>`);
    for (const choice of PERK_CHOICES) {
      const picked = choice.options.find((o) => inv.perks.includes(o.id));
      const row = el(`<div class="perk-row${choice.level > inv.level ? " locked" : ""}"><span class="lvl">Lv ${choice.level}</span></div>`);
      for (const o of choice.options) {
        const btn = el(`<button class="perk${picked?.id === o.id ? " picked" : ""}" ${picked || choice.level > inv.level ? "disabled" : ""}><b>${esc(o.name)}</b><span>${esc(o.desc)}</span></button>`);
        btn.addEventListener("click", () => this.room?.send("perk", o.id));
        row.append(btn);
      }
      perks.append(row);
    }
    // Mastery
    const mastery = el(`<div class="section"><h4>Weapon mastery</h4></div>`);
    for (const w of WEAPONS) {
      const xp = inv.mastery[w.key] ?? 0;
      const pr = masteryProgress(xp);
      const unlocks = masteryUnlocks(w.key);
      const row = el(`<div class="mastery"><div class="m-head"><b>${w.name}</b><span>Mastery ${pr.level}</span></div><div class="m-bar"><div style="width:${Math.round((pr.into / pr.need) * 100)}%"></div></div><div class="m-unlocks"></div></div>`);
      const list = row.querySelector(".m-unlocks")!;
      for (const u of unlocks) list.append(el(`<span class="${u.level <= pr.level ? "got" : ""}" title="${esc(u.desc)}">${u.level}·${esc(u.name)}</span>`));
      mastery.append(row);
    }
    const got = new Set(inv.achievements ?? []);
    const ach = el(`<div class="section"><h4>Achievements (${got.size}/${ACHIEVEMENTS.length})</h4><div class="achievements"></div></div>`);
    const list = ach.querySelector(".achievements")!;
    for (const a of ACHIEVEMENTS) list.append(el(`<div class="ach${got.has(a.id) ? " got" : ""}"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div>`));
    body.append(perks, mastery, ach);
    this.panel("character", "Character", body, "left wide");
  }

  // --- Quests ---------------------------------------------------------------------

  private renderQuests() {
    const inv = this.inv;
    if (!inv) return;
    const body = el(`<div class="quests"></div>`);
    const active = QUESTS.filter((q) => inv.quests[q.id] && !inv.quests[q.id].done);
    const done = QUESTS.filter((q) => inv.quests[q.id]?.done);
    if (!active.length) body.append(el(`<div class="tt-dim">No active quests. Talk to people in Emberwatch — the Guildmaster, the smith, the tanner, the scholar.</div>`));
    for (const q of active) {
      const st = inv.quests[q.id];
      const stage = q.stages[st.stage];
      const prog = "count" in stage && stage.kind !== "collect" ? ` (${st.progress}/${stage.count})` : "";
      body.append(el(`<div class="quest${q.main ? " main" : ""}"><div class="q-name">${esc(q.name)}</div><div class="q-stage">▸ ${esc(stage.text)}${prog}</div><div class="tt-dim">${esc(q.pitch)}</div></div>`));
    }
    if (done.length) body.append(el(`<div class="section"><h4>Completed</h4>${done.map((q) => `<div class="tt-dim">✓ ${esc(q.name)}</div>`).join("")}</div>`));
    this.panel("quests", "Quests", body, "left");
  }

  /** Names of NPCs on the current map (quest givers), set by the scene. */
  npcName?: (id: string) => string | undefined;

  private renderTracker() {
    const inv = this.inv;
    if (!inv) return;
    const active = QUESTS.filter((q) => inv.quests[q.id] && !inv.quests[q.id].done).slice(0, 3);
    // Never leave a player without a next step: point at the next main quest's giver.
    const main = mainObjective(inv);
    const next = main?.offered
      ? `<div class="t-q main"><div class="t-name">Next: ${esc(main.quest.name)}</div><div class="t-stage">Speak to ${esc(this.npcName?.(main.quest.giver) ?? "the quest giver in Emberwatch")}</div></div>`
      : "";
    this.trackerEl.innerHTML = next + active
      .map((q) => {
        const st = inv.quests[q.id];
        const stage = q.stages[st.stage];
        const prog = stage.kind === "kill" || stage.kind === "parry" ? ` ${st.progress}/${stage.count}` : "";
        return `<div class="t-q${q.main ? " main" : ""}"><div class="t-name">${esc(q.name)}</div><div class="t-stage">${esc(stage.text)}${prog}</div></div>`;
      })
      .join("");
  }

  private renderXp() {
    const inv = this.inv;
    if (!inv) return;
    (this.xpBar.firstElementChild as HTMLElement).style.transform = `scaleX(${inv.xpNext ? inv.xp / inv.xpNext : 1})`;
  }

  // --- Map ---------------------------------------------------------------------------

  private renderMap() {
    const body = el(`<div class="map"><canvas width="800" height="600"></canvas><div class="tt-dim">Areas you haven't discovered stay dark. Secrets are never marked.</div></div>`);
    this.panel("map", "Map", body, "center");
    this.mapRender?.(body.querySelector("canvas")!);
  }

  // --- Party -------------------------------------------------------------------------

  private renderParty() {
    const body = el(`<div class="party"></div>`);
    const p = this.party;
    if (p) {
      for (const m of this.partyStatus.length ? this.partyStatus : p.members.map((x) => ({ ...x, leader: x.key === p.leader }))) {
        const row = el(`<div class="p-row"><span>${m.leader ? "★ " : ""}${esc(m.name)}${m.online ? "" : " (offline)"}</span></div>`);
        const isLeader = this.inv && p.leader === this.inv.key;
        if (isLeader && m.key !== this.inv!.key) {
          const kickBtn = el(`<button>Remove</button>`);
          kickBtn.addEventListener("click", () => this.room?.send("party:kick", m.name));
          const promo = el(`<button>Make leader</button>`);
          promo.addEventListener("click", () => this.room?.send("party:promote", m.name));
          row.append(promo, kickBtn);
        }
        body.append(row);
      }
      const leave = el(`<button class="wide">Leave party</button>`);
      leave.addEventListener("click", () => this.room?.send("party:leave"));
      body.append(leave);
    } else body.append(el(`<div class="tt-dim">You're adventuring alone. Invite someone by name, or click another player and choose Invite.</div>`));
    const form = el(`<form class="p-invite"><input placeholder="Adventurer name" maxlength="16"><button>Invite</button></form>`);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input")!;
      if (input.value.trim()) this.room?.send("party:invite", input.value.trim());
      input.value = "";
    });
    body.append(form, el(`<div class="tt-dim">Party members share quest progress and experience, enter dungeons together, and can revive each other (F near a fallen ally). Up to 4 adventurers.</div>`));
    this.panel("party", "Party", body, "left");
  }

  setParty(p: typeof this.party) {
    this.party = p ?? undefined;
    if (!p) this.partyStatus = [];
    this.renderPartyFrames();
    if (this.open.has("party")) this.render("party");
  }

  setPartyStatus(s: typeof this.partyStatus) {
    this.partyStatus = s;
    this.renderPartyFrames();
  }

  private renderPartyFrames() {
    const me = this.inv?.key;
    const list = this.partyStatus.filter((m) => m.key !== me);
    this.partyEl.innerHTML = list
      .map((m) => {
        const f = m.hpMax ? Math.max(0, (m.hp ?? 0) / m.hpMax) : 0;
        return `<div class="pf${m.dead ? " dead" : ""}${!m.online ? " off" : ""}"><div class="pf-name">${m.leader ? "★ " : ""}${esc(m.name)} <span>${m.online ? (m.here ? `Lv ${m.level ?? "?"}` : esc(roomName(m.room))) : "offline"}</span></div><div class="pf-bar"><div style="transform:scaleX(${f})"></div></div></div>`;
      })
      .join("");
  }

  invite(from: string) {
    const box = el(`<div class="prompt"><div>${esc(from)} invites you to their party.</div><div class="row"><button class="yes">Join</button><button class="no">Decline</button></div></div>`);
    box.querySelector(".yes")!.addEventListener("click", () => {
      this.room?.send("party:accept");
      box.remove();
    });
    box.querySelector(".no")!.addEventListener("click", () => {
      this.room?.send("party:decline");
      box.remove();
    });
    this.root.append(box);
    setTimeout(() => box.remove(), 60000);
  }

  // --- Settings ----------------------------------------------------------------------

  onLogout?: () => void;
  /** Tells gameplay input to stand down while a key is being captured for a binding. */
  onCapture?: (on: boolean) => void;
  private capture?: { action: BindAction; slot: number; stop: () => void };

  private renderSettings() {
    const v = settings.value;
    const body = el(`<div class="settings">
      <label>Effects <input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-k="sfx"></label>
      <label>Music <input type="range" min="0" max="1" step="0.05" value="${v.music}" data-k="music"></label>
      <label>Camera zoom <input type="range" min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="0.05" value="${v.zoom}" data-k="zoom"></label>
      <div class="hint">The mouse wheel zooms too. Settings are saved to your character.</div>
      <div class="section"><h4>Controls <button class="small reset">Reset to defaults</button></h4>
        <div class="binds"></div>
        <div class="hint">Click a key, then press the new key or mouse button. Delete clears it, Esc cancels. Enter (chat) and Esc (menus) are fixed.</div>
      </div>
      <button class="wide logout">Log out</button>
    </div>`);
    body.querySelectorAll<HTMLInputElement>("input[type=range]").forEach((r) =>
      r.addEventListener("input", () => settings.set({ [r.dataset.k as "sfx" | "music" | "zoom"]: Number(r.value) })),
    );
    const binds = body.querySelector(".binds")!;
    for (const action of BIND_ACTIONS) {
      binds.append(el(`<span class="bind-name">${BIND_LABELS[action]}</span>`));
      for (const slot of [0, 1]) {
        const code = v.bindings[action][slot];
        const listening = this.capture?.action === action && this.capture.slot === slot;
        const btn = el(`<button class="bind${listening ? " listening" : ""}${code ? "" : " empty"}">${listening ? "Press key…" : esc(code ? keyLabel(code) : "—")}</button>`);
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.startCapture(action, Math.min(slot, v.bindings[action].length));
        });
        binds.append(btn);
      }
    }
    body.querySelector(".reset")!.addEventListener("click", () => {
      settings.resetBindings();
      this.render("settings");
    });
    body.querySelector(".logout")!.addEventListener("click", () => this.onLogout?.());
    this.panel("settings", "Settings", body, "center");
  }

  /** Listen for the next key or mouse button and bind it to `action`. */
  private startCapture(action: BindAction, slot: number) {
    this.capture?.stop();
    const finish = (code: string | null | undefined) => {
      stop();
      if (code !== undefined) settings.bind(action, slot, code);
      if (this.open.has("settings")) this.render("settings");
    };
    const take = (code: string, e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!isBindableCode(code, action)) {
        this.toast(code.startsWith("Mouse") ? `${BIND_LABELS[action]} needs a keyboard key.` : "That key can't be bound.", "error");
        return;
      }
      finish(code);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        return finish(undefined);
      }
      if (e.code === "Delete" || e.code === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        return finish(null);
      }
      take(e.code, e);
    };
    const onMouse = (e: MouseEvent) => take(`Mouse${e.button}`, e);
    const noMenu = (e: Event) => e.preventDefault();
    const stop = () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("contextmenu", noMenu, true);
      this.capture = undefined;
      this.onCapture?.(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    window.addEventListener("contextmenu", noMenu, true);
    this.capture = { action, slot, stop };
    this.onCapture?.(true);
    this.render("settings");
  }

  // --- Dialog, shops, smith, bank -----------------------------------------------------

  showDialog(d: DialogMsg) {
    this.dialog = d;
    this.mode = "none";
    this.toggle("dialog", true);
  }

  private renderDialog() {
    const d = this.dialog;
    if (!d) return;
    const body = el(`<div class="dialog"><p class="greet">${esc(d.greeting)}</p></div>`);
    for (const done of d.done) body.append(el(`<div class="q-done"><b>${esc(done.name)} — complete</b><p>${esc(done.thanks)}</p></div>`));
    for (const o of d.offers) {
      const row = el(`<div class="q-offer${o.main ? " main" : ""}"><b>${esc(o.name)}</b><p>${esc(o.pitch)}</p></div>`);
      const btn = el(`<button>Accept</button>`);
      btn.addEventListener("click", () => {
        this.room?.send("quest:accept", o.id);
        d.offers = d.offers.filter((x) => x.id !== o.id);
        this.render("dialog");
      });
      row.append(btn);
      body.append(row);
    }
    const services = el(`<div class="services"></div>`);
    const svc = (label: string, fn: () => void, active = false) => {
      const b = el(`<button class="${active ? "active" : ""}">${label}</button>`);
      b.addEventListener("click", fn);
      services.append(b);
    };
    for (const s of d.services) {
      if (s.startsWith("shop:")) svc("Buy", () => this.setMode("shop"), this.mode === "shop");
      if (s === "sell") svc("Sell", () => this.setMode("sell"), this.mode === "sell");
      if (s === "smith") svc("Upgrade", () => this.setMode("smith"), this.mode === "smith");
      if (s === "smith") svc("Repair all", () => this.room?.send("smith:repair"));
      if (s === "bank") svc("Open storage", () => {
        this.room?.send("bank:open");
        this.setMode("bank");
      });
    }
    if (services.childElementCount) body.append(services);
    if (this.mode === "shop" && d.shop) {
      const shopKey = d.services.find((s) => s.startsWith("shop:"))!.slice(5);
      const list = el(`<div class="shop"></div>`);
      d.shop.forEach((entry, idx) => {
        const it: Item = { uid: "", key: entry.key, rarity: entry.rarity ?? 0, qty: 1, plus: 0, dur: 100, bonus: {} };
        const row = el(`<div class="shop-row"><img src="${itemIcon(entry.key, it.rarity)}" alt=""><span style="color:${RARITY_COLORS[it.rarity]}">${esc(itemBase(entry.key)?.name ?? entry.key)}</span><b>${entry.price}g</b></div>`);
        row.addEventListener("mouseenter", (e) => this.showTooltip(it, e.clientX, e.clientY));
        row.addEventListener("mouseleave", () => this.hideTooltip());
        row.addEventListener("click", () => this.room?.send("shop:buy", { shop: shopKey, idx }));
        list.append(row);
      });
      body.append(list);
    }
    if (this.mode === "smith") body.append(el(`<div class="tt-dim">Click gear in your pack or equipped slots to upgrade (+1 to +5). Upgrades need gold and materials. Repairs restore broken gear.</div>`));
    if (this.mode === "sell") body.append(el(`<div class="tt-dim">Click items in your pack to sell them.</div>`));
    this.panel("dialog", d.name, body, "left");
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    if (mode !== "none" && !this.open.has("inventory")) this.toggle("inventory", true);
    this.refresh();
  }

  setBank(bank: (Item | null)[], gold: number) {
    this.bank = bank;
    this.bankGold = gold;
    this.mode = "bank";
    if (!this.open.has("bank")) this.toggle("bank", true);
    else this.render("bank");
    if (!this.open.has("inventory")) this.toggle("inventory", true);
    else this.render("inventory");
  }

  private renderBank() {
    const body = el(`<div class="inv"></div>`);
    const grid = el(`<div class="grid bank"></div>`);
    for (const it of this.bank) {
      const cell = this.slotEl(it);
      if (it) cell.addEventListener("click", () => this.room?.send("bank:withdraw", { uid: it.uid }));
      grid.append(cell);
    }
    const gold = el(`<div class="bank-gold"><img src="${goldIcon()}" alt=""> Stored: <b>${this.bankGold}</b>
      <button data-a="dep">Deposit all</button><button data-a="wd">Withdraw all</button></div>`);
    gold.querySelector('[data-a="dep"]')!.addEventListener("click", () => this.room?.send("bank:deposit", { gold: this.inv?.gold ?? 0 }));
    gold.querySelector('[data-a="wd"]')!.addEventListener("click", () => this.room?.send("bank:withdraw", { gold: this.bankGold }));
    body.append(gold, grid, el(`<div class="hint">Stored items and gold are safe when you fall. Click to withdraw.</div>`));
    this.panel("bank", "Storage", body, "left");
  }

  // --- Misc popups -----------------------------------------------------------------------

  lore(name: string, text: string) {
    this.root.querySelector(".lore")?.remove();
    const box = el(`<div class="lore"><div class="lore-name">${esc(name)}</div><p>${esc(text)}</p><button>Close</button></div>`);
    box.querySelector("button")!.addEventListener("click", () => {
      box.remove();
      this.open.delete("lore");
      this.updateBlock();
    });
    this.open.add("lore");
    this.updateBlock();
    this.root.append(box);
  }

  waystones(list: { id: string; name: string }[], from: string) {
    this.root.querySelector(".waystones")?.remove();
    const box = el(`<div class="lore waystones"><div class="lore-name">Waystones</div></div>`);
    for (const w of list) {
      const b = el(`<button class="wide" ${w.id === from ? "disabled" : ""}>${esc(w.name)}${w.id === from ? " (here)" : ""}</button>`);
      b.addEventListener("click", () => {
        this.room?.send("waystone:travel", w.id);
        box.remove();
        this.open.delete("waystones");
        this.updateBlock();
      });
      box.append(b);
    }
    const close = el(`<button class="wide">Close</button>`);
    close.addEventListener("click", () => {
      box.remove();
      this.open.delete("waystones");
      this.updateBlock();
    });
    box.append(close);
    this.open.add("waystones");
    this.updateBlock();
    this.root.append(box);
  }

  inspect(d: { name: string; level: number; equipment: Partial<Record<EquipSlot, Item>>; mastery: Partial<Record<WeaponKey, number>>; stats: InvView["stats"]; floor: number }, sid: string) {
    this.root.querySelector(".inspect")?.remove();
    const box = el(`<div class="lore inspect"><div class="lore-name">${esc(d.name)} — Level ${d.level}</div></div>`);
    const doll = el(`<div class="doll inspect-doll"></div>`);
    doll.append(this.doll(d.equipment, sid));
    box.append(doll);
    const eq = el(`<div class="equip inline"></div>`);
    for (const slot of EQUIP_SLOTS) eq.append(this.slotEl(d.equipment[slot], slot));
    box.append(eq);
    const best = Object.entries(d.mastery).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    box.append(el(`<p class="tt-dim">${best ? `Favours the ${WEAPONS.find((w) => w.key === best[0])?.name} (mastery ${masteryProgress(best[1] ?? 0).level}) · ` : ""}Floor ${d.floor} reached · ${d.stats.perfects} perfect parries</p>`));
    const row = el(`<div class="row"></div>`);
    const tradeBtn = el(`<button>Trade</button>`);
    tradeBtn.addEventListener("click", () => {
      this.room?.send("trade:request", sid);
      this.toast(`Trade request sent to ${d.name}.`);
      box.remove();
    });
    const inv = el(`<button>Invite to party</button>`);
    inv.addEventListener("click", () => {
      this.room?.send("party:invite", d.name);
      box.remove();
    });
    const close = el(`<button>Close</button>`);
    close.addEventListener("click", () => box.remove());
    row.append(tradeBtn, inv, close);
    box.append(row);
    this.root.append(box);
  }

  // --- Trading ---------------------------------------------------------------------

  trade?: TradeMsg;

  tradeRequest(from: string, name: string) {
    const box = el(`<div class="prompt"><div>${esc(name)} wants to trade with you.</div><div class="row"><button class="yes">Trade</button><button class="no">Decline</button></div></div>`);
    box.querySelector(".yes")!.addEventListener("click", () => {
      this.room?.send("trade:accept", from);
      box.remove();
    });
    box.querySelector(".no")!.addEventListener("click", () => {
      this.room?.send("trade:decline");
      box.remove();
    });
    this.root.append(box);
    setTimeout(() => box.remove(), 30000);
  }

  setTrade(t: TradeMsg) {
    if (t.closed) {
      this.trade = undefined;
      if (this.mode === "trade") this.mode = "none";
      if (this.open.has("trade")) this.toggle("trade", false);
      this.toast(t.reason ?? "Trade closed.", t.done ? "good" : "info");
      if (this.open.has("inventory")) this.render("inventory");
      return;
    }
    this.trade = t;
    this.mode = "trade";
    if (!this.open.has("trade")) this.toggle("trade", true);
    else this.render("trade");
    if (!this.open.has("inventory")) this.toggle("inventory", true);
    else this.render("inventory");
  }

  private renderTrade() {
    const t = this.trade;
    if (!t?.mine || !t.theirs) return;
    const side = (label: string, o: NonNullable<TradeMsg["mine"]>, mine: boolean) => {
      const col = el(`<div class="trade-side${o.ready ? " ready" : ""}"><h4>${esc(label)}${o.ready ? " — ready" : ""}</h4><div class="grid"></div></div>`);
      const grid = col.querySelector(".grid")!;
      for (let i = 0; i < 6; i++) {
        const it = o.items[i] ?? null;
        const cell = this.slotEl(it);
        if (it && mine) cell.addEventListener("click", () => this.useItem(it));
        grid.append(cell);
      }
      if (mine) {
        const g = el(`<label class="trade-gold"><img src="${goldIcon()}" alt=""><input type="number" min="0" max="${this.inv?.gold ?? 0}" value="${o.gold}"></label>`);
        const input = g.querySelector("input")!;
        input.addEventListener("change", () => this.room?.send("trade:offer", { uids: o.items.map((x) => x.uid), gold: Number(input.value) }));
        col.append(g);
      } else col.append(el(`<div class="trade-gold"><img src="${goldIcon()}" alt=""> ${o.gold}</div>`));
      return col;
    };
    const body = el(`<div class="trade"></div>`);
    body.append(side("Your offer", t.mine, true), side(`${t.partner ?? "Their"}'s offer`, t.theirs, false));
    const row = el(`<div class="row"></div>`);
    const ready = el(`<button ${t.mine.ready ? "disabled" : ""}>${t.mine.ready ? "Waiting…" : "Ready"}</button>`);
    ready.addEventListener("click", () => this.room?.send("trade:ready"));
    const cancel = el(`<button class="ghost">Cancel</button>`);
    cancel.addEventListener("click", () => this.room?.send("trade:cancel"));
    row.append(ready, cancel);
    body.append(row, el(`<div class="hint">Both must press Ready. Any change to an offer un-readies both sides.</div>`));
    this.panel("trade", `Trade with ${t.partner ?? "?"}`, body, "left");
  }

  perkPrompt() {
    const inv = this.inv;
    if (!inv?.pendingPerk || this.root.querySelector(".perk-prompt")) return;
    const choice = PERK_CHOICES.find((c) => c.level === inv.pendingPerk);
    if (!choice) return;
    const box = el(`<div class="lore perk-prompt"><div class="lore-name">Level ${choice.level} — choose a perk</div></div>`);
    for (const o of choice.options) {
      const b = el(`<button class="perk"><b>${esc(o.name)}</b><span>${esc(o.desc)}</span></button>`);
      b.addEventListener("click", () => {
        this.room?.send("perk", o.id);
        box.remove();
        this.open.delete("perk");
        this.updateBlock();
      });
      box.append(b);
    }
    const later = el(`<button class="wide">Decide later (Character panel)</button>`);
    later.addEventListener("click", () => {
      box.remove();
      this.open.delete("perk");
      this.updateBlock();
    });
    box.append(later);
    this.open.add("perk");
    this.updateBlock();
    this.root.append(box);
  }

  // --- Chat & toasts ------------------------------------------------------------------

  openChat() {
    this.chatInput.classList.remove("hidden");
    this.chatInput.focus();
    this.updateBlock();
  }

  private closeChat() {
    this.chatInput.classList.add("hidden");
    this.chatInput.blur();
    this.updateBlock();
  }

  private sendChat(raw: string) {
    let text = raw.trim();
    if (!text) return;
    let channel = "say";
    if (text.startsWith("/p ")) {
      channel = "party";
      text = text.slice(3);
    } else if (text.startsWith("/w ")) {
      channel = "world";
      text = text.slice(3);
    } else if (text.startsWith("/invite ")) {
      this.room?.send("party:invite", text.slice(8).trim());
      return;
    }
    this.room?.send("chat", { text, channel });
  }

  chat(m: { from: string; text: string; channel: string }) {
    const who = m.from ? `<b>${m.channel === "party" ? "[Party] " : m.channel === "world" ? "[World] " : ""}${esc(m.from)}:</b> ` : "";
    const line = el(`<div class="line ${m.channel}">${who}${esc(m.text)}</div>`);
    this.chatLog.append(line);
    while (this.chatLog.childElementCount > 40) this.chatLog.firstElementChild!.remove();
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
    setTimeout(() => line.classList.add("old"), 12000);
  }

  system(text: string) {
    this.chat({ from: "", text, channel: "system" });
  }

  toast(text: string, kind: "info" | "error" | "good" | "loot" = "info", icon?: string, color?: string) {
    const t = el(`<div class="toast ${kind}">${icon ? `<img src="${icon}" alt="">` : ""}<span${color ? ` style="color:${color}"` : ""}>${esc(text)}</span></div>`);
    this.toasts.append(t);
    while (this.toasts.childElementCount > 6) this.toasts.firstElementChild!.remove();
    setTimeout(() => t.classList.add("fade"), 3200);
    setTimeout(() => t.remove(), 4000);
  }

  setInv(v: InvView) {
    const firstPerk = !this.inv?.pendingPerk && v.pendingPerk;
    this.inv = v;
    this.refresh();
    // Never interrupt play with a modal: announce the choice and let the player pick it in the Character panel.
    if (firstPerk) this.toast(`Level ${v.pendingPerk} perk available — open Character (${keyLabel(settings.value.bindings.character[0])}) to choose`, "good");
    document.getElementById("vitals")?.classList.toggle("perk-ready", !!v.pendingPerk);
  }
}

export function roomName(room?: string) {
  return room === "dungeon" ? "Undercroft" : room === "floor2" ? "Floor 2" : "Floor 1";
}

void repairCost;
void questDef;
