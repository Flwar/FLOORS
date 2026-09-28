import "./hud.css";
import "./ui.css";
import * as Phaser from "phaser";
import { music } from "./audio/music.ts";
import { sfx } from "./audio/sfx.ts";
import { Session } from "./net.ts";
import { WorldScene } from "./scenes/WorldScene.ts";
import { settings } from "./settings.ts";
import { showLogin } from "./ui/login.ts";
import { GameUI } from "./ui/ui.ts";

const status = document.querySelector<HTMLElement>("#status")!;
const session = new Session();
const ui = new GameUI(() => session.room);

settings.onChange((s) => {
  sfx.setVolume(s.sfx);
  music.setVolume(s.music);
});
settings.setUploader((s) => session.room?.send("settings", s));
ui.onLogout = () => {
  session.logout();
  location.reload();
};

async function connect() {
  status.textContent = "Connecting…";
  try {
    if (session.guest || session.token) {
      await session.resume();
      return;
    }
  } catch {
    // Expired session: fall through to the login screen.
  }
  status.textContent = "";
  await showLogin(session);
}

async function start() {
  await connect();
  status.textContent = "";
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    antialias: true,
    roundPixels: false,
    transparent: false,
    backgroundColor: "#0b1016",
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [],
    callbacks: {
      postBoot: (game) => game.scene.add("world", WorldScene, true, { session, ui }),
    },
  });
}

start().catch((err) => {
  console.error(err);
  status.textContent = `Could not reach the world server (${err instanceof Error ? err.message : err}).`;
});
