import { KiboError } from "@kibo/schema";
import { parseOptions } from "./options";
import { startRemoteServer } from "./server";

function optionsOrExit() {
  try {
    return parseOptions(Bun.argv.slice(2), process.env);
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    console.error(`[kibo-remote] ${e.detail}`);
    process.exit(1);
  }
}

const server = await startRemoteServer(optionsOrExit());
console.log(`[kibo-remote] listening on port ${server.port}`);

const shutdown = async () => {
  await server.stop();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
