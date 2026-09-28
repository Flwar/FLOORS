/**
 * Reachability (npm run reach): flood-fill every map from its spawn point on foot and check
 * that every NPC, object (chests, lore, waystones, doors) and enemy spawn can be reached.
 * Catches walls, palisades, props or scattered trees that seal an area off. Dungeon gates
 * are raised at runtime, so here every gate counts as open: the check is "reachable once solved".
 * Building doors count as paths: walking up to one takes you inside (and back out).
 */
import { applyGates, buildFloor1, buildFloor2, buildFloor3, buildRoost, buildStormspire, buildUndercroft, TILE, type GateDef, type WorldMap } from "@floors/shared";

let failures = 0;
let total = 0;

function reach(label: string, m: WorldMap) {
  const W = m.width;
  const H = m.height;
  const gated = m as WorldMap & { gates?: GateDef[] };
  if (gated.gates) applyGates(gated as WorldMap & { gates: GateDef[] }, 0xffff);
  const seen = new Uint8Array(W * H);
  const queue: number[] = [];
  const seed = (px: number, py: number) => {
    const i = Math.floor(py / TILE) * W + Math.floor(px / TILE);
    if (seen[i]) return;
    seen[i] = 1;
    queue.push(i);
  };
  const flood = () => {
    while (queue.length) {
      const i = queue.pop()!;
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (seen[j] || m.isSolidTile(nx, ny)) continue;
        seen[j] = 1;
        queue.push(j);
      }
    }
  };

  /** Reachable if the tile itself, or one next to it (for things set into walls), is. */
  const reachable = (px: number, py: number) => {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (seen[(ty + dy) * W + tx + dx]) return true;
    return false;
  };

  seed(m.spawn.x, m.spawn.y);
  flood();
  // Through doors, until nothing new opens up.
  for (let more = true; more; ) {
    more = false;
    for (const o of m.objects) {
      if (o.kind !== "entry" || !o.to || !reachable(o.x, o.y)) continue;
      const i = Math.floor(o.to.y / TILE) * W + Math.floor(o.to.x / TILE);
      if (seen[i]) continue;
      seed(o.to.x, o.to.y);
      flood();
      more = true;
    }
  }

  let bad = 0;
  const check = (what: string, x: number, y: number) => {
    if (reachable(x, y)) return;
    bad++;
    console.log(`FAIL  ${label}: ${what} at tile ${Math.floor(x / TILE)},${Math.floor(y / TILE)} can't be reached on foot`);
  };
  for (const n of m.npcs) check(`NPC ${n.id}`, n.x, n.y);
  for (const o of m.objects) check(`object ${o.id}`, o.x, o.y);
  for (const s of m.spawns) check(`spawn ${s.id}`, s.x, s.y);
  const n = m.npcs.length + m.objects.length + m.spawns.length;
  console.log(`${bad ? "FAIL" : "PASS"}  ${label} — ${n - bad}/${n} places reachable`);
  failures += bad;
  total += n;
}

reach("Floor 1", buildFloor1());
reach("The Undercroft", buildUndercroft());
reach("Floor 2", buildFloor2());
reach("The Stormspire", buildStormspire());
reach("Floor 3", buildFloor3());
reach("The Dragon's Roost", buildRoost());
console.log(failures ? `\n${failures} of ${total} places unreachable` : `\nall ${total} NPCs, objects and spawns are reachable on every map`);
process.exit(failures ? 1 : 0);
