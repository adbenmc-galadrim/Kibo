import type { DraftAssets } from "./ai/draft-preview";
import { type SandboxServerOptions, startSandboxServer } from "./components/sandbox-server";
import type { Closer } from "./daemon-shutdown";
import { listInterfaces } from "./remote/interfaces";
import { createRemoteAccess, type RemoteAccess, type RemoteAccessDeps } from "./remote/remote-access";
import type { RunningServer } from "./server";

export async function startRemote(
  deps: Pick<RemoteAccessDeps, "home" | "settings" | "secrets">,
  server: Pick<RunningServer, "listenRemote">,
  front: Closer[],
): Promise<RemoteAccess> {
  const started = createRemoteAccess({
    ...deps,
    interfaces: () => listInterfaces(),
    listen: (input) => server.listenRemote(input),
    log: (message) => console.warn(`[kibo-daemon] ${message}`),
  });
  front.push(() => started.stop());
  await started.resume();
  return started;
}

export function startDaemonSandbox(
  opts: Omit<SandboxServerOptions, "drafts">,
  drafts: () => DraftAssets | null,
  front: Closer[],
): { url: string; port: number } {
  const sandbox = startSandboxServer({
    ...opts,
    drafts: {
      lookup: async (...a) => drafts()?.lookup(...a) ?? null,
      manifest: async (draftId) => drafts()?.manifest(draftId) ?? null,
    },
  });
  front.push(() => sandbox.stop());
  return sandbox;
}
