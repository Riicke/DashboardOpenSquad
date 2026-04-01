import { extend } from "@pixi/react";
import { Container, Graphics } from "pixi.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Graphics as PixiGraphics } from "pixi.js";
import { COLORS } from "./palette";
import type { Handoff } from "@/types/state";
import type { WorkstationLayout } from "./layout";

extend({ Container, Graphics });

interface HandoffEnvelopeProps {
  handoff: Handoff;
  fromWorkstation: WorkstationLayout;
  toWorkstation: WorkstationLayout;
}

export function HandoffEnvelope({
  handoff,
  fromWorkstation,
  toWorkstation,
}: HandoffEnvelopeProps) {
  const [pos, setPos] = useState<{ x: number; y: number; scale: number; rotation: number } | null>(null);
  const animatingRef = useRef(false);
  const lastHandoffRef = useRef<string | null>(null);

  const fromX = fromWorkstation.pcX + 18;
  const fromY = fromWorkstation.deskY + 24;
  const toX = toWorkstation.pcX + 18;
  const toY = toWorkstation.deskY + 24;

  useEffect(() => {
    const key = `${handoff.from}-${handoff.to}-${handoff.completedAt}`;
    if (lastHandoffRef.current === key || animatingRef.current) return;
    lastHandoffRef.current = key;
    animatingRef.current = true;

    const distance = Math.hypot(toX - fromX, toY - fromY);
    const duration = Math.max(850, Math.min(1400, distance * 1.6));
    const start = performance.now();
    let frameId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    function easeOutBounce(t: number): number {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }

    function animate(now: number) {
      const rawT = Math.min((now - start) / duration, 1);
      const t = easeOutBounce(rawT);

      const arcHeight = -Math.max(28, Math.min(48, distance * 0.1));
      const linearY = fromY + (toY - fromY) * t;
      const arc = arcHeight * Math.sin(rawT * Math.PI);
      const wobble = Math.sin(rawT * Math.PI * 4) * 0.15;
      const scale = rawT < 0.1 ? rawT * 10 : 1;

      setPos({
        x: fromX + (toX - fromX) * t,
        y: linearY + arc,
        scale,
        rotation: wobble,
      });

      if (rawT < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        timeoutId = setTimeout(() => {
          animatingRef.current = false;
          setPos(null);
        }, 300);
      }
    }

    setPos({ x: fromX, y: fromY, scale: 0.5, rotation: 0 });
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [handoff, fromX, fromY, toX, toY]);

  const drawEnvelope = useCallback((g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, 10, 9, 3);
    g.fill({ color: 0x000000, alpha: 0.2 });
    g.rect(-9, -5, 18, 12);
    g.fill({ color: COLORS.envelopeBody });
    g.stroke({ color: COLORS.envelopeFold, width: 1 });
    g.moveTo(-9, -5);
    g.lineTo(0, 1);
    g.lineTo(9, -5);
    g.fill({ color: COLORS.envelopeFold });
    g.stroke({ color: COLORS.envelopeSeal, width: 0.5 });
    g.circle(0, -0.5, 2.5);
    g.fill({ color: COLORS.envelopeSeal });
    g.circle(0, -0.5, 1.2);
    g.fill({ color: 0xff5555 });
  }, []);

  if (!pos) return null;

  return (
    <pixiContainer x={pos.x} y={pos.y} scale={pos.scale} rotation={pos.rotation}>
      <pixiGraphics draw={drawEnvelope} />
    </pixiContainer>
  );
}
