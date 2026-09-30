/**
 * Quest flow (npm run questflow): no needless trips back to town. The Undercroft quest ends
 * when the Warden falls and "The First Gate" picks up right there in the dungeon; a boss you've
 * already beaten counts for a quest that asks for it; old saves stuck on a removed step settle.
 * Runs the server's quest logic directly (no server needed).
 */
import { Character, newCharacter } from "../server/src/game/character.ts";
import { accept, questEvent, settleQuests } from "../server/src/game/quests.ts";

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const fresh = (upTo: string[]) => {
  const ch = new Character(newCharacter(`Quester${Math.floor(Math.random() * 1e5)}`), null);
  for (const id of upTo) ch.data.quests[id] = { stage: 9, progress: 0, done: true };
  return ch;
};
const story = ["q_welcome", "q_wolves", "q_scouts", "q_grakk"];

// 1. Into the Undercroft: the Warden falls, the quest ends there, and the Keeper's quest starts.
{
  const ch = fresh(story);
  check("the Undercroft quest can be taken", accept(ch, "q_undercroft") === undefined, "accepted");
  questEvent(ch, { kind: "dungeon", dungeon: "dungeon" });
  const gold = ch.data.gold;
  const ups = questEvent(ch, { kind: "kill", enemy: "warden" });
  check("the Warden completes it on the spot", !!ch.data.quests.q_undercroft?.done && ch.data.gold > gold, JSON.stringify(ups.map((u) => [u.id, u.text])));
  const keeper = ups.find((u) => u.id === "q_keeper");
  check("…and The First Gate starts by itself", !!keeper?.accepted && ch.data.quests.q_keeper?.stage === 0, keeper ? keeper.text : "not started");
  const after = questEvent(ch, { kind: "kill", enemy: "aurelion" });
  check("Aurelion counts right away", ch.data.quests.q_keeper?.stage === 1, JSON.stringify(after.map((u) => u.text)));
  questEvent(ch, { kind: "talk", npc: "warden" });
  check("telling Gate Warden Eld finishes the story and opens Floor 2", !!ch.data.quests.q_keeper?.done && ch.data.floor >= 2, `floor ${ch.data.floor}`);
}

// 2. A boss you've already beaten counts.
{
  const ch = fresh(["q_welcome", "q_wolves", "q_scouts"]);
  ch.data.bossKills.push("grakk");
  accept(ch, "q_grakk");
  const ups = questEvent(ch, { kind: "talk", npc: "guildmaster" });
  check("Grakk, already beaten, counts for The Bandit King", !!ch.data.quests.q_grakk?.done, JSON.stringify(ups.map((u) => [u.id, u.text])));
}

// 3. Old saves: stuck on the removed "Return to Rhea" step, or done with it and never offered the next.
{
  const ch = fresh(story);
  ch.data.quests.q_undercroft = { stage: 2, progress: 0 };
  const ups = settleQuests(ch);
  check("an old save waiting to report the Warden is settled", !!ch.data.quests.q_undercroft?.done && !!ch.data.quests.q_keeper && !ch.data.quests.q_keeper.done, JSON.stringify(ups.map((u) => [u.id, u.text])));
}
{
  const ch = fresh([...story, "q_undercroft"]);
  ch.data.bossKills.push("warden", "aurelion");
  const ups = settleQuests(ch);
  check("an old save that already beat Aurelion only has to tell Eld", ch.data.quests.q_keeper?.stage === 1, JSON.stringify(ups.map((u) => [u.id, u.text])));
}

// 4. Missions still want fresh kills.
{
  const ch = fresh(story);
  const missions = (await import("@floors/shared")).QUESTS.filter((q) => q.mission && q.stages[0].kind === "kill");
  ch.data.bossKills.push(...missions.flatMap((q) => (q.stages[0].kind === "kill" ? q.stages[0].enemy : [])));
  const m = missions.find((q) => accept(ch, q.id) === undefined);
  if (m) {
    questEvent(ch, { kind: "talk", npc: "nobody" });
    check("a mission doesn't count old kills", ch.data.quests[m.id]?.stage === 0, m.id);
  }
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
