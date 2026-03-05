import { useEffect, useRef, useState } from "react";
import { createGameApplication } from "../app/createGameApplication.js";
import { AiMode } from "../core/protocol.js";

export function App() {
  const mountRef = useRef(null);
  const appRef = useRef(null);
  const [uiState, setUiState] = useState({
    aiMode: AiMode.ADVANCED,
    enemyCount: 0,
    connectionStatus: "connecting"
  });

  useEffect(() => {
    if (!mountRef.current) {
      return undefined;
    }

    appRef.current = createGameApplication({
      mountElement: mountRef.current,
      onUiStateChange: setUiState
    });

    return () => appRef.current?.dispose();
  }, []);

  return (
    <div className="app-root">
      <div className="viewport" ref={mountRef} />

      <aside className="hud">
        <div><b>WASD</b> move player</div>
        <div>Green sphere: you</div>
        <div>Red sphere: enemy AI</div>
        <div>Cyan line: enemy path</div>
        <div>Enemies: <b>{uiState.enemyCount}</b></div>
        <div>Status: <b>{uiState.connectionStatus}</b></div>

        <label>
          AI Mode:
          <select
            value={uiState.aiMode}
            onChange={(e) => appRef.current?.setAiMode(e.target.value)}
          >
            <option value={AiMode.DEFAULT}>Default</option>
            <option value={AiMode.ADVANCED}>Advanced</option>
          </select>
        </label>

        <button type="button" onClick={() => appRef.current?.spawnEnemy()}>
          Spawn Enemy
        </button>
      </aside>
    </div>
  );
}
