import { expect, mock, test } from "bun:test";
import type { RunEvent, RunLogEntry, RunView, Worktree } from "@kibo/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, NOW } from "./fixtures";
import { hook, RUN_LOG } from "./run-log-fixture";

const worktrees: Worktree[] = [
  { path: "/repo", branch: "main", head: "a1", isMain: true },
  { path: "/repo/.kibo/worktrees/kib-14", branch: "kib-14", head: "b2", isMain: false },
];
mock.module("../api", () => ({
  client: {
    rpc: () => Promise.resolve(null),
    code: () => Promise.resolve(worktrees),
    subscribeCode: () => () => {},
    subscribe: () => () => {},
  },
}));

const { AgentDrawer } = await import("./AgentDrawer");
const { journalLines, RunJournal } = await import("./RunJournal");

const run = (id: string) => {
  const found = agentsFixture().runs.find((r) => r.id === id);
  if (!found) throw new Error(`fixture ${id} missing`);
  return found;
};

test("the journal keeps one SessionStart and one Stop, hides internal events, colours by event", () => {
  render(<RunJournal label="opus-dev-2" log={RUN_LOG} files={null} />);
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
    ...RUN_LOG.slice(0, -1),
    {
      id: 9,
      at: NOW,
      event: { type: "exited", code: 1, isError: true, result: "boom", tokens: 1, costUsd: 0, denied: [] },
    },
  ];
  expect(journalLines(failed).at(-1)).toMatchObject({ name: "exited", text: "boom", tone: "red" });
});
test("file paths in the journal open the file in the run's worktree, with their origin", async () => {
  const opened = mock((_path: string, _line: number | null, _origin: string) => {});
  const log: RunLogEntry[] = [
    ...RUN_LOG,
    {
      id: 20,
      at: NOW,
      event: { type: "hook", payload: hook("PostToolUse", { tool: "Edit", detail: "/wt/kib-14/src/a.ts" }) },
    },
  ];
  render(
    <RunJournal
      label="opus-dev-2"
      log={log}
      files={{ worktree: "/wt/kib-14", ticketKey: "KIB-14", open: opened }}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "apps/daemon/src/hooks/receiver.ts" }));
  await user.click(screen.getByRole("button", { name: "src/a.ts" }));
  expect(opened.mock.calls).toEqual([
    ["apps/daemon/src/hooks/receiver.ts", null, "KIB-14 · PostToolUse Write"],
    ["src/a.ts", null, "KIB-14 · PostToolUse Edit"],
  ]);
});
const WT = "/repo/.kibo/worktrees/kib-14";
const edited = (detail: string): RunLogEntry[] => [
  ...RUN_LOG,
  { id: 20, at: NOW, event: { type: "hook", payload: hook("PostToolUse", { tool: "Edit", detail }) } },
];
function renderDrawer(selected: RunView, log: RunLogEntry[] = RUN_LOG) {
  const onOpenFile = mock((_: unknown) => {});
  render(
    <AgentDrawer
      state={agentsFixture()}
      now={NOW}
      selected={selected}
      log={log}
      onSelect={() => {}}
      onCollapse={() => {}}
      onLaunch={() => {}}
      onOpenFile={onOpenFile}
    />,
  );
  return onOpenFile;
}

test("a path in the drawer journal opens a preview of the run's worktree", async () => {
  const onOpenFile = renderDrawer({ ...run("r41"), projectId: "kibo", cwd: WT });
  const link = await screen.findByRole("button", { name: "apps/daemon/src/hooks/receiver.ts" });
  await userEvent.setup().click(link);
  expect(onOpenFile.mock.calls).toEqual([
    [
      {
        projectId: "kibo",
        worktree: WT,
        path: "apps/daemon/src/hooks/receiver.ts",
        line: null,
        origin: "KIB-14 · PostToolUse Write",
      },
    ],
  ]);
});

test("a run in a subfolder opens its files in the worktree that owns that folder", async () => {
  const onOpenFile = renderDrawer(
    { ...run("r41"), projectId: "kibo", cwd: `${WT}/packages/ui` },
    edited(`${WT}/packages/ui/src/a.ts`),
  );
  await userEvent.setup().click(await screen.findByRole("button", { name: "packages/ui/src/a.ts" }));
  expect(onOpenFile.mock.calls[0]?.[0]).toMatchObject({ worktree: WT, path: "packages/ui/src/a.ts" });
});

test("an isolated run, or one outside every worktree, shows its paths as plain text", async () => {
  const isolated = { ...run("r41"), projectId: "kibo", workspace: "isolated", cwd: "/repo/tmp/iso" };
  renderDrawer(isolated, edited("/repo/tmp/iso/a.ts"));
  expect(await screen.findByText("Edit /repo/tmp/iso/a.ts")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /a\.ts/ })).toBeNull();
  cleanup();
  renderDrawer({ ...run("r41"), projectId: "kibo", cwd: "/elsewhere" }, edited("/elsewhere/b.ts"));
  expect(await screen.findByText("Edit /elsewhere/b.ts")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /b\.ts/ })).toBeNull();
});

test("without a worktree the journal shows paths as plain text", () => {
  render(<RunJournal label="opus-dev-2" log={RUN_LOG} files={null} />);
  expect(screen.getByText("Write apps/daemon/src/hooks/receiver.ts")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
test("a missing journal says so instead of an empty list", () => {
  render(<RunJournal label="opus-dev-2" log={[]} files={null} missing />);
  expect(screen.getByText("Journal indisponible pour ce run.")).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
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
    [{ type: "requeued", rank: 1 }, null],
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
test("the setup command shows as a preparation line, with its status and duration", () => {
  const command = "pnpm worktree feat/drag";
  const log: RunLogEntry[] = [
    { id: 1, at: NOW, event: { type: "setup", command, status: "running" } },
    { id: 2, at: NOW, event: { type: "setup", command, status: "done", durationMs: 12_400 } },
    { id: 3, at: NOW, event: { type: "setup", command, status: "failed", durationMs: 3_000 } },
  ];
  expect(journalLines(log).map((l) => [l.name, l.text, l.tone])).toEqual([
    ["setup", "Préparation : pnpm worktree feat/drag · en cours", "blue"],
    ["setup", "Préparation : pnpm worktree feat/drag · terminée en 12s", "green"],
    ["setup", "Préparation : pnpm worktree feat/drag · échec après 3s", "red"],
  ]);
});
test("the agent's last message and the user's messages are shown whole, on several lines", () => {
  const message = "Fait.\nDeux fichiers modifiés.\nVeux-tu des tests ?\nJe peux aussi documenter.";
  const log: RunLogEntry[] = [
    { id: 1, at: NOW, event: { type: "hook", payload: hook("Stop", { detail: message }) } },
    { id: 2, at: NOW, event: { type: "answered", text: "Oui,\najoute les tests.", rank: 0 } },
    {
      id: 3,
      at: NOW,
      event: { type: "hook", payload: hook("PostToolUse", { tool: "Read", detail: "a.ts" }) },
    },
  ];
  render(<RunJournal label="opus-dev-2" log={log} files={null} />);
  const [stop, answer, tool] = screen.getAllByRole("listitem").map((l) => l.lastElementChild);
  expect(stop?.textContent).toBe(message);
  expect(answer?.textContent).toBe("Oui,\najoute les tests.");
  for (const whole of [stop, answer]) {
    expect(whole?.className).toContain("whitespace-pre-wrap");
    expect(whole?.className).not.toContain("line-clamp");
  }
  expect(tool?.className).toContain("line-clamp-3");
});
test("a clean end of turn shows the whole result once, in place of its clipped Stop line", () => {
  const result = `${"Compte rendu détaillé. ".repeat(110)}\nQuelle option préfères-tu ?`;
  expect(result.length).toBeGreaterThan(2000);
  const log: RunLogEntry[] = [
    {
      id: 1,
      at: NOW,
      event: { type: "spawned", pid: 1, resume: false, workspace: "isolated", guidelines: 0 },
    },
    { id: 2, at: NOW, event: { type: "hook", payload: hook("Stop", { detail: result.slice(0, 2000) }) } },
    { id: 3, at: NOW, event: { type: "hook", payload: hook("SessionEnd", { detail: "other" }) } },
    {
      id: 4,
      at: NOW,
      event: { type: "exited", code: 0, isError: false, result, tokens: 1, costUsd: 0, denied: ["Bash"] },
    },
  ];
  const lines = journalLines(log);
  expect(lines.map((l) => [l.name, l.tone])).toEqual([
    ["SessionStart", "blue"],
    ["Stop", "green"],
    ["SessionEnd", "muted"],
    ["exited", "amber"],
  ]);
  expect(lines[1]).toMatchObject({ text: result, whole: true });
  render(<RunJournal label="opus-dev-2" log={log} files={null} />);
  expect(screen.getByText(/Quelle option préfères-tu \?/)).toBeTruthy();
});
test("a clean end of turn without Stop hook still shows its result", () => {
  const log: RunLogEntry[] = [
    {
      id: 1,
      at: NOW,
      event: { type: "spawned", pid: 1, resume: false, workspace: "isolated", guidelines: 0 },
    },
    {
      id: 2,
      at: NOW,
      event: { type: "exited", code: 0, isError: false, result: "Fini.", tokens: 1, costUsd: 0, denied: [] },
    },
  ];
  expect(journalLines(log).at(-1)).toMatchObject({ name: "Stop", text: "Fini.", tone: "green", whole: true });
});
test("the journal follows new lines unless the reader scrolled up", () => {
  const entry = (id: number): RunLogEntry => ({
    id,
    at: NOW,
    event: { type: "hook", payload: hook("PostToolUse", { tool: "Read", detail: `f${id}.ts` }) },
  });
  const view = render(<RunJournal label="opus-dev-2" log={[entry(1)]} files={null} />);
  const list = screen.getByRole("list", { name: "Journal de opus-dev-2" });
  let height = 400;
  Object.defineProperty(list, "scrollHeight", { configurable: true, get: () => height });
  Object.defineProperty(list, "clientHeight", { configurable: true, get: () => 100 });
  view.rerender(<RunJournal label="opus-dev-2" log={[entry(1), entry(2)]} files={null} />);
  expect(list.scrollTop).toBe(400);
  list.scrollTop = 50;
  list.dispatchEvent(new Event("scroll"));
  height = 600;
  view.rerender(<RunJournal label="opus-dev-2" log={[entry(1), entry(2), entry(3)]} files={null} />);
  expect(list.scrollTop).toBe(50);
  list.scrollTop = 500;
  list.dispatchEvent(new Event("scroll"));
  height = 800;
  view.rerender(
    <RunJournal label="opus-dev-2" log={[entry(1), entry(2), entry(3), entry(4)]} files={null} />,
  );
  expect(list.scrollTop).toBe(800);
});

test("the session line names the run it resumes, or why the session is new, in grey", () => {
  const resumed: RunEvent = { type: "session", mode: "resumed", from: "r41" };
  const fresh: RunEvent = { type: "session", mode: "fresh", reason: "transcript_missing" };
  const runs = [{ ...run("r41"), turns: 3 }];
  expect(journalLines([{ id: 1, at: NOW, event: resumed }], runs)).toMatchObject([
    { name: "session", text: "Session : reprise du run opus-dev-2 (3 tours)", tone: "muted" },
  ]);
  expect(journalLines([{ id: 1, at: NOW, event: resumed }])).toMatchObject([
    { text: "Session : reprise du run précédent" },
  ]);
  expect(journalLines([{ id: 2, at: NOW, event: fresh }])).toMatchObject([
    { name: "session", text: "Session : nouvelle (transcript introuvable)", tone: "muted" },
  ]);
});

test("the drawer journal knows the runs of the agents state", async () => {
  const log: RunLogEntry[] = [
    { id: 1, at: NOW, event: { type: "session", mode: "resumed", from: "r41" } },
    ...RUN_LOG,
  ];
  renderDrawer({ ...run("r40"), projectId: "kibo" }, log);
  expect(await screen.findByText(/^Session : reprise du run opus-dev-2 \(\d+ tours?\)$/)).toBeTruthy();
});
