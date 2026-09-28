import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineRoom, defineServer } from "colyseus";
import express from "express";
import { SERVER_PORT } from "@floors/shared";
import { DungeonRoom } from "./rooms/DungeonRoom.ts";
import { Floor2Room } from "./rooms/Floor2Room.ts";
import { Floor3Room } from "./rooms/Floor3Room.ts";
import { RoostRoom } from "./rooms/RoostRoom.ts";
import { StormspireRoom } from "./rooms/StormspireRoom.ts";
import { WorldRoom } from "./rooms/WorldRoom.ts";

// The built client (npm run build), served from the same port so players need one address.
const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));
const serveClient = existsSync(clientDist) && process.env.NODE_ENV === "production";

const server = defineServer({
  rooms: {
    world: defineRoom(WorldRoom),
    dungeon: defineRoom(DungeonRoom),
    floor2: defineRoom(Floor2Room),
    stormspire: defineRoom(StormspireRoom),
    floor3: defineRoom(Floor3Room),
    roost: defineRoom(RoostRoom),
  },
  express: serveClient
    ? (app) => {
        app.get("/health", (_req, res) => {
          res.json({ ok: true });
        });
        app.use(express.static(clientDist, { index: "index.html", maxAge: "1h" }));
      }
    : undefined,
});

const port = Number(process.env.PORT) || SERVER_PORT;
await server.listen(port);
console.log(serveClient ? `[server] game running at http://localhost:${port}` : `[server] listening on ws://localhost:${port}`);
