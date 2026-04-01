import type { Agent } from "./state";

export type OfficeCharacterGender = "Homem" | "Mulher";

export interface EditableAgentMeta {
  name?: string;
  icon?: string;
  role?: string;
  gender?: OfficeCharacterGender;
  sheetIndex?: number;
}

export interface PersistedCustomAgent extends Agent {
  role: string;
  gender: OfficeCharacterGender;
  sheetIndex: number;
}

export interface WorkstationOrigin {
  originX: number;
  originY: number;
}

export interface OfficeObjectOverride {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  alpha?: number;
  layer?: number;
}

export interface PersistedOfficeObject {
  id: string;
  assetKey: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  alpha: number;
  layer: number;
}

export interface PlayerAppearance {
  gender: OfficeCharacterGender;
  sheetIndex: number;
}

export interface OfficeLayoutData {
  version: 1;
  customAgents: PersistedCustomAgent[];
  agentMeta: Record<string, EditableAgentMeta>;
  workstationOrigins: Record<string, WorkstationOrigin>;
  officeObjectOverrides: Record<string, OfficeObjectOverride>;
  removedOfficeObjectIds: string[];
  customOfficeObjects: PersistedOfficeObject[];
  lastAcknowledgedOutputId: string | null;
  playerAppearance: PlayerAppearance | null;
}

export function createEmptyOfficeLayoutData(): OfficeLayoutData {
  return {
    version: 1,
    customAgents: [],
    agentMeta: {},
    workstationOrigins: {},
    officeObjectOverrides: {},
    removedOfficeObjectIds: [],
    customOfficeObjects: [],
    lastAcknowledgedOutputId: null,
    playerAppearance: null,
  };
}
