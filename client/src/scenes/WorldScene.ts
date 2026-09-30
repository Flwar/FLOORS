import * as Phaser from "phaser";
import { Callbacks, Predict, type InputHandle, type Reconciler, type Room } from "@colyseus/sdk";
import {
  AFFIXES, Act, aimToRad, applyGates, EMOTES, isEmote, type Emote, floorOfRoom, roomLabel, TOWER, EAct, EFlag, ENEMIES, getMove, HazardKind, impactMs, INTERP_DELAY,
  isActiveTick, itemBase, keyLabel, Mod, NO_SKILL, parryDef, PLAYER_RADIUS, skillById, skillEntry, skillMove, streetPoint, ProjKind, radToAim, RARITY_COLORS, shapeHits, stepPlayer, Tile, TICK_MS, TILE, TIMING_TOLERANCE_MS,
  WEAPONS, windupTicks, type Bindings, type Body, type GateDef, type PlayerCommand, type PlayerSim, type WorldMap, type Zone, drinkById, RARITY_NAMES, HUNT_BONUS, HUNT_TITLES, dayPhase, sunAt, clockLabel, isWorldRoom, type SunState } from "@floors/shared";
import type { Enemy, Hazard, Player, Projectile, WorldState } from "../../../server/src/state.ts";
import { ambience } from "../audio/ambience.ts";
import { Minimap } from "../ui/minimap.ts";
import { music } from "../audio/music.ts";
import { sfx, type Material, type Surface } from "../audio/sfx.ts";
import { Hud } from "../hud.ts";
import { Controls } from "../input.ts";
import type { RoomKind, Session } from "../net.ts";
import { setWorldCursor, type CursorKind } from "../ui/cursor.ts";
import { weaponTrail } from "../art/characters.ts";
import { skillIcon } from "../ui/skillIcons.ts";
import { SkillFx } from "../render/skillFx.ts";
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
import { SUN } from "../render/sunlight.ts";
import { mapFloor, QuestMarkers, questTarget, trackedQuests } from "../render/objective.ts";
import { floorOpenedOverlay, floorSealedOverlay } from "../ui/celebrate.ts";
import { Ambient } from "../render/ambient.ts";
import { Tutorial } from "../ui/tutorial.ts";
import { drawParchmentMap } from "../render/mapArt.ts";
import { mapClickToWorld, type AdminOverview } from "../ui/admin.ts";
import { WorldObjects, type Interactable } from "../render/objects.ts";
import { Sky } from "../render/sky.ts";
import { Terrain } from "../render/terrain.ts";
import { goldIcon, itemIcon } from "../ui/icons.ts";
import type { DialogMsg, GameUI, InvView } from "../ui/ui.ts";

const PREDICTED = ["x", "y", "dir", "gait", "aim", "stamina", "staminaMax", "staminaDelay", "exhausted", "act", "actTick", "actMove", "actAim", "actSeq", "combo", "comboTimer", "buf", "bufAim", "bufAge", "dodgeDx", "dodgeDy", "kbx", "kby", "hurtDur", "weapon", "mods", "parryOk", "cd1", "cd2", "sk1", "sk2", "potions"] as const;
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
  private markers!: QuestMarkers;
  private whereAt = 0;
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
  private skillFx!: SkillFx;
  /** Last skill (actSeq) whose release effect played, per player. */
  private skillSeen = new Map<string, number>();
  /** Iron Skin shimmer: until when, per player. */
  private ironUntil = new Map<string, number>();
  private bloodUntil = new Map<string, number>();
  private heartAt = 0;
  private bossSeen = new Set<string>();
  /** Zoom that fits the screen height; the player's zoom setting multiplies it. */
  private fitZoom = 2;
  private zoomNow = 2;
  private zoomKick = 0;
  private session!: Session;
  private ui!: GameUI;
  private kind: RoomKind = "world";
  /** The server's clock minus ours, so everyone's sky agrees. */
  private clockOffset = 0;
  /** The light over the map this frame (undefined underground and indoors). */
  private sunNow?: SunState;
  private objects!: WorldObjects;
  private ambient!: Ambient;
  private tutorial?: Tutorial;
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
    const floor = floorOfRoom(this.kind) ?? TOWER[0];
    const inDungeon = floor.dungeon === this.kind;
    this.map = inDungeon ? floor.buildDungeon() : floor.build();
    this.sky = new Sky(this, inDungeon ? floor.dungeonSky : floor.sky);
    this.terrain = new Terrain(this, this.map);
    // Worlds have a sky, and the sun casts shadows there; dungeons don't.
    this.terrain.sunlit = isWorldRoom(this.kind);
    this.objects = new WorldObjects(this, this.map);
    this.ambient = new Ambient(this, this.map);
    if (this.kind === "world") this.tutorial = new Tutorial(this, this.map, this.room, this.session.name ?? this.session.guest ?? "you");
    this.lighting = new Lighting(this);
    this.fx = new Fx(this);
    this.skillFx = new SkillFx(this.fx, this);
    this.hud.onEmptySkillSlot = () => this.ui.toggle("skills", true);
    this.hud.potionIcon(itemIcon("tonic", 0));
    this.bars = this.add.graphics().setDepth(1e6 - 1);
    this.markers = new QuestMarkers(this);
    this.ui.npcName = (id) => this.map.npcs.find((n) => n.id === id)?.name;
    this.ui.currentFloor = () => mapFloor(this.map) || undefined;
    this.controls = new Controls(this);
    this.ui.onBlockChange = (b) => (this.controls.blocked = b);
    this.ui.onCapture = (on) => (this.controls.capturing = on);
    this.ui.mapRender = (c) => this.drawMap(c);
    this.ui.mapAccess = () => this.mapAccess();
    this.ui.adminMap = this.map;
    this.ui.adminKind = this.kind;
    this.ui.onMapTeleport = (c, ev) => {
      this.room.send("admin:tp", mapClickToWorld(c, this.map, ev));
      this.ui.toggle("map", false);
    };

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
      this.objects.gates = mask as number;
      const m = this.map as WorldMap & { gates?: GateDef[] };
      if (!m.gates) return;
      applyGates(m as WorldMap & { gates: GateDef[] }, mask as number);
      for (const g of m.gates) for (const [x, y] of g.tiles) this.terrain.invalidate(x, y);
    });
    this.bindEvents();
    this.bindUi();
    this.session.replayEarly(this.room);

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
      if (e.repeat || this.controls.capturing) return;
      const b = settings.value.bindings;
      const interact = b.interact.includes(e.code);
      const sit = b.sit.includes(e.code);
      if (!interact && !sit) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (interact) this.interact();
      else if (!this.ui.blocking) this.room.send("sit", {});
    };
    window.addEventListener("keydown", onKey);
    this.events.once("shutdown", () => {
      this.objects.destroy();
      this.ambient.destroy();
      this.tutorial?.destroy();
      this.controls.destroy();
      this.scale.off("resize", fit);
      window.removeEventListener("keydown", onKey);
      offSettings();
    });
    document.getElementById("respawn-now")!.onclick = () => this.room.send("respawnNow");
    music.play(inDungeon ? floor.dungeonMusic : floor.music);
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
    this.followTarget = view.rig.root;
    this.cameras.main.startFollow(view.rig.root, false, 0.16, 0.16);
  }

  private followTarget?: Phaser.GameObjects.GameObject;
  private restFxAt = 0;

  /** Resting (sitting while hurt, out of a fight): soft green motes show it's working. */
  private restFx(now: number) {
    const p = this.myPlayer;
    const s = this.me?.state;
    if (!p || !s || !p.sit || p.hp >= p.hpMax || s.gait !== 0 || now < this.restFxAt) return;
    this.restFxAt = now + 650;
    this.fx.rise(s.x, s.y - (p.sit === 2 ? 14 : 4), 0x8fe38a, 3, 12, 30, 1100, 2);
  }

  /**
   * A floor opened for the whole server. Everyone gets the golden title; on Floor 1 the
   * camera sweeps to the Ascent Gate as it bursts open (unless you're in a fight).
   */
  private celebrateFloor(m: { floor: number; by: string[]; boss?: string; admin?: boolean }) {
    floorOpenedOverlay(m);
    this.hud.flash(0.9, 1800);
    this.cameras.main.shake(700, 0.01);
    sfx.boom(true);
    this.time.delayedCall(250, () => sfx.fanfare());
    this.time.delayedCall(1500, () => sfx.chime(4));
    this.ui.toast(`Floor ${m.floor} is open to everyone!`, "good");
    const me = this.me?.state;
    const gate = this.map.objects.find((o) => o.id === "ascent-gate");
    if (!me) return;
    if (!gate) {
      // Elsewhere: golden light rains down around you.
      for (let i = 0; i < 10; i++) this.time.delayedCall(i * 180, () => this.fx.rise(me.x + (Math.random() - 0.5) * 200, me.y, 0xffe08a, 10, 60, 60, 1400, 2.4));
      this.fx.ring(me.x, me.y - 10, 0xffd46b, 10, 160, 900, 5);
      return;
    }
    let fighting = false;
    this.room.state.enemies?.forEach((e: { x: number; y: number; act: number }) => {
      if (e.act !== EAct.Dead && Math.hypot(e.x - me.x, e.y - me.y) < 450) fighting = true;
    });
    const cam = this.cameras.main;
    if (fighting) {
      this.gateEruption(gate.x, gate.y);
      return;
    }
    cam.stopFollow();
    cam.pan(gate.x, gate.y - 60, 1100, "Sine.easeInOut");
    this.time.delayedCall(1050, () => this.gateEruption(gate.x, gate.y));
    this.time.delayedCall(5200, () => {
      const now = this.me?.state;
      if (!now) return;
      cam.pan(now.x, now.y, 900, "Sine.easeInOut", false, (_c, p) => {
        if (p === 1 && this.followTarget) cam.startFollow(this.followTarget, false, 0.16, 0.16);
      });
    });
  }

  /** The Ascent Gate bursts open: bolts from the sky, a pillar of light, shockwaves, sparks. */
  private gateEruption(x: number, y: number) {
    const fx = this.fx;
    const top = y - 90;
    const pillar = this.add.image(x, y + 12, "lootBeam").setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe08a).setDepth(y + 60).setScale(0.2, 0.6).setAlpha(0);
    this.tweens.add({ targets: pillar, scaleX: 4.2, scaleY: 7.5, alpha: 1, duration: 650, ease: "Back.easeOut" });
    this.tweens.add({ targets: pillar, alpha: 0.6, duration: 700, delay: 700, yoyo: true, repeat: 1 });
    this.tweens.add({ targets: pillar, alpha: 0, scaleX: 0.8, duration: 1500, delay: 3300, onComplete: () => pillar.destroy() });
    for (let i = 0; i < 7; i++) {
      this.time.delayedCall(i * 130, () => {
        fx.bolt(x + (Math.random() - 0.5) * 200, y - 560, x + (Math.random() - 0.5) * 40, top, 0xffe7a0, 280, 7, 24);
        fx.bolt(x + (Math.random() - 0.5) * 120, y - 560, x, top + 20, 0xffffff, 200, 3, 26);
      });
    }
    for (let i = 0; i < 5; i++) this.time.delayedCall(150 + i * 240, () => fx.ring(x, y - 10, i % 2 ? 0xffffff : 0xffd46b, 20, 200 + i * 70, 1000, 6));
    fx.burst(x, top, 0xfff0b8, 70, 340, 3, 1300);
    fx.burst(x, y - 20, 0xffc94a, 44, 230, 2.6, 1100);
    for (let i = 0; i < 12; i++) this.time.delayedCall(i * 220, () => fx.rise(x + (Math.random() - 0.5) * 140, y + 4, 0xffe08a, 14, 50, 80, 1500, 2.6));
    fx.dust(x, y + 16, 18);
    this.cameras.main.shake(1000, 0.014);
    this.hud.flash(0.6, 900);
    sfx.boom(true, x, y);
  }

  /** An admin sealed a floor: the gate slams shut. */
  private sealFloorFx(m: { floor: number; by: string }) {
    floorSealedOverlay(m);
    this.hud.flash(0.5, 1200);
    this.cameras.main.shake(500, 0.01);
    sfx.seal();
    this.ui.toast(`Floor ${m.floor} has been sealed.`, "error");
    const gate = this.map.objects.find((o) => o.id === "ascent-gate");
    if (gate) {
      this.fx.ring(gate.x, gate.y - 10, 0xc0402c, 20, 220, 900, 6);
      this.fx.dust(gate.x, gate.y + 16, 20);
      this.fx.burst(gate.x, gate.y - 40, 0x5a4a44, 30, 160, 2.6, 900);
    }
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
      if (s.act === Act.Skill) {
        const m = getMove(s.weapon, s.actMove);
        const a = aimToRad(s.actAim);
        if (s.actTick < m.startup) this.skillFx.charge(m, x, y, s.actTick / Math.max(1, m.startup));
        else {
          if (this.skillSeen.get(sid) !== s.actSeq) {
            this.skillSeen.set(sid, s.actSeq);
            this.skillFx.fire(m, x, y, a, sid === this.room.sessionId, (ms, amt) => this.cameras.main.shake(ms, amt));
          }
          if (s.actTick < m.startup + m.active) this.skillFx.during(m, x, y, a);
        }
      }
      const iron = this.ironUntil.get(sid);
      if (iron && performance.now() < iron && Math.random() < delta / 240) this.fx.ring(x, y - 16, 0xc9d3dd, 14, 24, 380, 2);
      const blood = this.bloodUntil.get(sid);
      if (blood && performance.now() < blood && Math.random() < delta / 120) this.fx.rise(x + (Math.random() - 0.5) * 18, y - 6, 0xff5a4a, 1, 6, 24, 600, 2.4);
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
      if (e.flags & EFlag.Poisoned && Math.random() < delta / 180) this.fx.rise(x + (Math.random() - 0.5) * 12, y - 18, 0x8fe06a, 1, 6, 16, 700, 2.2);
      if (e.flags & EFlag.Burning && Math.random() < delta / 70) {
        const s = v.def.look.scale;
        this.fx.rise(x + (Math.random() - 0.5) * 16 * s, y - 10 - Math.random() * 20 * s, Math.random() < 0.5 ? 0xff7a2a : 0xffc04a, 1, 4, 34, 520, 2.6);
      }
      if (e.flags & EFlag.Chilled && Math.random() < delta / 110) {
        const s = v.def.look.scale;
        this.fx.rise(x + (Math.random() - 0.5) * 18 * s, y - 6 - Math.random() * 22 * s, Math.random() < 0.5 ? 0xdff4ff : 0x8fd3ff, 1, 3, 10, 700, 2.4);
      }
      if (e.affix && e.act !== EAct.Dead && Math.random() < delta / 140) {
        // An elite's affix shows as a faint aura in its colour.
        const s = v.def.look.scale;
        const col = Phaser.Display.Color.HexStringToColor(AFFIXES[e.affix]?.color ?? "#ffffff").color;
        const a = Math.random() * Math.PI * 2;
        this.fx.rise(x + Math.cos(a) * 14 * s, y - 4 + Math.sin(a) * 6 * s, col, 1, 3, 26, 700, 2.4);
      }
      if (e.flags & EFlag.Sundered && Math.random() < delta / 130) {
        const s = v.def.look.scale;
        this.fx.sparks(x + (Math.random() - 0.5) * 16 * s, y - 14 * s, -Math.PI / 2, Math.random() < 0.5 ? 0xffd070 : 0xff9a3a, 1, 90, 1.2);
      }
      if (e.flags & EFlag.Soaked && Math.random() < delta / 110) {
        const s = v.def.look.scale;
        this.fx.rise(x + (Math.random() - 0.5) * 16 * s, y - 20 * s - Math.random() * 10, 0x8ff0e0, 1, 2, -18, 600, 2.2);
      }
      if (e.flags & EFlag.Dazzled && Math.random() < delta / 150) {
        // Dazzled: glints of sunlight flicker around its head.
        const s = v.def.look.scale;
        this.fx.star(x + (Math.random() - 0.5) * 20 * s, y - 26 * s - Math.random() * 10, Math.random() < 0.5 ? 0xffffff : 0xffe08a, 4, 240);
      }
      if (e.flags & EFlag.Shielded && e.act !== EAct.Dead && Math.random() < delta / 240) {
        const s = v.def.look.scale;
        this.fx.ring(x, y - 12 * s, 0xbfe8ff, 16 * s, 19 * s, 420, 2);
      }
      if (e.flags & EFlag.Cursed && Math.random() < delta / 120) {
        const s = v.def.look.scale;
        this.fx.rise(x + (Math.random() - 0.5) * 18 * s, y - 8 - Math.random() * 24 * s, Math.random() < 0.6 ? 0x2a1a44 : 0xb77af2, 1, 4, 22, 800, 2.8);
      }
      // Dragons breathe: fire, a blast of cold (frost dragons), or the dark itself (void dragons).
      if (v.fire) {
        const f = v.fire;
        const s = v.def.look.scale;
        const frost = v.def.look.element === "frost";
        const dark = v.def.look.element === "shadow";
        const sea = v.def.look.element === "tide";
        const steam = v.def.look.element === "steam";
        const sunny = v.def.look.element === "sun";
        const palette = frost ? [0xffffff, 0xbfe6ff, 0x6fb8ff] : dark ? [0xe0c8ff, 0x7a4ad1, 0x1a1028] : sea ? [0xffffff, 0x8ff0e0, 0x1fa8c0] : steam ? [0xffffff, 0xe8e0d0, 0xb8b0a8] : sunny ? [0xffffff, 0xfff0a0, 0xffb030] : [0xffe08a, 0xff7a2a, 0xd8402c];
        for (let i = 0; i < Math.ceil(delta / 12); i++) {
          const spread = (Math.random() - 0.5) * 0.9;
          this.fx.sparks(f.x, f.y, f.a + spread, Math.random() < 0.4 ? palette[0] : Math.random() < 0.5 ? palette[1] : palette[2], 2, 180 + 120 * s, 0.25);
        }
        if (Math.random() < delta / 40) this.fx.burst(f.x + Math.cos(f.a) * 30 * s, f.y + Math.sin(f.a) * 30 * s, frost ? 0xdff4ff : dark ? 0x2a1a44 : sea ? 0xdffaf4 : steam ? 0xf0f0f0 : sunny ? 0xfff8e0 : 0xff9a3a, 4, 50, 3.4, 420);
        if (Math.random() < delta / 200) sfx.boom(false, f.x, f.y);
      }
      this.enemyTelegraph(id, e, v, x, y, view);
    });

    this.localCombat(view);
    this.drawWorldFx(view);
    this.drawBars();
    this.fx.update(delta);
    if (this.me) {
      const px0 = this.me.value("x");
      const py0 = this.me.value("y");
      if (Math.hypot(cam.midPoint.x - px0, cam.midPoint.y - py0) > 480) {
        cam.centerOn(px0, py0);
        cam.fadeIn(260, 0, 0, 0);
      }
    }
    this.updateSun();
    this.terrain.update(cam);
    const occluded: { x: number; y: number }[] = [];
    state.players.forEach((p) => occluded.push({ x: this.predict.value(p, "x"), y: this.predict.value(p, "y") - 10 }));
    this.terrain.fadeOccluders(occluded, delta);
    this.sky.update(cam, delta);
    this.updateMinimap();
    this.objects.merchantActive = state.event === "merchant";
    this.objects.syncDrops(state.drops, this.ui.inv?.key);
    const mx = this.me?.value("x") ?? 0;
    const my = this.me?.value("y") ?? 0;
    this.objects.update(delta, this.ui.inv, state.stage, mx, my);
    const people: { x: number; y: number }[] = [];
    state.players.forEach((pl) => people.push({ x: pl.x, y: pl.y }));
    if (this.me) people.push({ x: mx, y: my });
    this.ambient.update(delta, view, cam, people, this.zone?.id);
    const tinv = this.ui.inv;
    if (tinv) this.tutorial?.decide(tinv);
    this.tutorial?.update(delta, this.me && tinv ? { me: { x: mx, y: my, s: this.me.state }, quests: tinv.quests, skills: tinv.skills ?? [] } : undefined);
    this.updatePrompt(mx, my);
    this.updateCursor();
    this.restFx(performance.now());
    const alive = this.me && this.me.state.act !== Act.Dead;
    this.updateQuestMarkers(delta, mx, my, !!alive, cam);
    this.updateLighting(delta);
    this.updateCamera(delta);
    this.updateHud();
    this.prevView = view;
    this.pruneMaps();
  }

  // ---------------------------------------------------------------------------
  // Interaction (F)

  private cursorAt = 0;

  /** The cursor over the world tells you what's under it: an enemy, a person, something to use or loot. */
  private updateCursor() {
    const now = performance.now();
    if (now < this.cursorAt) return;
    this.cursorAt = now + 70;
    const canvas = this.game.canvas;
    const p = this.input.activePointer;
    if (!this.me || !p) return;
    if (this.me.state.act === Act.Dead) return setWorldCursor(canvas, "dead");
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const state = this.room.state;
    let kind: CursorKind = "aim";
    state.enemies?.forEach((e, id) => {
      if (kind !== "aim" || e.act === EAct.Dead) return;
      const v = this.enemies.get(id);
      if (!v || v.def.behavior === "dummy") return;
      const s = v.def.look.scale;
      if (Math.hypot(w.x - this.predict.value(e, "x"), w.y - (this.predict.value(e, "y") - 16 * s)) < v.def.radius + 12 * s) kind = "attack";
    });
    if (kind === "aim") {
      const near = this.objects.interactables(w.x, w.y, state.drops, this.ui.inv?.key)[0];
      if (near) kind = near.kind === "npc" ? "talk" : near.kind === "drop" ? "loot" : "use";
    }
    if (kind === "aim") {
      state.players.forEach((pl, sid) => {
        if (kind === "aim" && sid !== this.room.sessionId && Math.hypot(w.x - pl.x, w.y - (pl.y - 16)) < 20) kind = pl.act === Act.Dead ? "use" : "inspect";
      });
    }
    setWorldCursor(canvas, kind);
  }

  private updatePrompt(x: number, y: number) {
    const list = this.objects.interactables(x, y, this.room.state.drops, this.ui.inv?.key, !!this.myPlayer?.sit);
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

  /** Arrows and pins for every tracked quest, and live directions for the quest panel. */
  private updateQuestMarkers(delta: number, mx: number, my: number, alive: boolean, cam: Phaser.Cameras.Scene2D.Camera) {
    const inv = this.ui.inv;
    const list = inv ? trackedQuests(inv, mapFloor(this.map) || undefined) : [];
    const targets = list.map((t) => (inv ? questTarget(this.map, inv, t, mx, my) : undefined));
    this.markers.update(
      delta, mx, my,
      alive ? targets.map((tg, i) => (tg ? { x: tg.x, y: tg.y, main: list[i].quest.main === true, person: tg.person } : undefined)) : [],
      cam.worldView,
    );
    if (performance.now() < this.whereAt) return;
    this.whereAt = performance.now() + 200;
    this.ui.setTrackerWhere(
      list.map((t, i) => {
        const tg = targets[i];
        if (!tg) return { id: t.quest.id };
        const d = Math.hypot(tg.x - mx, tg.y - my);
        return { id: t.quest.id, angle: Math.atan2(tg.y - my, tg.x - mx), dist: Math.max(1, Math.round(d / TILE)), area: tg.area, here: d < 150 && !tg.door };
      }),
    );
  }

  private applyKeyLabels(b: Bindings) {
    const set = (id: string, code: string | undefined) => {
      const k = document.querySelector(`#${id} .key`);
      if (k) k.textContent = keyLabel(code);
    };
    set("slot-skill1", b.skill1[0]);
    set("slot-skill2", b.skill2[0]);
    set("slot-potion", b.use[0]);
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
      case "seat":
        this.room.send("sit", { seat: Number(f.id) });
        break;
    }
  }

  /**
   * Day and night: the tower's clock, except where the story says otherwise — the Umbral Wilds
   * are a night that never ends, and on the Sunscorched Sands it is noon until the Sun Pharaoh
   * falls (for you). Dungeons and interiors have no sky.
   */
  private skyPhase(): number | undefined {
    if (!isWorldRoom(this.kind)) return undefined;
    if (this.map.theme === "shadow") return 0;
    if (this.map.theme === "sand" && !this.ui.inv?.bossKills?.includes("solkaris")) return 0.5;
    return dayPhase(Date.now() + this.clockOffset);
  }

  private updateSun() {
    const phase = this.skyPhase();
    const indoors = !!this.me && this.me.value("y") >= this.map.outdoorHeight * TILE;
    const sun = phase === undefined ? undefined : sunAt(phase);
    this.sunNow = indoors ? undefined : sun;
    SUN.dir = this.sunNow?.dir ?? -Math.PI / 2;
    SUN.len = this.sunNow?.len ?? 0.3;
    SUN.shade = this.sunNow?.shade ?? 0;
    this.terrain.setSun(SUN.dir, SUN.len, SUN.shade);
    this.sky.setNight(this.map.theme === "shadow" ? 0 : (sun?.night ?? 0));
    const frozen = this.map.theme === "shadow" ? "Endless night" : this.map.theme === "sand" && phase === 0.5 && !this.ui.inv?.bossKills?.includes("solkaris") ? "Endless noon" : undefined;
    this.hud.clock(phase === undefined ? undefined : frozen ?? clockLabel(phase), (sun?.night ?? 0) > 0.5);
  }

  private updateLighting(delta: number) {
    const zone = this.me ? this.map.zoneAt(this.me.state.x, this.me.state.y) : undefined;
    const zoneDark = typeof zone?.dark === "number" ? zone.dark : zone?.dark ? 0.8 : 0;
    // Night: moonlit blue, deepest at midnight (the Umbral Wilds keep their own dark). Dawn and dusk: a warm dim.
    const sun = this.sunNow;
    const night = sun && this.map.theme !== "shadow" ? sun.night * 0.66 : 0;
    const dusk = sun ? sun.glow * 0.26 : 0;
    this.lighting.target = Math.max(zoneDark, night, dusk);
    if (zoneDark >= night && zoneDark >= dusk) this.lighting.color = 0x05070c;
    else {
      const t = night / Math.max(1e-6, night + dusk);
      const mix = (a: number, b: number, s: number) => Math.round(a + (b - a) * t) << s;
      this.lighting.color = mix(0x7a, 0x06, 16) | mix(0x3a, 0x10, 8) | mix(0x18, 0x3a, 0);
    }
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
      for (let tx = t0x; tx <= t1x; tx++) if (this.map.theme !== "brass" && this.map.theme !== "sand" && this.map.get(tx, ty) === Tile.Crystal) lights.push({ x: tx * TILE + 16, y: ty * TILE, r: 70, color: this.map.theme === "shadow" ? 0xd8b8ff : 0x6fd0ff });
    for (const pr of this.map.props) {
      if (pr.kind !== "lamp" || pr.tx < t0x - 4 || pr.tx > t1x + 4 || pr.ty < t0y - 4 || pr.ty > t1y + 4) continue;
      lights.push({ x: pr.tx * TILE + 16, y: pr.ty * TILE - 8, r: 170, flicker: 0.4, color: 0xffc870 });
    }
    for (const o of this.map.objects) {
      if (o.kind === "lever" && o.name === "Moon Lantern") lights.push({ x: o.x, y: o.y - 30, r: 130, flicker: 0.2, color: 0xe0d8ff });
      // Doorways glow warm at night: someone's home.
      if (o.kind === "entry" && o.id.startsWith("enter-")) lights.push({ x: o.x, y: o.y - 18, r: 120, flicker: 0.25, color: 0xffc870 });
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
    r.onMessage("mapBought", () => sfx.chime(2));
    r.onMessage("admin:overview", (m: AdminOverview) => ui.setAdmin(m));
    r.onMessage("floorOpened", (m: { floor: number; by: string[]; boss?: string; admin?: boolean }) => this.celebrateFloor(m));
    r.onMessage("floorSealed", (m: { floor: number; by: string }) => this.sealFloorFx(m));
    r.onMessage("announce", (m: { text: string }) => {
      this.hud.title("Announcement", m.text);
      ui.toast(m.text, "good");
      sfx.chime(1);
    });
    r.onMessage("settings", (m: unknown) => settings.fromServer(m));
    r.onMessage("clock", (m: { now: number }) => (this.clockOffset = m.now - Date.now()));
    r.onMessage("bank", (m: { bank: InvView["inventory"]; bankGold: number }) => ui.setBank(m.bank, m.bankGold));
    r.onMessage("dialog", (d: DialogMsg) => ui.showDialog(d));
    r.onMessage("lore", (m: { name: string; text: string }) => ui.lore(m.name, m.text));
    r.onMessage("waystones", (m: { from: string; list: { id: string; name: string }[] }) => ui.waystones(m.list, m.from));
    r.onMessage("notice", (m: { text: string; kind: "info" | "error" | "good" }) => ui.toast(m.text, m.kind));
    r.onMessage("chat", (m: { from: string; text: string; channel: string; p?: string }) => {
      ui.chat(m);
      if (m.p) this.players.get(m.p)?.say(m.text);
    });
    r.onMessage("emote", (m: { p: string; e: Emote; from: string }) => {
      if (!isEmote(m.e)) return;
      this.players.get(m.p)?.emote(m.e);
      ui.chat({ from: "", text: `${m.from} ${EMOTES[m.e]}.`, channel: "say" });
    });
    r.onMessage("party", (m) => ui.setParty(m));
    r.onMessage("partyStatus", (m) => ui.setPartyStatus(m));
    r.onMessage("partyInvite", (m: { from: string }) => ui.invite(m.from));
    r.onMessage("inspect", (m) => ui.inspect(m, m.sid));
    r.onMessage("tradeRequest", (m: { from: string; name: string }) => ui.tradeRequest(m.from, m.name));
    r.onMessage("trade", (m) => ui.setTrade(m));
    r.onMessage("travel", (m: { room: RoomKind; roomId?: string; leader?: string }) => {
      if (m.roomId && m.leader && m.leader !== this.myPlayer?.name) {
        const where = `opened ${roomLabel(m.room)}`;
        if (!confirm(`${m.leader} has ${where}. Join your party inside?`)) return;
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
    r.onMessage("xp", (m: { amount: number; x?: number; y?: number; event?: string; party?: boolean; rested?: number }) => {
      const p = this.me?.state;
      if (p) this.fx.text(p.x, p.y - 50, `+${m.amount} XP${m.rested ? " (rested)" : ""}`, { color: m.rested ? "#8fc8ff" : "#b9a8ff", size: 9 }, 900, 26);
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
      const bonus = Math.round((m.level - 1) * 3);
      ui.toast(`${m.weapon}: mastery ${m.level}! (+${bonus}% damage with it)`, "good");
      this.hud.title(`${m.weapon} · Mastery ${m.level}`, m.level >= 10 ? "Mastered: this weapon now glows in your hands" : "This weapon hits harder the more you use it");
    });
    r.onMessage("learned", (m: { id: string }) => {
      sfx.levelUp();
      const p = this.me ? { x: this.me.value("x"), y: this.me.value("y") } : undefined;
      if (p) {
        this.fx.rise(p.x, p.y - 10, 0xf2d27a, 24, 14, 60, 1000, 2.2);
        this.fx.ring(p.x, p.y - 8, 0xf2d27a, 8, 40, 500, 3);
      }
      const e = skillEntry(m.id);
      ui.toast(`Learned ${e?.name ?? "a skill"}!${e?.kind === "passive" ? " (passive: always active)" : " Equip it in the Skill Book."}`, "good");
      if (e) this.hud.title(`Learned ${e.name}`, e.kind === "passive" ? "A passive skill — always active" : e.weapon ? `A ${WEAPONS.find((w) => w.key === e.weapon)!.name.toLowerCase()} skill` : "Usable with every weapon");
    });
    r.onMessage("achievement", (a: { name: string; desc: string; marks?: number }) => {
      this.hud.title(`Achievement: ${a.name}`, a.desc);
      ui.toast(`Achievement unlocked — ${a.name}${a.marks ? ` (+${a.marks} Marks)` : ""}`, "good");
      sfx.chime(3);
    });
    r.onMessage("forged", (m: { key: string; plus: number }) => {
      sfx.parry(true);
      ui.toast(`${itemBase(m.key)?.name} +${m.plus} forged!`, "good");
    });
    r.onMessage("hunt", (m: { key: string; rank: number; kills: number }) => {
      sfx.chime(3);
      ui.toast(`Hunter's Lore: ${ENEMIES.find((e) => e.key === m.key)?.name ?? m.key}, ${HUNT_TITLES[m.rank]} (${m.kills} slain): +${Math.round(HUNT_BONUS[m.rank] * 100)}% damage against them.`, "good");
    });
    r.onMessage("tempered", (m: { key: string; rarity: number }) => {
      sfx.chime(3);
      ui.toast(`${itemBase(m.key)?.name} tempered: now ${RARITY_NAMES[m.rarity]}!`, "good");
    });
    r.onMessage("salvaged", (m: { key: string }) => {
      sfx.parry(false);
      ui.toast(`${itemBase(m.key)?.name} broken down.`);
    });
    r.onMessage("quest", (updates: { id: string; name: string; text: string; done?: boolean; accepted?: boolean; pitch?: string; thanks?: string }[]) => {
      for (const u of updates) {
        if (u.done) {
          this.hud.title("Quest complete", u.name);
          sfx.levelUp();
          if (u.thanks) ui.system(`${u.name}: ${u.thanks}`);
        } else if (u.accepted) {
          ui.toast(`New quest: ${u.name} — ${u.text}`, "good");
          if (u.pitch) ui.system(`${u.name}: ${u.pitch}`);
        }
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
    const inv = this.ui.inv;
    // Indoors, you (and your party) show on the map at the building's door.
    const me = this.me ? { ...streetPoint(this.map, this.me.value("x"), this.me.value("y")), face: aimToRad(this.me.state.aim) } : undefined;
    const party: { x: number; y: number }[] = [];
    this.room.state.players.forEach((pl, sid) => {
      if (sid !== this.room.sessionId && this.myPlayer?.party && pl.party === this.myPlayer.party) party.push(streetPoint(this.map, pl.x, pl.y));
    });
    const pins: { x: number; y: number; main: boolean; label: string; n: number }[] = [];
    if (inv) {
      trackedQuests(inv, mapFloor(this.map) || undefined).forEach((t, i) => {
        const tg = questTarget(this.map, inv, t, me?.x ?? this.map.spawn.x, me?.y ?? this.map.spawn.y, false);
        if (tg) pins.push({ ...streetPoint(this.map, tg.x, tg.y), main: t.quest.main === true, label: t.quest.name, n: i + 1 });
      });
    }
    drawParchmentMap(c, this.map, { known: new Set(inv?.discovered ?? []), me, party, pins });
  }

  private minimap?: Minimap;
  private minimapAt = 0;
  private minimapFor?: WorldMap;

  /** The minimap: ten times a second, when you have this floor's map and are outdoors. */
  private updateMinimap() {
    const now = performance.now();
    if (now - this.minimapAt < 100) return;
    this.minimapAt = now;
    // The scene is reused when you travel: follow it to the new map.
    if (!this.minimap) this.minimap = new Minimap();
    if (this.minimapFor !== this.map) {
      this.minimapFor = this.map;
      this.minimap.setMap(this.map);
      this.events.once("shutdown", () => this.minimap?.hide());
    }
    const me = this.me;
    const indoors = !!me && me.value("y") >= this.map.outdoorHeight * TILE;
    if (!me || indoors || !this.mapAccess().ok) return this.minimap.hide();
    const inv = this.ui.inv;
    const party: { x: number; y: number }[] = [];
    this.room.state.players.forEach((pl, sid) => {
      if (sid !== this.room.sessionId && this.myPlayer?.party && pl.party === this.myPlayer.party) party.push({ x: pl.x, y: pl.y });
    });
    const pins: { x: number; y: number; main: boolean }[] = [];
    if (inv) {
      trackedQuests(inv, mapFloor(this.map) || undefined).forEach((t) => {
        const tg = questTarget(this.map, inv, t, me.value("x"), me.value("y"), false);
        if (tg) pins.push({ ...streetPoint(this.map, tg.x, tg.y), main: t.quest.main === true });
      });
    }
    this.minimap.draw({ me: { x: me.value("x"), y: me.value("y"), face: aimToRad(me.state.aim) }, party, pins, known: inv?.discovered ?? [] });
  }

  /** Whether this map can be opened: Floor 1 needs a bought map; the Undercroft was never charted. */
  private mapAccess(): { ok: boolean; title?: string; text?: string } {
    if (this.ui.inv?.admin) return { ok: true };
    const floor = floorOfRoom(this.kind);
    if (!floor) return { ok: true };
    if (floor.dungeon === this.kind) return { ok: false, ...floor.uncharted };
    if (!this.ui.inv?.discovered.includes(`map:floor${floor.n}`)) {
      return { ok: false, title: `You don't have a map of ${floor.n === 1 ? "this floor" : floor.title.replace(/^The /, "the ")}`, text: `${floor.mapSeller} Until then, your quest markers show the way.` };
    }
    return { ok: true };
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
    this.room.onMessage("hit", (m: { t: string; d: number; c?: number; r: number; x: number; y: number; a?: string; hs?: number; im?: number; heavy?: number; mis?: number; ang?: number; dot?: number }) => {
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
      if (m.dot) {
        this.fx.number(ex, ey - 26, String(m.d), { color: "#a8e878", size: m.a === me() ? 9 : 7, bold: true }, Math.random() < 0.5 ? 0 : Math.PI, 650);
        return;
      }
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
    this.room.onMessage("fx", (m: { k: string; x: number; y: number; r?: number; x2?: number; y2?: number; p?: string; ms?: number; c?: string }) => {
      if (this.skillFx.event(m.k, m.x, m.y, m.r ?? 90)) return;
      switch (m.k) {
        case "bloodlust":
          if (m.p) this.bloodUntil.set(m.p, performance.now() + (m.ms ?? 6000));
          this.fx.ring(m.x, m.y - 16, 0xff5a4a, 8, 40, 420, 5);
          this.fx.burst(m.x, m.y - 16, 0xff8a70, 16, 90, 2.6, 600);
          break;
        case "empower": {
          const fire = (m.r ?? 15) >= 25;
          const col = fire ? 0xff6a2a : 0xe8d8a8;
          this.fx.ring(m.x, m.y - 16, col, 8, 54, 500, 5);
          this.fx.rise(m.x, m.y - 6, fire ? 0xffb347 : 0xffffff, 22, 18, 80, 1000, 2.6);
          if (fire) for (let i = 0; i < 6; i++) this.skillFx.flameAt(m.x + (Math.random() - 0.5) * 30, m.y - 6, 0.8);
          sfx.roar();
          if (m.p === this.room.sessionId) this.ui.toast(`Empowered: +${m.r ?? 15}% damage for 6 seconds`, "good");
          break;
        }
        case "phoenix":
          if (m.p) this.ironUntil.set(m.p, performance.now() + (m.ms ?? 4000));
          this.fx.ring(m.x, m.y - 16, 0xffa040, 8, 60, 600, 6);
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            this.skillFx.flameAt(m.x + Math.cos(a) * 28, m.y - 8 + Math.sin(a) * 16, 1.1);
          }
          this.fx.rise(m.x, m.y - 10, 0xffe08a, 24, 20, 90, 1200, 3);
          sfx.levelUp();
          break;
        case "ironskin":
          if (m.p) this.ironUntil.set(m.p, performance.now() + (m.ms ?? 5000));
          this.fx.ring(m.x, m.y - 16, 0xe6ebef, 8, 34, 380, 5);
          this.fx.burst(m.x, m.y - 16, 0xc9d3dd, 14, 80, 2.4, 500);
          sfx.parry(false, m.x, m.y);
          break;
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
        case "warp":
          this.fx.ring(m.x, m.y - 14, 0xbfe6ff, 6, 46, 420, 4);
          this.fx.burst(m.x, m.y - 14, 0xeaf6ff, 18, 120, 2.2, 520);
          this.fx.rise(m.x, m.y, 0xbfe6ff, 10);
          sfx.chime(1);
          break;
        case "gateClose":
          this.fx.dust(m.x, m.y + 10, 14);
          this.fx.dust(m.x - 40, m.y + 10, 8);
          this.fx.dust(m.x + 40, m.y + 10, 8);
          sfx.boom(true, m.x, m.y);
          if (Math.hypot((this.me?.state.x ?? 0) - m.x, (this.me?.state.y ?? 0) - m.y) < 500) this.cameras.main.shake(220, 0.006);
          break;
        case "gateOpen":
          this.fx.dust(m.x, m.y + 10, 10);
          sfx.boom(false, m.x, m.y);
          break;
        case "brazier":
          this.fx.burst(m.x, m.y - 20, 0xffb347, 18, 110, 2.4, 600);
          this.fx.rise(m.x, m.y - 10, 0xffd27a, 8);
          sfx.chime(2);
          break;
        case "drink": {
          // A good drink: a raised mug, foam, and a glow of its colour.
          const c = Number.parseInt(String(m.c ?? "#f3e6c4").slice(1), 16);
          // Foam and bubbles rising off the mug, a glow of the drink, and a cheerful clink.
          this.fx.rise(m.x + 6, m.y - 34, 0xfff8ec, 8, 8, 30, 700, 2.6);
          this.fx.rise(m.x + 6, m.y - 28, c, 10, 10, 46, 900, 2);
          this.fx.ring(m.x, m.y - 10, c, 6, 28, 500, 3);
          this.fx.text(m.x, m.y - 52, "Cheers!", { color: "#fff0c0", size: 9, bold: true }, 800, 20);
          sfx.chime(2);
          break;
        }
        case "thorns":
          this.fx.streak(m.x2 ?? m.x, (m.y2 ?? m.y) - 14, m.x, m.y - 14, 0x6fd08a, 200, 3);
          this.fx.burst(m.x, m.y - 14, 0x6fd08a, 6, 50, 1.8, 300);
          break;
        case "shieldbreak":
          this.fx.ring(m.x, m.y - 14, 0xbfe8ff, 10, 46, 420, 4);
          this.fx.burst(m.x, m.y - 14, 0xdff4ff, 14, 90, 2.4, 500);
          sfx.parry(false);
          break;
        case "shieldup":
          this.fx.ring(m.x, m.y - 14, 0xbfe8ff, 40, 16, 420, 3);
          break;
        case "rally":
          // A cry for help: its allies nearby are coming.
          this.fx.text(m.x, m.y - 46, "!", { color: "#ff7a5a", size: 16, bold: true }, 900);
          this.fx.ring(m.x, m.y - 12, 0xff7a5a, 10, 90, 500, 3);
          break;
        case "gatestone":
          // A Floor Boss trophy opens the way: a pillar of gold light, and you're gone.
          this.fx.ring(m.x, m.y - 10, 0xffe08a, 8, 60, 700, 5);
          this.fx.streak(m.x, m.y + 6, m.x, m.y - 120, 0xfff0c0, 700, 22);
          this.fx.rise(m.x, m.y - 10, 0xffe08a, 24, 20, 80, 1100, 2.6);
          sfx.chime(4);
          break;
        case "perfectdodge":
          // A perfect dodge: an afterimage where the blow fell, and a counter waiting.
          this.fx.ring(m.x, m.y - 16, 0x9fe0ff, 8, 44, 380, 4);
          this.fx.burst(m.x, m.y - 16, 0xdff4ff, 16, 100, 2.4, 500);
          if (m.p === this.room.sessionId) {
            this.fx.text(m.x, m.y - 52, "PERFECT DODGE", { color: "#bfe6ff", size: 10, bold: true }, 800, 22);
            this.cameras.main.flash(120, 160, 210, 255, false);
            sfx.chime(3);
          }
          break;
        case "counter":
          this.fx.star(m.x, m.y - 24, 0xffffff, 18, 360);
          this.fx.ring(m.x, m.y - 20, 0x9fe0ff, 6, 40, 320, 4);
          this.fx.text(m.x, m.y - 60, "COUNTER", { color: "#9fe0ff", size: 9, bold: true }, 700, 18);
          break;
        case "vampiric":
          this.fx.streak(m.x2 ?? m.x, (m.y2 ?? m.y) - 16, m.x, m.y - 16, 0xff5a4a, 260, 4);
          this.fx.burst(m.x, m.y - 16, 0xff5a4a, 8, 60, 2.2, 400);
          break;
        case "lever":
          this.fx.burst(m.x, m.y - 14, 0xe8c867, 8, 60, 2, 300);
          sfx.hit(false, m.x, m.y, false, "metal");
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
          // Aurelion's glyphs are golden; under the Void Queen's eclipse they are pools of moonlight.
          const gc = this.map.theme === "shadow" ? 0xe8f0ff : this.map.theme === "tide" ? 0xf4ecd0 : this.map.theme === "brass" ? 0x9fd3ff : this.map.theme === "sand" ? 0x3a5aa8 : 0xffe08a;
          g.fillStyle(gc, 0.2 * pulse + 0.1);
          g.fillEllipse(h.x, h.y, h.radius * 2, h.radius * 1.6);
          g.lineStyle(3, gc, 0.9);
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
          const color = h.kind === HazardKind.Meteor ? 0xffa040 : h.kind === HazardKind.Sigil ? 0xc070ff : h.kind === HazardKind.Lightning ? 0x9fd3ff : h.kind === HazardKind.Frost ? 0xbfe6ff : h.kind === HazardKind.Void ? 0x9a5ae0 : h.kind === HazardKind.Tide ? 0x3fb8c8 : h.kind === HazardKind.Steam ? 0xe8e0d0 : h.kind === HazardKind.Sun ? 0xffd24a : 0xd8402c;
          g.fillStyle(color, 0.08 + 0.2 * k);
          g.fillEllipse(h.x, h.y, h.radius * 2, h.radius * 1.6);
          g.fillStyle(color, 0.35);
          g.fillEllipse(h.x, h.y, h.radius * 2 * k, h.radius * 1.6 * k);
          g.lineStyle(2, color, 0.8);
          g.strokeEllipse(h.x, h.y, h.radius * 2, h.radius * 1.6);
          if (t >= h.delay && t < h.delay + 40 && h.kind === HazardKind.Lightning) {
            // A bolt from the sky.
            this.fx.bolt(h.x + (Math.random() - 0.5) * 30, h.y - 150, h.x, h.y - 4, 0x4f8fff, 220, 8, 16);
            this.fx.bolt(h.x + (Math.random() - 0.5) * 30, h.y - 150, h.x, h.y - 4, 0xeaf6ff, 160, 3, 18);
            this.fx.sparks(h.x, h.y - 6, -Math.PI / 2, 0xeaf6ff, 14, 240, Math.PI * 2);
            this.fx.crack(h.x - 8, h.y, h.x + 8, h.y + 3, 0x2a2a3a, 900, 3);
            sfx.hit(true, h.x, h.y, true, "metal");
          } else if (t >= h.delay && t < h.delay + 40 && h.kind === HazardKind.Frost) {
            // Hail and icicles: shards of ice from above.
            this.fx.streak(h.x + (Math.random() - 0.5) * 20, h.y - 140, h.x, h.y - 6, 0xeaf6ff, 140, 5);
            this.fx.burst(h.x, h.y - 6, 0xdff4ff, 22, 150, 2.8, 650);
            this.fx.ring(h.x, h.y, 0x8fd3ff, 6, h.radius, 380, 3);
            sfx.hit(true, h.x, h.y, true, "metal");
          } else if (t >= h.delay && t < h.delay + 40 && h.kind === HazardKind.Sun) {
            // A shaft of sunlight (or a gust of the sandstorm) strikes.
            this.fx.streak(h.x, h.y - 200, h.x, h.y - 6, 0xfff0a0, 200, 12);
            this.fx.burst(h.x, h.y - 6, 0xffd24a, 16, 120, 2.6, 560);
            this.fx.ring(h.x, h.y, 0xffffff, 6, h.radius, 380, 3);
            this.fx.dust(h.x, h.y, 5);
            sfx.hit(true, h.x, h.y, true, "metal");
          } else if (t >= h.delay && t < h.delay + 40 && h.kind === HazardKind.Steam) {
            // A blast of scalding steam.
            for (let i = 0; i < 3; i++) this.skillFx.steamAt(h.x + (Math.random() - 0.5) * h.radius, h.y + (Math.random() - 0.5) * h.radius * 0.6, 1);
            this.fx.ring(h.x, h.y, 0xffffff, 6, h.radius, 380, 3);
            sfx.boom(false, h.x, h.y);
          } else if (t >= h.delay && t < h.delay + 40 && h.kind === HazardKind.Tide) {
            // The sea bursts up out of the ground.
            this.fx.burst(h.x, h.y - 6, 0x8ff0e0, 20, 140, 3, 650);
            this.fx.ring(h.x, h.y, 0xffffff, 6, h.radius, 380, 3);
            for (let i = 0; i < 4; i++) this.skillFx.splashAt(h.x + (Math.random() - 0.5) * h.radius, h.y + (Math.random() - 0.5) * h.radius * 0.6, 0.9);
            sfx.boom(false, h.x, h.y);
          } else if (t >= h.delay && t < h.delay + 40 && h.kind === HazardKind.Void) {
            // The rift bites: darkness erupts from the ground.
            this.fx.burst(h.x, h.y - 6, 0x0c0814, 20, 120, 4, 700);
            this.fx.ring(h.x, h.y, 0xb77af2, 6, h.radius, 380, 3);
            for (let i = 0; i < 4; i++) this.skillFx.voidAt(h.x + (Math.random() - 0.5) * h.radius, h.y + (Math.random() - 0.5) * h.radius * 0.6, 0.8);
            sfx.hit(true, h.x, h.y, true, "flesh");
          } else if (t >= h.delay && t < h.delay + 40) {
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
      if (pr.kind === ProjKind.IceShard) {
        const g2 = this.fx.ground;
        g2.fillStyle(0x8fd3ff, 0.3);
        g2.fillCircle(x, y, pr.radius * 1.5);
        g2.fillStyle(0xeaf6ff, 1);
        g2.fillTriangle(x + Math.cos(pr.angle) * pr.radius * 1.6, y + Math.sin(pr.angle) * pr.radius * 1.6, x + Math.cos(pr.angle + 2.4) * pr.radius * 0.8, y + Math.sin(pr.angle + 2.4) * pr.radius * 0.8, x + Math.cos(pr.angle - 2.4) * pr.radius * 0.8, y + Math.sin(pr.angle - 2.4) * pr.radius * 0.8);
        if (Math.random() < 0.5) this.fx.rise(tx, ty, 0xdff4ff, 1, 3, 8, 300, 2);
        return;
      }
      if (pr.kind === ProjKind.Sunbolt) {
        // A bolt of gathered sunlight.
        this.fx.streak(tx, ty, x, y, 0xffd24a, 70, 6);
        this.fx.streak(tx, ty, x, y, 0xffffff, 50, 2.4);
        if (Math.random() < 0.35) this.fx.star(x, y, 0xfff8e0, 4, 160);
        return;
      }
      if (pr.kind === ProjKind.Spark) {
        // A crackling bolt of aether, or a shard of hot shrapnel.
        const hot = pr.radius <= 7;
        this.fx.streak(tx, ty, x, y, hot ? 0xff9a3a : 0x9fd3ff, 60, hot ? 3 : 5);
        this.fx.streak(tx, ty, x, y, 0xffffff, 40, hot ? 1.5 : 2);
        if (Math.random() < 0.4) this.fx.sparks(x, y, pr.angle + Math.PI, hot ? 0xffd070 : 0xdff4ff, 1, 80);
        return;
      }
      if (pr.kind === ProjKind.TideWave) {
        // A rolling wave (single, wide) or a bubble of seawater (small).
        const g2 = this.fx.ground;
        if (pr.radius >= 16) {
          const bx = x - Math.cos(pr.angle) * 10;
          const by = y - Math.sin(pr.angle) * 10;
          this.fx.trail(bx, by, pr.angle - 1.2, pr.angle + 1.2, 12, pr.radius + 12, 0x8ff0e0, 90);
          this.fx.trail(bx, by, pr.angle - 1.0, pr.angle + 1.0, 8, pr.radius + 4, 0xffffff, 70);
        } else {
          g2.fillStyle(0x8ff0e0, 0.35);
          g2.fillCircle(x, y, pr.radius * 1.4);
          g2.lineStyle(2, 0xffffff, 0.9);
          g2.strokeCircle(x, y, pr.radius);
          g2.fillStyle(0xffffff, 0.8);
          g2.fillCircle(x - pr.radius * 0.35, y - pr.radius * 0.35, pr.radius * 0.25);
        }
        if (Math.random() < 0.5) this.fx.rise(tx, ty, Math.random() < 0.5 ? 0x8ff0e0 : 0xffffff, 1, 5, 10, 320, 2.4);
        return;
      }
      if (pr.kind === ProjKind.VoidOrb) {
        const g2 = this.fx.ground;
        g2.fillStyle(0xb77af2, 0.3);
        g2.fillCircle(x, y, pr.radius * 1.7);
        g2.fillStyle(0x0c0814, 1);
        g2.fillCircle(x, y, pr.radius);
        g2.lineStyle(2, 0xe0c8ff, 0.9);
        g2.strokeCircle(x, y, pr.radius);
        if (Math.random() < 0.6) this.fx.rise(tx, ty, Math.random() < 0.5 ? 0x2a1a44 : 0xb77af2, 1, 4, 10, 360, 2.6);
        return;
      }
      if (pr.kind === ProjKind.Fireball) {
        const g2 = this.fx.ground;
        g2.fillStyle(0xff5a1a, 0.35);
        g2.fillCircle(x, y, pr.radius * 1.6);
        g2.fillStyle(0xffb347, 0.9);
        g2.fillCircle(x, y, pr.radius);
        g2.fillStyle(0xfff0c0, 1);
        g2.fillCircle(x - 2, y - 2, pr.radius * 0.45);
        if (Math.random() < 0.6) this.fx.rise(tx, ty, Math.random() < 0.5 ? 0xff7a2a : 0xffc04a, 1, 4, 14, 360, 2.6);
        return;
      }
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
        case ProjKind.Wave: {
          const bx = x - Math.cos(pr.angle) * 14;
          const by = y - Math.sin(pr.angle) * 14;
          this.fx.trail(bx, by, pr.angle - 1.0, pr.angle + 1.0, 10, 22, 0xcfe6ff, 70);
          if (Math.random() < 0.4) this.fx.sparks(x, y, pr.angle + Math.PI, 0xeaf6ff, 1, 90);
          break;
        }
        case ProjKind.Javelin: {
          const jx = x - Math.cos(pr.angle) * 30;
          const jy = y - Math.sin(pr.angle) * 30;
          this.fx.streak(jx, jy, x, y, 0xb08a5a, 40, 3.5);
          this.fx.streak(x - Math.cos(pr.angle) * 8, y - Math.sin(pr.angle) * 8, x, y, 0xffffff, 40, 4);
          break;
        }
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
      if (e.flags & EFlag.Hidden) return;
      const x = this.predict.value(e, "x");
      const y = this.predict.value(e, "y") - 38 * v.def.look.scale;
      if (e.flags & EFlag.Marked) {
        const t = performance.now() / 300;
        const my = y - 12;
        g.lineStyle(2, 0xd84a6a, 0.95);
        g.strokeCircle(x, my, 6 + Math.sin(t) * 0.8);
        for (let i = 0; i < 4; i++) {
          const a = t * 0.6 + (i * Math.PI) / 2;
          g.lineBetween(x + Math.cos(a) * 4, my + Math.sin(a) * 4, x + Math.cos(a) * 10, my + Math.sin(a) * 10);
        }
      }
      if (e.hp >= e.hpMax && !(e.flags & EFlag.Elite)) return;
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
    const drink = this.ui.inv?.drink;
    const drinkDef = drink && drink.until > Date.now() ? drinkById(drink.id) : undefined;
    this.hud.drink(drinkDef && { name: drinkDef.name, color: drinkDef.color, min: Math.ceil((drink!.until - Date.now()) / 60000) });
    const w = WEAPONS[s.weapon];
    this.hud.weapon(w.name);
    const quick = s.mods & Mod.QuickCast ? 0.75 : 1;
    const slot = (idx: number, cd: number) => {
      const m = idx !== NO_SKILL ? skillMove(s.weapon, idx) : undefined;
      return { icon: m?.id ? skillIcon(m.id, 52) : undefined, name: m?.name ?? "", cd, max: Math.round((m?.cooldown ?? 1) * quick) };
    };
    this.hud.skills([slot(s.sk1, s.cd1), slot(s.sk2, s.cd2)], this.ui.unreadScroll());
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
      const mood = zone.music ?? (this.map.theme === "cave" ? "dungeon" : "fields");
      if (!this.room.state.bossActive) music.play(mood);
      const bed: Record<string, string> = { terraces: "fields", gardens: "forest", causeway: "skyreach", storm: "storm", emberhold: "ember", dragon: "ember", rimeholt: "frost", glacier: "frost", umbral: "shadow", duskhollow: "town", sanctum: "shadow", tide: "sea", saltmere: "town", cathedral: "sea", brass: "brass", gearhaven: "town", engine: "brass", sands: "sands", sunwell: "town", pyramid: "sands" };
      const theme = this.map.theme;
      ambience.play(mood === "miniboss" || mood === "boss" ? (theme === "cave" ? "dungeon" : theme === "ember" ? "ember" : theme === "frost" ? "frost" : theme === "shadow" ? "shadow" : theme === "tide" ? "sea" : theme === "brass" ? "brass" : theme === "sand" ? "sands" : theme === "gilded" || theme === "storm" ? "storm" : "forest") : bed[mood] ?? mood);
      sfx.setRoom(this.map.theme === "cave" || zone.dark === true || zone.indoor ? "cave" : zone.safe ? "town" : "open");
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
