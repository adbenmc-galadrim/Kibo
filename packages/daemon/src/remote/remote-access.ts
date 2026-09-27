import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  KiboError,
  RemoteAccessConfig,
  type RemoteAccessStatus,
  RemoteTls,
  SECRET_REMOTE_TLS,
} from "@kibo/schema";
import { certFingerprint, generateSelfSignedCert } from "@kibo/trust";
import { z } from "zod";
import type { SecretStore } from "../integrations/types";
import type { LocalSettings } from "../settings";
import type { NetworkAddress } from "./interfaces";

export const REMOTE_SETTING_KEY = "remoteAccess";
export const REMOTE_TLS_SECRET = SECRET_REMOTE_TLS;
const CERT_DAYS = 825;

export type RemoteAccess = {
  status(): RemoteAccessStatus;
  enable(cfg: RemoteAccessConfig): Promise<RemoteAccessStatus>;
  disable(): Promise<void>;
  resume(): Promise<void>;
  stop(): void;
};
export type TlsMaterial = { cert: string; key: string };
export type RemoteListen = (input: { hostname: string; port: number; tls: TlsMaterial }) => {
  port: number;
  stop(): void;
};
export type RemoteAccessDeps = {
  home: string;
  settings: LocalSettings;
  secrets: SecretStore;
  interfaces(): NetworkAddress[];
  listen: RemoteListen;
  log(message: string): void;
};

const Stored = z
  .object({
    enabled: z.boolean(),
    address: z.string(),
    port: z.number().int(),
    tls: RemoteTls,
    certAddress: z.string().nullable(),
  })
  .nullable();
type Running = { stop(): void; address: string; port: number; fingerprint: string; tls: RemoteTls["kind"] };

const FIRST_CERT = /-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\s]+?-----END CERTIFICATE-----/;
const hostPart = (address: string) => (address.includes(":") ? `[${address}]` : address);

export function leafCertificate(pem: string): string {
  const leaf = FIRST_CERT.exec(pem)?.[0];
  if (leaf === undefined)
    throw new KiboError("INVALID_INPUT", "the TLS certificate file holds no certificate");
  return leaf;
}

function readProvided(certFile: string, keyFile: string): TlsMaterial {
  try {
    return { cert: readFileSync(certFile, "utf8"), key: readFileSync(keyFile, "utf8") };
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `cannot read the TLS certificate or key: ${String(e)}`);
  }
}

export function createRemoteAccess(deps: RemoteAccessDeps): RemoteAccess {
  let running: Running | null = null;
  let lastError: string | null = null;
  const dir = join(deps.home, "remote");
  const certPath = join(dir, "cert.pem");
  const stored = () => deps.settings.get(REMOTE_SETTING_KEY, Stored, null);

  const selfSigned = async (address: string): Promise<TlsMaterial> => {
    const key = await deps.secrets.get(REMOTE_TLS_SECRET);
    if (key && existsSync(certPath) && stored()?.certAddress === address) {
      return { cert: readFileSync(certPath, "utf8"), key };
    }
    const made = await generateSelfSignedCert({
      commonName: "Kibo",
      dns: [],
      ips: [address],
      days: CERT_DAYS,
    });
    await deps.secrets.set(REMOTE_TLS_SECRET, made.keyPem);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(certPath, made.certPem, { mode: 0o600 });
    chmodSync(certPath, 0o600);
    return { cert: made.certPem, key: made.keyPem };
  };

  const listen = (cfg: RemoteAccessConfig, tls: TlsMaterial) => {
    try {
      return deps.listen({ hostname: cfg.address, port: cfg.port, tls });
    } catch (e) {
      if (e instanceof KiboError) throw e;
      throw new KiboError(
        "INVALID_INPUT",
        `cannot listen on ${hostPart(cfg.address)}:${cfg.port}: ${String(e)}`,
      );
    }
  };

  const start = async (cfg: RemoteAccessConfig) => {
    if (!deps.interfaces().some((i) => i.address === cfg.address)) {
      throw new KiboError("INVALID_INPUT", `${cfg.address} is not an address of this machine`);
    }
    const tls =
      cfg.tls.kind === "self-signed"
        ? await selfSigned(cfg.address)
        : readProvided(cfg.tls.certFile, cfg.tls.keyFile);
    const fingerprint = await certFingerprint(leafCertificate(tls.cert));
    running?.stop();
    running = null;
    const handle = listen(cfg, tls);
    running = { stop: handle.stop, address: cfg.address, port: handle.port, fingerprint, tls: cfg.tls.kind };
    deps.settings.set(REMOTE_SETTING_KEY, {
      enabled: true,
      address: cfg.address,
      port: cfg.port,
      tls: cfg.tls,
      certAddress: cfg.tls.kind === "self-signed" ? cfg.address : null,
    });
    lastError = null;
  };

  const status = (): RemoteAccessStatus => ({
    enabled: running !== null,
    address: running?.address ?? null,
    port: running?.port ?? null,
    url: running ? `https://${hostPart(running.address)}:${running.port}` : null,
    fingerprint: running?.fingerprint ?? null,
    tls: running?.tls ?? null,
    interfaces: deps.interfaces(),
    lastError,
  });

  const stop = () => {
    running?.stop();
    running = null;
  };

  return {
    status,
    stop,
    async enable(cfg) {
      const parsed = RemoteAccessConfig.safeParse(cfg);
      if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
      await start(parsed.data);
      return status();
    },
    async disable() {
      stop();
      const s = stored();
      if (s) deps.settings.set(REMOTE_SETTING_KEY, { ...s, enabled: false });
    },
    async resume() {
      const s = stored();
      if (!s?.enabled) return;
      const parsed = RemoteAccessConfig.safeParse({ address: s.address, port: s.port, tls: s.tls });
      try {
        if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
        await start(parsed.data);
      } catch (e) {
        lastError = e instanceof KiboError ? e.code : "INTERNAL";
        deps.log(`remote access not resumed: ${e instanceof KiboError ? e.detail : String(e)}`);
      }
    },
  };
}
