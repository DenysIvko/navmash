# Backend

Authoritative Node.js game server with navmesh pathfinding and enemy AI.

## Run

```bash
npm install
npm start
```

Server defaults to `http://localhost:3000`.

## Structure

- `src/scene.js` - scene primitives
- `src/navmesh.js` - navmesh bake + pathfinding
- `src/gameServer.js` - simulation logic
- `src/index.js` - HTTP + WebSocket bootstrap
