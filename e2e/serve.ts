import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fakeGhDir, GIT_IDENTITY } from "./git-repo";
import { E2E_TOKEN } from "./token";

const home = mkdtempSync(join(tmpdir(), "kibo-e2e-"));
writeFileSync(join(home, "token"), `${E2E_TOKEN}\n`, { mode: 0o600 });
const fakeState = join(home, "fake-claude");
mkdirSync(fakeState);
const root = resolve(import.meta.dir, "..");
const [port = "4390", scenario = "question"] = process.argv.slice(2);
const agents = join(root, "packages/daemon/src/agents");
const ghDir = fakeGhDir(port);
rmSync(ghDir, { recursive: true, force: true });
mkdirSync(ghDir, { recursive: true });
const gh = join(ghDir, "gh");
copyFileSync(join(root, "packages/daemon/src/code/testing/fake-gh.ts"), gh);
chmodSync(gh, 0o755);
const proc = Bun.spawn(
  [
    "bun",
    join(root, "packages/daemon/src/main.ts"),
    "--port",
    port,
    "--ui",
    join(root, "packages/ui/dist"),
    "--claude-bin",
    join(agents, "fake-claude.ts"),
    "--host-load",
    "62,70",
  ],
  {
    env: {
      ...process.env,
      ...GIT_IDENTITY,
      KIBO_HOME: home,
      KIBO_FAKE_CLAUDE_SCENARIO: join(agents, "scenarios", `${scenario}.json`),
      KIBO_FAKE_CLAUDE_STATE: fakeState,
      KIBO_GH: gh,
      FAKE_GH_STATE: join(ghDir, "state.json"),
      FAKE_GH_LOG: join(ghDir, "log.jsonl"),
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
const forward = (signal: NodeJS.Signals) => () => proc.kill(signal);
process.on("SIGTERM", forward("SIGTERM"));
process.on("SIGINT", forward("SIGINT"));
const code = await proc.exited;
rmSync(home, { recursive: true, force: true });
rmSync(ghDir, { recursive: true, force: true });
process.exit(code);
