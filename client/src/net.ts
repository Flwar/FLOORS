import { Client, type Room } from "@colyseus/sdk";
import { SERVER_PORT } from "@floors/shared";
import type { WorldState } from "../../server/src/state.ts";

export type RoomKind = "world" | "dungeon" | "floor2" | "stormspire";

const TOKEN_KEY = "floors.session";

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Account session + room transfers (world ⇄ dungeon ⇄ Floor 2). */
export class Session {
  readonly client: Client;
  token?: string;
  name?: string;
  /** Dev-only guest login (tests, quick play). */
  guest?: string;
  room?: Room<any, WorldState>;
  kind: RoomKind = "world";
  /** Messages that arrived before the scene bound its handlers (see attach). */
  private early: [string | number, unknown][] = [];
  private catching = false;

  constructor() {
    const params = new URLSearchParams(location.search);
    const ws = location.protocol === "https:" ? "wss" : "ws";
    // A production build is served by the game server itself, so it connects back to the same address.
    const endpoint = params.get("server") ?? (import.meta.env.PROD ? `${ws}://${location.host}` : `${ws}://${location.hostname}:${SERVER_PORT}`);
    this.client = new Client(endpoint);
    this.token = storage()?.getItem(TOKEN_KEY) ?? undefined;
    if (import.meta.env.DEV && params.get("guest")) this.guest = params.get("guest")!;
  }

  private authOptions(extra: Record<string, unknown> = {}) {
    if (this.guest) return { guest: this.guest, ...extra };
    return { token: this.token, ...extra };
  }

  async login(username: string, password: string, register: boolean) {
    const room = await this.client.joinOrCreate<WorldState>("world", { username, password, register });
    this.attach(room, "world");
    return room;
  }

  async resume() {
    const room = await this.client.joinOrCreate<WorldState>("world", this.authOptions());
    this.attach(room, "world");
    return room;
  }

  /** Move to another room. The character is saved on the way out and loaded on the way in. */
  async travel(kind: RoomKind, roomId?: string) {
    const old = this.room;
    this.room = undefined;
    await old?.leave(true);
    const room = roomId
      ? await this.client.joinById<WorldState>(roomId, this.authOptions())
      : await this.client.joinOrCreate<WorldState>(kind, this.authOptions());
    this.attach(room, kind);
    return room;
  }

  logout() {
    storage()?.removeItem(TOKEN_KEY);
    this.token = undefined;
    void this.room?.leave(true);
  }

  /** Replay what arrived before the scene was listening. Call once its handlers are bound. */
  replayEarly(room: Room<any, WorldState>) {
    this.catching = false;
    const early = this.early;
    this.early = [];
    const r = room as unknown as { dispatchMessage(type: string | number, message: unknown): void };
    for (const [type, m] of early) r.dispatchMessage(type, m);
  }

  private attach(room: Room<any, WorldState>, kind: RoomKind) {
    this.room = room;
    this.kind = kind;
    // The scene restarts a frame after a room change and only then binds its handlers, so the
    // server's first messages (the character sheet, settings, quest updates) would be dropped.
    // Keep them until the scene says it is listening.
    this.early = [];
    this.catching = true;
    room.onMessage("*", (type: string | number, m: unknown) => {
      if (this.catching && this.early.length < 256) this.early.push([type, m]);
    });
    room.onMessage("session", (m: { token: string; name: string }) => {
      this.token = m.token;
      this.name = m.name;
      storage()?.setItem(TOKEN_KEY, m.token);
    });
  }
}
