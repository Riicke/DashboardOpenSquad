import { useEffect, useRef, useState } from "react";
import type { CharacterDirection } from "./characterAssets";
import type { OfficeLayout } from "./layout";
import type { NavigationObstacle } from "./useAnimatedAgents";

export interface PlayerState {
  x: number;
  y: number;
  direction: CharacterDirection;
  frameIndex: number;
  moving: boolean;
}

const WALK_SEQUENCE = [0, 1, 2, 1] as const;
const PLAYER_FOOTPRINT_HALF_W = 9;
const PLAYER_FOOTPRINT_TOP = 14;
const PLAYER_FOOTPRINT_BOTTOM = 2;
const OBSTACLE_PADDING = 2;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveDirection(dx: number, dy: number): CharacterDirection {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }

  return dy >= 0 ? "down" : "up";
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
  const left = nextX - PLAYER_FOOTPRINT_HALF_W;
  const right = nextX + PLAYER_FOOTPRINT_HALF_W;
  const top = nextY - PLAYER_FOOTPRINT_TOP;
  const bottom = nextY + PLAYER_FOOTPRINT_BOTTOM;
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
  stepX: number,
  stepY: number,
  layout: OfficeLayout,
  obstacles: NavigationObstacle[]
) {
  const diagonalX = currentX + stepX;
  const diagonalY = currentY + stepY;
  if (!collidesWithObstacle(diagonalX, diagonalY, layout, obstacles)) {
    return { x: diagonalX, y: diagonalY };
  }

  const horizontalX = currentX + stepX;
  if (!collidesWithObstacle(horizontalX, currentY, layout, obstacles)) {
    return { x: horizontalX, y: currentY };
  }

  const verticalY = currentY + stepY;
  if (!collidesWithObstacle(currentX, verticalY, layout, obstacles)) {
    return { x: currentX, y: verticalY };
  }

  return { x: currentX, y: currentY };
}

export function usePlayerController(
  layout: OfficeLayout,
  disabled: boolean,
  obstacles: NavigationObstacle[]
) {
  const [player, setPlayer] = useState<PlayerState>({
    x: layout.stageW / 2,
    y: layout.stageH - 76,
    direction: "up",
    frameIndex: 1,
    moving: false,
  });
  const pressedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPlayer((current) => ({
      ...current,
      x: clamp(current.x, 42, layout.stageW - 42),
      y: clamp(current.y, layout.wallTop + 72, layout.stageH - 34),
    }));
  }, [layout.stageH, layout.stageW, layout.wallTop]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (isTyping) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        event.preventDefault();
        pressedKeysRef.current.add(event.code);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        pressedKeysRef.current.delete(event.code);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();

    const step = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      setPlayer((current) => {
        if (disabled) {
          return {
            ...current,
            moving: false,
            frameIndex: 1,
          };
        }

        const keys = pressedKeysRef.current;
        let dx = 0;
        let dy = 0;

        if (keys.has("KeyA")) dx -= 1;
        if (keys.has("KeyD")) dx += 1;
        if (keys.has("KeyW")) dy -= 1;
        if (keys.has("KeyS")) dy += 1;

        const moving = dx !== 0 || dy !== 0;
        if (!moving) {
          return {
            ...current,
            moving: false,
            frameIndex: 1,
          };
        }

        const length = Math.hypot(dx, dy) || 1;
        const speed = 136;
        const nextPosition = moveWithObstacleAvoidance(
          current.x,
          current.y,
          (dx / length) * speed * dt,
          (dy / length) * speed * dt,
          layout,
          obstacles
        );

        return {
          x: nextPosition.x,
          y: nextPosition.y,
          direction: resolveDirection(dx, dy),
          frameIndex: WALK_SEQUENCE[Math.floor(time / 135) % WALK_SEQUENCE.length],
          moving: nextPosition.x !== current.x || nextPosition.y !== current.y,
        };
      });

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [disabled, layout.stageH, layout.stageW, layout.wallTop, obstacles]);

  return player;
}
