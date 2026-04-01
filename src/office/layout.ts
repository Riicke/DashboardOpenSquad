import type { AgentDesk } from "@/types/state";
import { CELL_H, CELL_W, TILE } from "./palette";

export interface OfficeLayout {
  stageW: number;
  stageH: number;
  wallTop: number;
  floorX: number;
  floorY: number;
  floorW: number;
  floorH: number;
  deskStartX: number;
  deskEndX: number;
  deskStartY: number;
  deskEndY: number;
  maxCol: number;
  maxRow: number;
}

export interface WorkstationLayout {
  originX: number;
  originY: number;
  deskX: number;
  deskY: number;
  pcX: number;
  pcY: number;
  chairX: number;
  chairY: number;
  seatX: number;
  seatY: number;
}

export interface WorkstationOriginOverride {
  originX: number;
  originY: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distribute(index: number, count: number, start: number, end: number, singleT: number) {
  if (count <= 1) {
    return Math.round(start + (end - start) * singleT);
  }

  const t = (index - 1) / (count - 1);
  return Math.round(start + (end - start) * t);
}

export function createOfficeLayout(stageW: number, stageH: number, maxCol: number, maxRow: number): OfficeLayout {
  const wallTop = clamp(Math.round(stageH * 0.22), TILE * 5, TILE * 7);
  const floorX = 0;
  const floorY = wallTop;
  const floorW = stageW;
  const floorH = Math.max(stageH - wallTop, CELL_H + TILE * 4);
  const deskStartX = TILE * 2.5;
  const deskEndX = Math.max(deskStartX, stageW - CELL_W - TILE * 2.5);
  const deskStartY = wallTop + Math.round(TILE * 2.6);
  const deskBandBottom = wallTop + Math.round(floorH * 0.56);
  const deskEndY = Math.max(deskStartY, Math.min(deskBandBottom, stageH - CELL_H - TILE * 2.5));

  return {
    stageW,
    stageH,
    wallTop,
    floorX,
    floorY,
    floorW,
    floorH,
    deskStartX,
    deskEndX,
    deskStartY,
    deskEndY,
    maxCol,
    maxRow,
  };
}

export function getDeskOrigin(layout: OfficeLayout, desk: AgentDesk) {
  return {
    x: distribute(desk.col, layout.maxCol, layout.deskStartX, layout.deskEndX, 0.5),
    y: distribute(desk.row, layout.maxRow, layout.deskStartY, layout.deskEndY, 0.24),
  };
}

export function getDeskCenter(layout: OfficeLayout, desk: AgentDesk) {
  const origin = getDeskOrigin(layout, desk);
  return {
    x: origin.x + CELL_W / 2,
    y: origin.y + CELL_H / 2,
  };
}

export function getWorkstationLayoutFromOrigin(originX: number, originY: number): WorkstationLayout {
  const deskX = originX;
  const deskY = originY + 38;
  const pcX = originX + 36;
  const pcY = originY + 18;
  const chairX = originX + 48;
  const chairY = originY + 72;
  const seatX = originX + 64;
  const seatY = originY + 104;

  return {
    originX,
    originY,
    deskX,
    deskY,
    pcX,
    pcY,
    chairX,
    chairY,
    seatX,
    seatY,
  };
}

export function getWorkstationLayout(
  layout: OfficeLayout,
  desk: AgentDesk,
  originOverride?: WorkstationOriginOverride
): WorkstationLayout {
  if (originOverride) {
    return getWorkstationLayoutFromOrigin(originOverride.originX, originOverride.originY);
  }

  const origin = getDeskOrigin(layout, desk);
  return getWorkstationLayoutFromOrigin(origin.x, origin.y);
}
