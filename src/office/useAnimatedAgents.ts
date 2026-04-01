import { useEffect, useRef, useState } from "react";
import type { Agent, AgentStatus } from "@/types/state";
import { getWorkstationLayout, type OfficeLayout, type WorkstationLayout } from "./layout";
import type { CharacterDirection } from "./characterAssets";
import { getCharacterSheetCount } from "./characterAssets";

export interface AnimatedAgentViewModel {
  agent: Agent;
  workstation: WorkstationLayout;
  x: number;
  y: number;
  direction: CharacterDirection;
  frameIndex: number;
  seated: boolean;
  walking: boolean;
  activeAtDesk: boolean;
  sheetIndex: number;
}

export interface NavigationObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RuntimeAgentState {
  x: number;
  y: number;
  direction: CharacterDirection;
  lastStatus: AgentStatus;
  patrolIndex: number;
  pauseUntil: number;
  path: Array<{ x: number; y: number }>;
  pathKey: string;
  repathAt: number;
  releaseUntil: number;
}

const WALK_SEQUENCE = [0, 1, 2, 1] as const;
const AGENT_FOOTPRINT_HALF_W = 10;
const AGENT_FOOTPRINT_TOP = 14;
const AGENT_FOOTPRINT_BOTTOM = 2;
const OBSTACLE_PADDING = 4;
const NAV_CELL_SIZE = 18;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isDeskStatus(status: AgentStatus) {
  return status === "working" || status === "delivering" || status === "checkpoint";
}

function resolveDirection(dx: number, dy: number): CharacterDirection {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }

  return dy >= 0 ? "down" : "up";
}

function buildPatrolPoints(
  layout: OfficeLayout,
  workstation: WorkstationLayout,
  seed: number,
  index: number,
  total: number
) {
  const inset = 44;
  const spread = 52 + (seed % 24);
  const aisleY = clamp(
    workstation.seatY + 28 + (seed % 14),
    layout.wallTop + 120,
    layout.stageH - 42
  );
  const roamX = clamp(
    layout.floorX + 64 + ((index + 1) / (total + 1)) * (layout.floorW - 128),
    inset,
    layout.stageW - inset
  );
  const roamY = clamp(
    layout.wallTop + layout.floorH - 56 - ((seed >> 3) % 20),
    layout.wallTop + 140,
    layout.stageH - 40
  );

  return [
    {
      x: clamp(workstation.seatX - spread, inset, layout.stageW - inset),
      y: aisleY,
    },
    {
      x: clamp(workstation.seatX + spread, inset, layout.stageW - inset),
      y: Math.min(layout.stageH - 40, aisleY + 8),
    },
    {
      x: roamX,
      y: roamY,
    },
  ];
}

function intersectsAxisAligned(
  leftA: number,
  topA: number,
  rightA: number,
  bottomA: number,
  leftB: number,
  topB: number,
  rightB: number,
  bottomB: number
) {
  return leftA < rightB && rightA > leftB && topA < bottomB && bottomA > topB;
}

function collidesWithObstacle(
  nextX: number,
  nextY: number,
  layout: OfficeLayout,
  obstacles: NavigationObstacle[]
) {
  const left = nextX - AGENT_FOOTPRINT_HALF_W;
  const right = nextX + AGENT_FOOTPRINT_HALF_W;
  const top = nextY - AGENT_FOOTPRINT_TOP;
  const bottom = nextY + AGENT_FOOTPRINT_BOTTOM;
  const minX = 18;
  const maxX = layout.stageW - 18;
  const minY = layout.wallTop + 24;
  const maxY = layout.stageH - 12;

  if (left < minX || right > maxX || top < minY || bottom > maxY) {
    return true;
  }

  return obstacles.some((obstacle) =>
    intersectsAxisAligned(
      left,
      top,
      right,
      bottom,
      obstacle.x - OBSTACLE_PADDING,
      obstacle.y - OBSTACLE_PADDING,
      obstacle.x + obstacle.width + OBSTACLE_PADDING,
      obstacle.y + obstacle.height + OBSTACLE_PADDING
    )
  );
}

function moveWithObstacleAvoidance(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  stepDistance: number,
  layout: OfficeLayout,
  obstacles: NavigationObstacle[]
) {
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) {
    return { x: currentX, y: currentY, blocked: false };
  }

  const unitX = dx / distance;
  const unitY = dy / distance;
  const stepX = unitX * stepDistance;
  const stepY = unitY * stepDistance;
  const perpendicularX = -unitY;
  const perpendicularY = unitX;

  const candidateSteps = [
    { dx: stepX, dy: stepY, bias: 0 },
    { dx: stepX, dy: 0, bias: 6 },
    { dx: 0, dy: stepY, bias: 6 },
    { dx: perpendicularX * stepDistance, dy: perpendicularY * stepDistance, bias: 10 },
    { dx: -perpendicularX * stepDistance, dy: -perpendicularY * stepDistance, bias: 10 },
    {
      dx: stepX * 0.45 + perpendicularX * stepDistance * 0.95,
      dy: stepY * 0.45 + perpendicularY * stepDistance * 0.95,
      bias: 3,
    },
    {
      dx: stepX * 0.45 - perpendicularX * stepDistance * 0.95,
      dy: stepY * 0.45 - perpendicularY * stepDistance * 0.95,
      bias: 3,
    },
    {
      dx: perpendicularX * stepDistance * 1.3,
      dy: perpendicularY * stepDistance * 1.3,
      bias: 18,
    },
    {
      dx: -perpendicularX * stepDistance * 1.3,
      dy: -perpendicularY * stepDistance * 1.3,
      bias: 18,
    },
  ];

  let bestCandidate: { x: number; y: number; score: number } | null = null;

  for (const candidate of candidateSteps) {
    const nextX = currentX + candidate.dx;
    const nextY = currentY + candidate.dy;
    if (collidesWithObstacle(nextX, nextY, layout, obstacles)) continue;

    const remainingDistance = Math.hypot(targetX - nextX, targetY - nextY);
    const score = remainingDistance + candidate.bias;

    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = {
        x: nextX,
        y: nextY,
        score,
      };
    }
  }

  if (bestCandidate) {
    return { x: bestCandidate.x, y: bestCandidate.y, blocked: false };
  }

  return { x: currentX, y: currentY, blocked: true };
}

interface NavigationGrid {
  cols: number;
  rows: number;
  cellSize: number;
  blocked: Uint8Array;
}

function getGridIndex(grid: NavigationGrid, col: number, row: number) {
  return row * grid.cols + col;
}

function isGridBlocked(grid: NavigationGrid, col: number, row: number) {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return true;
  return grid.blocked[getGridIndex(grid, col, row)] === 1;
}

function worldToGrid(grid: NavigationGrid, x: number, y: number) {
  return {
    col: clamp(Math.floor(x / grid.cellSize), 0, grid.cols - 1),
    row: clamp(Math.floor(y / grid.cellSize), 0, grid.rows - 1),
  };
}

function gridToWorld(grid: NavigationGrid, col: number, row: number) {
  return {
    x: col * grid.cellSize + grid.cellSize / 2,
    y: row * grid.cellSize + grid.cellSize / 2,
  };
}

function buildNavigationGrid(
  layout: OfficeLayout,
  obstacles: NavigationObstacle[]
): NavigationGrid {
  const cols = Math.max(1, Math.ceil(layout.stageW / NAV_CELL_SIZE));
  const rows = Math.max(1, Math.ceil(layout.stageH / NAV_CELL_SIZE));
  const blocked = new Uint8Array(cols * rows);
  const grid: NavigationGrid = {
    cols,
    rows,
    cellSize: NAV_CELL_SIZE,
    blocked,
  };

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const world = gridToWorld(grid, col, row);
      blocked[getGridIndex(grid, col, row)] = collidesWithObstacle(
        world.x,
        world.y,
        layout,
        obstacles
      )
        ? 1
        : 0;
    }
  }

  return grid;
}

function findNearestOpenCell(
  grid: NavigationGrid,
  startCol: number,
  startRow: number
) {
  if (!isGridBlocked(grid, startCol, startRow)) {
    return { col: startCol, row: startRow };
  }

  const queue: Array<{ col: number; row: number }> = [{ col: startCol, row: startRow }];
  const visited = new Uint8Array(grid.cols * grid.rows);
  visited[getGridIndex(grid, startCol, startRow)] = 1;
  const directions = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const direction of directions) {
      const nextCol = current.col + direction.dc;
      const nextRow = current.row + direction.dr;
      if (nextCol < 0 || nextRow < 0 || nextCol >= grid.cols || nextRow >= grid.rows) continue;

      const index = getGridIndex(grid, nextCol, nextRow);
      if (visited[index] === 1) continue;
      visited[index] = 1;

      if (!isGridBlocked(grid, nextCol, nextRow)) {
        return { col: nextCol, row: nextRow };
      }

      queue.push({ col: nextCol, row: nextRow });
    }
  }

  return null;
}

function buildPath(
  grid: NavigationGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
) {
  const startCell = worldToGrid(grid, fromX, fromY);
  const goalCell = worldToGrid(grid, toX, toY);
  const start = findNearestOpenCell(grid, startCell.col, startCell.row);
  const goal = findNearestOpenCell(grid, goalCell.col, goalCell.row);

  if (!start || !goal) return [];
  if (start.col === goal.col && start.row === goal.row) {
    return [{ x: toX, y: toY }];
  }

  const queue: Array<{ col: number; row: number }> = [start];
  const visited = new Uint8Array(grid.cols * grid.rows);
  const parents = new Int32Array(grid.cols * grid.rows);
  parents.fill(-1);
  visited[getGridIndex(grid, start.col, start.row)] = 1;

  const directions = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
    { dc: 1, dr: 1 },
    { dc: -1, dr: 1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.col === goal.col && current.row === goal.row) {
      break;
    }

    for (const direction of directions) {
      const nextCol = current.col + direction.dc;
      const nextRow = current.row + direction.dr;
      if (nextCol < 0 || nextRow < 0 || nextCol >= grid.cols || nextRow >= grid.rows) continue;
      if (isGridBlocked(grid, nextCol, nextRow)) continue;

      const isDiagonal = direction.dc !== 0 && direction.dr !== 0;
      if (
        isDiagonal &&
        (isGridBlocked(grid, current.col + direction.dc, current.row) ||
          isGridBlocked(grid, current.col, current.row + direction.dr))
      ) {
        continue;
      }

      const index = getGridIndex(grid, nextCol, nextRow);
      if (visited[index] === 1) continue;

      visited[index] = 1;
      parents[index] = getGridIndex(grid, current.col, current.row);
      queue.push({ col: nextCol, row: nextRow });
    }
  }

  const goalIndex = getGridIndex(grid, goal.col, goal.row);
  if (visited[goalIndex] !== 1) {
    return [];
  }

  const cells: Array<{ col: number; row: number }> = [];
  let cursor = goalIndex;
  while (cursor !== -1) {
    const col = cursor % grid.cols;
    const row = Math.floor(cursor / grid.cols);
    cells.push({ col, row });
    cursor = parents[cursor];
  }

  cells.reverse();

  const waypoints = cells.slice(1).map((cell) => gridToWorld(grid, cell.col, cell.row));
  waypoints.push({ x: toX, y: toY });
  return waypoints;
}

interface PlayerPresence {
  x: number;
  y: number;
}

export function useAnimatedAgents(
  agents: Agent[],
  layout: OfficeLayout,
  workstationsByAgentId: Record<string, WorkstationLayout>,
  sheetIndexByAgentId: Record<string, number>,
  player: PlayerPresence | null,
  obstacles: NavigationObstacle[]
) {
  const [animatedAgents, setAnimatedAgents] = useState<AnimatedAgentViewModel[]>([]);
  const runtimeRef = useRef<Map<string, RuntimeAgentState>>(new Map());

  useEffect(() => {
    const runtimes = runtimeRef.current;
    const now = performance.now();
    const activeIds = new Set(agents.map((agent) => agent.id));
    const sheetCount = Math.max(1, getCharacterSheetCount());
    const navigationGrid = buildNavigationGrid(layout, obstacles);
    const releaseGrid = buildNavigationGrid(layout, []);

    for (const agent of agents) {
      const workstation = workstationsByAgentId[agent.id] ?? getWorkstationLayout(layout, agent.desk);
      const seed = hashString(agent.id);
      const patrolPoints = buildPatrolPoints(layout, workstation, seed, 0, Math.max(1, agents.length));

      if (!runtimes.has(agent.id)) {
        const start = isDeskStatus(agent.status)
          ? { x: workstation.seatX, y: workstation.seatY }
          : patrolPoints[seed % patrolPoints.length];

        runtimes.set(agent.id, {
          x: start.x,
          y: start.y,
          direction: isDeskStatus(agent.status) ? "up" : "down",
          lastStatus: agent.status,
          patrolIndex: seed % patrolPoints.length,
          pauseUntil: isDeskStatus(agent.status) ? 0 : now + 250 + (seed % 750),
          path: [],
          pathKey: "",
          repathAt: 0,
          releaseUntil: 0,
        });
      }
    }

    for (const id of [...runtimes.keys()]) {
      if (!activeIds.has(id)) {
        runtimes.delete(id);
      }
    }

    let frameId = 0;
    let lastTime = now;

    const step = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      const next = agents.map((agent, index) => {
        const runtime = runtimes.get(agent.id)!;
        const seed = hashString(agent.id);
        const workstation = workstationsByAgentId[agent.id] ?? getWorkstationLayout(layout, agent.desk);
        const patrolPoints = buildPatrolPoints(
          layout,
          workstation,
          seed,
          index,
          Math.max(1, agents.length)
        );
        const shouldSit = isDeskStatus(agent.status);
        const shouldReleaseFromDesk =
          !shouldSit && isDeskStatus(runtime.lastStatus) && runtime.lastStatus !== agent.status;

        if (shouldReleaseFromDesk) {
          runtime.releaseUntil = time + 5000;
          runtime.path = [];
          runtime.pathKey = "";
          runtime.pauseUntil = 0;
        } else if (shouldSit) {
          runtime.releaseUntil = 0;
        }

        runtime.lastStatus = agent.status;

        const isGhostingFromDesk = !shouldSit && time < runtime.releaseUntil;
        const isWatchingPlayer =
          !shouldSit &&
          !isGhostingFromDesk &&
          !!player &&
          Math.hypot(player.x - runtime.x, player.y - runtime.y) <= 82;

        if (!shouldSit && runtime.patrolIndex >= patrolPoints.length) {
          runtime.patrolIndex = 0;
        }

        const destination = shouldSit
          ? { x: workstation.seatX, y: workstation.seatY }
          : isWatchingPlayer
            ? { x: runtime.x, y: runtime.y }
            : patrolPoints[runtime.patrolIndex];

        let moveTarget = destination;
        let distanceToDestination = Math.hypot(destination.x - runtime.x, destination.y - runtime.y);

        if (isWatchingPlayer && player) {
          runtime.pauseUntil = 0;
          runtime.path = [];
          runtime.pathKey = "";
          runtime.direction = resolveDirection(player.x - runtime.x, player.y - runtime.y);
        } else if (!shouldSit && distanceToDestination < 5) {
          if (runtime.pauseUntil === 0) {
            runtime.pauseUntil = time + 700 + (seed % 900);
          }

          if (time >= runtime.pauseUntil) {
            runtime.pauseUntil = 0;
            runtime.patrolIndex = (runtime.patrolIndex + 1) % patrolPoints.length;
            runtime.path = [];
            runtime.pathKey = "";
            moveTarget = patrolPoints[runtime.patrolIndex];
            distanceToDestination = Math.hypot(moveTarget.x - runtime.x, moveTarget.y - runtime.y);
          }
        } else if (shouldSit) {
          runtime.pauseUntil = 0;
          runtime.path = [];
          runtime.pathKey = "";
        } else {
          const pathKey = `${runtime.patrolIndex}:${Math.round(destination.x)}:${Math.round(destination.y)}`;

          if (runtime.pathKey !== pathKey || runtime.path.length === 0 || time >= runtime.repathAt) {
            runtime.path = buildPath(
              isGhostingFromDesk ? releaseGrid : navigationGrid,
              runtime.x,
              runtime.y,
              destination.x,
              destination.y
            );
            runtime.pathKey = pathKey;
            runtime.repathAt = time + 1200 + (seed % 300);
          }

          while (
            runtime.path.length > 0 &&
            Math.hypot(runtime.path[0].x - runtime.x, runtime.path[0].y - runtime.y) <= 10
          ) {
            runtime.path.shift();
          }

          moveTarget = runtime.path[0] ?? destination;
        }

        const dx = moveTarget.x - runtime.x;
        const dy = moveTarget.y - runtime.y;
        const distance = Math.hypot(dx, dy);
        const speed = shouldSit ? 118 : 34 + (seed % 10);

        if (!isWatchingPlayer && distance > 0.5) {
          const stepDistance = Math.min(distance, speed * dt);

          if (shouldSit) {
            runtime.x += (dx / distance) * stepDistance;
            runtime.y += (dy / distance) * stepDistance;
          } else {
            const nextPosition = moveWithObstacleAvoidance(
              runtime.x,
              runtime.y,
              moveTarget.x,
              moveTarget.y,
              stepDistance,
              layout,
              isGhostingFromDesk ? [] : obstacles
            );
            const movedDx = nextPosition.x - runtime.x;
            const movedDy = nextPosition.y - runtime.y;

            runtime.x = nextPosition.x;
            runtime.y = nextPosition.y;

            if (nextPosition.blocked && !shouldSit) {
              runtime.path = [];
              runtime.repathAt = 0;
            } else if (Math.abs(movedDx) > 0.05 || Math.abs(movedDy) > 0.05) {
              runtime.direction = resolveDirection(movedDx, movedDy);
            }
          }

          if (shouldSit) {
            runtime.direction = shouldSit && distance < 10 ? "up" : resolveDirection(dx, dy);
          }
        }

        const remainingDistance = Math.hypot(destination.x - runtime.x, destination.y - runtime.y);
        const seated = shouldSit && remainingDistance <= 5;

        if (seated) {
          runtime.x = workstation.seatX;
          runtime.y = workstation.seatY;
          runtime.direction = "up";
        }

        const walking = !seated && !isWatchingPlayer && remainingDistance > 0.75;
        const frameIndex = seated
          ? 1
          : walking
            ? WALK_SEQUENCE[Math.floor(time / 170 + (seed % WALK_SEQUENCE.length)) % WALK_SEQUENCE.length]
            : 1;

        return {
          agent,
          workstation,
          x: runtime.x,
          y: runtime.y + (seated ? Math.sin(time / 180 + seed) * 1.2 : 0),
          direction: runtime.direction,
          frameIndex,
          seated,
          walking,
          activeAtDesk: shouldSit,
          sheetIndex: sheetIndexByAgentId[agent.id] ?? seed % sheetCount,
        };
      });

      setAnimatedAgents(next);
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    agents,
    layout.floorW,
    layout.floorX,
    layout.floorY,
    layout.floorH,
    layout.stageH,
    layout.stageW,
    layout.wallTop,
    player,
    sheetIndexByAgentId,
    obstacles,
    workstationsByAgentId,
  ]);

  return animatedAgents;
}
