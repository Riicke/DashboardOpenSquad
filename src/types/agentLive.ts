export interface AgentLiveQuestionOption {
  label: string;
  description?: string;
}

export interface AgentLiveQuestion {
  id: string;
  text: string;
  options: AgentLiveQuestionOption[];
}

export interface AgentLiveEntry {
  status: "idle" | "working" | "waiting_input" | "done";
  activity: string | null;
  question: AgentLiveQuestion | null;
  updatedAt: string | null;
}

export interface AgentLiveState {
  version: 1;
  updatedAt: string | null;
  agents: Record<string, AgentLiveEntry>;
}

export function createEmptyAgentLiveState(): AgentLiveState {
  return {
    version: 1,
    updatedAt: null,
    agents: {},
  };
}
