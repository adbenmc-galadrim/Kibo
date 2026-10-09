import { describe, expect, test } from "bun:test";
import { type ComponentCall, ComponentManifest } from "@kibo/schema";
import { createMockSdk } from "./mock";
import { createSdk } from "./sdk";
import type { ProjectBackend, SdkContext } from "./types";

const manifest = ComponentManifest.parse({
  id: "probe",
  version: "1.0.0",
  kind: "view",
  title: "Probe",
  reads: ["ticket", "status"],
  writes: ["ticket"],
});

describe("sdk permissions", () => {
  test("reads and writes what the manifest declares", async () => {
    const m = createMockSdk(manifest);
    const t = await m.sdk.run({ method: "createTicket", title: "A" });
    expect(t.key).toBe("KIB-1");
    await m.sdk.run({ method: "setStatus", ticketId: t.id, statusId: "in_progress" });
    expect((await m.sdk.list("ticket"))[0]?.statusId).toBe("in_progress");
    expect((await m.sdk.list("status")).map((s) => s.id)).toContain("blocked");
    expect(m.violations).toEqual([]);
  });

  test("anything undeclared is denied and recorded", async () => {
    const m = createMockSdk(manifest);
    await expect(m.sdk.list("link")).rejects.toThrow("PERMISSION_DENIED");
    await expect(m.sdk.run({ method: "addPage", title: "X", kind: "view" })).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    await expect(
      m.sdk.run({ method: "addInstance", pageId: "1@1", component: "kanban@1.0.0" }),
    ).rejects.toThrow("PERMISSION_DENIED");
    expect(m.violations).toEqual(["read link", "write addPage", "write addInstance"]);
  });

  test("subscribers hear about changes and host calls are recorded", async () => {
    const m = createMockSdk(manifest, { seed: (run) => run({ method: "createTicket", title: "Seed" }) });
    let calls = 0;
    const off = m.sdk.subscribe(() => calls++);
    await m.sdk.run({ method: "createTicket", title: "B" });
    off();
    await m.sdk.run({ method: "createTicket", title: "C" });
    expect(calls).toBe(1);
    m.sdk.openTicket("1@1");
    m.sdk.openNewTicket({ statusId: "todo" });
    expect(m.opened).toEqual(["1@1"]);
    expect(m.newTicketRequests).toEqual([{ statusId: "todo", instanceId: "mock-instance" }]);
    expect(m.snapshot().tickets).toHaveLength(3);
  });
});

test("openFile and openView are forwarded to the host and recorded by the mock", () => {
  const m = createMockSdk(manifest);
  m.sdk.openFile({ path: "packages/core/src/ticket.ts", line: 42 });
  m.sdk.openView("graph");
  expect(m.openedFiles).toEqual([{ path: "packages/core/src/ticket.ts", line: 42 }]);
  expect(m.openedViews).toEqual(["graph"]);
  expect(m.sdk.surface).toBe("view");
});

test("runs are read only when declared, and their listeners hear run changes", async () => {
  const withRuns = createMockSdk({ ...manifest, reads: ["ticket", "run"] });
  const heard: string[] = [];
  const off = withRuns.sdk.subscribe(() => heard.push("run"), "run");
  const offTickets = withRuns.sdk.subscribe(() => heard.push("ticket"));
  const t = await withRuns.sdk.run({ method: "createTicket", title: "A" });
  withRuns.setRuns([{ ticketId: t.id, runId: "r1", label: "opus-dev-1", state: "running", position: null }]);
  off();
  offTickets();
  expect(await withRuns.sdk.list("run")).toEqual([
    { ticketId: t.id, runId: "r1", label: "opus-dev-1", state: "running", position: null },
  ]);
  expect(heard).toEqual(["ticket", "run"]);
  const without = createMockSdk(manifest);
  await expect(without.sdk.list("run")).rejects.toThrow("PERMISSION_DENIED");
  expect(without.violations).toEqual(["read run"]);
});

describe("embed and storybooks", () => {
  const ITCH = "https://itch.io/embed-upload/1";
  const ctx: SdkContext = {
    instanceId: "i1",
    config: {},
    viewer: "adam",
    surface: "widget",
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
      return c.kind === "design.storybooks" ? [] : { url: "about:blank" };
    },
    subscribe: () => () => undefined,
    runs: async () => [],
    subscribeRuns: () => () => undefined,
  });
  const probe = (capabilities: string[], embeds: string[] = []) =>
    ComponentManifest.parse({ ...manifest, kind: "widget", capabilities, embeds });

  test("embed.open needs the embed capability and calls the daemon", async () => {
    const calls: ComponentCall[] = [];
    const without = createSdk(backendOf(calls), probe([]), ctx, "gated");
    await expect(without.embed.open(ITCH)).rejects.toThrow("PERMISSION_DENIED");
    expect(calls).toEqual([]);
    const sdk = createSdk(backendOf(calls), probe(["embed"], ["itch.io"]), ctx, "gated");
    await sdk.embed.open(ITCH);
    expect(calls).toEqual([{ kind: "embed.open", url: ITCH }]);
  });

  test("design.storybooks needs the design capability", async () => {
    const calls: ComponentCall[] = [];
    const without = createSdk(backendOf(calls), probe([]), ctx, "gated");
    await expect(without.design.storybooks()).rejects.toThrow("PERMISSION_DENIED");
    const sdk = createSdk(backendOf(calls), probe(["design"]), ctx, "gated");
    expect(await sdk.design.storybooks()).toEqual([]);
    expect(calls).toEqual([{ kind: "design.storybooks" }]);
  });
});
