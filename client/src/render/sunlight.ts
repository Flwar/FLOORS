import type * as Phaser from "phaser";

/**
 * The light the world is lit by right now, set by the scene every frame: where shadows fall
 * (dir), how long they are per unit of height (len) and how dark (shade, 0 where there's no
 * sky: dungeons and interiors).
 */
export const SUN = { dir: -Math.PI / 2, len: 0.3, shade: 0 };

/** The blob texture's width at scale 1. */
const BLOB_W = 44;

/**
 * A character's cast shadow: the blob texture laid along the direction shadows fall, starting
 * at the feet and as long as the light makes it. `sx`/`sy` are the contact shadow's scale,
 * `height` how tall the caster stands (in blob widths), `alpha` the caster's own alpha.
 */
export function castShadow(img: Phaser.GameObjects.Image, sx: number, sy: number, height: number, alpha: number) {
  const s = SUN;
  if (s.shade < 0.02) {
    img.setVisible(false);
    return;
  }
  const length = 0.7 + s.len * height;
  const w = BLOB_W * sx * length;
  img
    .setVisible(true)
    .setRotation(s.dir)
    .setScale(sx * length, sy * 0.8)
    .setPosition(Math.cos(s.dir) * w * 0.42, Math.sin(s.dir) * w * 0.42)
    .setAlpha(alpha * s.shade * 0.55);
}
