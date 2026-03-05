# Frontend (React + Vite)

Modernized UI client for Navmash.

## Architecture

- `src/core` - runtime config + protocol constants
- `src/network` - WebSocket transport client
- `src/input` - keyboard intent controller
- `src/store` - app state store and subscriptions
- `src/render` - Three.js world renderer
- `src/app` - application composition/orchestration
- `src/ui` - React UI components/styles

This keeps responsibilities separate and testable.

## Run

From repo root:

```bash
npm install
npm start
```

Or frontend only:

```bash
cd frontend
npm install
npm start
```

Frontend URL: `http://localhost:5173`

## Backend Connection

Defaults to:

- `ws://<current-hostname>:3000`

Override with query params:

- `backendHost`
- `backendPort`

Example:

`http://localhost:5173/?backendHost=localhost&backendPort=3000`
