import type { AppInfo } from "@kibo/schema";
import { createAppInfo } from "../app-info";
import { appVersion } from "../app-version";
import type { ComponentsService } from "../components/service";
import type { LogBuffer } from "../log-buffer";
import type { RpcExtension } from "../rpc-extensions";
import { call, type Service } from "../service";
import { diagnosticCounts } from "./counts";
import { createDiagnostics } from "./diagnostics";
import { appRpc } from "./rpc";

type AppDiagnosticsDeps = {
  home: string;
  userHome: string;
  startedAt: number;
  service: Service;
  components: Pick<ComponentsService, "registry">;
  log: LogBuffer;
};

export function startAppDiagnostics(deps: AppDiagnosticsDeps): { appInfo: () => AppInfo; rpc: RpcExtension } {
  const { service, userHome } = deps;
  const appInfo = createAppInfo({
    version: appVersion(),
    home: deps.home,
    userHome,
    pid: process.pid,
    startedAt: deps.startedAt,
    now: Date.now,
    platform: process.platform,
    arch: process.arch,
  });
  const diagnostics = createDiagnostics({
    appInfo,
    environment: async () => call(service, { method: "getEnvironment" }),
    counts: () =>
      diagnosticCounts({
        workspace: service.docs.workspace,
        project: (id) => service.docs.project(id),
        components: () => deps.components.registry.list().length,
      }),
    integrations: async () =>
      (await call(service, { method: "listIntegrations" })).map(({ id, state }) => ({ id, state })),
    log: deps.log,
    userHome,
  });
  return { appInfo, rpc: appRpc({ appInfo, diagnostics }) };
}
