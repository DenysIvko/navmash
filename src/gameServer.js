import { bakeNavmesh, findPath, isPositionWalkable } from "./navmesh.js";
import { sceneDefinition } from "./scene.js";

const PLAYER_SPEED = 5;
const PLAYER_RADIUS = 0.35;
const ENEMY_SPEED = 3.2;
const AI_REPATH_INTERVAL = 0.1;
const MAX_LEAD_TIME = 2.5;

export class GameServer {
  constructor() {
    this.scene = sceneDefinition;
    this.navmesh = bakeNavmesh(this.scene, { cellSize: 0.5, agentRadius: PLAYER_RADIUS });
    this.clients = new Map();
    this.players = new Map();
    this.accumAiTime = 0;
    this.lastTickTime = Date.now();

    this.enemy = {
      x: 0,
      z: 0,
      radius: 0.4,
      speed: ENEMY_SPEED,
      path: [],
      targetPlayerId: null
    };
  }

  start() {
    this.interval = setInterval(() => this.tick(), 50);
  }

  stop() {
    clearInterval(this.interval);
  }

  addClient(ws) {
    const id = `p-${Math.random().toString(36).slice(2, 8)}`;
    this.clients.set(id, ws);

    const spawn = this.findSpawn();
    this.players.set(id, {
      id,
      x: spawn.x,
      z: spawn.z,
      vx: 0,
      vz: 0,
      radius: PLAYER_RADIUS,
      speed: PLAYER_SPEED,
      input: { x: 0, z: 0 }
    });

    ws.send(JSON.stringify({
      type: "init",
      yourPlayerId: id,
      scene: this.scene,
      navmesh: {
        cellSize: this.navmesh.cellSize,
        width: this.navmesh.width,
        height: this.navmesh.height,
        floorBounds: this.navmesh.floorBounds,
        walkableCells: this.navmesh.walkableCells
      }
    }));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(id, msg);
      } catch {
        // Ignore malformed payloads.
      }
    });

    ws.on("close", () => {
      this.clients.delete(id);
      this.players.delete(id);
      if (this.enemy.targetPlayerId === id) {
        this.enemy.targetPlayerId = null;
        this.enemy.path = [];
      }
    });
  }

  handleMessage(playerId, msg) {
    if (msg.type !== "input") {
      return;
    }

    const p = this.players.get(playerId);
    if (!p) {
      return;
    }

    const inputX = Number(msg.input?.x) || 0;
    const inputZ = Number(msg.input?.z) || 0;
    const len = Math.hypot(inputX, inputZ) || 1;
    p.input.x = inputX / len;
    p.input.z = inputZ / len;
  }

  findSpawn() {
    const preferred = [
      { x: -9, z: -9 },
      { x: 9, z: 9 },
      { x: -9, z: 9 },
      { x: 9, z: -9 },
      { x: 0, z: 9 }
    ];
    for (const pos of preferred) {
      if (isPositionWalkable(this.navmesh, pos)) {
        return pos;
      }
    }
    return { x: 0, z: 0 };
  }

  tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTickTime) / 1000, 0.1);
    this.lastTickTime = now;

    for (const player of this.players.values()) {
      this.integratePlayer(player, dt);
    }

    this.accumAiTime += dt;
    if (this.accumAiTime >= AI_REPATH_INTERVAL) {
      this.accumAiTime = 0;
      this.refreshEnemyPath();
    }
    this.integrateEnemy(dt);

    const snapshot = {
      type: "state",
      players: [...this.players.values()].map((p) => ({ id: p.id, x: p.x, z: p.z })),
      enemy: {
        x: this.enemy.x,
        z: this.enemy.z,
        targetPlayerId: this.enemy.targetPlayerId,
        path: this.enemy.path
      }
    };

    const payload = JSON.stringify(snapshot);
    for (const ws of this.clients.values()) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }

  integratePlayer(player, dt) {
    const prevX = player.x;
    const prevZ = player.z;

    const desiredX = player.x + player.input.x * player.speed * dt;
    const desiredZ = player.z + player.input.z * player.speed * dt;

    const stepX = { x: desiredX, z: player.z };
    if (isPositionWalkable(this.navmesh, stepX)) {
      player.x = stepX.x;
    }

    const stepZ = { x: player.x, z: desiredZ };
    if (isPositionWalkable(this.navmesh, stepZ)) {
      player.z = stepZ.z;
    }

    if (dt > 0) {
      player.vx = (player.x - prevX) / dt;
      player.vz = (player.z - prevZ) / dt;
    }
  }

  getInterceptTime(enemyPos, targetPos, targetVel) {
    const rx = targetPos.x - enemyPos.x;
    const rz = targetPos.z - enemyPos.z;
    const rr = rx * rx + rz * rz;
    if (rr < 1e-6) {
      return 0;
    }

    const vx = targetVel.x;
    const vz = targetVel.z;
    const vv = vx * vx + vz * vz;
    const speed = this.enemy.speed;

    // ||r + v*t|| = speed*t -> (v.v - s^2)t^2 + 2(r.v)t + r.r = 0
    const a = vv - speed * speed;
    const b = 2 * (rx * vx + rz * vz);
    const c = rr;

    let t = Math.sqrt(rr) / Math.max(speed, 1e-6);

    if (Math.abs(a) < 1e-6) {
      if (Math.abs(b) > 1e-6) {
        const linearT = -c / b;
        if (linearT > 0) {
          t = linearT;
        }
      }
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);
        const valid = [t1, t2].filter((value) => value > 0);
        if (valid.length > 0) {
          t = Math.min(...valid);
        }
      }
    }

    return Math.max(0, Math.min(t, MAX_LEAD_TIME));
  }

  refreshEnemyPath() {
    const players = [...this.players.values()];
    if (players.length === 0) {
      this.enemy.targetPlayerId = null;
      this.enemy.path = [];
      return;
    }

    let best = players[0];
    let bestLeadTarget = { x: best.x, z: best.z };
    let bestInterceptTime = Number.POSITIVE_INFINITY;

    for (const p of players) {
      const interceptTime = this.getInterceptTime(
        { x: this.enemy.x, z: this.enemy.z },
        { x: p.x, z: p.z },
        { x: p.vx, z: p.vz }
      );
      const leadTarget = {
        x: p.x + p.vx * interceptTime,
        z: p.z + p.vz * interceptTime
      };

      if (interceptTime < bestInterceptTime) {
        best = p;
        bestLeadTarget = leadTarget;
        bestInterceptTime = interceptTime;
      }
    }

    this.enemy.targetPlayerId = best.id;
    this.enemy.path = findPath(this.navmesh, { x: this.enemy.x, z: this.enemy.z }, bestLeadTarget);
  }

  integrateEnemy(dt) {
    if (this.enemy.path.length === 0) {
      return;
    }

    let remaining = this.enemy.speed * dt;

    while (remaining > 0 && this.enemy.path.length > 0) {
      const target = this.enemy.path[0];
      const dx = target.x - this.enemy.x;
      const dz = target.z - this.enemy.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.0001) {
        this.enemy.path.shift();
        continue;
      }

      if (remaining >= dist) {
        this.enemy.x = target.x;
        this.enemy.z = target.z;
        remaining -= dist;
        this.enemy.path.shift();
      } else {
        const t = remaining / dist;
        this.enemy.x += dx * t;
        this.enemy.z += dz * t;
        remaining = 0;
      }
    }
  }
}
