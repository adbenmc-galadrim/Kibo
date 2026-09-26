import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { adapterActions, bindingIdOf, defineAdapter } from "./adapter";

const Remote = z.object({ id: z.number(), title: z.string(), at: z.string(), closed: z.boolean() });
const Config = z.object({ repo: z.string() });
const toy = defineAdapter({
  id: "toy",
  remote: Remote,
  config: Config,
  pull: async (_ctx, cursor) => ({
    items: cursor === null ? [{ id: 1, title: "A", at: "2026-09-26T10:00:00Z", closed: false }] : [],
    cursor: "c1",
    more: false,
  }),
  push: async (_ctx, op) => ({
    id: 2,
    title: op.kind === "create" ? op.fields.title : "patched",
    at: "2026-09-26T10:01:00Z",
    closed: false,
  }),
  map: {
    remoteId: (r) => String(r.id),
    updatedAt: (r) => r.at,
    toFields: (r) => ({
      title: r.title,
      description: "",
      statusId: r.closed ? "done" : "todo",
      closed: r.closed,
    }),
    toRef: (r, bindingId) => ({
      kind: "github_issue",
      bindingId,
      repo: "adam/kibo",
      number: r.id,
      nodeId: `I_${r.id}`,
      url: `https://github.com/adam/kibo/issues/${r.id}`,
    }),
    labels: () => [],
  },
});
const ctx = {
  instanceId: "binding:b1",
  config: { repo: "adam/kibo" },
  fetch: async () => ({ status: 200, headers: {}, body: "" }),
};

describe("adapter contract", () => {
  test("pull maps and validates every remote item", async () => {
    const page = await adapterActions(toy)["adapter.pull"](ctx, { cursor: null });
    expect(page).toEqual({
      items: [
        {
          remoteId: "1",
          updatedAt: "2026-09-26T10:00:00Z",
          fields: { title: "A", description: "", statusId: "todo", closed: false },
          ref: {
            kind: "github_issue",
            bindingId: "b1",
            repo: "adam/kibo",
            number: 1,
            nodeId: "I_1",
            url: "https://github.com/adam/kibo/issues/1",
          },
          labels: [],
        },
      ],
      cursor: "c1",
      more: false,
    });
  });

  test("push parses the op and returns the mapped remote", async () => {
    const out = await adapterActions(toy)["adapter.push"](ctx, {
      kind: "create",
      ticketId: "1@1",
      fields: { title: "New", description: "", statusId: "todo", closed: false },
      since: null,
    });
    expect(out.fields.title).toBe("New");
    await expect(adapterActions(toy)["adapter.push"](ctx, { kind: "drop" })).rejects.toThrow();
  });

  test("an invalid remote object is rejected", async () => {
    const bad = defineAdapter({
      ...toy,
      pull: async () => ({ items: [{ id: "x" }], cursor: null, more: false }),
    });
    await expect(adapterActions(bad)["adapter.pull"](ctx, { cursor: null })).rejects.toThrow();
  });

  test("adapter actions only run for a binding", () => {
    expect(bindingIdOf("binding:b1")).toBe("b1");
    expect(() => bindingIdOf("inst-1")).toThrow("INVALID_INPUT");
  });
});
