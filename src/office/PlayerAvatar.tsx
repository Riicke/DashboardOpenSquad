import { extend } from "@pixi/react";
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { useCallback } from "react";
import type { Graphics as PixiGraphics, TextStyleOptions } from "pixi.js";
import { getCharacterFrame } from "./characterAssets";
import type { PlayerState } from "./usePlayerController";

extend({ Container, Graphics, Sprite, Text });

interface PlayerAvatarProps {
  player: PlayerState;
  sheetTexture?: Texture;
}

export function PlayerAvatar({ player, sheetTexture }: PlayerAvatarProps) {
  const texture = getCharacterFrame(sheetTexture, player.direction, player.frameIndex);

  const drawShadow = useCallback((g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, -3, 13, 5);
    g.fill({ color: 0x000000, alpha: player.moving ? 0.2 : 0.15 });
  }, [player.moving]);

  const drawLabel = useCallback((g: PixiGraphics) => {
    g.clear();
    g.roundRect(-31, -79, 62, 18, 7);
    g.fill({ color: 0x10243b, alpha: 0.95 });
    g.roundRect(-30, -78, 60, 16, 6);
    g.stroke({ color: 0x5ab8ff, width: 1 });
    g.poly([0, -61, -4, -55, 4, -61]);
    g.fill({ color: 0x10243b, alpha: 0.95 });
  }, []);

  return (
    <pixiContainer x={player.x} y={player.y}>
      <pixiGraphics draw={drawShadow} />
      <pixiGraphics draw={drawLabel} />
      <pixiText
        text={"BOSS"}
        style={{
          fontSize: 9,
          fill: 0xd8f0ff,
          fontFamily: "-apple-system, 'Segoe UI', sans-serif",
          fontWeight: "700",
        } as TextStyleOptions}
        x={-15}
        y={-76}
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
