import { resolveRuntimeConfig } from "../core/runtimeConfig.js";
import { GameStore } from "../store/GameStore.js";
import { WebSocketGameClient } from "../network/WebSocketGameClient.js";
import { InputController } from "../input/InputController.js";
import { ThreeWorldRenderer } from "../render/ThreeWorldRenderer.js";

export function createGameApplication({ mountElement, onUiStateChange }) {
  const store = new GameStore();
  const renderer = new ThreeWorldRenderer(mountElement);
  const config = resolveRuntimeConfig();

  const wsClient = new WebSocketGameClient({
    url: config.backendWsUrl,
    onConnectionChange: (status) => store.setConnectionStatus(status),
    onInit: (msg) => {
      store.applyInit(msg);
      renderer.setWorld(msg.scene, msg.navmesh);
      renderer.renderState(store.getState());
    },
    onState: (msg) => {
      store.applyState(msg);
      renderer.renderState(store.getState());
    }
  });

  const input = new InputController({
    onInput: (vector) => wsClient.sendInput(vector)
  });

  const unsubscribe = store.subscribe((state) => {
    onUiStateChange({
      aiMode: state.aiMode,
      enemyCount: state.enemies.length,
      connectionStatus: state.connectionStatus
    });
  });

  renderer.mount();
  wsClient.connect();
  input.start();

  return {
    setAiMode: (mode) => wsClient.setAiMode(mode),
    spawnEnemy: () => wsClient.spawnEnemy(),
    dispose: () => {
      unsubscribe();
      input.stop();
      wsClient.disconnect();
      renderer.dispose();
    }
  };
}
