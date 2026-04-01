import { useCallback, useEffect, useRef, useState } from "react";
import { extend } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { Agent } from "@/types/state";
import type { Graphics as PixiGraphics, TextStyleOptions, Texture } from "pixi.js";
import { CELL_H, CELL_W, CHARACTER_VARIANTS, COLORS } from "./palette";
import {
  drawDeskAccessories,
  drawDeskArea,
  drawScreenGlow,
  drawWorkstationBack,
  drawWorkstationFront,
} from "./drawDesk";
import { getDeskOrigin, type OfficeLayout } from "./layout";
import { getCharacterTextures } from "./textures";

extend({ Container, Graphics, Text, Sprite });

export { CELL_W, CELL_H };

interface AgentDeskProps {
  agent: Agent;
  agentIndex: number;
  layout: OfficeLayout;
}

export function AgentDesk({ agent, agentIndex, layout }: AgentDeskProps) {
  const { x, y } = getDeskOrigin(layout, agent.desk);

  const [frame, setFrame] = useState(0);
  const frameRef = useRef<number>(0);
  const isAnimated = agent.status === "working" || agent.status === "delivering";

  useEffect(() => {
    if (!isAnimated) {
      setFrame(0);
      frameRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % 2;
      setFrame(frameRef.current);
    }, 220);

    return () => clearInterval(interval);
  }, [isAnimated]);

  const variant = CHARACTER_VARIANTS[agentIndex % CHARACTER_VARIANTS.length];
  const textures = getCharacterTextures(variant);

  let currentTexture: Texture;
  switch (agent.status) {
    case "working":
    case "delivering":
      currentTexture = textures.working[frame % 2];
      break;
    case "done":
      currentTexture = textures.done;
      break;
    case "checkpoint":
      currentTexture = textures.checkpoint;
      break;
    default:
      currentTexture = textures.idle;
  }

  const drawStationBack = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      drawDeskArea(g, 0, 0);
      drawWorkstationBack(g, 0, 0);
      if (agent.status === "working" || agent.status === "delivering" || agent.status === "checkpoint") {
        drawScreenGlow(g, 0, 0);
      }
    },
    [agent.status]
  );

  const drawStationFront = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      drawWorkstationFront(g, 0, 0);
      drawDeskAccessories(g, 0, 0, agentIndex);
    },
    [agentIndex]
  );

  const drawNameCard = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      const cardW = Math.max(106, 24 + 16 + agent.name.length * 7 + 12);
      const cardH = 22;
      const cardX = (CELL_W - cardW) / 2;
      const cardY = -38;

      g.roundRect(cardX + 1, cardY + 2, cardW, cardH, 8);
      g.fill({ color: 0x000000, alpha: 0.3 });

      g.roundRect(cardX, cardY, cardW, cardH, 8);
      g.fill({ color: COLORS.nameCardBg, alpha: 0.92 });

      const triX = CELL_W / 2;
      g.poly([triX - 5, cardY + cardH, triX, cardY + cardH + 5, triX + 5, cardY + cardH]);
      g.fill({ color: COLORS.nameCardBg, alpha: 0.92 });

      const dotColor =
        agent.status === "working"
          ? COLORS.statusWorking
          : agent.status === "done"
            ? COLORS.statusDone
            : agent.status === "checkpoint"
              ? COLORS.statusCheckpoint
              : COLORS.statusIdle;
      const dotX = cardX + cardW - 14;
      const dotY = cardY + cardH / 2;

      if (agent.status === "working" || agent.status === "done" || agent.status === "checkpoint") {
        g.circle(dotX, dotY, 5);
        g.fill({ color: dotColor, alpha: 0.25 });
      }

      g.circle(dotX, dotY, 3.5);
      g.fill({ color: dotColor });
    },
    [agent.name, agent.status]
  );

  const cardWidth = Math.max(106, 24 + 16 + agent.name.length * 7 + 12);
  const cardX = (CELL_W - cardWidth) / 2;

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={drawStationBack} />

      <pixiSprite texture={currentTexture} x={40} y={24} width={48} height={48} />

      <pixiGraphics draw={drawStationFront} />

      <pixiGraphics draw={drawNameCard} />
      <pixiText
        text={agent.icon || "BOT"}
        style={{ fontSize: 11 } as TextStyleOptions}
        x={cardX + 6}
        y={-36}
      />
      <pixiText
        text={agent.name}
        style={{
          fontSize: 11,
          fill: COLORS.nameCardText,
          fontFamily: "-apple-system, 'Segoe UI', sans-serif",
          fontWeight: "600",
        } as TextStyleOptions}
        x={cardX + 24}
        y={-36}
      />
    </pixiContainer>
  );
}
