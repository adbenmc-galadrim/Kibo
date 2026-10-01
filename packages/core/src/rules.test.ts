import { describe, expect, test } from "bun:test";
import { DEFAULT_RULES, type Rule } from "@kibo/schema";
import { readProject } from "./commands";
import { createProjectDoc } from "./project";
import { evaluateRules, type RuleTicket, readRules } from "./rules";

const t = (id: string, statusId: RuleTicket["statusId"], parentId: string | null = null): RuleTicket => ({
  id,
  statusId,
  parentId,
});

const runDoneReview: Rule = {
  id: "run-done-review",
  enabled: true,
  when: "run_done",
  from: ["backlog", "todo", "in_progress"],
  to: "in_review",
};

describe("run done", () => {
  test("leaves the ticket in its status by default", () => {
    expect(DEFAULT_RULES.some((r) => r.when === "run_done")).toBe(false);
    for (const s of ["backlog", "todo", "in_progress"] as const) {
      expect(evaluateRules(DEFAULT_RULES, { kind: "run_done", ticketId: "a" }, [t("a", s)])).toEqual([]);
    }
  });

  test("a rule stored in the project still moves the ticket to review", () => {
    expect(
      evaluateRules([runDoneReview], { kind: "run_done", ticketId: "a" }, [t("a", "in_progress")]),
    ).toEqual([{ method: "setStatus", ticketId: "a", statusId: "in_review" }]);
  });

  test("blocked or done tickets are never moved by a rule", () => {
    for (const s of ["blocked", "done", "in_review"] as const) {
      expect(evaluateRules([runDoneReview], { kind: "run_done", ticketId: "a" }, [t("a", s)])).toEqual([]);
    }
    const tickets = [t("p", "blocked"), t("c1", "done", "p"), t("c2", "done", "p")];
    expect(evaluateRules(DEFAULT_RULES, { kind: "status_changed", ticketId: "c2" }, tickets)).toEqual([]);
  });
});

describe("run started", () => {
  test("moves a backlog or todo ticket to in progress, and nothing else", () => {
    for (const s of ["backlog", "todo"] as const) {
      expect(evaluateRules(DEFAULT_RULES, { kind: "run_started", ticketId: "a" }, [t("a", s)])).toEqual([
        { method: "setStatus", ticketId: "a", statusId: "in_progress" },
      ]);
    }
    for (const s of ["in_progress", "in_review", "blocked", "done"] as const) {
      expect(evaluateRules(DEFAULT_RULES, { kind: "run_started", ticketId: "a" }, [t("a", s)])).toEqual([]);
    }
  });
});

describe("pull requests", () => {
  test("an opened PR moves the ticket to review, never back from done or blocked", () => {
    expect(
      evaluateRules(DEFAULT_RULES, { kind: "pr_opened", ticketId: "a" }, [t("a", "in_progress")]),
    ).toEqual([{ method: "setStatus", ticketId: "a", statusId: "in_review" }]);
    for (const s of ["in_review", "blocked", "done"] as const) {
      expect(evaluateRules(DEFAULT_RULES, { kind: "pr_opened", ticketId: "a" }, [t("a", s)])).toEqual([]);
    }
  });

  test("a merged PR closes the ticket, then its parent when it was the last child", () => {
    const tickets = [t("p", "in_progress"), t("c1", "done", "p"), t("c2", "in_review", "p")];
    expect(evaluateRules(DEFAULT_RULES, { kind: "pr_merged", ticketId: "c2" }, tickets)).toEqual([
      { method: "setStatus", ticketId: "c2", statusId: "done" },
      { method: "setStatus", ticketId: "p", statusId: "done" },
    ]);
    expect(evaluateRules(DEFAULT_RULES, { kind: "pr_merged", ticketId: "a" }, [t("a", "blocked")])).toEqual(
      [],
    );
  });
});

describe("children done", () => {
  test("closes the parent once every direct child is done, and cascades", () => {
    const tickets = [
      t("root", "in_progress"),
      t("p", "in_progress", "root"),
      t("c1", "done", "p"),
      t("c2", "done", "p"),
    ];
    expect(evaluateRules(DEFAULT_RULES, { kind: "status_changed", ticketId: "c2" }, tickets)).toEqual([
      { method: "setStatus", ticketId: "p", statusId: "done" },
      { method: "setStatus", ticketId: "root", statusId: "done" },
    ]);
  });

  test("does nothing while a sibling is open", () => {
    const tickets = [t("p", "in_progress"), t("c1", "done", "p"), t("c2", "todo", "p")];
    expect(evaluateRules(DEFAULT_RULES, { kind: "status_changed", ticketId: "c1" }, tickets)).toEqual([]);
  });

  test("a finished run never closes the parent by itself", () => {
    const tickets = [t("p", "in_progress"), t("c1", "in_progress", "p")];
    const rules = [...DEFAULT_RULES, runDoneReview];
    expect(evaluateRules(rules, { kind: "run_done", ticketId: "c1" }, tickets)).toEqual([
      { method: "setStatus", ticketId: "c1", statusId: "in_review" },
    ]);
  });

  test("disabled rules are ignored", () => {
    const off: Rule[] = [...DEFAULT_RULES, runDoneReview].map((r) => ({ ...r, enabled: false }));
    expect(evaluateRules(off, { kind: "run_done", ticketId: "a" }, [t("a", "todo")])).toEqual([]);
  });
});

describe("storage", () => {
  const doc = () => createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" });
  test("projects without rules use the defaults, and the snapshot carries them", () => {
    expect(readRules(doc())).toEqual(DEFAULT_RULES);
    expect(readProject(doc()).rules).toEqual(DEFAULT_RULES);
  });
  test("stored rules are validated", () => {
    const d = doc();
    d.getMap("rules").set("list", [{ id: "x", enabled: true, when: "run_done", from: [], to: "blocked" }]);
    expect(() => readRules(d)).toThrow("STORE_CORRUPT");
  });
});
