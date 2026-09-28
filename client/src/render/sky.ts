import * as Phaser from "phaser";

/**
 * The world floats: behind the island is open sky with parallax cloud banks and
 * distant islands drifting at different depths.
 */
export class Sky {
  private layers: { img: Phaser.GameObjects.TileSprite; speed: number; parallax: number; rise?: number }[] = [];
  private bg: Phaser.GameObjects.Graphics;
  private islands: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, tint: "day" | "dusk" | "gold" | "storm" | "ember" = "day") {
    const colors = tint === "ember" ? [0x6a2414, 0x1a0806] : tint === "gold" ? [0xf7dca0, 0xa9c6e8] : tint === "storm" ? [0x5a6a86, 0x2a3350] : tint === "dusk" ? [0x2a3350, 0x0e1320] : [0x8fc2e6, 0xd8ecf6];
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(-100);
    this.bg.fillGradientStyle(colors[0], colors[0], colors[1], colors[1], 1);
    this.bg.fillRect(0, 0, 4000, 3000);
    if (tint === "dusk") return;
    paintClouds(scene);
    const w = scene.scale.width;
    const h = scene.scale.height;
    for (const [key, parallax, speed, alpha, y] of [["cloudsFar", 0.12, 4, 0.55, 0], ["cloudsNear", 0.3, 9, 0.8, 0.35]] as const) {
      const img = scene.add.tileSprite(0, 0, w * 2, h * 2, key).setOrigin(0).setScrollFactor(0).setDepth(-90).setAlpha(alpha);
      img.tilePositionY = y * 512;
      // The Ember Reaches: the clouds are smoke, lit from below.
      if (tint === "ember") img.setTint(0x7a3a2a);
      this.layers.push({ img, speed, parallax });
    }
    if (tint === "ember") {
      // Embers rising out of the depths below the isles.
      paintEmbers(scene);
      for (const [parallax, rise, alpha] of [[0.2, 22, 0.8], [0.45, 40, 1]] as const) {
        const img = scene.add.tileSprite(0, 0, w * 2, h * 2, "skyEmbers").setOrigin(0).setScrollFactor(0).setDepth(-88).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD);
        this.layers.push({ img, speed: 3, parallax, rise });
      }
    }
    for (let i = 0; i < 5; i++) {
      const img = scene.add.image(0, 0, "farIsland").setScrollFactor(0.08 + i * 0.02).setDepth(-95).setAlpha(0.55 - i * 0.05).setScale(0.35 + (i % 3) * 0.12);
      if (tint === "ember") img.setTint(0x5a2a20);
      img.setPosition(300 + i * 900, 200 + ((i * 373) % 700));
      this.islands.push(img);
    }
    scene.scale.on("resize", () => this.resize());
  }

  private resize() {
    for (const l of this.layers) l.img.setSize(this.scene.scale.width * 2, this.scene.scale.height * 2);
  }

  update(cam: Phaser.Cameras.Scene2D.Camera, dtMs: number) {
    for (const l of this.layers) {
      l.img.tilePositionX = cam.scrollX * l.parallax + (l.img.tilePositionX - cam.scrollX * l.parallax) + (l.speed * dtMs) / 1000;
      l.img.tilePositionY = l.rise ? l.img.tilePositionY + (l.rise * dtMs) / 1000 : cam.scrollY * l.parallax * 0.6;
      l.img.setScale(1 / cam.zoom);
    }
  }
}

function paintEmbers(scene: Phaser.Scene) {
  if (scene.textures.exists("skyEmbers")) return;
  const tex = scene.textures.createCanvas("skyEmbers", 512, 512)!;
  const g = tex.getContext();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const r = 0.8 + rnd() * 2.2;
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 3);
    gr.addColorStop(0, rnd() < 0.5 ? "rgba(255,200,120,0.95)" : "rgba(255,120,50,0.9)");
    gr.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = gr;
    g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  tex.refresh();
}

function paintClouds(scene: Phaser.Scene) {
  if (scene.textures.exists("cloudsFar")) return;
  for (const [key, count, size, seed] of [["cloudsFar", 16, 70, 3], ["cloudsNear", 10, 120, 7]] as const) {
    const tex = scene.textures.createCanvas(key, 1024, 1024)!;
    const g = tex.getContext();
    let s = seed;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const cx = r() * 1024;
      const cy = r() * 1024;
      for (let k = 0; k < 7; k++) {
        const x = cx + (r() - 0.5) * size * 2;
        const y = cy + (r() - 0.5) * size * 0.5;
        const rad = size * (0.4 + r() * 0.5);
        // Draw wrapped so the texture tiles seamlessly.
        for (const ox of [-1024, 0, 1024])
          for (const oy of [-1024, 0, 1024]) {
            const grad = g.createRadialGradient(x + ox, y + oy, rad * 0.2, x + ox, y + oy, rad);
            grad.addColorStop(0, "rgba(255,255,255,0.9)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = grad;
            g.beginPath();
            g.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
            g.fill();
          }
      }
    }
    tex.refresh();
  }
  const isl = scene.textures.createCanvas("farIsland", 600, 360)!;
  const g = isl.getContext();
  g.fillStyle = "rgba(90,110,130,0.9)";
  g.beginPath();
  g.moveTo(20, 120);
  g.quadraticCurveTo(300, 60, 580, 120);
  g.lineTo(420, 200);
  g.lineTo(330, 340);
  g.lineTo(250, 220);
  g.lineTo(150, 190);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(110,150,120,0.9)";
  g.beginPath();
  g.ellipse(300, 110, 280, 26, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(80,100,110,0.9)";
  for (const [x, h] of [[240, 70], [300, 110], [360, 60]]) g.fillRect(x, 100 - h, 16, h);
  isl.refresh();
}
