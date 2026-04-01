import { useCallback, useEffect, useRef, useState } from "react";

interface DraggablePosition {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
}

interface UseDraggablePanelOptions {
  defaultTop: number;
  defaultRight?: number;
  defaultLeft?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function useDraggablePanel({
  defaultTop,
  defaultRight,
  defaultLeft,
}: UseDraggablePanelOptions) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [position, setPosition] = useState<DraggablePosition | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const panel = panelRef.current;
    if (!panel) return;

    const parent = panel.offsetParent instanceof HTMLElement ? panel.offsetParent : null;
    const panelRect = panel.getBoundingClientRect();
    const parentRect = parent?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
    };

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: panelRect.left - parentRect.left,
      originY: panelRect.top - parentRect.top,
    };

    setPosition({
      x: panelRect.left - parentRect.left,
      y: panelRect.top - parentRect.top,
    });

    event.preventDefault();
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      const panel = panelRef.current;
      if (!dragState || !panel || event.pointerId !== dragState.pointerId) return;

      const parent = panel.offsetParent instanceof HTMLElement ? panel.offsetParent : null;
      const parentRect = parent?.getBoundingClientRect() ?? {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      const nextX = dragState.originX + (event.clientX - dragState.startClientX);
      const nextY = dragState.originY + (event.clientY - dragState.startClientY);
      const maxX = Math.max(8, parentRect.width - panel.offsetWidth - 8);
      const maxY = Math.max(8, parentRect.height - panel.offsetHeight - 8);

      setPosition({
        x: clamp(nextX, 8, maxX),
        y: clamp(nextY, 8, maxY),
      });
    };

    const stopDragging = (event: PointerEvent) => {
      if (dragStateRef.current?.pointerId === event.pointerId) {
        dragStateRef.current = null;
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  return {
    panelRef,
    positionStyle: position
      ? {
          left: position.x,
          top: position.y,
          right: "auto",
        }
      : defaultLeft !== undefined
        ? {
            left: defaultLeft,
            top: defaultTop,
          }
        : {
            right: defaultRight ?? 20,
            top: defaultTop,
          },
    dragHandleProps: {
      onPointerDown,
      style: {
        cursor: "grab",
        touchAction: "none" as const,
      },
    },
  };
}
