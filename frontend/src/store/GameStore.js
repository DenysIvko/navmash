import { AiMode } from "../core/protocol.js";

export class GameStore {
  constructor() {
    this.state = {
      connectionStatus: "disconnected",
      yourPlayerId: null,
      aiMode: AiMode.ADVANCED,
      scene: null,
      navmesh: null,
      players: [],
      enemies: []
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setConnectionStatus(connectionStatus) {
    this.state = { ...this.state, connectionStatus };
    this.emit();
  }

  applyInit(msg) {
    this.state = {
      ...this.state,
      yourPlayerId: msg.yourPlayerId,
      aiMode: msg.aiMode || this.state.aiMode,
      scene: msg.scene,
      navmesh: msg.navmesh
    };
    this.emit();
  }

  applyState(msg) {
    this.state = {
      ...this.state,
      aiMode: msg.aiMode || this.state.aiMode,
      players: msg.players || [],
      enemies: msg.enemies || []
    };
    this.emit();
  }

  emit() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
