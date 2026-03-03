function getFloorBounds(floor) {
  return {
    minX: floor.center.x - floor.size.x / 2,
    maxX: floor.center.x + floor.size.x / 2,
    minZ: floor.center.z - floor.size.z / 2,
    maxZ: floor.center.z + floor.size.z / 2
  };
}

function getObstacleBounds(obstacle, padding = 0) {
  return {
    minX: obstacle.center.x - obstacle.size.x / 2 - padding,
    maxX: obstacle.center.x + obstacle.size.x / 2 + padding,
    minZ: obstacle.center.z - obstacle.size.z / 2 - padding,
    maxZ: obstacle.center.z + obstacle.size.z / 2 + padding
  };
}

function isInsideAabb2d(point, aabb) {
  return point.x >= aabb.minX && point.x <= aabb.maxX && point.z >= aabb.minZ && point.z <= aabb.maxZ;
}

export function bakeNavmesh(scene, options = {}) {
  const cellSize = options.cellSize ?? 1;
  const agentRadius = options.agentRadius ?? 0.45;
  const floorBounds = getFloorBounds(scene.floor);

  const width = Math.floor((floorBounds.maxX - floorBounds.minX) / cellSize);
  const height = Math.floor((floorBounds.maxZ - floorBounds.minZ) / cellSize);

  const blocked = new Set();
  const obstacleBounds = scene.obstacles.map((obs) => getObstacleBounds(obs, agentRadius));

  for (let gz = 0; gz < height; gz += 1) {
    for (let gx = 0; gx < width; gx += 1) {
      const world = {
        x: floorBounds.minX + (gx + 0.5) * cellSize,
        z: floorBounds.minZ + (gz + 0.5) * cellSize
      };

      for (const bounds of obstacleBounds) {
        if (isInsideAabb2d(world, bounds)) {
          blocked.add(`${gx},${gz}`);
          break;
        }
      }
    }
  }

  return {
    cellSize,
    floorBounds,
    width,
    height,
    blocked,
    obstacleBounds,
    walkableCells: serializeWalkableCells({ width, height, blocked, floorBounds, cellSize })
  };
}

function serializeWalkableCells(navmesh) {
  const cells = [];
  for (let z = 0; z < navmesh.height; z += 1) {
    for (let x = 0; x < navmesh.width; x += 1) {
      const key = `${x},${z}`;
      if (!navmesh.blocked.has(key)) {
        cells.push({
          x,
          z,
          wx: navmesh.floorBounds.minX + (x + 0.5) * navmesh.cellSize,
          wz: navmesh.floorBounds.minZ + (z + 0.5) * navmesh.cellSize
        });
      }
    }
  }
  return cells;
}

export function worldToGrid(navmesh, pos) {
  const gx = Math.floor((pos.x - navmesh.floorBounds.minX) / navmesh.cellSize);
  const gz = Math.floor((pos.z - navmesh.floorBounds.minZ) / navmesh.cellSize);
  return { x: gx, z: gz };
}

export function gridToWorld(navmesh, cell) {
  return {
    x: navmesh.floorBounds.minX + (cell.x + 0.5) * navmesh.cellSize,
    z: navmesh.floorBounds.minZ + (cell.z + 0.5) * navmesh.cellSize
  };
}

export function isWalkable(navmesh, cell) {
  if (cell.x < 0 || cell.z < 0 || cell.x >= navmesh.width || cell.z >= navmesh.height) {
    return false;
  }
  return !navmesh.blocked.has(`${cell.x},${cell.z}`);
}

export function isPositionWalkable(navmesh, pos) {
  const cell = worldToGrid(navmesh, pos);
  return isWalkable(navmesh, cell);
}

export function findNearestWalkableCell(navmesh, startCell, maxRadius = 10) {
  if (isWalkable(navmesh, startCell)) {
    return startCell;
  }

  for (let r = 1; r <= maxRadius; r += 1) {
    for (let dz = -r; dz <= r; dz += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) {
          continue;
        }
        const cell = { x: startCell.x + dx, z: startCell.z + dz };
        if (isWalkable(navmesh, cell)) {
          return cell;
        }
      }
    }
  }

  return null;
}

function heuristic(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  const min = Math.min(dx, dz);
  const max = Math.max(dx, dz);
  return Math.SQRT2 * min + (max - min);
}

function key(cell) {
  return `${cell.x},${cell.z}`;
}

function neighbors(navmesh, cell) {
  const cardinal = [
    { x: 1, z: 0, cost: 1 },
    { x: -1, z: 0, cost: 1 },
    { x: 0, z: 1, cost: 1 },
    { x: 0, z: -1, cost: 1 }
  ];
  const diagonal = [
    { x: 1, z: 1, cost: Math.SQRT2 },
    { x: 1, z: -1, cost: Math.SQRT2 },
    { x: -1, z: 1, cost: Math.SQRT2 },
    { x: -1, z: -1, cost: Math.SQRT2 }
  ];

  const result = [];

  for (const step of cardinal) {
    const next = { x: cell.x + step.x, z: cell.z + step.z };
    if (isWalkable(navmesh, next)) {
      result.push({ cell: next, cost: step.cost });
    }
  }

  for (const step of diagonal) {
    const next = { x: cell.x + step.x, z: cell.z + step.z };
    if (!isWalkable(navmesh, next)) {
      continue;
    }

    // Prevent diagonal corner-cutting through blocked cells.
    const sideA = { x: cell.x + step.x, z: cell.z };
    const sideB = { x: cell.x, z: cell.z + step.z };
    if (!isWalkable(navmesh, sideA) || !isWalkable(navmesh, sideB)) {
      continue;
    }

    result.push({ cell: next, cost: step.cost });
  }

  return result;
}

function hasLineOfSight(navmesh, from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) {
    return true;
  }

  // Sample along the segment in small increments and keep every sample on walkable space.
  const step = navmesh.cellSize * 0.2;
  const samples = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const p = {
      x: from.x + dx * t,
      z: from.z + dz * t
    };
    if (!isPositionWalkable(navmesh, p)) {
      return false;
    }
  }

  return true;
}

function smoothPath(navmesh, startPos, endPos, cellPath) {
  if (cellPath.length === 0) {
    return [];
  }

  // Build targets from cell centers plus exact target position.
  const targets = [...cellPath.map((cell) => gridToWorld(navmesh, cell)), { x: endPos.x, z: endPos.z }];
  const smoothed = [];

  let current = { x: startPos.x, z: startPos.z };
  let cursor = 0;

  while (cursor < targets.length) {
    let furthest = cursor;
    for (let i = targets.length - 1; i > cursor; i -= 1) {
      if (hasLineOfSight(navmesh, current, targets[i])) {
        furthest = i;
        break;
      }
    }

    const next = targets[furthest];
    smoothed.push(next);
    current = next;
    cursor = furthest + 1;
  }

  return smoothed;
}

export function findPath(navmesh, startPos, endPos) {
  const startRaw = worldToGrid(navmesh, startPos);
  const goalRaw = worldToGrid(navmesh, endPos);

  const start = findNearestWalkableCell(navmesh, startRaw);
  const goal = findNearestWalkableCell(navmesh, goalRaw);

  if (!start || !goal) {
    return [];
  }

  const open = [start];
  const cameFrom = new Map();
  const gScore = new Map([[key(start), 0]]);
  const fScore = new Map([[key(start), heuristic(start, goal)]]);

  while (open.length > 0) {
    let currentIndex = 0;
    for (let i = 1; i < open.length; i += 1) {
      const score = fScore.get(key(open[i])) ?? Number.POSITIVE_INFINITY;
      const best = fScore.get(key(open[currentIndex])) ?? Number.POSITIVE_INFINITY;
      if (score < best) {
        currentIndex = i;
      }
    }

    const current = open[currentIndex];
    if (current.x === goal.x && current.z === goal.z) {
      const cells = [current];
      let k = key(current);
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k);
        cells.push(prev);
        k = key(prev);
      }
      cells.reverse();
      return smoothPath(navmesh, startPos, endPos, cells.slice(1));
    }

    open.splice(currentIndex, 1);
    const currentKey = key(current);

    for (const { cell: n, cost } of neighbors(navmesh, current)) {
      const nKey = key(n);
      const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + cost;
      if (tentative < (gScore.get(nKey) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentative);
        fScore.set(nKey, tentative + heuristic(n, goal));
        if (!open.some((c) => c.x === n.x && c.z === n.z)) {
          open.push(n);
        }
      }
    }
  }

  return [];
}
