import { extend } from "@pixi/react";
import { Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { useCallback } from "react";
import type { Graphics as PixiGraphics, TextStyleOptions } from "pixi.js";
import { COLORS } from "./palette";
import { getCharacterFrame } from "./characterAssets";
import type { AnimatedAgentViewModel } from "./useAnimatedAgents";

extend({ Container, Graphics, Sprite, Text });

interface AgentAvatarProps {
  animatedAgent: AnimatedAgentViewModel;
  sheetTexture?: Texture;
  chatTexture?: Texture;
  activityKind?: "typing" | "question" | null;
  activityFrame?: number;
  liveCardText?: string | null;
}

function getStatusColor(animatedAgent: AnimatedAgentViewModel) {
  const { agent, activeAtDesk } = animatedAgent;

  if (agent.status === "checkpoint") {
    return COLORS.statusCheckpoint;
  }

  if (activeAtDesk) {
    return 0x57e36d;
  }

  if (agent.status === "done") {
    return 0x6fb6ff;
  }

  return COLORS.statusIdle;
}

const chatFrameCache = new Map<string, Texture>();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getChatFrame(texture: Texture | undefined, rowIndex: number, frameIndex: number) {
  if (!texture || texture === Texture.EMPTY) return Texture.EMPTY;

  const columns = 7;
  const rows = 10;
  const frameWidth = texture.width / columns;
  const frameHeight = texture.height / rows;
  const safeColumn = ((frameIndex % columns) + columns) % columns;
  const textureId = String((texture as Texture & { uid?: number }).uid ?? "chat");
  const cacheKey = `${textureId}:${rowIndex}:${safeColumn}`;

  const cached = chatFrameCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const frameTexture = new Texture({
    source: texture.source,
    frame: new Rectangle(
      safeColumn * frameWidth,
      rowIndex * frameHeight,
      frameWidth,
      frameHeight
    ),
  });

  chatFrameCache.set(cacheKey, frameTexture);
  return frameTexture;
}

export function AgentAvatar({
  animatedAgent,
  sheetTexture,
  chatTexture,
  activityKind = null,
  activityFrame = 0,
  liveCardText = null,
}: AgentAvatarProps) {
  const { agent, x, y, direction, frameIndex, seated, walking } = animatedAgent;
  const texture = getCharacterFrame(sheetTexture, direction, frameIndex);
  const statusColor = getStatusColor(animatedAgent);
  const labelWidth = Math.max(118, 34 + 20 + agent.name.length * 7);
  const labelX = -labelWidth / 2;
  const labelY = seated ? -90 : -84;
  const estimatedLiveLines = liveCardText
    ? liveCardText
        .split(/\n+/)
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 30)), 0)
    : 0;
  const liveCardHeight = clamp(18 + estimatedLiveLines * 14, 44, 110);
  const activityTexture =
    activityKind === "typing"
      ? getChatFrame(chatTexture, 7, activityFrame)
      : activityKind === "question"
        ? getChatFrame(chatTexture, 1, activityFrame)
        : Texture.EMPTY;

  const drawShadow = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.ellipse(0, -3, seated ? 11 : 13, seated ? 4 : 5);
      g.fill({ color: 0x000000, alpha: seated ? 0.12 : walking ? 0.22 : 0.18 });
    },
    [seated, walking]
  );

  const drawLabel = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      g.roundRect(labelX + 1, labelY + 2, labelWidth, 22, 8);
      g.fill({ color: 0x000000, alpha: 0.32 });

      g.roundRect(labelX, labelY, labelWidth, 22, 8);
      g.fill({ color: COLORS.nameCardBg, alpha: 0.95 });

      g.poly([0, labelY + 22, -5, labelY + 29, 5, labelY + 22]);
      g.fill({ color: COLORS.nameCardBg, alpha: 0.95 });

      g.circle(labelX + labelWidth - 13, labelY + 11, 5);
      g.fill({ color: statusColor, alpha: 0.24 });
      g.circle(labelX + labelWidth - 13, labelY + 11, 3.25);
      g.fill({ color: statusColor });
    },
    [labelWidth, labelX, labelY, statusColor]
  );

  const drawLiveCard = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      if (!liveCardText) return;

      const cardX = labelX + labelWidth + 10;
      const cardY = labelY - 6;
      const cardWidth = 214;

      g.roundRect(cardX + 2, cardY + 3, cardWidth, liveCardHeight, 10);
      g.fill({ color: 0x000000, alpha: 0.24 });

      g.roundRect(cardX, cardY, cardWidth, liveCardHeight, 10);
      g.fill({ color: 0x121926, alpha: 0.96 });
      g.stroke({ color: 0x45608c, width: 1, alpha: 0.55 });
    },
    [labelWidth, labelX, labelY, liveCardHeight, liveCardText]
  );

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={drawShadow} />
      <pixiGraphics draw={drawLabel} />
      <pixiText
        text={agent.icon || "BOT"}
        style={{ fontSize: 11, fill: 0xaeb8d2 } as TextStyleOptions}
        x={labelX + 8}
        y={labelY + 4}
      />
      <pixiText
        text={agent.name}
        style={{
          fontSize: 11,
          fill: COLORS.nameCardText,
          fontFamily: "-apple-system, 'Segoe UI', sans-serif",
          fontWeight: "600",
        } as TextStyleOptions}
        x={labelX + 26}
        y={labelY + 4}
      />
      {liveCardText && (
        <>
          <pixiGraphics draw={drawLiveCard} />
          <pixiText
            text={liveCardText}
            style={{
              fontSize: 11,
              lineHeight: 15,
              fill: 0xe6eefc,
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
              wordWrap: true,
              wordWrapWidth: 194,
              breakWords: true,
            } as TextStyleOptions}
            x={labelX + labelWidth + 20}
            y={labelY + 4}
          />
        </>
      )}
      <pixiSprite
        texture={activityTexture}
        x={labelX + labelWidth + 6}
        y={labelY - 2}
        width={24}
        height={24}
        visible={activityTexture !== Texture.EMPTY}
      />
      <pixiSprite
        texture={texture}
        x={-32}
        y={-64}
        width={64}
        height={64}
        visible={texture !== Texture.EMPTY}
      />
    </pixiContainer>
  );
}
