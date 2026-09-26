import { expect, test } from "bun:test";
import { createMockSdk } from "./mock";
import { defineServer } from "./server";

const base = { id: "probe", version: "0.1.0", kind: "widget" as const, title: "Probe" };

test("every attempt is recorded in used, denials also in violations", async () => {
  const m = createMockSdk({ ...base, reads: ["ticket"], writes: [] });
  await m.sdk.list("ticket");
  await expect(m.sdk.data.set("k", 1)).rejects.toThrow("PERMISSION_DENIED");
  await expect(m.sdk.fetch("https://example.com/x")).rejects.toThrow("PERMISSION_DENIED");
  expect(m.used).toEqual(["read:ticket", "data", "net:https://example.com/x"]);
  expect(m.violations).toEqual(["data", "net https://example.com/x"]);
});

test("data, programmed fetch and actions work in memory", async () => {
  const m = createMockSdk(
    { ...base, reads: ["ticket"], writes: [], data: true, net: ["api.github.com"] },
    {
      fetch: (url) => ({ status: 200, headers: {}, body: url }),
      server: defineServer({ actions: { count: async (ctx) => (await ctx.list("ticket")).length } }),
      seed: (run) => run({ method: "createTicket", title: "A" }),
    },
  );
  await m.sdk.data.set("k", { a: 1 });
  expect(await m.sdk.data.get<{ a: number }>("k")).toEqual({ a: 1 });
  expect(await m.sdk.data.keys()).toEqual(["k"]);
  expect((await m.sdk.fetch("https://api.github.com/x")).body).toBe("https://api.github.com/x");
  expect(await m.sdk.action<number>("count")).toBe(1);
  await expect(m.sdk.action("nope")).rejects.toThrow("PERMISSION_DENIED");
});

test("notes live in an in-memory folder with conflict detection", async () => {
  const m = createMockSdk(
    { ...base, reads: ["note", "ticket"], writes: ["note"] },
    { notes: { "a.md": "# A\n\nVoir [[b]] et KIB-1.", "b.md": "# B" } },
  );
  const list = await m.sdk.list("note");
  expect(list.map((n) => [n.path, n.title, n.links, n.tickets])).toEqual([
    ["a.md", "A", ["b.md"], ["KIB-1"]],
    ["b.md", "B", [], []],
  ]);
  const a = await m.sdk.notes.read("a.md");
  m.touchNote("a.md", "# A modifiée");
  await expect(m.sdk.notes.write("a.md", "# A2", a.mtime)).rejects.toThrow("CONFLICT");
  await m.sdk.notes.write("a.md", "# A2", null);
  expect((await m.sdk.notes.search("a2")).map((n) => n.path)).toEqual(["a.md"]);
  expect((await m.sdk.notes.info()).displayDir).toBe("~/goinfre/Kibo/notes");
});

test("runs are served by list in both modes and notify run subscribers", async () => {
  const m = createMockSdk({ ...base, reads: ["ticket", "run"], writes: [] });
  const heard: string[] = [];
  const off = m.sdk.subscribe(() => heard.push("run"), "run");
  m.setRuns([{ ticketId: "1@1", runId: "r1", label: "opus-dev-1", state: "running", position: null }]);
  off();
  expect((await m.sdk.list("run")).map((r) => r.runId)).toEqual(["r1"]);
  expect(heard).toEqual(["run"]);
  expect(m.used).toEqual(["read:run"]);
});
