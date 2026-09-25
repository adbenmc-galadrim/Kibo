import { describe, expect, test } from "bun:test";
import type { ComponentManifest } from "@kibo/schema";
import { createMockSdk } from "./mock";

const manifest: ComponentManifest = {
  id: "probe",
  version: "1.0.0",
  kind: "view",
  title: "Probe",
  reads: ["ticket", "status"],
  writes: ["ticket"],
};

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
