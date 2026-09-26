import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSelfSignedCert, type SelfSigned } from "@kibo/trust";
import { createInvite } from "../accounts";
import { initMarketSource } from "../market/team-market";
import { startSyncServer } from "../server";

export type TestSyncServerOptions = {
  now?: () => number;
  dataDir?: string;
  port?: number;
  cert?: SelfSigned;
  market?: { id: string; name: string };
  authTimeoutMs?: number;
};

export async function startTestSyncServer(opts: TestSyncServerOptions = {}) {
  const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), "kibo-sync-test-"));
  const cert =
    opts.cert ??
    (await generateSelfSignedCert({
      commonName: "kibo-sync-test",
      dns: ["localhost"],
      ips: ["127.0.0.1"],
      days: 2,
    }));
  const now = opts.now ?? Date.now;
  if (opts.market) await initMarketSource(dataDir, opts.market);
  const server = await startSyncServer({
    dataDir,
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    origin: "",
    tls: { cert: cert.certPem, key: cert.keyPem },
    behindProxy: false,
    now,
    authTimeoutMs: opts.authTimeoutMs,
  });
  const base = `127.0.0.1:${server.port}`;
  return {
    url: `wss://${base}`,
    httpsUrl: `https://${base}`,
    origin: `wss://${base}`,
    caPem: cert.certPem,
    cert,
    dataDir,
    server,
    now,
    inviteAccount: async (name: string) =>
      (await createInvite(server.sdb, { kind: "account", name, createdBy: "admin" }, now())).code,
    stop: async (stopOpts: { keepData?: boolean } = {}) => {
      await server.stop();
      if (!stopOpts.keepData) rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export type TestSyncServer = Awaited<ReturnType<typeof startTestSyncServer>>;
