import { TILE, type WorldMap } from "@floors/shared";

/**
 * Grid A* over a per-tile walkability mask. Paths are tile-centre waypoints in
 * world pixels. Bounded by `maxNodes` so a hopeless search can't stall a tick.
 */
export class PathGrid {
  readonly w: number;
  readonly h: number;
  private g: Float32Array;
  private f: Float32Array;
  private parent: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private run = 0;
  private heap: number[] = [];

  constructor(private map: WorldMap, private blocked: Uint8Array) {
    this.w = map.width;
    this.h = map.height;
    const n = this.w * this.h;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  setBlocked(tx: number, ty: number, blocked: boolean) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.blocked[ty * this.w + tx] = blocked ? 1 : 0;
  }

  isBlocked(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    return this.blocked[ty * this.w + tx] === 1;
  }

  /** True if a body of radius r can travel in a straight line between the points. */
  lineClear(x0: number, y0: number, x1: number, y1: number, r: number): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 10));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        if (this.isBlocked(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false;
      }
    }
    return true;
  }

  find(sx: number, sy: number, tx: number, ty: number, maxNodes = 2500): { x: number; y: number }[] | null {
    const w = this.w;
    let start = Math.floor(sy / TILE) * w + Math.floor(sx / TILE);
    const goalX = Math.floor(tx / TILE);
    const goalY = Math.floor(ty / TILE);
    if (this.isBlocked(goalX, goalY)) return null;
    const goal = goalY * w + goalX;
    if (this.blocked[start]) {
      // Standing on an edge tile (e.g. pushed into a corner): search from a free neighbour.
      const sxT = start % w;
      const syT = (start / w) | 0;
      let found = -1;
      for (const [dx, dy] of NEIGHBOURS) if (!this.isBlocked(sxT + dx, syT + dy)) { found = (syT + dy) * w + sxT + dx; break; }
      if (found < 0) return null;
      start = found;
    }

    this.run++;
    const run = this.run;
    const heap = this.heap;
    heap.length = 0;
    this.stamp[start] = run;
    this.g[start] = 0;
    this.f[start] = this.h2(start, goalX, goalY);
    this.parent[start] = -1;
    this.push(start);
    let expanded = 0;

    while (heap.length) {
      const cur = this.pop();
      if (cur === goal) return this.build(cur);
      if (this.closed[cur] === run) continue;
      this.closed[cur] = run;
      if (++expanded > maxNodes) return null;
      const cx = cur % w;
      const cy = (cur / w) | 0;
      for (const [dx, dy, cost] of NEIGHBOURS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (this.isBlocked(nx, ny)) continue;
        // No corner cutting through walls.
        if (dx && dy && (this.isBlocked(cx + dx, cy) || this.isBlocked(cx, cy + dy))) continue;
        const n = ny * w + nx;
        if (this.closed[n] === run) continue;
        const g = this.g[cur] + cost;
        if (this.stamp[n] !== run || g < this.g[n]) {
          this.stamp[n] = run;
          this.g[n] = g;
          this.f[n] = g + this.h2(n, goalX, goalY);
          this.parent[n] = cur;
          this.push(n);
        }
      }
    }
    return null;
  }

  private h2(n: number, gx: number, gy: number) {
    const dx = Math.abs((n % this.w) - gx);
    const dy = Math.abs(((n / this.w) | 0) - gy);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  }

  private build(end: number) {
    const out: { x: number; y: number }[] = [];
    for (let n = end; n !== -1; n = this.parent[n]) {
      out.push({ x: (n % this.w) * TILE + TILE / 2, y: ((n / this.w) | 0) * TILE + TILE / 2 });
    }
    out.reverse();
    return out;
  }

  private push(n: number) {
    const heap = this.heap;
    const f = this.f;
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[heap[p]] <= f[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }

  private pop(): number {
    const heap = this.heap;
    const f = this.f;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  }
}

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
