import { Application, extend } from "@pixi/react";
import { Container, Graphics, Sprite, Texture, TilingSprite } from "pixi.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FederatedPointerEvent, Graphics as PixiGraphics } from "pixi.js";
import {
  loadAgentLiveState,
  loadLatestSquadOutput,
  openLatestSquadOutput,
  type LatestSquadOutputInfo,
} from "@/lib/officeLayoutApi";
import { useSquadStore } from "@/store/useSquadStore";
import { HandoffEnvelope } from "./HandoffEnvelope";
import { AgentAvatar } from "./AgentAvatar";
import { PlayerAvatar } from "./PlayerAvatar";
import { AgentEditorPanel } from "./AgentEditorPanel";
import { BossEditorPanel } from "./BossEditorPanel";
import { OfficeObjectsEditorPanel, type EditableOfficeObject } from "./OfficeObjectsEditorPanel";
import { sortAgentsByDesk, findAgent } from "@/lib/normalizeState";
import { drawFloor } from "./drawRoom";
import { drawClock } from "./drawFurniture";
import { COLORS } from "./palette";
import { createOfficeLayout, getWorkstationLayout, type WorkstationLayout } from "./layout";
import { CHARACTER_SHEET_OPTIONS, CHARACTER_SHEET_PATHS } from "./characterAssets";
import {
  OFFICE_ASSET_PATHS,
  OFFICE_SIZES,
  getOfficeAssetDefinition,
  type OfficeAssetKey,
} from "./officeAssets";
import { useAnimatedAgents, type NavigationObstacle } from "./useAnimatedAgents";
import { useAssetTextures } from "./useAssetTextures";
import { useOfficeEditorState, type OfficeObjectOverride } from "./useOfficeEditorState";
import { usePlayerController } from "./usePlayerController";
import { createEmptyAgentLiveState } from "@/types/agentLive";
import {
  CHAT_TEXTURE_PATHS,
  SKY_ALERT_TEXTURE_PATHS,
  SKY_ASSET_PATHS,
  SKY_WINDOW_TEXTURE_PATHS,
  getSkyPeriodForHour,
} from "./skyAssets";
import {
  buildDefaultOfficeObjects,
  getDefaultBossAppearance,
  getDefaultWorkstationOrigin,
} from "./defaultOfficeTemplate";

extend({ Container, Graphics, Sprite, TilingSprite });

const MIN_STAGE_W = 640;
const MIN_STAGE_H = 420;
const BOSS_ALERT_WIDTH = 30;
const BOSS_ALERT_HEIGHT = 36;
const LATEST_OUTPUT_POLL_MS = 1500;
const AGENT_LIVE_POLL_MS = 1200;

interface SceneSprite {
  key: string;
  texture: Texture;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha?: number;
  rotation?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

interface WallWindowPane {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WallWindowSkySpan {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getWallWindowLayout(stageW: number, wallTop: number) {
  const paneCount = stageW >= 1240 ? 3 : stageW >= 860 ? 2 : 1;
  const gap = clamp(Math.round(stageW * 0.028), 20, 42);
  const sidePadding = clamp(Math.round(stageW * 0.018), 16, 28);
  const windowH = clamp(Math.round(wallTop * 0.78), 64, wallTop - 14);
  const windowY = Math.max(14, Math.round((wallTop - windowH) / 2) + 2);
  const totalGap = gap * (paneCount - 1);
  const availableWidth = stageW - sidePadding * 2 - totalGap;
  const windowW = Math.max(160, Math.floor(availableWidth / paneCount));
  const panes: WallWindowPane[] = Array.from({ length: paneCount }, (_, index) => ({
    x: sidePadding + index * (windowW + gap),
    y: windowY,
    width: windowW,
    height: windowH,
  }));

  const clockGapIndex = paneCount >= 3 ? 1 : 0;
  const gapAnchor = panes[Math.min(clockGapIndex, panes.length - 1)];
  const clockX =
    paneCount > 1
      ? gapAnchor.x + gapAnchor.width + Math.round(gap / 2) - 12
      : Math.min(stageW - 40, panes[0].x + panes[0].width + 18);
  const clockY = windowY + Math.round(windowH / 2) - 12;

  return {
    panes,
    clockX,
    clockY,
    bookshelfY: 8,
  };
}

function getWallWindowSkySpan(panes: WallWindowPane[]): WallWindowSkySpan | null {
  if (panes.length === 0) return null;

  const firstPane = panes[0];
  const lastPane = panes[panes.length - 1];

  return {
    x: firstPane.x,
    y: firstPane.y,
    width: lastPane.x + lastPane.width - firstPane.x,
    height: firstPane.height,
  };
}

export function OfficeScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const skyPaneRefs = useRef<Array<TilingSprite | null>>([]);
  const skyOffsetRef = useRef(0);
  const draggingOfficeObjectRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const alertSpriteRef = useRef<Sprite | null>(null);
  const [viewport, setViewport] = useState({ width: MIN_STAGE_W, height: MIN_STAGE_H });
  const [isBossEditorOpen, setIsBossEditorOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [isOfficeEditorOpen, setIsOfficeEditorOpen] = useState(false);
  const [selectedOfficeObjectId, setSelectedOfficeObjectId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [latestOutputInfo, setLatestOutputInfo] = useState<LatestSquadOutputInfo>({
    outputId: null,
    outputPath: null,
    hasSlides: false,
    alertId: null,
  });
  const [agentLiveState, setAgentLiveState] = useState(createEmptyAgentLiveState);
  const [acknowledgedAgentLiveById, setAcknowledgedAgentLiveById] = useState<Record<string, string>>({});
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const state = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );
  const squadInfo = useSquadStore((s) =>
    s.selectedSquad ? s.squads.get(s.selectedSquad) : undefined
  );

  const baseAgents = useMemo(
    () => (state?.agents ? sortAgentsByDesk(state.agents) : []),
    [state]
  );

  const editorScope = selectedSquad ?? state?.squad ?? "default";
  const {
    agents,
    detailsByAgentId,
    sheetIndexByAgentId,
    workstationOrigins,
    officeObjectOverrides,
    removedOfficeObjectIds,
    customOfficeObjects,
    playerAppearance,
    isSaving,
    hasUnsavedChanges,
    saveError,
    layoutSource,
    lastAcknowledgedOutputId,
    updateOfficeObjectOverride,
    resetOfficeObjectOverride,
    removeCustomAgent,
    createCustomOfficeObject,
    updateCustomOfficeObject,
    removeCustomOfficeObject,
    removeBaseOfficeObject,
    setLastAcknowledgedOutputId,
    saveAgentAppearance,
    saveBossAppearance,
    saveLayout,
  } = useOfficeEditorState(editorScope, baseAgents);

  const layoutAgents = baseAgents.length > 0 ? baseAgents : agents;
  const maxCol =
    layoutAgents.length > 0 ? Math.max(...layoutAgents.map((agent) => agent.desk.col)) : 1;
  const maxRow =
    layoutAgents.length > 0 ? Math.max(...layoutAgents.map((agent) => agent.desk.row)) : 1;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateViewport = (width: number, height: number) => {
      setViewport({
        width: Math.max(MIN_STAGE_W, Math.floor(width)),
        height: Math.max(MIN_STAGE_H, Math.floor(height)),
      });
    };

    updateViewport(element.clientWidth, element.clientHeight);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateViewport(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const layout = useMemo(
    () => createOfficeLayout(viewport.width, viewport.height, maxCol, maxRow),
    [viewport.height, viewport.width, maxCol, maxRow]
  );

  const workstations = useMemo(
    () => {
      const occupiedDeskKeys = new Set(agents.map((agent) => `${agent.desk.col}:${agent.desk.row}`));

      return agents.map((agent, index) => ({
        key: `${agent.id}-${index}`,
        agent,
        workstation: getWorkstationLayout(
          layout,
          agent.desk,
          workstationOrigins[agent.id] ?? getDefaultWorkstationOrigin(layout, agent.desk, occupiedDeskKeys)
        ),
      }));
    },
    [agents, layout, workstationOrigins]
  );

  const workstationsByAgentId = useMemo(
    () =>
      Object.fromEntries(
        workstations.map(({ agent, workstation }) => [agent.id, workstation])
      ) as Record<string, WorkstationLayout>,
    [workstations]
  );

  const officeTextures = useAssetTextures(OFFICE_ASSET_PATHS);
  const skyTextures = useAssetTextures(SKY_ASSET_PATHS);
  const windowTextureMap = useAssetTextures(SKY_WINDOW_TEXTURE_PATHS);
  const alertTextureMap = useAssetTextures(SKY_ALERT_TEXTURE_PATHS);
  const chatTextureMap = useAssetTextures(CHAT_TEXTURE_PATHS);
  const characterSheetPaths = useMemo(
    () =>
      Object.fromEntries(
        CHARACTER_SHEET_PATHS.map((path, index) => [`sheet${index}`, path])
      ) as Record<string, string>,
    []
  );
  const characterTextureMap = useAssetTextures(characterSheetPaths);
  const characterTextures = useMemo(
    () => CHARACTER_SHEET_PATHS.map((_, index) => characterTextureMap?.[`sheet${index}`]),
    [characterTextureMap]
  );

  const defaultBossAppearance = useMemo(
    () => getDefaultBossAppearance(CHARACTER_SHEET_OPTIONS),
    []
  );
  const defaultPlayerSheetIndex =
    defaultBossAppearance?.sheetIndex ??
    CHARACTER_SHEET_OPTIONS.find((option) => option.gender === "Homem")?.index ??
    0;
  const playerSheetIndex = playerAppearance?.sheetIndex ?? defaultPlayerSheetIndex;
  const playerGender =
    playerAppearance?.gender ??
    defaultBossAppearance?.gender ??
    CHARACTER_SHEET_OPTIONS[playerSheetIndex]?.gender ??
    "Homem";
  const wallWindow = useMemo(
    () => getWallWindowLayout(layout.stageW, layout.wallTop),
    [layout.stageW, layout.wallTop]
  );
  const wallWindowSkySpan = useMemo(
    () => getWallWindowSkySpan(wallWindow.panes),
    [wallWindow.panes]
  );
  const activeSkyPeriod = useMemo(() => getSkyPeriodForHour(currentHour), [currentHour]);
  const activeSkyTexture = skyTextures?.[activeSkyPeriod];
  const windowTexture = windowTextureMap?.window;
  const alertTexture = alertTextureMap?.alert;
  const chatTexture = chatTextureMap?.chat;

  useEffect(() => {
    const texture = activeSkyTexture;
    const skySpan = wallWindowSkySpan;
    if (!texture || !skySpan) return;

    let animationFrame = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;
      skyOffsetRef.current += deltaMs * 0.0015;
      const scaleX = skySpan.width / texture.width;
      const scaleY = skySpan.height / texture.height;
      const scaledTextureWidth = Math.max(1, texture.width * scaleX);
      const wrappedOffset = skyOffsetRef.current % scaledTextureWidth;

      wallWindow.panes.forEach((pane, index) => {
        const sprite = skyPaneRefs.current[index];
        if (!sprite) return;

        sprite.tileScale.set(scaleX, scaleY);
        sprite.tilePosition.x = wrappedOffset - (pane.x - skySpan.x);
        sprite.tilePosition.y = 0;
      });

      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeSkyTexture, wallWindow, wallWindowSkySpan]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const refreshLatestOutput = () => {
      loadLatestSquadOutput(editorScope)
        .then((info) => {
          if (!cancelled) {
            setLatestOutputInfo(info);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLatestOutputInfo({
              outputId: null,
              outputPath: null,
              hasSlides: false,
              alertId: null,
            });
          }
        });
    };

    refreshLatestOutput();
    pollTimer = setInterval(refreshLatestOutput, LATEST_OUTPUT_POLL_MS);

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [editorScope, state?.updatedAt, state?.status]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const refreshAgentLive = () => {
      loadAgentLiveState(editorScope)
        .then((liveState) => {
          if (!cancelled) {
            setAgentLiveState(liveState);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAgentLiveState(createEmptyAgentLiveState());
          }
        });
    };

    refreshAgentLive();
    pollTimer = setInterval(refreshAgentLive, AGENT_LIVE_POLL_MS);

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [editorScope]);

  useEffect(() => {
    setAcknowledgedAgentLiveById({});
  }, [editorScope]);

  const officeObjects = useMemo<EditableOfficeObject[]>(() => {
    const removedIds = new Set(removedOfficeObjectIds);
    const objects: EditableOfficeObject[] = workstations
      .filter(({ agent }) => !removedIds.has(`partition:${agent.id}`))
      .map(({ agent, workstation }, index) => {
        const override = officeObjectOverrides[`partition:${agent.id}`] ?? {};
        return {
          id: `partition:${agent.id}`,
          label: `Divisoria ${detailsByAgentId[agent.id]?.name ?? agent.name}`,
          assetKey: index % 2 === 0 ? "partitionA" : "partitionB",
          x: override.x ?? workstation.deskX + 12,
          y: override.y ?? workstation.deskY - 36,
          width: override.width ?? OFFICE_SIZES.partition.width,
          height: override.height ?? OFFICE_SIZES.partition.height,
          rotation: override.rotation ?? 0,
          alpha: override.alpha ?? 0.92,
          layer: override.layer ?? 10 + index,
          isCustom: false,
        };
      });

    const utilityBase: Array<EditableOfficeObject> = buildDefaultOfficeObjects(layout)
      .filter((item) => !removedIds.has(item.id))
      .map((item) => ({
        ...item,
        isCustom: false,
      }));

    utilityBase.forEach((item) => {
      const override = officeObjectOverrides[item.id] ?? {};
      objects.push({
        ...item,
        x: override.x ?? item.x,
        y: override.y ?? item.y,
        width: override.width ?? item.width,
        height: override.height ?? item.height,
        rotation: override.rotation ?? item.rotation,
        alpha: override.alpha ?? item.alpha,
        layer: override.layer ?? item.layer,
        assetKey: item.assetKey,
        isCustom: false,
      });
    });

    customOfficeObjects.forEach((object) => {
      objects.push({
        ...object,
        assetKey: object.assetKey as OfficeAssetKey,
        isCustom: true,
      });
    });

    return objects.sort((left, right) => left.layer - right.layer);
  }, [
    customOfficeObjects,
    detailsByAgentId,
    layout.floorH,
    layout.stageH,
    layout.stageW,
    layout.wallTop,
    officeObjectOverrides,
    removedOfficeObjectIds,
    workstations,
  ]);

  const navigationObstacles = useMemo<NavigationObstacle[]>(
    () =>
      officeObjects
        .filter((object) => object.assetKey !== "pcOn" && object.assetKey !== "pcOff")
        .map((object) => ({
          id: object.id,
          x: object.x,
          y: object.y,
          width: object.width,
          height: object.height,
        })),
    [officeObjects]
  );

  const player = usePlayerController(
    layout,
    !!editingAgentId || isOfficeEditorOpen || isBossEditorOpen,
    navigationObstacles
  );
  const animatedAgents = useAnimatedAgents(
    agents,
    layout,
    workstationsByAgentId,
    sheetIndexByAgentId,
    player,
    navigationObstacles
  );

  const bossDeskObject = useMemo(
    () => officeObjects.find((object) => object.assetKey === "bossDesk") ?? null,
    [officeObjects]
  );

  const bossDeskInteraction = useMemo(() => {
    if (!bossDeskObject || !latestOutputInfo.outputId || !latestOutputInfo.outputPath) {
      return null;
    }

    const targetX = bossDeskObject.x + bossDeskObject.width * 0.5;
    const targetY = bossDeskObject.y + bossDeskObject.height * 0.7;
    const distance = Math.hypot(player.x - targetX, player.y - targetY);

    return {
      x: targetX,
      y: targetY,
      distance,
      outputId: latestOutputInfo.outputId,
      outputPath: latestOutputInfo.outputPath,
    };
  }, [bossDeskObject, latestOutputInfo.outputId, latestOutputInfo.outputPath, player.x, player.y]);

  const canInteractWithBossDesk = !!bossDeskInteraction && bossDeskInteraction.distance <= 92;
  const shouldShowBossAlert =
    !!latestOutputInfo.alertId &&
    !!bossDeskObject &&
    latestOutputInfo.alertId !== lastAcknowledgedOutputId;

  const interactionTarget = useMemo<{ agentId: string; distance: number } | null>(() => {
    let nearest: { agentId: string; distance: number } | null = null;

    animatedAgents.forEach((animatedAgent) => {
      const distance = Math.hypot(animatedAgent.x - player.x, animatedAgent.y - player.y);
      if (distance > 84) return;

      if (!nearest || distance < nearest.distance) {
        nearest = { agentId: animatedAgent.agent.id, distance };
      }
    });

    return nearest;
  }, [animatedAgents, player.x, player.y]);

  const usedSheetIndices = useMemo(
    () => Object.values(detailsByAgentId).map((details) => details.sheetIndex),
    [detailsByAgentId]
  );

  const handleOpenLatestOutput = useCallback(async () => {
    if (!bossDeskInteraction) return;

    try {
      const info = await openLatestSquadOutput(editorScope);
      setLatestOutputInfo(info);
      setLastAcknowledgedOutputId(info.alertId ?? info.outputId);
    } catch {
      // Ignore open failures to avoid interrupting the office flow.
    }
  }, [bossDeskInteraction, editorScope, setLastAcknowledgedOutputId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (isTyping) return;
      if (event.code !== "Space") return;
      if (event.repeat) return;
      if (editingAgentId) return;
      if (isOfficeEditorOpen) return;
      if (canInteractWithBossDesk) {
        event.preventDefault();
        void handleOpenLatestOutput();
        return;
      }
      if (!interactionTarget) return;

      event.preventDefault();
      setEditingAgentId(interactionTarget.agentId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canInteractWithBossDesk,
    editingAgentId,
    handleOpenLatestOutput,
    interactionTarget,
    isOfficeEditorOpen,
  ]);

  useEffect(() => {
    if (editingAgentId && !detailsByAgentId[editingAgentId]) {
      setEditingAgentId(null);
    }
  }, [detailsByAgentId, editingAgentId]);

  useEffect(() => {
    if (!showTutorial) return;

    const dismiss = () => setShowTutorial(false);
    const onPointerDown = () => dismiss();
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (!isTyping) dismiss();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showTutorial]);

  useEffect(() => {
    if (player.moving) {
      setShowTutorial(false);
    }
  }, [player.moving]);

  useEffect(() => {
    if (!shouldShowBossAlert || !bossDeskObject || !alertTexture) {
      if (alertSpriteRef.current) {
        alertSpriteRef.current.visible = false;
      }
      return;
    }

    let animationFrame = 0;
    const baseX = bossDeskObject.x + bossDeskObject.width * 0.5 - BOSS_ALERT_WIDTH / 2;
    const baseY = bossDeskObject.y - 30;

    const animate = (time: number) => {
      const sprite = alertSpriteRef.current;
      if (sprite) {
        sprite.visible = true;
        sprite.x = baseX;
        sprite.y = baseY + Math.sin(time / 180) * 5;
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [alertTexture, bossDeskObject, shouldShowBossAlert]);

  const editingAgent = editingAgentId ? agents.find((agent) => agent.id === editingAgentId) : undefined;
  const editingDetails = editingAgentId ? detailsByAgentId[editingAgentId] : undefined;

  const getOfficeTexture = useCallback(
    (assetKey: OfficeAssetKey) => officeTextures?.[assetKey] ?? Texture.EMPTY,
    [officeTextures]
  );

  const officeObjectSprites = useMemo<SceneSprite[]>(
    () =>
      officeObjects.map((object) => {
        return {
          key: object.id,
          texture: getOfficeTexture(object.assetKey),
          x: object.x,
          y: object.y,
          width: object.width,
          height: object.height,
          alpha: object.alpha,
          rotation: object.rotation,
        };
      }),
    [getOfficeTexture, officeObjects]
  );

  useEffect(() => {
    if (!isOfficeEditorOpen) return;
    if (officeObjects.length === 0) {
      setSelectedOfficeObjectId(null);
      return;
    }

    if (selectedOfficeObjectId && !officeObjects.some((object) => object.id === selectedOfficeObjectId)) {
      setSelectedOfficeObjectId(null);
    }
  }, [isOfficeEditorOpen, officeObjects, selectedOfficeObjectId]);

  const drawBackground = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      g.rect(0, 0, layout.stageW, layout.stageH);
      g.fill({ color: 0x1a1410 });

      g.rect(0, 0, layout.stageW, layout.wallTop);
      g.fill({ color: COLORS.wallFace });

      drawFloor(g, layout.floorW, layout.floorH, layout.floorX, layout.floorY);

      g.rect(0, layout.wallTop - 3, layout.stageW, 3);
      g.fill({ color: COLORS.wallShadow });
      g.rect(0, layout.wallTop, layout.stageW, 3);
      g.fill({ color: 0x000000, alpha: 0.06 });

      g.rect(0, layout.wallTop, 1, layout.floorH);
      g.fill({ color: COLORS.wallShadow });
      g.rect(layout.stageW - 1, layout.wallTop, 1, layout.floorH);
      g.fill({ color: COLORS.wallShadow });
      g.rect(0, layout.stageH - 1, layout.stageW, 1);
      g.fill({ color: COLORS.wallShadow });

      wallWindow.panes.forEach((pane) => {
        g.roundRect(pane.x + 2, pane.y + 5, pane.width - 4, pane.height - 2, 10);
        g.fill({ color: 0x000000, alpha: 0.14 });
      });

      drawClock(g, wallWindow.clockX, wallWindow.clockY);
    },
    [layout, wallWindow]
  );

  const drawDeskShadows = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      workstations.forEach(({ workstation }) => {
        g.ellipse(workstation.deskX + 62, workstation.deskY + 56, 52, 10);
        g.fill({ color: 0x000000, alpha: 0.12 });
      });
    },
    [workstations]
  );

  const handleOpenBossEditor = () => {
    setEditingAgentId(null);
    setIsOfficeEditorOpen(false);
    setIsBossEditorOpen(true);
  };

  const toggleOfficeEditor = () => {
    setIsBossEditorOpen(false);
    setEditingAgentId(null);
    setIsOfficeEditorOpen((current) => !current);
  };

  const handleAddOfficeObject = (assetKey: OfficeAssetKey) => {
    const asset = getOfficeAssetDefinition(assetKey);
    const existingCount = officeObjects.filter((object) => object.assetKey === assetKey).length;
    if (typeof asset.maxInstances === "number" && existingCount >= asset.maxInstances) {
      return;
    }

    const customCount = customOfficeObjects.filter((object) => object.assetKey === assetKey).length;
    const objectId = createCustomOfficeObject({
      assetKey,
      label: `${asset.label} ${customCount + 1}`,
      x: clamp(Math.round(layout.floorX + layout.floorW * 0.5 - asset.width / 2), 12, layout.stageW - asset.width - 12),
      y: clamp(Math.round(layout.wallTop + layout.floorH * 0.58 - asset.height / 2), layout.wallTop + 8, layout.stageH - asset.height - 12),
      width: asset.width,
      height: asset.height,
      rotation: 0,
      alpha: 1,
      layer: 60 + customOfficeObjects.length,
    });

    setSelectedOfficeObjectId(objectId);
  };

  const handleUpdateOfficeObject = (objectId: string, patch: OfficeObjectOverride) => {
    const object = officeObjects.find((candidate) => candidate.id === objectId);
    if (!object) return;

    if (object.isCustom) {
      updateCustomOfficeObject(objectId, patch);
      return;
    }

    updateOfficeObjectOverride(objectId, patch);
  };

  const handleResetOfficeObject = (objectId: string) => {
    const object = officeObjects.find((candidate) => candidate.id === objectId);
    if (!object) return;

    if (object.isCustom) {
      const asset = getOfficeAssetDefinition(object.assetKey);
      updateCustomOfficeObject(objectId, {
        width: asset.width,
        height: asset.height,
        rotation: 0,
        alpha: 1,
      });
      return;
    }

    resetOfficeObjectOverride(objectId);
  };

  const handleRemoveOfficeObject = (objectId: string) => {
    const object = officeObjects.find((candidate) => candidate.id === objectId);
    if (!object) return;

    if (object.isCustom) {
      removeCustomOfficeObject(objectId);
    } else {
      removeBaseOfficeObject(objectId);
    }

    if (selectedOfficeObjectId === objectId) {
      draggingOfficeObjectRef.current = null;
      setSelectedOfficeObjectId(null);
    }
  };

  const getAgentLiveCardText = useCallback((agentId: string) => {
    const entry = agentLiveState.agents[agentId];
    if (!entry) return null;

    if (entry.question) {
      const optionsText =
        entry.question.options.length > 0
          ? `Opcoes: ${entry.question.options.map((option) => option.label).join(" | ")}`
          : null;
      return [entry.question.text, optionsText].filter(Boolean).join("\n");
    }

    return entry.activity;
  }, [agentLiveState.agents]);

  const getAgentLiveSignature = useCallback((agentId: string) => {
    const entry = agentLiveState.agents[agentId];
    if (!entry) return null;

    if (entry.question) {
      const optionsSignature = entry.question.options.map((option) => option.label).join("|");
      return `question:${entry.question.id}:${entry.question.text}:${optionsSignature}`;
    }

    if (entry.activity) {
      return `activity:${entry.activity}`;
    }

    return null;
  }, [agentLiveState.agents]);

  useEffect(() => {
    setAcknowledgedAgentLiveById((current) => {
      let changed = false;
      let next = current;

      animatedAgents.forEach((animatedAgent) => {
        const isPlayerNearby =
          Math.hypot(animatedAgent.x - player.x, animatedAgent.y - player.y) <= 84;
        if (!isPlayerNearby) return;

        const liveSignature = getAgentLiveSignature(animatedAgent.agent.id);
        if (!liveSignature || current[animatedAgent.agent.id] === liveSignature) {
          return;
        }

        if (next === current) {
          next = { ...current };
        }

        next[animatedAgent.agent.id] = liveSignature;
        changed = true;
      });

      return changed ? next : current;
    });
  }, [animatedAgents, getAgentLiveSignature, player.x, player.y]);

  useEffect(() => {
    if (!isOfficeEditorOpen) {
      draggingOfficeObjectRef.current = null;
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const dragging = draggingOfficeObjectRef.current;
      const container = containerRef.current;
      if (!dragging || !container) return;

      const object = officeObjects.find((candidate) => candidate.id === dragging.id);
      if (!object) return;

      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const localX = ((event.clientX - bounds.left) / bounds.width) * layout.stageW;
      const localY = ((event.clientY - bounds.top) / bounds.height) * layout.stageH;

      handleUpdateOfficeObject(dragging.id, {
        x: Math.round(clamp(localX - dragging.offsetX, 0, layout.stageW - object.width)),
        y: Math.round(clamp(localY - dragging.offsetY, 0, layout.stageH - object.height)),
      });
    };

    const stopDragging = () => {
      draggingOfficeObjectRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [handleUpdateOfficeObject, isOfficeEditorOpen, layout.stageH, layout.stageW, officeObjects]);

  if (!state) {
    return (
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          flexDirection: "column",
          gap: 8,
          minWidth: 0,
        }}
      >
        {squadInfo ? (
          <>
            <span style={{ fontSize: 40 }}>{squadInfo.icon}</span>
            <span style={{ fontSize: 16 }}>{squadInfo.name}</span>
            <span style={{ fontSize: 12 }}>{squadInfo.description}</span>
            <span style={{ fontSize: 11, marginTop: 8 }}>Not running</span>
          </>
        ) : (
          <span>Select a squad to monitor</span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        position: "relative",
        imageRendering: "pixelated",
      }}
    >
      <Application
        width={layout.stageW}
        height={layout.stageH}
        backgroundColor={0x1a1410}
        antialias={false}
      >
        <pixiContainer>
          <pixiGraphics draw={drawBackground} />

          {wallWindow.panes.map((pane, index) => (
            <pixiTilingSprite
              key={`sky-pane-${index}-${activeSkyPeriod}`}
              ref={(node: TilingSprite | null) => {
                skyPaneRefs.current[index] = node;
              }}
              texture={activeSkyTexture ?? Texture.EMPTY}
              x={pane.x}
              y={pane.y}
              width={pane.width}
              height={pane.height}
              visible={!!activeSkyTexture}
            />
          ))}

          {wallWindow.panes.map((pane, index) => (
            <pixiSprite
              key={`window-pane-${index}`}
              texture={windowTexture ?? Texture.EMPTY}
              x={pane.x}
              y={pane.y}
              width={pane.width}
              height={pane.height}
              visible={!!windowTexture}
            />
          ))}

          {officeObjectSprites.map((sprite) => (
            <pixiSprite
              key={sprite.key}
              texture={sprite.texture}
              x={sprite.x}
              y={sprite.y}
              width={sprite.width}
              height={sprite.height}
              alpha={
                isOfficeEditorOpen && selectedOfficeObjectId === sprite.key
                  ? Math.min(1, (sprite.alpha ?? 1) + 0.14)
                  : sprite.alpha
              }
              rotation={sprite.rotation}
              eventMode={isOfficeEditorOpen ? "static" : "none"}
              onPointerDown={
                isOfficeEditorOpen
                  ? (event: FederatedPointerEvent) => {
                      event.stopPropagation();
                      setSelectedOfficeObjectId(sprite.key);
                      draggingOfficeObjectRef.current = {
                        id: sprite.key,
                        offsetX: event.global.x - sprite.x,
                        offsetY: event.global.y - sprite.y,
                      };
                    }
                  : undefined
              }
            />
          ))}

          <pixiSprite
            ref={(node: Sprite | null) => {
              alertSpriteRef.current = node;
            }}
            texture={alertTexture ?? Texture.EMPTY}
            x={bossDeskObject ? bossDeskObject.x + bossDeskObject.width * 0.5 - BOSS_ALERT_WIDTH / 2 : 0}
            y={bossDeskObject ? bossDeskObject.y - 30 : 0}
            width={BOSS_ALERT_WIDTH}
            height={BOSS_ALERT_HEIGHT}
            visible={!!alertTexture && shouldShowBossAlert}
          />

          <pixiGraphics draw={drawDeskShadows} />

          {workstations.map(({ agent, workstation }) => (
            <pixiSprite
              key={`${agent.id}-desk`}
              texture={officeTextures?.desk ?? Texture.EMPTY}
              x={workstation.deskX}
              y={workstation.deskY}
              width={OFFICE_SIZES.desk.width}
              height={OFFICE_SIZES.desk.height}
              visible={!!officeTextures}
            />
          ))}

          {workstations.map(({ agent, workstation }) => {
            const activePc =
              agent.status === "working" ||
              agent.status === "delivering" ||
              agent.status === "checkpoint";

            return (
              <pixiSprite
                key={`${agent.id}-pc`}
                texture={
                  activePc
                    ? officeTextures?.pcOn ?? Texture.EMPTY
                    : officeTextures?.pcOff ?? Texture.EMPTY
                }
                x={workstation.pcX}
                y={workstation.pcY}
                width={OFFICE_SIZES.pc.width}
                height={OFFICE_SIZES.pc.height}
                visible={!!officeTextures}
              />
            );
          })}

          {animatedAgents.map((animatedAgent) => {
            const isPlayerNearby =
              Math.hypot(animatedAgent.x - player.x, animatedAgent.y - player.y) <= 84;
            const liveEntry = agentLiveState.agents[animatedAgent.agent.id];
            const liveSignature = getAgentLiveSignature(animatedAgent.agent.id);
            const hasSeenCurrentLive =
              !!liveSignature &&
              acknowledgedAgentLiveById[animatedAgent.agent.id] === liveSignature;
            const liveCardText = isPlayerNearby ? getAgentLiveCardText(animatedAgent.agent.id) : null;
            const activityKind = isPlayerNearby
              ? null
              : liveEntry?.question
                ? hasSeenCurrentLive
                  ? null
                  : "question"
                : liveEntry?.activity
                  ? hasSeenCurrentLive
                    ? null
                    : "typing"
                  : animatedAgent.agent.status === "checkpoint"
                    ? "question"
                    : animatedAgent.agent.status === "working" || animatedAgent.agent.status === "delivering"
                      ? "typing"
                      : null;

            return (
              <AgentAvatar
                key={animatedAgent.agent.id}
                animatedAgent={animatedAgent}
                sheetTexture={characterTextures[animatedAgent.sheetIndex]}
                chatTexture={chatTexture}
                activityKind={activityKind}
                activityFrame={Math.floor(performance.now() / 160) % 7}
                liveCardText={liveCardText}
              />
            );
          })}

          <PlayerAvatar
            player={player}
            sheetTexture={characterTextures[playerSheetIndex]}
          />

          {workstations.map(({ agent, workstation }) => (
            <pixiSprite
              key={`${agent.id}-chair`}
              texture={officeTextures?.chair ?? Texture.EMPTY}
              x={workstation.chairX}
              y={workstation.chairY}
              width={OFFICE_SIZES.chair.width}
              height={OFFICE_SIZES.chair.height}
              visible={!!officeTextures}
            />
          ))}

          {state.handoff &&
            (() => {
              const from = findAgent(state, state.handoff.from);
              const to = findAgent(state, state.handoff.to);
              if (!from || !to) return null;

              return (
                <HandoffEnvelope
                  handoff={state.handoff}
                  fromWorkstation={
                    workstationsByAgentId[from.id] ?? getWorkstationLayout(layout, from.desk)
                  }
                  toWorkstation={
                    workstationsByAgentId[to.id] ?? getWorkstationLayout(layout, to.desk)
                  }
                />
              );
            })()}
        </pixiContainer>
      </Application>

      <div style={hudStyle}>
        <div style={buttonRowStyle}>
          <button type="button" onClick={handleOpenBossEditor} style={primaryButtonStyle}>
            BOSS
          </button>
          <button
            type="button"
            onClick={toggleOfficeEditor}
            style={{
              ...secondaryButtonStyle,
              ...(isOfficeEditorOpen ? activeSecondaryButtonStyle : null),
            }}
          >
            Editar
          </button>
        </div>
        {(layoutSource === "legacy" || saveError) && (
          <div style={saveInfoPanelStyle}>
            {saveError ? (
              <div>{saveError}</div>
            ) : (
              <div>Layout local carregado. Clique em Salvar para gravar no projeto.</div>
            )}
          </div>
        )}
        {showTutorial && (
          <div style={hintPanelStyle}>
            <div>WASD para andar</div>
            <div>
              {canInteractWithBossDesk
                ? "Espaco para abrir o ultimo projeto"
                : interactionTarget
                ? `Espaco para editar ${detailsByAgentId[interactionTarget.agentId]?.name ?? "avatar"}`
                : "Chegue perto de um avatar e aperte Espaco"}
            </div>
            <div>Posicoes das estacoes agora sao editaveis.</div>
          </div>
        )}
      </div>

      {editingAgent && editingDetails && (
        <AgentEditorPanel
          scope={editorScope}
          agent={editingAgent}
          details={editingDetails}
          usedSheetIndices={usedSheetIndices.filter((index) => index !== editingDetails.sheetIndex)}
          workstationOrigin={
            workstationOrigins[editingAgent.id] ?? {
              originX: workstationsByAgentId[editingAgent.id]?.originX ?? 0,
              originY: workstationsByAgentId[editingAgent.id]?.originY ?? 0,
            }
          }
          isSaving={isSaving}
          saveError={saveError}
          onClose={() => setEditingAgentId(null)}
          onSaveDraft={async (draft) => {
            const saved = await saveAgentAppearance(editingAgent.id, draft);
            if (saved) {
              setEditingAgentId(null);
            }
          }}
          onRemove={
            editingDetails.isCustom
              ? () => {
                  removeCustomAgent(editingAgent.id);
                  setEditingAgentId(null);
                }
              : undefined
          }
        />
      )}

      {isBossEditorOpen && (
        <BossEditorPanel
          appearance={{
            gender: playerGender,
            sheetIndex: playerSheetIndex,
          }}
          isSaving={isSaving}
          saveError={saveError}
          onClose={() => setIsBossEditorOpen(false)}
          onSaveDraft={async (patch) => {
            const saved = await saveBossAppearance({
              gender: patch.gender ?? playerGender,
              sheetIndex: patch.sheetIndex ?? playerSheetIndex,
            });
            if (saved) {
              setIsBossEditorOpen(false);
            }
          }}
        />
      )}

      {isOfficeEditorOpen && (
        <OfficeObjectsEditorPanel
          objects={officeObjects}
          selectedObjectId={selectedOfficeObjectId}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          saveError={saveError}
          onClose={() => setIsOfficeEditorOpen(false)}
          onSave={async () => {
            const saved = await saveLayout();
            if (saved) {
              setIsOfficeEditorOpen(false);
            }
          }}
          onUpdate={handleUpdateOfficeObject}
          onReset={handleResetOfficeObject}
          onAddObject={handleAddOfficeObject}
          onRemoveObject={handleRemoveOfficeObject}
        />
      )}
    </div>
  );
}

const hudStyle: React.CSSProperties = {
  position: "absolute",
  left: 18,
  top: 18,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  maxWidth: 290,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const hintPanelStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(14, 18, 28, 0.9)",
  border: "1px solid rgba(91, 125, 186, 0.4)",
  color: "#dce7ff",
  fontSize: 12,
  lineHeight: 1.45,
};

const primaryButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(110, 165, 255, 0.45)",
  background: "rgba(20, 56, 112, 0.95)",
  color: "#eef4ff",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
  width: "fit-content",
};

const secondaryButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(120, 146, 190, 0.35)",
  background: "rgba(18, 26, 44, 0.92)",
  color: "#dce7ff",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const activeSecondaryButtonStyle: React.CSSProperties = {
  background: "rgba(28, 55, 98, 0.95)",
  border: "1px solid rgba(95, 163, 255, 0.8)",
};

const saveInfoPanelStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(14, 18, 28, 0.82)",
  border: "1px solid rgba(120, 146, 190, 0.22)",
  color: "#dce7ff",
  fontSize: 12,
  lineHeight: 1.45,
  maxWidth: 340,
};
