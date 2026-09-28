import type { Client } from "colyseus";
import type { Character } from "./character.ts";

/** A connected character: exactly one per account across all rooms. */
export interface OnlineEntry {
  key: string;
  accountId: number | null;
  ch: Character;
  roomId: string;
  sid: string;
  client: Client;
  /** Set when the session is being replaced (login elsewhere / room transfer). */
  superseded?: boolean;
  /** Live status for party frames, provided by the hosting room. */
  status?: () => { hp: number; hpMax: number; dead: boolean; x: number; y: number; room: string; level: number };
}

export const online = new Map<string, OnlineEntry>();

/** Cross-room delivery hooks (chat, party updates), registered by each room. */
export const roomSenders = new Map<string, (sid: string, type: string, data: unknown) => void>();

export function sendToKey(key: string, type: string, data: unknown) {
  const e = online.get(key);
  if (!e) return;
  roomSenders.get(e.roomId)?.(e.sid, type, data);
}

export function broadcastAll(type: string, data: unknown) {
  for (const e of online.values()) roomSenders.get(e.roomId)?.(e.sid, type, data);
}
