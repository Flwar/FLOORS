import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineRoom, defineServer } from "colyseus";
import express from "express";
import { SERVER_PORT, TOWER } from "@floors/shared";
import { DungeonRoom } from "./rooms/DungeonRoom.ts";
import { GlacierRoom } from "./rooms/GlacierRoom.ts";
import type { InstanceRoom } from "./rooms/InstanceRoom.ts";
import { RoostRoom } from "./rooms/RoostRoom.ts";
import { SanctumRoom } from "./rooms/SanctumRoom.ts";
import { CathedralRoom } from "./rooms/CathedralRoom.ts";
import { EngineRoom } from "./rooms/EngineRoom.ts";
import { StormspireRoom } from "./rooms/StormspireRoom.ts";
import { floorRoom, WorldRoom } from "./rooms/WorldRoom.ts";

/** Each floor's boss dungeon: its own encounters and puzzles. */
const DUNGEONS: Record<string, new (...args: any[]) => InstanceRoom> = { dungeon: DungeonRoom, stormspire: StormspireRoom, roost: RoostRoom, glacier: GlacierRoom, sanctum: SanctumRoom, cathedral: CathedralRoom, engine: EngineRoom };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each room is its own class
const rooms: Record<string, any> = {};
for (const f of TOWER) {
  rooms[f.room] = defineRoom(f.n === 1 ? WorldRoom : floorRoom(f.n));
  rooms[f.dungeon] = defineRoom(DUNGEONS[f.dungeon]);
}

// The built client (npm run build), served from the same port so players need one address.
const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));
const serveClient = existsSync(clientDist) && process.env.NODE_ENV === "production";

const server = defineServer({
  rooms,
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
