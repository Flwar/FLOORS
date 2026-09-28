/** Attack areas, expressed relative to the attacker's position and aim. */
export type Shape =
  | { kind: "arc"; range: number; arc: number; inner?: number }
  | { kind: "line"; length: number; width: number }
  | { kind: "circle"; radius: number; offset: number };

export const AIM_STEPS = 256;
export const aimToRad = (aim: number) => (aim / AIM_STEPS) * Math.PI * 2;
export const radToAim = (rad: number) => ((Math.round((rad / (Math.PI * 2)) * AIM_STEPS) % AIM_STEPS) + AIM_STEPS) % AIM_STEPS;

export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Does `shape`, cast from (ox, oy) facing `rad`, touch a circle at (tx, ty) with radius tr? */
export function shapeHits(shape: Shape, ox: number, oy: number, rad: number, tx: number, ty: number, tr: number): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  switch (shape.kind) {
    case "arc": {
      const dist = Math.hypot(dx, dy);
      if (dist - tr > shape.range) return false;
      if (shape.inner && dist + tr < shape.inner) return false;
      if (dist < tr) return true; // overlapping the origin
      const slack = Math.asin(Math.min(1, tr / dist));
      return Math.abs(angleDiff(Math.atan2(dy, dx), rad)) <= shape.arc / 2 + slack;
    }
    case "line": {
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const along = dx * c + dy * s;
      const across = -dx * s + dy * c;
      return along >= -tr && along <= shape.length + tr && Math.abs(across) <= shape.width / 2 + tr;
    }
    case "circle": {
      const cx = ox + Math.cos(rad) * shape.offset;
      const cy = oy + Math.sin(rad) * shape.offset;
      return Math.hypot(tx - cx, ty - cy) <= shape.radius + tr;
    }
  }
}

/** Rough reach of a shape, for broad-phase culling. */
export function shapeReach(shape: Shape): number {
  switch (shape.kind) {
    case "arc":
      return shape.range;
    case "line":
      return Math.hypot(shape.length, shape.width / 2);
    case "circle":
      return shape.offset + shape.radius;
  }
}
