import { describe, expect, test } from "bun:test";
import {
  ComponentManifest,
  DEFAULT_WORKFLOW,
  formatTicketKey,
  KiboError,
  ProjectKey,
  Ticket,
  TicketKey,
} from "./index";

describe("keys", () => {
  test("ticket keys are flat and stable", () => {
    expect(formatTicketKey("KIB", 12)).toBe("KIB-12");
    expect(TicketKey.safeParse("KIB-12").success).toBe(true);
    expect(TicketKey.safeParse("KIB-12.1").success).toBe(false);
    expect(TicketKey.safeParse("kib-12").success).toBe(false);
  });
  test("project keys are 2 to 6 uppercase letters", () => {
    expect(ProjectKey.safeParse("KIB").success).toBe(true);
    expect(ProjectKey.safeParse("K").success).toBe(false);
    expect(ProjectKey.safeParse("KIBOKIB").success).toBe(false);
  });
});

describe("workflow", () => {
  test("default workflow has the six statuses in order", () => {
    expect(DEFAULT_WORKFLOW.map((s) => s.id)).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "blocked",
      "done",
    ]);
    expect(DEFAULT_WORKFLOW.find((s) => s.id === "blocked")?.label).toBe("Bloqué");
  });
});

describe("ticket", () => {
  const base = {
    id: "1@1",
    key: "KIB-1",
    title: "Setup",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
  };
  test("a blocked ticket needs a non-empty reason", () => {
    expect(Ticket.safeParse({ ...base, statusId: "blocked", blockedReason: null }).success).toBe(false);
    expect(Ticket.safeParse({ ...base, statusId: "blocked", blockedReason: "  " }).success).toBe(false);
    expect(Ticket.safeParse({ ...base, statusId: "blocked", blockedReason: "Attente client" }).success).toBe(
      true,
    );
  });
  test("a non-blocked ticket has no reason", () => {
    expect(Ticket.safeParse({ ...base, blockedReason: "x" }).success).toBe(false);
  });
});

describe("manifest", () => {
  test("version must be semver x.y.z", () => {
    const m = {
      id: "kanban",
      version: "1.0.0",
      kind: "both",
      title: "Kanban",
      reads: ["ticket", "status"],
      writes: ["ticket"],
    };
    expect(ComponentManifest.safeParse(m).success).toBe(true);
    expect(ComponentManifest.safeParse({ ...m, version: "v1.0" }).success).toBe(false);
  });
  test("keeps an optional description", () => {
    const m = {
      id: "kanban",
      version: "1.0.0",
      kind: "both",
      title: "Kanban",
      reads: [],
      writes: [],
    };
    expect(ComponentManifest.parse({ ...m, description: "Tickets par statut" }).description).toBe(
      "Tickets par statut",
    );
    expect(ComponentManifest.parse(m).description).toBeUndefined();
  });
});

test("KiboError carries a stable code", () => {
  const e = new KiboError("TREE_CYCLE", "cannot move under descendant");
  expect(e).toBeInstanceOf(Error);
  expect(e.code).toBe("TREE_CYCLE");
  expect(e.message).toBe("TREE_CYCLE: cannot move under descendant");
});
