import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestSyncServer } from "@kibo/sync-server/testing";
import { SYNC_PORTS, SYNC_STATE_FILE } from "./sync-fixture";

const base = mkdtempSync(join(tmpdir(), "kibo-e2e-sync-"));
const dataDir = join(base, "server");
let server = await startTestSyncServer({ dataDir, port: SYNC_PORTS.server });
const { cert } = server;
const caFile = join(base, "ca.pem");
writeFileSync(caFile, server.caPem, { mode: 0o600 });
writeFileSync(
  SYNC_STATE_FILE,
  JSON.stringify({
    caFile,
    serverUrl: server.url,
    codes: {
      darkA: await server.inviteAccount("Adam"),
      darkB: await server.inviteAccount("Léa"),
      lightA: await server.inviteAccount("Adam"),
      lightB: await server.inviteAccount("Léa"),
    },
  }),
);

const ports = [SYNC_PORTS.dark.a, SYNC_PORTS.dark.b, SYNC_PORTS.light.a, SYNC_PORTS.light.b];
const daemons = ports.map((port) =>
  Bun.spawn(["bun", "serve.ts", String(port), "question", "--integrations"], {
    cwd: import.meta.dir,
    stdout: "inherit",
    stderr: "inherit",
  }),
);

const control = Bun.serve({
  hostname: "127.0.0.1",
  port: SYNC_PORTS.control,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (req.method === "POST" && path === "/stop") {
      await server.stop({ keepData: true });
      return new Response(null, { status: 204 });
    }
    if (req.method === "POST" && path === "/start") {
      server = await startTestSyncServer({ dataDir, port: SYNC_PORTS.server, cert });
      return new Response(null, { status: 204 });
    }
    if (path === "/") return new Response("ok");
    return new Response("not found", { status: 404 });
  },
});

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  for (const d of daemons) d.kill("SIGTERM");
  await Promise.all(daemons.map((d) => d.exited));
  control.stop(true);
  await server.stop();
  rmSync(base, { recursive: true, force: true });
  rmSync(SYNC_STATE_FILE, { force: true });
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
