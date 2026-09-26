import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { resolveToolchain } from "@kibo/devkit";
import { createLoadSampler, fixedLoadSampler } from "./agents/host-load";
import { stdoutNotifier } from "./agents/notifier";
import { sandboxPortFor } from "./components/daemon-info";
import { startDaemon } from "./daemon";
import { kiboHome } from "./paths";

const parentPid = process.ppid;
const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4317" },
    "sandbox-port": { type: "string" },
    toolchain: { type: "string" },
    ui: { type: "string" },
    dev: { type: "boolean", default: false },
    "claude-bin": { type: "string" },
    "host-load": { type: "string" },
  },
});
const port = Number(values.port);
const native = process.env.KIBO_NATIVE_NOTIFY === "1";
const daemon = await startDaemon({
  home: kiboHome(),
  port,
  sandboxPort: sandboxPortFor(port, values["sandbox-port"]),
  uiDir: values.ui ?? null,
  dev: values.dev,
  toolchain: resolveToolchain({ explicit: values.toolchain ?? null }),
  user: userInfo().username,
  notifications: native ? "native" : "browser",
  notify: native ? stdoutNotifier((line) => process.stdout.write(line)) : () => {},
  claudeBin: values["claude-bin"] ?? null,
  sampler: values["host-load"] === undefined ? createLoadSampler() : fixedLoadSampler(values["host-load"]),
});

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  daemon.stop().then(
    () => process.exit(0),
    (e: unknown) => {
      console.error("[kibo-daemon] shutdown failed", e);
      process.exit(1);
    },
  );
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {
  if (process.ppid !== parentPid) stop();
}, 2000).unref();
process.stdout.write(`KIBO_READY ${daemon.url}/#pair=${daemon.token}\n`);
