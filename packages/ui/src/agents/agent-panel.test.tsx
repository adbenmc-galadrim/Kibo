import { beforeEach, expect, mock, test } from "bun:test";
import {
  type HookEventName,
  type HookPayload,
  KiboError,
  type RpcRequest,
  type RunEvent,
  type RunLogEntry,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, NOW } from "./fixtures";

const MIN = 60_000;
const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return outcome();
    },
  },
}));

const hook = (event: HookEventName, p: Partial<HookPayload>): HookPayload => ({
  event,
  sessionId: "s-r41",
  transcriptPath: null,
  tool: null,
  detail: null,
  question: null,
  agentId: null,
  ...p,
});

const LOG: RunLogEntry[] = [
  { id: 10, at: NOW - 8 * MIN, event: { type: "enqueued", rank: 1 } },
  { id: 11, at: NOW - 7 * MIN, event: { type: "admitted", lane: 2 } },
  {
    id: 1,
    at: NOW - 7 * MIN,
    event: { type: "spawned", pid: 42, resume: false, workspace: "worktree:kib-14", guidelines: 3 },
  },
  {
    id: 12,
    at: NOW - 7 * MIN,
    event: { type: "hook", payload: hook("SessionStart", { detail: "startup" }) },
  },
  {
    id: 2,
    at: NOW - 5 * MIN,
    event: {
      type: "hook",
      payload: hook("PreToolUse", { tool: "Write", detail: "apps/daemon/src/hooks/receiver.ts" }),
    },
  },
  {
    id: 3,
    at: NOW - 5 * MIN,
    event: {
      type: "hook",
      payload: hook("PostToolUse", { tool: "Write", detail: "apps/daemon/src/hooks/receiver.ts" }),
    },
  },
  {
    id: 4,
    at: NOW - MIN,
    event: {
      type: "hook",
      payload: hook("PostToolUse", {
        tool: "mcp__kibo__ask_user",
        question: "Quel port pour le récepteur ? 4747 (défaut) ou dynamique ?",
      }),
    },
  },
  { id: 5, at: NOW, event: { type: "reranked", rank: 3 } },
  { id: 6, at: NOW, event: { type: "hook", payload: hook("Stop", { detail: "J'attends ta réponse." }) } },
  { id: 7, at: NOW, event: { type: "hook", payload: hook("SessionEnd", { detail: "other" }) } },
  {
    id: 8,
    at: NOW,
    event: { type: "exited", code: 0, isError: false, result: "ok", tokens: 1, costUsd: 0, denied: [] },
  },
];

mock.module("../state/use-agents", () => ({
  useAgents: () => agentsFixture(),
  useConfig: () => null,
  useNow: () => NOW,
  useRunLog: (runId: string | null) => (runId === "r41" ? LOG : runId ? [] : null),
  useDaemonOnline: () => true,
}));

const { AgentBar } = await import("./AgentBar");
const { AgentDrawer } = await import("./AgentDrawer");
const { AgentPanel } = await import("./AgentPanel");
const { ReplyBox } = await import("./ReplyBox");
const { journalLines, RunJournal } = await import("./RunJournal");

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

const run = (id: string) => {
  const found = agentsFixture().runs.find((r) => r.id === id);
  if (!found) throw new Error(`fixture ${id} missing`);
  return found;
};

test("the bar sums up slots, queue, running runs and the run waiting for an answer", async () => {
  const onSelect = mock((_: string) => {});
  const onExpand = mock(() => {});
  render(<AgentBar state={agentsFixture()} now={NOW} online onExpand={onExpand} onSelect={onSelect} />);
  expect(screen.getByText("3/3")).toBeTruthy();
  expect(screen.getByText("Démon local")).toBeTruthy();
  expect(screen.getByText("3 en file")).toBeTruthy();
  for (const label of ["opus-dev-1", "opus-dev-3", "sonnet-review-1"]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.getByText("KIB-12 · 12m")).toBeTruthy();
  expect(screen.getByText("KIB-7 · 1m")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Répondre à opus-dev-2" }));
  expect(onSelect).toHaveBeenCalledWith("r41");
  await user.click(screen.getByRole("button", { name: "Déplier les agents" }));
  expect(onExpand).toHaveBeenCalled();
});

test("the bar says when the daemon is out of reach", () => {
  render(
    <AgentBar state={agentsFixture()} now={NOW} online={false} onExpand={() => {}} onSelect={() => {}} />,
  );
  expect(screen.getByText("Démon injoignable")).toBeTruthy();
  expect(screen.queryByText("Démon local")).toBeNull();
});

test("the drawer groups runs like the mockup and numbers the queue", async () => {
  const onSelect = mock((_: string) => {});
  render(
    <AgentDrawer
      state={agentsFixture()}
      now={NOW}
      selected={null}
      log={null}
      onSelect={onSelect}
      onCollapse={() => {}}
      onLaunch={() => {}}
    />,
  );
  expect(screen.getByText("3/3 créneaux · 3 en file · 1 attend une réponse")).toBeTruthy();
  const running = within(screen.getByRole("list", { name: "En cours · 3/3 créneaux" }));
  expect(running.getAllByRole("button").map((b) => b.textContent?.split("KIB")[0])).toEqual([
    "opus-dev-1",
    "opus-dev-3",
    "sonnet-review-1",
  ]);
  const queued = within(screen.getByRole("list", { name: "En file · 3" }));
  expect(queued.getByText("#1")).toBeTruthy();
  expect(queued.getByText("KIB-10 · Prioritaire")).toBeTruthy();
  expect(queued.getByText("KIB-29 · attend un créneau hôte (3/3)")).toBeTruthy();
  const finished = within(screen.getByRole("list", { name: "Terminé" }));
  expect(finished.getByText("KIB-11 · Terminé")).toBeTruthy();
  expect(finished.getByText("KIB-7 · Échec : exit code 1")).toBeTruthy();
  expect(screen.getByText("Choisis un run pour voir son journal.")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(
    within(screen.getByRole("list", { name: "Attend une réponse · créneau libéré" })).getByRole("button"),
  );
  expect(onSelect).toHaveBeenCalledWith("r41");
});

test("stopping a run cancels it, and a refusal is shown", async () => {
  const props = {
    state: agentsFixture(),
    now: NOW,
    log: [],
    onSelect: () => {},
    onCollapse: () => {},
    onLaunch: () => {},
  };
  render(<AgentDrawer {...props} selected={run("r42")} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Arrêter" }));
  expect(calls).toEqual([{ method: "cancelRun", runId: "r42" }]);
  outcome = () => Promise.reject(new KiboError("INVALID_TRANSITION", "run r42 is done"));
  await user.click(screen.getByRole("button", { name: "Arrêter" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'arrêter le run.");
});

test("a finished run has no stop button", () => {
  render(
    <AgentDrawer
      state={agentsFixture()}
      now={NOW}
      selected={run("r40")}
      log={[]}
      onSelect={() => {}}
      onCollapse={() => {}}
      onLaunch={() => {}}
    />,
  );
  expect(screen.queryByRole("button", { name: "Arrêter" })).toBeNull();
});

test("the journal keeps one SessionStart and one Stop, hides internal events, colours by event", () => {
  render(<RunJournal label="opus-dev-2" log={LOG} />);
  const journal = screen.getByRole("list", { name: "Journal de opus-dev-2" });
  const lines = within(journal).getAllByRole("listitem");
  expect(lines.map((l) => [l.textContent?.slice(5), l.getAttribute("data-tone")])).toEqual([
    ["SessionStartbrief.md + 3 guidelines chargés", "blue"],
    ["PostToolUseWrite apps/daemon/src/hooks/receiver.ts", "blue"],
    ["NotificationQuel port pour le récepteur ? 4747 (défaut) ou dynamique ?", "amber"],
    ["StopJ'attends ta réponse.", "green"],
    ["SessionEndother", "muted"],
  ]);
});

test("a failed exit adds a red line, even after a clean Stop", () => {
  const failed: RunLogEntry[] = [
    ...LOG.slice(0, -1),
    {
      id: 9,
      at: NOW,
      event: { type: "exited", code: 1, isError: true, result: "boom", tokens: 1, costUsd: 0, denied: [] },
    },
  ];
  expect(journalLines(failed).at(-1)).toMatchObject({ name: "exited", text: "boom", tone: "red" });
});

test("file paths in the journal are styled as links", () => {
  render(<RunJournal label="opus-dev-2" log={LOG} />);
  const path = screen.getByText("apps/daemon/src/hooks/receiver.ts");
  expect(path.getAttribute("data-path")).toBe("");
  expect(path.className).toContain("underline");
  expect(screen.getByText("Write").getAttribute("data-path")).toBeNull();
});

test("daemon events keep their raw type as name", () => {
  const exited = { type: "exited", code: 0, isError: false, result: null, tokens: 0, costUsd: 0 } as const;
  const cases: [RunEvent, string | null][] = [
    [{ type: "enqueued", rank: 1 }, null],
    [{ type: "admitted", lane: 2 }, null],
    [{ type: "spawned", pid: 1, resume: true, workspace: "repo", guidelines: 0 }, "SessionStart"],
    [{ ...exited, denied: [] }, null],
    [{ ...exited, denied: ["Bash"] }, "exited"],
    [{ type: "answered", text: "oui", rank: 0 }, "answered"],
    [{ type: "cancelled" }, "cancelled"],
    [{ type: "failed", error: "exit code 1" }, "failed"],
    [{ type: "prioritized", priority: true }, "prioritized"],
    [{ type: "prioritized", priority: false }, null],
    [{ type: "reranked", rank: 2 }, null],
  ];
  for (const [event, name] of cases) {
    expect(journalLines([{ id: 1, at: NOW, event }]).at(0)?.name ?? null).toBe(name);
  }
});

test("the reply box sends a trimmed answer, and keeps the text when it fails", async () => {
  render(<ReplyBox run={run("r41")} />);
  const user = userEvent.setup();
  const field = screen.getByLabelText<HTMLInputElement>("Réponse à opus-dev-2");
  await user.type(field, "  Port dynamique, écrit dans ~/.kibo/daemon.json ");
  await user.click(screen.getByRole("button", { name: "Envoyer" }));
  expect(calls).toEqual([
    { method: "answerRun", runId: "r41", text: "Port dynamique, écrit dans ~/.kibo/daemon.json" },
  ]);
  await waitFor(() => expect(field.value).toBe(""));
  outcome = () => Promise.reject(new KiboError("INVALID_TRANSITION", "not waiting"));
  await user.type(field, "4747");
  await user.click(screen.getByRole("button", { name: "Envoyer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'envoyer la réponse.");
  expect(field.value).toBe("4747");
});

test("the panel opens on the waiting run, shows its journal and folds back", async () => {
  render(<AgentPanel onLaunch={() => {}} focusRunId={null} onFocused={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Répondre à opus-dev-2" }));
  expect(screen.getByRole("list", { name: "Journal de opus-dev-2" })).toBeTruthy();
  expect(screen.getByLabelText("Réponse à opus-dev-2")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Replier les agents" }));
  expect(screen.getByRole("button", { name: "Déplier les agents" })).toBeTruthy();
});

test("a focus request opens the drawer on that run", () => {
  const onFocused = mock(() => {});
  render(<AgentPanel onLaunch={() => {}} focusRunId="r42" onFocused={onFocused} />);
  expect(screen.getByRole("list", { name: "Journal de opus-dev-1" })).toBeTruthy();
  expect(onFocused).toHaveBeenCalledTimes(1);
});

test("the launch button asks the shell to open the assign dialog", async () => {
  const onLaunch = mock(() => {});
  render(<AgentPanel onLaunch={onLaunch} focusRunId="r41" onFocused={() => {}} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Lancer un agent" }));
  expect(onLaunch).toHaveBeenCalled();
});
