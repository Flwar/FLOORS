/**
 * Player settings: volumes, camera zoom and key bindings. Saved with the character so
 * they follow the player to any machine; the server stores only a sanitized copy.
 */

export const BIND_ACTIONS = [
  "up", "down", "left", "right", "sprint",
  "light", "heavy", "dodge", "parry", "skill1", "skill2", "use",
  "interact", "pack", "character", "quests", "map", "party",
] as const;
export type BindAction = (typeof BIND_ACTIONS)[number];
export type Bindings = Record<BindAction, string[]>;

export const BIND_LABELS: Record<BindAction, string> = {
  up: "Move up", down: "Move down", left: "Move left", right: "Move right", sprint: "Sprint",
  light: "Attack (combo)", heavy: "Heavy attack", dodge: "Dodge", parry: "Parry", skill1: "Weapon skill 1", skill2: "Weapon skill 2",
  use: "Drink tonic", interact: "Interact / pick up / revive",
  pack: "Pack", character: "Character", quests: "Quests", map: "Map", party: "Party",
};

/** Actions that open menus or talk to the world; these take keyboard keys only. */
export const MENU_ACTIONS: readonly BindAction[] = ["interact", "pack", "character", "quests", "map", "party"];

/** KeyboardEvent.code values, or "Mouse<button>" (0 left, 1 middle, 2 right, 3/4 side). */
export const DEFAULT_BINDINGS: Bindings = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  light: ["Mouse0"],
  heavy: ["Mouse2"],
  dodge: ["Space"],
  parry: ["KeyQ", "Mouse1"],
  skill1: ["Digit1"],
  skill2: ["Digit2"],
  use: ["KeyR"],
  interact: ["KeyF"],
  pack: ["KeyI", "Tab"],
  character: ["KeyC"],
  quests: ["KeyJ"],
  map: ["KeyM"],
  party: ["KeyP"],
};

export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 1.6;

export interface PlayerSettings {
  sfx: number;
  music: number;
  /** Camera zoom multiplier on top of the screen-size fit. */
  zoom: number;
  bindings: Bindings;
}

export const DEFAULT_SETTINGS: PlayerSettings = { sfx: 0.7, music: 0.35, zoom: 1.15, bindings: DEFAULT_BINDINGS };

/** Keys that can never be bound: they open chat, close menus, or belong to the browser. */
export const RESERVED_KEYS = new Set(["Enter", "NumpadEnter", "Escape", "F5", "F11", "F12", "MetaLeft", "MetaRight"]);

const CODE = /^(Key[A-Z]|Digit[0-9]|Numpad[0-9A-Za-z]+|F([1-9]|1[0-2])|Arrow(Up|Down|Left|Right)|(Shift|Control|Alt)(Left|Right)|Space|Tab|Backquote|Minus|Equal|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|CapsLock|Insert|Home|End|PageUp|PageDown|Mouse[0-4])$/;

export function isBindableCode(code: string, action?: BindAction) {
  if (!CODE.test(code) || RESERVED_KEYS.has(code)) return false;
  if (action && MENU_ACTIONS.includes(action) && code.startsWith("Mouse")) return false;
  return true;
}

const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/** Accept only well-formed settings; anything missing or malformed falls back to the default. */
export function sanitizeSettings(raw: unknown): PlayerSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof PlayerSettings, unknown>>;
  const b = (r.bindings && typeof r.bindings === "object" ? r.bindings : {}) as Record<string, unknown>;
  const bindings = {} as Bindings;
  for (const a of BIND_ACTIONS) {
    const list = Array.isArray(b[a]) ? (b[a] as unknown[]) : undefined;
    bindings[a] = list
      ? [...new Set(list.filter((c): c is string => typeof c === "string" && isBindableCode(c, a)))].slice(0, 2)
      : [...DEFAULT_BINDINGS[a]];
  }
  return {
    sfx: num(r.sfx, 0, 1, DEFAULT_SETTINGS.sfx),
    music: num(r.music, 0, 1, DEFAULT_SETTINGS.music),
    zoom: num(r.zoom, ZOOM_MIN, ZOOM_MAX, DEFAULT_SETTINGS.zoom),
    bindings,
  };
}

/** Short label for a key or mouse button, for prompts and the HUD. */
export function keyLabel(code: string | undefined): string {
  if (!code) return "—";
  const named: Record<string, string> = {
    Mouse0: "LMB", Mouse1: "MMB", Mouse2: "RMB", Mouse3: "M4", Mouse4: "M5",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    ShiftLeft: "Shift", ShiftRight: "RShift", ControlLeft: "Ctrl", ControlRight: "RCtrl", AltLeft: "Alt", AltRight: "RAlt",
    Space: "Space", Tab: "Tab", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
    Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\", CapsLock: "Caps",
    Backspace: "Bksp", Insert: "Ins", Delete: "Del", PageUp: "PgUp", PageDown: "PgDn",
  };
  if (named[code]) return named[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num${code.slice(6)}`;
  return code;
}
