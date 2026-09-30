import type * as Phaser from "phaser";
import { Btn, radToAim, type Bindings } from "@floors/shared";
import { sfx } from "./audio/sfx.ts";
import { settings } from "./settings.ts";

export interface FrameInput {
  mx: number;
  my: number;
  aim: number;
  btn: number;
}

/**
 * Keyboard + mouse. Presses are latched until the next input frame is sent, so a
 * click shorter than one 60 Hz frame is never lost.
 */
export class Controls {
  private down = new Set<string>();
  private latched = 0;
  private scripted?: { f: Partial<FrameInput>; until: number };
  /** Set while the settings panel waits for a key to bind; the next press goes there instead. */
  capturing = false;
  pointer = { x: 0, y: 0 };
  /** Set by UI when a menu or chat has focus; gameplay input is suppressed. */
  blocked = false;

  get bindings(): Bindings {
    return settings.value.bindings;
  }

  /** Unhooks every listener this instance added (the scene restarts on each room change). */
  private listening = new AbortController();

  destroy() {
    this.listening.abort();
  }

  constructor(private scene: Phaser.Scene) {
    const canvas = scene.game.canvas;
    const signal = this.listening.signal;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });
    window.addEventListener("keydown", (e) => {
      if (this.blocked || this.capturing || isTyping(e)) return;
      sfx.unlock();
      if (e.code === "Space" || e.code === "Tab") e.preventDefault();
      if (!e.repeat) this.press(e.code);
      this.down.add(e.code);
    }, { signal });
    window.addEventListener("keyup", (e) => this.down.delete(e.code), { signal });
    window.addEventListener("blur", () => this.down.clear(), { signal });
    canvas.addEventListener("pointerdown", (e) => {
      sfx.unlock();
      if (this.blocked || this.capturing) return;
      const code = `Mouse${e.button}`;
      this.press(code);
      this.down.add(code);
    }, { signal });
    window.addEventListener("pointerup", (e) => this.down.delete(`Mouse${e.button}`), { signal });
    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 3 || e.button === 4) e.preventDefault();
    }, { signal });
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * scene.scale.width;
      this.pointer.y = ((e.clientY - r.top) / r.height) * scene.scale.height;
    }, { signal });
  }

  private press(code: string) {
    const b = this.bindings;
    if (b.light.includes(code)) this.latched |= Btn.Light;
    if (b.heavy.includes(code)) this.latched |= Btn.Heavy;
    if (b.dodge.includes(code)) this.latched |= Btn.Dodge;
    if (b.parry.includes(code)) this.latched |= Btn.Parry;
    if (b.skill1.includes(code)) this.latched |= Btn.Skill1;
    if (b.skill2.includes(code)) this.latched |= Btn.Skill2;
    if (b.use.includes(code)) this.latched |= Btn.Use;
  }

  private held(list: string[]) {
    return list.some((c) => this.down.has(c));
  }

  isDown(code: string) {
    return this.down.has(code);
  }

  /** Build this frame's command; consumes latched presses. `px,py` is the player's screen position. */
  frame(px: number, py: number, fallbackAim: number): FrameInput {
    if (this.scripted) {
      if (performance.now() < this.scripted.until) {
        const f = this.scripted.f;
        const btn = f.btn ?? 0;
        this.scripted.f = { ...f, btn: 0 };
        return { mx: f.mx ?? 0, my: f.my ?? 0, aim: f.aim ?? fallbackAim, btn: btn | this.takeLatched() };
      }
      this.scripted = undefined;
    }
    const b = this.bindings;
    const blocked = this.blocked;
    const mx = blocked ? 0 : (this.held(b.right) ? 1 : 0) - (this.held(b.left) ? 1 : 0);
    const my = blocked ? 0 : (this.held(b.down) ? 1 : 0) - (this.held(b.up) ? 1 : 0);
    const dx = this.pointer.x - px;
    const dy = this.pointer.y - py;
    const aim = Math.hypot(dx, dy) > 4 ? radToAim(Math.atan2(dy, dx)) : fallbackAim;
    let btn = this.takeLatched();
    if (!blocked && this.held(b.sprint)) btn |= Btn.Sprint;
    return { mx, my, aim, btn };
  }

  private takeLatched() {
    const b = this.latched;
    this.latched = 0;
    return b;
  }

  /** Dev/test: hold a scripted command for `ms` (buttons fire once). */
  script(f: Partial<FrameInput>, ms: number) {
    this.scripted = { f, until: performance.now() + ms };
  }

  tap(btn: number) {
    this.latched |= btn;
  }
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
