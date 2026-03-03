import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141824);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 15, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xe7efff, 0x1f2538, 0.75);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(8, 15, 8);
scene.add(dir);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const players = new Map();
let yourPlayerId = null;
let enemyMesh = null;
let pathLine = null;
let navmeshGroup = null;
let aiMode = "advanced";
const aiModeSelect = document.getElementById("ai-mode");

function makeCube(size, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color })
  );
  return mesh;
}

function rebuildScene(world) {
  worldGroup.clear();

  const floor = makeCube(world.floor.size, 0x3b4158);
  floor.position.set(world.floor.center.x, world.floor.center.y, world.floor.center.z);
  worldGroup.add(floor);

  for (const obs of world.obstacles) {
    const obstacle = makeCube(obs.size, 0x6f7795);
    obstacle.position.set(obs.center.x, obs.center.y, obs.center.z);
    worldGroup.add(obstacle);
  }
}

function rebuildNavmesh(navmesh) {
  if (navmeshGroup) {
    scene.remove(navmeshGroup);
  }

  navmeshGroup = new THREE.Group();
  const cellHalf = navmesh.cellSize * 0.5;

  for (const cell of navmesh.walkableCells) {
    const geo = new THREE.PlaneGeometry(navmesh.cellSize * 0.88, navmesh.cellSize * 0.88);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2a6b68,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const tile = new THREE.Mesh(geo, mat);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(cell.wx, 0.52 + (cellHalf ? 0 : 0), cell.wz);
    navmeshGroup.add(tile);
  }

  scene.add(navmeshGroup);
}

function ensurePlayer(id) {
  if (players.has(id)) {
    return players.get(id);
  }

  const color = id === yourPlayerId ? 0x72f2a2 : 0x8cadff;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 16),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.y = 0.9;
  scene.add(mesh);

  players.set(id, mesh);
  return mesh;
}

function removeMissingPlayers(serverPlayers) {
  const ids = new Set(serverPlayers.map((p) => p.id));
  for (const [id, mesh] of players.entries()) {
    if (!ids.has(id)) {
      scene.remove(mesh);
      players.delete(id);
    }
  }
}

function renderEnemyPath(path) {
  if (pathLine) {
    scene.remove(pathLine);
  }

  if (!path || path.length < 2) {
    pathLine = null;
    return;
  }

  const points = path.map((p) => new THREE.Vector3(p.x, 1.2, p.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x56f0ff });
  pathLine = new THREE.Line(geometry, material);
  scene.add(pathLine);
}

const socket = new WebSocket(`ws://${location.host}`);
if (aiModeSelect) {
  aiModeSelect.addEventListener("change", () => {
    aiMode = aiModeSelect.value;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "setAiMode", mode: aiMode }));
    }
  });
}

socket.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "init") {
    yourPlayerId = msg.yourPlayerId;
    aiMode = msg.aiMode || aiMode;
    if (aiModeSelect) {
      aiModeSelect.value = aiMode;
    }
    rebuildScene(msg.scene);
    rebuildNavmesh(msg.navmesh);

    if (!enemyMesh) {
      enemyMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 18, 18),
        new THREE.MeshStandardMaterial({ color: 0xff5f61 })
      );
      enemyMesh.position.y = 0.95;
      scene.add(enemyMesh);
    }
  }

  if (msg.type === "state") {
    if (msg.aiMode && msg.aiMode !== aiMode) {
      aiMode = msg.aiMode;
      if (aiModeSelect) {
        aiModeSelect.value = aiMode;
      }
    }

    removeMissingPlayers(msg.players);

    for (const p of msg.players) {
      const mesh = ensurePlayer(p.id);
      mesh.material.color.setHex(p.id === yourPlayerId ? 0x72f2a2 : 0x8cadff);
      mesh.position.set(p.x, 0.9, p.z);
    }

    if (enemyMesh) {
      enemyMesh.position.set(msg.enemy.x, 0.95, msg.enemy.z);
      renderEnemyPath([{ x: msg.enemy.x, z: msg.enemy.z }, ...msg.enemy.path]);
    }

    const mine = msg.players.find((p) => p.id === yourPlayerId);
    if (mine) {
      const target = new THREE.Vector3(mine.x, 0, mine.z);
      const cameraTarget = new THREE.Vector3(target.x, 15, target.z + 16);
      camera.position.lerp(cameraTarget, 0.08);
      camera.lookAt(target.x, 0, target.z);
    }
  }
});

const keyState = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false
};

window.addEventListener("keydown", (event) => {
  if (event.code in keyState) {
    keyState[event.code] = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code in keyState) {
    keyState[event.code] = false;
  }
});

function currentInput() {
  const x = (keyState.KeyD ? 1 : 0) - (keyState.KeyA ? 1 : 0);
  const z = (keyState.KeyS ? 1 : 0) - (keyState.KeyW ? 1 : 0);
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

setInterval(() => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "input",
        input: currentInput()
      })
    );
  }
}, 50);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
