import * as THREE from "three";

export class ThreeWorldRenderer {
  constructor(container) {
    this.container = container;
    this.worldGroup = new THREE.Group();
    this.players = new Map();
    this.enemies = new Map();
    this.navmeshGroup = null;
    this.renderLoopId = null;
    this.cameraFollowTarget = null;
    this.initializedWorld = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141824);

    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
    this.camera.position.set(0, 15, 16);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene.add(this.worldGroup);

    const hemi = new THREE.HemisphereLight(0xe7efff, 0x1f2538, 0.75);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(8, 15, 8);
    this.scene.add(dir);

    this.handleResize = this.handleResize.bind(this);
  }

  mount() {
    this.container.appendChild(this.renderer.domElement);
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    this.startRenderLoop();
  }

  setWorld(sceneDef, navmesh) {
    if (!sceneDef || !navmesh) {
      return;
    }

    this.rebuildScene(sceneDef);
    this.rebuildNavmesh(navmesh);
    this.initializedWorld = true;
  }

  renderState(state) {
    if (!this.initializedWorld) {
      return;
    }

    this.renderPlayers(state.players, state.yourPlayerId);
    this.renderEnemies(state.enemies);

    const mine = state.players.find((p) => p.id === state.yourPlayerId);
    if (mine) {
      this.cameraFollowTarget = new THREE.Vector3(mine.x, 0, mine.z);
    }
  }

  rebuildScene(world) {
    this.worldGroup.clear();

    const floor = this.makeCube(world.floor.size, 0x3b4158);
    floor.position.set(world.floor.center.x, world.floor.center.y, world.floor.center.z);
    this.worldGroup.add(floor);

    for (const obs of world.obstacles) {
      const obstacle = this.makeCube(obs.size, 0x6f7795);
      obstacle.position.set(obs.center.x, obs.center.y, obs.center.z);
      this.worldGroup.add(obstacle);
    }
  }

  rebuildNavmesh(navmesh) {
    if (this.navmeshGroup) {
      this.scene.remove(this.navmeshGroup);
    }

    this.navmeshGroup = new THREE.Group();
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
      tile.position.set(cell.wx, 0.52, cell.wz);
      this.navmeshGroup.add(tile);
    }

    this.scene.add(this.navmeshGroup);
  }

  renderPlayers(players, yourPlayerId) {
    const ids = new Set(players.map((p) => p.id));

    for (const [id, mesh] of this.players.entries()) {
      if (!ids.has(id)) {
        this.scene.remove(mesh);
        this.players.delete(id);
      }
    }

    for (const p of players) {
      if (!this.players.has(p.id)) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0x8cadff })
        );
        mesh.position.y = 0.9;
        this.scene.add(mesh);
        this.players.set(p.id, mesh);
      }

      const mesh = this.players.get(p.id);
      mesh.material.color.setHex(p.id === yourPlayerId ? 0x72f2a2 : 0x8cadff);
      mesh.position.set(p.x, 0.9, p.z);
    }
  }

  renderEnemies(enemies) {
    const ids = new Set(enemies.map((e) => e.id));

    for (const [id, visual] of this.enemies.entries()) {
      if (!ids.has(id)) {
        this.scene.remove(visual.mesh);
        this.scene.remove(visual.pathLine);
        visual.pathLine.geometry.dispose();
        this.enemies.delete(id);
      }
    }

    for (const enemy of enemies) {
      if (!this.enemies.has(enemy.id)) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 18, 18),
          new THREE.MeshStandardMaterial({ color: 0xff5f61 })
        );
        mesh.position.y = 0.95;
        this.scene.add(mesh);

        const pathLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([]),
          new THREE.LineBasicMaterial({ color: 0x56f0ff })
        );
        this.scene.add(pathLine);

        this.enemies.set(enemy.id, { mesh, pathLine });
      }

      const visual = this.enemies.get(enemy.id);
      visual.mesh.position.set(enemy.x, 0.95, enemy.z);
      this.renderEnemyPath(visual.pathLine, [{ x: enemy.x, z: enemy.z }, ...enemy.path]);
    }
  }

  renderEnemyPath(pathLine, path) {
    const points = path.map((p) => new THREE.Vector3(p.x, 1.2, p.z));
    if (points.length < 2) {
      pathLine.visible = false;
      return;
    }

    pathLine.geometry.dispose();
    pathLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    pathLine.visible = true;
  }

  makeCube(size, color) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({ color })
    );
  }

  startRenderLoop() {
    const render = () => {
      if (this.cameraFollowTarget) {
        const cameraTarget = new THREE.Vector3(this.cameraFollowTarget.x, 15, this.cameraFollowTarget.z + 16);
        this.camera.position.lerp(cameraTarget, 0.08);
        this.camera.lookAt(this.cameraFollowTarget.x, 0, this.cameraFollowTarget.z);
      }

      this.renderer.render(this.scene, this.camera);
      this.renderLoopId = window.requestAnimationFrame(render);
    };

    render();
  }

  handleResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    if (this.renderLoopId) {
      window.cancelAnimationFrame(this.renderLoopId);
      this.renderLoopId = null;
    }

    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
    this.container.innerHTML = "";
  }
}
