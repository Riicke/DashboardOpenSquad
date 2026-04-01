import { useEffect, useMemo, useState } from "react";
import type { Agent } from "@/types/state";
import type { CharacterGender } from "./characterAssets";
import { CHARACTER_SHEET_OPTIONS, getCharacterSheetCount } from "./characterAssets";
import { loadOfficeLayout, saveOfficeLayout } from "@/lib/officeLayoutApi";
import { createDefaultProjectOfficeLayoutData } from "./defaultOfficeLayoutPreset";
import {
  createEmptyOfficeLayoutData,
  type OfficeLayoutData,
  type OfficeObjectOverride,
  type PersistedCustomAgent,
  type PersistedOfficeObject,
  type PlayerAppearance,
  type WorkstationOrigin,
} from "@/types/officeLayout";
import { getDefaultAgentAppearance, getDefaultBossAppearance } from "./defaultOfficeTemplate";

export type {
  OfficeObjectOverride,
  PersistedCustomAgent,
  PersistedOfficeObject,
  PlayerAppearance,
  WorkstationOrigin,
} from "@/types/officeLayout";

export interface EditableAgentDetails {
  id: string;
  name: string;
  role: string;
  gender: CharacterGender;
  sheetIndex: number;
  isCustom: boolean;
}

interface AgentEditorMeta {
  name?: string;
  icon?: string;
  role?: string;
  gender?: CharacterGender;
  sheetIndex?: number;
}

const STORAGE_PREFIX = "opensquad-office-editor";

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getStorageKey(scope: string) {
  return `${STORAGE_PREFIX}:${scope}`;
}

function readLegacyPersistedState(scope: string): OfficeLayoutData {
  if (typeof window === "undefined") {
    return createEmptyOfficeLayoutData();
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(scope));
    if (!raw) {
      return createEmptyOfficeLayoutData();
    }

    const parsed = JSON.parse(raw) as Partial<OfficeLayoutData>;
    return {
      version: 1,
      customAgents: Array.isArray(parsed.customAgents) ? parsed.customAgents : [],
      agentMeta: parsed.agentMeta && typeof parsed.agentMeta === "object" ? parsed.agentMeta : {},
      workstationOrigins:
        parsed.workstationOrigins && typeof parsed.workstationOrigins === "object"
          ? parsed.workstationOrigins
          : {},
      officeObjectOverrides:
        parsed.officeObjectOverrides && typeof parsed.officeObjectOverrides === "object"
          ? parsed.officeObjectOverrides
          : {},
      removedOfficeObjectIds: Array.isArray(parsed.removedOfficeObjectIds)
        ? parsed.removedOfficeObjectIds.filter((value): value is string => typeof value === "string")
        : [],
      customOfficeObjects: Array.isArray(parsed.customOfficeObjects) ? parsed.customOfficeObjects : [],
      lastAcknowledgedOutputId:
        typeof parsed.lastAcknowledgedOutputId === "string" ? parsed.lastAcknowledgedOutputId : null,
      playerAppearance:
        parsed.playerAppearance && typeof parsed.playerAppearance === "object"
          ? parsed.playerAppearance
          : null,
    };
  } catch {
    return createEmptyOfficeLayoutData();
  }
}

function normalizeLoadedLayoutData(layout: OfficeLayoutData) {
  const customIds = new Set(layout.customOfficeObjects.map((object) => object.id));
  const migratedRemovedIds = new Set(layout.removedOfficeObjectIds);
  const cleanedOverrides: Record<string, OfficeObjectOverride> = {};
  let migrated = false;

  Object.entries(layout.officeObjectOverrides).forEach(([objectId, override]) => {
    const shouldMigrateToRemoval =
      !customIds.has(objectId) &&
      ((typeof override.alpha === "number" && override.alpha <= 0.01) ||
        (typeof override.width === "number" && override.width <= 0) ||
        (typeof override.height === "number" && override.height <= 0));

    if (shouldMigrateToRemoval) {
      migratedRemovedIds.add(objectId);
      const { alpha, width, height, ...rest } = override;
      if (Object.keys(rest).length > 0) {
        cleanedOverrides[objectId] = rest;
      }
      migrated = true;
      return;
    }

    cleanedOverrides[objectId] = override;
  });

  return {
    layout: {
      ...layout,
      officeObjectOverrides: cleanedOverrides,
      removedOfficeObjectIds: Array.from(migratedRemovedIds),
    } satisfies OfficeLayoutData,
    migrated,
  };
}

function hasProjectLayoutData(layout: OfficeLayoutData) {
  return (
    layout.customAgents.length > 0 ||
    Object.keys(layout.agentMeta).length > 0 ||
    Object.keys(layout.workstationOrigins).length > 0 ||
    Object.keys(layout.officeObjectOverrides).length > 0 ||
    layout.removedOfficeObjectIds.length > 0 ||
    layout.customOfficeObjects.length > 0 ||
    layout.lastAcknowledgedOutputId != null ||
    layout.playerAppearance != null
  );
}

function makeIconFromName(name: string) {
  const tokens = name
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return "AV";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] ?? "A"}${tokens[1][0] ?? "V"}`.toUpperCase();
}

function guessRole(agent: Agent) {
  const tokens = agent.id
    .split("-")
    .filter(Boolean)
    .slice(1);

  if (tokens.length === 0) return "";
  return tokens.map((token) => token[0].toUpperCase() + token.slice(1)).join(" ");
}

function getDefaultSheetIndex(agentId: string) {
  const count = Math.max(1, getCharacterSheetCount());
  return hashString(agentId) % count;
}

function getDefaultGender(sheetIndex: number): CharacterGender {
  return CHARACTER_SHEET_OPTIONS[sheetIndex]?.gender ?? "Homem";
}

export function useOfficeEditorState(scope: string, baseAgents: Agent[]) {
  const [customAgents, setCustomAgents] = useState<PersistedCustomAgent[]>([]);
  const [agentMeta, setAgentMeta] = useState<Record<string, AgentEditorMeta>>({});
  const [workstationOrigins, setWorkstationOrigins] = useState<Record<string, WorkstationOrigin>>({});
  const [officeObjectOverrides, setOfficeObjectOverrides] = useState<Record<string, OfficeObjectOverride>>({});
  const [removedOfficeObjectIds, setRemovedOfficeObjectIds] = useState<string[]>([]);
  const [customOfficeObjects, setCustomOfficeObjects] = useState<PersistedOfficeObject[]>([]);
  const [lastAcknowledgedOutputId, setLastAcknowledgedOutputId] = useState<string | null>(null);
  const [playerAppearance, setPlayerAppearance] = useState<PlayerAppearance | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [layoutSource, setLayoutSource] = useState<"project" | "legacy" | "default">("default");

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    setIsSaving(false);
    setHasUnsavedChanges(false);
    setSaveError(null);

    const applyLayout = (layout: OfficeLayoutData) => {
      setCustomAgents(layout.customAgents);
      setAgentMeta(layout.agentMeta as Record<string, AgentEditorMeta>);
      setWorkstationOrigins(layout.workstationOrigins);
      setOfficeObjectOverrides(layout.officeObjectOverrides);
      setRemovedOfficeObjectIds(layout.removedOfficeObjectIds);
      setCustomOfficeObjects(layout.customOfficeObjects as PersistedOfficeObject[]);
      setLastAcknowledgedOutputId(layout.lastAcknowledgedOutputId);
      setPlayerAppearance(layout.playerAppearance);
    };

    loadOfficeLayout(scope)
      .then((projectLayout) => {
        if (cancelled) return;

        if (projectLayout && hasProjectLayoutData(projectLayout)) {
          const normalized = normalizeLoadedLayoutData(projectLayout);
          applyLayout(normalized.layout);
          setLayoutSource("project");
          setHasUnsavedChanges(normalized.migrated);
          return;
        }

        const legacyLayout = readLegacyPersistedState(scope);
        if (hasProjectLayoutData(legacyLayout)) {
          applyLayout(normalizeLoadedLayoutData(legacyLayout).layout);
          setLayoutSource("legacy");
          setHasUnsavedChanges(true);
          return;
        }

        applyLayout(createDefaultProjectOfficeLayoutData());
        setLayoutSource("default");
        setHasUnsavedChanges(false);
      })
      .catch(() => {
        if (cancelled) return;

        const legacyLayout = readLegacyPersistedState(scope);
        if (hasProjectLayoutData(legacyLayout)) {
          applyLayout(normalizeLoadedLayoutData(legacyLayout).layout);
          setLayoutSource("legacy");
          setHasUnsavedChanges(true);
        } else {
          applyLayout(createDefaultProjectOfficeLayoutData());
          setLayoutSource("default");
          setHasUnsavedChanges(false);
        }
        setSaveError("Nao foi possivel carregar o layout salvo do projeto.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const markDirty = () => {
    setHasUnsavedChanges(true);
    setSaveError(null);
  };

  const applyPersistedLayout = (layout: OfficeLayoutData) => {
    setCustomAgents(layout.customAgents);
    setAgentMeta(layout.agentMeta as Record<string, AgentEditorMeta>);
    setWorkstationOrigins(layout.workstationOrigins);
    setOfficeObjectOverrides(layout.officeObjectOverrides);
    setRemovedOfficeObjectIds(layout.removedOfficeObjectIds);
    setCustomOfficeObjects(layout.customOfficeObjects as PersistedOfficeObject[]);
    setLastAcknowledgedOutputId(layout.lastAcknowledgedOutputId);
    setPlayerAppearance(layout.playerAppearance);
  };

  const getCurrentLayout = (): OfficeLayoutData => ({
    version: 1,
    customAgents,
    agentMeta,
    workstationOrigins,
    officeObjectOverrides,
    removedOfficeObjectIds,
    customOfficeObjects,
    lastAcknowledgedOutputId,
    playerAppearance,
  });

  const mergedAgents = useMemo(() => {
    const mergedBase = baseAgents.map((agent) => {
      const meta = agentMeta[agent.id];
      const name = meta?.name ?? agent.name;
      return {
        ...agent,
        name,
        icon: meta?.icon ?? makeIconFromName(name) ?? agent.icon,
      };
    });

    const mergedCustom = customAgents.map((agent) => {
      const meta = agentMeta[agent.id];
      const name = meta?.name ?? agent.name;
      return {
        ...agent,
        name,
        icon: meta?.icon ?? makeIconFromName(name),
      };
    });

    return [...mergedBase, ...mergedCustom];
  }, [agentMeta, baseAgents, customAgents]);

  const detailsByAgentId = useMemo<Record<string, EditableAgentDetails>>(() => {
    const details: Record<string, EditableAgentDetails> = {};
    const customIds = new Set(customAgents.map((agent) => agent.id));

    mergedAgents.forEach((agent) => {
      const meta = agentMeta[agent.id];
      const customAgent = customAgents.find((candidate) => candidate.id === agent.id);
      const templateAppearance = getDefaultAgentAppearance(CHARACTER_SHEET_OPTIONS, agent);
      const defaultSheetIndex =
        meta?.sheetIndex ??
        customAgent?.sheetIndex ??
        templateAppearance?.sheetIndex ??
        getDefaultSheetIndex(agent.id);
      const sheetIndex = meta?.sheetIndex ?? defaultSheetIndex;

      details[agent.id] = {
        id: agent.id,
        name: meta?.name ?? agent.name,
        role: meta?.role ?? customAgent?.role ?? guessRole(agent),
        gender:
          meta?.gender ??
          customAgent?.gender ??
          templateAppearance?.gender ??
          getDefaultGender(sheetIndex),
        sheetIndex,
        isCustom: customIds.has(agent.id),
      };
    });

    return details;
  }, [agentMeta, customAgents, mergedAgents]);

  const sheetIndexByAgentId = useMemo(
    () =>
      Object.fromEntries(
        Object.values(detailsByAgentId).map((details) => [details.id, details.sheetIndex])
      ) as Record<string, number>,
    [detailsByAgentId]
  );

  const updateAgentDetails = (agentId: string, patch: Partial<EditableAgentDetails>) => {
    markDirty();
    setAgentMeta((prev) => {
      const current = prev[agentId] ?? {};
      const nextName = patch.name ?? current.name;

      return {
        ...prev,
        [agentId]: {
          ...current,
          ...patch,
          icon: nextName ? makeIconFromName(nextName) : current.icon ?? undefined,
        },
      };
    });

    if (patch.name || patch.role || patch.gender || patch.sheetIndex != null) {
      setCustomAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                name: patch.name ?? agent.name,
                role: patch.role ?? agent.role,
                gender: patch.gender ?? agent.gender,
                sheetIndex: patch.sheetIndex ?? agent.sheetIndex,
              }
            : agent
        )
      );
    }
  };

  const updateWorkstationOrigin = (agentId: string, origin: WorkstationOrigin) => {
    markDirty();
    setWorkstationOrigins((prev) => ({
      ...prev,
      [agentId]: origin,
    }));
  };

  const createCustomAgent = (origin: WorkstationOrigin, fallbackDesk: Agent["desk"]) => {
    markDirty();
    const id = `custom-agent-${Date.now()}`;
    const name = `Novo Avatar ${customAgents.length + 1}`;
    const sheetIndex = CHARACTER_SHEET_OPTIONS.find((option) => option.gender === "Homem")?.index ?? 0;
    const agent: PersistedCustomAgent = {
      id,
      name,
      icon: makeIconFromName(name),
      status: "idle",
      deliverTo: null,
      desk: fallbackDesk,
      role: "",
      gender: CHARACTER_SHEET_OPTIONS[sheetIndex]?.gender ?? "Homem",
      sheetIndex,
    };

    setCustomAgents((prev) => [...prev, agent]);
    setAgentMeta((prev) => ({
      ...prev,
      [id]: {
        name,
        icon: agent.icon,
        role: "",
        gender: agent.gender,
        sheetIndex,
      },
    }));
    setWorkstationOrigins((prev) => ({
      ...prev,
      [id]: origin,
    }));

    return id;
  };

  const updateOfficeObjectOverride = (objectId: string, patch: OfficeObjectOverride) => {
    markDirty();
    setOfficeObjectOverrides((prev) => ({
      ...prev,
      [objectId]: {
        ...prev[objectId],
        ...patch,
      },
    }));
  };

  const resetOfficeObjectOverride = (objectId: string) => {
    markDirty();
    setOfficeObjectOverrides((prev) => {
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
    setRemovedOfficeObjectIds((prev) => prev.filter((id) => id !== objectId));
  };

  const removeCustomAgent = (agentId: string) => {
    markDirty();
    setCustomAgents((prev) => prev.filter((agent) => agent.id !== agentId));
    setAgentMeta((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
    setWorkstationOrigins((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
  };

  const createCustomOfficeObject = (object: Omit<PersistedOfficeObject, "id">) => {
    markDirty();
    const id = `custom-office-object-${Date.now()}-${Math.round(Math.random() * 1000)}`;

    setCustomOfficeObjects((prev) => [
      ...prev,
      {
        id,
        ...object,
      },
    ]);

    return id;
  };

  const updateCustomOfficeObject = (
    objectId: string,
    patch: Partial<Omit<PersistedOfficeObject, "id">>
  ) => {
    markDirty();
    setCustomOfficeObjects((prev) =>
      prev.map((object) =>
        object.id === objectId
          ? {
              ...object,
              ...patch,
            }
          : object
      )
    );
  };

  const removeCustomOfficeObject = (objectId: string) => {
    markDirty();
    setCustomOfficeObjects((prev) => prev.filter((object) => object.id !== objectId));
  };

  const removeBaseOfficeObject = (objectId: string) => {
    markDirty();
    setRemovedOfficeObjectIds((prev) => (prev.includes(objectId) ? prev : [...prev, objectId]));
    setOfficeObjectOverrides((prev) => {
      if (!(objectId in prev)) return prev;
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
  };

  const updatePlayerAppearance = (patch: Partial<PlayerAppearance>) => {
    markDirty();
    setPlayerAppearance((current) => {
      const templateAppearance = getDefaultBossAppearance(CHARACTER_SHEET_OPTIONS);
      const fallbackSheetIndex =
        templateAppearance?.sheetIndex ??
        CHARACTER_SHEET_OPTIONS.find((option) => option.gender === "Homem")?.index ??
        0;
      const base = current ?? {
        gender: templateAppearance?.gender ?? getDefaultGender(fallbackSheetIndex),
        sheetIndex: fallbackSheetIndex,
      };

      return {
        ...base,
        ...patch,
      };
    });
  };

  const persistLayout = async (layout: OfficeLayoutData) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const saved = await saveOfficeLayout(scope, layout);
      applyPersistedLayout(saved);
      setLayoutSource("project");
      setHasUnsavedChanges(false);

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(getStorageKey(scope));
      }
      return true;
    } catch {
      setSaveError("Nao foi possivel salvar o layout no projeto.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveLayout = async () => {
    return persistLayout(getCurrentLayout());
  };

  const saveAgentAppearance = async (
    agentId: string,
    patch: {
      gender: CharacterGender;
      sheetIndex: number;
      origin: WorkstationOrigin;
    }
  ) => {
    const currentMeta = agentMeta[agentId] ?? {};
    const nextAgentMeta: Record<string, AgentEditorMeta> = {
      ...agentMeta,
      [agentId]: {
        ...currentMeta,
        gender: patch.gender,
        sheetIndex: patch.sheetIndex,
        icon: currentMeta.icon,
      },
    };

    const nextCustomAgents = customAgents.map((agent) =>
      agent.id === agentId
        ? {
            ...agent,
            gender: patch.gender,
            sheetIndex: patch.sheetIndex,
          }
        : agent
    );

    const nextLayout: OfficeLayoutData = {
      ...getCurrentLayout(),
      agentMeta: nextAgentMeta,
      customAgents: nextCustomAgents,
      workstationOrigins: {
        ...workstationOrigins,
        [agentId]: patch.origin,
      },
    };

    return persistLayout(nextLayout);
  };

  const saveBossAppearance = async (appearance: PlayerAppearance) => {
    return persistLayout({
      ...getCurrentLayout(),
      playerAppearance: appearance,
    });
  };

  return {
    agents: mergedAgents,
    detailsByAgentId,
    sheetIndexByAgentId,
    workstationOrigins,
    officeObjectOverrides,
    removedOfficeObjectIds,
    customOfficeObjects,
    lastAcknowledgedOutputId,
    playerAppearance,
    isLoaded,
    isSaving,
    hasUnsavedChanges,
    saveError,
    layoutSource,
    updateAgentDetails,
    updateWorkstationOrigin,
    updateOfficeObjectOverride,
    resetOfficeObjectOverride,
    createCustomAgent,
    removeCustomAgent,
    createCustomOfficeObject,
    updateCustomOfficeObject,
    removeCustomOfficeObject,
    removeBaseOfficeObject,
    updatePlayerAppearance,
    setLastAcknowledgedOutputId,
    saveAgentAppearance,
    saveBossAppearance,
    saveLayout,
  };
}
