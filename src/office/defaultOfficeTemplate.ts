import type { Agent, AgentDesk } from "@/types/state";
import type { CharacterGender, CharacterSheetOption } from "./characterAssets";
import type { OfficeLayout } from "./layout";
import type { OfficeAssetKey } from "./officeAssets";
import { OFFICE_SIZES } from "./officeAssets";

export interface TemplateWorkstationOrigin {
  originX: number;
  originY: number;
}

export interface TemplateOfficeObject {
  id: string;
  label: string;
  assetKey: OfficeAssetKey;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  alpha: number;
  layer: number;
}

interface AvatarPreference {
  gender: CharacterGender;
  labels: string[];
}

const LARGE_TEMPLATE_MIN_WIDTH = 1280;
const LARGE_TEMPLATE_MIN_HEIGHT = 700;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function makeDeskKey(desk: AgentDesk) {
  return `${desk.col}:${desk.row}`;
}

function getDeskSequenceIndex(desk: AgentDesk, occupiedDeskKeys: Set<string>) {
  const key = makeDeskKey(desk);
  if (key === "1:2" && !occupiedDeskKeys.has("4:1")) {
    return 3;
  }

  return (desk.row - 1) * 4 + (desk.col - 1);
}

function getTemplateDeskColumns(stageW: number) {
  const firstX = clamp(Math.round(stageW * 0.317), 420, 560);
  const gap = clamp(Math.round(stageW * 0.094), 148, 160);
  return [firstX, firstX + gap, firstX + gap * 2, firstX + gap * 3];
}

function getTemplateDeskRows(layout: OfficeLayout) {
  return [
    clamp(layout.wallTop + 42, layout.wallTop + 34, layout.wallTop + 56),
    clamp(layout.wallTop + 246, layout.wallTop + 232, layout.stageH - 332),
    clamp(layout.wallTop + 362, layout.wallTop + 348, layout.stageH - 214),
    clamp(layout.wallTop + 478, layout.wallTop + 464, layout.stageH - 98),
  ];
}

export function hasLargeOfficeTemplate(layout: OfficeLayout) {
  return layout.stageW >= LARGE_TEMPLATE_MIN_WIDTH && layout.stageH >= LARGE_TEMPLATE_MIN_HEIGHT;
}

export function getDefaultWorkstationOrigin(
  layout: OfficeLayout,
  desk: AgentDesk,
  occupiedDeskKeys: Set<string>
): TemplateWorkstationOrigin | undefined {
  if (!hasLargeOfficeTemplate(layout)) return undefined;

  const index = getDeskSequenceIndex(desk, occupiedDeskKeys);
  const topColumns = getTemplateDeskColumns(layout.stageW);
  const rows = getTemplateDeskRows(layout);

  if (index >= 0 && index < topColumns.length) {
    return {
      originX: topColumns[index],
      originY: rows[0],
    };
  }

  const expansionIndex = index - 4;
  if (expansionIndex < 0) return undefined;

  const expansionColumns = [
    clamp(Math.round(layout.stageW * 0.49), 760, 900),
    clamp(Math.round(layout.stageW * 0.585), 910, 1080),
  ];
  const expansionRow = Math.floor(expansionIndex / expansionColumns.length);
  const expansionCol = expansionIndex % expansionColumns.length;
  const expansionY = rows[Math.min(rows.length - 1, expansionRow + 1)];

  return {
    originX: expansionColumns[expansionCol],
    originY: expansionY,
  };
}

export function buildDefaultOfficeObjects(layout: OfficeLayout): TemplateOfficeObject[] {
  if (!hasLargeOfficeTemplate(layout)) {
    const baseObjects: TemplateOfficeObject[] = [
      {
        id: "plant-top-left",
        label: "Planta superior esquerda",
        assetKey: "plant",
        x: 18,
        y: layout.wallTop + 16,
        width: OFFICE_SIZES.plant.width,
        height: OFFICE_SIZES.plant.height,
        rotation: 0,
        alpha: 1,
        layer: 40,
      },
      {
        id: "plant-top-right",
        label: "Planta superior direita",
        assetKey: "plant",
        x: layout.stageW - 74,
        y: layout.wallTop + 16,
        width: OFFICE_SIZES.plant.width,
        height: OFFICE_SIZES.plant.height,
        rotation: 0,
        alpha: 1,
        layer: 41,
      },
      {
        id: "plant-bottom-left",
        label: "Planta inferior esquerda",
        assetKey: "plant",
        x: 22,
        y: layout.stageH - 74,
        width: OFFICE_SIZES.plant.width,
        height: OFFICE_SIZES.plant.height,
        rotation: 0,
        alpha: 1,
        layer: 42,
      },
      {
        id: "printer-bottom-left",
        label: "Impressora",
        assetKey: "printer",
        x: 28,
        y: layout.stageH - 86,
        width: OFFICE_SIZES.printer.width,
        height: OFFICE_SIZES.printer.height,
        rotation: 0,
        alpha: 1,
        layer: 43,
      },
      {
        id: "cabinet-bottom-right",
        label: "Armario",
        assetKey: "cabinet",
        x: layout.stageW - 152,
        y: layout.stageH - 142,
        width: OFFICE_SIZES.cabinet.width,
        height: OFFICE_SIZES.cabinet.height,
        rotation: 0,
        alpha: 1,
        layer: 44,
      },
      {
        id: "water-cooler-right",
        label: "Bebedouro",
        assetKey: "waterCooler",
        x: layout.stageW - 44,
        y: layout.wallTop + Math.round(layout.floorH * 0.46),
        width: OFFICE_SIZES.waterCooler.width,
        height: OFFICE_SIZES.waterCooler.height,
        rotation: 0,
        alpha: 1,
        layer: 45,
      },
      {
        id: "trash-bottom-right",
        label: "Lixeira",
        assetKey: "trash",
        x: layout.stageW - 86,
        y: layout.stageH - 38,
        width: OFFICE_SIZES.trash.width,
        height: OFFICE_SIZES.trash.height,
        rotation: 0,
        alpha: 1,
        layer: 46,
      },
    ];

    if (layout.stageW > 980) {
      baseObjects.push({
        id: "coffee-maker-right",
        label: "Cafe",
        assetKey: "coffeeMaker",
        x: layout.stageW - 112,
        y: layout.wallTop + 92,
        width: OFFICE_SIZES.coffeeMaker.width,
        height: OFFICE_SIZES.coffeeMaker.height,
        rotation: 0,
        alpha: 1,
        layer: 47,
      });
    }

    return baseObjects;
  }

  const leftClusterY = layout.wallTop - 18;
  const lowerClusterY = layout.wallTop + 332;

  return [
    {
      id: "water-cooler-left",
      label: "Bebedouro",
      assetKey: "waterCooler",
      x: clamp(Math.round(layout.stageW * 0.216), 260, 420),
      y: leftClusterY,
      width: OFFICE_SIZES.waterCooler.width,
      height: OFFICE_SIZES.waterCooler.height,
      rotation: 0,
      alpha: 1,
      layer: 40,
    },
    {
      id: "coffee-maker-left",
      label: "Cafe",
      assetKey: "coffeeMaker",
      x: clamp(Math.round(layout.stageW * 0.236), 300, 460),
      y: leftClusterY - 2,
      width: OFFICE_SIZES.coffeeMaker.width,
      height: OFFICE_SIZES.coffeeMaker.height,
      rotation: 0,
      alpha: 1,
      layer: 41,
    },
    {
      id: "plant-left",
      label: "Planta esquerda",
      assetKey: "plant",
      x: clamp(Math.round(layout.stageW * 0.304), 420, 580),
      y: layout.wallTop + 16,
      width: OFFICE_SIZES.plant.width,
      height: OFFICE_SIZES.plant.height,
      rotation: 0,
      alpha: 1,
      layer: 42,
    },
    {
      id: "cabinet-upper-center",
      label: "Armario",
      assetKey: "cabinet",
      x: clamp(Math.round(layout.stageW * 0.875), layout.stageW - 260, layout.stageW - 152),
      y: layout.wallTop - 18,
      width: OFFICE_SIZES.cabinet.width,
      height: OFFICE_SIZES.cabinet.height,
      rotation: 0,
      alpha: 1,
      layer: 43,
    },
    {
      id: "plant-right",
      label: "Planta direita",
      assetKey: "plant",
      x: clamp(Math.round(layout.stageW * 0.853), layout.stageW - 300, layout.stageW - 92),
      y: layout.wallTop + 16,
      width: OFFICE_SIZES.plant.width,
      height: OFFICE_SIZES.plant.height,
      rotation: 0,
      alpha: 1,
      layer: 44,
    },
    {
      id: "plant-lower-left",
      label: "Planta inferior",
      assetKey: "plant",
      x: Math.round(layout.stageW * 0.279),
      y: lowerClusterY + 8,
      width: OFFICE_SIZES.plant.width,
      height: OFFICE_SIZES.plant.height,
      rotation: 0,
      alpha: 1,
      layer: 45,
    },
    {
      id: "printer-lower-left-a",
      label: "Impressora A",
      assetKey: "printer",
      x: Math.round(layout.stageW * 0.296),
      y: lowerClusterY - 18,
      width: OFFICE_SIZES.printer.width,
      height: OFFICE_SIZES.printer.height,
      rotation: 0,
      alpha: 1,
      layer: 46,
    },
    {
      id: "printer-lower-left-b",
      label: "Impressora B",
      assetKey: "printer",
      x: Math.round(layout.stageW * 0.329),
      y: lowerClusterY - 18,
      width: OFFICE_SIZES.printer.width,
      height: OFFICE_SIZES.printer.height,
      rotation: 0,
      alpha: 1,
      layer: 47,
    },
    {
      id: "printer-lower-left-c",
      label: "Impressora C",
      assetKey: "printer",
      x: Math.round(layout.stageW * 0.362),
      y: lowerClusterY - 18,
      width: OFFICE_SIZES.printer.width,
      height: OFFICE_SIZES.printer.height,
      rotation: 0,
      alpha: 1,
      layer: 48,
    },
    {
      id: "trash-lower-left",
      label: "Lixeira",
      assetKey: "trash",
      x: Math.round(layout.stageW * 0.402),
      y: lowerClusterY + 14,
      width: OFFICE_SIZES.trash.width,
      height: OFFICE_SIZES.trash.height,
      rotation: 0,
      alpha: 1,
      layer: 49,
    },
  ];
}

function getAgentAvatarPreference(agent: Agent): AvatarPreference | null {
  const target = `${agent.id} ${agent.name}`.toLowerCase();

  if (target.includes("sofia") || target.includes("segmento")) {
    return { gender: "Mulher", labels: ["dorio", "rachel", "judycasual"] };
  }

  if (target.includes("iago") || target.includes("instagram")) {
    return { gender: "Homem", labels: ["sapper", "neanderwallace", "k casual"] };
  }

  if (target.includes("lina") || target.includes("layout")) {
    return { gender: "Mulher", labels: ["rebecca", "judycasual", "rachel"] };
  }

  if (target.includes("rita") || target.includes("review")) {
    return { gender: "Mulher", labels: ["luv corp", "rachel", "judycasual"] };
  }

  return null;
}

function getBossAvatarPreference(): AvatarPreference {
  return { gender: "Homem", labels: ["neanderwallace", "k casual", "sapper"] };
}

export function resolvePreferredSheetIndex(
  options: CharacterSheetOption[],
  labels: string[],
  gender?: CharacterGender
) {
  const normalizedLabels = labels.map(normalizeLabel);

  for (const label of normalizedLabels) {
    const match = options.find(
      (option) =>
        (!gender || option.gender === gender) &&
        normalizeLabel(option.label) === label
    );
    if (match) return match.index;
  }

  return undefined;
}

export function getDefaultAgentAppearance(options: CharacterSheetOption[], agent: Agent) {
  const preference = getAgentAvatarPreference(agent);
  if (!preference) return null;

  const sheetIndex = resolvePreferredSheetIndex(options, preference.labels, preference.gender);
  if (sheetIndex == null) return null;

  return {
    gender: preference.gender,
    sheetIndex,
  };
}

export function getDefaultBossAppearance(options: CharacterSheetOption[]) {
  const preference = getBossAvatarPreference();
  const sheetIndex = resolvePreferredSheetIndex(options, preference.labels, preference.gender);

  if (sheetIndex == null) {
    return null;
  }

  return {
    gender: preference.gender,
    sheetIndex,
  };
}
