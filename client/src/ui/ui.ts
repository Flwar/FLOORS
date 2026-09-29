import {
  ACHIEVEMENTS, BIND_ACTIONS, BIND_LABELS, DEFAULT_WEAPON_ART, EQUIP_SLOTS, isBindableCode, keyLabel, ZOOM_MAX, ZOOM_MIN, type BindAction, itemBase, itemName, itemStats, itemMasteryLevel, MAX_LEVEL, questDef, QUESTS, RARITY_COLORS,
  RARITY_NAMES, roomLabel, scrollSkill, SCROLL_SOURCES, sellPrice, upgradeCost, WEAPONS, type EquipSlot, type Item, type WeaponKey,
  masteryProgress, weaponMasteryDamage, gearSetOf,
} from "@floors/shared";
import type { Room } from "@colyseus/sdk";
import { sfx } from "../audio/sfx.ts";
import { drawFigure, weaponSize, type WeaponArt } from "../art/characters.ts";
import { personLook } from "../art/looks.ts";
import { countItem, trackedQuests } from "../render/objective.ts";
import { iconImg, type UiIconName } from "./uiIcons.ts";
import { renderSkills, type SkillView } from "./skills.ts";
import { adminTabIsLive, renderAdmin, type AdminOverview } from "./admin.ts";
import type { WorldMap } from "@floors/shared";
import { settings } from "../settings.ts";
import { goldIcon, itemIcon } from "./icons.ts";
import { bankCell, buildPack, type PackFilter } from "./inventory.ts";

export interface InvView {
  key: string;
  name: string;
  level: number;
  xp: number;
  xpNext: number;
  gold: number;
  inventory: (Item | null)[];
  equipment: Partial<Record<EquipSlot, Item>>;
  /** Skills learned from scrolls (weapon skills, universal skills and passives). */
  skills: string[];
  /** Marks: earned from missions and quests, spent on scrolls at the Archivists. */
  marks: number;
  loadout: Record<WeaponKey, [number, number]>;
  /** Mastery of the weapon in hand. */
  weaponMastery: { level: number; into: number; need: number };
  /** Admin account: the admin panel (F10) is available. */
  admin?: boolean;
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
  shop?: { key: string; price: number; rarity?: number; marks?: number }[];
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
  private chatInput = el(`<input class="chat-input hidden" maxlength="160" placeholder="Say something… (/p party, /w world, /wave /dance /sit)">`) as HTMLInputElement;
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
    this.trackerEl.addEventListener("click", () => this.toggle("quests"));
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
    if ((e.code === "F10" || e.code === "Backquote") && this.inv?.admin) {
      e.preventDefault();
      this.toggle("admin");
      return;
    }
    const b = settings.value.bindings;
    const panel = (["pack", "character", "skills", "quests", "map", "party"] as const).find((a) => b[a].includes(e.code));
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
      if (id === "admin") clearInterval(this.adminTimer);
      this.open.delete(id);
      if (id === "dialog") this.mode = "none";
      this.updateBlock();
      this.hideTooltip();
      return;
    }
    this.open.add(id);
    sfx.ui();
    if (id === "admin") {
      this.room?.send("admin:overview");
      clearInterval(this.adminTimer);
      this.adminTimer = setInterval(() => this.room?.send("admin:overview"), 2000);
    }
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
      case "skills":
        return this.renderSkillsPanel();
      case "admin":
        return this.renderAdminPanel();
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
      s.innerHTML = `<img src="${itemIcon(it.key, it.rarity)}" alt="">${it.qty > 1 ? `<span class="qty">${it.qty}</span>` : ""}${it.plus ? `<span class="plus">+${it.plus}</span>` : ""}`;
      s.addEventListener("mouseenter", (e) => this.showTooltip(it, e.clientX, e.clientY));
      s.addEventListener("mouseleave", () => this.hideTooltip());
    }
    return s;
  }

  /** Pack state kept between renders: the active filter, and items already looked at. */
  private packFilter: PackFilter = "all";
  private packSeen?: Set<string>;

  private renderInventory() {
    const inv = this.inv;
    if (!inv) return;
    // Everything carried when the pack is first opened counts as already seen.
    if (!this.packSeen) this.packSeen = new Set(inv.inventory.filter((x): x is Item => !!x).map((x) => x.uid));
    const body = buildPack({
      inv,
      mode: this.mode,
      filter: this.packFilter,
      setFilter: (f) => {
        this.packFilter = f;
        this.render("inventory");
      },
      seen: this.packSeen,
      send: (type, msg) => this.room?.send(type, msg),
      doll: (eq) => this.doll(eq, this.room?.sessionId),
      use: (it) => this.useItem(it),
      menu: (it, x, y) => this.itemMenu(it, x, y),
      tooltip: (it, x, y) => this.showTooltip(it, x, y),
      hideTooltip: () => this.hideTooltip(),
      upgrade: (it) => this.upgrade(it),
      toast: (text, kind) => this.toast(text, kind),
      offer: (it) => {
        if (!this.trade?.mine) return;
        const uids = this.trade.mine.items.map((x) => x.uid);
        if (!uids.includes(it.uid)) this.room?.send("trade:offer", { uids: [...uids, it.uid], gold: this.trade.mine.gold });
      },
    });
    this.panel("inventory", "Pack", body, "right pack-panel");
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
    else if (b.kind === "scroll") this.readScroll(it);
    else if (b.kind === "consumable") this.toast("Drink tonics with R — it takes a moment, so choose it well.");
    else if (b.kind === "key") this.toast(b.desc);
  }

  /** A scroll in the pack teaches something new. */
  unreadScroll() {
    const inv = this.inv;
    if (!inv) return false;
    return inv.inventory.some((it) => {
      const e = it ? scrollSkill(it.key) : undefined;
      return !!e && !inv.skills.includes(e.id);
    });
  }

  /** Read a skill scroll (learning its skill uses it up). */
  private readScroll(it: Item) {
    const e = scrollSkill(it.key);
    if (!e) return;
    if (this.inv?.skills.includes(e.id)) return this.toast(`You already know ${e.name}. Sell the scroll or trade it to someone who doesn't.`, "error");
    this.room?.send("skills:read", it.uid);
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
    if (b?.kind === "scroll") add("Read", () => this.readScroll(it));
    if (!b?.bound) add("Drop", () => confirm(`Drop ${itemName(it)} on the ground?`) && this.room?.send("discard", it.uid));
    add("Cancel", () => {});
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
    this.root.append(m);
    setTimeout(() => document.addEventListener("click", () => m.remove(), { once: true }), 0);
  }

  // --- Tooltip -------------------------------------------------------------------

  /**
   * Item card: rarity header, main stats with a comparison against what you wear now,
   * weapon mastery, the item's story and what it sells for.
   */
  private showTooltip(it: Item, x: number, y: number) {
    const b = itemBase(it.key);
    if (!b) return;
    const st = itemStats(it);
    const gear = b.kind === "weapon" || b.kind === "armor" || b.kind === "helm" || b.kind === "charm";
    const sk = b.kind === "scroll" ? scrollSkill(it.key) : undefined;
    const kind = b.kind === "weapon" ? `${WEAPONS.find((w) => w.key === b.weapon)?.name}` : b.kind === "consumable" ? "Tonic" : b.kind === "key" ? "Keepsake" : sk ? `Skill scroll · ${sk.kind === "passive" ? "passive" : sk.weapon ? WEAPONS.find((w) => w.key === sk.weapon)!.name.toLowerCase() : "every weapon"}` : b.kind[0].toUpperCase() + b.kind.slice(1);
    // Compare against the item in the same slot (unless this is that item).
    const worn = gear ? this.inv?.equipment[b.kind as EquipSlot] : undefined;
    const cmp = worn && worn.uid !== it.uid ? itemStats(worn) : undefined;
    const delta = (v: number, w: number | undefined) => {
      if (w === undefined) return "";
      const d = Math.round(v - w);
      return d === 0 ? `<span class="tt-same">=</span>` : `<span class="${d > 0 ? "tt-up" : "tt-down"}">${d > 0 ? "▲" : "▼"} ${Math.abs(d)}</span>`;
    };
    const stat = (icon: UiIconName, v: number, label: string, w?: number, sign = false) =>
      `<div class="tt-stat">${iconImg(icon, 16)}<b>${sign && v > 0 ? "+" : ""}${Math.round(v)}</b><span>${label}</span>${delta(v, w)}</div>`;
    const lines: string[] = [];
    lines.push(`<div class="tt-head r${it.rarity}"><img src="${itemIcon(it.key, it.rarity)}" alt=""><div><div class="tt-name" style="color:${RARITY_COLORS[it.rarity]}">${esc(itemName(it))}</div>
      <div class="tt-kind">${gear || sk ? RARITY_NAMES[it.rarity] + " " : ""}${kind}${worn?.uid === it.uid ? " · <i>equipped</i>" : ""}</div></div></div>`);
    const stats: string[] = [];
    if (b.kind === "weapon") stats.push(stat("sword", st.power, "Power", cmp?.power));
    if (st.defense || cmp?.defense) stats.push(stat("shield", st.defense, "Defense", cmp?.defense));
    if (st.hp || cmp?.hp) stats.push(stat("heart", st.hp, "Health", cmp?.hp, true));
    if (st.stamina || cmp?.stamina) stats.push(stat("stamina", st.stamina, "Stamina", cmp?.stamina, true));
    if (stats.length) lines.push(`<div class="tt-stats">${stats.join("")}</div>`);
    if (cmp) lines.push(`<div class="tt-cmp">Compared with your ${esc(itemName(worn!))}</div>`);
    if (b.kind === "weapon") {
      const mp = masteryProgress(it.mxp ?? 0);
      const bonus = Math.round((weaponMasteryDamage(mp.level) - 1) * 100);
      lines.push(`<div class="tt-mastery"><div class="tt-mrow">${iconImg("star", 14)}<span>Mastery ${mp.level}</span>${bonus ? `<b>+${bonus}% damage</b>` : ""}</div>
        <div class="tt-bar"><i style="width:${Math.round((mp.into / mp.need) * 100)}%"></i></div><div class="tt-dim">This weapon grows stronger the more you fight with it.</div></div>`);
      lines.push(`<div class="tt-dim">${esc(WEAPONS.find((w) => w.key === b.weapon)?.blurb ?? "")}</div>`);
    }
    if (sk) {
      const m = sk.move;
      if (m) {
        const st2: string[] = [];
        if (m.damage) st2.push(stat("kill", m.damage, "Damage"));
        st2.push(`<div class="tt-stat">${iconImg("cooldown", 16)}<b>${((m.cooldown ?? 0) / 60).toFixed(1)}s</b><span>Cooldown</span></div>`);
        lines.push(`<div class="tt-stats">${st2.join("")}</div>`);
      }
      lines.push(`<div class="tt-effect">${esc(sk.desc)}</div>`);
      lines.push(this.inv?.skills.includes(sk.id) ? `<div class="tt-dim">You already know this skill.</div>` : `<div class="tt-up">Click to read it and learn ${esc(sk.name)}.</div>`);
    } else lines.push(b.effect ? `<div class="tt-effect">${esc(b.desc)}</div>` : `<div class="tt-desc">${esc(b.desc)}</div>`);
    const set = gearSetOf(it.key);
    if (set) {
      const eq = this.inv?.equipment;
      const worn = [eq?.weapon?.key, eq?.armor?.key, eq?.helm?.key].filter((k) => k && set.pieces.includes(k)).length;
      lines.push(`<div class="tt-set"><div class="tt-setname">${esc(set.name)} set <span class="tt-dim">(${worn}/3 worn)</span></div>
        <div class="${worn >= 2 ? "tt-up" : "tt-dim"}">2 pieces: +${set.two.hp} health, +${set.two.defense} defense</div>
        <div class="${worn >= 3 ? "tt-up" : "tt-dim"}">3 pieces: ${esc(set.three.desc)}</div></div>`);
    }
    if (b.bound) lines.push(`<div class="tt-dim">Bound — never lost on death, can't be traded.</div>`);
    const price = sellPrice(it);
    lines.push(`<div class="tt-foot">${price ? `<span class="tt-price"><img src="${goldIcon()}" alt="">${price}</span>` : "<span></span>"}<span class="tt-keys">${gear ? "Drag to equip" : sk ? "Click to read" : b.kind === "consumable" ? `Drink with ${esc(keyLabel(settings.value.bindings.use[0]))}` : ""}</span></div>`);
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
    // Skills: a pointer to the skill tree.
    const sk = el(`<div class="section char-skills"><h4>Skills</h4><div class="cs-row">${iconImg("skills", 22)}<span><b>${inv.skills.length}</b> skills known · <b>${inv.marks}</b> Marks</span><button>Open Skill Book (${esc(keyLabel(settings.value.bindings.skills[0]))})</button></div><div class="tt-dim">Learn skills by reading scrolls. Missions on the Mission Board pay Marks; the Archivist sells scrolls for gold and Marks.</div></div>`);
    sk.querySelector("button")!.addEventListener("click", () => this.toggle("skills", true));
    // Weapon mastery: each weapon grows stronger the more you fight with it.
    const mastery = el(`<div class="section"><h4>Weapon mastery</h4><div class="tt-dim">Every weapon keeps its own mastery: +3% damage per level, and a glow at 10.</div></div>`);
    const weapons = [inv.equipment.weapon, ...inv.inventory].filter((it): it is Item => !!it && itemBase(it.key)?.kind === "weapon");
    for (const it of weapons) {
      const lvl = itemMasteryLevel(it.mxp);
      const pr = it === inv.equipment.weapon ? inv.weaponMastery : { level: lvl, into: 0, need: 1 };
      const row = el(`<div class="mastery"><div class="m-head"><img src="${itemIcon(it.key, it.rarity)}" alt=""><b style="color:${RARITY_COLORS[it.rarity]}">${esc(itemName(it))}</b>${it === inv.equipment.weapon ? '<span class="m-hand">in hand</span>' : ""}<span>Mastery ${lvl}</span></div>${it === inv.equipment.weapon && lvl < 10 ? `<div class="m-bar"><div style="width:${Math.round((pr.into / pr.need) * 100)}%"></div></div>` : ""}</div>`);
      mastery.append(row);
    }
    const perks = sk;
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
  /** Which floor the player stands on (undefined in dungeons). */
  currentFloor?: () => number | undefined;

  /** Last seen step of each tracked quest, so an advanced step can flash. */
  private trackerSteps = new Map<string, string>();

  private renderTracker() {
    const inv = this.inv;
    if (!inv) return;
    const list = trackedQuests(inv, this.currentFloor?.());
    if (!list.length) {
      this.trackerEl.innerHTML = "";
      return;
    }
    const who = (id: string, floor = 1) => this.npcName?.(id) ?? (floor >= 2 ? "the Herald's people at Skyreach Landing (Floor 2)" : "the quest giver in Emberwatch");
    const cards = list.map((t) => {
      const q = t.quest;
      const st = t.stage;
      const stepIdx = inv.quests[q.id]?.stage ?? -1;
      let icon: UiIconName = "talk";
      let text = "";
      let prog = "";
      let frac = -1;
      if (t.offered) text = `Speak to ${who(q.giver, q.floor)}`;
      else if (st) {
        text = st.text;
        switch (st.kind) {
          case "talk":
            icon = st.npc === q.giver || stepIdx === q.stages.length - 1 ? "turnin" : "talk";
            break;
          case "kill":
          case "parry":
            icon = st.kind === "kill" ? "kill" : "parry";
            prog = `${Math.min(t.progress, st.count)}/${st.count}`;
            frac = Math.min(1, t.progress / st.count);
            break;
          case "collect": {
            const have = countItem(inv, st.item);
            prog = `${Math.min(have, st.count)}/${st.count}`;
            frac = Math.min(1, have / st.count);
            if (have >= st.count) {
              icon = "turnin";
              text = `Hand them to ${who(q.giver)}`;
            } else icon = "collect";
            break;
          }
          case "interact":
            icon = "search";
            break;
          case "visit":
            icon = "visit";
            break;
          case "dungeon":
            icon = "dungeon";
            break;
        }
      }
      const key = `${stepIdx}:${t.offered}`;
      const prev = this.trackerSteps.get(q.id);
      const advanced = prev !== undefined && prev !== key;
      this.trackerSteps.set(q.id, key);
      const steps = t.offered ? "New" : `Step ${stepIdx + 1}/${q.stages.length}`;
      return `<div class="tq ${q.main ? "main" : "side"}${advanced ? " advanced" : ""}" data-q="${q.id}">
        <div class="tq-head">${iconImg(q.main ? "main" : "side", 18)}<span class="tq-name">${esc(q.name)}</span><span class="tq-step">${steps}</span></div>
        <div class="tq-obj">${iconImg(icon, 20)}<span class="tq-text">${esc(text)}</span>${prog ? `<b class="tq-prog">${prog}</b>` : ""}</div>
        ${frac >= 0 ? `<div class="tq-bar"><i style="width:${Math.round(frac * 100)}%"></i></div>` : ""}
        <div class="tq-where"><span class="tq-arrow">➤</span><span class="tq-dist"></span></div>
      </div>`;
    });
    this.trackerEl.innerHTML = `<div class="tr-head">${iconImg("quest", 16)}<span>Quests</span><kbd>${esc(keyLabel(settings.value.bindings.quests[0]))}</kbd></div>${cards.join("")}`;
  }

  /** Live direction and distance for each tracked quest (called by the scene a few times a second). */
  setTrackerWhere(list: { id: string; angle?: number; dist?: number; area?: string; here?: boolean }[]) {
    for (const w of list) {
      const card = this.trackerEl.querySelector<HTMLElement>(`.tq[data-q="${w.id}"]`);
      if (!card) continue;
      const arrow = card.querySelector<HTMLElement>(".tq-arrow")!;
      const dist = card.querySelector<HTMLElement>(".tq-dist")!;
      if (w.dist === undefined) {
        card.classList.add("nowhere");
        continue;
      }
      card.classList.remove("nowhere");
      card.classList.toggle("here", !!w.here);
      arrow.style.transform = `rotate(${w.angle ?? 0}rad)`;
      dist.textContent = w.here ? `You're here${w.area ? ` · ${w.area}` : ""}` : `${w.dist} m${w.area ? ` · ${w.area}` : ""}`;
    }
  }

  private renderXp() {
    const inv = this.inv;
    if (!inv) return;
    (this.xpBar.firstElementChild as HTMLElement).style.transform = `scaleX(${inv.xpNext ? inv.xp / inv.xpNext : 1})`;
  }

  // --- Map ---------------------------------------------------------------------------

  /** Set by the scene: can the current map be opened (bought, charted)? */
  mapAccess?: () => { ok: boolean; title?: string; text?: string };

  private renderMap() {
    const access = this.mapAccess?.() ?? { ok: true };
    if (!access.ok) {
      const body = el(`<div class="nomap">${iconImg("map", 56)}<h3>${esc(access.title ?? "")}</h3><p>${esc(access.text ?? "")}</p></div>`);
      this.panel("map", "Map", body, "center narrow");
      return;
    }
    const body = el(`<div class="map"><canvas width="880" height="600"></canvas><div class="tt-dim">Unexplored land stays under the fog. Numbered pins are your quests.</div></div>`);
    this.panel("map", "Map", body, "center xwide");
    const canvas = body.querySelector("canvas")!;
    this.mapRender?.(canvas);
    if (this.inv?.admin && this.onMapTeleport) {
      canvas.classList.add("teleport");
      canvas.title = "Admin: click to teleport";
      canvas.addEventListener("click", (ev) => this.onMapTeleport!(canvas, ev));
    }
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
        const it: Item = { uid: "", key: entry.key, rarity: entry.rarity ?? 0, qty: 1, plus: 0, bonus: {} };
        const sk = scrollSkill(entry.key);
        if (sk) it.rarity = sk.rarity;
        const owned = (entry.key.startsWith("map_") && !!this.inv?.discovered.includes(`map:${entry.key.slice(4)}`)) || (!!sk && !!this.inv?.skills.includes(sk.id));
        const cost = `${entry.price}g${entry.marks ? ` + ${entry.marks}<i class="mark-ico"></i>` : ""}`;
        const row = el(`<div class="shop-row${owned ? " owned" : ""}"><img src="${itemIcon(entry.key, it.rarity)}" alt=""><span style="color:${RARITY_COLORS[it.rarity]}">${esc(itemBase(entry.key)?.name ?? entry.key)}</span><b>${owned ? (sk ? "Known" : "Owned") : cost}</b></div>`);
        row.addEventListener("mouseenter", (e) => this.showTooltip(it, e.clientX, e.clientY));
        row.addEventListener("mouseleave", () => this.hideTooltip());
        row.addEventListener("click", () => this.room?.send("shop:buy", { shop: shopKey, idx }));
        list.append(row);
      });
      body.append(list);
    }
    if (this.mode === "shop" && d.role === "archivist") body.append(el(`<div class="tt-dim">You have <b>${this.inv?.marks ?? 0}</b> Marks and <b>${this.inv?.gold ?? 0}</b> gold. Missions on the Mission Board pay Marks. Legendary scrolls are never sold: ${esc(SCROLL_SOURCES[4].toLowerCase())}</div>`));
    if (this.mode === "smith") body.append(el(`<div class="tt-dim">Click gear in your pack or equipped slots to upgrade (+1 to +5). Upgrades need gold and materials.</div>`));
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
    const grid = el(`<div class="pk-bag bank"></div>`);
    const bctx = {
      send: (type: string, msg?: unknown) => this.room?.send(type, msg),
      tooltip: (it: Item, x: number, y: number) => this.showTooltip(it, x, y),
      hideTooltip: () => this.hideTooltip(),
      toast: (text: string, kind?: "good" | "error") => this.toast(text, kind),
    };
    for (const it of this.bank) grid.append(bankCell(bctx, it));
    const gold = el(`<div class="bank-gold"><img src="${goldIcon()}" alt=""> Stored: <b>${this.bankGold}</b>
      <button data-a="dep">Deposit all</button><button data-a="wd">Withdraw all</button></div>`);
    gold.querySelector('[data-a="dep"]')!.addEventListener("click", () => this.room?.send("bank:deposit", { gold: this.inv?.gold ?? 0 }));
    gold.querySelector('[data-a="wd"]')!.addEventListener("click", () => this.room?.send("bank:withdraw", { gold: this.bankGold }));
    body.append(gold, grid, el(`<div class="hint">Stored items and gold are safe when you fall. Drag items between storage and your pack, or click to move them.</div>`));
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

  inspect(d: { name: string; level: number; equipment: Partial<Record<EquipSlot, Item>>; mastery: number; skills?: string[]; stats: InvView["stats"]; floor: number }, sid: string) {
    this.root.querySelector(".inspect")?.remove();
    const box = el(`<div class="lore inspect"><div class="lore-name">${esc(d.name)} — Level ${d.level}</div></div>`);
    const doll = el(`<div class="doll inspect-doll"></div>`);
    doll.append(this.doll(d.equipment, sid));
    box.append(doll);
    const eq = el(`<div class="equip inline"></div>`);
    for (const slot of EQUIP_SLOTS) eq.append(this.slotEl(d.equipment[slot], slot));
    box.append(eq);
    const wpn = d.equipment.weapon;
    box.append(el(`<p class="tt-dim">${wpn ? `Fights with ${esc(itemName(wpn))} (mastery ${d.mastery}) · ` : ""}${d.skills?.length ?? 0} skills known · Floor ${d.floor} reached · ${d.stats.perfects} perfect parries</p>`));
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

  // --- Admin ----------------------------------------------------------------------

  adminData?: AdminOverview;
  adminMap?: WorldMap;
  adminKind = "world";
  private adminGod = false;
  private adminTimer?: ReturnType<typeof setInterval>;
  /** Set by the scene: teleport to where the admin clicked on the map. */
  onMapTeleport?: (c: HTMLCanvasElement, ev: MouseEvent) => void;

  setAdmin(d: AdminOverview) {
    this.adminData = d;
    if (this.open.has("admin") && adminTabIsLive()) this.render("admin");
  }

  private renderAdminPanel() {
    if (!this.inv?.admin) return;
    const scroll = this.root.querySelector('.panel[data-id="admin"] .adm-pane')?.scrollTop ?? 0;
    const body = renderAdmin({
      send: (type, msg) => this.room?.send(type, msg),
      data: this.adminData,
      map: this.adminMap,
      kind: this.adminKind,
      quests: this.inv.quests,
      level: this.inv.level,
      god: this.adminGod,
      setGod: (on) => (this.adminGod = on),
      rerender: () => this.render("admin"),
    });
    this.panel("admin", "Admin", body, "center xwide");
    const pane = this.root.querySelector<HTMLElement>('.panel[data-id="admin"] .adm-pane');
    if (pane) pane.scrollTop = scroll;
  }

  private renderSkillsPanel() {
    const inv = this.inv;
    if (!inv) return;
    const b = settings.value.bindings;
    const body = renderSkills(inv as unknown as SkillView, (type, msg) => this.room?.send(type, msg), [keyLabel(b.skill1[0]), keyLabel(b.skill2[0])]);
    this.panel("skills", "Skills", body, "center xwide");
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
    const before = this.inv?.marks;
    this.inv = v;
    this.refresh();
    if (before !== undefined && v.marks > before) this.toast(`+${v.marks - before} Marks (${v.marks} in all) — spend them on skill scrolls at the Archivist`, "good");
    document.getElementById("vitals")?.classList.toggle("perk-ready", this.unreadScroll());
    if (v.admin && !document.getElementById("admin-btn")) {
      const b = el(`<button id="admin-btn" title="Admin panel (F10 or &#96;)">ADMIN</button>`);
      b.addEventListener("click", () => this.toggle("admin"));
      this.root.append(b);
    }
  }
}

export function roomName(room?: string) {
  return roomLabel(room ?? "world");
}

void questDef;
