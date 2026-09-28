import * as Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { Act, keyLabel, treeNode, type BindAction, type PlayerSim, type WorldMap } from "@floors/shared";
import { sfx } from "../audio/sfx.ts";
import { settings } from "../settings.ts";
import { iconImg, type UiIconName } from "./uiIcons.ts";

/**
 * First-play tutorial: a card that teaches by doing. Each step says what to press (with
 * the player's own key bindings), points at where to go, and moves on when it sees the
 * player do it. Finishing (or skipping) is remembered on the character.
 */

interface Me {
  x: number;
  y: number;
  s: PlayerSim;
}

interface Watch {
  me: Me;
  quests: Record<string, { stage: number; progress: number; done?: boolean }>;
  tree: string[];
}

interface Step {
  id: string;
  icon: UiIconName;
  title: string;
  /** Text; {key:action} becomes a keycap for that binding. */
  text: string;
  /** How many times the action must happen (shows a counter). */
  count?: number;
  /** Where to go, if anywhere. */
  target?: (map: WorldMap) => { x: number; y: number } | undefined;
  /** Manual steps show a Continue button. */
  manual?: boolean;
}

const spawnAt = (id: string) => (map: WorldMap) => {
  const s = map.spawns.find((x) => x.id === id);
  return s && { x: s.x, y: s.y };
};

const STEPS: Step[] = [
  { id: "welcome", icon: "main", title: "Welcome to Emberwatch", text: "This town sits on the first floor of a tower of floating lands. Grow strong, beat the Floor Boss, and the way up opens. Let's learn the basics.", manual: true },
  { id: "move", icon: "boot", title: "Move", text: "Walk with {up}{left}{down}{right}.", count: 1 },
  { id: "sprint", icon: "stamina", title: "Sprint", text: "Hold {sprint} while moving to run. It uses stamina — the yellow bar.", count: 1 },
  { id: "rhea", icon: "talk", title: "Meet the Guildmaster", text: "Follow the gold arrow to Guildmaster Rhea and press {interact} to talk. Accept her quest." },
  { id: "attack", icon: "sword", title: "Attack", text: "At the training yard, hit a straw dummy with {light}. Press it again quickly to chain a combo.", count: 4, target: spawnAt("yard-dummy-a") },
  { id: "heavy", icon: "kill", title: "Heavy attack", text: "{heavy} swings harder and breaks guards — but it's slow. Try it on the dummy.", count: 2, target: spawnAt("yard-dummy-a") },
  { id: "dodge", icon: "boot", title: "Dodge", text: "Press {dodge} to roll. For a moment you can't be hit. Roll in any direction you're moving.", count: 2 },
  { id: "parry", icon: "parry", title: "Parry", text: "Follow the gold marker to the Sparring Knight. When his weapon glints gold, press {parry} just before it lands. A perfect parry stuns him. (Red glint: dodge instead!)", count: 1 },
  { id: "learn", icon: "skills", title: "Learn a skill", text: "You have a skill point. Open the skill tree with {skills} and learn a skill for your weapon.", count: 1 },
  { id: "useskill", icon: "skills", title: "Use your skill", text: "Skills sit in the slots at the bottom of the screen. Press {skill1} to use it.", count: 1 },
  { id: "pack", icon: "pack", title: "Your pack", text: "Open your pack with {pack}. Drag gear onto your character to wear it — better gear shows green arrows.", count: 1 },
  { id: "tonic", icon: "heart", title: "Stay alive", text: "Drink a tonic with {use} when you're hurt — it takes a moment, so step back first. Out of a fight, wounds heal on their own.", manual: true },
  { id: "done", icon: "main", title: "You're ready", text: "Follow the gold arrow for your main quest; blue arrows are side quests. Quest details are on the right, and {quests} opens your quest log. Tilde at the General Store sells a map of the floor — then {map} shows it. Good luck, climber.", manual: true },
];

export class Tutorial {
  private step = 0;
  private done = false;
  private progress = 0;
  private card?: HTMLElement;
  private marker: Phaser.GameObjects.Graphics;
  private t = 0;
  private start?: { x: number; y: number };
  private lastSeq = -1;
  private sprintMs = 0;
  private storeKey: string;

  constructor(scene: Phaser.Scene, private map: WorldMap, private room: Room, name: string) {
    this.marker = scene.add.graphics().setDepth(1e6 - 1);
    this.storeKey = `floors.tutorial.${name}`;
    try {
      this.step = Math.max(0, Number(localStorage.getItem(this.storeKey) ?? 0) || 0);
    } catch {
      /* private mode */
    }
    room.onMessage("parry", (m: { p: string }) => {
      if (m.p === room.sessionId && this.current()?.id === "parry") this.bump();
    });
  }

  /** Called when the character data arrives: only brand-new climbers get the tutorial. */
  decide(inv: { level: number; discovered: string[]; quests: Record<string, { done?: boolean }> }) {
    if (this.card || this.done) return;
    const fresh = inv.level <= 2 && !inv.quests.q_welcome?.done;
    if (!fresh || inv.discovered.includes("tutorial:done") || this.step >= STEPS.length) {
      this.done = true;
      return;
    }
    this.show();
  }

  private current() {
    return this.done ? undefined : STEPS[this.step];
  }

  private save() {
    try {
      localStorage.setItem(this.storeKey, String(this.step));
    } catch {
      /* private mode */
    }
  }

  /** Text with keycaps for the player's own bindings. */
  private format(text: string) {
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    return esc(text).replace(/\{(\w+)\}/g, (_m, a: string) => {
      const code = settings.value.bindings[a as BindAction]?.[0];
      return `<kbd>${esc(keyLabel(code))}</kbd>`;
    });
  }

  private show() {
    const st = this.current();
    this.card?.remove();
    if (!st) return;
    const card = document.createElement("div");
    card.className = "tut-card";
    card.innerHTML = `
      <div class="tut-top"><span class="tut-count">Tutorial · ${this.step + 1}/${STEPS.length}</span><button class="tut-skip">Skip tutorial</button></div>
      <div class="tut-body">${iconImg(st.icon, 40, "tut-icon")}<div><div class="tut-title">${st.title}</div><div class="tut-text">${this.format(st.text)}</div></div></div>
      ${st.count && st.count > 1 ? `<div class="tut-prog"><div class="tut-bar"><i style="width:${(this.progress / st.count) * 100}%"></i></div><span>${this.progress}/${st.count}</span></div>` : ""}
      ${st.manual ? `<button class="tut-next">${this.step === STEPS.length - 1 ? "Start playing" : "Continue"}</button>` : ""}`;
    card.querySelector(".tut-skip")!.addEventListener("click", () => {
      if (confirm("Skip the tutorial? You can still follow the quest markers.")) this.finish();
    });
    card.querySelector(".tut-next")?.addEventListener("click", () => this.advance());
    document.getElementById("ui")?.append(card);
    this.card = card;
    this.progress = 0;
    this.start = undefined;
    this.sprintMs = 0;
  }

  private bump(n = 1) {
    const st = this.current();
    if (!st) return;
    this.progress += n;
    const need = st.count ?? 1;
    const bar = this.card?.querySelector<HTMLElement>(".tut-bar i");
    if (bar) bar.style.width = `${Math.min(1, this.progress / need) * 100}%`;
    const cnt = this.card?.querySelector(".tut-prog span");
    if (cnt) cnt.textContent = `${Math.min(this.progress, need)}/${need}`;
    if (this.progress >= need) this.advance();
  }

  private advance() {
    if (this.done) return;
    sfx.chime(1);
    this.card?.classList.add("tut-passed");
    const card = this.card;
    this.card = undefined;
    setTimeout(() => card?.remove(), 450);
    this.step++;
    this.save();
    if (this.step >= STEPS.length) return this.finish();
    setTimeout(() => {
      if (!this.done) this.show();
    }, 500);
  }

  private finish() {
    this.done = true;
    this.card?.remove();
    this.card = undefined;
    this.marker.clear();
    this.step = STEPS.length;
    this.save();
    this.room.send("tutorial:done");
  }

  update(dtMs: number, w: Watch | undefined) {
    this.marker.clear();
    const st = this.current();
    if (!st || !this.card || !w) return;
    this.t += dtMs;
    const { me } = w;
    const s = me.s;
    const newAct = s.actSeq !== this.lastSeq;
    this.lastSeq = s.actSeq;
    switch (st.id) {
      case "move":
        this.start ??= { x: me.x, y: me.y };
        if (Math.hypot(me.x - this.start.x, me.y - this.start.y) > 110) this.bump();
        break;
      case "sprint":
        if (s.gait === 2) this.sprintMs += dtMs;
        if (this.sprintMs > 900) this.bump();
        break;
      case "rhea":
        if (w.quests.q_welcome) this.advance();
        break;
      case "attack":
        if (newAct && s.act === Act.Light) this.bump();
        break;
      case "heavy":
        if (newAct && s.act === Act.Heavy) this.bump();
        break;
      case "dodge":
        if (newAct && s.act === Act.Dodge) this.bump();
        break;
      case "learn":
        if (w.tree.some((id) => treeNode(id)?.kind === "skill")) this.bump();
        break;
      case "useskill":
        if (newAct && s.act === Act.Skill) this.bump();
        break;
      case "pack":
        if (document.querySelector('.panel[data-id="inventory"]')) this.bump();
        break;
    }
    // Where to go: a bouncing pin over the spot and a ring on the ground.
    const tg = st.target?.(this.map);
    if (tg && Math.hypot(tg.x - me.x, tg.y - me.y) > 40) {
      const g = this.marker;
      const bob = Math.sin(this.t / 220) * 4;
      const pulse = (this.t / 1100) % 1;
      g.lineStyle(3, 0xf2d27a, 0.8 * (1 - pulse));
      g.strokeEllipse(tg.x, tg.y, 26 + pulse * 40, (26 + pulse * 40) * 0.5);
      const y = tg.y - 58 + bob;
      g.fillStyle(0x1d1a17, 0.95);
      g.fillTriangle(tg.x - 11, y, tg.x + 11, y, tg.x, y + 16);
      g.fillStyle(0xf2d27a, 1);
      g.fillTriangle(tg.x - 8, y + 1.5, tg.x + 8, y + 1.5, tg.x, y + 12.5);
      // An arrow from the player toward it when it's far.
      const d = Math.hypot(tg.x - me.x, tg.y - me.y);
      if (d > 160) {
        const a = Math.atan2(tg.y - me.y, tg.x - me.x);
        const cx = me.x + Math.cos(a) * 58;
        const cy = me.y - 16 + Math.sin(a) * 58;
        const p = (len: number, side: number) => ({ x: cx + Math.cos(a) * len - Math.sin(a) * side, y: cy + Math.sin(a) * len + Math.cos(a) * side });
        g.fillStyle(0x1d1a17, 0.9);
        g.fillPoints([p(12, 0), p(-6, 9), p(-2, 0), p(-6, -9)] as Phaser.Math.Vector2[], true);
        g.fillStyle(0xffe9a8, 1);
        g.fillPoints([p(9, 0), p(-4, 6.5), p(-1, 0), p(-4, -6.5)] as Phaser.Math.Vector2[], true);
      }
    }
  }

  destroy() {
    this.card?.remove();
    this.marker.destroy();
  }
}

