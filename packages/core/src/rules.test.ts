import { describe, expect, test } from "bun:test";
import { DEFAULT_RULES, type Rule } from "@kibo/schema";
import { readProject } from "./commands";
import { createProjectDoc } from "./project";
import { evaluateRules, type RuleTicket, readRules, withDefaultRules } from "./rules";

const t = (id: string, statusId: RuleTicket["statusId"], parentId: string | null = null): RuleTicket => ({
  id,
  statusId,
  parentId,
  optional: false,
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

describe("branch created", () => {
  test("a new branch starts a waiting ticket and leaves a ticket further on alone", () => {
    for (const s of ["backlog", "todo"] as const)
      expect(evaluateRules(DEFAULT_RULES, { kind: "branch_created", ticketId: "a" }, [t("a", s)])).toEqual([
        { method: "setStatus", ticketId: "a", statusId: "in_progress" },
      ]);
    for (const s of ["in_progress", "in_review", "blocked", "done"] as const)
      expect(evaluateRules(DEFAULT_RULES, { kind: "branch_created", ticketId: "a" }, [t("a", s)])).toEqual(
        [],
      );
  });
});

describe("optional steps", () => {
  test("children done closes the parent while an optional sibling is still to do", () => {
    const tickets = [
      t("p", "in_progress"),
      t("c1", "done", "p"),
      { ...t("demo", "todo", "p"), optional: true },
    ];
    expect(evaluateRules(DEFAULT_RULES, { kind: "status_changed", ticketId: "c1" }, tickets)).toEqual([
      { method: "setStatus", ticketId: "p", statusId: "done" },
    ]);
  });
});

describe("default rules completion", () => {
  const BRANCH_RULE = "branch-created-in-progress";
  const older = DEFAULT_RULES.filter((r) => r.id !== BRANCH_RULE);

  test("a stored list without the branch rule gets it once", () => {
    expect(older).toHaveLength(4);
    const completed = withDefaultRules(older);
    expect(completed.filter((r) => r.id === BRANCH_RULE)).toHaveLength(1);
    expect(completed).toHaveLength(5);
    expect(withDefaultRules(completed)).toEqual(completed);
  });

  test("a stored list that has it is unchanged, even disabled", () => {
    const disabled = DEFAULT_RULES.map((r) => (r.id === BRANCH_RULE ? { ...r, enabled: false } : r));
    expect(withDefaultRules(disabled)).toEqual(disabled);
  });

  test("a rule removed from the stored list other than the branch rule is not brought back", () => {
    const custom = older.filter((r) => r.id !== "pr-opened-review");
    expect(withDefaultRules(custom).map((r) => r.id)).toEqual([...custom.map((r) => r.id), BRANCH_RULE]);
  });
});

describe("storage", () => {
  const doc = () =>
    createProjectDoc({
      id: "p1",
      key: "KIB",
      name: "Kibo",
      folder: null,
      color: "#F97316",
      worktree: null,
      storybook: null,
      duplication: null,
      delivery: null,
      tracking: null,
    });
  test("projects without rules use the defaults, and the snapshot carries them", () => {
    expect(readRules(doc())).toEqual(DEFAULT_RULES);
    expect(readProject(doc()).rules).toEqual(DEFAULT_RULES);
  });
  test("stored rules are completed on read, nothing is written", () => {
    const d = doc();
    const older = DEFAULT_RULES.filter((r) => r.id !== "branch-created-in-progress");
    d.getMap("rules").set("list", older);
    d.commit();
    expect(readRules(d).map((r) => r.id)).toContain("branch-created-in-progress");
    expect(d.getMap("rules").get("list")).toEqual(older);
  });
  test("stored rules are validated", () => {
    const d = doc();
    d.getMap("rules").set("list", [{ id: "x", enabled: true, when: "run_done", from: [], to: "blocked" }]);
    expect(() => readRules(d)).toThrow("STORE_CORRUPT");
  });
});
