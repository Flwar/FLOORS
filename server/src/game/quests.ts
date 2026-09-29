import { makeItem, missionReady, questMarks, QUESTS, questDef, questOpen, type QuestDef } from "@floors/shared";
import type { Character } from "./character.ts";

export type QuestEvent =
  | { kind: "kill"; enemy: string }
  | { kind: "interact"; object: string }
  | { kind: "parry" }
  | { kind: "visit"; zone: string }
  | { kind: "dungeon"; dungeon: string }
  | { kind: "talk"; npc: string };

export interface QuestUpdate {
  id: string;
  name: string;
  text: string;
  done?: boolean;
  /** A quest that just started (by itself: see QuestDef.autoStart). */
  accepted?: boolean;
  pitch?: string;
  /** The giver's word, for a quest that finished out in the field (no one to hand it in to). */
  thanks?: string;
  rewards?: QuestDef["rewards"];
}

/** Can this character take the quest now? Missions come back to the board once they cool down. */
function available(ch: Character, q: QuestDef) {
  const st = ch.data.quests[q.id];
  if (q.mission ? !missionReady(st, Date.now()) : st) return false;
  return questOpen(q, (id) => !!ch.data.quests[id]?.done, ch.data.floor);
}

/** Quests an NPC (or a Mission Board) can offer right now. */
export function offers(ch: Character, npc: string): QuestDef[] {
  return QUESTS.filter((q) => q.giver === npc && available(ch, q));
}

/** Active quests whose current stage wants to talk to this NPC (or hand in collections to the giver). */
export function turnIns(ch: Character, npc: string): QuestDef[] {
  return QUESTS.filter((q) => {
    const st = ch.data.quests[q.id];
    if (!st || st.done) return false;
    const stage = q.stages[st.stage];
    if (!stage) return false;
    if (stage.kind === "talk") return stage.npc === npc;
    if (stage.kind === "collect") return q.giver === npc && ch.count(stage.item) >= stage.count;
    return false;
  });
}

export function accept(ch: Character, id: string): string | undefined {
  const q = questDef(id);
  if (!q || (ch.data.quests[id] && !q.mission)) return "You can't take that quest.";
  if (q.mission && !missionReady(ch.data.quests[id], Date.now())) return "That mission isn't on the board right now.";
  if (!available(ch, q)) return "You're not ready for that yet.";
  ch.data.quests[id] = { stage: 0, progress: 0 };
  ch.dirty = true;
  return undefined;
}

function advance(ch: Character, q: QuestDef, out: QuestUpdate[]) {
  const st = ch.data.quests[q.id];
  st.stage++;
  st.progress = 0;
  if (st.stage >= q.stages.length) finish(ch, q, out);
  else {
    out.push({ id: q.id, name: q.name, text: q.stages[st.stage].text });
    catchUp(ch, q, out);
  }
  ch.dirty = true;
}

/** A boss you've already beaten counts: a quest that asks for it again moves straight on. */
function catchUp(ch: Character, q: QuestDef, out: QuestUpdate[]) {
  const st = ch.data.quests[q.id];
  const stage = q.stages[st?.stage ?? -1];
  if (!st || st.done || q.mission || stage?.kind !== "kill" || stage.count !== 1) return;
  if (!stage.enemy.some((k) => ch.data.bossKills.includes(k))) return;
  advance(ch, q, out);
}

function finish(ch: Character, q: QuestDef, out: QuestUpdate[]) {
  const st = ch.data.quests[q.id];
  st.stage = q.stages.length;
  st.done = true;
  st.at = Date.now();
  const r = q.rewards;
  ch.data.gold += r.gold;
  // Marks buy skill scrolls from the Archivists.
  ch.data.marks = (ch.data.marks ?? 0) + questMarks(q);
  for (const it of r.items ?? []) {
    const item = makeItem(it.key, it.rarity, it.qty ?? 1);
    if (!ch.addItem(item)) ch.data.bank[ch.data.bank.indexOf(null)] = item; // never lose a reward: overflow goes to storage
  }
  if (r.unlockFloor) ch.data.floor = Math.max(ch.data.floor, r.unlockFloor);
  ch.addXp(r.xp);
  const handedIn = ["talk", "collect"].includes(q.stages[q.stages.length - 1].kind);
  out.push({ id: q.id, name: q.name, text: q.mission ? "Mission complete" : "Quest complete", done: true, rewards: { ...r, marks: questMarks(q) }, thanks: handedIn ? undefined : q.thanks });
  ch.dirty = true;
  startNext(ch, q, out);
}

/** The story runs straight on: the next chapter after a finished quest starts by itself. */
function startNext(ch: Character, q: QuestDef, out: QuestUpdate[]) {
  for (const next of QUESTS) {
    if (next.requires !== q.id || !next.autoStart || !available(ch, next)) continue;
    ch.data.quests[next.id] = { stage: 0, progress: 0 };
    ch.dirty = true;
    out.push({ id: next.id, name: next.name, text: next.stages[0].text, accepted: true, pitch: next.pitch });
    catchUp(ch, next, out);
  }
}

/**
 * On joining: finish quests whose last steps were removed (e.g. the Undercroft no longer sends
 * you back to Rhea), start story chapters that now start by themselves, and give credit for
 * bosses already beaten.
 */
export function settleQuests(ch: Character): QuestUpdate[] {
  const out: QuestUpdate[] = [];
  for (const q of QUESTS) {
    const st = ch.data.quests[q.id];
    if (st && !st.done && st.stage >= q.stages.length) finish(ch, q, out);
    else if (st?.done) startNext(ch, q, out);
  }
  for (const q of QUESTS) catchUp(ch, q, out);
  return out;
}

/** Feed a gameplay event into every active quest. */
export function questEvent(ch: Character, ev: QuestEvent): QuestUpdate[] {
  const out: QuestUpdate[] = [];
  for (const q of QUESTS) {
    const st = ch.data.quests[q.id];
    if (!st || st.done) continue;
    // Just taken, and it wants a boss you've already beaten: move straight on.
    catchUp(ch, q, out);
    if (st.done) continue;
    const stage = q.stages[st.stage];
    if (!stage) continue;
    switch (stage.kind) {
      case "kill":
        if (ev.kind === "kill" && stage.enemy.includes(ev.enemy)) {
          st.progress++;
          if (st.progress >= stage.count) advance(ch, q, out);
          else out.push({ id: q.id, name: q.name, text: `${stage.text} (${st.progress}/${stage.count})` });
          ch.dirty = true;
        }
        break;
      case "parry":
        if (ev.kind === "parry") {
          st.progress++;
          if (st.progress >= stage.count) advance(ch, q, out);
          else out.push({ id: q.id, name: q.name, text: `${stage.text} (${st.progress}/${stage.count})` });
          ch.dirty = true;
        }
        break;
      case "interact":
        if (ev.kind === "interact" && stage.objects.includes(ev.object)) advance(ch, q, out);
        break;
      case "visit":
        if (ev.kind === "visit" && ev.zone === stage.zone) advance(ch, q, out);
        break;
      case "dungeon":
        if (ev.kind === "dungeon" && ev.dungeon === stage.dungeon) advance(ch, q, out);
        break;
      case "talk":
        if (ev.kind === "talk" && ev.npc === stage.npc) advance(ch, q, out);
        break;
      case "collect":
        if (ev.kind === "talk" && ev.npc === q.giver && ch.count(stage.item) >= stage.count) {
          if (stage.consume) ch.consume(stage.item, stage.count);
          advance(ch, q, out);
        }
        break;
    }
  }
  return out;
}
