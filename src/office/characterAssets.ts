import { Rectangle, Texture } from "pixi.js";

export type CharacterDirection = "down" | "left" | "right" | "up";
export type CharacterGender = "Homem" | "Mulher";

export interface CharacterSheetOption {
  index: number;
  path: string;
  gender: CharacterGender;
  label: string;
}

interface CharacterSheetFrames {
  down: Texture[];
  left: Texture[];
  right: Texture[];
  up: Texture[];
}

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const DIRECTIONS: CharacterDirection[] = ["down", "left", "right", "up"];
const frameCache = new WeakMap<Texture, CharacterSheetFrames>();

const characterUrls = import.meta.glob("../characters/*/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function formatSheetLabel(filePath: string) {
  const name = filePath.split("/").pop() ?? "avatar";
  return name.replace(/^\$/, "").replace(/\.png$/i, "").replace(/[-_]/g, " ");
}

export const CHARACTER_SHEET_OPTIONS: CharacterSheetOption[] = Object.entries(characterUrls)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([filePath, path], index) => ({
    index,
    path,
    gender: filePath.includes("/Mulher/") ? "Mulher" : "Homem",
    label: formatSheetLabel(filePath),
  }));

export const CHARACTER_SHEET_PATHS = CHARACTER_SHEET_OPTIONS.map((option) => option.path);

function createSheetFrames(baseTexture: Texture): CharacterSheetFrames {
  const cached = frameCache.get(baseTexture);
  if (cached) return cached;

  baseTexture.source.scaleMode = "nearest";

  const frames: CharacterSheetFrames = {
    down: [],
    left: [],
    right: [],
    up: [],
  };

  DIRECTIONS.forEach((direction, row) => {
    for (let col = 0; col < 3; col += 1) {
      frames[direction].push(
        new Texture({
          source: baseTexture.source,
          frame: new Rectangle(col * FRAME_WIDTH, row * FRAME_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT),
          orig: new Rectangle(0, 0, FRAME_WIDTH, FRAME_HEIGHT),
        })
      );
    }
  });

  frameCache.set(baseTexture, frames);
  return frames;
}

export function getCharacterSheetCount() {
  return CHARACTER_SHEET_OPTIONS.length;
}

export function getCharacterFrame(
  baseTexture: Texture | undefined,
  direction: CharacterDirection,
  frameIndex: number
) {
  if (!baseTexture) return Texture.EMPTY;

  const frames = createSheetFrames(baseTexture);
  return frames[direction][frameIndex] ?? frames[direction][1] ?? Texture.EMPTY;
}

export function getCharacterOptionsByGender(gender: CharacterGender) {
  return CHARACTER_SHEET_OPTIONS.filter((option) => option.gender === gender);
}
