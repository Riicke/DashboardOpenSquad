import { CanvasSource, Texture } from "pixi.js";
import { COLORS, type CharacterVariant } from "./palette";

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function colorToCss(hex: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r},${g},${b})`;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: number) {
  ctx.fillStyle = colorToCss(color);
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number) {
  ctx.fillStyle = colorToCss(color);
  ctx.fillRect(x, y, w, h);
}

function hspan(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: number) {
  for (let x = x1; x <= x2; x++) {
    px(ctx, x, y, color);
  }
}

function fillRows(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  startY: number,
  halfWidths: number[],
  color: number
) {
  halfWidths.forEach((halfWidth, index) => {
    hspan(ctx, centerX - halfWidth, centerX + halfWidth, startY + index, color);
  });
}

type Pose = "idle" | "working0" | "working1" | "done" | "checkpoint";

function drawHeadBack(ctx: CanvasRenderingContext2D, variant: CharacterVariant) {
  fillRows(ctx, 24, 6, [6, 7, 8, 8, 8, 7, 6], variant.hair);

  switch (variant.hairStyle) {
    case "parted":
      hspan(ctx, 22, 23, 7, variant.hairLight);
      hspan(ctx, 25, 26, 7, variant.hairLight);
      rect(ctx, 17, 10, 2, 3, variant.hairDark);
      rect(ctx, 29, 10, 2, 3, variant.hairDark);
      break;
    case "crop":
      hspan(ctx, 20, 28, 7, variant.hairLight);
      px(ctx, 18, 10, variant.hairDark);
      px(ctx, 30, 10, variant.hairDark);
      break;
    case "bob":
      rect(ctx, 16, 10, 2, 4, variant.hairDark);
      rect(ctx, 30, 10, 2, 4, variant.hairDark);
      hspan(ctx, 20, 28, 7, variant.hairLight);
      break;
    case "bun":
      rect(ctx, 21, 3, 6, 2, variant.hair);
      rect(ctx, 22, 3, 4, 1, variant.hairLight);
      rect(ctx, 17, 10, 2, 3, variant.hairDark);
      rect(ctx, 29, 10, 2, 3, variant.hairDark);
      break;
    case "wave":
      hspan(ctx, 18, 23, 7, variant.hairLight);
      hspan(ctx, 25, 29, 8, variant.hairLight);
      rect(ctx, 16, 9, 2, 4, variant.hairDark);
      rect(ctx, 30, 9, 2, 4, variant.hairDark);
      break;
    case "fade":
      hspan(ctx, 21, 27, 7, variant.hairLight);
      rect(ctx, 17, 9, 1, 4, variant.hairDark);
      rect(ctx, 31, 9, 1, 4, variant.hairDark);
      break;
  }

  hspan(ctx, 21, 27, 12, variant.skin);
  hspan(ctx, 22, 26, 13, variant.skin);
  hspan(ctx, 22, 26, 14, variant.skinShadow);
}

function drawAccessory(ctx: CanvasRenderingContext2D, variant: CharacterVariant) {
  if (variant.accessory === "glasses") {
    rect(ctx, 18, 10, 1, 4, COLORS.glassesFrame);
    rect(ctx, 30, 10, 1, 4, COLORS.glassesFrame);
    px(ctx, 18, 11, COLORS.glassesGlint);
    px(ctx, 30, 11, COLORS.glassesGlint);
    return;
  }

  if (variant.accessory === "headset") {
    hspan(ctx, 19, 29, 5, COLORS.headsetBand);
    rect(ctx, 17, 9, 2, 4, COLORS.headsetPad);
    rect(ctx, 29, 9, 2, 4, COLORS.headsetPad);
    px(ctx, 30, 13, COLORS.headsetPad);
    px(ctx, 31, 14, COLORS.headsetPad);
  }
}

function drawTorso(ctx: CanvasRenderingContext2D, variant: CharacterVariant) {
  switch (variant.outfit) {
    case "blazer":
      fillRows(ctx, 24, 16, [7, 8, 9, 9, 8, 7], variant.shirt);
      hspan(ctx, 22, 26, 16, COLORS.collarWhite);
      px(ctx, 21, 17, variant.shirtDark);
      px(ctx, 27, 17, variant.shirtDark);
      px(ctx, 23, 18, variant.accent);
      px(ctx, 24, 18, variant.accent);
      break;
    case "hoodie":
      fillRows(ctx, 24, 16, [8, 9, 10, 9, 8, 7], variant.shirt);
      hspan(ctx, 21, 27, 16, variant.shirtLight);
      px(ctx, 23, 18, variant.accent);
      px(ctx, 24, 18, variant.accent);
      break;
    case "shirt":
      fillRows(ctx, 24, 16, [6, 7, 8, 8, 7, 6], variant.shirt);
      hspan(ctx, 22, 26, 16, COLORS.collarWhite);
      px(ctx, 23, 18, variant.accent);
      px(ctx, 24, 18, variant.accent);
      break;
    case "sweater":
      fillRows(ctx, 24, 16, [7, 8, 9, 8, 7, 6], variant.shirt);
      hspan(ctx, 21, 27, 16, variant.shirtLight);
      px(ctx, 23, 18, variant.accent);
      px(ctx, 24, 18, variant.accent);
      break;
  }

  px(ctx, 18, 21, variant.shirtDark);
  px(ctx, 30, 21, variant.shirtDark);
  hspan(ctx, 21, 27, 22, variant.shirtDark);
}

function drawIdleArms(ctx: CanvasRenderingContext2D, variant: CharacterVariant) {
  rect(ctx, 15, 18, 3, 6, variant.shirtDark);
  rect(ctx, 30, 18, 3, 6, variant.shirtDark);
  rect(ctx, 15, 24, 3, 3, variant.skin);
  rect(ctx, 30, 24, 3, 3, variant.skin);
  px(ctx, 16, 26, variant.skinShadow);
  px(ctx, 31, 26, variant.skinShadow);
}

function drawWorkingArms(ctx: CanvasRenderingContext2D, variant: CharacterVariant, frame: 0 | 1) {
  rect(ctx, 15, 18, 3, 5, variant.shirtDark);
  rect(ctx, 30, 18, 3, 5, variant.shirtDark);

  if (frame === 0) {
    rect(ctx, 13, 21, 7, 3, variant.shirt);
    rect(ctx, 28, 21, 7, 3, variant.shirt);
    rect(ctx, 18, 22, 4, 2, variant.skin);
    rect(ctx, 26, 22, 4, 2, variant.skin);
  } else {
    rect(ctx, 14, 20, 7, 3, variant.shirt);
    rect(ctx, 27, 22, 7, 3, variant.shirt);
    rect(ctx, 19, 21, 4, 2, variant.skin);
    rect(ctx, 25, 23, 4, 2, variant.skin);
  }

  px(ctx, 20, 23, variant.skinShadow);
  px(ctx, 28, 23, variant.skinShadow);
}

function drawDonePose(ctx: CanvasRenderingContext2D, variant: CharacterVariant) {
  drawIdleArms(ctx, variant);
  rect(ctx, 11, 16, 3, 3, variant.shirtDark);
  rect(ctx, 9, 12, 3, 4, variant.skin);
  rect(ctx, 8, 9, 3, 3, variant.skin);

  rect(ctx, 33, 16, 3, 3, variant.shirtLight);
  rect(ctx, 36, 12, 3, 4, variant.skin);
  rect(ctx, 38, 9, 2, 3, variant.skin);

  px(ctx, 10, 9, variant.accent);
  px(ctx, 38, 10, variant.accent);
  px(ctx, 13, 7, COLORS.statusDone);
  px(ctx, 35, 7, COLORS.statusDone);
}

function drawCheckpointPose(ctx: CanvasRenderingContext2D, variant: CharacterVariant) {
  rect(ctx, 15, 18, 3, 5, variant.shirtDark);
  rect(ctx, 14, 23, 3, 3, variant.skin);
  rect(ctx, 30, 18, 3, 4, variant.shirtLight);
  rect(ctx, 32, 15, 3, 4, variant.skin);
  rect(ctx, 34, 12, 4, 5, COLORS.notePaper);
  px(ctx, 34, 12, COLORS.noteEdge);
  px(ctx, 37, 16, COLORS.noteEdge);
  px(ctx, 35, 14, variant.accent);
  px(ctx, 36, 15, variant.accent);
}

function drawMonitorGlow(ctx: CanvasRenderingContext2D, variant: CharacterVariant) {
  hspan(ctx, 20, 28, 16, variant.shirtLight);
  px(ctx, 21, 15, COLORS.monitorScreenOn);
  px(ctx, 27, 15, COLORS.monitorScreenOn);
}

function drawAvatar(ctx: CanvasRenderingContext2D, variant: CharacterVariant, pose: Pose) {
  drawHeadBack(ctx, variant);
  drawAccessory(ctx, variant);
  drawTorso(ctx, variant);

  switch (pose) {
    case "idle":
      drawIdleArms(ctx, variant);
      break;
    case "working0":
      drawWorkingArms(ctx, variant, 0);
      drawMonitorGlow(ctx, variant);
      break;
    case "working1":
      drawWorkingArms(ctx, variant, 1);
      drawMonitorGlow(ctx, variant);
      break;
    case "done":
      drawDonePose(ctx, variant);
      break;
    case "checkpoint":
      drawCheckpointPose(ctx, variant);
      drawMonitorGlow(ctx, variant);
      break;
  }
}

export interface CharacterTextures {
  idle: Texture;
  working: [Texture, Texture];
  done: Texture;
  checkpoint: Texture;
}

export function generateCharacterTextures(variant: CharacterVariant): CharacterTextures {
  const size = 48;

  function makeFrame(drawFn: (ctx: CanvasRenderingContext2D) => void): Texture {
    const [canvas, ctx] = createCanvas(size, size);
    drawFn(ctx);
    return new Texture({
      source: new CanvasSource({ resource: canvas, scaleMode: "nearest" }),
    });
  }

  return {
    idle: makeFrame((ctx) => drawAvatar(ctx, variant, "idle")),
    working: [
      makeFrame((ctx) => drawAvatar(ctx, variant, "working0")),
      makeFrame((ctx) => drawAvatar(ctx, variant, "working1")),
    ],
    done: makeFrame((ctx) => drawAvatar(ctx, variant, "done")),
    checkpoint: makeFrame((ctx) => drawAvatar(ctx, variant, "checkpoint")),
  };
}

const textureCache = new Map<string, CharacterTextures>();

export function getCharacterTextures(variant: CharacterVariant): CharacterTextures {
  if (!textureCache.has(variant.id)) {
    textureCache.set(variant.id, generateCharacterTextures(variant));
  }
  return textureCache.get(variant.id)!;
}
