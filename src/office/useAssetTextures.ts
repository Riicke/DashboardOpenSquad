import { Assets, Texture } from "pixi.js";
import { useEffect, useState } from "react";

export function useAssetTextures<T extends Record<string, string>>(assetPaths: T) {
  const [textures, setTextures] = useState<{ [K in keyof T]: Texture } | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      Object.entries(assetPaths).map(async ([key, path]) => {
        const texture = await Assets.load(path);
        texture.source.scaleMode = "nearest";
        return [key, texture] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setTextures(Object.fromEntries(entries) as { [K in keyof T]: Texture });
      })
      .catch((error) => {
        console.error("[useAssetTextures] Failed to load textures", error);
      });

    return () => {
      cancelled = true;
    };
  }, [assetPaths]);

  return textures;
}
