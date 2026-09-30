import { Tile, TILE, type WorldMap } from "@floors/shared";

/**
 * The world map as an illustrated parchment chart: watercolour land with an inked coast,
 * tree and house glyphs, fog over what you haven't explored, landmarks, labels and pins.
 */

export interface MapMarks {
  known: Set<string>;
  me?: { x: number; y: number; face: number };
  party: { x: number; y: number }[];
  pins: { x: number; y: number; main: boolean; label: string; n: number }[];
}

const INK = "#4a3520";

const PAINT: Record<number, [number, number, number]> = {
  [Tile.Grass]: [166, 196, 124], [Tile.TallGrass]: [158, 190, 116], [Tile.Flowers]: [176, 200, 130], [Tile.Tree]: [104, 150, 92],
  [Tile.Path]: [214, 184, 130], [Tile.Cobble]: [196, 186, 162], [Tile.Wall]: [150, 138, 118], [Tile.House]: [196, 186, 162],
  [Tile.Water]: [124, 172, 200], [Tile.Rock]: [132, 128, 118], [Tile.CaveFloor]: [150, 144, 132], [Tile.Sand]: [226, 206, 152],
  [Tile.StoneFloor]: [190, 176, 146], [Tile.RuinWall]: [160, 146, 118], [Tile.Palisade]: [164, 130, 92], [Tile.Fence]: [166, 196, 124],
  [Tile.Cliff]: [170, 146, 110], [Tile.Crystal]: [150, 206, 222], [Tile.Gate]: [150, 138, 118], [Tile.Crop]: [206, 184, 110], [Tile.Prop]: [196, 186, 162],
};

/** How each floor's ground reads on a chart: its grass and its water. */
const THEME_PAINT: Record<string, { grass: [number, number, number]; water: [number, number, number]; tree: [number, number, number] }> = {
  gilded: { grass: [196, 204, 120], water: [124, 172, 200], tree: [170, 150, 70] },
  storm: { grass: [150, 160, 150], water: [100, 130, 170], tree: [110, 130, 110] },
  ember: { grass: [124, 114, 104], water: [226, 96, 40], tree: [70, 60, 56] },
  frost: { grass: [230, 238, 244], water: [168, 206, 232], tree: [70, 110, 96] },
  shadow: { grass: [84, 92, 140], water: [26, 22, 48], tree: [60, 44, 96] },
  tide: { grass: [150, 206, 164], water: [44, 176, 204], tree: [70, 150, 90] },
};

/** The floor's outdoor land, one pixel per tile, in the floor's own colours (the minimap). */
export function landImage(m: WorldMap): HTMLCanvasElement {
  const c = offscreen(m.width, m.outdoorHeight);
  const g = c.getContext("2d")!;
  const img = g.createImageData(m.width, m.outdoorHeight);
  const theme = THEME_PAINT[m.theme];
  for (let y = 0; y < m.outdoorHeight; y++) {
    for (let x = 0; x < m.width; x++) {
      const t = m.get(x, y);
      if (t === Tile.Void) continue;
      const i = (y * m.width + x) * 4;
      let col = PAINT[t] ?? [180, 170, 150];
      if (theme && (t === Tile.Grass || t === Tile.TallGrass || t === Tile.Flowers || t === Tile.Cliff)) col = theme.grass;
      else if (theme && t === Tile.Water) col = theme.water;
      else if (theme && t === Tile.Tree) col = theme.tree;
      const n = (hash(x, y, 7) - 0.5) * 9;
      img.data[i] = col[0] + n;
      img.data[i + 1] = col[1] + n;
      img.data[i + 2] = col[2] + n;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function offscreen(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function drawParchmentMap(c: HTMLCanvasElement, m: WorldMap, marks: MapMarks) {
  const W = c.width;
  const margin = 26;
  const s = (W - margin * 2) / m.width;
  c.height = Math.round(m.outdoorHeight * s + margin * 2 + 34);
  const H = c.height;
  const g = c.getContext("2d")!;
  const ox = margin;
  const oy = margin;
  const X = (tx: number) => ox + tx * s;
  const Y = (ty: number) => oy + ty * s;
  const seenZone = (x: number, y: number) => {
    const z = m.zoneAt(x * TILE + 16, y * TILE + 16);
    return !z || z.id === "green-fields" || marks.known.has(`zone:${z.id}`);
  };

  // Parchment.
  const bg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
  bg.addColorStop(0, "#f2e6c6");
  bg.addColorStop(1, "#c9b183");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = hash(i, 1) < 0.5 ? "rgba(120,90,50,0.07)" : "rgba(255,255,255,0.08)";
    g.beginPath();
    g.arc(hash(i, 2) * W, hash(i, 3) * H, 0.6 + hash(i, 4) * 2.2, 0, Math.PI * 2);
    g.fill();
  }

  // Land colours (1 px per tile), smoothed when scaled up for a painted look.
  const land = offscreen(m.width, m.outdoorHeight);
  const mask = offscreen(m.width, m.outdoorHeight);
  const lg = land.getContext("2d")!;
  const mg = mask.getContext("2d")!;
  const img = lg.createImageData(m.width, m.outdoorHeight);
  const mimg = mg.createImageData(m.width, m.outdoorHeight);
  for (let y = 0; y < m.outdoorHeight; y++) {
    for (let x = 0; x < m.width; x++) {
      const t = m.get(x, y);
      if (t === Tile.Void) continue;
      const i = (y * m.width + x) * 4;
      const col = PAINT[t] ?? [180, 170, 150];
      const n = (hash(x, y, 7) - 0.5) * 9;
      img.data[i] = col[0] + n;
      img.data[i + 1] = col[1] + n;
      img.data[i + 2] = col[2] + n;
      img.data[i + 3] = 255;
      mimg.data[i] = 74;
      mimg.data[i + 1] = 53;
      mimg.data[i + 2] = 32;
      mimg.data[i + 3] = 255;
    }
  }
  lg.putImageData(img, 0, 0);
  mg.putImageData(mimg, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  // Drop shadow, inked coast, then the paint.
  g.globalAlpha = 0.25;
  g.drawImage(mask, ox + 4, oy + 6, m.width * s, m.outdoorHeight * s);
  g.globalAlpha = 0.9;
  for (const [dx, dy] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]]) g.drawImage(mask, ox + dx, oy + dy, m.width * s, m.outdoorHeight * s);
  g.globalAlpha = 1;
  g.drawImage(land, ox, oy, m.width * s, m.outdoorHeight * s);

  // Glyphs: trees in woods, ripples on water, little houses.
  for (let y = 0; y < m.outdoorHeight; y += 2) {
    for (let x = 0; x < m.width; x += 2) {
      if (!seenZone(x, y)) continue;
      const t = m.get(x, y);
      if (t === Tile.Tree && hash(x, y, 11) < 0.55) {
        const cx = X(x + hash(x, y, 12) * 2);
        const cy = Y(y + hash(x, y, 13) * 2);
        g.fillStyle = "rgba(60,40,20,0.55)";
        g.fillRect(cx - 0.6, cy, 1.2, s * 0.9);
        g.fillStyle = hash(x, y, 14) < 0.5 ? "#5f8f4f" : "#6e9e58";
        g.strokeStyle = "rgba(60,40,20,0.7)";
        g.lineWidth = 0.9;
        g.beginPath();
        g.arc(cx, cy, s * 0.95, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else if (t === Tile.Water && hash(x, y, 15) < 0.35) {
        g.strokeStyle = "rgba(255,255,255,0.55)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(X(x), Y(y + 1));
        g.quadraticCurveTo(X(x + 1), Y(y + 0.5), X(x + 2), Y(y + 1));
        g.stroke();
      }
    }
  }
  for (const b of m.buildings) {
    if (!seenZone(b.tx, b.ty)) continue;
    const x = X(b.tx);
    const y = Y(b.ty);
    const w = b.tw * s;
    const h = b.th * s;
    g.fillStyle = "#b8604a";
    g.strokeStyle = INK;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y + h * 0.45);
    g.lineTo(x + w / 2, y - h * 0.15);
    g.lineTo(x + w, y + h * 0.45);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#efe2c2";
    g.fillRect(x + w * 0.1, y + h * 0.45, w * 0.8, h * 0.55);
    g.strokeRect(x + w * 0.1, y + h * 0.45, w * 0.8, h * 0.55);
  }

  // Fog: unexplored land hides under soft parchment clouds.
  for (let y = 0; y < m.outdoorHeight; y += 3) {
    for (let x = 0; x < m.width; x += 3) {
      if (m.get(x + 1, y + 1) === Tile.Void || seenZone(x + 1, y + 1)) continue;
      const cx = X(x + 1.5 + (hash(x, y, 21) - 0.5) * 1.5);
      const cy = Y(y + 1.5 + (hash(x, y, 22) - 0.5) * 1.5);
      const r = s * (3.2 + hash(x, y, 23) * 1.6);
      const fgr = g.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
      fgr.addColorStop(0, "rgba(232,218,182,0.95)");
      fgr.addColorStop(1, "rgba(232,218,182,0)");
      g.fillStyle = fgr;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }
  // Faint swirls in the fog, like an unfinished survey.
  g.strokeStyle = "rgba(120,90,50,0.22)";
  g.lineWidth = 1.2;
  for (let y = 4; y < m.outdoorHeight; y += 12) {
    for (let x = 4; x < m.width; x += 14) {
      if (m.get(x, y) === Tile.Void || seenZone(x, y) || hash(x, y, 24) < 0.4) continue;
      const cx = X(x);
      const cy = Y(y);
      g.beginPath();
      g.arc(cx, cy, s * 1.6, Math.PI * 0.9, Math.PI * 2.2);
      g.arc(cx + s * 2.4, cy, s * 1.1, Math.PI, Math.PI * 2.1);
      g.stroke();
    }
  }

  // Landmarks.
  for (const o of m.objects) {
    const x = X(o.x / TILE);
    const y = Y(o.y / TILE);
    if (o.kind === "waystone" && marks.known.has(`ws:${o.id}`)) {
      g.fillStyle = "#6fc8e8";
      g.strokeStyle = INK;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x, y - 8);
      g.lineTo(x + 4.5, y);
      g.lineTo(x, y + 5);
      g.lineTo(x - 4.5, y);
      g.closePath();
      g.fill();
      g.stroke();
    } else if ((o.kind === "door" && seenZone(o.x / TILE, o.y / TILE)) || (o.kind === "gate" && o.id === "ascent-gate")) {
      g.fillStyle = o.kind === "gate" ? "#f2d27a" : "#6f6a5e";
      g.strokeStyle = INK;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x - 6, y + 5);
      g.lineTo(x - 6, y - 2);
      g.arc(x, y - 2, 6, Math.PI, 0);
      g.lineTo(x + 6, y + 5);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = INK;
      g.fillRect(x - 2.5, y - 1, 5, 6);
    }
  }

  // Region names.
  g.textAlign = "center";
  g.textBaseline = "middle";
  // The land between named places belongs to the floor-wide zone; label it where it's widest.
  const open = m.zones.find((z) => z.x0 === 0 && z.y0 === 0 && z.x1 >= m.width);
  let sx = 0;
  let sy = 0;
  let n = 0;
  if (open) {
    for (let y = 0; y < m.outdoorHeight; y += 3) {
      for (let x = 0; x < m.width; x += 3) {
        if (m.get(x, y) !== Tile.Grass || m.zoneAt(x * TILE + 16, y * TILE + 16) !== open) continue;
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  for (const z of m.zones) {
    const isOpen = z === open;
    // A floor-wide zone that owns only scraps of land (Floor 2's sky between islands) gets no label.
    if (z.secret || (!isOpen && !marks.known.has(`zone:${z.id}`)) || (isOpen && n < 30)) continue;
    const cx = isOpen ? X(sx / n) : X((z.x0 + z.x1) / 2);
    const cy = isOpen ? Y(sy / n) : Y((z.y0 + z.y1) / 2);
    g.font = z.safe ? "bold 15px Georgia" : "italic bold 14px Georgia";
    g.lineWidth = 4;
    g.strokeStyle = "rgba(242,230,198,0.85)";
    g.strokeText(z.name, cx, cy);
    g.fillStyle = INK;
    g.fillText(z.name, cx, cy);
  }

  // Quest pins, numbered.
  marks.pins.forEach((p) => {
    const x = X(p.x / TILE);
    const y = Y(p.y / TILE);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(x, y + 1, 5, 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.main ? "#f2d27a" : "#9fd3ff";
    g.strokeStyle = INK;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x - 9, y - 10, x - 7, y - 21, x, y - 21);
    g.bezierCurveTo(x + 7, y - 21, x + 9, y - 10, x, y);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.font = "bold 10px Trebuchet MS";
    g.fillText(String(p.n), x, y - 13);
  });

  // Party and you.
  for (const p of marks.party) {
    g.fillStyle = "#6fb0e0";
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(X(p.x / TILE), Y(p.y / TILE), 4, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  if (marks.me) {
    const x = X(marks.me.x / TILE);
    const y = Y(marks.me.y / TILE);
    const a = marks.me.face;
    const pt = (r: number, da: number) => [x + Math.cos(a + da) * r, y + Math.sin(a + da) * r] as const;
    g.fillStyle = "rgba(242,210,122,0.35)";
    g.beginPath();
    g.arc(x, y, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#c4402c";
    g.strokeStyle = INK;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(...pt(9, 0));
    g.lineTo(...pt(7, 2.4));
    g.lineTo(...pt(3, Math.PI));
    g.lineTo(...pt(7, -2.4));
    g.closePath();
    g.fill();
    g.stroke();
  }

  // The floor's name, in a cartouche at the top left.
  const title = m.name;
  g.font = "italic bold 17px Georgia";
  g.textAlign = "left";
  const tw = g.measureText(title).width;
  g.fillStyle = "rgba(242,230,198,0.9)";
  g.strokeStyle = INK;
  g.lineWidth = 1.5;
  g.beginPath();
  g.roundRect(margin + 6, margin + 6, tw + 24, 28, 6);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.fillText(title, margin + 18, margin + 21);
  g.textAlign = "center";

  // Compass rose.
  const rx = W - 46;
  const ry = 50;
  g.strokeStyle = INK;
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(rx, ry, 20, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 - Math.PI / 2;
    g.fillStyle = i === 0 ? "#c4402c" : INK;
    g.beginPath();
    g.moveTo(rx + Math.cos(a) * 26, ry + Math.sin(a) * 26);
    g.lineTo(rx + Math.cos(a + 0.35) * 7, ry + Math.sin(a + 0.35) * 7);
    g.lineTo(rx, ry);
    g.lineTo(rx + Math.cos(a - 0.35) * 7, ry + Math.sin(a - 0.35) * 7);
    g.closePath();
    g.fill();
  }
  g.font = "bold 11px Georgia";
  g.fillStyle = INK;
  g.fillText("N", rx, ry - 33);

  // Legend for the pins.
  g.textAlign = "left";
  let lx = margin;
  const ly = H - 20;
  g.font = "bold 12px Georgia";
  marks.pins.forEach((p) => {
    const label = `${p.n}  ${p.label}`;
    g.fillStyle = p.main ? "#8a5a10" : "#2e5a7a";
    g.fillText(label, lx, ly);
    lx += g.measureText(label).width + 22;
  });

  // Frame.
  g.strokeStyle = "rgba(74,53,32,0.8)";
  g.lineWidth = 2;
  g.strokeRect(8, 8, W - 16, H - 16);
  g.lineWidth = 1;
  g.strokeRect(13, 13, W - 26, H - 26);
}
