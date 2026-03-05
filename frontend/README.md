# Frontend

Browser client for rendering scene, sending input, and UI controls.

## Run

```bash
npm start
```

Serves static files at `http://localhost:5173`.

## Backend connection

By default, frontend connects to:

- `ws://localhost:3000`

Override with query params:

- `?backendHost=localhost&backendPort=3000`
