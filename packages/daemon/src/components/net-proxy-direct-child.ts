import { readFileSync } from "node:fs";
import { KiboError } from "@kibo/schema";
import { proxyFetch } from "./net-proxy";
import { createDirectTransport } from "./net-proxy-transport";

const [port = "", caPath = ""] = process.argv.slice(2);
const ca = readFileSync(caPath, "utf8");
const GET = { method: "GET" as const, headers: {} };
const local = { resolve: async () => ["127.0.0.1"], allowAddress: () => true };

async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "ok";
  } catch (error) {
    return error instanceof KiboError ? error.code : "error";
  }
}

const results = {
  globalFetch: await outcome(() => fetch(`https://127.0.0.1:${port}/echo`, { tls: { ca } })),
  trusted: await outcome(async () => {
    const res = await proxyFetch(null, `https://api.kibo.test:${port}/redirect`, GET, {
      ...local,
      transport: createDirectTransport({ ca }),
    });
    if (JSON.parse(res.body).path !== "/echo") throw new Error("unexpected body");
  }),
  defaultTransport: await outcome(() => proxyFetch(null, `https://api.kibo.test:${port}/echo`, GET, local)),
};
process.stdout.write(JSON.stringify(results));
