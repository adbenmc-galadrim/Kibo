import { expect, test } from "bun:test";
import { initRun } from "@kibo/core/run-machine";
import type { RunRecord, RunView } from "@kibo/schema";
import { projectRunGuard } from "./project-guard";

const record: RunRecord = {
  id: "r1",
  seq: 1,
  projectId: "p1",
  ticketId: null,
  ticketKey: null,
  ticketTitle: "Agent de projet · Silo",
  profileId: "system:project-agent",
  profileName: "project-agent",
  agentScope: "global",
  projectKey: null,
  sessionId: "s1",
  brief: "",
  createdAt: 0,
  kind: "project",
  resumedFrom: null,
};
const projectRun: RunView = initRun(record, 0, 0);
const call = (tool: string) => ({ tool, input: null });

test("a project run is denied every shell, write and web tool, whatever the rule form", () => {
  const guard = projectRunGuard(projectRun);
  for (const tool of ["Bash", "Bash(ls)", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch"]) {
    expect(guard?.(call(tool))).toEqual({ decision: "deny", reason: expect.any(String) });
  }
});

test("a project run may read and use the kibo tools", () => {
  const guard = projectRunGuard(projectRun);
  for (const tool of ["Read", "Grep", "mcp__kibo__list_tickets", "BashOutput"]) {
    expect(guard?.(call(tool))).toBeNull();
  }
});

test("no run has no project guard", () => {
  expect(projectRunGuard(null)).toBeNull();
});
