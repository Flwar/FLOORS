import { TILE, type WorldMap } from "@floors/shared";
import { landImage } from "../render/mapArt.ts";

export interface MinimapMarks {
  me: { x: number; y: number; face: number };
  party: { x: number; y: number }[];
  pins: { x: number; y: number; main: boolean }[];
  /** Discovered zones and places (inv.discovered). */
  known: string[];
}

const SIZE = 168;
/** Pixels per tile on the minimap. */
const SCALE = 3;

/**
 * The minimap: a round window on the floor's chart, centred on you, in the corner of the
 * screen. It needs the floor's map (bought from its town, like the full map), shows only
 * what you've explored, and marks your party and your quests.
 */
export class Minimap {
  private el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private land?: HTMLCanvasElement;
  private fog?: HTMLCanvasElement;
  private fogKnown = -1;
  private zoneOf?: Int16Array;
  private map?: WorldMap;

  constructor() {
    let el = document.getElementById("minimap") as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "minimap";
      el.className = "hidden";
      el.innerHTML = `<canvas width="${SIZE}" height="${SIZE}"></canvas><div class="mm-n">N</div>`;
      document.body.append(el);
    }
    this.el = el;
    this.canvas = el.querySelector("canvas")!;
    this.g = this.canvas.getContext("2d")!;
  }

  setMap(m: WorldMap) {
    this.map = m;
    this.land = landImage(m);
    this.fog = undefined;
    this.fogKnown = -1;
    // Which zone each outdoor tile belongs to (the most specific), for the fog of war.
    const zi = new Int16Array(m.width * m.outdoorHeight).fill(-1);
    for (let y = 0; y < m.outdoorHeight; y++) {
      for (let x = 0; x < m.width; x++) {
        for (let i = m.zones.length - 1; i >= 0; i--) {
          const z = m.zones[i];
          if (x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) {
            zi[y * m.width + x] = i;
            break;
          }
        }
      }
    }
    this.zoneOf = zi;
  }

  hide() {
    this.el.classList.add("hidden");
  }

  draw(marks: MinimapMarks) {
    const m = this.map;
    if (!m || !this.land || !this.zoneOf) return;
    this.el.classList.remove("hidden");
    this.ensureFog(marks.known);
    const g = this.g;
    const c = SIZE / 2;
    const tx = marks.me.x / TILE;
    const ty = marks.me.y / TILE;
    g.clearRect(0, 0, SIZE, SIZE);
    g.save();
    g.beginPath();
    g.arc(c, c, c - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#1a2a3a";
    g.fillRect(0, 0, SIZE, SIZE);
    g.imageSmoothingEnabled = true;
    const dx = c - tx * SCALE;
    const dy = c - ty * SCALE;
    g.drawImage(this.land, dx, dy, m.width * SCALE, m.outdoorHeight * SCALE);
    if (this.fog) g.drawImage(this.fog, dx, dy, m.width * SCALE, m.outdoorHeight * SCALE);
    // Quest pins (pinned to the rim when they are off the edge).
    const R = c - 9;
    for (const p of marks.pins) {
      let px = c + (p.x / TILE - tx) * SCALE;
      let py = c + (p.y / TILE - ty) * SCALE;
      const d = Math.hypot(px - c, py - c);
      if (d > R) {
        px = c + ((px - c) / d) * R;
        py = c + ((py - c) / d) * R;
      }
      g.fillStyle = "#1d1a17";
      diamond(g, px, py, 6);
      g.fillStyle = p.main ? "#ffd24a" : "#e8e0d0";
      diamond(g, px, py, 4.2);
    }
    for (const p of marks.party) {
      const px = c + (p.x / TILE - tx) * SCALE;
      const py = c + (p.y / TILE - ty) * SCALE;
      g.fillStyle = "#1d1a17";
      g.beginPath();
      g.arc(px, py, 4.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#7fe08a";
      g.beginPath();
      g.arc(px, py, 3, 0, Math.PI * 2);
      g.fill();
    }
    // You: an arrow the way you face.
    g.translate(c, c);
    g.rotate(marks.me.face + Math.PI / 2);
    g.fillStyle = "#1d1a17";
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6.5, 6);
    g.lineTo(0, 3);
    g.lineTo(-6.5, 6);
    g.closePath();
    g.fill();
    g.fillStyle = "#fff1c0";
    g.beginPath();
    g.moveTo(0, -5.5);
    g.lineTo(4.2, 4);
    g.lineTo(0, 1.8);
    g.lineTo(-4.2, 4);
    g.closePath();
    g.fill();
    g.restore();
  }

  /** The fog of war: undiscovered zones are shaded (rebuilt when you discover something). */
  private ensureFog(known: string[]) {
    const m = this.map!;
    if (this.fog && known.length === this.fogKnown) return;
    this.fogKnown = known.length;
    const set = new Set(known);
    const seen = m.zones.map((z) => !z.secret && (z.safe || z.id === "green-fields" || set.has(`zone:${z.id}`)));
    const fog = this.fog ?? document.createElement("canvas");
    fog.width = m.width;
    fog.height = m.outdoorHeight;
    const fg = fog.getContext("2d")!;
    const img = fg.createImageData(m.width, m.outdoorHeight);
    for (let i = 0; i < this.zoneOf!.length; i++) {
      const z = this.zoneOf![i];
      if (z >= 0 && seen[z]) continue;
      // Secret places stay hidden until found; unexplored land is only dimmed.
      const secret = z >= 0 && m.zones[z].secret && !set.has(`zone:${m.zones[z].id}`);
      img.data[i * 4] = 26;
      img.data[i * 4 + 1] = 42;
      img.data[i * 4 + 2] = 58;
      img.data[i * 4 + 3] = secret ? 255 : z < 0 ? 0 : 170;
    }
    fg.putImageData(img, 0, 0);
    this.fog = fog;
  }
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
  g.fill();
}
