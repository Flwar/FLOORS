import { DEFAULT_SETTINGS, sanitizeSettings, type BindAction, type PlayerSettings } from "@floors/shared";

const KEY = "floors.settings";

function local(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The player's settings. Cached in this browser so volumes apply before login, and saved
 * to the character (debounced) so they follow the player to other machines.
 */
class SettingsStore {
  value: PlayerSettings;
  private listeners = new Set<(s: PlayerSettings) => void>();
  private uploader?: (s: PlayerSettings) => void;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    let raw: unknown = null;
    try {
      raw = JSON.parse(local()?.getItem(KEY) ?? "null");
      // Older builds stored only volumes.
      if (!raw) raw = JSON.parse(local()?.getItem("floors.volume") ?? "null");
    } catch {
      /* defaults */
    }
    this.value = raw ? sanitizeSettings(raw) : sanitizeSettings(DEFAULT_SETTINGS);
  }

  onChange(fn: (s: PlayerSettings) => void) {
    this.listeners.add(fn);
    fn(this.value);
    return () => this.listeners.delete(fn);
  }

  /** How changes reach the server (the current room). */
  setUploader(fn: (s: PlayerSettings) => void) {
    this.uploader = fn;
  }

  set(patch: Partial<PlayerSettings>) {
    this.value = sanitizeSettings({ ...this.value, ...patch });
    this.commit();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.uploader?.(this.value), 700);
  }

  bind(action: BindAction, slot: number, code: string | null) {
    const bindings = structuredClone(this.value.bindings);
    if (code) {
      // A key does one thing: take it away from whatever had it.
      for (const list of Object.values(bindings)) {
        const i = list.indexOf(code);
        if (i >= 0) list.splice(i, 1);
      }
    }
    const list = bindings[action];
    if (code) {
      if (slot < list.length) list[slot] = code;
      else list.push(code);
    } else if (slot < list.length) list.splice(slot, 1);
    this.set({ bindings });
  }

  resetBindings() {
    this.set({ bindings: structuredClone(DEFAULT_SETTINGS.bindings) });
  }

  /** The server's copy wins; a character with none adopts this browser's settings. */
  fromServer(raw: unknown) {
    if (!raw) {
      this.uploader?.(this.value);
      return;
    }
    this.value = sanitizeSettings(raw);
    this.commit();
  }

  is(action: BindAction, code: string) {
    return this.value.bindings[action].includes(code);
  }

  private commit() {
    try {
      local()?.setItem(KEY, JSON.stringify(this.value));
    } catch {
      /* private mode */
    }
    for (const fn of this.listeners) fn(this.value);
  }
}

export const settings = new SettingsStore();
