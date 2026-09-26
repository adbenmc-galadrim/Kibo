import { describe, expect, test } from "bun:test";
import { ComponentManifest } from "@kibo/schema";
import { createMockSdk } from "./mock";

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
    expect(m.newTicketRequests).toEqual([{ statusId: "todo" }]);
    expect(m.snapshot().tickets).toHaveLength(3);
  });
});

test("openFile is forwarded to the host and recorded by the mock", () => {
  const m = createMockSdk(manifest);
  m.sdk.openFile({ path: "packages/core/src/ticket.ts", line: 42 });
  expect(m.openedFiles).toEqual([{ path: "packages/core/src/ticket.ts", line: 42 }]);
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
