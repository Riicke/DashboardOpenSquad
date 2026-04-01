const skyJpgAssetUrls = import.meta.glob("../ceu/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const skyPngAssetUrls = import.meta.glob("../ceu/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const otherPngAssetUrls = import.meta.glob("../other/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const skyAssetUrls = {
  ...skyJpgAssetUrls,
  ...skyPngAssetUrls,
  ...otherPngAssetUrls,
};

function assetPathFor(fileName: string) {
  const match = Object.entries(skyAssetUrls).find(([filePath]) =>
    filePath.endsWith(`/${fileName}`)
  );

  if (!match) {
    throw new Error(`[skyAssets] Missing asset: ${fileName}`);
  }

  return match[1];
}

export const SKY_ASSET_PATHS = {
  manha: assetPathFor("manha.jpg"),
  tarde2: assetPathFor("tarde2.jpg"),
  tarde: assetPathFor("tarde.jpg"),
  noite: assetPathFor("noite.jpg"),
} as const;

export const SKY_WINDOW_PATH = assetPathFor("window.png");
export const SKY_WINDOW_TEXTURE_PATHS = {
  window: SKY_WINDOW_PATH,
} as const;

export const SKY_ALERT_TEXTURE_PATHS = {
  alert: assetPathFor("alert.png"),
} as const;

export const CHAT_TEXTURE_PATHS = {
  chat: assetPathFor("chat.png"),
} as const;

export type SkyPeriodKey = keyof typeof SKY_ASSET_PATHS;

export function getSkyPeriodForHour(hour: number): SkyPeriodKey {
  if (hour >= 5 && hour < 14) return "manha";
  if (hour >= 14 && hour < 16) return "tarde2";
  if (hour >= 16 && hour < 19) return "tarde";
  return "noite";
}
