import { ENEMIES, ITEMS, QUESTS, RARITY_COLORS, RARITY_NAMES, TILE, WEAPONS, type WorldMap } from "@floors/shared";
import { itemIcon } from "./icons.ts";
import { iconImg } from "./uiIcons.ts";

/** What the server reports to admins every couple of seconds. */
export interface AdminOverview {
  players: { key: string; name: string; level: number; room: string; here: boolean; hp: number; hpMax: number; dead: boolean; x: number; y: number; gold: number; guest: boolean }[];
  server: { uptimeMs: number; online: number; room: string; roomId: string; clients: number; enemies: number; drops: number; memMb: number; dev: boolean };
}

export interface AdminContext {
  send: (type: string, msg?: unknown) => void;
  data?: AdminOverview;
  map?: WorldMap;
  kind: string;
  quests: Record<string, { stage: number; progress: number; done?: boolean }>;
  level: number;
  god: boolean;
  setGod: (on: boolean) => void;
  rerender: () => void;
}

type Tab = "players" | "world" | "me" | "items" | "quests" | "server";
let tab: Tab = "players";
let itemQuery = "";
let itemRarity = 1;
let spawnKey = "wolf";
let spawnLevel = 3;
let spawnElite = false;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const el = <T extends HTMLElement = HTMLElement>(html: string) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
};
const btn = (label: string, fn: () => void, cls = "") => {
  const b = el<HTMLButtonElement>(`<button class="${cls}">${label}</button>`);
  b.addEventListener("click", fn);
  return b;
};
const row = (title: string, ...nodes: HTMLElement[]) => {
  const r = el(`<div class="adm-row"><span class="adm-label">${title}</span><div class="adm-ctl"></div></div>`);
  r.querySelector(".adm-ctl")!.append(...nodes);
  return r;
};
const time = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
};

export function renderAdmin(ctx: AdminContext): HTMLElement {
  const body = el(`<div class="admin"></div>`);
  const tabs = el(`<div class="adm-tabs"></div>`);
  const names: [Tab, string][] = [["players", "Players"], ["world", "World"], ["me", "Me"], ["items", "Items"], ["quests", "Quests"], ["server", "Server"]];
  for (const [id, label] of names) {
    tabs.append(btn(label, () => {
      tab = id;
      ctx.rerender();
    }, `adm-tab${tab === id ? " on" : ""}`));
  }
  body.append(tabs);
  const pane = el(`<div class="adm-pane"></div>`);
  body.append(pane);
  const s = ctx.send;

  switch (tab) {
    case "players": {
      const list = ctx.data?.players ?? [];
      pane.append(el(`<div class="adm-note">${list.length} online. "Go"/"Bring" work for players in this area (${esc(ctx.kind)}).</div>`));
      for (const p of list) {
        const r = el(`<div class="adm-player"><div class="adm-pname"><b>${esc(p.name)}</b> <span>Lv ${p.level}${p.guest ? " · guest" : ""} · ${esc(p.room)}${p.dead ? " · dead" : ""}</span></div>
          <div class="adm-hp"><i style="width:${Math.round((p.hp / Math.max(1, p.hpMax)) * 100)}%"></i><span>${p.hp}/${p.hpMax}</span></div><div class="adm-pact"></div></div>`);
        const act = r.querySelector(".adm-pact")!;
        act.append(
          btn("Go", () => s("admin:goto", p.key), p.here ? "" : "dis"),
          btn("Bring", () => s("admin:bring", p.key), p.here ? "" : "dis"),
          btn("Heal", () => s("admin:heal", p.key), p.here ? "" : "dis"),
          btn("Kick", () => confirm(`Kick ${p.name}?`) && s("admin:kick", p.key), "danger"),
        );
        pane.append(r);
      }
      break;
    }
    case "world": {
      const m = ctx.map;
      if (m) {
        const places = el(`<div class="adm-grid"></div>`);
        for (const z of m.zones) {
          if (z.x0 === 0 && z.y0 === 0 && z.x1 >= m.width) continue;
          places.append(btn(esc(z.name), () => s("admin:tp", { x: ((z.x0 + z.x1) / 2) * TILE, y: ((z.y0 + z.y1) / 2) * TILE })));
        }
        for (const o of m.objects) {
          if (o.kind === "waystone" || o.kind === "door" || o.kind === "gate") places.append(btn(esc(o.name), () => s("admin:tp", { x: o.x, y: o.y + 40 })));
        }
        places.append(btn("Spawn point", () => s("admin:tp", m.spawn)));
        pane.append(el(`<h4>Teleport</h4>`), places, el(`<div class="adm-note">Tip: with the map open (M), click anywhere on it to teleport there.</div>`));
      }
      if (ctx.kind === "world") {
        pane.append(el(`<h4>World events</h4>`));
        const ev = el(`<div class="adm-grid"></div>`);
        for (const [id, label] of [["raid", "Bandit Raid"], ["frenzy", "Frenzied Pack"], ["greyback", "Old Greyback"], ["merchant", "Travelling Merchant"]]) ev.append(btn(label, () => s("dev:event", id)));
        ev.append(btn("End event", () => s("dev:event", "end"), "danger"));
        pane.append(ev);
        pane.append(el(`<h4>Spawn enemies</h4>`));
        const sel = el<HTMLSelectElement>(`<select>${Object.values(ENEMIES).map((d) => `<option value="${d.key}"${d.key === spawnKey ? " selected" : ""}>${esc(d.name)}${d.boss ? " (boss)" : ""}</option>`).join("")}</select>`);
        sel.addEventListener("change", () => (spawnKey = sel.value));
        const lvl = el<HTMLInputElement>(`<input type="number" min="1" max="15" value="${spawnLevel}">`);
        lvl.addEventListener("change", () => (spawnLevel = Number(lvl.value) || 1));
        const elite = el<HTMLLabelElement>(`<label class="adm-check"><input type="checkbox"${spawnElite ? " checked" : ""}> Elite</label>`);
        elite.querySelector("input")!.addEventListener("change", (e) => (spawnElite = (e.target as HTMLInputElement).checked));
        pane.append(row("Enemy", sel), row("Level", lvl, elite), row("", btn("Spawn 1", () => s("dev:spawn", { key: spawnKey, level: spawnLevel, elite: spawnElite })), btn("Spawn 5", () => {
          for (let i = 0; i < 5; i++) s("dev:spawn", { key: spawnKey, level: spawnLevel, elite: spawnElite });
        })));
        pane.append(row("Clear", btn("Kill nearby (300)", () => s("dev:killnear", 300), "danger"), btn("Kill in view (800)", () => s("dev:killnear", 800), "danger")));
      } else pane.append(el(`<div class="adm-note">Events and spawning are available in the overworld.</div>`));
      break;
    }
    case "me": {
      const god = btn(ctx.god ? "God mode: ON" : "God mode: off", () => {
        ctx.setGod(!ctx.god);
        s("admin:god", !ctx.god);
      }, ctx.god ? "on" : "");
      pane.append(row("Health", btn("Heal fully", () => s("admin:heal", "")), god));
      const lvl = el<HTMLInputElement>(`<input type="number" min="1" max="12" value="${ctx.level}">`);
      pane.append(row("Level", lvl, btn("Set", () => s("admin:level", Number(lvl.value)))));
      pane.append(row("Gold", btn("+100", () => s("admin:add", { gold: 100 })), btn("+1,000", () => s("admin:add", { gold: 1000 })), btn("+10,000", () => s("admin:add", { gold: 10000 }))));
      pane.append(row("XP", btn("+500", () => s("admin:add", { xp: 500 })), btn("+5,000", () => s("admin:add", { xp: 5000 }))));
      pane.append(row("Skill points", btn("+1", () => s("admin:add", { points: 1 })), btn("+5", () => s("admin:add", { points: 5 })), btn("Learn all", () => s("admin:learnall")), btn("Reset tree", () => s("admin:resettree"), "danger")));
      const mastery = el(`<div class="adm-mastery"></div>`);
      for (let i = 1; i <= 10; i++) mastery.append(btn(String(i), () => s("admin:mastery", i)));
      pane.append(row("Weapon mastery", mastery));
      const wpn = el(`<div class="adm-grid tight"></div>`);
      for (const w of WEAPONS) wpn.append(btn(w.name, () => s("dev:weapon", w.key)));
      pane.append(row("Quick weapon", wpn));
      pane.append(row("World", btn("Reveal map + waystones", () => s("admin:reveal")), btn("Unlock Floor 2", () => s("admin:floor", 2))));
      break;
    }
    case "items": {
      const q = el<HTMLInputElement>(`<input class="adm-search" placeholder="Search items…" value="${esc(itemQuery)}">`);
      q.addEventListener("input", () => {
        itemQuery = q.value;
        grid.replaceChildren(...cells());
      });
      const rar = el(`<div class="adm-rarity"></div>`);
      RARITY_NAMES.forEach((n, i) => {
        const b = btn(n, () => {
          itemRarity = i;
          ctx.rerender();
        }, itemRarity === i ? "on" : "");
        b.style.color = RARITY_COLORS[i];
        rar.append(b);
      });
      const grid = el(`<div class="adm-items"></div>`);
      const cells = () =>
        ITEMS.filter((it) => !itemQuery || it.name.toLowerCase().includes(itemQuery.toLowerCase()) || it.key.includes(itemQuery.toLowerCase())).map((it) => {
          const stack = it.kind === "material" || it.kind === "consumable";
          const c = el(`<button class="adm-item" title="${esc(it.desc)}"><img src="${itemIcon(it.key, stack ? 0 : itemRarity)}" alt=""><span>${esc(it.name)}</span><small>${it.kind}</small></button>`);
          c.addEventListener("click", () => s("admin:give", { key: it.key, rarity: stack ? 0 : itemRarity, qty: stack ? 10 : 1 }));
          return c;
        });
      grid.append(...cells());
      pane.append(q, rar, grid, el(`<div class="adm-note">Click to add to your pack (materials and tonics come in tens).</div>`));
      setTimeout(() => q.focus(), 0);
      break;
    }
    case "quests": {
      for (const qd of QUESTS) {
        const st = ctx.quests[qd.id];
        const state = !st ? "Not started" : st.done ? "Done" : `Step ${st.stage + 1}/${qd.stages.length}`;
        const r = el(`<div class="adm-quest"><div><b>${esc(qd.name)}</b>${qd.main ? ` ${iconImg("main", 14)}` : ""}<span class="adm-qs ${st?.done ? "done" : st ? "on" : ""}">${state}</span></div><div class="adm-pact"></div></div>`);
        r.querySelector(".adm-pact")!.append(
          btn("Start", () => s("admin:quest", { id: qd.id, action: "start" })),
          btn("Complete", () => s("admin:quest", { id: qd.id, action: "complete" })),
          btn("Reset", () => s("admin:quest", { id: qd.id, action: "reset" }), "danger"),
        );
        pane.append(r);
      }
      break;
    }
    case "server": {
      const sv = ctx.data?.server;
      if (sv) {
        pane.append(el(`<div class="adm-stats">
          <div><span>Uptime</span><b>${time(sv.uptimeMs)}</b></div><div><span>Players online</span><b>${sv.online}</b></div>
          <div><span>This area</span><b>${esc(sv.room)} · ${sv.clients} connected</b></div><div><span>Enemies here</span><b>${sv.enemies}</b></div>
          <div><span>Items on the ground</span><b>${sv.drops}</b></div><div><span>Server memory</span><b>${sv.memMb} MB</b></div>
          <div><span>Mode</span><b>${sv.dev ? "development" : "production"}</b></div><div><span>Room id</span><b>${esc(sv.roomId)}</b></div>
        </div>`));
      } else pane.append(el(`<div class="adm-note">Loading…</div>`));
      const msg = el<HTMLInputElement>(`<input placeholder="Message to every player…" maxlength="200">`);
      pane.append(el(`<h4>Announcement</h4>`), row("", msg, btn("Send to all", () => {
        if (msg.value.trim()) s("admin:announce", msg.value);
        msg.value = "";
      })));
      break;
    }
  }
  return body;
}

/** Only these tabs show live server data; the others keep what you're typing. */
export const adminTabIsLive = () => tab === "players" || tab === "server";

/** Map canvas pixel → world position (matches drawParchmentMap's layout). */
export function mapClickToWorld(c: HTMLCanvasElement, m: WorldMap, ev: MouseEvent) {
  const r = c.getBoundingClientRect();
  const cx = ((ev.clientX - r.left) / r.width) * c.width;
  const cy = ((ev.clientY - r.top) / r.height) * c.height;
  const margin = 26;
  const s = (c.width - margin * 2) / m.width;
  return { x: ((cx - margin) / s) * TILE, y: ((cy - margin) / s) * TILE };
}
