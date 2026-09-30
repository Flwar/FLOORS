/**
 * Day and night: one clock for the whole tower, the same for everyone. A day lasts 24 minutes
 * (an hour a minute): dawn at 6, noon at 12, dusk at 18, midnight at 0. The sun rises in the
 * east, crosses the south at noon and sets in the west, so shadows swing from west, through
 * north (short), to east; by night the moon casts faint shadows of its own.
 */
export const DAY_MS = 24 * 60 * 1000;

/** Where in the day `ms` (epoch time) falls: 0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk. */
export const dayPhase = (ms: number) => (((ms % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS;

export interface SunState {
  phase: number;
  /** Height of the sun: 1 at noon, 0 at dawn and dusk, -1 at midnight. */
  elevation: number;
  /** Direction shadows fall (radians, screen space: 0 east, π/2 south, -π/2 north). */
  dir: number;
  /** Shadow length per unit of an object's height. */
  len: number;
  /** How dark shadows are (0–1): full by day, faint under the moon, gone at dawn and dusk. */
  shade: number;
  /** How dark the night is (0 by day, 1 in the middle of the night). */
  night: number;
  /** Warm light at dawn and dusk (0–1). */
  glow: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function sunAt(phase: number): SunState {
  // 0 at dawn (sun in the east), π/2 at noon (in the south), π at dusk (in the west).
  const a = (phase - 0.25) * Math.PI * 2;
  const elevation = Math.sin(a);
  const day = elevation > 0;
  // Light comes from the sun by day and from the moon, opposite it, by night.
  const light = day ? a : a + Math.PI;
  const h = Math.abs(elevation);
  return {
    phase,
    elevation,
    dir: light + Math.PI,
    len: 0.28 + 1.5 * Math.pow(1 - h, 1.6),
    // (Strong right down to the horizon: the long shadows of early morning and evening are the best ones.)
    shade: (day ? 1 : 0.4) * smooth(0, 0.1, h),
    night: smooth(0.08, -0.3, elevation),
    glow: Math.max(0, 1 - Math.abs(elevation) / 0.32),
  };
}

/** The tower's clock face: "14:20". */
export function clockLabel(phase: number) {
  const mins = Math.floor(phase * 24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** What the time of day is called. */
export function dayPart(phase: number) {
  const h = phase * 24;
  return h < 5 ? "Night" : h < 7 ? "Dawn" : h < 11 ? "Morning" : h < 13 ? "Noon" : h < 17 ? "Afternoon" : h < 19 ? "Dusk" : "Night";
}
