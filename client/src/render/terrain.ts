import type * as Phaser from "phaser";
import { Tile, TILE, type Building, type PropDef, type WorldMap } from "@floors/shared";
import { RES, shade } from "../art/characters.ts";
import { propTexture } from "../art/props.ts";

const CHUNK = 16; // tiles
const CHUNK_PX = CHUNK * TILE;
/** Each Terrain paints its ground under its own texture keys: travelling rebuilds the scene
 * with a different map, and a chunk cached from the last one must never be reused. */
let terrainSeq = 0;

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface Palette {
  grass: string;
  grassDark: string;
  grassLight: string;
}
const MEADOW: Palette = { grass: "#6fae52", grassDark: "#5a9443", grassLight: "#86c264" };
const FOREST: Palette = { grass: "#4f8c45", grassDark: "#3f7438", grassLight: "#62a055" };
/** Floor 2: sun-gilded meadows. */
const GILDED: Palette = { grass: "#9db85a", grassDark: "#86a04a", grassLight: "#b6cc6e" };
/** Floor 3: ash over black rock. */
const EMBER: Palette = { grass: "#5c534b", grassDark: "#463e38", grassLight: "#746a61" };
/** Floor 4: deep snow. */
const SNOW: Palette = { grass: "#e4ecf2", grassDark: "#c6d4e0", grassLight: "#f7fbfe" };
/** Floor 5: dusk-blue moss under a starless sky. */
const DUSK: Palette = { grass: "#3b4468", grassDark: "#2f3656", grassLight: "#4c5782" };
/** Floor 6: sea-grass over pale sand. */
const SEAGRASS: Palette = { grass: "#7fbf8f", grassDark: "#68a878", grassLight: "#9ad4a6" };
let PATH = "#cfae72";
const COBBLE = "#9b968b";
const WATER = "#3f86c0";
const SAND = "#d8c08a";
/** Flagstone colour; Floor 2 is built from warm golden stone. */
let STONE = "#a89f8c";
const CAVE = "#4a4e57";
const ROCK = "#5b5f69";
const SKY_TOP = "#9ccbe8";

const RAISED = new Set<number>([Tile.Tree, Tile.Wall, Tile.RuinWall, Tile.Palisade, Tile.Fence, Tile.Crystal, Tile.Gate, Tile.IndoorWall]);
const FLOORBOARD = "#9a6a3e";
const INDOOR_DARK = "#17120e";

interface ChunkView {
  cx: number;
  cy: number;
  ground: Phaser.GameObjects.Image;
  decor: Phaser.GameObjects.GameObject[];
  /** Tall occluders that fade when a character walks behind them. */
  tall: Phaser.GameObjects.Image[];
  texKey: string;
}

/**
 * Streams the world in 16×16-tile chunks around the camera: each chunk's ground is
 * painted once into a canvas (soft organic edges, detail scatter) and its tall
 * objects become y-sorted sprites. Far chunks are destroyed to bound memory.
 */
export class Terrain {
  private chunks = new Map<string, ChunkView>();
  private buildingsByChunk = new Map<string, Building[]>();
  private propsByChunk = new Map<string, PropDef[]>();
  private forestRect?: { x0: number; y0: number; x1: number; y1: number };
  private readonly tag = `t${++terrainSeq}`;

  constructor(private scene: Phaser.Scene, private map: WorldMap) {
    for (const b of map.buildings) {
      const k = `${Math.floor(b.tx / CHUNK)},${Math.floor((b.ty + b.th - 1) / CHUNK)}`;
      if (!this.buildingsByChunk.has(k)) this.buildingsByChunk.set(k, []);
      this.buildingsByChunk.get(k)!.push(b);
    }
    for (const pr of map.props) {
      const k = `${Math.floor(pr.tx / CHUNK)},${Math.floor((pr.ty + pr.th - 1) / CHUNK)}`;
      if (!this.propsByChunk.has(k)) this.propsByChunk.set(k, []);
      this.propsByChunk.get(k)!.push(pr);
    }
    this.forestRect = map.zones.find((z) => z.id === "whisperwood");
    STONE = map.theme === "gilded" || map.theme === "storm" ? "#e2cd92" : "#a89f8c";
    this.gilded = map.theme === "gilded";
    this.ember = map.theme === "ember";
    this.frost = map.theme === "frost";
    this.shadow = map.theme === "shadow";
    this.tide = map.theme === "tide";
    if (this.ember) STONE = "#6a625c";
    if (this.frost) STONE = "#a3b2c0";
    if (this.shadow) STONE = "#5c586e";
    if (this.tide) STONE = "#b8c4bc";
    PATH = this.ember ? "#8a7866" : this.frost ? "#c3ced8" : this.shadow ? "#6c6882" : this.tide ? "#e6d7a8" : "#cfae72";
    paintSprites(scene, map);
    scene.events.once("shutdown", () => {
      for (const [k, c] of [...this.chunks]) this.unload(k, c);
    });
  }

  /** Fade trees and roofs standing between the camera and a character behind them. */
  fadeOccluders(points: { x: number; y: number }[], dtMs: number) {
    const k = Math.min(1, dtMs / 120);
    for (const c of this.chunks.values()) {
      for (const img of c.tall) {
        const b = img.getBounds();
        let hide = false;
        for (const p of points) {
          if (p.y < img.y && p.x > b.x + 4 && p.x < b.right - 4 && p.y > b.y + 6) {
            hide = true;
            break;
          }
        }
        const target = hide ? 0.38 : 1;
        if (img.alpha !== target) img.setAlpha(img.alpha + (target - img.alpha) * k);
      }
    }
  }

  update(cam: Phaser.Cameras.Scene2D.Camera) {
    const view = cam.worldView;
    const x0 = Math.floor((view.x - 64) / CHUNK_PX);
    const y0 = Math.floor((view.y - 64) / CHUNK_PX);
    const x1 = Math.floor((view.right + 64) / CHUNK_PX);
    const y1 = Math.floor((view.bottom + 160) / CHUNK_PX);
    const want = new Set<string>();
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= this.map.width || cy * CHUNK >= this.map.height) continue;
        const k = `${cx},${cy}`;
        want.add(k);
        if (!this.chunks.has(k)) this.load(cx, cy);
      }
    }
    for (const [k, c] of this.chunks) {
      if (want.has(k)) continue;
      if (c.cx >= x0 - 1 && c.cx <= x1 + 1 && c.cy >= y0 - 1 && c.cy <= y1 + 1) continue;
      this.unload(k, c);
    }
  }

  /** Repaint the chunk containing a tile (dynamic tiles such as dungeon gates). */
  invalidate(tx: number, ty: number) {
    const k = `${Math.floor(tx / CHUNK)},${Math.floor(ty / CHUNK)}`;
    const c = this.chunks.get(k);
    if (c) this.unload(k, c);
  }

  get loadedChunks() {
    return this.chunks.size;
  }

  private gilded = false;
  /** Floor 3: ash for grass, lava for water, charred trees. */
  private ember = false;
  /** Floor 4: snow for grass, ice for water, snowy pines. */
  private frost = false;
  /** Floor 5: dusk moss for grass, black water full of stars, shadow-oaks, moon shards. */
  private shadow = false;
  /** Floor 6: sea-grass over sand, clear turquoise water, palms, coral. */
  private tide = false;

  private palette(tx: number, ty: number): Palette {
    if (this.gilded) return GILDED;
    if (this.ember) return EMBER;
    if (this.frost) return SNOW;
    if (this.shadow) return DUSK;
    if (this.tide) return SEAGRASS;
    const f = this.forestRect;
    if (f && tx >= f.x0 && tx < f.x1 && ty >= f.y0 && ty < f.y1) {
      const edge = Math.min(tx - f.x0, ty - f.y0, f.x1 - tx, f.y1 - ty);
      if (edge > 3) return FOREST;
    }
    return MEADOW;
  }

  private load(cx: number, cy: number) {
    const key = `ground:${this.tag}:${cx},${cy}`;
    if (!this.scene.textures.exists(key)) this.paintChunk(cx, cy, key);
    // A hair of overlap hides seams between chunks at fractional camera positions.
    const ground = this.scene.add.image(cx * CHUNK_PX, cy * CHUNK_PX, key).setOrigin(0).setDisplaySize(CHUNK_PX + 0.75, CHUNK_PX + 0.75).setDepth(-10);
    const decor: Phaser.GameObjects.GameObject[] = [];
    const tall: Phaser.GameObjects.Image[] = [];
    const m = this.map;
    const add = (x: number, y: number, tex: string, ox: number, oy: number, scale = 1) =>
      decor.push(this.scene.add.image(x, y, tex).setOrigin(ox, oy).setScale(scale / RES).setDepth(y));
    for (let ty = cy * CHUNK; ty < Math.min(m.height, (cy + 1) * CHUNK); ty++) {
      for (let tx = cx * CHUNK; tx < Math.min(m.width, (cx + 1) * CHUNK); tx++) {
        const id = m.get(tx, ty);
        if (!RAISED.has(id)) continue;
        const bottom = ty * TILE + TILE;
        switch (id) {
          case Tile.Tree: {
            const forest = this.palette(tx, ty) === FOREST;
            const variant = Math.floor(hash(tx, ty, 3) * 3) + (this.tide ? 18 : this.shadow ? 15 : this.frost ? 12 : this.ember ? 9 : this.gilded ? 6 : forest ? 3 : 0);
            add(tx * TILE + TILE / 2 + (hash(tx, ty, 4) - 0.5) * 8, bottom - 3, `tree${variant}`, 0.5, 0.94, 0.9 + hash(tx, ty, 5) * 0.35);
            tall.push(decor[decor.length - 1] as Phaser.GameObjects.Image);
            break;
          }
          case Tile.Wall:
            add(tx * TILE, bottom, m.get(tx, ty + 1) !== Tile.Wall ? "wallFront" : "wallTop", 0, 1);
            break;
          case Tile.RuinWall:
            add(tx * TILE, bottom, `ruin${(this.shadow ? 3 : 0) + Math.floor(hash(tx, ty, 6) * 3)}`, 0, 1);
            break;
          case Tile.Palisade:
            add(tx * TILE, bottom, "palisade", 0, 1);
            break;
          case Tile.Fence:
            add(tx * TILE, bottom, m.get(tx - 1, ty) === Tile.Fence || m.get(tx + 1, ty) === Tile.Fence ? "fenceH" : "fenceV", 0, 1);
            break;
          case Tile.Crystal:
            add(tx * TILE + TILE / 2, bottom, `crystal${(this.tide ? 4 : this.shadow ? 2 : 0) + Math.floor(hash(tx, ty, 7) * 2)}`, 0.5, 1);
            break;
          case Tile.Gate:
            add(tx * TILE, bottom, "portcullis", 0, 1);
            break;
          case Tile.IndoorWall: {
            // The face of a wall shows only where it looks into a room.
            const below = m.get(tx, ty + 1);
            if (below === Tile.Floorboards || below === Tile.StoneFloor || below === Tile.Prop) add(tx * TILE, bottom, `inWall${Math.floor(hash(tx, ty, 8) * 3)}`, 0, 1);
            break;
          }
        }
      }
    }
    for (const b of this.buildingsByChunk.get(`${cx},${cy}`) ?? []) {
      const bottom = (b.ty + b.th) * TILE;
      decor.push(this.scene.add.image(b.tx * TILE, bottom, `building:${b.id}`).setOrigin(0, 1).setScale(1 / RES).setDepth(bottom));
      decor.push(
        this.scene.add
          .text((b.tx + b.tw / 2) * TILE, bottom - b.th * TILE - 16, b.name, { fontFamily: "Georgia, serif", fontSize: "18px", color: "#fff4d6", stroke: "#1d1a17", strokeThickness: 4 })
          .setOrigin(0.5, 1)
          .setScale(0.5)
          .setDepth(bottom + 1),
      );
    }
    for (const pr of this.propsByChunk.get(`${cx},${cy}`) ?? []) {
      const { key: pk, padX } = propTexture(this.scene, pr);
      const bottom = (pr.ty + pr.th) * TILE;
      const img = this.scene.add.image(pr.tx * TILE - padX, bottom + 4, pk).setOrigin(0, 1).setScale(1 / RES).setDepth(bottom - 2);
      decor.push(img);
      if (pr.kind === "lamp" || pr.kind === "well" || pr.kind === "stall" || pr.kind === "board" || pr.kind === "rack") tall.push(img);
    }
    for (const d of decor) if (d instanceof Object && (d as Phaser.GameObjects.Image).texture?.key?.startsWith("building:")) tall.push(d as Phaser.GameObjects.Image);
    this.chunks.set(`${cx},${cy}`, { cx, cy, ground, decor, tall, texKey: key });
  }

  private unload(k: string, c: ChunkView) {
    c.ground.destroy();
    for (const d of c.decor) d.destroy();
    this.chunks.delete(k);
    this.scene.textures.remove(c.texKey);
  }

  // ---------------------------------------------------------------------------

  private paintChunk(cx: number, cy: number, key: string) {
    const size = CHUNK_PX * RES;
    const tex = this.scene.textures.createCanvas(key, size, size)!;
    const g = tex.getContext();
    const m = this.map;
    const T = TILE * RES;
    const ox = cx * CHUNK;
    const oy = cy * CHUNK;
    const px = (tx: number) => (tx - ox) * T;
    const py = (ty: number) => (ty - oy) * T;
    const id = (tx: number, ty: number) => m.ground(tx, ty);
    const is = (tx: number, ty: number, ...ids: number[]) => ids.includes(m.ground(tx, ty));
    const range = (fn: (tx: number, ty: number) => void) => {
      for (let ty = oy - 1; ty <= oy + CHUNK; ty++) for (let tx = ox - 1; tx <= ox + CHUNK; tx++) fn(tx, ty);
    };
    const disc = (tx: number, ty: number, r: number, color: string) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(px(tx) + T / 2, py(ty) + T / 2, T * r, 0, Math.PI * 2);
      g.fill();
    };
    const isLand = (tx: number, ty: number) => !is(tx, ty, Tile.Void);

    // Below the world, around the building interiors, there is only darkness.
    range((tx, ty) => {
      if (ty < m.outdoorHeight || !is(tx, ty, Tile.Void, Tile.IndoorWall)) return;
      g.fillStyle = INDOOR_DARK;
      g.fillRect(px(tx) - 1, py(ty) - 1, T + 2, T + 2);
    });
    // Void tiles stay transparent: the parallax sky shows through beneath the island.
    // The island's rocky underside hangs into the sky beneath southern edges.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Void) || ty >= m.outdoorHeight) return;
      let depth = 0;
      for (let k = 1; k <= 4; k++) if (isLand(tx, ty - k)) {
        depth = k;
        break;
      }
      if (!depth) return;
      const x = px(tx);
      const y = py(ty);
      const hang = (4 - depth + hash(tx, 0, 94) * 1.5) / 4;
      if (hang <= 0) return;
      const grad = g.createLinearGradient(0, y - T * (depth - 1), 0, y + T * hang);
      grad.addColorStop(0, "#6b5440");
      grad.addColorStop(1, "rgba(80,62,48,0)");
      g.fillStyle = grad;
      g.fillRect(x - 1, y, T + 2, T * hang);
    });

    // Land base colour per tile.
    range((tx, ty) => {
      const t = id(tx, ty);
      if (t === Tile.Void) return;
      const x = px(tx);
      const y = py(ty);
      let color: string;
      switch (t) {
        case Tile.Sand:
          color = SAND;
          break;
        case Tile.StoneFloor:
        case Tile.RuinWall:
          color = is(tx, ty, Tile.RuinWall) && !is(tx, ty + 1, Tile.StoneFloor) ? SAND : STONE;
          break;
        case Tile.CaveFloor:
        case Tile.Rock:
        case Tile.Crystal:
          color = this.ember ? "#3a3230" : this.frost ? "#7d8c9c" : this.shadow ? "#2c2838" : this.tide ? "#6a7a78" : ROCK;
          break;
        case Tile.Cliff:
          color = "#8a6e52";
          break;
        case Tile.Crop:
          color = "#8a6a45";
          break;
        case Tile.Floorboards:
          color = FLOORBOARD;
          break;
        case Tile.IndoorWall:
          color = "#3a2c22";
          break;
        default:
          color = this.palette(tx, ty).grass;
      }
      g.fillStyle = color;
      g.fillRect(x, y, T, T);
    });
    // Grass tone: big soft blotches of light and shade, seeded on a coarse grid and drawn
    // from a margin around the chunk so neighbouring chunks agree at their seams.
    const grassy = [Tile.Grass, Tile.Tree, Tile.TallGrass, Tile.Flowers, Tile.Fence, Tile.Palisade];
    const blotch = (step: number, seed: number, alpha: number, cobble: boolean) => {
      const gx0 = Math.floor((ox - 5) / step) * step;
      const gy0 = Math.floor((oy - 5) / step) * step;
      for (let gy = gy0; gy <= oy + CHUNK + 5; gy += step) {
        for (let gx = gx0; gx <= ox + CHUNK + 5; gx += step) {
          const cxT = gx + hash(gx, gy, seed) * step;
          const cyT = gy + hash(gx, gy, seed + 1) * step;
          if (hash(gx, gy, seed + 4) > 0.65) continue;
          const tt = id(Math.floor(cxT), Math.floor(cyT));
          if (cobble ? tt !== Tile.Cobble : !grassy.includes(tt as never)) continue;
          const r = (1.4 + hash(gx, gy, seed + 2) * 2.2) * T;
          const dark = hash(gx, gy, seed + 3) < 0.55;
          const col = cobble ? (dark ? "58,52,44" : "236,228,210") : (() => {
            const pal = this.palette(Math.floor(cxT), Math.floor(cyT));
            const c = parseInt((dark ? pal.grassDark : pal.grassLight).slice(1), 16);
            return `${(c >> 16) & 255},${(c >> 8) & 255},${c & 255}`;
          })();
          const x = (cxT - ox) * T;
          const y = (cyT - oy) * T;
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, `rgba(${col},${alpha})`);
          gr.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = gr;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
      }
    };
    blotch(4, 101, 0.55, false);
    blotch(7, 111, 0.35, false);

    // Sand dunes and flagstones.
    range((tx, ty) => {
      const x = px(tx);
      const y = py(ty);
      if (is(tx, ty, Tile.Sand)) {
        g.strokeStyle = "rgba(160,120,70,0.25)";
        g.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          const ry = y + (0.25 + i * 0.4 + hash(tx, ty, 20 + i) * 0.2) * T;
          g.beginPath();
          g.moveTo(x + 4, ry);
          g.quadraticCurveTo(x + T / 2, ry - 5, x + T - 4, ry);
          g.stroke();
        }
      } else if (is(tx, ty, Tile.StoneFloor)) {
        g.fillStyle = shade(STONE, -30);
        g.fillRect(x, y, T, T);
        const split = hash(tx, ty, 21) < 0.5;
        const tiles: [number, number, number, number][] = split ? [[0, 0, T, T / 2], [0, T / 2, T, T / 2]] : [[0, 0, T / 2, T], [T / 2, 0, T / 2, T]];
        for (const [sx, sy, sw, sh] of tiles) {
          g.fillStyle = shade(STONE, Math.round((hash(tx * 2 + sx, ty * 2 + sy, 22) - 0.5) * 24));
          g.beginPath();
          g.roundRect(x + sx + 2, y + sy + 2, sw - 4, sh - 4, 4);
          g.fill();
        }
        if (hash(tx, ty, 23) < 0.25) {
          g.strokeStyle = "rgba(60,50,40,0.5)";
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(x + hash(tx, ty, 24) * T, y + 4);
          g.lineTo(x + hash(tx, ty, 25) * T, y + T / 2);
          g.lineTo(x + hash(tx, ty, 26) * T, y + T - 4);
          g.stroke();
        }
        if (hash(tx, ty, 27) < 0.3) {
          // Moss on old flagstones; soot and a live cinder in the Ember Reaches.
          g.fillStyle = this.ember ? (hash(tx, ty, 31) < 0.25 ? "rgba(255,120,40,0.45)" : "rgba(30,22,18,0.45)") : this.frost ? "rgba(255,255,255,0.7)" : this.shadow ? "rgba(150,110,220,0.3)" : this.tide ? "rgba(90,170,150,0.45)" : "rgba(90,140,70,0.55)";
          g.beginPath();
          g.arc(x + hash(tx, ty, 28) * T, y + hash(tx, ty, 29) * T, 5 + hash(tx, ty, 30) * 6, 0, Math.PI * 2);
          g.fill();
        }
      } else if (is(tx, ty, Tile.CaveFloor)) {
        for (let i = 0; i < 4; i++) {
          g.fillStyle = hash(tx, ty, 31 + i) < 0.5 ? "#3f434b" : "#565b64";
          g.beginPath();
          g.arc(x + hash(tx, ty, 35 + i) * T, y + hash(tx, ty, 39 + i) * T, 2 + hash(tx, ty, 43 + i) * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    });

    // Floorboards: long planks, staggered joints, knots, and a warm sheen.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Floorboards)) return;
      const x = px(tx);
      const y = py(ty);
      const plank = T / 4;
      for (let r = 0; r < 4; r++) {
        const tone = Math.round((hash(tx, ty * 4 + r, 60) - 0.5) * 22);
        g.fillStyle = shade(FLOORBOARD, tone);
        g.fillRect(x, y + r * plank + 1, T, plank - 2);
        g.fillStyle = "rgba(40,24,12,0.55)";
        g.fillRect(x, y + r * plank + plank - 1, T, 2);
        if (hash(tx, ty * 4 + r, 61) < 0.35) g.fillRect(x + Math.floor(hash(tx, ty * 4 + r, 62) * (T - 4)), y + r * plank, 2, plank);
        if (hash(tx, ty * 4 + r, 63) < 0.08) {
          g.fillStyle = "rgba(60,36,18,0.6)";
          g.beginPath();
          g.ellipse(x + hash(tx, ty, 64 + r) * T, y + r * plank + plank / 2, 4, 2, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Walls cast a soft shadow onto the floor below them.
      if (is(tx, ty - 1, Tile.IndoorWall)) {
        const sh = g.createLinearGradient(0, y, 0, y + T * 0.6);
        sh.addColorStop(0, "rgba(20,12,6,0.45)");
        sh.addColorStop(1, "rgba(20,12,6,0)");
        g.fillStyle = sh;
        g.fillRect(x, y, T, T * 0.6);
      }
    });
    // Tops of indoor walls: dark timber, with a lighter edge where they meet a floor.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.IndoorWall)) return;
      const x = px(tx);
      const y = py(ty);
      g.fillStyle = "#2e231b";
      g.fillRect(x, y, T, T);
      g.fillStyle = "#4a382a";
      for (const [dx, dy, w, h] of [[0, 0, T, 4], [0, T - 4, T, 4], [0, 0, 4, T], [T - 4, 0, 4, T]] as const) {
        const [nx, ny] = dy === 0 && h === 4 ? [0, -1] : dy > 0 ? [0, 1] : dx === 0 ? [-1, 0] : [1, 0];
        if (!is(tx + nx, ty + ny, Tile.IndoorWall, Tile.Void)) g.fillRect(x + dx, y + dy, w, h);
      }
    });

    // Dirt paths: union of circles gives rounded, organic edges.
    range((tx, ty) => {
      if (is(tx, ty, Tile.Path)) disc(tx, ty, 0.78, shade(PATH, -22));
    });
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Path)) return;
      disc(tx, ty, 0.68, PATH);
      g.fillRect(px(tx) + T * 0.1, py(ty) + T * 0.1, T * 0.8, T * 0.8);
    });

    // Cobble: paved, squared, with individual stones.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Cobble, Tile.House, Tile.Wall)) return;
      g.fillStyle = shade(COBBLE, -34);
      g.fillRect(px(tx) - 2, py(ty) - 2, T + 4, T + 4);
    });
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Cobble, Tile.House)) return;
      const x = px(tx);
      const y = py(ty);
      g.fillStyle = shade(COBBLE, -18);
      g.fillRect(x, y, T, T);
      for (let r = 0; r < 4; r++) {
        const off = (r + ty) % 2 ? T / 8 : 0;
        for (let c = -1; c < 4; c++) {
          const n = hash(tx * 4 + c, ty * 4 + r, 2);
          g.fillStyle = n < 0.3 ? shade(COBBLE, -8) : n > 0.75 ? shade(COBBLE, 14) : COBBLE;
          g.beginPath();
          g.roundRect(x + c * (T / 4) + off + 2, y + r * (T / 4) + 2, T / 4 - 4, T / 4 - 4, 3);
          g.fill();
        }
      }
    });

    blotch(4, 121, 0.16, true);
    // Scattered straw, leaves and missing stones on the paving.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Cobble)) return;
      const x = px(tx);
      const y = py(ty);
      const r = hash(tx, ty, 131);
      if (r < 0.06) {
        g.fillStyle = "#6f6a60";
        g.beginPath();
        g.roundRect(x + hash(tx, ty, 132) * (T - 16), y + hash(tx, ty, 133) * (T - 16), 14, 12, 3);
        g.fill();
      } else if (r < 0.14) {
        g.strokeStyle = hash(tx, ty, 134) < 0.5 ? "rgba(214,180,90,0.8)" : "rgba(120,150,70,0.7)";
        g.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
          const sx = x + hash(tx, ty, 135 + i) * T;
          const sy = y + hash(tx, ty, 138 + i) * T;
          const a = hash(tx, ty, 141 + i) * Math.PI;
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(sx + Math.cos(a) * 7, sy + Math.sin(a) * 7);
          g.stroke();
        }
      }
      // Moss creeping in along walls and house fronts.
      if (is(tx, ty - 1, Tile.Wall, Tile.House) || is(tx - 1, ty, Tile.Wall) || is(tx + 1, ty, Tile.Wall)) {
        for (let i = 0; i < 3; i++) {
          if (hash(tx, ty, 150 + i) < 0.4) continue;
          g.fillStyle = "rgba(96,140,72,0.45)";
          g.beginPath();
          g.arc(x + hash(tx, ty, 153 + i) * T, y + hash(tx, ty, 156 + i) * T * 0.5, 3 + hash(tx, ty, 159 + i) * 5, 0, Math.PI * 2);
          g.fill();
        }
      }
    });

    // Farm rows: tilled soil with crops; each plot grows one thing.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Crop)) return;
      const x = px(tx);
      const y = py(ty);
      g.fillStyle = "#6f5236";
      for (const fy of [0.3, 0.8]) g.fillRect(x, y + T * fy - 3, T, 6);
      // One crop per fenced plot: identify the plot by its top-left corner.
      let lx = tx;
      let ly = ty;
      while (is(lx - 1, ty, Tile.Crop)) lx--;
      while (is(tx, ly - 1, Tile.Crop)) ly--;
      const kind = Math.floor(hash(lx, ly, 170) * 3);
      for (const fy of [0.3, 0.8]) {
        for (let i = 0; i < 4; i++) {
          const cxp = x + (i + 0.5) * (T / 4) + (hash(tx * 4 + i, ty, 171) - 0.5) * 4;
          const cyp = y + T * fy;
          if (kind === 0) {
            // Wheat.
            g.strokeStyle = "#b8963e";
            g.lineWidth = 2;
            for (const dx of [-3, 0, 3]) {
              g.beginPath();
              g.moveTo(cxp + dx * 0.5, cyp + 2);
              g.lineTo(cxp + dx, cyp - 13);
              g.stroke();
            }
            g.fillStyle = "#ecc964";
            for (const dx of [-3, 0, 3]) {
              g.beginPath();
              g.ellipse(cxp + dx, cyp - 15, 2, 4, dx * 0.08, 0, Math.PI * 2);
              g.fill();
            }
          } else if (kind === 1) {
            // Cabbages.
            g.fillStyle = "#3f7438";
            g.beginPath();
            g.arc(cxp, cyp - 3, 6.5, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "#86c264";
            g.beginPath();
            g.arc(cxp - 1, cyp - 4, 4, 0, Math.PI * 2);
            g.fill();
          } else {
            // Carrot tops.
            g.strokeStyle = "#5a9443";
            g.lineWidth = 2;
            for (const a of [-0.5, 0, 0.5]) {
              g.beginPath();
              g.moveTo(cxp, cyp);
              g.lineTo(cxp + Math.sin(a) * 8, cyp - 10);
              g.stroke();
            }
            g.fillStyle = "#e2782f";
            g.fillRect(cxp - 2, cyp - 1, 4, 3);
          }
        }
      }
    });

    // Water with a pale shoreline and ripples.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Water)) return;
      // Water set into paving (the plaza fountain) gets a carved stone rim instead of a shore.
      const paved = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => is(tx + dx, ty + dy, Tile.Cobble));
      if (paved) {
        disc(tx, ty, 0.95, "#1d1a17");
        disc(tx, ty, 0.88, "#c9c0ad");
      } else disc(tx, ty, 0.82, this.ember ? "#2a1410" : this.frost ? "#f4f8fb" : this.shadow ? "#4e4870" : this.tide ? "#f4e8c0" : "#d9ecf0");
    });
    const water = this.ember ? "#e0501a" : this.frost ? "#9cc9e6" : this.shadow ? "#0d0a18" : this.tide ? "#1fa8c0" : WATER;
    range((tx, ty) => {
      if (is(tx, ty, Tile.Water)) disc(tx, ty, 0.72, this.ember ? "#ffb347" : this.frost ? "#cfe6f4" : this.shadow ? "#231d3a" : this.tide ? "#7fe0e0" : shade(WATER, 28));
    });
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Water)) return;
      disc(tx, ty, 0.6, water);
      g.fillStyle = water;
      if (is(tx + 1, ty, Tile.Water)) g.fillRect(px(tx) + T / 2, py(ty) + T * 0.2, T, T * 0.6);
      if (is(tx, ty + 1, Tile.Water)) g.fillRect(px(tx) + T * 0.2, py(ty) + T / 2, T * 0.6, T);
      if (this.frost) {
        // Ice: pale cracks, and the odd glint.
        g.strokeStyle = "rgba(255,255,255,0.75)";
        g.lineWidth = 1.6;
        if (hash(tx, ty, 12) < 0.55) {
          const cx0 = px(tx) + hash(tx, ty, 13) * T;
          const cy0 = py(ty) + hash(tx, ty, 14) * T;
          g.beginPath();
          g.moveTo(cx0, cy0);
          g.lineTo(cx0 + (hash(tx, ty, 15) - 0.5) * T, cy0 + (hash(tx, ty, 16) - 0.5) * T * 0.6);
          g.lineTo(cx0 + (hash(tx, ty, 17) - 0.5) * T * 1.2, cy0 + (hash(tx, ty, 18) - 0.5) * T);
          g.stroke();
        }
        if (hash(tx, ty, 19) < 0.2) {
          g.fillStyle = "rgba(255,255,255,0.9)";
          g.beginPath();
          g.arc(px(tx) + hash(tx, ty, 20) * T, py(ty) + hash(tx, ty, 21) * T, 2.5, 0, Math.PI * 2);
          g.fill();
        }
      } else if (this.shadow) {
        // Black water: the stars the sky has lost, reflected anyway.
        for (let i = 0; i < 2; i++) {
          if (hash(tx, ty, 12 + i) > 0.45) continue;
          g.fillStyle = hash(tx, ty, 16 + i) < 0.5 ? "rgba(224,200,255,0.85)" : "rgba(170,200,255,0.7)";
          g.beginPath();
          g.arc(px(tx) + hash(tx, ty, 13 + i) * T, py(ty) + hash(tx, ty, 14 + i) * T, 1 + hash(tx, ty, 15 + i) * 1.6, 0, Math.PI * 2);
          g.fill();
        }
      } else if (this.ember) {
        // Molten crust: dark plates floating on the fire, and bright seams between.
        if (hash(tx, ty, 12) < 0.45) {
          g.fillStyle = "rgba(60,20,10,0.55)";
          g.beginPath();
          g.ellipse(px(tx) + hash(tx, ty, 13) * T, py(ty) + hash(tx, ty, 14) * T, 6 + hash(tx, ty, 15) * 8, 4 + hash(tx, ty, 16) * 5, hash(tx, ty, 17) * 3, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "rgba(255,230,120,0.7)";
        g.beginPath();
        g.arc(px(tx) + hash(tx, ty, 18) * T, py(ty) + hash(tx, ty, 19) * T, 2 + hash(tx, ty, 20) * 3, 0, Math.PI * 2);
        g.fill();
      } else if (hash(tx, ty, 9) < 0.5) {
        g.strokeStyle = "rgba(255,255,255,0.35)";
        g.lineWidth = 2;
        g.beginPath();
        const rx = px(tx) + hash(tx, ty, 10) * T * 0.6;
        const ry = py(ty) + hash(tx, ty, 11) * T;
        g.moveTo(rx, ry);
        g.quadraticCurveTo(rx + 8, ry - 3, rx + 16, ry);
        g.stroke();
      }
    });

    // Cliff lip: grass edge with a rock face dropping toward the sky.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Cliff)) return;
      const x = px(tx);
      const y = py(ty);
      const southOpen = is(tx, ty + 1, Tile.Void);
      // Inland, a cliff is a terrace step: grass on top, a low dry-stone face below.
      const ledge = !southOpen && !is(tx, ty + 1, Tile.Cliff) && !is(tx, ty - 1, Tile.Void) && !is(tx - 1, ty, Tile.Void) && !is(tx + 1, ty, Tile.Void);
      g.fillStyle = this.palette(tx, ty).grassDark;
      g.fillRect(x, y, T, southOpen ? T * 0.35 : ledge ? T * 0.45 : T);
      if (ledge) {
        const [hi, lo] = this.gilded ? ["#dcc486", "#b3954f"] : ["#a29276", "#7c6d55"];
        const fg = g.createLinearGradient(0, y + T * 0.45, 0, y + T);
        fg.addColorStop(0, hi);
        fg.addColorStop(1, lo);
        g.fillStyle = fg;
        g.fillRect(x, y + T * 0.45, T, T * 0.55);
        g.strokeStyle = "rgba(40,30,20,0.3)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, y + T * 0.72);
        g.lineTo(x + T, y + T * 0.72);
        const j = hash(tx, ty, 52) * T * 0.5;
        g.moveTo(x + j + T * 0.2, y + T * 0.45);
        g.lineTo(x + j + T * 0.2, y + T * 0.72);
        g.moveTo(x + ((j + T * 0.55) % T), y + T * 0.72);
        g.lineTo(x + ((j + T * 0.55) % T), y + T);
        g.stroke();
        g.fillStyle = "rgba(0,0,0,0.16)";
        g.fillRect(x, y + T, T, 4);
      }
      if (southOpen) {
        const fg = g.createLinearGradient(0, y + T * 0.35, 0, y + T);
        fg.addColorStop(0, this.ember ? "#4a3a32" : this.frost ? "#a8bccc" : this.shadow ? "#3a3450" : this.tide ? "#d8c89a" : "#9a7a5a");
        fg.addColorStop(1, this.ember ? "#2a1e18" : this.frost ? "#6a7e90" : this.shadow ? "#16121f" : this.tide ? "#8a7a5a" : "#6b5440");
        g.fillStyle = fg;
        g.fillRect(x, y + T * 0.35, T, T * 0.65);
        g.fillStyle = "rgba(0,0,0,0.18)";
        for (let i = 0; i < 3; i++) g.fillRect(x + hash(tx, ty, 50 + i) * T, y + T * 0.4, 2, T * 0.55);
      }
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(x, y, T, 3);
    });

    // Caves: a rock mass with the floor carved out as overlapping discs, so tunnels
    // have organic edges and a dark rim that reads as depth.
    range((tx, ty) => {
      if (!is(tx, ty, Tile.Rock, Tile.Crystal)) return;
      for (let i = 0; i < 3; i++) {
        g.fillStyle = this.ember ? (hash(tx, ty, 60 + i) < 0.5 ? "#2e2826" : "#4a403c") : this.frost ? (hash(tx, ty, 60 + i) < 0.5 ? "#8e9cac" : "#dfe8f0") : this.shadow ? (hash(tx, ty, 60 + i) < 0.5 ? "#221e2e" : "#3a3450") : this.tide ? (hash(tx, ty, 60 + i) < 0.5 ? "#5a6a68" : "#8a9a96") : hash(tx, ty, 60 + i) < 0.5 ? "#50545d" : "#666a74";
        g.beginPath();
        g.arc(px(tx) + hash(tx, ty, 63 + i) * T, py(ty) + hash(tx, ty, 66 + i) * T, 6 + hash(tx, ty, 69 + i) * 10, 0, Math.PI * 2);
        g.fill();
      }
    });
    range((tx, ty) => {
      if (is(tx, ty, Tile.CaveFloor)) disc(tx, ty, 0.98, "#25272c");
    });
    range((tx, ty) => {
      if (!is(tx, ty, Tile.CaveFloor)) return;
      disc(tx, ty, 0.76, CAVE);
      g.fillRect(px(tx) + T * 0.12, py(ty) + T * 0.12, T * 0.76, T * 0.76);
    });
    range((tx, ty) => {
      if (!is(tx, ty, Tile.CaveFloor)) return;
      for (let i = 0; i < 4; i++) {
        g.fillStyle = hash(tx, ty, 31 + i) < 0.5 ? "#3f434b" : "#565b64";
        g.beginPath();
        g.arc(px(tx) + (0.15 + hash(tx, ty, 35 + i) * 0.7) * T, py(ty) + (0.15 + hash(tx, ty, 39 + i) * 0.7) * T, 2 + hash(tx, ty, 43 + i) * 3, 0, Math.PI * 2);
        g.fill();
      }
    });

    // Detail scatter on grass: tufts, flowers, tall grass, pebbles on paths.
    range((tx, ty) => {
      const t = id(tx, ty);
      const x = px(tx);
      const y = py(ty);
      if (t === Tile.Grass || t === Tile.Tree || t === Tile.Flowers || t === Tile.TallGrass) {
        const p = this.palette(tx, ty);
        const tufts = t === Tile.TallGrass ? 9 : 3;
        for (let i = 0; i < tufts; i++) {
          if (t !== Tile.TallGrass && hash(tx, ty, 20 + i) > 0.55) continue;
          const gx = x + hash(tx, ty, 30 + i) * T;
          const gy = y + hash(tx, ty, 40 + i) * T;
          const h = t === Tile.TallGrass ? 14 : 7;
          g.strokeStyle = hash(tx, ty, 50 + i) < 0.5 ? p.grassDark : shade(p.grassLight, 10);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(gx - 3, gy);
          g.lineTo(gx - 4, gy - h * 0.8);
          g.moveTo(gx, gy);
          g.lineTo(gx + 1, gy - h);
          g.moveTo(gx + 3, gy);
          g.lineTo(gx + 5, gy - h * 0.7);
          g.stroke();
        }
        if (t === Tile.Flowers) {
          const colors = this.ember ? ["#ff7a2a", "#ffb347", "#ff5a1a"] : this.frost ? ["#dff4ff", "#bfe6ff", "#ffffff"] : this.shadow ? ["#d8b8ff", "#9fe0ff", "#f0e8ff", "#b77af2"] : this.tide ? ["#ff9a8a", "#ffd0a0", "#8ff0e0", "#ffffff"] : ["#f6d860", "#f59bb7", "#ffffff", "#b99af5", "#ff9a6b"];
          for (let i = 0; i < 7; i++) {
            const fx = x + 6 + hash(tx, ty, 60 + i) * (T - 12);
            const fy = y + 6 + hash(tx, ty, 70 + i) * (T - 12);
            g.fillStyle = shade(p.grassDark, -10);
            g.fillRect(fx - 1, fy, 2, 6);
            g.fillStyle = colors[Math.floor(hash(tx, ty, 80 + i) * colors.length)];
            g.beginPath();
            g.arc(fx, fy, 3.2, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "#fff6c8";
            g.beginPath();
            g.arc(fx, fy, 1.1, 0, Math.PI * 2);
            g.fill();
          }
        }
      } else if (t === Tile.Path && hash(tx, ty, 90) < 0.6) {
        g.fillStyle = shade(PATH, -30);
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(x + hash(tx, ty, 91 + i) * T, y + hash(tx, ty, 94 + i) * T, 2 + hash(tx, ty, 97 + i) * 2, 0, Math.PI * 2);
          g.fill();
        }
      }
    });

    tex.refresh();
  }
}

// -----------------------------------------------------------------------------
// Tall-object textures shared by every chunk.

function paintSprites(scene: Phaser.Scene, map: WorldMap) {
  const T = TILE * RES;
  const make = (key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h)!;
    paint(tex.getContext());
    tex.refresh();
  };
  const canopies: [string, string, string][] = [
    ["#2e6a37", "#3f8746", "#5aa55a"],
    ["#35713a", "#468e4a", "#62ad5c"],
    ["#2a6333", "#3a7d42", "#54a050"],
    ["#214f2c", "#2f6a3a", "#468a4a"],
    ["#1e4a2a", "#2b6236", "#3f8045"],
    ["#26552f", "#33703c", "#4c9150"],
    // Floor 2: golden and amber canopies.
    ["#8a6a1e", "#b8902e", "#e0b84a"],
    ["#7a5a1a", "#a8802a", "#d8a83e"],
    ["#6a7a22", "#8ea033", "#b8c450"],
    // Floor 3: charred, ash-grey, with embers still in the crowns.
    ["#231d1a", "#352c27", "#4e423a"],
    ["#2a201b", "#3e3029", "#5a4034"],
    ["#1e1a18", "#2f2925", "#4a3e36"],
  ];
  canopies.forEach(([dark, mid, light], v) => {
    make(`tree${v}`, 110, 150, (g) => {
      const cx = 55;
      const h = 150;
      const shadow = g.createRadialGradient(cx, h - 10, 4, cx, h - 10, 40);
      shadow.addColorStop(0, "rgba(0,0,0,0.35)");
      shadow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = shadow;
      g.beginPath();
      g.ellipse(cx, h - 10, 40, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1d1a17";
      g.fillRect(cx - 9, h - 58, 18, 50);
      g.fillStyle = "#6b4a2b";
      g.fillRect(cx - 6, h - 58, 12, 48);
      g.fillStyle = "#86603a";
      g.fillRect(cx - 5, h - 58, 4, 46);
      const tall = v >= 3 ? 12 : 0;
      const lobes = [
        [cx, h - 88 - tall, 42],
        [cx - 26, h - 74 - tall, 26],
        [cx + 26, h - 76 - tall, 27],
        [cx - 12, h - 112 - tall, 28],
        [cx + 14, h - 110 - tall, 26],
      ];
      for (const [color, k, dx, dy] of [["#1d1a17", 1, 0, 0], [dark, 1, 0, 0], [mid, 0.78, -0.15, -0.2], [light, 0.4, -0.3, -0.38]] as const) {
        g.fillStyle = color;
        for (const [x, y, r] of lobes) {
          g.beginPath();
          g.arc(x + r * dx, y + r * dy, color === "#1d1a17" ? r + 3 : r * k, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
  });

  for (let v = 0; v < 3; v++) {
    make(`tree${12 + v}`, 110, 160, (g) => {
      const cx = 55;
      const h = 160;
      const shadow = g.createRadialGradient(cx, h - 10, 4, cx, h - 10, 34);
      shadow.addColorStop(0, "rgba(40,60,90,0.35)");
      shadow.addColorStop(1, "rgba(40,60,90,0)");
      g.fillStyle = shadow;
      g.beginPath();
      g.ellipse(cx, h - 10, 34, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1d1a17";
      g.fillRect(cx - 7, h - 40, 14, 32);
      g.fillStyle = "#5a3e26";
      g.fillRect(cx - 4, h - 40, 8, 30);
      const tiers = 3 + (v === 2 ? 1 : 0);
      const green = ["#1f4a3a", "#24543f", "#1b4436"][v];
      for (let i = 0; i < tiers; i++) {
        const w = 44 - i * 9;
        const y0 = h - 30 - i * 26;
        const tier = (inset: number) => {
          g.beginPath();
          g.moveTo(cx - w + inset, y0 - inset * 0.3);
          g.lineTo(cx, y0 - 44 + inset);
          g.lineTo(cx + w - inset, y0 - inset * 0.3);
          g.quadraticCurveTo(cx, y0 + 8 - inset, cx - w + inset, y0 - inset * 0.3);
          g.closePath();
        };
        g.fillStyle = "#1d1a17";
        tier(-3);
        g.fill();
        const tg = g.createLinearGradient(cx - w, 0, cx + w, 0);
        tg.addColorStop(0, shade(green, 18));
        tg.addColorStop(1, shade(green, -16));
        g.fillStyle = tg;
        tier(0);
        g.fill();
        // Snow on the tier.
        g.fillStyle = "#f4f9fc";
        g.beginPath();
        g.moveTo(cx - w * 0.8, y0 - 10);
        g.lineTo(cx, y0 - 42);
        g.lineTo(cx + w * 0.7, y0 - 12);
        g.quadraticCurveTo(cx + w * 0.3, y0 - 20, cx + w * 0.1, y0 - 14);
        g.quadraticCurveTo(cx - w * 0.3, y0 - 22, cx - w * 0.8, y0 - 10);
        g.closePath();
        g.fill();
      }
    });
  }

  // Floor 5: shadow-oaks — twisted black trunks under violet-black crowns, with pale motes.
  for (let v = 0; v < 3; v++) {
    make(`tree${15 + v}`, 120, 160, (g) => {
      const cx = 60;
      const h = 160;
      const shadow = g.createRadialGradient(cx, h - 10, 4, cx, h - 10, 40);
      shadow.addColorStop(0, "rgba(0,0,0,0.45)");
      shadow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = shadow;
      g.beginPath();
      g.ellipse(cx, h - 10, 40, 13, 0, 0, Math.PI * 2);
      g.fill();
      // A twisted trunk, leaning one way then the other.
      const lean = [-8, 6, -4][v];
      const trunk = (w: number) => {
        g.beginPath();
        g.moveTo(cx - w, h - 8);
        g.quadraticCurveTo(cx - w + lean, h - 40, cx - w * 0.6 - lean * 0.5, h - 70);
        g.lineTo(cx + w * 0.6 - lean * 0.5, h - 70);
        g.quadraticCurveTo(cx + w + lean, h - 40, cx + w, h - 8);
        g.closePath();
      };
      g.fillStyle = "#0c0a10";
      trunk(11);
      g.fill();
      g.fillStyle = "#2e2838";
      trunk(8);
      g.fill();
      g.strokeStyle = "#0c0a10";
      g.lineWidth = 4;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + lean * 0.3, h - 62);
        g.quadraticCurveTo(cx + s * 20, h - 80, cx + s * 34, h - 78 - v * 4);
        g.stroke();
      }
      const [dark, mid, light] = [["#1a1428", "#2a2040", "#3e3060"], ["#161226", "#241c3a", "#382c58"], ["#1c1630", "#2c2248", "#443670"]][v];
      const lobes = [
        [cx, h - 96, 40],
        [cx - 28, h - 82, 25],
        [cx + 28, h - 84, 26],
        [cx - 12, h - 120, 27],
        [cx + 15, h - 118, 25],
      ];
      for (const [color, k, dx, dy] of [["#0c0a10", 1, 0, 0], [dark, 1, 0, 0], [mid, 0.76, -0.15, -0.2], [light, 0.38, -0.3, -0.38]] as const) {
        g.fillStyle = color;
        for (const [x, y, r] of lobes) {
          g.beginPath();
          g.arc(x + r * dx, y + r * dy, color === "#0c0a10" ? r + 3 : r * k, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Pale motes caught in the leaves.
      g.shadowColor = "#d8b8ff";
      g.shadowBlur = 6;
      for (let i = 0; i < 7; i++) {
        g.fillStyle = i % 3 ? "#d8b8ff" : "#f4f0ff";
        g.beginPath();
        g.arc(cx - 36 + ((i * 29 + v * 13) % 72), h - 132 + ((i * 17 + v * 7) % 60), 1.4 + (i % 2), 0, Math.PI * 2);
        g.fill();
      }
      g.shadowBlur = 0;
    });
  }

  // Floor 6: palms leaning over the sand (and tall kelp, painted the same way but greener).
  for (let v = 0; v < 3; v++) {
    make(`tree${18 + v}`, 120, 160, (g) => {
      const cx = 60;
      const h = 160;
      const shadow = g.createRadialGradient(cx, h - 10, 4, cx, h - 10, 36);
      shadow.addColorStop(0, "rgba(0,40,40,0.3)");
      shadow.addColorStop(1, "rgba(0,40,40,0)");
      g.fillStyle = shadow;
      g.beginPath();
      g.ellipse(cx, h - 10, 36, 11, 0, 0, Math.PI * 2);
      g.fill();
      const lean = [14, -12, 8][v];
      // A ringed trunk, curving.
      g.lineCap = "round";
      g.strokeStyle = "#1d1a17";
      g.lineWidth = 13;
      g.beginPath();
      g.moveTo(cx, h - 8);
      g.quadraticCurveTo(cx + lean * 0.2, h - 60, cx + lean, h - 100);
      g.stroke();
      g.strokeStyle = "#a07a4a";
      g.lineWidth = 8;
      g.stroke();
      g.strokeStyle = "rgba(60,40,20,0.5)";
      g.lineWidth = 2;
      for (let i = 1; i < 9; i++) {
        const t = i / 9;
        const x = cx + lean * t * t;
        const y = h - 8 - 92 * t;
        g.beginPath();
        g.moveTo(x - 4, y);
        g.lineTo(x + 4, y + 1);
        g.stroke();
      }
      // Fronds.
      const top = { x: cx + lean, y: h - 102 };
      const green = ["#2f8a4a", "#3a9a52", "#2a7a42"][v];
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.55 + (v - 1) * 0.1;
        const len = 40 + (i % 2) * 8;
        const ex = top.x + Math.cos(a) * len;
        const ey = top.y + Math.sin(a) * len * 0.6 + 16;
        for (const [col, wd] of [["#1d1a17", 9], [green, 6]] as const) {
          g.strokeStyle = col;
          g.lineWidth = wd;
          g.beginPath();
          g.moveTo(top.x, top.y);
          g.quadraticCurveTo(top.x + Math.cos(a) * len * 0.6, top.y + Math.sin(a) * len * 0.6 - 10, ex, ey);
          g.stroke();
        }
      }
      g.fillStyle = "#6a4a2a";
      for (const [dx, dy] of [[-4, 4], [4, 5], [0, 8]]) {
        g.beginPath();
        g.arc(top.x + dx, top.y + dy, 4, 0, Math.PI * 2);
        g.fill();
      }
    });
  }

  const block = (key: string, top: [string, string], face: [string, string], moss: boolean, seed: number) =>
    make(key, T, T + 36, (g) => {
      g.fillStyle = "#1d1a17";
      g.fillRect(0, 0, T, T + 36);
      const tg = g.createLinearGradient(0, 0, 0, T);
      tg.addColorStop(0, top[0]);
      tg.addColorStop(1, top[1]);
      g.fillStyle = tg;
      g.fillRect(2, 2, T - 4, T - 4);
      g.fillStyle = "rgba(0,0,0,0.12)";
      for (let i = 0; i < 3; i++) g.fillRect(2, 2 + i * (T / 3), T - 4, 2);
      const fg = g.createLinearGradient(0, T, 0, T + 36);
      fg.addColorStop(0, face[0]);
      fg.addColorStop(1, face[1]);
      g.fillStyle = fg;
      g.fillRect(2, T, T - 4, 34);
      g.fillStyle = "rgba(0,0,0,0.25)";
      for (let r = 0; r < 3; r++) {
        const off = r % 2 ? 16 : 0;
        for (let c = -1; c < 3; c++) g.fillRect(2 + c * 32 + off, T + 2 + r * 11, 2, 9);
        g.fillRect(2, T + 11 + r * 11, T - 4, 2);
      }
      if (moss) {
        g.fillStyle = "rgba(92,150,70,0.8)";
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          g.arc(4 + ((i * 13 + seed * 7) % (T - 8)), 4 + ((i * 17 + seed * 5) % 20), 4 + (i % 3) * 2, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
  for (let v = 0; v < 3; v++) {
    make(`inWall${v}`, T, T * 2, (g) => {
      const W = T;
      const H = T * 2;
      const pl = g.createLinearGradient(0, 0, 0, H);
      pl.addColorStop(0, "#d9c9a8");
      pl.addColorStop(1, "#bfa982");
      g.fillStyle = pl;
      g.fillRect(0, 0, W, H);
      // Timber frame.
      g.fillStyle = "#5b3b24";
      g.fillRect(0, 0, W, 8);
      g.fillRect(0, 0, 5, H);
      // Wainscot.
      const wg = g.createLinearGradient(0, H * 0.58, 0, H);
      wg.addColorStop(0, "#8a5a34");
      wg.addColorStop(1, "#5b3b24");
      g.fillStyle = wg;
      g.fillRect(0, H * 0.58, W, H * 0.42);
      g.fillStyle = "#3a2716";
      g.fillRect(0, H * 0.58, W, 5);
      g.fillStyle = "rgba(255,230,180,0.15)";
      g.fillRect(8, H * 0.66, W - 16, 3);
      if (v === 1) {
        // A small window, lit from outside.
        g.fillStyle = "#1d1a17";
        g.fillRect(W / 2 - 16, 18, 32, 36);
        const lg = g.createLinearGradient(0, 22, 0, 50);
        lg.addColorStop(0, "#fff4c8");
        lg.addColorStop(1, "#e8b860");
        g.fillStyle = lg;
        g.fillRect(W / 2 - 12, 22, 24, 28);
        g.fillStyle = "#1d1a17";
        g.fillRect(W / 2 - 1, 22, 2, 28);
        g.fillRect(W / 2 - 12, 35, 24, 2);
      } else if (v === 2) {
        // A shield on the wall.
        g.fillStyle = "#1d1a17";
        g.beginPath();
        g.moveTo(W / 2, 16);
        g.lineTo(W / 2 + 16, 22);
        g.quadraticCurveTo(W / 2 + 16, 46, W / 2, 56);
        g.quadraticCurveTo(W / 2 - 16, 46, W / 2 - 16, 22);
        g.closePath();
        g.fill();
        g.fillStyle = "#8a3a2a";
        g.beginPath();
        g.moveTo(W / 2, 20);
        g.lineTo(W / 2 + 12, 25);
        g.quadraticCurveTo(W / 2 + 12, 44, W / 2, 52);
        g.quadraticCurveTo(W / 2 - 12, 44, W / 2 - 12, 25);
        g.closePath();
        g.fill();
        g.fillStyle = "#e8c86a";
        g.fillRect(W / 2 - 2, 24, 4, 24);
      }
    });
  }
  block("wallTop", ["#c9c0ad", "#a79d88"], ["#857b69", "#5d5548"], false, 0);
  block("wallFront", ["#c9c0ad", "#a79d88"], ["#857b69", "#5d5548"], false, 0);
  block("ruin0", ["#cbbd9b", "#a8977a"], ["#8f7f64", "#62564a"], true, 1);
  block("ruin1", ["#c2b391", "#9e8f73"], ["#86775e", "#5b5044"], true, 2);
  block("ruin2", ["#d0c3a3", "#ad9d80"], ["#958569", "#665a4c"], false, 3);
  // Floor 5: black basalt.
  block("ruin3", ["#4a4458", "#34303e"], ["#2a2632", "#15121a"], false, 4);
  block("ruin4", ["#46405a", "#302b3c"], ["#26222e", "#121016"], false, 5);
  block("ruin5", ["#524a64", "#3a3448"], ["#2e2a38", "#17141c"], false, 6);

  make("portcullis", T, T + 44, (g) => {
    g.fillStyle = "#1d1a17";
    g.fillRect(0, 0, T, T + 44);
    g.strokeStyle = "#7a828c";
    g.lineWidth = 5;
    for (let x = 8; x < T; x += 16) {
      g.beginPath();
      g.moveTo(x, 2);
      g.lineTo(x, T + 38);
      g.stroke();
    }
    for (let y = 14; y < T + 40; y += 22) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(T, y);
      g.stroke();
    }
    g.fillStyle = "#9aa3ad";
    for (let x = 8; x < T; x += 16) {
      g.beginPath();
      g.moveTo(x - 4, T + 38);
      g.lineTo(x, T + 44);
      g.lineTo(x + 4, T + 38);
      g.fill();
    }
  });
  make("palisade", T, T + 40, (g) => {
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 21;
      g.fillStyle = "#1d1a17";
      g.beginPath();
      g.moveTo(x, T + 40);
      g.lineTo(x, 12);
      g.lineTo(x + 10, 0);
      g.lineTo(x + 20, 12);
      g.lineTo(x + 20, T + 40);
      g.fill();
      const wg = g.createLinearGradient(x, 0, x + 20, 0);
      wg.addColorStop(0, "#8a6440");
      wg.addColorStop(1, "#5e4228");
      g.fillStyle = wg;
      g.beginPath();
      g.moveTo(x + 2, T + 38);
      g.lineTo(x + 2, 13);
      g.lineTo(x + 10, 3);
      g.lineTo(x + 18, 13);
      g.lineTo(x + 18, T + 38);
      g.fill();
    }
    g.fillStyle = "#4a3526";
    g.fillRect(0, 40, T, 6);
    g.fillRect(0, T + 10, T, 6);
  });
  make("fenceH", T, 40, (g) => {
    g.fillStyle = "#1d1a17";
    g.fillRect(0, 10, T, 8);
    g.fillRect(0, 24, T, 8);
    g.fillRect(6, 2, 10, 38);
    g.fillRect(T - 16, 2, 10, 38);
    g.fillStyle = "#9a7348";
    g.fillRect(0, 12, T, 4);
    g.fillRect(0, 26, T, 4);
    g.fillRect(8, 4, 6, 34);
    g.fillRect(T - 14, 4, 6, 34);
  });
  make("fenceV", T, T + 24, (g) => {
    g.fillStyle = "#1d1a17";
    g.fillRect(T / 2 - 9, 0, 5, T + 18);
    g.fillRect(T / 2 + 4, 0, 5, T + 18);
    g.fillRect(T / 2 - 6, T - 22, 12, 46);
    g.fillStyle = "#8a6a45";
    g.fillRect(T / 2 - 8, 0, 3, T + 18);
    g.fillRect(T / 2 + 5, 0, 3, T + 18);
    g.fillStyle = "#9a7348";
    g.fillRect(T / 2 - 4, T - 20, 8, 42);
  });
  for (let v = 0; v < 6; v++) {
    make(`crystal${v}`, T, 80, (g) => {
      const moon = v === 2 || v === 3;
      const coral = v >= 4;
      const shards = v % 2 ? [[20, 30, 70], [36, 20, 76], [48, 26, 60]] : [[16, 22, 64], [32, 28, 78], [46, 18, 58]];
      for (const [x, w, h] of shards) {
        g.fillStyle = "#1d1a17";
        g.beginPath();
        g.moveTo(x - w / 2 - 2, 80);
        g.lineTo(x, 80 - h - 2);
        g.lineTo(x + w / 2 + 2, 80);
        g.fill();
        const cg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        // Floor 5's are shards of the fallen moon: pale violet-white.
        // Floor 6's are branches of coral: warm pink and orange.
        cg.addColorStop(0, coral ? "#ff9a8a" : moon ? "#c8b0f0" : "#8fe3ff");
        cg.addColorStop(0.5, coral ? "#ffd0b0" : moon ? "#f4f0ff" : "#c8f4ff");
        cg.addColorStop(1, coral ? "#d8506a" : moon ? "#7a5ab8" : "#4fa6d8");
        g.fillStyle = cg;
        g.beginPath();
        g.moveTo(x - w / 2, 80);
        g.lineTo(x, 80 - h);
        g.lineTo(x + w / 2, 80);
        g.fill();
      }
    });
  }

  for (const bd of map.buildings) paintBuilding(scene, bd);
}

function paintBuilding(scene: Phaser.Scene, bd: Building) {
  const key = `building:${bd.id}`;
  if (scene.textures.exists(key)) return;
  const T = TILE * RES;
  const w = bd.tw * T;
  const wallH = 64;
  const roofH = bd.th * T - wallH + 56;
  const h = roofH + wallH;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const g = tex.getContext();
  const palettes: Record<string, [string, string]> = {
    smith: ["#6f4a3a", "#8c5f4a"],
    store: ["#3f6a8a", "#5584a8"],
    inn: ["#8a4a32", "#b0633f"],
    storage: ["#5d6a4a", "#76855e"],
    guild: ["#6b3f6f", "#8a5590"],
    scholar: ["#2e4a6a", "#44688e"],
    skyhall: ["#b8903a", "#e0c060"],
    quarter: ["#3f6a8a", "#5584a8"],
    skyforge: ["#5a5f66", "#7d848c"],
    skyvault: ["#4a6a5a", "#6a8a7a"],
    windrest: ["#8a4a6a", "#b0638a"],
    chapel5: ["#3a2a5a", "#5a4488"],
    quarter5: ["#2a3a5a", "#40587e"],
    forge5: ["#3a3848", "#5a5868"],
    vault5: ["#2e2a3e", "#4a445e"],
    inn5: ["#4a2a4a", "#6e3e6e"],
    hall6: ["#2a6a7a", "#3f8ea0"],
    quarter6: ["#8a6a3a", "#b08a4a"],
    forge6: ["#4a5a5a", "#6a7e7e"],
    vault6: ["#3a4a5a", "#56687a"],
    inn6: ["#8a3a2a", "#b0503a"],
  };
  const [roofD, roofL] = palettes[bd.id] ?? ["#8a4a32", "#b0633f"];
  g.fillStyle = "#1d1a17";
  g.fillRect(4, roofH - 6, w - 8, wallH + 6);
  const wg = g.createLinearGradient(0, roofH, 0, h);
  wg.addColorStop(0, "#efe2c2");
  wg.addColorStop(1, "#cdbb95");
  g.fillStyle = wg;
  g.fillRect(8, roofH, w - 16, wallH - 4);
  g.fillStyle = "#6b4a2b";
  g.fillRect(8, roofH, w - 16, 6);
  for (let x = 8; x < w - 8; x += 48) g.fillRect(x, roofH, 6, wallH - 4);
  g.fillRect(w - 14, roofH, 6, wallH - 4);
  g.fillStyle = "#1d1a17";
  g.beginPath();
  g.roundRect(w / 2 - 17, h - 50, 34, 46, [14, 14, 0, 0]);
  g.fill();
  g.fillStyle = "#5b3b24";
  g.beginPath();
  g.roundRect(w / 2 - 13, h - 46, 26, 42, [11, 11, 0, 0]);
  g.fill();
  g.fillStyle = "#f2c46b";
  g.beginPath();
  g.arc(w / 2 + 7, h - 24, 2.5, 0, Math.PI * 2);
  g.fill();
  for (const wx of [30, w - 60]) {
    g.fillStyle = "#1d1a17";
    g.fillRect(wx - 2, roofH + 16, 34, 26);
    const lg = g.createRadialGradient(wx + 15, roofH + 29, 2, wx + 15, roofH + 29, 20);
    lg.addColorStop(0, "#ffe7a3");
    lg.addColorStop(1, "#e79a3c");
    g.fillStyle = lg;
    g.fillRect(wx, roofH + 18, 30, 22);
    g.fillStyle = "#1d1a17";
    g.fillRect(wx + 14, roofH + 18, 2, 22);
    g.fillRect(wx, roofH + 28, 30, 2);
  }
  g.fillStyle = "#1d1a17";
  g.beginPath();
  g.moveTo(0, roofH + 2);
  g.lineTo(18, 4);
  g.lineTo(w - 18, 4);
  g.lineTo(w, roofH + 2);
  g.closePath();
  g.fill();
  const rg = g.createLinearGradient(0, 6, 0, roofH);
  rg.addColorStop(0, roofL);
  rg.addColorStop(1, roofD);
  g.fillStyle = rg;
  g.beginPath();
  g.moveTo(5, roofH - 2);
  g.lineTo(21, 8);
  g.lineTo(w - 21, 8);
  g.lineTo(w - 5, roofH - 2);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.22)";
  g.lineWidth = 2;
  for (let y = 22; y < roofH - 4; y += 14) {
    g.beginPath();
    g.moveTo(8, y);
    g.lineTo(w - 8, y);
    g.stroke();
    for (let x = 14 + ((y / 14) % 2) * 12; x < w - 12; x += 24) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 14);
      g.stroke();
    }
  }
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.fillRect(22, 8, w - 44, 5);
  g.fillStyle = "#1d1a17";
  g.fillRect(w - 64, 0, 22, 34);
  g.fillStyle = "#8a7a6a";
  g.fillRect(w - 61, 2, 16, 30);
  tex.refresh();
}
