import { ClientMessageType, ServerMessageType } from "../core/protocol.js";

export class WebSocketGameClient {
  constructor({ url, onInit, onState, onConnectionChange }) {
    this.url = url;
    this.onInit = onInit;
    this.onState = onState;
    this.onConnectionChange = onConnectionChange;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.onConnectionChange?.("connecting");

    this.ws.addEventListener("open", () => this.onConnectionChange?.("connected"));
    this.ws.addEventListener("close", () => this.onConnectionChange?.("disconnected"));
    this.ws.addEventListener("error", () => this.onConnectionChange?.("error"));

    this.ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === ServerMessageType.INIT) {
        this.onInit?.(msg);
      }

      if (msg.type === ServerMessageType.STATE) {
        this.onState?.(msg);
      }
    });
  }

  sendInput(input) {
    this.send({ type: ClientMessageType.INPUT, input });
  }

  setAiMode(mode) {
    this.send({ type: ClientMessageType.SET_AI_MODE, mode });
  }

  spawnEnemy() {
    this.send({ type: ClientMessageType.SPAWN_ENEMY });
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}
