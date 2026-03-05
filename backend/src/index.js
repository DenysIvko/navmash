import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { GameServer } from "./gameServer.js";

const PORT = process.env.PORT || 3000;

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });
const game = new GameServer();

game.start();

wss.on("connection", (ws) => {
  game.addClient(ws);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Navmesh cells: ${game.navmesh.walkableCells.length}`);
});
