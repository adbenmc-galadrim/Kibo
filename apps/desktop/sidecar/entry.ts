import { basename } from "node:path";

const args = process.argv.slice(2);
if (basename(process.argv0) === "kibo") {
  const { cliIo, runCli } = await import("../../../packages/cli/src/index");
  process.exit(await runCli(args, cliIo()));
} else {
  await import("../../../packages/daemon/src/main");
}
