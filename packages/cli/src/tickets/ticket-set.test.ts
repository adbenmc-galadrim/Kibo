import { describe, expect, test } from "bun:test";
import type { ExternalRef, StatusId } from "@kibo/schema";
import { parseAssignments, prCommand, statusCommand } from "./ticket-set";

const DEFAULT_REASON = "Bloqué par la livraison (kibo tickets)";
const pr = (url: string, number: number): ExternalRef => ({
  kind: "github_pr",
  url,
  number,
  state: "merged",
  base: "dev",
  head: "feat/x",
});
const ticket = (id: string, statusId: StatusId, externalRefs: ExternalRef[] = []) => ({
  id,
  statusId,
  externalRefs,
});

describe("set assignments", () => {
  test("parses status, pr and reason, refuses anything else", () => {
    expect(parseAssignments(["status=wip", "pr=12"])).toEqual({
      status: "wip",
      pr: "12",
      reason: null,
      branch: null,
      base: null,
    });
    expect(parseAssignments(["status=blocked", "reason=attente client = oui"])).toEqual({
      status: "blocked",
      pr: null,
      reason: "attente client = oui",
      branch: null,
      base: null,
    });
    expect(() => parseAssignments([])).toThrow("INVALID_INPUT");
    expect(() => parseAssignments(["owner=adam"])).toThrow("INVALID_INPUT");
    expect(() => parseAssignments(["status"])).toThrow("INVALID_INPUT");
    expect(() => parseAssignments(["status=shipped"])).toThrow("INVALID_INPUT");
  });

  test("maps normalized statuses to Kibo columns and skips one already true", () => {
    const cmd = (from: StatusId, to: string) =>
      statusCommand(ticket("t", from), parseAssignments([`status=${to}`]), DEFAULT_REASON);
    expect(cmd("todo", "wip")).toEqual({ method: "setStatus", ticketId: "t", statusId: "in_progress" });
    expect(cmd("in_progress", "done")).toEqual({ method: "setStatus", ticketId: "t", statusId: "done" });
    expect(cmd("blocked", "todo")).toEqual({ method: "setStatus", ticketId: "t", statusId: "todo" });
    expect(cmd("in_review", "wip")).toBeNull();
    expect(cmd("backlog", "todo")).toBeNull();
    expect(cmd("in_progress", "in_review")).toEqual({
      method: "setStatus",
      ticketId: "t",
      statusId: "in_review",
    });
    expect(cmd("todo", "blocked")).toEqual({
      method: "setStatus",
      ticketId: "t",
      statusId: "blocked",
      reason: DEFAULT_REASON,
    });
    expect(
      statusCommand(
        ticket("t", "todo"),
        parseAssignments(["status=blocked", "reason=attente"]),
        DEFAULT_REASON,
      ),
    ).toEqual({ method: "setStatus", ticketId: "t", statusId: "blocked", reason: "attente" });
  });

  test("builds a PR reference from a number and the project repository, or from a URL", () => {
    const known = [ticket("a", "done", [pr("https://github.com/o/r/pull/3", 3)])];
    expect(prCommand(ticket("t", "todo"), "12", known)).toEqual({
      method: "upsertExternalRef",
      ticketId: "t",
      ref: {
        kind: "github_pr",
        url: "https://github.com/o/r/pull/12",
        number: 12,
        state: "open",
        base: null,
        head: null,
      },
    });
    expect(prCommand(ticket("t", "todo"), "https://github.com/x/y/pull/9", [])).toMatchObject({
      ref: { url: "https://github.com/x/y/pull/9", number: 9 },
    });
  });

  test("keeps a PR already attached and refuses an unknown or ambiguous repository", () => {
    const attached = ticket("t", "in_progress", [pr("https://github.com/o/r/pull/12", 12)]);
    expect(prCommand(attached, "12", [attached])).toBeNull();
    expect(() => prCommand(ticket("t", "todo"), "12", [])).toThrow("pr=<url>");
    const two = [
      ticket("a", "done", [pr("https://github.com/o/r/pull/3", 3)]),
      ticket("b", "done", [pr("https://github.com/o/other/pull/4", 4)]),
    ];
    expect(() => prCommand(ticket("t", "todo"), "12", two)).toThrow("pr=<url>");
    expect(() => prCommand(ticket("t", "todo"), "douze", two)).toThrow("INVALID_INPUT");
  });
});
