import {
  createEmptyOfficeLayoutData,
  type OfficeLayoutData,
} from "@/types/officeLayout";
import {
  createEmptyAgentLiveState,
  type AgentLiveState,
} from "@/types/agentLive";

function buildOfficeLayoutUrl(scope: string) {
  return `/__office_layout?squad=${encodeURIComponent(scope)}`;
}

function buildLatestOutputUrl(scope: string) {
  return `/__latest_output?squad=${encodeURIComponent(scope)}`;
}

function buildAgentOrientationUrl(scope: string, agentId: string) {
  return `/__agent_orientation?squad=${encodeURIComponent(scope)}&agent=${encodeURIComponent(agentId)}`;
}

function buildAgentLiveUrl(scope: string) {
  return `/__agent_live?squad=${encodeURIComponent(scope)}`;
}

export interface LatestSquadOutputInfo {
  outputId: string | null;
  outputPath: string | null;
  hasSlides: boolean;
  alertId: string | null;
}

export interface AgentOrientationInfo {
  content: string;
  filePath: string;
}

export async function loadOfficeLayout(scope: string): Promise<OfficeLayoutData | null> {
  const response = await fetch(buildOfficeLayoutUrl(scope));

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load office layout for "${scope}"`);
  }

  const payload = (await response.json()) as { layout?: OfficeLayoutData | null };
  return payload.layout ?? createEmptyOfficeLayoutData();
}

export async function saveOfficeLayout(scope: string, layout: OfficeLayoutData) {
  const response = await fetch(buildOfficeLayoutUrl(scope), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ layout }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save office layout for "${scope}"`);
  }

  const payload = (await response.json()) as { layout?: OfficeLayoutData | null };
  return payload.layout ?? createEmptyOfficeLayoutData();
}

export async function loadLatestSquadOutput(scope: string): Promise<LatestSquadOutputInfo> {
  const response = await fetch(buildLatestOutputUrl(scope));

  if (!response.ok) {
    throw new Error(`Failed to load latest output for "${scope}"`);
  }

  return (await response.json()) as LatestSquadOutputInfo;
}

export async function openLatestSquadOutput(scope: string): Promise<LatestSquadOutputInfo> {
  const response = await fetch(buildLatestOutputUrl(scope), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to open latest output for "${scope}"`);
  }

  return (await response.json()) as LatestSquadOutputInfo;
}

export async function loadAgentOrientation(
  scope: string,
  agentId: string
): Promise<AgentOrientationInfo> {
  const response = await fetch(buildAgentOrientationUrl(scope, agentId));

  if (!response.ok) {
    throw new Error(`Failed to load agent orientation for "${agentId}"`);
  }

  return (await response.json()) as AgentOrientationInfo;
}

export async function loadAgentLiveState(scope: string): Promise<AgentLiveState> {
  const response = await fetch(buildAgentLiveUrl(scope));

  if (response.status === 404) {
    return createEmptyAgentLiveState();
  }

  if (!response.ok) {
    throw new Error(`Failed to load agent live state for "${scope}"`);
  }

  return (await response.json()) as AgentLiveState;
}
