import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { loadOrCreateToken } from "./auth";
import { kiboHome } from "./paths";
import { startServer } from "./server";
import { createService } from "./service";
import { openStore } from "./store";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4317" },
    ui: { type: "string" },
    dev: { type: "boolean", default: false },
  },
});
const home = kiboHome();
const store = openStore(home);
const token = loadOrCreateToken(home);
const server = startServer({
  service: createService(store, { user: userInfo().username }),
  token,
  port: Number(values.port),
  uiDir: values.ui ?? null,
  extraOrigins: values.dev ? ["http://localhost:5173"] : [],
});
const shutdown = () => {
  server.stop();
  store.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdout.write(`KIBO_READY ${server.url}/#pair=${token}\n`);
