import { expect, mock, test } from "bun:test";
import type { RunEvent, RunLogEntry } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, NOW } from "./fixtures";
import { hook, RUN_LOG } from "./run-log-fixture";

mock.module("../api", () => ({
  client: { rpc: () => Promise.resolve(null) },
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
test("a path in the drawer journal opens a preview of the run's worktree", async () => {
  const onOpenFile = mock((_: unknown) => {});
  render(
    <AgentDrawer
      state={agentsFixture()}
      now={NOW}
      selected={{ ...run("r41"), projectId: "kibo", cwd: "/wt/kib-14" }}
      log={RUN_LOG}
      onSelect={() => {}}
      onCollapse={() => {}}
      onLaunch={() => {}}
      onOpenFile={onOpenFile}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "apps/daemon/src/hooks/receiver.ts" }));
  expect(onOpenFile.mock.calls).toEqual([
    [
      {
        projectId: "kibo",
        worktree: "/wt/kib-14",
        path: "apps/daemon/src/hooks/receiver.ts",
        line: null,
        origin: "KIB-14 · PostToolUse Write",
      },
    ],
  ]);
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
