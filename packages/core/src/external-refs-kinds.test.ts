import { describe, expect, test } from "bun:test";
import type { ExternalRef } from "@kibo/schema";
import { executeProjectCommand, readProject } from "./commands";
import { findTicketByRef, importExternalTicket, removeExternalRef, upsertExternalRef } from "./external-refs";
import { createProjectDoc } from "./project";
import { createTicket, getTicket } from "./tickets";
import { getNode } from "./tree";

const doc = () =>
  createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A", worktree: null });
const issue = (patch: Partial<Extract<ExternalRef, { kind: "github_issue" }>> = {}): ExternalRef => ({
  kind: "github_issue",
  bindingId: "b1",
  repo: "adam/kibo",
  number: 4,
  nodeId: "I_4",
  url: "https://github.com/adam/kibo/issues/4",
  ...patch,
});
const figma: ExternalRef = {
  kind: "figma_node",
  fileKey: "AbCdEf123456",
  nodeId: "1:2",
  url: "https://www.figma.com/design/AbCdEf123456/K?node-id=1-2",
  name: "Arbre",
};

describe("external refs of every kind", () => {
  test("one github issue per binding, replaced in place", () => {
    const d = doc();
    const t = createTicket(d, { title: "A" });
    upsertExternalRef(d, t.id, figma);
    upsertExternalRef(d, t.id, issue({ number: null, nodeId: null, url: null }));
    const after = upsertExternalRef(d, t.id, issue());
    expect(after.externalRefs).toEqual([figma, issue()]);
    const other = upsertExternalRef(d, t.id, issue({ bindingId: "b2" }));
    expect(other.externalRefs).toHaveLength(3);
  });

  test("figma nodes are keyed by file and node, mcp items by server and id", () => {
    const d = doc();
    const t = createTicket(d, { title: "A" });
    upsertExternalRef(d, t.id, figma);
    upsertExternalRef(d, t.id, { ...figma, name: "Renamed" });
    const withMcp = upsertExternalRef(d, t.id, {
      kind: "mcp_item",
      server: "ctx",
      itemId: "9",
      url: null,
      title: "Doc",
    });
    expect(withMcp.externalRefs.map((r) => r.kind)).toEqual(["figma_node", "mcp_item"]);
    expect(
      removeExternalRef(d, { ticketId: t.id, kind: "figma_node", key: "AbCdEf123456:1:2" }).externalRefs,
    ).toHaveLength(1);
    expect(() => removeExternalRef(d, { ticketId: t.id, kind: "figma_node", key: "nope" })).toThrow(
      "NOT_FOUND",
    );
  });

  test("import creates the ticket and its ref together, and is idempotent", () => {
    const d = doc();
    const a = importExternalTicket(d, {
      title: "From GitHub",
      description: "body",
      statusId: "done",
      ref: issue(),
    });
    const b = importExternalTicket(d, { title: "Again", ref: issue() });
    expect(b.id).toBe(a.id);
    expect(a.statusId).toBe("done");
    expect(findTicketByRef(d, issue())?.key).toBe("KIB-1");
    expect(readProject(d).tickets).toHaveLength(1);
    const blocked = importExternalTicket(d, {
      title: "B",
      statusId: "blocked",
      ref: issue({ bindingId: "b9" }),
    });
    expect(blocked.statusId).toBe("todo");
    const other = importExternalTicket(d, {
      title: "Autre issue",
      ref: issue({ number: 5, nodeId: "I_5", url: "https://github.com/adam/kibo/issues/5" }),
    });
    expect(other.id).not.toBe(a.id);
    const pendingA = importExternalTicket(d, {
      title: "P1",
      ref: issue({ number: null, nodeId: null, url: null }),
    });
    const pendingB = importExternalTicket(d, {
      title: "P2",
      ref: issue({ number: null, nodeId: null, url: null }),
    });
    expect(pendingA.id).not.toBe(pendingB.id);
  });

  test("new commands go through executeProjectCommand", () => {
    const d = doc();
    const t = executeProjectCommand(d, { method: "importExternalTicket", title: "X", ref: figma }) as {
      id: string;
    };
    executeProjectCommand(d, {
      method: "removeExternalRef",
      ticketId: t.id,
      kind: "figma_node",
      key: "AbCdEf123456:1:2",
    });
    expect(readProject(d).tickets[0]?.externalRefs).toEqual([]);
  });

  test("stored refs are validated when read", () => {
    const d = doc();
    const t = createTicket(d, { title: "A" });
    getNode(d.getTree("tickets"), t.id).data.set("externalRefs", [{ kind: "github_issue", url: 3 }]);
    expect(() => getTicket(d, t.id)).toThrow("STORE_CORRUPT");
  });

  test("only http(s) urls are accepted, for every kind", () => {
    const d = doc();
    const t = createTicket(d, { title: "A" });
    const pr: ExternalRef = {
      kind: "github_pr",
      url: "javascript:alert(1)",
      number: 1,
      state: "open",
      base: null,
      head: null,
    };
    expect(() => upsertExternalRef(d, t.id, pr)).toThrow("INVALID_INPUT");
    expect(() => upsertExternalRef(d, t.id, { ...figma, url: "javascript:alert(1)" })).toThrow(
      "INVALID_INPUT",
    );
    expect(getTicket(d, t.id).externalRefs).toEqual([]);
  });
});
