/**
 * Reachability (npm run reach): flood-fill every map from its spawn point on foot and check
 * that every NPC, object (chests, lore, waystones, doors) and enemy spawn can be reached.
 * Catches walls, palisades, props or scattered trees that seal an area off. Dungeon gates
 * are raised at runtime, so here every gate counts as open: the check is "reachable once solved".
 */
import { buildFloor1, buildFloor2, buildStormspire, buildUndercroft, TILE, type WorldMap } from "@floors/shared";

let failures = 0;
let total = 0;

function reach(label: string, m: WorldMap) {
  const W = m.width;
  const H = m.height;
  const seen = new Uint8Array(W * H);
  const sx = Math.floor(m.spawn.x / TILE);
  const sy = Math.floor(m.spawn.y / TILE);
  const queue: number[] = [sy * W + sx];
  seen[sy * W + sx] = 1;
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

  /** Reachable if the tile itself, or one next to it (for things set into walls), is. */
  const reachable = (px: number, py: number) => {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (seen[(ty + dy) * W + tx + dx]) return true;
    return false;
  };

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
console.log(failures ? `\n${failures} of ${total} places unreachable` : `\nall ${total} NPCs, objects and spawns are reachable on every map`);
process.exit(failures ? 1 : 0);
