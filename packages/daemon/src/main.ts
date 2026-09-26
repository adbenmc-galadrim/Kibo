import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { defaultHookLauncher } from "./agents/hook-launcher";
import { createLoadSampler, readHostInfo } from "./agents/host-load";
import { stdoutNotifier } from "./agents/notifier";
import { createOrchestrator, type Orchestrator } from "./agents/orchestrator";
import { openRunStore } from "./agents/run-store";
import { loadOrCreateToken } from "./auth";
import { kiboHome } from "./paths";
import { startServer } from "./server";
import { createService } from "./service";
import { openStore } from "./store";

const parentPid = process.ppid;
const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4317" },
    ui: { type: "string" },
    dev: { type: "boolean", default: false },
    "claude-bin": { type: "string" },
  },
});
const home = kiboHome();
const store = openStore(home);
const runs = openRunStore(home);
const token = loadOrCreateToken(home);
const native = process.env.KIBO_NATIVE_NOTIFY === "1";
const service = createService(store, {
  user: userInfo().username,
  notifications: native ? "native" : "browser",
});
let agents: Orchestrator | null = null;
const server = startServer({
  service,
  token,
  port: Number(values.port),
  uiDir: values.ui ?? null,
  extraOrigins: values.dev ? ["http://localhost:5173"] : [],
  hooks: {
    verify: (runId, runToken) => agents?.hooks.verify(runId, runToken) ?? false,
    receive: (runId, payload, toolInput) => agents?.hooks.receive(runId, payload, toolInput) ?? null,
  },
});
const orchestrator = createOrchestrator({
  home,
  store: runs,
  data: service.agentData,
  claudeBin: values["claude-bin"] ?? null,
  hook: defaultHookLauncher(),
  baseUrl: () => server.url,
  sampler: createLoadSampler(),
  hostInfo: readHostInfo(),
  notify: native ? stdoutNotifier((line) => process.stdout.write(line)) : () => {},
});
agents = orchestrator;
service.attachAgents(orchestrator);

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  server.stop();
  try {
    await orchestrator.stop();
  } finally {
    runs.close();
    store.close();
  }
  process.exit(0);
};
const stop = () => {
  shutdown().catch((e) => {
    console.error("[kibo-daemon] shutdown failed", e);
    process.exit(1);
  });
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {
  if (process.ppid !== parentPid) stop();
}, 2000).unref();
process.stdout.write(`KIBO_READY ${server.url}/#pair=${token}\n`);
