import { basename } from "node:path";

const args = process.argv.slice(2);
if (args[0] === "component-runtime") {
  const { startComponentRuntime } = await import("../../../packages/daemon/src/component-runtime");
  await startComponentRuntime();
} else if (args[0] === "component" || basename(process.argv0) === "kibo") {
  const { cliIo, runCli } = await import("../../../packages/cli/src/index");
  process.exit(await runCli(args, cliIo()));
} else {
  await import("../../../packages/daemon/src/main");
}
