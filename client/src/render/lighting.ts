import * as Phaser from "phaser";

export interface Light {
  x: number;
  y: number;
  r: number;
  /** 0–1 flicker amount. */
  flicker?: number;
  color?: number;
}

/**
 * Darkness overlay for caves and the Undercroft. Lights are punched out of a
 * screen-sized render texture each frame with a soft radial brush.
 */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Graphics;
  private darkness = 0;
  target = 0;
  /** The colour of the dark: cave black, night blue, or the warm dim of dusk. */
  color = 0x05070c;

  constructor(private scene: Phaser.Scene) {
    if (!scene.textures.exists("lightBrush")) {
      const tex = scene.textures.createCanvas("lightBrush", 256, 256)!;
      const g = tex.getContext();
      const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.7)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      tex.refresh();
    }
    this.rt = scene.add.renderTexture(0, 0, scene.scale.width, scene.scale.height).setOrigin(0).setScrollFactor(0).setDepth(2e6 - 10);
    this.brush = new Phaser.GameObjects.Image(scene, 0, 0, "lightBrush");
    this.glow = scene.add.graphics().setDepth(2e6 - 11).setBlendMode(Phaser.BlendModes.ADD);
  }

  update(cam: Phaser.Cameras.Scene2D.Camera, lights: Light[], dtMs: number) {
    this.darkness += (this.target - this.darkness) * Math.min(1, dtMs / 500);
    this.glow.clear();
    if (this.darkness < 0.02) {
      this.rt.setVisible(false);
      return;
    }
    this.rt.setVisible(true);
    // Screen-fixed objects are still scaled by camera zoom around the screen centre, so
    // size the overlay at 1/zoom and place it where zooming maps it back onto the screen.
    const z = cam.zoom;
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const w = Math.ceil(W / z) + 4;
    const h = Math.ceil(H / z) + 4;
    if (this.rt.width !== w || this.rt.height !== h) this.rt.resize(w, h);
    this.rt.setPosition(W / 2 - W / (2 * z) - 2, H / 2 - H / (2 * z) - 2);
    this.rt.clear();
    this.rt.fill(this.color, this.darkness);
    const t = performance.now();
    for (const l of lights) {
      // In overlay pixels (= world units): world position relative to the view's top-left.
      const sx = l.x - cam.worldView.x + 2;
      const sy = l.y - cam.worldView.y + 2;
      const r = l.r * (1 + (l.flicker ?? 0) * Math.sin(t / 90 + l.x) * 0.06);
      if (sx < -r || sy < -r || sx > w + r || sy > h + r) continue;
      this.brush.setDisplaySize(r * 2, r * 2);
      this.rt.erase(this.brush, sx, sy);
      if (l.color) {
        this.glow.fillStyle(l.color, 0.14 * this.darkness);
        this.glow.fillCircle(l.x, l.y, l.r * 0.6);
      }
    }
    this.rt.render();
  }
}
