import type { ChangeMessage, RemoteStatus, RpcRequest, RpcResult } from "@kibo/schema";
import type { SecretStore } from "../integrations/types";
import type { QuestionImageFile } from "../questions/question-images";
import { LOCAL_CONTEXT, type RpcContext, type RpcExtension } from "../rpc-extensions";
import type { Store } from "../store";
import { createRemoteController } from "./controller";
import { createExclusive } from "./exclusive";
import { createLink } from "./link";
import { createPusher } from "./pusher";
import { createReplayGuard } from "./replay-guard";
import { createRequestHandler } from "./request-handler";
import { createRevoker } from "./revoker";
import { remoteRpc } from "./rpc";
import { openRemoteSecrets } from "./secrets";
import { openRemoteSettings } from "./settings";
import { createSnapshotBuilder, type LocalRpc } from "./snapshot-builder";
import { type RemoteTimers, realTimers } from "./timers";

export const DEFAULT_REMOTE_URL = "https://kibo.shinseo.fr";

const QUIET_CHANGES = new Set(["code", "sessions.changed", "backups.changed"]);

type RemoteDeps = {
  store: Pick<Store, "db" | "getLocal" | "setLocal">;
  secrets: SecretStore;
  defaultUrl: string;
  dispatch(req: RpcRequest, ctx: RpcContext): Promise<unknown>;
  readImage(questionId: string, imageId: string): QuestionImageFile | null;
  onChange(listener: (message: ChangeMessage) => void): () => void;
  onProjectRemoved(listener: (projectId: string) => void): () => void;
  now(): number;
  log(line: string): void;
  redact(text: string): string;
  timers?: RemoteTimers;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
};

export type RemoteModule = { rpc: RpcExtension; status(): Promise<RemoteStatus>; stop(): Promise<void> };

const localRpc =
  (dispatch: RemoteDeps["dispatch"]): LocalRpc =>
  async (req) =>
    (await dispatch(req, LOCAL_CONTEXT)) as RpcResult[typeof req.method];

const changedProject = (message: ChangeMessage): string | null | undefined => {
  if ("type" in message && QUIET_CHANGES.has(message.type)) return undefined;
  return "projectId" in message ? message.projectId : null;
};

export function startRemote(deps: RemoteDeps): RemoteModule {
  const timers = deps.timers ?? realTimers;
  const settings = openRemoteSettings(deps.store);
  const secrets = openRemoteSecrets(deps.secrets);
  const builder = createSnapshotBuilder({ rpc: localRpc(deps.dispatch), readImage: deps.readImage });
  const handleRequest = createRequestHandler({
    keys: () => link.keys(),
    gate: { dispatch: deps.dispatch, seen: createReplayGuard(), now: deps.now, redact: deps.redact },
  });
  const link = createLink({
    timers,
    now: deps.now,
    log: deps.log,
    onOpen: () => void pusher.pushAll(),
    handleRequest,
  });
  const pusher = createPusher({
    builder,
    keys: () => link.keys(),
    send: (message) => link.send(message),
    projects: () => settings.read().projects,
    now: deps.now,
    log: deps.log,
    timers,
  });

  const exclusive = createExclusive();
  const revoker = createRevoker({
    timers,
    now: deps.now,
    log: deps.log,
    onRevoked: () =>
      exclusive(async () => {
        if (!settings.read().pendingRevoke) return;
        settings.clear();
        await secrets.clear();
        deps.log("[kibo-daemon] remote phone revoked, access fully disabled");
      }),
  });

  const resumeRevocation = async (serverUrl: string | null) => {
    const macToken = await secrets.macToken();
    if (serverUrl === null || macToken === null)
      return deps.log("[kibo-daemon] remote revocation cannot resume");
    revoker.start({ serverUrl, macToken });
  };

  const resume = async () => {
    const s = settings.read();
    if (s.pendingRevoke) return resumeRevocation(s.serverUrl);
    if (!s.enabled || s.serverUrl === null || s.accountId === null) return;
    const credentials = await secrets.load();
    if (!credentials) return deps.log("[kibo-daemon] remote access enabled but its keys are missing");
    await link.start({ serverUrl: s.serverUrl, accountId: s.accountId, epoch: s.keyEpoch, ...credentials });
  };
  const ready = resume().catch((e: unknown) =>
    deps.log(`[kibo-daemon] remote access not resumed: ${String(e)}`),
  );

  const offChange = deps.onChange((message) => {
    const projectId = changedProject(message);
    if (projectId !== undefined && link.connected()) pusher.changed(projectId);
  });
  const offRemoved = deps.onProjectRemoved((projectId) => {
    const { projects, enabled } = settings.read();
    if (!projects.includes(projectId)) return;
    settings.setProjects(projects.filter((id) => id !== projectId));
    if (enabled) void pusher.removeProject(projectId);
  });

  const controller = createRemoteController({
    settings,
    secrets,
    link,
    pusher,
    revoker,
    exclusive,
    defaultUrl: deps.defaultUrl,
    fetch: deps.fetch ?? fetch,
    log: deps.log,
    ready,
  });

  return {
    rpc: remoteRpc(controller),
    status: controller.status,
    stop: async () => {
      offChange();
      offRemoved();
      await ready;
      pusher.stop();
      link.stop();
      revoker.stop();
      await pusher.idle();
    },
  };
}
