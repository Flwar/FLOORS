import { TILE } from "../constants.ts";

export const Tile = {
  Grass: 0,
  Path: 1,
  Cobble: 2,
  Wall: 3,
  Tree: 4,
  Water: 5,
  House: 6,
  Flowers: 7,
  TallGrass: 8,
  Void: 9,
  Rock: 10,
  CaveFloor: 11,
  Sand: 12,
  RuinWall: 13,
  Palisade: 14,
  Fence: 15,
  Cliff: 16,
  Crystal: 17,
  StoneFloor: 18,
  /** Dungeon portcullis (solid while closed). */
  Gate: 19,
  /** Tilled farm rows (walkable). */
  Crop: 20,
  /** A placed prop (stall, barrel, bench…): solid; see WorldMap.props for what it is. */
  Prop: 21,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

const SOLID = new Set<number>([Tile.Wall, Tile.Tree, Tile.Water, Tile.House, Tile.Void, Tile.Rock, Tile.RuinWall, Tile.Palisade, Tile.Fence, Tile.Cliff, Tile.Crystal, Tile.Gate, Tile.Prop]);

export type PropKind = "stall" | "barrel" | "crates" | "bench" | "lamp" | "planter" | "board" | "hay" | "cart" | "rack" | "anvil" | "well" | "logs" | "sacks";

/** Town furniture and clutter. The footprint is solid; `under` is the ground it stands on. */
export interface PropDef {
  kind: PropKind;
  tx: number;
  ty: number;
  tw: number;
  th: number;
  under: number;
  variant: number;
}

export interface Zone {
  id: string;
  name: string;
  safe: boolean;
  /** Tile-space rectangle, inclusive of x0/y0, exclusive of x1/y1. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Enemy level range shown to players. */
  level?: [number, number];
  /** Hidden areas are announced as discoveries. */
  secret?: boolean;
  dark?: boolean;
  music?: string;
}

export interface Building {
  id: string;
  name: string;
  tx: number;
  ty: number;
  tw: number;
  th: number;
}

export interface SpawnDef {
  id: string;
  /** World pixels. */
  x: number;
  y: number;
  radius: number;
  enemies: string[];
  /** Seconds before a killed member respawns. */
  respawn: number;
  /** Chance for each spawn to be an elite. */
  elite: number;
  level: number;
}

export type NpcRole = "store" | "smith" | "storage" | "guild" | "inn" | "gate" | "lore" | "merchant" | "tanner" | "scholar";

export interface NpcDef {
  id: string;
  name: string;
  role: NpcRole;
  /** World pixels. */
  x: number;
  y: number;
  look: { skin: string; cloth: string; trim: string; hair: string; helm?: "none" | "hood" | "cap" | "helm" | "crown" };
  greeting: string;
  /** Which shop this NPC sells from (defaults by role: "store", "smith"). */
  shop?: string;
}

export type ObjectKind = "chest" | "lore" | "waystone" | "door" | "gate" | "campfire" | "lever";

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  name: string;
  /** Chest contents / lore text / destination. */
  loot?: { key: string; rarity?: number; qty?: number }[];
  gold?: number;
  text?: string;
  requires?: string;
  /** Gates and doors: where they lead ("world", "floor2", "floor3", "dungeon", "stormspire"). */
  dest?: string;
}

export class WorldMap {
  readonly tiles: Uint8Array;
  readonly zones: Zone[] = [];
  readonly buildings: Building[] = [];
  readonly spawns: SpawnDef[] = [];
  readonly npcs: NpcDef[] = [];
  readonly objects: WorldObject[] = [];
  readonly props: PropDef[] = [];
  spawn = { x: 0, y: 0 };
  name = "";

  constructor(readonly width: number, readonly height: number) {
    this.tiles = new Uint8Array(width * height);
  }

  get(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return Tile.Void;
    return this.tiles[ty * this.width + tx];
  }

  set(tx: number, ty: number, id: number): void {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return;
    this.tiles[ty * this.width + tx] = id;
  }

  /** Place a prop, making its footprint solid. */
  prop(kind: PropKind, tx: number, ty: number, tw = 1, th = 1, variant = 0): void {
    this.props.push({ kind, tx, ty, tw, th, under: this.get(tx, ty), variant });
    this.fill(tx, ty, tx + tw, ty + th, Tile.Prop);
  }

  /** The ground at a tile, looking through props. */
  ground(tx: number, ty: number): number {
    const t = this.get(tx, ty);
    if (t !== Tile.Prop) return t;
    const pr = this.props.find((q) => tx >= q.tx && tx < q.tx + q.tw && ty >= q.ty && ty < q.ty + q.th);
    return pr ? pr.under : Tile.Cobble;
  }

  fill(x0: number, y0: number, x1: number, y1: number, id: number): void {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(x, y, id);
  }

  isSolidTile(tx: number, ty: number): boolean {
    return SOLID.has(this.get(tx, ty));
  }

  /** True if an axis-aligned box centred at (x, y) overlaps any solid tile. */
  boxBlocked(x: number, y: number, hw: number, hh: number): boolean {
    const x0 = Math.floor((x - hw) / TILE);
    const x1 = Math.floor((x + hw - 1e-3) / TILE);
    const y0 = Math.floor((y - hh) / TILE);
    const y1 = Math.floor((y + hh - 1e-3) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isSolidTile(tx, ty)) return true;
      }
    }
    return false;
  }

  zoneAt(px: number, py: number): Zone | undefined {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    // Later zones are more specific (a camp inside a forest), so search backwards.
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (tx >= z.x0 && tx < z.x1 && ty >= z.y0 && ty < z.y1) return z;
    }
    return undefined;
  }

  object(id: string) {
    return this.objects.find((o) => o.id === id);
  }
}
