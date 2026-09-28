import * as Phaser from "phaser";
import { Callbacks, Predict, type InputHandle, type Reconciler, type Room } from "@colyseus/sdk";
import {
  Act, aimToRad, applyGates, buildFloor1, buildFloor2Landing, buildUndercroft, EAct, EFlag, ENEMIES, getMove, HazardKind, impactMs, INTERP_DELAY,
  isActiveTick, itemBase, keyLabel, parryDef, PLAYER_RADIUS, ProjKind, radToAim, RARITY_COLORS, shapeHits, stepPlayer, Tile, TICK_MS, TILE, TIMING_TOLERANCE_MS,
  WEAPONS, windupTicks, type Bindings, type Body, type GateDef, type PlayerCommand, type PlayerSim, type WorldMap, type Zone,
} from "@floors/shared";
import type { Enemy, Hazard, Player, Projectile, WorldState } from "../../../server/src/state.ts";
import { ambience } from "../audio/ambience.ts";
import { music } from "../audio/music.ts";
import { sfx, type Material, type Surface } from "../audio/sfx.ts";
import { Hud } from "../hud.ts";
import { Controls } from "../input.ts";
import type { RoomKind, Session } from "../net.ts";
import { weaponTrail } from "../art/characters.ts";
import { settings } from "../settings.ts";
import { EnemyView, PlayerView } from "../render/entities.ts";

/** What an enemy sounds like when struck. */
function materialOf(ev: EnemyView): Material {
  if (ev.prop) return "wood";
  if (ev.def.look.rig === "construct" || ev.def.key === "shieldbearer" || ev.def.key === "warden" || ev.def.key === "sparring") return "metal";
  return "flesh";
}
import { Fx } from "../render/fx.ts";
import { Lighting, type Light } from "../render/lighting.ts";
import { ObjectiveArrow, objectiveTarget } from "../render/objective.ts";
import { WorldObjects, type Interactable } from "../render/objects.ts";
import { Sky } from "../render/sky.ts";
import { Terrain } from "../render/terrain.ts";
import { goldIcon, itemIcon } from "../ui/icons.ts";
import type { DialogMsg, GameUI, InvView } from "../ui/ui.ts";

const PREDICTED = ["x", "y", "dir", "gait", "aim", "stamina", "staminaMax", "staminaDelay", "exhausted", "act", "actTick", "actMove", "actAim", "actSeq", "combo", "comboTimer", "buf", "bufAim", "bufAge", "dodgeDx", "dodgeDy", "kbx", "kby", "hurtDur", "weapon", "mods", "parryOk", "cd1", "cd2", "potions"] as const;
const GOLD = 0xffd76a;
const RED = 0xff4a3a;

export class WorldScene extends Phaser.Scene {
  private room!: Room<any, WorldState>;
  private map!: WorldMap;
  private predict!: Predict<WorldState>;
  private input_!: InputHandle<PlayerCommand>;
  private me?: Reconciler<PlayerSim>;
  private myPlayer?: Player;
  private players = new Map<string, PlayerView>();
  private enemies = new Map<string, EnemyView>();
  private hud = new Hud();
  private controls!: Controls;
  private objective!: ObjectiveArrow;
  private terrain!: Terrain;
  private fx!: Fx;
  private bars!: Phaser.GameObjects.Graphics;
  private zone?: Zone;
  private lookAhead = new Phaser.Math.Vector2();
  private predictedHits = new Map<string, number>();
  private predictedParry = new Map<string, number>();
  private glinted = new Set<string>();
  private localAction = { seq: -1, view: 0, swung: false };
  private prevView = 0;
  private stepTimer = 0;
  /** Camera push toward the blow: a spring added to the follow offset. */
  private punch = { x: 0, y: 0, vx: 0, vy: 0 };
  /** Last time this client's attacks landed on each enemy (for kill confirmation). */
  private lastHitOn = new Map<string, number>();
  private dodgeSeen = new Map<string, number>();
  private heartAt = 0;
  private bossSeen = new Set<string>();
  /** Zoom that fits the screen height; the player's zoom setting multiplies it. */
  private fitZoom = 2;
  private zoomNow = 2;
  private zoomKick = 0;
  private session!: Session;
  private ui!: GameUI;
  private kind: RoomKind = "world";
  private objects!: WorldObjects;
  private sky!: Sky;
  private lighting!: Lighting;
  private travelling = false;
  private promptEl = document.getElementById("prompt-f")!;
  private focus?: Interactable;
  private revivingUntil = 0;
  private deadSince = 0;

  constructor() {
    super("world");
  }

  init(data: { session: Session; ui: GameUI }) {
    this.session = data.session;
    this.ui = data.ui;
    this.room = data.session.room!;
    this.kind = data.session.kind;
    this.players = new Map();
    this.enemies = new Map();
    this.me = undefined;
    this.myPlayer = undefined;
    this.zone = undefined;
    this.travelling = false;
    this.bossSeen = new Set();
  }

  create() {
    this.map = this.kind === "dungeon" ? buildUndercroft() : this.kind === "floor2" ? buildFloor2Landing() : buildFloor1();
    this.sky = new Sky(this, this.kind === "dungeon" ? "dusk" : this.kind === "floor2" ? "gold" : "day");
    this.terrain = new Terrain(this, this.map);
    this.objects = new WorldObjects(this, this.map);
    this.lighting = new Lighting(this);
    this.fx = new Fx(this);
    this.bars = this.add.graphics().setDepth(1e6 - 1);
    this.objective = new ObjectiveArrow(this);
    this.ui.npcName = (id) => this.map.npcs.find((n) => n.id === id)?.name;
    this.controls = new Controls(this);
    this.ui.onBlockChange = (b) => (this.controls.blocked = b);
    this.ui.onCapture = (on) => (this.controls.capturing = on);
    this.ui.mapRender = (c) => this.drawMap(c);

    this.predict = Predict.get(this.room, { mode: "lerp", delay: INTERP_DELAY });
    this.predict.attachAll("players", { fields: ["x", "y"], mode: "lerp" });
    this.predict.attachAll("enemies", { fields: ["x", "y"], mode: "lerp" });
    this.input_ = this.room.input<PlayerCommand>({ mode: "reliable" });

    const $ = Callbacks.get(this.room);
    $.onAdd("players", (p, sid) => this.addPlayer(p as Player, sid as string));
    $.onRemove("players", (_p, sid) => {
      this.players.get(sid as string)?.destroy();
      this.players.delete(sid as string);
    });
    $.onAdd("enemies", (e, id) => this.enemies.set(id as string, new EnemyView(this, e as Enemy)));
    $.onRemove("enemies", (_e, id) => {
      this.enemies.get(id as string)?.destroy();
      this.enemies.delete(id as string);
    });
    // Dungeon portcullises: the same tiles change on server and client, so prediction stays exact.
    $.listen("gates", (mask) => {
      const m = this.map as WorldMap & { gates?: GateDef[] };
      if (!m.gates) return;
      applyGates(m as WorldMap & { gates: GateDef[] }, mask as number);
      for (const g of m.gates) for (const [x, y] of g.tiles) this.terrain.invalidate(x, y);
    });
    this.bindEvents();
    this.bindUi();

    const cam = this.cameras.main;
    cam.setBounds(-400, -300, this.map.width * TILE + 800, this.map.height * TILE + 600);
    cam.setBackgroundColor("rgba(0,0,0,0)");
    const fit = () => {
      this.fitZoom = Phaser.Math.Clamp(this.scale.height / 340, 1.6, 3.4);
    };
    fit();
    this.scale.on("resize", fit);
    this.zoomNow = this.fitZoom * settings.value.zoom;
    // Mouse wheel zooms the camera (saved with the other settings).
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.ui.blocking || !dy) return;
      settings.set({ zoom: settings.value.zoom * (dy > 0 ? 1 / 1.07 : 1.07) });
    });
    const offSettings = settings.onChange((v) => this.applyKeyLabels(v.bindings));

    this.room.onLeave((code) => {
      if (this.travelling) return;
      this.hud.status(code === 4001 ? "You logged in somewhere else." : "Disconnected from the world. Refresh to reconnect.");
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || this.controls.capturing || settings.value.bindings.interact.indexOf(e.code) < 0) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      this.interact();
    };
    window.addEventListener("keydown", onKey);
    this.events.once("shutdown", () => {
      this.objects.destroy();
      window.removeEventListener("keydown", onKey);
      offSettings();
    });
    document.getElementById("respawn-now")!.onclick = () => this.room.send("respawnNow");
    music.play(this.kind === "dungeon" ? "dungeon" : this.kind === "floor2" ? "skyreach" : "town");
    if (import.meta.env.DEV) (window as unknown as { __floors: unknown }).__floors = this;
  }

  private addPlayer(p: Player, sid: string) {
    const isMe = sid === this.room.sessionId;
    const view = new PlayerView(this, p, isMe);
    this.players.set(sid, view);
    if (!isMe) return;
    this.myPlayer = p;
    this.me = this.predict.reconciler(p as unknown as PlayerSim, {
      input: this.input_,
      fields: PREDICTED as unknown as (keyof PlayerSim & string)[],
      step: (ctx, s, cmd) => stepPlayer(s, cmd, ctx.dt, this.map, this.bodies()),
      smoothMs: 60,
    });
    this.cameras.main.startFollow(view.rig.root, false, 0.16, 0.16);
  }

  private bodyList: Body[] = [];
  /** Enemy bodies as displayed — what the local player's lunges stop against. */
  private bodies(): Body[] {
    const out = this.bodyList;
    out.length = 0;
    this.room.state.enemies?.forEach((e) => {
      if (e.act === EAct.Dead) return;
      out.push({ x: this.predict.value(e, "x"), y: this.predict.value(e, "y"), r: ENEMIES[e.def].radius });
    });
    return out;
  }

  /** Server time this client is displaying remote entities at. */
  private viewNow() {
    return this.room.clock.serverNow() - INTERP_DELAY - this.room.clock.smoothedRtt() / 2;
  }

  // ---------------------------------------------------------------------------

  update(_time: number, delta: number) {
    const state = this.room.state;
    // Filtered collections (enemies, drops, hazards, projectiles) only exist once something in them is in view.
    if (!state.players) return;
    const cam = this.cameras.main;
    const view = this.viewNow();

    // Input: one frame per due fixed step.
    const steps = this.predict.tick(performance.now());
    if (this.me) {
      const s = this.me.state;
      // Exact state, not the smoothed render value: reading value() before this frame's sends is stale.
      const px = (s.x - cam.worldView.x) * cam.zoom;
      const py = (s.y - 14 - cam.worldView.y) * cam.zoom;
      for (let i = 0; i < steps; i++) {
        const f = this.controls.frame(px, py, s.aim);
        this.input_.data.mx = f.mx;
        this.input_.data.my = f.my;
        this.input_.data.aim = f.aim;
        this.input_.data.btn = f.btn;
        this.input_.send();
        if (s.actSeq !== this.localAction.seq) {
          this.localAction = { seq: s.actSeq, view, swung: false };
          this.onLocalAction(s);
        }
      }
    }

    state.players.forEach((p, sid) => {
      const v = this.players.get(sid);
      if (!v) return;
      if (v.lookChanged(p)) {
        v.destroy();
        this.players.delete(sid);
        this.addPlayer(p, sid);
        return;
      }
      const isMe = sid === this.room.sessionId && this.me;
      const s = isMe ? this.me!.state : (p as unknown as PlayerSim);
      const x = this.predict.value(p, "x");
      const y = this.predict.value(p, "y");
      v.update(p, s, x, y, delta, isMe ? s.actTick * TICK_MS : undefined);
      // Rare gear should be noticed: epic/legendary weapons shed sparkles, mastery shimmers gold.
      if ((p.weaponRarity >= 3 || p.mastered) && Math.random() < delta / 180) {
        const tip = v.rig.tip(v.pose);
        const color = p.weaponRarity >= 3 ? Phaser.Display.Color.HexStringToColor(RARITY_COLORS[p.weaponRarity]).color : 0xffe08a;
        const k = Math.random();
        this.fx.star(x + tip.x * k, y + tip.y * k - 4, color, 3 + Math.random() * 3, 420);
      }
      this.attackTrail(v, s, x, y);
      if (s.act === Act.Dodge && this.dodgeSeen.get(sid) !== s.actSeq) {
        this.dodgeSeen.set(sid, s.actSeq);
        this.fx.dust(x, y, 7, Math.atan2(s.dodgeDy, s.dodgeDx) + Math.PI);
      } else if (s.act === Act.None && s.gait === 2 && Math.random() < delta / 150) {
        this.fx.dust(x, y, 2, (s.dir * Math.PI) / 4 + Math.PI);
      }
    });

    state.enemies?.forEach((e, id) => {
      const v = this.enemies.get(id);
      if (!v) return;
      const x = this.predict.value(e, "x");
      const y = this.predict.value(e, "y");
      v.update(e, x, y, view, delta);
      this.enemyTelegraph(id, e, v, x, y, view);
    });

    this.localCombat(view);
    this.drawWorldFx(view);
    this.drawBars();
    this.fx.update(delta);
    this.terrain.update(cam);
    const occluded: { x: number; y: number }[] = [];
    state.players.forEach((p) => occluded.push({ x: this.predict.value(p, "x"), y: this.predict.value(p, "y") - 10 }));
    this.terrain.fadeOccluders(occluded, delta);
    this.sky.update(cam, delta);
    this.objects.merchantActive = state.event === "merchant";
    this.objects.syncDrops(state.drops, this.ui.inv?.key);
    const mx = this.me?.value("x") ?? 0;
    const my = this.me?.value("y") ?? 0;
    this.objects.update(delta, this.ui.inv, state.stage, mx, my);
    this.updatePrompt(mx, my);
    const alive = this.me && this.me.state.act !== Act.Dead;
    this.objective.update(delta, mx, my, alive && this.ui.inv ? objectiveTarget(this.map, this.ui.inv, mx, my) : undefined);
    this.updateLighting(delta);
    this.updateCamera(delta);
    this.updateHud();
    this.prevView = view;
    this.pruneMaps();
  }

  // ---------------------------------------------------------------------------
  // Interaction (F)

  private updatePrompt(x: number, y: number) {
    const list = this.objects.interactables(x, y, this.room.state.drops, this.ui.inv?.key);
    // Fallen allies and other players.
    this.room.state.players.forEach((p, sid) => {
      if (sid === this.room.sessionId) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d > 48) return;
      if (p.act === Act.Dead) list.unshift({ kind: "ally", id: sid, x: p.x, y: p.y - 30, label: `Revive ${p.name}` });
      else list.push({ kind: "player", id: sid, x: p.x, y: p.y - 44, label: `Inspect ${p.name}` });
    });
    this.focus = this.me && this.me.state.act !== Act.Dead ? list[0] : undefined;
    const el = this.promptEl;
    if (!this.focus || this.ui.blocking) {
      el.classList.add("hidden");
      return;
    }
    const cam = this.cameras.main;
    el.classList.remove("hidden");
    el.innerHTML = `<b>${keyLabel(settings.value.bindings.interact[0])}</b> ${this.focus.label}`;
    el.style.left = `${(this.focus.x - cam.worldView.x) * cam.zoom}px`;
    el.style.top = `${(this.focus.y - cam.worldView.y) * cam.zoom}px`;
  }

  private applyKeyLabels(b: Bindings) {
    const set = (id: string, code: string | undefined) => {
      const k = document.querySelector(`#${id} .key`);
      if (k) k.textContent = keyLabel(code);
    };
    set("slot-skill1", b.skill1[0]);
    set("slot-skill2", b.skill2[0]);
    set("slot-potion", b.use[0]);
    const hint = document.getElementById("hint");
    if (hint) {
      const k = (a: keyof Bindings) => keyLabel(b[a][0]);
      hint.textContent = `${k("light")} attack · ${k("heavy")} heavy · ${k("dodge")} dodge · ${k("parry")} parry · ${k("interact")} interact · ${k("pack")} pack · ${k("quests")} quests · ${k("map")} map · Esc settings`;
    }
  }

  private interact() {
    const f = this.focus;
    if (!f || this.ui.blocking) return;
    sfx.unlock();
    switch (f.kind) {
      case "npc":
      case "object":
        this.room.send("interact", f.id);
        break;
      case "drop":
        this.room.send("pickup", f.id);
        break;
      case "ally":
        this.room.send("revive", f.id);
        this.revivingUntil = performance.now() + 1500;
        break;
      case "player":
        this.room.send("inspect", f.id);
        break;
    }
  }

  private updateLighting(delta: number) {
    const zone = this.me ? this.map.zoneAt(this.me.state.x, this.me.state.y) : undefined;
    this.lighting.target = zone?.dark ? 0.8 : 0;
    if (this.lighting.target === 0 && delta > 0) {
      this.lighting.update(this.cameras.main, [], delta);
      return;
    }
    const lights: Light[] = [];
    this.room.state.players.forEach((p) => lights.push({ x: this.predict.value(p, "x"), y: this.predict.value(p, "y") - 12, r: 150, flicker: 0.2 }));
    const cam = this.cameras.main.worldView;
    const t0x = Math.floor((cam.x - 100) / TILE);
    const t1x = Math.ceil((cam.right + 100) / TILE);
    const t0y = Math.floor((cam.y - 100) / TILE);
    const t1y = Math.ceil((cam.bottom + 100) / TILE);
    for (let ty = t0y; ty <= t1y; ty++)
      for (let tx = t0x; tx <= t1x; tx++) if (this.map.get(tx, ty) === Tile.Crystal) lights.push({ x: tx * TILE + 16, y: ty * TILE, r: 70, color: 0x6fd0ff });
    for (const o of this.map.objects) {
      if (o.kind === "campfire" || o.kind === "gate" || o.kind === "waystone") lights.push({ x: o.x, y: o.y - 20, r: o.kind === "campfire" ? 180 : 110, flicker: 0.5, color: o.kind === "campfire" ? 0xffa040 : 0xffe0a0 });
    }
    this.room.state.projectiles?.forEach((pr) => {
      const t = (this.viewNow() - pr.born) / 1000;
      const d = pr.speed * t;
      if (t > 0 && d < pr.range) lights.push({ x: pr.x0 + Math.cos(pr.angle) * d, y: pr.y0 + Math.sin(pr.angle) * d, r: 60 });
    });
    this.room.state.enemies?.forEach((e) => {
      if (ENEMIES[e.def].look.glow) lights.push({ x: this.predict.value(e, "x"), y: this.predict.value(e, "y") - 20, r: ENEMIES[e.def].boss ? 140 : 50 });
    });
    this.lighting.update(this.cameras.main, lights, delta);
  }

  // ---------------------------------------------------------------------------
  // Travel between rooms

  private async travelTo(kind: RoomKind, roomId?: string) {
    if (this.travelling) return;
    this.travelling = true;
    this.ui.closeAll();
    this.hud.flash(0.8, 900);
    this.hud.status("Travelling…");
    try {
      await this.session.travel(kind, roomId);
      this.hud.status("");
      this.scene.restart({ session: this.session, ui: this.ui });
    } catch (e) {
      this.travelling = false;
      this.hud.status("");
      this.ui.toast(e instanceof Error ? e.message : "The way is barred.", "error");
      // Fall back to the world so the player is never stranded.
      if (kind !== "world") void this.travelTo("world");
    }
  }

  // ---------------------------------------------------------------------------
  // UI messages

  private bindUi() {
    const r = this.room;
    const ui = this.ui;
    r.onMessage("inv", (v: InvView) => ui.setInv(v));
    r.onMessage("settings", (m: unknown) => settings.fromServer(m));
    r.onMessage("bank", (m: { bank: InvView["inventory"]; bankGold: number }) => ui.setBank(m.bank, m.bankGold));
    r.onMessage("dialog", (d: DialogMsg) => ui.showDialog(d));
    r.onMessage("lore", (m: { name: string; text: string }) => ui.lore(m.name, m.text));
    r.onMessage("waystones", (m: { from: string; list: { id: string; name: string }[] }) => ui.waystones(m.list, m.from));
    r.onMessage("notice", (m: { text: string; kind: "info" | "error" | "good" }) => ui.toast(m.text, m.kind));
    r.onMessage("chat", (m: { from: string; text: string; channel: string }) => ui.chat(m));
    r.onMessage("party", (m) => ui.setParty(m));
    r.onMessage("partyStatus", (m) => ui.setPartyStatus(m));
    r.onMessage("partyInvite", (m: { from: string }) => ui.invite(m.from));
    r.onMessage("inspect", (m) => ui.inspect(m, m.sid));
    r.onMessage("tradeRequest", (m: { from: string; name: string }) => ui.tradeRequest(m.from, m.name));
    r.onMessage("trade", (m) => ui.setTrade(m));
    r.onMessage("travel", (m: { room: RoomKind; roomId?: string; leader?: string }) => {
      if (m.roomId && m.leader && m.leader !== this.myPlayer?.name) {
        if (!confirm(`${m.leader} has unsealed the Undercroft. Join your party below?`)) return;
      }
      void this.travelTo(m.room, m.roomId);
    });
    r.onMessage("looted", (m: { key: string; rarity: number; qty: number }) => {
      if (m.key === "gold") {
        ui.toast(`+${m.qty} gold`, "loot", goldIcon(), "#f2c94c");
        sfx.chime(0);
        return;
      }
      if (m.key === "bag") {
        ui.toast(`Recovered your belongings${m.qty ? ` (+${m.qty} gold)` : ""}`, "good");
        sfx.chime(1);
        return;
      }
      const b = itemBase(m.key);
      ui.toast(`${m.qty > 1 ? `${m.qty}× ` : ""}${b?.name ?? m.key}`, "loot", itemIcon(m.key, m.rarity), RARITY_COLORS[m.rarity]);
      sfx.chime(m.rarity);
      if (m.rarity >= 3) {
        this.hud.flash(0.18, 400);
        const p = this.me?.state;
        if (p) this.fx.ring(p.x, p.y - 14, Phaser.Display.Color.HexStringToColor(RARITY_COLORS[m.rarity]).color, 8, 60, 700, 4);
      }
    });
    r.onMessage("xp", (m: { amount: number; x?: number; y?: number; event?: string; party?: boolean }) => {
      const p = this.me?.state;
      if (p) this.fx.text(p.x, p.y - 50, `+${m.amount} XP`, { color: "#b9a8ff", size: 9 }, 900, 26);
      if (m.event) ui.toast(`${m.event}: +${m.amount} XP`, "good");
    });
    r.onMessage("levelup", (m: { p: string; level: number; x: number; y: number }) => {
      this.fx.ring(m.x, m.y - 14, 0xffe08a, 8, 70, 800, 5);
      this.fx.burst(m.x, m.y - 14, 0xffe08a, 30, 140, 2.6, 900);
      if (m.p === r.sessionId) {
        sfx.levelUp();
        this.hud.title(`Level ${m.level}`, "You grow stronger");
      }
    });
    r.onMessage("mastery", (m: { weapon: string; level: number }) => {
      sfx.levelUp();
      ui.toast(`${WEAPONS.find((w) => w.key === m.weapon)?.name} mastery ${m.level}!`, "good");
      this.hud.title(`${WEAPONS.find((w) => w.key === m.weapon)?.name} Mastery ${m.level}`, "New techniques unlocked — see Character (C)");
    });
    r.onMessage("achievement", (a: { name: string; desc: string }) => {
      this.hud.title(`Achievement: ${a.name}`, a.desc);
      ui.toast(`Achievement unlocked — ${a.name}`, "good");
      sfx.chime(3);
    });
    r.onMessage("forged", (m: { key: string; plus: number }) => {
      sfx.parry(true);
      ui.toast(`${itemBase(m.key)?.name} +${m.plus} forged!`, "good");
    });
    r.onMessage("quest", (updates: { id: string; name: string; text: string; done?: boolean; accepted?: boolean }[]) => {
      for (const u of updates) {
        if (u.done) {
          this.hud.title("Quest complete", u.name);
          sfx.levelUp();
        } else if (u.accepted) ui.toast(`New quest: ${u.name}`, "good");
        else ui.toast(`${u.name}: ${u.text}`);
      }
    });
    r.onMessage("discover", (m: { name: string; secret: boolean; sub?: string }) => {
      this.hud.title(m.name, m.sub ?? (m.secret ? "Secret area discovered" : ""));
      if (m.secret) {
        sfx.chime(3);
        ui.toast(`Discovered: ${m.name} (+40 XP)`, "good");
      }
    });
    r.onMessage("event", (m: { name: string; text: string; ended?: boolean; success?: boolean }) => {
      ui.system(m.text);
      if (!m.ended) {
        this.hud.title(m.name, "World event");
        sfx.roar();
      } else if (m.success) ui.toast(m.text, "good");
    });
    r.onMessage("died", (m: { gold: number; items: number }) => {
      ui.toast(m.gold || m.items ? `You dropped ${m.gold} gold${m.items ? ` and ${m.items} stack(s) of materials` : ""} where you fell. Go back for them.` : "You have fallen.", "error");
    });
    r.onMessage("heal", (m: { p: string; d: number; x: number; y: number }) => {
      this.fx.text(m.x, m.y - 40, `+${m.d}`, { color: "#8fe38a", size: 10, bold: true }, 800);
      this.fx.burst(m.x, m.y - 14, 0x8fe38a, 10, 60, 2, 600);
    });
    r.onMessage("reviving", (m: { t: string; ms: number }) => {
      const p = this.room.state.players.get(m.t);
      if (p) this.fx.ring(p.x, p.y - 10, 0x9fe0a6, 30, 6, m.ms, 3);
    });
    r.onMessage("banner", (m: { title: string; sub: string }) => {
      this.hud.title(m.title, m.sub);
      sfx.boom(false);
    });
    r.onMessage("bossIntro", (m: { name: string; sub: string }) => {
      this.hud.title(m.name, m.sub);
      this.hud.flash(0.35, 800);
      this.cameras.main.shake(600, 0.006);
      sfx.roar();
      music.play("boss");
    });
    r.onMessage("victory", (m: { title: string; sub: string }) => {
      this.hud.title(m.title, m.sub);
      this.hud.flash(0.6, 1500);
      sfx.levelUp();
      music.play("victory");
    });
  }

  // ---------------------------------------------------------------------------
  // Map panel

  private drawMap(c: HTMLCanvasElement) {
    const g = c.getContext("2d")!;
    const m = this.map;
    const s = Math.min(c.width / m.width, c.height / m.height);
    c.height = Math.round(m.height * s);
    const inv = this.ui.inv;
    const known = new Set(inv?.discovered ?? []);
    const colors: Record<number, string> = {
      [Tile.Grass]: "#5f9a48", [Tile.TallGrass]: "#5f9a48", [Tile.Flowers]: "#6aa650", [Tile.Path]: "#c9a86a", [Tile.Cobble]: "#9b968b",
      [Tile.Wall]: "#6b645a", [Tile.Tree]: "#2f6a37", [Tile.Water]: "#3f86c0", [Tile.House]: "#a05a3a", [Tile.Rock]: "#3b3e46",
      [Tile.CaveFloor]: "#62666f", [Tile.Sand]: "#d8c08a", [Tile.StoneFloor]: "#a89f8c", [Tile.RuinWall]: "#7a705e", [Tile.Palisade]: "#7a5433",
      [Tile.Fence]: "#8a6a4a", [Tile.Cliff]: "#8a6e52", [Tile.Crystal]: "#8fe3ff", [Tile.Gate]: "#556", [Tile.Crop]: "#a8894f", [Tile.Prop]: "#8a7a64",
    };
    g.fillStyle = "#0b1016";
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const t = m.get(x, y);
        if (t === Tile.Void) continue;
        const z = m.zoneAt(x * TILE + 16, y * TILE + 16);
        // Undiscovered regions stay dark; secrets are never revealed until visited.
        const seen = !z || known.has(`zone:${z.id}`) || (z.id === "green-fields" && true);
        if (z?.secret && !known.has(`zone:${z.id}`)) g.fillStyle = colors[Tile.Tree];
        else g.fillStyle = colors[t] ?? "#555";
        g.globalAlpha = seen ? 1 : 0.18;
        g.fillRect(x * s, y * s, Math.ceil(s), Math.ceil(s));
      }
    }
    g.globalAlpha = 1;
    g.font = "bold 13px Georgia";
    g.textAlign = "center";
    for (const z of m.zones) {
      if (z.id === "green-fields" || z.secret || !known.has(`zone:${z.id}`)) continue;
      g.fillStyle = "#fff4d6";
      g.strokeStyle = "#1d1a17";
      g.lineWidth = 3;
      const cx = ((z.x0 + z.x1) / 2) * s;
      const cy = ((z.y0 + z.y1) / 2) * s;
      g.strokeText(z.name, cx, cy);
      g.fillText(z.name, cx, cy);
    }
    for (const o of m.objects) {
      if (o.kind === "waystone" && known.has(`ws:${o.id}`)) {
        g.fillStyle = "#8fe3ff";
        g.fillRect((o.x / TILE) * s - 3, (o.y / TILE) * s - 3, 6, 6);
      }
      if (o.kind === "door" || (o.kind === "gate" && o.id === "ascent-gate")) {
        g.fillStyle = "#ffd98a";
        g.beginPath();
        g.arc((o.x / TILE) * s, (o.y / TILE) * s, 4, 0, Math.PI * 2);
        g.fill();
      }
    }
    this.room.state.players.forEach((p, sid) => {
      const mine = sid === this.room.sessionId;
      const party = this.myPlayer?.party && p.party === this.myPlayer.party;
      if (!mine && !party) return;
      g.fillStyle = mine ? "#ffe08a" : "#9fe0ff";
      g.beginPath();
      g.arc((p.x / TILE) * s, (p.y / TILE) * s, mine ? 5 : 4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#1d1a17";
      g.lineWidth = 2;
      g.stroke();
    });
  }

  // ---------------------------------------------------------------------------
  // Local feedback (predicted, instant)

  private onLocalAction(s: PlayerSim) {
    if (s.act === Act.Dodge) sfx.dodge();
    if (s.act === Act.Parry) sfx.swing(0.2);
  }

  private localCombat(view: number) {
    const me = this.me;
    const pv = this.players.get(this.room.sessionId);
    if (!me || !pv) return;
    const s = me.state;
    const x = me.value("x");
    const y = me.value("y");
    sfx.setListener(x, y);

    // Footsteps.
    if (s.act === Act.None && s.gait > 0) {
      this.stepTimer -= this.game.loop.delta;
      if (this.stepTimer <= 0) {
        this.stepTimer = s.gait === 2 ? 210 : 320;
        sfx.step(undefined, undefined, false, this.surfaceAt(x, y));
      }
    }

    const m = s.act === Act.Light || s.act === Act.Heavy || s.act === Act.Skill ? getMove(s.weapon, s.actMove) : undefined;
    if (m && s.actTick >= m.startup && !this.localAction.swung) {
      this.localAction.swung = true;
      sfx.swing(m.impact, undefined, undefined, WEAPONS[s.weapon].key);
      if (m.projectile) sfx.shoot(WEAPONS[s.weapon].key === "daggers" ? "knife" : "magic");
    }
    // Predicted hits against what we see: instant spark, sound and hitstop.
    if (m?.shape && isActiveTick(s)) {
      const rad = aimToRad(s.actAim);
      this.room.state.enemies?.forEach((e, id) => {
        if (e.act === EAct.Dead || e.act === EAct.Spawn) return;
        const key = `${s.actSeq}:${id}`;
        if (this.predictedHits.has(key)) return;
        const ex = this.predict.value(e, "x");
        const ey = this.predict.value(e, "y");
        if (!shapeHits(m.shape!, x, y, rad, ex, ey, ENEMIES[e.def].radius)) return;
        this.predictedHits.set(key, performance.now());
        const ev = this.enemies.get(id);
        const guard = e.act === EAct.Guard && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(y - ey, x - ex) - aimToRad(e.aim))) < 1.25 && m.poise < 35;
        this.impactFx(ex, ey - 14, rad, m.impact, guard, ev, true);
        this.lastHitOn.set(id, performance.now());
        pv.clock.hold(m.hitstop);
        ev?.clock.hold(m.hitstop);
      });
    }

    // Predicted parry: the swing we see connecting inside our parry window.
    if (s.act === Act.Parry) {
      const pr = parryDef(s);
      this.room.state.enemies?.forEach((e, id) => {
        if (e.act !== EAct.Attack) return;
        const atk = ENEMIES[e.def].attacks[e.atk];
        if (!atk.parryable || !atk.shape) return;
        const H = e.actStart + impactMs(atk, e.flags);
        const key = `${id}:${e.actStart}`;
        if (this.predictedParry.has(key) || !(this.prevView < H && view >= H)) return;
        const elapsed = H - this.localAction.view;
        if (elapsed < -TIMING_TOLERANCE_MS || elapsed > pr.window * TICK_MS + TIMING_TOLERANCE_MS) return;
        const ox = atk.targeted ? e.ax : this.predict.value(e, "x");
        const oy = atk.targeted ? e.ay : this.predict.value(e, "y");
        if (!shapeHits(atk.shape, ox, oy, aimToRad(e.aim), x, y, PLAYER_RADIUS)) return;
        this.predictedParry.set(key, performance.now());
        this.parryFx(x, y, elapsed <= pr.perfect * TICK_MS + TIMING_TOLERANCE_MS, this.enemies.get(id));
      });
    }
  }

  private impactFx(x: number, y: number, ang: number, impact: number, blocked: boolean, ev?: EnemyView, mine = false) {
    if (blocked) {
      this.fx.sparks(x, y, ang + Math.PI, 0xdfe6ee, 8, 200);
      ev?.recoil.kick(ang, 1);
      sfx.parry(false, x, y);
      if (mine) this.camPunch(ang + Math.PI, 1.5);
      return;
    }
    ev?.flash();
    ev?.recoil.kick(ang, 1.5 + impact * 4);
    this.fx.sparks(x, y, ang, 0xfff3c4, 8 + Math.round(impact * 10), 240 + impact * 200);
    this.fx.burst(x, y, 0xffffff, 4, 60, 2, 200);
    this.fx.ring(x, y, 0xffffff, 4, 14 + impact * 14, 140, 2);
    sfx.hit(impact > 0.4, x, y, false, ev ? materialOf(ev) : "flesh");
    if (mine) {
      // Push the view along the blow; only the heaviest hits also shake.
      this.camPunch(ang, 1 + impact * 3.5);
      if (impact >= 0.6) this.cameras.main.shake(90 + impact * 60, 0.0012 + impact * 0.0022);
    }
  }

  private camPunch(angle: number, px: number) {
    this.punch.vx += Math.cos(angle) * px * 34;
    this.punch.vy += Math.sin(angle) * px * 28;
  }

  private surfaceAt(x: number, y: number): Surface {
    const t = this.map.get(Math.floor(x / TILE), Math.floor(y / TILE));
    if (t === Tile.Grass || t === Tile.Flowers || t === Tile.TallGrass) return "grass";
    if (t === Tile.Sand || t === Tile.Path || t === Tile.CaveFloor || t === Tile.Crop) return "soft";
    return "stone";
  }

  private parryFx(x: number, y: number, perfect: boolean, ev?: EnemyView) {
    const color = perfect ? 0xffffff : GOLD;
    this.fx.ring(x, y - 14, color, 6, perfect ? 46 : 30, perfect ? 380 : 260, perfect ? 4 : 3);
    this.fx.sparks(x, y - 16, -Math.PI / 2, GOLD, perfect ? 26 : 14, perfect ? 360 : 260, Math.PI * 2);
    this.fx.star(x, y - 18, color, perfect ? 22 : 14, perfect ? 360 : 240);
    this.fx.text(x, y - 42, perfect ? "PERFECT PARRY" : "PARRY", { color: perfect ? "#ffffff" : "#ffd76a", size: perfect ? 13 : 11, bold: true }, 900, 30);
    sfx.parry(perfect, x, y);
    const pv = this.players.get(this.room.sessionId);
    pv?.clock.hold(perfect ? 140 : 80);
    ev?.clock.hold(perfect ? 180 : 100);
    ev?.flash();
    if (perfect) {
      music.duck(0.3, 650);
      this.hud.flash(0.3, 180);
      this.zoomKick = 0.07;
      this.cameras.main.shake(110, 0.004);
    }
  }

  // ---------------------------------------------------------------------------
  // Server events

  private bindEvents() {
    const me = () => this.room.sessionId;
    this.room.onMessage("hit", (m: { t: string; d: number; c?: number; r: number; x: number; y: number; a?: string; hs?: number; im?: number; heavy?: number; mis?: number; ang?: number }) => {
      if (m.t.startsWith("p:")) {
        const sid = m.t.slice(2);
        const v = this.players.get(sid);
        v?.rig.flash(100);
        v?.clock.hold(90);
        const hitAng = m.ang ?? Math.PI / 2;
        v?.recoil.kick(hitAng, m.heavy ? 5 : 3);
        // Anchor to where the character is drawn now (knockback may already have moved them).
        const hx = v?.rig.root.x ?? m.x;
        const hy = v?.rig.root.y ?? m.y;
        this.fx.number(hx, hy - 32, String(m.d), { color: sid === me() ? "#ff6b5a" : "#ffb0a0", size: sid === me() ? 12 : 9, bold: true }, hitAng, 800);
        this.fx.sparks(hx, hy - 14, -Math.PI / 2, 0xff5a4a, 8, 200, Math.PI * 2);
        if (sid === me()) {
          sfx.hurt();
          this.hud.hurtVignette(m.heavy ? 0.9 : 0.55);
          this.camPunch(hitAng, m.heavy ? 4.5 : 2.5);
          this.cameras.main.shake(m.heavy ? 160 : 80, m.heavy ? 0.0045 : 0.0018);
          if (m.mis) this.fx.text(m.x, m.y - 50, "Mistimed", { color: "#f2a08a", size: 9 }, 700);
        } else sfx.hit(!!m.heavy, m.x, m.y);
        return;
      }
      const ev = this.enemies.get(m.t);
      const e = this.room.state.enemies?.get(m.t);
      const ex = e ? this.predict.value(e, "x") : m.x;
      const ey = e ? this.predict.value(e, "y") : m.y;
      if (m.r === 4) {
        this.fx.text(ex, ey - 36, "Blocked", { color: "#c9d3dd", size: 9 }, 600);
        return;
      }
      const mine = m.a === me();
      if (mine) this.lastHitOn.set(m.t, performance.now());
      const predicted = mine && [...this.predictedHits.keys()].some((k) => k.endsWith(`:${m.t}`) && performance.now() - this.predictedHits.get(k)! < 500);
      if (!predicted) {
        const src = m.a ? this.room.state.players.get(m.a) : undefined;
        const ang = src ? Math.atan2(ey - src.y, ex - src.x) : -Math.PI / 2;
        this.impactFx(ex, ey - 14, ang, mine ? m.im ?? 0.1 : Math.min(0.25, m.im ?? 0.1), false, ev, mine);
        ev?.clock.hold(m.hs ?? 50);
      }
      const crit = m.c ?? 0;
      const style = crit === 2 ? { color: "#ff5a3c", size: 15, bold: true } : crit === 1 ? { color: "#ffb347", size: 12, bold: true } : { color: mine ? "#fff3d0" : "#d8d0c0", size: mine ? 10 : 8, bold: mine };
      const src2 = m.a ? this.room.state.players.get(m.a) : undefined;
      const dir = src2 ? Math.atan2(ey - src2.y, ex - src2.x) : Math.random() * Math.PI * 2;
      this.fx.number(ex, ey - 30 * (ev?.def.look.scale ?? 1), crit === 2 ? `${m.d}!` : String(m.d), style, dir, crit ? 1000 : 780);
      if (crit === 2) {
        this.fx.text(ex, ey - 52, "RIPOSTE", { color: "#ff8a5c", size: 10, bold: true }, 900);
        this.cameras.main.shake(120, 0.005);
      } else if (crit === 1) this.fx.text(ex, ey - 50, "Backstab", { color: "#ffcf8a", size: 8 }, 700);
    });

    this.room.onMessage("parry", (m: { p: string; e?: string; perfect: number; x: number; y: number }) => {
      if (m.p === me()) {
        const recent = [...this.predictedParry.entries()].some(([k, t]) => (!m.e || k.startsWith(`${m.e}:`)) && performance.now() - t < 600);
        if (!recent) this.parryFx(this.me?.value("x") ?? m.x, this.me?.value("y") ?? m.y, !!m.perfect, m.e ? this.enemies.get(m.e) : undefined);
        return;
      }
      this.fx.ring(m.x, m.y - 14, GOLD, 6, 26, 240, 2);
      this.fx.sparks(m.x, m.y - 16, -Math.PI / 2, GOLD, 10, 220, Math.PI * 2);
      sfx.parry(!!m.perfect, m.x, m.y);
    });

    this.room.onMessage("evade", (m: { p: string; x: number; y: number; glyph?: number }) => {
      if (m.p !== me()) return;
      this.fx.text(m.x, m.y - 40, m.glyph ? "Sheltered" : "Evaded", { color: "#9fe0ff", size: 9 }, 650, 24);
    });
    this.room.onMessage("practice", (m: { p: string; x: number; y: number }) => {
      if (m.p !== me()) return;
      this.fx.text(m.x, m.y - 40, "Hit — try again", { color: "#ff9a8a", size: 9 }, 800);
      this.hud.hurtVignette(0.35);
      sfx.hit(false);
    });
    this.room.onMessage("stagger", (m: { t: string; x: number; y: number }) => {
      const e = this.room.state.enemies?.get(m.t);
      const x = e ? this.predict.value(e, "x") : m.x;
      const y = e ? this.predict.value(e, "y") : m.y;
      const scale = this.enemies.get(m.t)?.def.look.scale ?? 1;
      for (let i = 0; i < 3; i++) this.fx.star(x + (i - 1) * 8, y - 44 * scale, GOLD, 6, 900 + i * 100);
      this.fx.text(x, y - 60 * scale, "STAGGERED", { color: "#ffe08a", size: 8, bold: true }, 700, 14);
    });
    this.room.onMessage("posture", (m: { x: number; y: number }) => {
      this.fx.text(m.x, m.y - 80, "POSTURE BROKEN", { color: "#fff1c0", size: 16, bold: true }, 1400, 20);
      this.fx.ring(m.x, m.y - 30, 0xffffff, 10, 90, 500, 5);
      this.hud.flash(0.25, 250);
      sfx.parry(true, m.x, m.y);
    });
    this.room.onMessage("guardbreak", (m: { x: number; y: number }) => {
      this.fx.text(m.x, m.y - 44, "GUARD BREAK", { color: "#ffcf8a", size: 11, bold: true }, 900);
      sfx.boom(false, m.x, m.y);
    });
    this.room.onMessage("death", (m: { t: string; x: number; y: number; boss: number }) => {
      const v = this.enemies.get(m.t);
      const color = v ? Phaser.Display.Color.HexStringToColor(v.def.look.cloth).color : 0xaaaaaa;
      this.fx.burst(m.x, m.y - 12, color, m.boss ? 60 : 16, m.boss ? 220 : 110, m.boss ? 4 : 2.6, m.boss ? 1400 : 700);
      this.fx.burst(m.x, m.y - 12, 0xfff1c0, m.boss ? 30 : 6, 90, 2, 900);
      sfx.death(m.x, m.y, !!m.boss);
      const myKill = performance.now() - (this.lastHitOn.get(m.t) ?? 0) < 800;
      this.lastHitOn.delete(m.t);
      if (myKill && !m.boss) {
        // The killing blow lands a little harder.
        sfx.kill(m.x, m.y);
        this.zoomKick = Math.max(this.zoomKick, 0.035);
        this.fx.ring(m.x, m.y - 14, 0xfff1c0, 6, 36, 320, 3);
        this.fx.dust(m.x, m.y, 8);
        v?.clock.hold(110);
        this.players.get(me())?.clock.hold(60);
      }
      if (m.boss) {
        music.duck(0.2, 1600);
        this.hud.title("Victory", v?.def.boss?.title ?? "");
        this.hud.flash(0.4, 600);
        this.cameras.main.shake(400, 0.008);
      }
    });
    this.room.onMessage("pdeath", (m: { p: string; x: number; y: number }) => {
      this.fx.burst(m.x, m.y - 12, 0xb8342c, 14, 90, 2.4, 900);
      if (m.p === me()) sfx.death(undefined, undefined, true);
    });
    this.room.onMessage("respawn", (m: { p: string }) => {
      if (m.p === me()) this.zone = undefined;
    });
    this.room.onMessage("impact", (m: { x: number; y: number }) => this.fx.burst(m.x, m.y, 0xc9e8ff, 6, 60, 2, 300));
    this.room.onMessage("fx", (m: { k: string; x: number; y: number; r?: number; x2?: number; y2?: number }) => {
      switch (m.k) {
        case "warcry":
          this.fx.ring(m.x, m.y - 10, 0xffc26b, 10, m.r ?? 90, 450, 5);
          sfx.roar(m.x, m.y);
          break;
        case "frost":
          this.fx.ring(m.x, m.y - 6, 0x9fe0ff, 10, m.r ?? 90, 500, 5);
          this.fx.burst(m.x, m.y - 6, 0xcff4ff, 26, 180, 2.2, 700);
          sfx.shoot("magic", m.x, m.y);
          break;
        case "howl":
          this.fx.ring(m.x, m.y - 14, 0xffd26b, 10, 120, 700, 3);
          sfx.howl(m.x, m.y);
          break;
        case "summon":
          this.fx.ring(m.x, m.y - 10, 0xff6a4a, 10, 110, 600, 4);
          sfx.roar(m.x, m.y);
          break;
        case "blink":
          this.fx.burst(m.x, m.y - 12, 0xa98bff, 14, 90, 2.2, 500);
          this.fx.burst(m.x2 ?? m.x, (m.y2 ?? m.y) - 12, 0xa98bff, 14, 90, 2.2, 500);
          break;
      }
    });
    this.room.onMessage("phase", (m: { t: string; phase: number; x: number; y: number }) => {
      const v = this.enemies.get(m.t);
      this.hud.title(v?.def.name ?? "", m.phase >= 2 ? "Final phase" : "The fight intensifies");
      this.cameras.main.shake(300, 0.006);
      sfx.roar(m.x, m.y);
    });
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers

  private attackTrail(v: PlayerView, s: PlayerSim, x: number, y: number) {
    const m = s.act === Act.Light || s.act === Act.Heavy || s.act === Act.Skill ? getMove(s.weapon, s.actMove) : undefined;
    const active = m && m.shape && s.actTick >= m.startup - 1 && s.actTick < m.startup + m.active + 1;
    if (!active) {
      v.lastTip = undefined;
      return;
    }
    const a = v.pose.wAngle;
    const reach = v.pose.wReach + (WEAPONS[s.weapon].key === "greatsword" ? 34 : WEAPONS[s.weapon].key === "spear" ? 40 : WEAPONS[s.weapon].key === "daggers" ? 14 : 22);
    const cx = x;
    const cy = y - 17 + v.pose.bob;
    if (v.lastTip) this.fx.trail(cx, cy, v.lastTip.a, a, reach * 0.62, reach + 2, weaponTrail(v.rig.weaponKind), 150);
    v.lastTip = { x: cx, y: cy, a };
  }

  private enemyTelegraph(id: string, e: Enemy, v: EnemyView, x: number, y: number, view: number) {
    if (e.act !== EAct.Attack) {
      v.lastTip = undefined;
      return;
    }
    const atk = v.def.attacks[e.atk];
    const wind = windupTicks(atk, e.flags) * TICK_MS;
    const t = view - e.actStart;
    const key = `${id}:${e.actStart}`;
    const scale = v.def.look.scale;
    // Glint ~0.3 s before impact: gold = parry it, red = dodge it.
    if (t >= wind - 300 && t < wind && !this.glinted.has(key) && atk.damage > 0 || (t >= wind - 300 && t < wind && !this.glinted.has(key) && v.def.behavior === "sparring")) {
      this.glinted.add(key);
      const tip = v.human ? v.human.tip(v.pose) : { x: 14, y: -14 };
      const gx = x + tip.x;
      const gy = y + tip.y - 4;
      this.fx.star(gx, gy, atk.parryable ? GOLD : RED, 12 * Math.min(1.6, scale), 340);
      this.fx.ring(gx, gy, atk.parryable ? GOLD : RED, 2, 12, 240, 2);
      sfx.glint(atk.parryable, x, y);
    }
    // Weapon trail during the enemy's active frames.
    if (v.human && t >= wind && t < wind + atk.active * TICK_MS + 20 && atk.shape) {
      const a = v.pose.wAngle;
      const cx = x;
      const cy = y - 17 * scale + v.pose.bob * scale;
      const reach = (v.pose.wReach + 24) * scale;
      if (v.lastTip) this.fx.trail(cx, cy, v.lastTip.a, a, reach * 0.6, reach, atk.parryable ? 0xffe6b0 : 0xff8a70, 140);
      v.lastTip = { x: cx, y: cy, a };
    } else v.lastTip = undefined;
  }

  private drawWorldFx(view: number) {
    const g = this.fx.ground;
    g.clear();
    const state = this.room.state;
    // Ground telegraphs for area attacks.
    state.enemies?.forEach((e, id) => {
      if (e.act !== EAct.Attack) return;
      const v = this.enemies.get(id);
      if (!v) return;
      const atk = v.def.attacks[e.atk];
      if (!atk.ground || !atk.shape || atk.special === "sigils") return;
      const wind = windupTicks(atk, e.flags) * TICK_MS;
      const t = view - e.actStart;
      if (t < 0 || t > wind + atk.active * TICK_MS + 80) return;
      const k = Math.min(1, t / wind);
      const ox = atk.targeted ? e.ax : this.predict.value(e, "x");
      const oy = atk.targeted ? e.ay : this.predict.value(e, "y");
      const firing = t >= wind;
      this.drawShape(g, atk.shape, ox, oy, aimToRad(e.aim), firing ? 0xffd0c0 : 0xd8402c, firing ? 0.55 : 0.1 + 0.22 * k, k);
    });
    // Hazards (sigils, meteors, glyphs, judgement).
    let judgement = false;
    state.hazards?.forEach((h: Hazard) => {
      const t = view - h.born;
      const k = Math.min(1, t / Math.max(1, h.delay));
      switch (h.kind) {
        case HazardKind.Glyph: {
          const pulse = 0.5 + Math.sin(performance.now() / 120) * 0.2;
          g.fillStyle(0xffe08a, 0.2 * pulse + 0.1);
          g.fillEllipse(h.x, h.y, h.radius * 2, h.radius * 1.6);
          g.lineStyle(3, 0xffe08a, 0.9);
          g.strokeEllipse(h.x, h.y, h.radius * 2, h.radius * 1.6);
          judgement = true;
          break;
        }
        case HazardKind.Judgement:
          if (t >= 0 && t < 400) {
            this.hud.flash(0.5, 500);
            this.cameras.main.shake(400, 0.01);
          }
          break;
        default: {
          if (t > h.delay + 250) return;
          const color = h.kind === HazardKind.Meteor ? 0xffa040 : h.kind === HazardKind.Sigil ? 0xc070ff : 0xd8402c;
          g.fillStyle(color, 0.08 + 0.2 * k);
          g.fillEllipse(h.x, h.y, h.radius * 2, h.radius * 1.6);
          g.fillStyle(color, 0.35);
          g.fillEllipse(h.x, h.y, h.radius * 2 * k, h.radius * 1.6 * k);
          g.lineStyle(2, color, 0.8);
          g.strokeEllipse(h.x, h.y, h.radius * 2, h.radius * 1.6);
          if (t >= h.delay && t < h.delay + 40) {
            this.fx.burst(h.x, h.y - 6, color, 24, 160, 3, 600);
            sfx.boom(h.kind === HazardKind.Meteor, h.x, h.y);
            if (h.kind === HazardKind.Meteor) this.cameras.main.shake(160, 0.005);
          }
        }
      }
    });
    this.hud.judgement(judgement);

    // Projectiles: computed from launch parameters, no per-frame sync.
    const now = this.room.clock.serverNow();
    state.projectiles?.forEach((pr: Projectile) => {
      const t = ((pr.owner === this.room.sessionId ? now : view) - pr.born) / 1000;
      if (t < 0) return;
      const d = pr.speed * t;
      if (d > pr.range) return;
      const x = pr.x0 + Math.cos(pr.angle) * d;
      const y = pr.y0 + Math.sin(pr.angle) * d;
      const tx = x - Math.cos(pr.angle) * Math.min(d, 18);
      const ty = y - Math.sin(pr.angle) * Math.min(d, 18);
      switch (pr.kind) {
        case ProjKind.Arrow:
          this.fx.streak(tx, ty, x, y, 0xe9e4d6, 60, 2);
          break;
        case ProjKind.Knife:
          this.fx.streak(tx, ty, x, y, 0xdfe5ea, 50, 3);
          break;
        case ProjKind.ShadowBolt:
          this.fx.streak(tx, ty, x, y, 0x7a4ad1, 90, 9);
          this.fx.burst(x, y, 0xc9a8ff, 1, 10, 3, 200);
          break;
        case ProjKind.Blade:
          this.fx.star(x, y, 0xffd98a, 9, 40);
          break;
        case ProjKind.Reflected:
          this.fx.streak(tx, ty, x, y, GOLD, 80, 7);
          break;
        default:
          this.fx.streak(tx, ty, x, y, 0x8fd3ff, 90, 8);
          this.fx.burst(x, y, 0xe8f7ff, 1, 10, 2.4, 160);
      }
    });
  }

  private drawShape(g: Phaser.GameObjects.Graphics, shape: NonNullable<(typeof ENEMIES)[number]["attacks"][number]["shape"]>, x: number, y: number, rad: number, color: number, alpha: number, k: number) {
    g.fillStyle(color, alpha);
    g.lineStyle(2, color, Math.min(1, alpha + 0.4));
    if (shape.kind === "circle") {
      const cx = x + Math.cos(rad) * shape.offset;
      const cy = y + Math.sin(rad) * shape.offset;
      g.fillEllipse(cx, cy, shape.radius * 2, shape.radius * 1.6);
      g.strokeEllipse(cx, cy, shape.radius * 2, shape.radius * 1.6);
      g.fillStyle(color, alpha * 0.8);
      g.fillEllipse(cx, cy, shape.radius * 2 * k, shape.radius * 1.6 * k);
    } else if (shape.kind === "arc") {
      g.beginPath();
      g.moveTo(x, y);
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const a = rad - shape.arc / 2 + (shape.arc * i) / steps;
        g.lineTo(x + Math.cos(a) * shape.range, y + Math.sin(a) * shape.range * 0.8);
      }
      g.closePath();
      g.fillPath();
      g.strokePath();
    } else {
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const w = shape.width / 2;
      const L = shape.length;
      g.beginPath();
      g.moveTo(x - s * w, y + c * w * 0.8);
      g.lineTo(x + c * L - s * w, y + (s * L + c * w) * 0.8);
      g.lineTo(x + c * L + s * w, y + (s * L - c * w) * 0.8);
      g.lineTo(x + s * w, y - c * w * 0.8);
      g.closePath();
      g.fillPath();
      g.strokePath();
    }
  }

  private drawBars() {
    const g = this.bars;
    g.clear();
    this.room.state.enemies?.forEach((e, id) => {
      const v = this.enemies.get(id);
      if (!v || e.act === EAct.Dead || v.def.boss || v.def.behavior === "dummy") return;
      if (e.hp >= e.hpMax && !(e.flags & EFlag.Elite)) return;
      if (e.flags & EFlag.Hidden) return;
      const x = this.predict.value(e, "x");
      const y = this.predict.value(e, "y") - 38 * v.def.look.scale;
      const w = e.flags & EFlag.Elite ? 34 : 24;
      g.fillStyle(0x000000, 0.65);
      g.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
      g.fillStyle(e.flags & EFlag.Riposte ? 0xffd76a : 0xd8453c, 1);
      g.fillRect(x - w / 2, y, (w * e.hp) / e.hpMax, 3);
      if (e.flags & EFlag.Elite) {
        g.lineStyle(1, 0xe8c55a, 1);
        g.strokeRect(x - w / 2 - 1, y - 1, w + 2, 5);
      }
    });
    this.room.state.players.forEach((p, sid) => {
      if (sid === this.room.sessionId || p.hp >= p.hpMax || p.act === Act.Dead) return;
      const x = this.predict.value(p, "x");
      const y = this.predict.value(p, "y") - 44;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(x - 13, y - 1, 26, 4);
      g.fillStyle(0x6fd05a, 1);
      g.fillRect(x - 12, y, (24 * p.hp) / p.hpMax, 2);
    });
  }

  private updateCamera(delta: number) {
    const cam = this.cameras.main;
    this.zoomKick *= Math.pow(0.001, delta / 1000);
    const want = this.fitZoom * settings.value.zoom;
    this.zoomNow += (want - this.zoomNow) * (1 - Math.pow(0.0005, delta / 1000));
    cam.setZoom(this.zoomNow * (1 + this.zoomKick));
    if (!this.me) return;
    const s = this.me.state;
    const a = aimToRad(s.aim);
    const moving = s.gait > 0;
    const fighting = s.act !== Act.None;
    const reach = fighting ? 26 : moving ? 34 : 18;
    const dir = moving && !fighting ? (s.dir * Math.PI) / 4 : a;
    const k = 1 - Math.pow(0.02, delta / 1000);
    this.lookAhead.x += (Math.cos(dir) * reach - this.lookAhead.x) * k;
    this.lookAhead.y += (Math.sin(dir) * reach * 0.7 - this.lookAhead.y) * k;
    const pu = this.punch;
    const dt = Math.min(0.05, delta / 1000);
    pu.vx += (-pu.x * 260 - pu.vx * 19) * dt;
    pu.vy += (-pu.y * 260 - pu.vy * 19) * dt;
    pu.x += pu.vx * dt;
    pu.y += pu.vy * dt;
    cam.setFollowOffset(-this.lookAhead.x - pu.x, -this.lookAhead.y + 12 - pu.y);
  }

  private updateHud() {
    const state = this.room.state;
    this.hud.online(state.players.size);
    this.hud.ping(this.room.clock.smoothedRtt());
    const p = this.myPlayer;
    if (!this.me || !p) return;
    const s = this.me.state;
    this.hud.vitals(p.hp, p.hpMax, s.stamina, s.staminaMax, s.exhausted, p.level);
    const w = WEAPONS[s.weapon];
    this.hud.weapon(w.name);
    this.hud.skills([w.skills[0].name, w.skills[1].name], [s.cd1, s.cd2], [w.skills[0].cooldown ?? 1, w.skills[1].cooldown ?? 1], [(s.mods & 4) !== 0, (s.mods & 8) !== 0]);
    this.hud.potions(s.potions);
    const frac = p.hpMax ? p.hp / p.hpMax : 1;
    if (s.act !== Act.Dead && p.hp > 0 && frac < 0.3 && performance.now() > this.heartAt) {
      const k = 1 - frac / 0.3;
      sfx.heartbeat(0.5 + k * 0.5);
      this.hud.hurtVignette(0.16 + k * 0.22);
      this.heartAt = performance.now() + 1150 - k * 350;
    }
    if (s.act === Act.Dead) {
      if (!this.deadSince) this.deadSince = performance.now();
      const left = Math.max(0, Math.ceil((9000 - (performance.now() - this.deadSince)) / 1000));
      this.hud.dead(true, this.myPlayer?.party ? `An ally can revive you (${keyLabel(settings.value.bindings.interact[0])}). Returning in ${left}s…` : `Returning to safety in ${left}s…`);
    } else {
      this.deadSince = 0;
      this.hud.dead(false);
    }
    const zone = this.map.zoneAt(s.x, s.y);
    if (zone && zone !== this.zone) {
      this.zone = zone;
      this.hud.zone(zone);
      const mood = zone.music ?? (this.kind === "dungeon" ? "dungeon" : "fields");
      if (!this.room.state.bossActive) music.play(mood);
      ambience.play(mood === "miniboss" || mood === "boss" ? (this.kind === "dungeon" ? "dungeon" : "forest") : mood);
      sfx.setRoom(this.kind === "dungeon" || zone.dark ? "cave" : zone.safe ? "town" : "open");
    }
    // Boss bar for the nearest engaged boss.
    let boss: Enemy | undefined;
    let bossName = "";
    state.enemies?.forEach((e) => {
      const def = ENEMIES[e.def];
      if (!def.boss || e.act === EAct.Dead || !(e.flags & EFlag.Aggro)) return;
      if (Math.hypot(e.x - s.x, e.y - s.y) > 700) return;
      boss = e;
      bossName = def.boss.title;
    });
    if (boss) {
      const b = boss as Enemy;
      if (!this.bossSeen.has(bossName)) {
        this.bossSeen.add(bossName);
        this.hud.title(bossName, ENEMIES[b.def].key === "aurelion" ? "Floor Boss" : "Miniboss");
        sfx.roar(b.x, b.y);
      }
      this.hud.boss(true, bossName, b.hp, b.hpMax, b.posture);
    } else this.hud.boss(false);
  }

  private pruneMaps() {
    const now = performance.now();
    if (this.predictedHits.size > 200) for (const [k, t] of this.predictedHits) if (now - t > 2000) this.predictedHits.delete(k);
    if (this.predictedParry.size > 100) for (const [k, t] of this.predictedParry) if (now - t > 2000) this.predictedParry.delete(k);
    if (this.glinted.size > 300) this.glinted.clear();
  }

  /** Test/debug surface. */
  get debug() {
    return { room: this.room, me: this.me, server: this.myPlayer, controls: this.controls, players: this.players, enemies: this.enemies, terrain: this.terrain, settings };
  }
}

void radToAim;
