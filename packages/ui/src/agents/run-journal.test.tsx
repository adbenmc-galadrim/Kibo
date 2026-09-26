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
