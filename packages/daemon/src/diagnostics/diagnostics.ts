import type { AppInfo, Diagnostics, Environment } from "@kibo/schema";
import type { LogBuffer } from "../log-buffer";
import { redactPaths } from "./redact-paths";
import { redactSecrets } from "./redact-secrets";

const LOG_LINES = 50;

type DiagnosticsDeps = {
  appInfo(): AppInfo;
  environment(): Promise<Environment>;
  counts(): Diagnostics["counts"];
  integrations(): Promise<Diagnostics["integrations"]>;
  log: LogBuffer;
  userHome: string;
};

export function createDiagnostics(deps: DiagnosticsDeps): () => Promise<Diagnostics> {
  const clean = (text: string) => redactPaths(redactSecrets(text), deps.userHome);
  return async () => {
    const environment = await deps.environment();
    return {
      app: deps.appInfo(),
      environment: {
        ...environment,
        daemon: { ...environment.daemon, home: clean(environment.daemon.home) },
      },
      counts: deps.counts(),
      integrations: await deps.integrations(),
      log: deps.log.tail(LOG_LINES).map(clean),
    };
  };
}
