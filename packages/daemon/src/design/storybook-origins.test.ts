import { expect, mock, test } from "bun:test";
import { STORYBOOK_DEFAULTS, type StorybookSettings, type Worktree } from "@kibo/schema";
import { createStorybookOrigins, type StorybookOriginsDeps } from "./storybook-origins";

const MAIN: Worktree = { path: "/repo", branch: "main", head: "a", isMain: true };
const FEAT: Worktree = { path: "/wt/feat-x", branch: "feat/x", head: "b", isMain: false };
const DETACHED: Worktree = { path: "/wt/detached", branch: null, head: "c", isMain: false };
const BARE: Worktree = { path: "/wt/no-env", branch: "chore/y", head: "d", isMain: false };

function setup(
  opts: {
    settings?: StorybookSettings;
    folder?: string | null;
    worktrees?: Worktree[];
    ports?: Record<string, number>;
    down?: string[];
  } = {},
) {
  const probe = mock(async (origin: string) => !(opts.down ?? []).includes(origin));
  const envPort = mock((dir: string, _name: string) => opts.ports?.[dir] ?? null);
  const worktrees = mock(async (_folder: string) => opts.worktrees ?? [MAIN, FEAT]);
  const logged: string[] = [];
  const deps: StorybookOriginsDeps = {
    settings: () => opts.settings ?? STORYBOOK_DEFAULTS,
    folder: () => (opts.folder === undefined ? "/repo" : opts.folder),
    worktrees,
    envPort,
    client: { probe },
    log: (m) => logged.push(m),
  };
  return { origins: createStorybookOrigins(deps), probe, envPort, worktrees, logged };
}

test("without settings the default origin is accepted, any other refused", async () => {
  const { origins } = setup({ worktrees: [MAIN] });
  await origins.assertAllowed("p1", "http://localhost:6006");
  await expect(origins.assertAllowed("p1", "http://localhost:6007")).rejects.toThrow(
    "storybook origin http://localhost:6007 is not declared in the project",
  );
  await expect(origins.assertAllowed("p1", "https://sb.example.com")).rejects.toThrow("INVALID_INPUT");
});

test("a configured https origin replaces the default", async () => {
  const { origins } = setup({ settings: { origin: "https://sb.example.com", portEnv: "STORYBOOK_PORT" } });
  await origins.assertAllowed("p1", "https://sb.example.com");
  await expect(origins.assertAllowed("p1", "http://localhost:6006")).rejects.toThrow("INVALID_INPUT");
});

test("a worktree defining the port variable is listed and accepted", async () => {
  const { origins, envPort } = setup({ ports: { "/wt/feat-x": 6007 } });
  await origins.assertAllowed("p1", "http://localhost:6007");
  expect(await origins.list("p1")).toEqual([
    { label: "Projet", origin: "http://localhost:6006", branch: null, path: null, reachable: true },
    {
      label: "feat/x",
      origin: "http://localhost:6007",
      branch: "feat/x",
      path: "/wt/feat-x",
      reachable: true,
    },
  ]);
  expect(envPort.mock.calls).toContainEqual(["/wt/feat-x", "STORYBOOK_PORT"]);
});

test("the main worktree is never listed nor read, worktrees keep the git order", async () => {
  const { origins, envPort } = setup({
    worktrees: [MAIN, DETACHED, BARE, FEAT],
    ports: { "/repo": 6010, "/wt/detached": 6011, "/wt/feat-x": 6007 },
  });
  const list = await origins.list("p1");
  expect(list.map((o) => [o.label, o.origin])).toEqual([
    ["Projet", "http://localhost:6006"],
    ["detached", "http://localhost:6011"],
    ["feat/x", "http://localhost:6007"],
  ]);
  expect(envPort.mock.calls.map(([dir]) => dir)).not.toContain("/repo");
  await expect(origins.assertAllowed("p1", "http://localhost:6010")).rejects.toThrow("INVALID_INPUT");
});

test("the configured host is reused for worktree origins", async () => {
  const { origins } = setup({
    settings: { origin: "http://127.0.0.1:6006", portEnv: "SB_PORT" },
    ports: { "/wt/feat-x": 6007 },
  });
  expect((await origins.list("p1")).map((o) => o.origin)).toEqual([
    "http://127.0.0.1:6006",
    "http://127.0.0.1:6007",
  ]);
  await expect(origins.assertAllowed("p1", "http://localhost:6007")).rejects.toThrow("INVALID_INPUT");
});

test("a project without a local folder lists only its configured origin", async () => {
  const { origins, worktrees } = setup({ folder: null, ports: { "/wt/feat-x": 6007 } });
  expect((await origins.list("p1")).map((o) => o.label)).toEqual(["Projet"]);
  expect(worktrees).not.toHaveBeenCalled();
});

test("an origin that is down is listed unreachable without failing the list", async () => {
  const { origins } = setup({ ports: { "/wt/feat-x": 6007 }, down: ["http://localhost:6007"] });
  expect((await origins.list("p1")).map((o) => o.reachable)).toEqual([true, false]);
});

test("origins are compared normalized", async () => {
  const { origins } = setup({
    settings: { origin: "https://SB.example.com:443", portEnv: "STORYBOOK_PORT" },
  });
  await origins.assertAllowed("p1", "https://sb.example.com");
});

test("a duplicated origin is listed once", async () => {
  const { origins } = setup({ ports: { "/wt/feat-x": 6006 } });
  expect((await origins.list("p1")).map((o) => o.label)).toEqual(["Projet"]);
});

test("an unreadable env file skips that worktree and is logged", async () => {
  const { origins, envPort, logged } = setup({
    worktrees: [MAIN, BARE, FEAT],
    ports: { "/wt/feat-x": 6007 },
  });
  envPort.mockImplementationOnce(() => {
    throw new Error("EACCES");
  });
  expect((await origins.list("p1")).map((o) => o.label)).toEqual(["Projet", "feat/x"]);
  expect(logged[0]).toContain("/wt/no-env");
});

test("probes run in parallel", async () => {
  const { origins, probe } = setup({
    worktrees: [MAIN, FEAT, BARE],
    ports: { "/wt/feat-x": 6007, "/wt/no-env": 6008 },
  });
  const pending: (() => void)[] = [];
  probe.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        pending.push(() => resolve(true));
      }),
  );
  const list = origins.list("p1");
  for (let i = 0; i < 10 && pending.length < 3; i++) await Promise.resolve();
  expect(pending).toHaveLength(3);
  for (const release of pending) release();
  expect(await list).toHaveLength(3);
});

test("a failing git worktree list keeps the configured origin and is logged", async () => {
  const { origins, worktrees, logged } = setup();
  worktrees.mockImplementation(async () => {
    throw new Error("git exploded");
  });
  await origins.assertAllowed("p1", "http://localhost:6006");
  expect((await origins.list("p1")).map((o) => o.label)).toEqual(["Projet"]);
  expect(logged[0]).toContain("/repo");
});
