import { buildFloor2, type WorldMap } from "@floors/shared";
import type { Character } from "../game/character.ts";
import { FLOOR2_EVENTS, type EventDef } from "../game/events.ts";
import { WorldRoom } from "./WorldRoom.ts";

const RUMOURS = [
  "The Sentinels in the Sunken Gardens only wake when you step inside their walls. Mostly.",
  "Somebody saw golden feathers blowing off the gardens' north-west edge. There's an island out there, behind the trees.",
  "The Storm Colossus wears a seal on its chest. They say it opens the Stormspire.",
  "Windcallers love the Causeway bridges. One gust and you're flat on your back — keep your feet.",
  "The Aegis knights parry nothing, but their shields turn blows. Get around them.",
  "Brannoc can work gilded plate like soft copper. Bring him some.",
];

/** Floor 2 — the Gilded Terraces: a full floor, open to those who beat the Keeper. */
export class Floor2Room extends WorldRoom {
  readonly kind = "floor2" as const;

  protected buildMap(): WorldMap {
    return buildFloor2();
  }

  protected eventDefs(): EventDef[] {
    return FLOOR2_EVENTS;
  }

  protected rumours(): string[] {
    return RUMOURS;
  }

  protected onPlayerJoined(sid: string, ch: Character) {
    const client = this.clients.getById(sid);
    if (ch.data.floor < 2 && !this.admins.has(sid)) {
      // Only climbers who beat the Keeper may stand here.
      this.travel(sid, ch, "world");
      return;
    }
    if (!ch.data.discovered.includes("zone:skyreach")) {
      ch.data.discovered.push("zone:skyreach");
      ch.dirty = true;
      client?.send("discover", { name: "Floor 2", secret: false, sub: "The Gilded Terraces" });
    }
  }
}
