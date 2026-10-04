import { readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { resolveToolchain } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";
import { createLoadSampler, fixedLoadSampler } from "./agents/host-load";
import { stdoutNotifier } from "./agents/notifier";
import { sandboxPortFor } from "./components/daemon-info";
import { cliStatus, installCli } from "./components/install-cli";
import { startDaemon } from "./daemon";
import { parseIntegrationFlags } from "./integrations/bootstrap";
import { createRedactor, installConsoleRedaction } from "./integrations/redact";
import { createLogBuffer } from "./log-buffer";
import { kiboHome } from "./paths";
import { DaemonRunning } from "./single-instance";
import { fatalLine, REUSED_EXIT_CODE, reuseLines } from "./startup-lines";

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
    "test-origins": { type: "string" },
    "memory-secrets": { type: "boolean", default: false },
  },
});
const port = Number(values.port);
const native = process.env.KIBO_NATIVE_NOTIFY === "1";
const home = kiboHome();
const detailOf = (e: unknown) =>
  e instanceof KiboError ? e.detail : e instanceof Error ? e.message : String(e);
const fatal = (e: unknown): never => {
  process.stdout.write(fatalLine(e));
  process.stderr.write(`[kibo-daemon] cannot start: ${detailOf(e)}\n`);
  process.exit(1);
};
const readToken = (): string => {
  try {
    return readFileSync(join(home, "token"), "utf8").trim();
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `token file missing while a daemon is running: ${detailOf(e)}`);
  }
};
const failStart = (e: unknown): never => {
  if (!(e instanceof DaemonRunning && e.running.answers)) return fatal(e);
  let token: string;
  try {
    token = readToken();
  } catch (tokenError) {
    return fatal(tokenError);
  }
  process.stdout.write(reuseLines(e.running, token));
  process.exit(REUSED_EXIT_CODE);
};
const logBuffer = createLogBuffer();
logBuffer.install(console);
const redactor = createRedactor();
installConsoleRedaction(redactor);
const daemon = await Promise.resolve()
  .then(() =>
    startDaemon({
      home,
      port,
      sandboxPort: sandboxPortFor(port, values["sandbox-port"]),
      uiDir: values.ui ?? null,
      dev: values.dev,
      toolchain: resolveToolchain({ explicit: values.toolchain ?? null }),
      user: userInfo().username,
      notifications: native ? "native" : "browser",
      notify: native ? stdoutNotifier((line) => process.stdout.write(line)) : () => {},
      claudeBin: values["claude-bin"] ?? null,
      sampler:
        values["host-load"] === undefined ? createLoadSampler() : fixedLoadSampler(values["host-load"]),
      installCli: () => installCli(),
      cliStatus: () => cliStatus(),
      integrations: parseIntegrationFlags(values),
      redactor,
      logBuffer,
      marketAllowLoopback: process.env.KIBO_MARKET_ALLOW_LOOPBACK === "1",
    }),
  )
  .catch(failStart);

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
process.stdout.write(`KIBO_SANDBOX http://127.0.0.1:${daemon.sandboxPort}\n`);
