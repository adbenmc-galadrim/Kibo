import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { E2E_TOKEN } from "./token";

const home = mkdtempSync(join(tmpdir(), "kibo-e2e-"));
writeFileSync(join(home, "token"), `${E2E_TOKEN}\n`, { mode: 0o600 });
const root = resolve(import.meta.dir, "..");
const proc = Bun.spawn(
  [
    "bun",
    join(root, "packages/daemon/src/main.ts"),
    "--port",
    "4390",
    "--ui",
    join(root, "packages/ui/dist"),
  ],
  { env: { ...process.env, KIBO_HOME: home }, stdout: "inherit", stderr: "inherit" },
);
const forward = (signal: NodeJS.Signals) => () => proc.kill(signal);
process.on("SIGTERM", forward("SIGTERM"));
process.on("SIGINT", forward("SIGINT"));
const code = await proc.exited;
rmSync(home, { recursive: true, force: true });
process.exit(code);
