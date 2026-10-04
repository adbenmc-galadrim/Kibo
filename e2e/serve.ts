import { chmodSync, copyFileSync, cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { FAKE_FIGMA_IMAGE_HOST, startFakeFigma } from "../packages/daemon/src/testing/fake-figma";
import { LOGS_HOST, startFakeGithub } from "../packages/daemon/src/testing/fake-github";
import { startFakeMcpHttp } from "../packages/daemon/src/testing/fake-mcp";
import { PENPOT_IDS, startFakePenpot } from "../packages/daemon/src/testing/fake-penpot";
import { e2eHome } from "./e2e-home";
import { fakeGhDir, GIT_IDENTITY } from "./git-repo";
import {
  E2E_FIGMA_TOKEN,
  E2E_GH_TOKEN,
  E2E_PENPOT_TOKEN,
  E2E_TOKEN,
  fakeFigmaPort,
  fakeGithubPort,
  fakeMcpPort,
  fakePenpotPort,
} from "./token";

const root = resolve(import.meta.dir, "..");
const INTEGRATIONS_FLAG = "--integrations";
const NO_GH_FLAG = "--no-gh";
const DESIGN_FLAG = "--design";
const FLAGS = [INTEGRATIONS_FLAG, NO_GH_FLAG, DESIGN_FLAG];
const argv = process.argv.slice(2);
const integrations = argv.includes(INTEGRATIONS_FLAG);
const design = argv.includes(DESIGN_FLAG);
const withGh = !argv.includes(NO_GH_FLAG);
const [port = "4390", scenario = "question", ...drafts] = argv.filter((a) => !FLAGS.includes(a));
const home = e2eHome(port);
rmSync(home, { recursive: true, force: true });
mkdirSync(home, { recursive: true, mode: 0o700 });
writeFileSync(join(home, "token"), `${E2E_TOKEN}\n`, { mode: 0o600 });
const fakeState = join(home, "fake-claude");
mkdirSync(fakeState);
for (const draft of drafts) {
  const dir = join(home, "components", "src", draft);
  cpSync(join(import.meta.dir, "fixtures", "components", draft), dir, { recursive: true });
  renameSync(join(dir, "component.test.tsx.fixture"), join(dir, "component.test.tsx"));
}
const agents = join(root, "packages/daemon/src/agents");
const ghDir = fakeGhDir(port);
rmSync(ghDir, { recursive: true, force: true });
mkdirSync(ghDir, { recursive: true });
const gh = join(ghDir, "gh");
if (withGh) {
  copyFileSync(join(root, "packages/daemon/src/code/testing/fake-gh.ts"), gh);
  chmodSync(gh, 0o755);
}
async function startFakes() {
  const github = startFakeGithub({ token: E2E_GH_TOKEN, port: fakeGithubPort(Number(port)) });
  github.addRepo("adam/kibo");
  const mcp = await startFakeMcpHttp({ port: fakeMcpPort(Number(port)) });
  return {
    args: ["--test-origins", `api.github.com=${github.url},${LOGS_HOST}=${github.url}`, "--memory-secrets"],
    stop: async () => {
      github.stop();
      await mcp.stop();
    },
  };
}
function startDesignFakes() {
  const figma = startFakeFigma({ token: E2E_FIGMA_TOKEN, port: fakeFigmaPort(Number(port)) });
  figma.addFile("AbC123xyz", "Kibo");
  figma.addNode("AbC123xyz", "12:34", { name: "Tickets", width: 1440, height: 900 });
  const penpot = startFakePenpot({ token: E2E_PENPOT_TOKEN, port: fakePenpotPort(Number(port)) });
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board, {
    name: "Accueil",
    width: 1440,
    height: 900,
  });
  return {
    args: [
      "--test-origins",
      `api.figma.com=${figma.url},${FAKE_FIGMA_IMAGE_HOST}=${figma.url}`,
      "--memory-secrets",
    ],
    stop: async () => {
      figma.stop();
      penpot.stop();
    },
  };
}
const fakes = integrations ? await startFakes() : design ? startDesignFakes() : null;
const proc = Bun.spawn(
  [
    "bun",
    join(root, "packages/daemon/src/main.ts"),
    "--port",
    port,
    "--sandbox-port",
    "0",
    "--ui",
    join(root, "packages/ui/dist"),
    "--claude-bin",
    join(agents, "fake-claude.ts"),
    "--host-load",
    "62,70",
    ...(fakes?.args ?? []),
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
await fakes?.stop();
rmSync(home, { recursive: true, force: true });
rmSync(ghDir, { recursive: true, force: true });
process.exit(code);
