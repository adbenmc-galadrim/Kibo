import { z } from "zod";

const SETUP_CODE_MIN = 8;
const SETUP_CODE_MAX = 64;

const remoteServerUrlAllowed = (raw: string): boolean => {
  if (!URL.canParse(raw)) return false;
  const url = new URL(raw);
  return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "127.0.0.1");
};

const RemoteServerUrl = z
  .string()
  .max(2048)
  .refine(remoteServerUrlAllowed, "https required unless http://127.0.0.1");

export const RemoteStatus = z.object({
  enabled: z.boolean(),
  serverUrl: z.string().nullable(),
  connected: z.boolean(),
  lastPushAt: z.number().int().nullable(),
  projects: z.array(z.string()),
  phonePaired: z.boolean(),
  revokePending: z.boolean(),
  keyEpoch: z.number().int().nonnegative(),
});
export type RemoteStatus = z.infer<typeof RemoteStatus>;

export const RemotePairing = z.object({ code: z.string().min(1), expiresAt: z.number().int() });
export type RemotePairing = z.infer<typeof RemotePairing>;

export const REMOTE_RPC = [
  z.object({ method: z.literal("remote.status") }),
  z.object({
    method: z.literal("remote.enable"),
    serverUrl: RemoteServerUrl,
    setupCode: z.string().min(SETUP_CODE_MIN).max(SETUP_CODE_MAX),
  }),
  z.object({ method: z.literal("remote.disable") }),
  z.object({ method: z.literal("remote.setProjects"), projectIds: z.array(z.string().min(1)).max(500) }),
  z.object({ method: z.literal("remote.createPairing") }),
  z.object({ method: z.literal("remote.revokePhone") }),
] as const;

type RemoteRpcRequest = z.infer<(typeof REMOTE_RPC)[number]>;
export const REMOTE_RPC_METHODS: readonly RemoteRpcRequest["method"][] = REMOTE_RPC.map(
  (schema) => schema.shape.method.value,
);

export type RemoteRpcResult = {
  "remote.status": RemoteStatus;
  "remote.enable": RemoteStatus;
  "remote.disable": RemoteStatus;
  "remote.setProjects": RemoteStatus;
  "remote.createPairing": RemotePairing;
  "remote.revokePhone": RemoteStatus;
};
