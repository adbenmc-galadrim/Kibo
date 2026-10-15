import { describe, expect, test } from "bun:test";
import {
  type ComponentCall,
  ComponentManifest,
  permissionOfCall,
  type RunDenials,
  type Ticket,
} from "@kibo/schema";
import { createMockSdk } from "./mock";
import { createSdk } from "./sdk";
import type { ProjectBackend, SdkContext } from "./types";

const manifest = ComponentManifest.parse({
  id: "probe",
  version: "1.0.0",
  kind: "view",
  title: "Probe",
  reads: ["ticket", "status", "question"],
  writes: ["ticket"],
});
const withRuns = ComponentManifest.parse({
  ...manifest,
  reads: [...manifest.reads, "run"],
  writes: [...manifest.writes, "run"],
});
const DENIALS: RunDenials = {
  runId: "r1",
  turn: 2,
  items: [{ tool: "Bash", target: "pnpm test", rule: "Bash(pnpm *)", addDir: null, reason: "ok" }],
  questionId: "q1",
  at: 5,
};
const ALLOW = { runId: "r1", questionId: "q1", rules: ["Bash(pnpm *)"], addDirs: [] };

const ctx: SdkContext = {
  instanceId: "i1",
  config: {},
  viewer: "adam",
  surface: "view",
  format: "medium",
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
};
const backendOf = (calls: ComponentCall[]): ProjectBackend => ({
  snapshot: async () => {
    throw new Error("unused");
  },
  run: async () => null,
  call: async (c) => {
    calls.push(c);
    if (c.kind === "run.deliveryAgent") return { ref: "global:full-delivery", name: "full-delivery" };
    return c.kind === "run.denials" ? DENIALS : null;
  },
  subscribe: () => () => undefined,
  runs: async () => [],
  subscribeRuns: () => () => undefined,
});

describe("delivery through the sdk", () => {
  test("delivering and allowing write runs, reading denials reads them", async () => {
    const calls: ComponentCall[] = [];
    const without = createSdk(backendOf(calls), manifest, ctx);
    await expect(without.runs.deliver("t1")).rejects.toThrow("PERMISSION_DENIED");
    await expect(without.runs.denials("r1")).rejects.toThrow("PERMISSION_DENIED");
    await expect(without.runs.allowAndResume(ALLOW)).rejects.toThrow("PERMISSION_DENIED");
    expect(calls).toEqual([]);
    const sdk = createSdk(backendOf(calls), withRuns, ctx);
    await sdk.runs.deliver("t1");
    expect(await sdk.runs.denials("r1")).toEqual(DENIALS);
    await sdk.runs.allowAndResume(ALLOW);
    expect(calls).toEqual([
      { kind: "run.deliver", ticketId: "t1" },
      { kind: "run.denials", runId: "r1" },
      { kind: "run.allowAndResume", ...ALLOW },
    ]);
  });

  test("the calls map to run permissions", () => {
    expect(permissionOfCall({ kind: "run.deliver", ticketId: "t1" })).toBe("write:run");
    expect(permissionOfCall({ kind: "run.denials", runId: "r1" })).toBe("read:run");
    expect(permissionOfCall({ kind: "run.allowAndResume", ...ALLOW })).toBe("write:run");
  });

  test("an image of a question is served by the daemon, never as a disk path", () => {
    const sdk = createSdk(backendOf([]), manifest, ctx);
    expect(sdk.questions.imageUrl("q", "i")).toBe("/api/questions/q/images/i");
    expect(sdk.questions.imageUrl("q 1", "a/b")).toBe("/api/questions/q%201/images/a%2Fb");
  });
});

describe("the delivery agent through the sdk", () => {
  test("it is read with read:run, for the component's project", async () => {
    const calls: ComponentCall[] = [];
    await expect(createSdk(backendOf([]), manifest, ctx).runs.deliveryAgent()).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    const sdk = createSdk(backendOf(calls), withRuns, ctx);
    expect(await sdk.runs.deliveryAgent()).toEqual({ ref: "global:full-delivery", name: "full-delivery" });
    expect(calls).toEqual([{ kind: "run.deliveryAgent" }]);
    expect(permissionOfCall({ kind: "run.deliveryAgent" })).toBe("read:run");
  });

  test("the mock answers full-delivery by default, or what the test sets", async () => {
    expect(await createMockSdk(withRuns).sdk.runs.deliveryAgent()).toEqual({
      ref: "global:full-delivery",
      name: "full-delivery",
    });
    expect(await createMockSdk(withRuns, { deliveryAgent: null }).sdk.runs.deliveryAgent()).toBeNull();
  });
});

describe("delivery in the mock", () => {
  const seed = (run: (cmd: { method: "createTicket"; title: string; parentId?: string }) => unknown) => {
    const parent = run({ method: "createTicket", title: "Regroupement" }) as Ticket;
    run({ method: "createTicket", title: "Sous-ticket A", parentId: parent.id });
    run({ method: "createTicket", title: "Sous-ticket B", parentId: parent.id });
  };

  test("a parent answers with its sub-tickets, a leaf with a queued run", async () => {
    const m = createMockSdk(withRuns, { seed });
    const [parent, leaf] = m.snapshot().tickets;
    if (!parent || !leaf) throw new Error("the seed creates a parent and two leaves");
    const grouped = await m.sdk.runs.deliver(parent.id);
    expect(grouped).toMatchObject({ kind: "parent" });
    expect(grouped.kind === "parent" ? grouped.items.map((i) => i.key) : []).toEqual(["KIB-2", "KIB-3"]);
    const run = await m.sdk.runs.deliver(leaf.id);
    if (run.kind === "parent") throw new Error("a leaf is delivered by a run");
    expect(run).toMatchObject({
      ticketId: leaf.id,
      ticketKey: "KIB-2",
      brief: "/full-delivery KIB-2",
      state: "queued",
    });
    expect(m.runDeliveries).toEqual([parent.id, leaf.id]);
    expect(m.used).toContain("write:run");
    await expect(m.sdk.runs.deliver("nope")).rejects.toThrow("NOT_FOUND");
  });

  test("denials and allow-and-resume answer and are recorded", async () => {
    const m = createMockSdk(withRuns, { denials: { r1: DENIALS } });
    expect(await m.sdk.runs.denials("r1")).toEqual(DENIALS);
    expect(await m.sdk.runs.denials("r9")).toBeNull();
    await m.sdk.runs.allowAndResume(ALLOW);
    expect(m.allowed).toEqual([ALLOW]);
    expect(m.sdk.questions.imageUrl("q", "i")).toBe("/api/questions/q/images/i");
    const without = createMockSdk(manifest);
    await expect(without.sdk.runs.deliver("t1")).rejects.toThrow("PERMISSION_DENIED");
    expect(without.violations).toEqual(["write run"]);
  });
});
