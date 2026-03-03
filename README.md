# Navmesh Full-Stack Assignment

Implementation of the provided assignment:

- Node.js authoritative server with WebSocket state sync
- Scene built from one floor cube and 4 obstacle cubes
- Navmesh baked on server startup from scene primitives
- Enemy AI that pathfinds on the navmesh to chase players
- Browser client (Three.js) for movement + enemy path visualization

## Tech

- Node.js + Express + `ws`
- Browser-side Three.js (ES module from CDN)

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`

## Change obstacle layout

Edit obstacle definitions in:

- `src/scene.js`

Then restart the server. Navmesh is rebuilt at startup.

## Architecture

- `src/scene.js`: world primitives
- `src/navmesh.js`: navmesh baking (grid walkability) + A* pathfinding
- `src/gameServer.js`: authoritative simulation (players + enemy AI)
- `src/index.js`: HTTP + WebSocket bootstrap
- `public/main.js`: client rendering/input and state visualization

## Notes

- Movement/collision and AI are server authoritative.
- Client only sends input vectors and renders snapshots.
- The navmesh is represented as walkable grid cells derived from primitive geometry.
