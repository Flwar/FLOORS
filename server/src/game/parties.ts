import { online, sendToKey } from "./registry.ts";

export const MAX_PARTY = 4;
const INVITE_MS = 60_000;

export interface Party {
  id: string;
  leader: string;
  members: string[];
}

const parties = new Map<string, Party>();
const byMember = new Map<string, string>();
/** invitee key → { from key, party id, expires } */
const invites = new Map<string, { from: string; partyId?: string; until: number }>();
let nextId = 1;

export function partyOf(key: string): Party | undefined {
  const id = byMember.get(key);
  return id ? parties.get(id) : undefined;
}

export function partyMembers(key: string): string[] {
  return partyOf(key)?.members ?? [key];
}

function nameOf(key: string) {
  return online.get(key)?.ch.data.name ?? "?";
}

export function findKeyByName(name: string): string | undefined {
  const lower = name.trim().toLowerCase();
  for (const e of online.values()) if (e.ch.data.name.toLowerCase() === lower) return e.key;
  return undefined;
}

/** Push the party roster to every member (rooms fill in live HP per tick). */
export function syncParty(p: Party | undefined, extraKeys: string[] = []) {
  const recipients = new Set([...(p?.members ?? []), ...extraKeys]);
  for (const k of recipients) {
    if (!p || !p.members.includes(k)) {
      sendToKey(k, "party", null);
      continue;
    }
    sendToKey(k, "party", { id: p.id, leader: p.leader, members: p.members.map((m) => ({ key: m, name: nameOf(m), online: online.has(m) })) });
  }
  onPartyChanged?.(p);
}

/** Rooms register this to refresh the synced `party` field on players. */
export let onPartyChanged: ((p: Party | undefined) => void) | undefined;
export function setPartyListener(fn: (p: Party | undefined) => void) {
  onPartyChanged = fn;
}

export function invite(from: string, toName: string): string | undefined {
  const to = findKeyByName(toName);
  if (!to) return `No adventurer named "${toName}" is online.`;
  if (to === from) return "You can't invite yourself.";
  if (partyOf(to)) return `${nameOf(to)} is already in a party.`;
  const p = partyOf(from);
  if (p && p.leader !== from) return "Only the party leader can invite.";
  if (p && p.members.length >= MAX_PARTY) return "Your party is full.";
  invites.set(to, { from, partyId: p?.id, until: Date.now() + INVITE_MS });
  sendToKey(to, "partyInvite", { from: nameOf(from) });
  return undefined;
}

export function acceptInvite(key: string): string | undefined {
  const inv = invites.get(key);
  invites.delete(key);
  if (!inv || inv.until < Date.now()) return "That invitation has expired.";
  if (partyOf(key)) return "You're already in a party.";
  let p = inv.partyId ? parties.get(inv.partyId) : partyOf(inv.from);
  if (!p) {
    if (partyOf(inv.from)) return "That party no longer exists.";
    p = { id: `p${nextId++}`, leader: inv.from, members: [inv.from] };
    parties.set(p.id, p);
    byMember.set(inv.from, p.id);
  }
  if (p.members.length >= MAX_PARTY) return "That party is full.";
  p.members.push(key);
  byMember.set(key, p.id);
  syncParty(p);
  return undefined;
}

export function declineInvite(key: string) {
  const inv = invites.get(key);
  invites.delete(key);
  if (inv) sendToKey(inv.from, "notice", { text: `${nameOf(key)} declined your invitation.`, kind: "info" });
}

export function leaveParty(key: string) {
  const p = partyOf(key);
  if (!p) return;
  p.members = p.members.filter((m) => m !== key);
  byMember.delete(key);
  if (p.members.length <= 1) {
    for (const m of p.members) byMember.delete(m);
    parties.delete(p.id);
    syncParty(undefined, [key, ...p.members]);
    return;
  }
  if (p.leader === key) p.leader = p.members[0];
  syncParty(p, [key]);
}

export function kick(leader: string, name: string): string | undefined {
  const p = partyOf(leader);
  if (!p || p.leader !== leader) return "Only the party leader can remove members.";
  const target = p.members.find((m) => nameOf(m).toLowerCase() === name.toLowerCase());
  if (!target || target === leader) return "They aren't in your party.";
  leaveParty(target);
  sendToKey(target, "notice", { text: "You were removed from the party.", kind: "info" });
  return undefined;
}

export function promote(leader: string, name: string): string | undefined {
  const p = partyOf(leader);
  if (!p || p.leader !== leader) return "Only the party leader can do that.";
  const target = p.members.find((m) => nameOf(m).toLowerCase() === name.toLowerCase());
  if (!target) return "They aren't in your party.";
  p.leader = target;
  syncParty(p);
  return undefined;
}

/** Called when a character goes fully offline (not on room transfers). */
export function memberOffline(key: string) {
  const p = partyOf(key);
  if (p) syncParty(p);
}
