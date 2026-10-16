import { chmodSync, copyFileSync, cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { FAKE_FIGMA_IMAGE_HOST, startFakeFigma } from "../packages/daemon/src/testing/fake-figma";
import { LOGS_HOST, startFakeGithub } from "../packages/daemon/src/testing/fake-github";
import { startFakeMcpHttp } from "../packages/daemon/src/testing/fake-mcp";
import { PENPOT_IDS, startFakePenpot } from "../packages/daemon/src/testing/fake-penpot";
import { startFakeStorybook } from "../packages/daemon/src/testing/fake-storybook";
import { e2eHome } from "./e2e-home";
import { fakeGhDir, GIT_IDENTITY } from "./git-repo";
import { EMIS_MAQUETTES, FIXED_NOW } from "./pixel-settings";
import { connectSeedRpc, waitForDaemon } from "./seed-client";
import { seedEmisMaquettes } from "./seed-emis-maquettes";
import {
  E2E_FIGMA_TOKEN,
  E2E_GH_TOKEN,
  E2E_PENPOT_TOKEN,
  E2E_TOKEN,
  fakeBranchStorybookPort,
  fakeFigmaPort,
  fakeGithubPort,
  fakeMcpPort,
  fakePenpotPort,
  fakeStorybookPort,
} from "./token";

const root = resolve(import.meta.dir, "..");
const INTEGRATIONS_FLAG = "--integrations";
const NO_GH_FLAG = "--no-gh";
const DESIGN_FLAG = "--design";
const EMBEDS_FLAG = "--embeds";
const DELIVERY_FLAG = "--delivery";
const FLAGS = [INTEGRATIONS_FLAG, NO_GH_FLAG, DESIGN_FLAG, EMBEDS_FLAG, DELIVERY_FLAG];
const argv = process.argv.slice(2);
const integrations = argv.includes(INTEGRATIONS_FLAG);
const design = argv.includes(DESIGN_FLAG);
const embeds = argv.includes(EMBEDS_FLAG);
const delivery = argv.includes(DELIVERY_FLAG);
const withGh = !argv.includes(NO_GH_FLAG);
const [port = "4390", scenario = "question", ...drafts] = argv.filter((a) => !FLAGS.includes(a));
const home = e2eHome(port);
rmSync(home, { recursive: true, force: true });
mkdirSync(home, { recursive: true, mode: 0o700 });
writeFileSync(join(home, "token"), `${E2E_TOKEN}\n`, { mode: 0o600 });
const claudeConfig = join(home, "claude");
const fakeState = join(claudeConfig, "projects");
mkdirSync(fakeState, { recursive: true });
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
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.bare, { name: "Brouillon", mediaId: null });
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
function startStorybook(storybookPort: number) {
  const storybook = startFakeStorybook({ port: storybookPort });
  storybook.addStory("screens-home--default", "Screens", "Home");
  storybook.addStory("screens-login--default", "Screens", "Login");
  return storybook;
}
function startEmbedFakes() {
  const storybook = startStorybook(fakeStorybookPort(Number(port)));
  const branch = startStorybook(fakeBranchStorybookPort(Number(port)));
  const penpot = startFakePenpot({ token: E2E_PENPOT_TOKEN, port: fakePenpotPort(Number(port)) });
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board, {
    name: "Accueil",
    width: 1440,
    height: 900,
  });
  return {
    args: ["--test-origins", `design.penpot.app=${penpot.url}`, "--memory-secrets"],
    stop: async () => {
      storybook.stop();
      branch.stop();
      penpot.stop();
    },
  };
}
const deliveryEnv = () => ({
  HOME: home,
  KIBO_CLI: join(root, "packages/cli/src/bin.ts"),
  DELIVERY_SLOTS: join(home, "slots"),
  DELIVERY_REGISTRY: join(home, "registry.json"),
});
function startFakesFor() {
  if (integrations) return startFakes();
  if (design) return startDesignFakes();
  if (embeds) return startEmbedFakes();
  return null;
}
const fakes = await startFakesFor();
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
      CLAUDE_CONFIG_DIR: claudeConfig,
      KIBO_GH: gh,
      FAKE_GH_STATE: join(ghDir, "state.json"),
      FAKE_GH_LOG: join(ghDir, "log.jsonl"),
      ...(delivery ? deliveryEnv() : {}),
      ...(scenario === EMIS_MAQUETTES ? { KIBO_FIXED_NOW: FIXED_NOW } : {}),
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
const forward = (signal: NodeJS.Signals) => () => proc.kill(signal);
process.on("SIGTERM", forward("SIGTERM"));
process.on("SIGINT", forward("SIGINT"));
async function seedScenario(): Promise<void> {
  if (scenario !== EMIS_MAQUETTES) return;
  const base = `http://127.0.0.1:${port}`;
  await waitForDaemon(base, 30_000);
  await seedEmisMaquettes(await connectSeedRpc(base, E2E_TOKEN));
}
const seeded = await seedScenario().then(
  () => true,
  (error: unknown) => {
    console.error(`seed ${scenario} failed:`, error);
    proc.kill("SIGTERM");
    return false;
  },
);
const exited = await proc.exited;
const code = seeded ? exited : 1;
await fakes?.stop();
rmSync(home, { recursive: true, force: true });
rmSync(ghDir, { recursive: true, force: true });
process.exit(code);
