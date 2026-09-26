import { z } from "zod";

export type SessionInfo = {
  id: string;
  deviceName: string;
  remote: boolean;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  current: boolean;
};

export const RemoteTls = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("self-signed") }),
  z.object({ kind: z.literal("provided"), certFile: z.string().min(1), keyFile: z.string().min(1) }),
]);
export type RemoteTls = z.infer<typeof RemoteTls>;

const WILDCARDS = new Set(["0.0.0.0", "::", "0:0:0:0:0:0:0:0"]);

export const RemoteAccessConfig = z.object({
  address: z
    .string()
    .ip()
    .refine((a) => !WILDCARDS.has(a), "listening on every interface is not allowed"),
  port: z.number().int().min(1024).max(65535),
  tls: RemoteTls,
});
export type RemoteAccessConfig = z.infer<typeof RemoteAccessConfig>;

export type RemoteAccessStatus = {
  enabled: boolean;
  address: string | null;
  port: number | null;
  url: string | null;
  fingerprint: string | null;
  tls: "self-signed" | "provided" | null;
  interfaces: { name: string; address: string }[];
  lastError: string | null;
};
export type PairingCode = { code: string; expiresAt: number };
export type SandboxStatus = {
  kind: "bwrap" | "sandbox-exec" | null;
  available: boolean;
  reason: string | null;
  fix: string | null;
  allowUnsandboxed: boolean;
};
