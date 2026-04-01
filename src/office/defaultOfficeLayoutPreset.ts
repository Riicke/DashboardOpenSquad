import type { OfficeLayoutData } from "@/types/officeLayout";

export function createDefaultProjectOfficeLayoutData(): OfficeLayoutData {
  return {
    version: 1,
    customAgents: [],
    agentMeta: {
      "sofia-segmento": {
        sheetIndex: 15,
      },
      "iago-instagram": {
        sheetIndex: 3,
      },
      "rita-review": {
        sheetIndex: 14,
      },
    },
    workstationOrigins: {},
    officeObjectOverrides: {
      "coffee-maker-left": {
        x: 400,
        y: 139,
      },
      "water-cooler-left": {
        x: 362,
        y: 153,
      },
      "plant-left": {
        x: 488,
        y: 159,
      },
      "plant-lower-left": {
        x: 449,
        y: 503,
      },
      "cabinet-upper-center": {
        y: 118,
      },
      "plant-right": {
        x: 1459,
        y: 160,
      },
      "partition:iago-instagram": {
        x: 770,
      },
      "partition:lina-layout": {
        x: 1090,
      },
      "trash-lower-left": {
        x: 614,
        y: 537,
      },
    },
    removedOfficeObjectIds: ["printer-lower-left-b", "printer-lower-left-c"],
    customOfficeObjects: [
      {
        id: "default-office-object-desk2-1",
        assetKey: "desk2",
        label: "Desk 2 1",
        x: 103,
        y: 157,
        width: 70,
        height: 64,
        rotation: 0,
        alpha: 1,
        layer: 60,
      },
      {
        id: "default-office-object-bossDesk-1",
        assetKey: "bossDesk",
        label: "Boss Desk 1",
        x: 208,
        y: 136,
        width: 80,
        height: 80,
        rotation: 0,
        alpha: 1,
        layer: 62,
      },
      {
        id: "default-office-object-chair2-1",
        assetKey: "chair2",
        label: "Chair 2 1",
        x: 130,
        y: 192,
        width: 40,
        height: 40,
        rotation: 0,
        alpha: 1,
        layer: 63,
      },
    ],
    lastAcknowledgedOutputId: null,
    playerAppearance: {
      gender: "Homem",
      sheetIndex: 8,
    },
  };
}
