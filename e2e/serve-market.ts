import { rmSync, writeFileSync } from "node:fs";
import { keyFingerprint, sha256Hex, toBase64, utf8 } from "@kibo/trust";
import { generateKeyPair, makeTestPackage, type TestPackage } from "@kibo/trust/testing";
import { type FakeMarket, startFakeMarket } from "../packages/daemon/src/testing/fake-market";
import { MARKET_PORTS, MARKET_REVOKE_REASON, MARKET_STATE_FILE, type MarketE2eState } from "./market-fixture";

const THEMES = ["dark", "light"] as const;
type Theme = (typeof THEMES)[number];

const first = await makeTestPackage({ id: "burndown", version: "0.1.0", title: "Burndown" });
const next = await makeTestPackage({
  id: "burndown",
  version: "0.2.0",
  title: "Burndown",
  publisher: first.publisher,
  manifest: { changes: ["Ligne idéale"] },
});
const rekeyed = await makeTestPackage({
  id: "burndown",
  version: "0.3.0",
  title: "Burndown",
  publisher: { name: "Léa", keys: await generateKeyPair() },
  manifest: { changes: ["Nouvelle clé d'éditeur"] },
});

const velocity = await makeTestPackage({ id: "velocity", version: "0.1.0", title: "Vélocité" });

async function altered(made: TestPackage): Promise<Uint8Array> {
  const [head, ...rest] = made.pkg.files;
  if (!head) throw new Error("fixture has no file");
  const content = utf8("export function Component() {\n  return null;\n}\n");
  const file = { ...head, content: toBase64(content), sha256: await sha256Hex(content) };
  return utf8(JSON.stringify({ ...made.pkg, files: [file, ...rest] }));
}

const actions: Record<string, (market: FakeMarket) => Promise<void>> = {
  "publish-next": (market) => market.publish(next.bytes),
  "publish-rekeyed": (market) => market.publish(rekeyed.bytes),
  "revoke-rekeyed": (market) => market.revoke(rekeyed.pkg.hash, MARKET_REVOKE_REASON),
};

const markets = new Map<Theme, FakeMarket>();
const state: Partial<MarketE2eState> = {};
for (const theme of THEMES) {
  const market = await startFakeMarket({ id: "equipe", name: "Équipe", verified: true });
  await market.publish(first.bytes);
  await market.publish(velocity.bytes);
  market.tamper("packages/velocity/0.1.0.kpkg", await altered(velocity));
  markets.set(theme, market);
  state[theme] = { market: market.url, fingerprint: await keyFingerprint(market.publicKey) };
}
writeFileSync(MARKET_STATE_FILE, JSON.stringify(state));

const daemons = THEMES.map((theme) =>
  Bun.spawn(["bun", "serve.ts", String(MARKET_PORTS[theme]), "question"], {
    cwd: import.meta.dir,
    env: { ...process.env, KIBO_MARKET_ALLOW_LOOPBACK: "1" },
    stdout: "inherit",
    stderr: "inherit",
  }),
);

const control = Bun.serve({
  hostname: "127.0.0.1",
  port: MARKET_PORTS.control,
  async fetch(req) {
    const [segment, name] = new URL(req.url).pathname.slice(1).split("/");
    if (req.method === "GET" && !segment) return new Response("ok");
    const theme = THEMES.find((t) => t === segment);
    const market = theme ? markets.get(theme) : undefined;
    const action = name ? actions[name] : undefined;
    if (req.method !== "POST" || !market || !action) return new Response("not found", { status: 404 });
    await action(market);
    return new Response(String(market.serial()));
  },
});

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  for (const d of daemons) d.kill("SIGTERM");
  await Promise.all(daemons.map((d) => d.exited));
  control.stop(true);
  for (const m of markets.values()) m.stop();
  rmSync(MARKET_STATE_FILE, { force: true });
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
