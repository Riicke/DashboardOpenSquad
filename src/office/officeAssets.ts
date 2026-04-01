const officeAssetUrls = import.meta.glob("../escritorio/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const OFFICE_SIZES = {
  desk: { width: 128, height: 64 },
  deskWithPc: { width: 128, height: 64 },
  pc: { width: 64, height: 64 },
  chair: { width: 32, height: 32 },
  partition: { width: 112, height: 112 },
  cabinet: { width: 128, height: 128 },
  coffeeMaker: { width: 96, height: 96 },
  plant: { width: 56, height: 56 },
  printer: { width: 112, height: 56 },
  sink: { width: 112, height: 112 },
  stampingTable: { width: 112, height: 56 },
  trash: { width: 28, height: 28 },
  waterCooler: { width: 32, height: 64 },
  writingTable: { width: 112, height: 112 },
} as const;

type KnownOfficeAssetMeta = {
  key: string;
  label: string;
  width: number;
  height: number;
  maxInstances?: number;
};

const KNOWN_ASSET_META_BY_FILE: Record<string, KnownOfficeAssetMeta> = {
  "desk.png": {
    key: "desk",
    label: "Mesa",
    width: OFFICE_SIZES.desk.width,
    height: OFFICE_SIZES.desk.height,
  },
  "desk-with-pc.png": {
    key: "deskWithPc",
    label: "Mesa com PC",
    width: OFFICE_SIZES.deskWithPc.width,
    height: OFFICE_SIZES.deskWithPc.height,
  },
  "PC1.png": {
    key: "pcOn",
    label: "PC ligado",
    width: OFFICE_SIZES.pc.width,
    height: OFFICE_SIZES.pc.height,
  },
  "PC2.png": {
    key: "pcOff",
    label: "PC desligado",
    width: OFFICE_SIZES.pc.width,
    height: OFFICE_SIZES.pc.height,
  },
  "Chair.png": {
    key: "chair",
    label: "Cadeira",
    width: OFFICE_SIZES.chair.width,
    height: OFFICE_SIZES.chair.height,
  },
  "office-partitions-1.png": {
    key: "partitionA",
    label: "Divisoria A",
    width: OFFICE_SIZES.partition.width,
    height: OFFICE_SIZES.partition.height,
  },
  "office-partitions-2.png": {
    key: "partitionB",
    label: "Divisoria B",
    width: OFFICE_SIZES.partition.width,
    height: OFFICE_SIZES.partition.height,
  },
  "cabinet.png": {
    key: "cabinet",
    label: "Armario",
    width: OFFICE_SIZES.cabinet.width,
    height: OFFICE_SIZES.cabinet.height,
  },
  "coffee-maker.png": {
    key: "coffeeMaker",
    label: "Cafe",
    width: OFFICE_SIZES.coffeeMaker.width,
    height: OFFICE_SIZES.coffeeMaker.height,
  },
  "plant.png": {
    key: "plant",
    label: "Planta",
    width: OFFICE_SIZES.plant.width,
    height: OFFICE_SIZES.plant.height,
  },
  "printer.png": {
    key: "printer",
    label: "Impressora",
    width: OFFICE_SIZES.printer.width,
    height: OFFICE_SIZES.printer.height,
  },
  "sink.png": {
    key: "sink",
    label: "Pia",
    width: OFFICE_SIZES.sink.width,
    height: OFFICE_SIZES.sink.height,
  },
  "stamping-table.png": {
    key: "stampingTable",
    label: "Mesa auxiliar",
    width: OFFICE_SIZES.stampingTable.width,
    height: OFFICE_SIZES.stampingTable.height,
  },
  "Trash.png": {
    key: "trash",
    label: "Lixeira",
    width: OFFICE_SIZES.trash.width,
    height: OFFICE_SIZES.trash.height,
  },
  "water-cooler.png": {
    key: "waterCooler",
    label: "Bebedouro",
    width: OFFICE_SIZES.waterCooler.width,
    height: OFFICE_SIZES.waterCooler.height,
  },
  "writing-table.png": {
    key: "writingTable",
    label: "Mesa de apoio",
    width: OFFICE_SIZES.writingTable.width,
    height: OFFICE_SIZES.writingTable.height,
  },
  "Boss-Desk.png": {
    key: "bossDesk",
    label: "Boss Desk",
    width: 80,
    height: 80,
    maxInstances: 1,
  },
};

function fileNameFromPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function toAssetKey(fileName: string) {
  const base = stripExtension(fileName);
  const tokens = base.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return "asset";

  return tokens
    .map((token, index) => {
      const lower = token.toLowerCase();
      if (index === 0) return lower;
      return lower[0]?.toUpperCase() + lower.slice(1);
    })
    .join("");
}

function toAssetLabel(fileName: string) {
  return stripExtension(fileName)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(" ");
}

function inferOfficeAssetSize(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.includes("partition")) return { width: 112, height: 112 };
  if (lower.includes("pc")) return { width: 64, height: 64 };
  if (lower.includes("chair")) return { width: 40, height: 40 };
  if (lower.includes("clock") || lower.includes("note") || lower.includes("paper") || lower.includes("books")) {
    return { width: 64, height: 48 };
  }
  if (lower.includes("desk")) {
    return lower.includes("boss") ? { width: 160, height: 80 } : { width: 128, height: 64 };
  }
  if (lower.includes("printer")) {
    return lower.includes("furniture") ? { width: 128, height: 96 } : { width: 112, height: 56 };
  }
  if (lower.includes("cabinet") || lower.includes("bookshelf") || lower.includes("vending")) {
    return lower.includes("small") ? { width: 80, height: 112 } : { width: 112, height: 128 };
  }
  if (lower.includes("plant")) {
    return lower.includes("big") ? { width: 72, height: 88 } : { width: 56, height: 56 };
  }
  if (lower.includes("sofa")) {
    return lower.includes("big") ? { width: 128, height: 80 } : { width: 96, height: 64 };
  }
  if (lower.includes("table") || lower.includes("sink") || lower.includes("toilet") || lower.includes("mirror")) {
    return { width: 96, height: 96 };
  }
  if (lower.includes("dispenser") || lower.includes("cooler")) {
    return { width: 40, height: 72 };
  }

  return { width: 96, height: 96 };
}

const officeAssetDefinitions = (() => {
  const usedKeys = new Set<string>();

  return Object.entries(officeAssetUrls)
    .map(([filePath, path]) => {
      const fileName = fileNameFromPath(filePath);
      const known = KNOWN_ASSET_META_BY_FILE[fileName];
      let key = known?.key ?? toAssetKey(fileName);

      if (usedKeys.has(key)) {
        let suffix = 2;
        while (usedKeys.has(`${key}${suffix}`)) {
          suffix += 1;
        }
        key = `${key}${suffix}`;
      }

      usedKeys.add(key);

      const size = known ?? inferOfficeAssetSize(fileName);

      return {
        key,
        label: known?.label ?? toAssetLabel(fileName),
        path,
        width: size.width,
        height: size.height,
        maxInstances: known?.maxInstances,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
})();

export type OfficeAssetKey = string;

export interface OfficeAssetDefinition {
  key: OfficeAssetKey;
  label: string;
  path: string;
  width: number;
  height: number;
  maxInstances?: number;
}

export const OFFICE_OBJECT_LIBRARY: OfficeAssetDefinition[] = officeAssetDefinitions;

export const OFFICE_ASSET_PATHS: Record<string, string> = Object.fromEntries(
  OFFICE_OBJECT_LIBRARY.map((asset) => [asset.key, asset.path])
);

export function getOfficeAssetDefinition(assetKey: OfficeAssetKey) {
  const match = OFFICE_OBJECT_LIBRARY.find((asset) => asset.key === assetKey);
  if (!match) {
    throw new Error(`[officeAssets] Missing asset definition for: ${assetKey}`);
  }

  return match;
}
