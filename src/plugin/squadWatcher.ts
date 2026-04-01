import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parse as parseYaml } from "yaml";
import type { SquadInfo, SquadState, WsMessage } from "../types/state";
import {
  createEmptyAgentLiveState,
  type AgentLiveState,
} from "../types/agentLive";
import {
  createEmptyOfficeLayoutData,
  type OfficeLayoutData,
} from "../types/officeLayout";
import { createDefaultProjectOfficeLayoutData } from "../office/defaultOfficeLayoutPreset";
import { normalizeSquadState } from "../lib/normalizeState";

function resolveSquadsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../squads"),
    path.resolve(process.cwd(), "squads"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.resolve(process.cwd(), "../squads");
}

function discoverSquads(squadsDir: string): SquadInfo[] {
  if (!fs.existsSync(squadsDir)) return [];

  const entries = fs.readdirSync(squadsDir, { withFileTypes: true });
  const squads: SquadInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

    const yamlPath = path.join(squadsDir, entry.name, "squad.yaml");
    if (fs.existsSync(yamlPath)) {
      try {
        const raw = fs.readFileSync(yamlPath, "utf-8");
        const parsed = parseYaml(raw);
        const squad = parsed?.squad ?? parsed;

        if (squad) {
          squads.push({
            code: typeof squad.code === "string" ? squad.code : entry.name,
            name: typeof squad.name === "string" ? squad.name : entry.name,
            description: typeof squad.description === "string" ? squad.description : "",
            icon: typeof squad.icon === "string" ? squad.icon : "\u{1F4CB}",
            agents: Array.isArray(squad.agents)
              ? (squad.agents as unknown[]).filter((agent): agent is string => typeof agent === "string")
              : [],
          });
          continue;
        }
      } catch {
        // Fall through to default metadata.
      }
    }

    squads.push({
      code: entry.name,
      name: entry.name,
      description: "",
      icon: "\u{1F4CB}",
      agents: [],
    });
  }

  return squads;
}

function isValidState(data: unknown): data is SquadState {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate.status === "string" &&
    candidate.step != null &&
    typeof candidate.step === "object" &&
    Array.isArray(candidate.agents)
  );
}

function getLatestArchivedStatePath(squadDir: string): string | null {
  const latestOutputDir = getLatestOutputDir(squadDir);
  if (!latestOutputDir) return null;

  const statePath = path.join(latestOutputDir, "state.json");
  return fs.existsSync(statePath) ? statePath : null;
}

function getLatestOutputDir(squadDir: string): string | null {
  const outputDir = path.join(squadDir, "output");
  if (!fs.existsSync(outputDir)) return null;

  const runDirs = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  return runDirs.length > 0 ? path.join(outputDir, runDirs[0]) : null;
}

function hasSlidesDir(outputDir: string | null): boolean {
  return getLatestSlidesVersion(outputDir) !== null;
}

function compareSlideVersions(left: string, right: string) {
  const leftMatch = /^v(\d+)$/i.exec(left);
  const rightMatch = /^v(\d+)$/i.exec(right);

  if (leftMatch && rightMatch) {
    return Number(rightMatch[1]) - Number(leftMatch[1]);
  }

  return right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });
}

function getLatestSlidesVersion(outputDir: string | null): string | null {
  if (!outputDir) return null;

  const slidesDir = path.join(outputDir, "slides");
  if (!fs.existsSync(slidesDir)) return null;

  const versions = fs
    .readdirSync(slidesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v/i.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareSlideVersions);

  return versions[0] ?? null;
}

function getLatestOutputAlertId(latestOutputDir: string | null, latestOutputId: string | null) {
  if (!latestOutputDir || !latestOutputId) return null;

  const latestSlidesVersion = getLatestSlidesVersion(latestOutputDir);
  if (latestSlidesVersion) {
    return `${latestOutputId}:${latestSlidesVersion}`;
  }

  const latestFolderSignature = getLatestOutputFolderSignature(latestOutputDir);
  return latestFolderSignature ? `${latestOutputId}:folders:${latestFolderSignature}` : null;
}

function getLatestOutputFolderSignature(outputDir: string | null) {
  if (!outputDir) return null;

  const folderNames = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "slides")
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));

  return folderNames.length > 0 ? folderNames.join("|") : null;
}

function resolveAgentMarkdownPath(squadDir: string, agentId: string) {
  const directPath = path.join(squadDir, "agents", `${agentId}.agent.md`);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const partyPath = path.join(squadDir, "squad-party.csv");
  if (!fs.existsSync(partyPath)) {
    return null;
  }

  try {
    const lines = fs
      .readFileSync(partyPath, "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines.slice(1)) {
      const columns = line.split(",");
      if (columns.length < 3) continue;
      const relativePath = columns[2]?.trim();
      if (!relativePath || !relativePath.includes(`${agentId}.agent.md`)) continue;

      const resolvedPath = path.resolve(squadDir, relativePath);
      if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
    }
  } catch {
    // Ignore malformed squad-party files.
  }

  return null;
}

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

function readSquadState(squadDir: string): SquadState | null {
  const candidates = [path.join(squadDir, "state.json"), getLatestArchivedStatePath(squadDir)].filter(
    (candidate): candidate is string => !!candidate
  );

  for (const statePath of candidates) {
    if (!fs.existsSync(statePath)) continue;

    try {
      const raw = fs.readFileSync(statePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) {
        return normalizeSquadState(parsed);
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function readVisibleStates(squadsDir: string): Record<string, SquadState> {
  const states: Record<string, SquadState> = {};
  if (!fs.existsSync(squadsDir)) return states;

  const entries = fs.readdirSync(squadsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const squadDir = path.join(squadsDir, entry.name);
    const state = readSquadState(squadDir);
    if (state) {
      states[entry.name] = state;
    }
  }

  return states;
}

function getSquadDir(squadsDir: string, squadName: string) {
  return path.join(squadsDir, squadName);
}

function getOfficeLayoutPath(squadsDir: string, squadName: string) {
  return path.join(getSquadDir(squadsDir, squadName), "office-layout.json");
}

function getAgentLivePath(squadsDir: string, squadName: string) {
  return path.join(getSquadDir(squadsDir, squadName), "agent-live.json");
}

function isAgentLiveState(data: unknown): data is AgentLiveState {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Record<string, unknown>;

  return (
    candidate.version === 1 &&
    typeof candidate.agents === "object" &&
    candidate.agents !== null &&
    (candidate.updatedAt == null || typeof candidate.updatedAt === "string")
  );
}

function readAgentLiveState(squadsDir: string, squadName: string): AgentLiveState {
  const filePath = getAgentLivePath(squadsDir, squadName);
  if (!fs.existsSync(filePath)) {
    return createEmptyAgentLiveState();
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;

    if (isAgentLiveState(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore invalid live files and fall back to empty state.
  }

  return createEmptyAgentLiveState();
}

function isOfficeLayoutData(data: unknown): data is OfficeLayoutData {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Record<string, unknown>;

  return (
    candidate.version === 1 &&
    Array.isArray(candidate.customAgents) &&
    typeof candidate.agentMeta === "object" &&
    candidate.agentMeta !== null &&
    typeof candidate.workstationOrigins === "object" &&
    candidate.workstationOrigins !== null &&
    typeof candidate.officeObjectOverrides === "object" &&
    candidate.officeObjectOverrides !== null &&
    Array.isArray(candidate.removedOfficeObjectIds) &&
    Array.isArray(candidate.customOfficeObjects) &&
    (candidate.lastAcknowledgedOutputId == null ||
      typeof candidate.lastAcknowledgedOutputId === "string") &&
    (candidate.playerAppearance == null || typeof candidate.playerAppearance === "object")
  );
}

function readOfficeLayout(squadsDir: string, squadName: string): OfficeLayoutData | null {
  const filePath = getOfficeLayoutPath(squadsDir, squadName);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;

    if (isOfficeLayoutData(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore invalid layout files and fall back to template defaults.
  }

  return null;
}

function writeOfficeLayout(squadsDir: string, squadName: string, layout: OfficeLayoutData) {
  const squadDir = getSquadDir(squadsDir, squadName);
  const filePath = getOfficeLayoutPath(squadsDir, squadName);
  fs.mkdirSync(squadDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(layout, null, 2) + "\n", "utf-8");
}

function getOfficeLayoutForPatch(squadsDir: string, squadName: string) {
  return readOfficeLayout(squadsDir, squadName) ?? createDefaultProjectOfficeLayoutData();
}

function openDirectory(directoryPath: string) {
  if (process.platform === "win32") {
    spawn("explorer.exe", [directoryPath], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  if (process.platform === "darwin") {
    spawn("open", [directoryPath], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [directoryPath], { detached: true, stdio: "ignore" }).unref();
}

function buildSnapshot(squadsDir: string): WsMessage {
  return {
    type: "SNAPSHOT",
    squads: discoverSquads(squadsDir),
    activeStates: readVisibleStates(squadsDir),
  };
}

function broadcast(wss: WebSocketServer, msg: WsMessage) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function squadWatcherPlugin(): Plugin {
  return {
    name: "squad-watcher",
    configureServer(server: ViteDevServer) {
      const squadsDir = resolveSquadsDir();
      server.config.logger.info(`[squad-watcher] squads dir: ${squadsDir}`);

      server.middlewares.use("/__office_layout", (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const squadName = url.searchParams.get("squad");

        if (!squadName) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing squad query parameter" }));
          return;
        }

        const squadDir = getSquadDir(squadsDir, squadName);
        if (!fs.existsSync(squadDir)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Squad not found" }));
          return;
        }

        if (req.method === "GET") {
          const layout = readOfficeLayout(squadsDir, squadName);
          res.statusCode = layout ? 200 : 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ layout }));
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body) as { layout?: unknown };
              const layout =
                parsed.layout && isOfficeLayoutData(parsed.layout)
                  ? parsed.layout
                  : createEmptyOfficeLayoutData();

              writeOfficeLayout(squadsDir, squadName, layout);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ layout }));
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Invalid office layout payload" }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.setHeader("Allow", "GET, POST");
        res.end();
      });

      server.middlewares.use("/__snapshot", (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Allow", "GET");
          res.end();
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(buildSnapshot(squadsDir)));
      });

      server.middlewares.use("/__agent_live", (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Allow", "GET");
          res.end();
          return;
        }

        const url = new URL(req.url ?? "", "http://localhost");
        const squadName = url.searchParams.get("squad");

        if (!squadName) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing squad query parameter" }));
          return;
        }

        const squadDir = getSquadDir(squadsDir, squadName);
        if (!fs.existsSync(squadDir)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Squad not found" }));
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(readAgentLiveState(squadsDir, squadName)));
      });

      server.middlewares.use("/__latest_output", (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const squadName = url.searchParams.get("squad");

        if (!squadName) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing squad query parameter" }));
          return;
        }

        const squadDir = getSquadDir(squadsDir, squadName);
        if (!fs.existsSync(squadDir)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Squad not found" }));
          return;
        }

        const latestOutputDir = getLatestOutputDir(squadDir);
        const latestOutputId = latestOutputDir ? path.basename(latestOutputDir) : null;
        const latestAlertId = getLatestOutputAlertId(latestOutputDir, latestOutputId);

        if (req.method === "GET") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              outputId: latestOutputId,
              outputPath: latestOutputDir,
              hasSlides: hasSlidesDir(latestOutputDir),
              alertId: latestAlertId,
            })
          );
          return;
        }

        if (req.method === "POST") {
          if (!latestOutputDir || !latestOutputId) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "No output directory found" }));
            return;
          }

          try {
            openDirectory(latestOutputDir);
            const layout = getOfficeLayoutForPatch(squadsDir, squadName);
            writeOfficeLayout(squadsDir, squadName, {
              ...layout,
              lastAcknowledgedOutputId: latestAlertId ?? latestOutputId,
            });

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                outputId: latestOutputId,
                outputPath: latestOutputDir,
                hasSlides: hasSlidesDir(latestOutputDir),
                alertId: latestAlertId,
              })
            );
          } catch {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Failed to open output directory" }));
          }
          return;
        }

        res.statusCode = 405;
        res.setHeader("Allow", "GET, POST");
        res.end();
      });

      server.middlewares.use("/__agent_orientation", (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Allow", "GET");
          res.end();
          return;
        }

        const url = new URL(req.url ?? "", "http://localhost");
        const squadName = url.searchParams.get("squad");
        const agentId = url.searchParams.get("agent");

        if (!squadName || !agentId) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing squad or agent query parameter" }));
          return;
        }

        const squadDir = getSquadDir(squadsDir, squadName);
        if (!fs.existsSync(squadDir)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Squad not found" }));
          return;
        }

        const markdownPath = resolveAgentMarkdownPath(squadDir, agentId);
        if (!markdownPath) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Agent orientation not found" }));
          return;
        }

        try {
          const content = stripFrontmatter(fs.readFileSync(markdownPath, "utf-8"));
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ content, filePath: markdownPath }));
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Failed to read agent orientation" }));
        }
      });

      const wss = new WebSocketServer({ noServer: true });
      (server.httpServer as Server).on(
        "upgrade",
        (req: IncomingMessage, socket: Duplex, head: Buffer) => {
          if (req.url === "/__squads_ws") {
            wss.handleUpgrade(req, socket, head, (ws) => {
              wss.emit("connection", ws, req);
            });
          }
        }
      );

      wss.on("connection", (ws) => {
        ws.send(JSON.stringify(buildSnapshot(squadsDir)));
      });

      if (!fs.existsSync(squadsDir)) {
        fs.mkdirSync(squadsDir, { recursive: true });
      }

      const stateGlobs = [
        path.join(squadsDir, "*/state.json"),
        path.join(squadsDir, "*/output/*/state.json"),
      ].map((glob) => glob.replace(/\\/g, "/"));
      server.watcher.add(stateGlobs);

      const yamlGlob = path.join(squadsDir, "*/squad.yaml").replace(/\\/g, "/");
      server.watcher.add(yamlGlob);

      const changeTimers = new Map<string, ReturnType<typeof setTimeout>>();

      const scheduleStateBroadcast = (
        filePath: string,
        messageType: "SQUAD_ACTIVE" | "SQUAD_UPDATE"
      ) => {
        const squadName = extractSquadName(filePath, squadsDir);
        if (!squadName) return;

        clearTimeout(changeTimers.get(squadName));
        changeTimers.set(
          squadName,
          setTimeout(() => {
            const state = readSquadState(path.join(squadsDir, squadName));
            if (state) {
              broadcast(wss, { type: messageType, squad: squadName, state });
            } else {
              broadcast(wss, { type: "SQUAD_INACTIVE", squad: squadName });
            }
          }, 80)
        );
      };

      server.watcher.on("add", (filePath: string) => {
        if (filePath.endsWith("state.json")) {
          scheduleStateBroadcast(filePath, "SQUAD_ACTIVE");
        } else if (filePath.endsWith("squad.yaml")) {
          broadcast(wss, buildSnapshot(squadsDir));
        }
      });

      server.watcher.on("change", (filePath: string) => {
        if (filePath.endsWith("state.json")) {
          scheduleStateBroadcast(filePath, "SQUAD_UPDATE");
        } else if (filePath.endsWith("squad.yaml")) {
          broadcast(wss, buildSnapshot(squadsDir));
        }
      });

      server.watcher.on("unlink", (filePath: string) => {
        if (filePath.endsWith("state.json")) {
          const squadName = extractSquadName(filePath, squadsDir);
          if (!squadName) return;

          clearTimeout(changeTimers.get(squadName));
          changeTimers.delete(squadName);

          const archivedState = readSquadState(path.join(squadsDir, squadName));
          if (archivedState) {
            broadcast(wss, { type: "SQUAD_UPDATE", squad: squadName, state: archivedState });
          } else {
            broadcast(wss, { type: "SQUAD_INACTIVE", squad: squadName });
          }
        } else if (filePath.endsWith("squad.yaml")) {
          broadcast(wss, buildSnapshot(squadsDir));
        }
      });
    },
  };
}

function extractSquadName(filePath: string, squadsDir: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  const normalizedBase = squadsDir.replace(/\\/g, "/");
  const relative = normalized.replace(normalizedBase + "/", "");
  const parts = relative.split("/");
  return parts.length >= 2 ? parts[0] : null;
}
