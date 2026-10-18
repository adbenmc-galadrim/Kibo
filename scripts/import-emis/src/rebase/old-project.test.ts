import { describe, expect, test } from "bun:test";
import { emisShapedSnapshot, seedEmisShaped } from "../../fixtures/emis-shaped";
import type { SeedClient } from "../daemon-client";
import { readOldProject, readTicketsList } from "./old-project";

const roots = (old: ReturnType<typeof readOldProject>) => old.tickets.filter((t) => t.parentKey === null);
const childrenOf = (old: ReturnType<typeof readOldProject>, planId: string) => {
  const root = old.tickets.find((t) => t.planId === planId);
  return old.tickets.filter((t) => t.parentKey === root?.key);
};

describe("readOldProject", () => {
  const old = readOldProject(emisShapedSnapshot());

  test("reads 15 chapters, TODO with 9 children and Arbitrages with 3 questions", () => {
    const chapters = roots(old).filter((t) => t.planId !== "todo" && t.planId !== "arbitrages");
    expect(chapters.map((t) => t.planId)).toEqual([
      "C0",
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
      "C9",
      "CR",
      "CN",
      "CP",
      "CE",
      "CL",
    ]);
    expect(childrenOf(old, "todo")).toHaveLength(9);
    const arbitrages = old.tickets.find((t) => t.planId === "arbitrages");
    expect(old.questions.filter((q) => q.ticketKey === arbitrages?.key)).toHaveLength(3);
  });

  test("keeps fields needed to rebuild the project and drops the assignee", () => {
    const step = old.tickets.find((t) => t.planId === "C2-4");
    expect(step).toMatchObject({ statusId: "in_progress", parentKey: "EMIS-14", rank: 3 });
    expect(step?.delivery?.step).toBe(6);
    expect(step && "assignee" in step).toBe(false);
    expect(old.links).toContainEqual({ fromKey: "EMIS-19", toKey: "EMIS-21", type: "blocks" });
    expect(old.project).toEqual({ name: "Emis", key: "EMIS", folder: null, color: "#F97316", client: null });
    expect(old.questions.find((q) => q.importRef?.id === "Q9")?.answer).toEqual({
      text: "Oui, inclus.",
      by: { kind: "human", ref: "adam" },
      at: Date.UTC(2026, 9, 1, 9, 0, 0),
    });
  });

  test("fingerprint is a stable sha256 of the canonical content", () => {
    expect(old.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(readOldProject(emisShapedSnapshot()).fingerprint).toBe(old.fingerprint);
    const changed = emisShapedSnapshot();
    const first = changed.tickets[1];
    if (first) first.title = "Autre titre";
    expect(readOldProject(changed).fingerprint).not.toBe(old.fingerprint);
  });
});

describe("readTicketsList", () => {
  test("reads the CLI list format without descriptions or questions", () => {
    const list = [
      {
        id: "a",
        key: "EMIS-1",
        planId: "C0",
        title: "C0 · Socle",
        kiboStatus: "in_progress",
        blockedReason: null,
        parent: null,
        deps: [],
        labels: [],
        optional: false,
        delivery: null,
        refs: [{ kind: "import_ref", source: "plan", id: "C0" }],
      },
      {
        id: "b",
        key: "EMIS-2",
        planId: "C0-1",
        title: "C0-1 · Étape",
        kiboStatus: "done",
        blockedReason: null,
        parent: { key: "EMIS-1" },
        deps: [],
        labels: ["sprint:s0"],
        optional: false,
        delivery: null,
        refs: [],
      },
      {
        id: "c",
        key: "EMIS-3",
        planId: "C0-2",
        title: "C0-2 · Étape",
        kiboStatus: "todo",
        blockedReason: null,
        parent: { key: "EMIS-1" },
        deps: [{ key: "EMIS-2" }],
        labels: [],
        optional: false,
        delivery: null,
        refs: [],
      },
    ];
    const old = readTicketsList(list, {
      name: "Emis",
      key: "EMIS",
      folder: null,
      color: "#F97316",
      client: null,
    });
    expect(old.tickets.map((t) => [t.key, t.parentKey, t.rank, t.description])).toEqual([
      ["EMIS-1", null, 0, ""],
      ["EMIS-2", "EMIS-1", 0, ""],
      ["EMIS-3", "EMIS-1", 1, ""],
    ]);
    expect(old.links).toEqual([{ fromKey: "EMIS-2", toKey: "EMIS-3", type: "blocks" }]);
    expect(old.questions).toEqual([]);
  });
});

describe("seedEmisShaped", () => {
  test("creates the project, then every ticket, link and question by public commands", async () => {
    const methods: string[] = [];
    let n = 0;
    const client: SeedClient = {
      rpc: async (req) => {
        methods.push(req.method === "command" ? req.command.method : req.method);
        n += 1;
        return { id: `id${n}` } as never;
      },
      close: async () => {},
    };
    const snapshot = emisShapedSnapshot();
    await seedEmisShaped(client);
    expect(methods[0]).toBe("createProject");
    expect(methods.filter((m) => m === "createTicket")).toHaveLength(snapshot.tickets.length);
    expect(methods.filter((m) => m === "addLink")).toHaveLength(snapshot.links.length);
    expect(methods.filter((m) => m === "createQuestion")).toHaveLength(snapshot.questions.length);
    expect(methods).toContain("setDeliveryStep");
  });
});
