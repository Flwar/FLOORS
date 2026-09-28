import { buildFloor3, type WorldMap } from "@floors/shared";
import type { Character } from "../game/character.ts";
import { FLOOR3_EVENTS, type EventDef } from "../game/events.ts";
import { WorldRoom } from "./WorldRoom.ts";

const RUMOURS = [
  "Drakes breathe in a cone, not a line. Step to the side, not back — back is where the fire goes.",
  "Something's buried past the canyon's northern ribs. There's a bridge of bone behind the basalt, if you look.",
  "Cindermaw sleeps in the Wyrmrest Caldera. It wears a sigil in its crest — the Roost's doors answer to it.",
  "The obsidian golems are slow, but when they glow, get out of the way. That's not a warning, it's a promise.",
  "Kaela at the Dragonforge works dragonscale like leather. Bring her scales and cinderstone.",
  "They say Ignivar has never lost a fight. They also say nobody has ever reached him. Both can't stay true forever.",
  "The Archivist in the Keep sells scrolls you won't find anywhere else. Bring Marks. Lots of Marks.",
];

/** Floor 3 — the Ember Reaches: volcanic isles and the dragons that nest there. */
export class Floor3Room extends WorldRoom {
  readonly kind = "floor3" as const;

  protected buildMap(): WorldMap {
    return buildFloor3();
  }

  protected eventDefs(): EventDef[] {
    return FLOOR3_EVENTS;
  }

  protected rumours(): string[] {
    return RUMOURS;
  }

  protected onPlayerJoined(sid: string, ch: Character) {
    const client = this.clients.getById(sid);
    if (ch.data.floor < 3 && !this.admins.has(sid)) {
      // Only climbers who beat the Keeper of the Storm may stand here.
      this.travel(sid, ch, "floor2");
      return;
    }
    if (!ch.data.discovered.includes("zone:ember-reaches")) {
      ch.data.discovered.push("zone:ember-reaches");
      ch.dirty = true;
      client?.send("discover", { name: "Floor 3", secret: false, sub: "The Ember Reaches" });
    }
  }
}
