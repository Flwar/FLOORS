import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";

const px = (t: number) => t * TILE + TILE / 2;

/**
 * Floor 2's arrival point: Skyreach Landing, a golden terrace hanging in open sky.
 * The rest of Floor 2 is the next thing to build — this is the promise of it.
 */
export function buildFloor2Landing(): WorldMap {
  const W = 64;
  const H = 52;
  const m = new WorldMap(W, H);
  m.name = "Floor 2 — Skyreach Landing";
  m.fill(0, 0, W, H, Tile.Void);
  const cx = 32;
  const cy = 28;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - cx) / 20, (y - cy) / 15);
      const wob = Math.sin(x * 0.7) * 0.05 + Math.cos(y * 0.9) * 0.05;
      if (d < 1 + wob) m.set(x, y, d < 0.55 ? Tile.StoneFloor : d < 0.8 ? Tile.Flowers : Tile.Grass);
    }
  }
  // Cliff lip around the terrace.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (m.get(x, y) !== Tile.Void && (m.get(x, y + 1) === Tile.Void || m.get(x + 1, y) === Tile.Void || m.get(x - 1, y) === Tile.Void || m.get(x, y - 1) === Tile.Void)) m.set(x, y, Tile.Cliff);
  // A causeway reaching north toward the rest of Floor 2 — broken off, for now.
  m.fill(30, 4, 35, 14, Tile.StoneFloor);
  m.fill(29, 4, 30, 14, Tile.Cliff);
  m.fill(35, 4, 36, 14, Tile.Cliff);
  m.fill(30, 3, 35, 4, Tile.Cliff);
  for (const [x, y] of [[26, 22], [38, 22], [26, 34], [38, 34]]) m.fill(x, y, x + 1, y + 1, Tile.RuinWall);

  m.zones.push({ id: "skyreach", name: "Skyreach Landing", safe: true, x0: 0, y0: 0, x1: W, y1: H, music: "skyreach" });
  m.npcs.push({
    id: "herald",
    name: "Lumen, the Herald",
    role: "lore",
    x: px(32),
    y: px(24),
    look: { skin: "#f4e6c8", cloth: "#e8d8a8", trim: "#f0c860", hair: "#fff6d8", helm: "crown" },
    greeting: "You climbed. Few do. Beyond that broken causeway lie the Gilded Terraces — Floor 2 — and a Keeper far older than Aurelion. The bridge is being rebuilt. Rest, and look up: there are more Floors above than anyone has counted.",
  });
  m.objects.push({ id: "descent", kind: "gate", x: px(32), y: px(38), name: "The Descent", text: "The light leads back down to Emberwatch." });
  m.objects.push({ id: "lore-sky", kind: "lore", x: px(32), y: px(15), name: "Broken Causeway", text: "The stones end in open air. Far above, the silhouette of another Floor turns slowly through the clouds." });
  m.spawn = { x: px(32), y: px(32) };
  return m;
}
