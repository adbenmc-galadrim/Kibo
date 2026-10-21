import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { startTestSyncServer, type TestSyncServer } from "@kibo/sync-server/testing";
import { FAKE_FIGMA_IMAGE_HOST, startFakeFigma } from "../packages/daemon/src/testing/fake-figma";
import { LOGS_HOST, startFakeGithub } from "../packages/daemon/src/testing/fake-github";
import { startFakeMcpHttp } from "../packages/daemon/src/testing/fake-mcp";
import { PENPOT_IDS, startFakePenpot } from "../packages/daemon/src/testing/fake-penpot";
import { startFakeStorybook } from "../packages/daemon/src/testing/fake-storybook";
import { e2eHome } from "./e2e-home";
import { SILO_APERCU_FRAME } from "./fixtures/silo-apercu";
import { siloGhState } from "./fixtures/silo-gh";
import { SILO_SCENARIO } from "./fixtures/silo-suivi";
import { createE2eRepo, fakeGhDir, GIT_IDENTITY } from "./git-repo";
import {
  FIXED_NOW,
  isSiloScenario,
  SILO_APERCU,
  SILO_ATTENTE,
  SILO_GRAPHE,
  SILO_PRS,
} from "./pixel-settings";
import { connectSeedRpc, waitForDaemon } from "./seed-client";
import { seedSiloApercu } from "./seed-silo-apercu";
import { seedSiloAttente } from "./seed-silo-attente";
import { seedSiloGraphe } from "./seed-silo-graphe";
import { seedSiloMaquettes } from "./seed-silo-maquettes";
import { seedSiloPrs, siloPrsGhState } from "./seed-silo-prs";
import { type SyncSeed, shareSilo } from "./seed-silo-sync";
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
  seedReadyPort,
} from "./token";

const root = resolve(import.meta.dir, "..");
const INTEGRATIONS_FLAG = "--integrations";
const NO_GH_FLAG = "--no-gh";
const DESIGN_FLAG = "--design";
const EMBEDS_FLAG = "--embeds";
const SILO_PR_POLL_MS = "200";
const AGENT_SCENARIO_FLAG = "--agent-scenario";
const ANSWER_GRACE_FLAG = "--answer-wake-grace-ms";
const FLAGS = [INTEGRATIONS_FLAG, NO_GH_FLAG, DESIGN_FLAG, EMBEDS_FLAG];
const VALUE_FLAGS = [AGENT_SCENARIO_FLAG, ANSWER_GRACE_FLAG];
const rawArgv = process.argv.slice(2);
const flagValue = (flag: string): string | null => {
  const at = rawArgv.indexOf(flag);
  return at < 0 ? null : (rawArgv[at + 1] ?? null);
};
const argv = rawArgv.filter(
  (a, i) => !VALUE_FLAGS.includes(a) && !VALUE_FLAGS.includes(rawArgv[i - 1] ?? ""),
);
const agentScenario = flagValue(AGENT_SCENARIO_FLAG);
const answerGrace = flagValue(ANSWER_GRACE_FLAG);
const integrations = argv.includes(INTEGRATIONS_FLAG);
const design = argv.includes(DESIGN_FLAG);
const embeds = argv.includes(EMBEDS_FLAG);
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
const siloScenario = isSiloScenario(scenario);
const e2eScenario = join(import.meta.dir, "agents", "scenarios", `${scenario}.json`);
function scenarioFile(): string {
  if (agentScenario !== null) return join(import.meta.dir, "agents", "scenarios", `${agentScenario}.json`);
  if (siloScenario) return SILO_SCENARIO;
  return existsSync(e2eScenario) ? e2eScenario : join(agents, "scenarios", `${scenario}.json`);
}
const ghDir = fakeGhDir(port);
rmSync(ghDir, { recursive: true, force: true });
mkdirSync(ghDir, { recursive: true });
const gh = join(ghDir, "gh");
const ghState = join(ghDir, "state.json");
const siloGh = { merged: false, stateOf: siloGhState };
const writeSiloGh = () => {
  writeFileSync(`${ghState}.next`, JSON.stringify(siloGh.stateOf({ merged: siloGh.merged })));
  renameSync(`${ghState}.next`, ghState);
};
const mergeSiloPr = () => {
  siloGh.merged = true;
  writeSiloGh();
};
const stackSiloPrs = () => {
  siloGh.stateOf = siloPrsGhState;
  writeSiloGh();
};
if (siloScenario) writeSiloGh();
const siloRepo = siloScenario ? createE2eRepo("silo") : null;
if (withGh) {
  copyFileSync(join(root, "packages/daemon/src/code/testing/fake-gh.ts"), gh);
  chmodSync(gh, 0o755);
}
type Fakes = { origins: string[]; stop(): void | Promise<void> };
async function startFakes(): Promise<Fakes> {
  const github = startFakeGithub({ token: E2E_GH_TOKEN, port: fakeGithubPort(Number(port)) });
  github.addRepo("adam/kibo");
  const mcp = await startFakeMcpHttp({ port: fakeMcpPort(Number(port)) });
  return {
    origins: [`api.github.com=${github.url}`, `${LOGS_HOST}=${github.url}`],
    stop: async () => {
      github.stop();
      await mcp.stop();
    },
  };
}
function startDesignFakes(): Fakes {
  const figma = startFakeFigma({ token: E2E_FIGMA_TOKEN, port: fakeFigmaPort(Number(port)) });
  figma.addFile("AbC123xyz", "Kibo");
  figma.addNode("AbC123xyz", "12:34", { name: "Tickets", width: 1440, height: 900 });
  const { fileKey, nodeId, name, width, height } = SILO_APERCU_FRAME;
  const png = Uint8Array.from(readFileSync(join(root, SILO_APERCU_FRAME.png)));
  figma.addNode(fileKey, nodeId, { name, width, height, png });
  const penpot = startFakePenpot({ token: E2E_PENPOT_TOKEN, port: fakePenpotPort(Number(port)) });
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board, {
    name: "Accueil",
    width: 1440,
    height: 900,
  });
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.bare, { name: "Brouillon", mediaId: null });
  return {
    origins: [`api.figma.com=${figma.url}`, `${FAKE_FIGMA_IMAGE_HOST}=${figma.url}`],
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
function startEmbedFakes(): Fakes {
  const storybook = startStorybook(fakeStorybookPort(Number(port)));
  const branch = startStorybook(fakeBranchStorybookPort(Number(port)));
  const penpot = startFakePenpot({ token: E2E_PENPOT_TOKEN, port: fakePenpotPort(Number(port)) });
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board, {
    name: "Accueil",
    width: 1440,
    height: 900,
  });
  return {
    origins: [`design.penpot.app=${penpot.url}`],
    stop: async () => {
      storybook.stop();
      branch.stop();
      penpot.stop();
    },
  };
}
async function startFakesFor(): Promise<Fakes[]> {
  const started = integrations ? [await startFakes()] : [];
  if (design) started.push(startDesignFakes());
  if (embeds) started.push(startEmbedFakes());
  return started;
}
const fakes = await startFakesFor();
const origins = fakes.flatMap((f) => f.origins);
const fakeArgs = origins.length === 0 ? [] : ["--test-origins", origins.join(","), "--memory-secrets"];
const syncServer: TestSyncServer | null = siloScenario
  ? await startTestSyncServer({ dataDir: join(home, "sync-server") })
  : null;
async function syncSeed(server: TestSyncServer): Promise<SyncSeed> {
  const caFile = join(home, "sync-ca.pem");
  writeFileSync(caFile, server.caPem, { mode: 0o600 });
  return { serverUrl: server.url, code: await server.inviteAccount("Adam"), caFile };
}
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
    ...fakeArgs,
    ...(answerGrace === null ? [] : [ANSWER_GRACE_FLAG, answerGrace]),
  ],
  {
    env: {
      ...process.env,
      ...GIT_IDENTITY,
      KIBO_HOME: home,
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioFile(),
      KIBO_FAKE_CLAUDE_STATE: fakeState,
      CLAUDE_CONFIG_DIR: claudeConfig,
      KIBO_GH: gh,
      FAKE_GH_STATE: ghState,
      FAKE_GH_LOG: join(ghDir, "log.jsonl"),
      ...(siloScenario ? { KIBO_FIXED_NOW: FIXED_NOW, KIBO_PR_POLL_MS: SILO_PR_POLL_MS } : {}),
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
const forward = (signal: NodeJS.Signals) => () => proc.kill(signal);
process.on("SIGTERM", forward("SIGTERM"));
process.on("SIGINT", forward("SIGINT"));
const SILO_SEEDS = new Map([
  [SILO_ATTENTE, seedSiloAttente],
  [SILO_PRS, seedSiloPrs],
  [SILO_APERCU, seedSiloApercu],
  [SILO_GRAPHE, seedSiloGraphe],
]);
async function seedScenario(): Promise<void> {
  if (!siloScenario) return;
  const base = `http://127.0.0.1:${port}`;
  await waitForDaemon(base, 30_000);
  const rpc = await connectSeedRpc(base, E2E_TOKEN);
  const seed = SILO_SEEDS.get(scenario) ?? seedSiloMaquettes;
  await seed(rpc, { folder: siloRepo?.repo ?? null, mergePr: mergeSiloPr, stackPrs: stackSiloPrs });
  if (syncServer) await shareSilo(rpc, await syncSeed(syncServer));
}
const seeded = await seedScenario().then(
  () => true,
  (error: unknown) => {
    console.error(`seed ${scenario} failed:`, error);
    proc.kill("SIGTERM");
    return false;
  },
);
function openReadyPort() {
  try {
    return Bun.serve({
      hostname: "127.0.0.1",
      port: seedReadyPort(Number(port)),
      fetch: () => new Response("seeded"),
    });
  } catch (error) {
    proc.kill("SIGTERM");
    throw error;
  }
}
const ready = seeded && siloScenario ? openReadyPort() : null;
const exited = await proc.exited;
ready?.stop(true);
const code = seeded ? exited : 1;
for (const f of fakes) await f.stop();
await syncServer?.stop();
rmSync(home, { recursive: true, force: true });
rmSync(ghDir, { recursive: true, force: true });
siloRepo?.remove();
process.exit(code);
