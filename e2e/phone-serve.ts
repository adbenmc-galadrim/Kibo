import { join, resolve } from "node:path";
import { startRemoteServer } from "@kibo/remote-server";
import { RpcRequest } from "../packages/schema/src/index";
import { startMacSwitch } from "./mac-switch";
import { PHONE_SERVERS, PHONE_SETUP_CODE, phoneOrigin } from "./phone-projects";
import { SILO_GRAPHE } from "./pixel-settings";
import { connectSeedRpc, waitForDaemon } from "./seed-client";
import { E2E_TOKEN, seedReadyPort } from "./token";

const root = resolve(import.meta.dir, "..");
const name = process.argv[2];
const config = PHONE_SERVERS.find((s) => s.name === name);
if (config === undefined) throw new Error(`unknown phone server ${name}`);

const SEED_TIMEOUT_MS = 170_000;
const PRESENCE_TIMEOUT_MS = 90_000;

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

const server = await startRemoteServer({
  port: config.serverPort,
  db: ":memory:",
  origin: phoneOrigin(config.serverPort),
  rpId: "localhost",
  setupCode: PHONE_SETUP_CODE,
  staticDir: join(root, "packages/phone/dist"),
  hostname: "127.0.0.1",
});
const mac = startMacSwitch({ port: config.macPort, target: server.url });

const daemon = Bun.spawn(["bun", "serve.ts", String(config.daemonPort), SILO_GRAPHE, "--integrations"], {
  cwd: import.meta.dir,
  env: { ...process.env, KIBO_REMOTE_URL: mac.url },
  stdout: "inherit",
  stderr: "inherit",
});

let stopping = false;
void daemon.exited.then((code) => {
  if (!stopping) process.exit(code === 0 ? 1 : code);
});

const shutdown = async () => {
  stopping = true;
  daemon.kill("SIGTERM");
  await daemon.exited;
  mac.stop();
  await server.stop();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await waitForDaemon(`http://127.0.0.1:${seedReadyPort(config.daemonPort)}`, SEED_TIMEOUT_MS);
const rpc = await connectSeedRpc(`http://127.0.0.1:${config.daemonPort}`, E2E_TOKEN);
const projects = await rpc({ method: "listProjects" });
const silo = Array.isArray(projects) ? projects.find((p) => field(p, "key") === "SILO") : undefined;
const siloId = field(silo, "id");
if (typeof siloId !== "string") throw new Error("the Silo project was not seeded");
await rpc({ method: "remote.enable", serverUrl: mac.url, setupCode: PHONE_SETUP_CODE });
await rpc({ method: "remote.setProjects", projectIds: [siloId] });

async function macOnline(): Promise<boolean> {
  const health = await fetch(`${server.url}/api/health`).then((r) => r.json());
  return field(health, "mac") === "online";
}

async function waitForMac(online: boolean): Promise<void> {
  const deadline = Date.now() + PRESENCE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if ((await macOnline()) === online) return;
    await Bun.sleep(100);
  }
  throw new Error(`the mac did not turn ${online ? "on" : "off"} within ${PRESENCE_TIMEOUT_MS} ms`);
}

await waitForMac(true);

const routes: Record<string, (req: Request) => Promise<Response>> = {
  "GET /ready": async () => new Response("ready"),
  "POST /rpc": async (req) => Response.json(await rpc(RpcRequest.parse(await req.json()))),
  "POST /pair": async () => Response.json(await rpc({ method: "remote.createPairing" })),
  "POST /mac/off": async () => {
    mac.off();
    await waitForMac(false);
    return Response.json({ online: false });
  },
  "POST /mac/stall": async () => {
    mac.stall();
    return Response.json({ stalled: true });
  },
  "POST /mac/on": async () => {
    mac.on();
    await waitForMac(true);
    return Response.json({ online: true });
  },
};

Bun.serve({
  hostname: "127.0.0.1",
  port: config.controlPort,
  idleTimeout: 120,
  fetch: (req) => {
    const route = routes[`${req.method} ${new URL(req.url).pathname}`];
    return route ? route(req) : new Response("not found", { status: 404 });
  },
});
console.log(`[phone-serve] ${config.name} ready on ${phoneOrigin(config.serverPort)}`);
