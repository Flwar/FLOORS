import { TILE } from "../constants.ts";
import { Tile, type NpcDef, type WorldMap, type Zone } from "./map.ts";

/**
 * Building interiors. Every house in a town has a room you can walk into: its door on
 * the street takes you inside, and the doormat inside takes you back out. The rooms live
 * in a strip of extra rows below the world (out of sight), so they share the floor's room,
 * chat and parties — no loading, no separate server room.
 */

export type InteriorStyle = "shop" | "smithy" | "inn" | "vault" | "hall" | "library";

export interface InteriorSpec {
  /** The building (map.buildings id) this is the inside of. */
  building: string;
  style: InteriorStyle;
  /** NPCs who work inside: behind the counter, or where `at` says (floor tiles from the top-left). */
  npcs?: { id: string; at?: [number, number] }[];
  /** New NPCs who only exist indoors (e.g. an Archivist). */
  add?: (Omit<NpcDef, "x" | "y"> & { at?: [number, number] })[];
}

/** Void rows between the world and the interiors, so no room ever shows at the edge of the world. */
const GAP = 16;
const SIZE: Record<InteriorStyle, [number, number]> = { shop: [11, 7], smithy: [11, 7], inn: [13, 8], vault: [9, 6], hall: [13, 8], library: [11, 7] };
const px = (t: number) => t * TILE + TILE / 2;

export function addInteriors(m: WorldMap, specs: InteriorSpec[]) {
  const outdoor = m.height;
  const tallest = Math.max(...specs.map((s) => SIZE[s.style][1]));
  m.growRows(GAP + tallest + 6);
  m.outdoorHeight = outdoor;
  const oy = outdoor + GAP;
  let ox = 3;
  for (const spec of specs) {
    const b = m.buildings.find((q) => q.id === spec.building);
    if (!b) throw new Error(`no building ${spec.building}`);
    const [w, h] = SIZE[spec.style];
    if (ox + w + 2 >= m.width) throw new Error("interiors don't fit");
    // Walls: two rows at the back (you see the wall's face), one on the other sides.
    m.fill(ox, oy, ox + w + 2, oy + h + 3, Tile.IndoorWall);
    const stone = spec.style === "smithy" || spec.style === "vault";
    const fx = ox + 1;
    const fy = oy + 2;
    m.fill(fx, fy, fx + w, fy + h, stone ? Tile.StoneFloor : Tile.Floorboards);
    const cx = fx + Math.floor(w / 2);
    furnish(m, spec.style, fx, fy, w, h, cx);

    // The way in and the way out.
    const doorX = (b.tx + b.tw / 2) * TILE;
    const doorY = (b.ty + b.th) * TILE;
    const matX = (cx + 0.5) * TILE;
    const matY = (fy + h) * TILE;
    m.objects.push({ id: `enter-${b.id}`, kind: "entry", x: doorX, y: doorY + 10, name: b.name, to: { x: matX, y: matY - 22 } });
    m.objects.push({ id: `leave-${b.id}`, kind: "entry", x: matX, y: matY + 22, name: "the street", to: { x: doorX, y: doorY + 30 } });
    m.zones.push({ id: `in-${b.id}`, name: b.name, safe: true, indoor: true, x0: ox, y0: oy, x1: ox + w + 2, y1: oy + h + 3, music: spec.style === "inn" ? "inn" : "town" });

    // The people who work here.
    const place = (n: NpcDef, at?: [number, number]) => {
      if (!at) {
        // Behind the counter, close enough to talk across it.
        n.x = px(cx);
        n.y = (fy + 2) * TILE - 6;
      } else {
        n.x = px(fx + at[0]);
        n.y = px(fy + at[1]);
      }
    };
    for (const want of spec.npcs ?? []) {
      const n = m.npcs.find((q) => q.id === want.id);
      if (!n) throw new Error(`no npc ${want.id}`);
      place(n, want.at);
    }
    for (const add of spec.add ?? []) {
      const { at, ...def } = add;
      const n: NpcDef = { ...def, x: 0, y: 0 };
      place(n, at);
      m.npcs.push(n);
    }
    ox += w + 6;
  }
}

/** Furniture for each kind of room. (fx, fy): the top-left floor tile; cx: the middle column. */
function furnish(m: WorldMap, style: InteriorStyle, fx: number, fy: number, w: number, h: number, cx: number) {
  const r = fx + w - 1;
  const b = fy + h - 1;
  switch (style) {
    case "shop":
      m.prop("shelf", fx, fy, 2, 1, 0);
      m.prop("shelf", fx + 2, fy, 2, 1, 0);
      m.prop("shelf", r - 3, fy, 2, 1, 0);
      m.prop("shelf", r - 1, fy, 2, 1, 0);
      m.prop("counter", cx - 1, fy + 2, 3, 1, 0);
      m.prop("barrel", fx, b);
      m.prop("barrel", r, b, 1, 1, 1);
      m.prop("crates", fx, fy + 3);
      m.prop("sacks", r, fy + 3);
      m.prop("lamp", fx, fy + 1);
      break;
    case "smithy":
      m.prop("hearth", cx - 1, fy, 3, 1, 1);
      m.prop("rack", fx, fy);
      m.prop("rack", r, fy);
      m.prop("counter", cx - 1, fy + 2, 3, 1, 1);
      m.prop("anvil", cx + 3, fy + 2);
      m.prop("barrel", fx, fy + 3);
      m.prop("crates", r, b);
      m.prop("crates", fx, b, 1, 1, 1);
      break;
    case "inn":
      m.prop("shelf", fx, fy, 2, 1, 2);
      m.prop("hearth", cx - 1, fy, 3, 1, 0);
      m.prop("shelf", r - 1, fy, 2, 1, 2);
      m.prop("counter", cx - 1, fy + 2, 3, 1, 2);
      for (const [tx, ty] of [[fx + 1, fy + 4], [r - 2, fy + 4]] as const) {
        m.prop("table", tx, ty, 2, 1);
        m.prop("bench", tx, ty + 1, 2, 1);
      }
      m.prop("barrel", fx, fy + 2);
      m.prop("barrel", r, fy + 2, 1, 1, 1);
      break;
    case "vault":
      m.prop("shelf", fx, fy, 2, 1, 0);
      m.prop("shelf", r - 1, fy, 2, 1, 0);
      m.prop("counter", cx - 1, fy + 2, 3, 1, 1);
      m.prop("crates", fx, b);
      m.prop("crates", r, b, 1, 1, 1);
      m.prop("barrel", fx, fy + 3);
      break;
    case "library":
      for (const x of [fx, fx + 2, r - 3, r - 1]) m.prop("shelf", x, fy, 2, 1, 1);
      m.prop("counter", cx - 1, fy + 2, 3, 1, 3);
      m.prop("table", fx + 1, b - 1, 2, 1);
      m.prop("bench", fx + 1, b, 2, 1);
      m.prop("lamp", r, b - 1);
      m.prop("planter", r, fy + 2);
      break;
    case "hall":
      m.prop("hearth", cx - 1, fy, 3, 1, 0);
      m.prop("rack", fx, fy);
      m.prop("rack", r, fy);
      for (const [tx, ty] of [[fx + 1, fy + 3], [r - 2, fy + 3], [fx + 1, b - 1], [r - 2, b - 1]] as const) {
        m.prop("table", tx, ty, 2, 1);
        m.prop("bench", tx, ty + 1, 2, 1);
      }
      m.prop("lamp", fx, b);
      m.prop("lamp", r, b);
      break;
  }
}

/** The building interior at a point, if it is inside one. */
export function interiorAt(m: WorldMap, x: number, y: number): Zone | undefined {
  if (!m.indoors(y)) return undefined;
  const z = m.zoneAt(x, y);
  return z?.indoor ? z : undefined;
}

/** Where a point is, as seen from the street: inside a building means at its door. */
export function streetPoint(m: WorldMap, x: number, y: number): { x: number; y: number } {
  const z = interiorAt(m, x, y);
  const door = z ? m.object(`enter-${z.id.slice(3)}`) : undefined;
  return door ? { x: door.x, y: door.y } : { x, y };
}

/** The next place to walk to on the way from (x, y) to (tx, ty): out of one building, into another. */
export function routeVia(m: WorldMap, x: number, y: number, tx: number, ty: number): { x: number; y: number } {
  const from = interiorAt(m, x, y);
  const to = interiorAt(m, tx, ty);
  if (from?.id === to?.id) return { x: tx, y: ty };
  const via = from ? m.object(`leave-${from.id.slice(3)}`) : m.object(`enter-${to!.id.slice(3)}`);
  return via ? { x: via.x, y: via.y } : { x: tx, y: ty };
}
