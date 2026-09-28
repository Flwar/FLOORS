import type { Client } from "colyseus";
import { buildFloor2Landing, type WorldMap } from "@floors/shared";
import type { Character } from "../game/character.ts";
import { GameRoom } from "./GameRoom.ts";

/** Skyreach Landing — the reward for clearing Floor 1: the first glimpse of Floor 2. */
export class Floor2Room extends GameRoom {
  readonly kind = "floor2" as const;

  protected buildMap(): WorldMap {
    return buildFloor2Landing();
  }

  protected spawnPoint(_ch: Character, _respawn: boolean) {
    const a = Math.random() * Math.PI * 2;
    return { x: this.map.spawn.x + Math.cos(a) * 30, y: this.map.spawn.y + Math.sin(a) * 18 };
  }

  protected setup() {
    this.autoDispose = false;
    this.onMessage("interact", (client, id: string) => this.interact(client, String(id)));
  }

  async onAuth(client: Client, options: Parameters<GameRoom["onAuth"]>[1]) {
    const auth = await super.onAuth(client, options);
    return auth;
  }

  protected onPlayerJoined(sid: string, ch: Character) {
    const client = this.clients.getById(sid);
    if (ch.data.floor < 2) {
      // Only climbers who beat the Keeper may stand here.
      client?.send("travel", { room: "world" });
      return;
    }
    if (!ch.data.discovered.includes("zone:skyreach")) {
      ch.data.discovered.push("zone:skyreach");
      ch.dirty = true;
    }
    client?.send("discover", { name: "Floor 2", secret: false, sub: "Skyreach Landing" });
  }

  /** Leaving the landing returns you to Emberwatch. */
  protected onPlayerLeft(_sid: string, ch: Character) {
    ch.data.pos = { room: "town", x: 0, y: 0, hp: ch.data.pos?.hp };
  }

  private interact(client: Client, id: string) {
    const me = this.player(client);
    if (!me) return;
    const npc = this.map.npcs.find((n) => n.id === id);
    if (npc && Math.hypot(npc.x - me.p.x, npc.y - me.p.y) < 60) {
      client.send("dialog", { npc: npc.id, name: npc.name, role: npc.role, greeting: npc.greeting, offers: [], done: [], services: [] });
      return;
    }
    const obj = this.map.object(id);
    if (!obj || Math.hypot(obj.x - me.p.x, obj.y - me.p.y) > 60) return;
    if (obj.kind === "lore") client.send("lore", { name: obj.name, text: obj.text });
    if (obj.id === "descent") client.send("travel", { room: "world" });
  }
}
