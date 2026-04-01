import type { SquadState, Agent } from "@/types/state";

const DEFAULT_DESK_COLUMNS = 4;

function isValidDeskValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function hasValidDesk(agent: Agent): boolean {
  return (
    typeof agent.desk === "object" &&
    agent.desk !== null &&
    isValidDeskValue(agent.desk.col) &&
    isValidDeskValue(agent.desk.row)
  );
}

function makeDeskKey(col: number, row: number) {
  return `${col}:${row}`;
}

function getDeskBySequence(index: number) {
  return {
    col: (index % DEFAULT_DESK_COLUMNS) + 1,
    row: Math.floor(index / DEFAULT_DESK_COLUMNS) + 1,
  };
}

export function normalizeAgents(agents: Agent[]): Agent[] {
  const occupied = new Set<string>();
  let nextDeskIndex = 0;

  const takeNextDesk = () => {
    while (occupied.has(makeDeskKey(getDeskBySequence(nextDeskIndex).col, getDeskBySequence(nextDeskIndex).row))) {
      nextDeskIndex += 1;
    }

    const desk = getDeskBySequence(nextDeskIndex);
    occupied.add(makeDeskKey(desk.col, desk.row));
    nextDeskIndex += 1;
    return desk;
  };

  return agents.map((agent) => {
    if (hasValidDesk(agent)) {
      const deskKey = makeDeskKey(agent.desk.col, agent.desk.row);
      if (!occupied.has(deskKey)) {
        occupied.add(deskKey);
        return agent;
      }
    }

    return {
      ...agent,
      desk: takeNextDesk(),
    };
  });
}

export function normalizeSquadState(state: SquadState): SquadState {
  return {
    ...state,
    agents: normalizeAgents(state.agents),
  };
}

/**
 * Returns agents sorted by desk position (row first, then col).
 */
export function sortAgentsByDesk(agents: Agent[]): Agent[] {
  return [...normalizeAgents(agents)].sort((a, b) => {
    if (a.desk.row !== b.desk.row) return a.desk.row - b.desk.row;
    return a.desk.col - b.desk.col;
  });
}

/**
 * Find agent by id.
 */
export function findAgent(state: SquadState, agentId: string | null | undefined): Agent | undefined {
  if (!agentId) return undefined;
  return state.agents.find((a) => a.id === agentId);
}

/**
 * Returns the currently working agent, if any.
 */
export function getWorkingAgent(state: SquadState): Agent | undefined {
  return state.agents.find((a) => a.status === "working");
}
