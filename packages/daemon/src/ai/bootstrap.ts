import type { Database } from "bun:sqlite";
import { mkdirSync, realpathSync } from "node:fs";
import { delimiter, join } from "node:path";
import { type Toolchain, toolchainModules } from "@kibo/devkit";
import { type IntegrationStatus, KiboError } from "@kibo/schema";
import type { Orchestrator } from "../agents/orchestrator-types";
import { resolveClaudeBin } from "../agents/runner";
import { editorCommand, openInEditor } from "../code/editor";
import type { Docs } from "../docs";
import { ensureSystemProfiles, readConfig } from "../workspace-config";
import {
  createExecPort,
  githubConnected,
  kiboShimArgv,
  runsFromOrchestrator,
  systemClock,
  writeKiboShim,
} from "./adapters";
import {
  assistantArgs,
  type ClaudeProbe,
  createAiAvailability,
  generatorArgs,
  parseHelp,
  probeClaude,
} from "./claude-cli";
import { createDraftLifecycle } from "./draft-lifecycle";
import { createDraftPublisher } from "./draft-publish";
import { openDraftStore } from "./draft-store";
import { readEnvironment } from "./environment";
import {
  catalogPort,
  devkitPort,
  differPort,
  type LiveComponents,
  projectsPort,
  type Validate,
} from "./live-ports";
import { type AiPort, createAiRpc } from "./methods";
import type { AiAvailability, AiEvents, Exec } from "./ports";
import { assistantPrompt, STARTER_PLAN_JSON_SCHEMA } from "./prompts";
import { createStarterService } from "./starter";

export type AiBootstrapDeps = {
  home: string;
  toolchain: Toolchain;
  db: Database;
  docs: Docs;
  orchestrator: Orchestrator;
  components: LiveComponents;
  validate: Validate | null;
  claudeBin: string | null;
  agentEnv: Record<string, string | undefined>;
  address: string;
  listIntegrations: () => Promise<IntegrationStatus[]>;
  assistantTimeoutMs?: number;
};

const MISSING: ClaudeProbe = { found: false, version: null, loggedIn: null, capabilities: null };

function claudeBinOrNull(configured: string | null, env: Record<string, string | undefined>): string | null {
  try {
    return resolveClaudeBin(configured, env);
  } catch (e) {
    if (e instanceof KiboError && e.code === "AGENT_CLI_NOT_FOUND") return null;
    throw e;
  }
}

function availability(deps: AiBootstrapDeps, exec: Exec): AiAvailability {
  const bin = claudeBinOrNull(deps.claudeBin, deps.agentEnv);
  return createAiAvailability({
    probe: () => (bin ? probeClaude(exec, bin) : Promise.resolve(MISSING)),
    profileEnabled: (id) => readConfig(deps.docs).profiles.find((p) => p.id === id)?.enabled ?? false,
  });
}

function environmentOf(deps: AiBootstrapDeps, ai: AiAvailability, exec: Exec) {
  return () =>
    readEnvironment({
      daemon: { address: deps.address, home: deps.home },
      refreshAi: () => ai.refresh(),
      exec,
      gitBin: deps.agentEnv.KIBO_GIT ?? "git",
      ghBin: deps.agentEnv.KIBO_GH ?? "gh",
      capacity: () => {
        const h = deps.orchestrator.state().host;
        return { cores: h.cores, ramGb: h.ramGb, hostSlots: h.hostSlots };
      },
      githubConnected: async () => githubConnected(await deps.listIntegrations()),
    });
}

export async function startAi(deps: AiBootstrapDeps): Promise<{ port: AiPort; stop(): Promise<void> }> {
  const { home, docs, agentEnv, toolchain } = deps;
  const shutdown = new AbortController();
  ensureSystemProfiles(docs);
  const exec = createExecPort(agentEnv);
  const ai = availability(deps, exec);
  await ai.refresh();
  const events: AiEvents = { publish: (e) => docs.emit(e) };
  const runs = runsFromOrchestrator(deps.orchestrator);
  const devkit = devkitPort({ home, toolchain, validate: deps.validate, signal: shutdown.signal });
  const catalog = catalogPort({ home, components: deps.components });
  const store = openDraftStore(deps.db);
  const binDir = writeKiboShim(join(home, "bin"), kiboShimArgv());
  const caps = () => ai.capabilities() ?? parseHelp("");
  const lifecycle = createDraftLifecycle({
    store,
    runs,
    devkit,
    catalog,
    ai,
    events,
    clock: systemClock,
    editor: {
      openFolder: async (dir) => openInEditor(editorCommand(dir, null, process.env, process.platform)),
    },
    home,
    sdkDir: realpathSync(join(toolchainModules(toolchain), "@kibo", "sdk")),
    args: () => generatorArgs(caps()),
    env: () => ({ PATH: `${binDir}${delimiter}${agentEnv.PATH ?? ""}`, KIBO_TOOLCHAIN: toolchain.root }),
    newId: () => crypto.randomUUID(),
  });
  const publisher = createDraftPublisher({
    store,
    devkit,
    catalog,
    projects: projectsPort(docs),
    differ: differPort(agentEnv, home),
    events,
    clock: systemClock,
    home,
    lock: deps.components.publishLock,
  });
  mkdirSync(join(home, "tmp"), { recursive: true, mode: 0o700 });
  const starter = createStarterService({
    runs,
    ai,
    events,
    clock: systemClock,
    workRoot: join(home, "tmp"),
    catalog: () => catalog.entries(),
    prompt: assistantPrompt,
    args: () => assistantArgs(caps(), JSON.stringify(STARTER_PLAN_JSON_SCHEMA)),
    ...(deps.assistantTimeoutMs !== undefined && { timeoutMs: deps.assistantTimeoutMs }),
  });
  const port = createAiRpc({ ai, starter, lifecycle, publisher, environment: environmentOf(deps, ai, exec) });
  await lifecycle.recover();
  return {
    port,
    async stop() {
      shutdown.abort();
      await lifecycle.idle();
    },
  };
}
