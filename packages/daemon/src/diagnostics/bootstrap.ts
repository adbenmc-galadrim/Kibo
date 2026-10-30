import type { AppInfo, Environment } from "@kibo/schema";
import { createAppInfo } from "../app-info";
import { appVersion } from "../app-version";
import type { ComponentsService } from "../components/service";
import type { LogBuffer } from "../log-buffer";
import type { RpcExtension } from "../rpc-extensions";
import { call, type Service } from "../service";
import { claudeBinOrNull, claudeStatus } from "./claude-status";
import { diagnosticCounts } from "./counts";
import { createDiagnostics } from "./diagnostics";
import { readEnvironment } from "./environment";
import { createExecPort } from "./exec";
import { appRpc } from "./rpc";

type AppDiagnosticsDeps = {
  home: string;
  userHome: string;
  startedAt: number;
  service: Service;
  components: Pick<ComponentsService, "registry">;
  log: LogBuffer;
  fixedNow?: string | null;
  today(): string;
  claudeBin: string | null;
  env: Record<string, string | undefined>;
  address(): string;
  capacity(): Environment["capacity"];
};

function environmentOf(deps: AppDiagnosticsDeps, appInfo: () => AppInfo): () => Promise<Environment> {
  const exec = createExecPort(deps.env);
  return () =>
    readEnvironment({
      daemon: { address: deps.address(), home: deps.home },
      refreshAi: () => claudeStatus(exec, claudeBinOrNull(deps.claudeBin, deps.env)),
      exec,
      gitBin: deps.env.KIBO_GIT ?? "git",
      ghBin: deps.env.KIBO_GH ?? "gh",
      capacity: deps.capacity,
      githubConnected: async () =>
        (await call(deps.service, { method: "listIntegrations" })).some(
          (s) => s.id === "github" && s.state === "connected",
        ),
      app: appInfo,
    });
}

export function startAppDiagnostics(deps: AppDiagnosticsDeps): { appInfo: () => AppInfo; rpc: RpcExtension } {
  const { service, userHome } = deps;
  const appInfo = createAppInfo({
    version: appVersion(),
    home: deps.home,
    userHome,
    pid: process.pid,
    startedAt: deps.startedAt,
    now: Date.now,
    today: deps.today,
    platform: process.platform,
    arch: process.arch,
    fixedNow: deps.fixedNow ?? null,
  });
  const environment = environmentOf(deps, appInfo);
  const diagnostics = createDiagnostics({
    appInfo,
    environment,
    counts: () =>
      diagnosticCounts({
        workspace: service.docs.workspace,
        project: (id) => service.docs.project(id),
        components: () => deps.components.registry.list().length,
        agents: () => service.agentData.agents(null).filter((agent) => agent.scope !== "system").length,
      }),
    integrations: async () =>
      (await call(service, { method: "listIntegrations" })).map(({ id, state }) => ({ id, state })),
    log: deps.log,
    userHome,
  });
  return { appInfo, rpc: appRpc({ appInfo, userHome, diagnostics, environment }) };
}
