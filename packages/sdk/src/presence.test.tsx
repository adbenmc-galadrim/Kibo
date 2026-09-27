import { expect, test } from "bun:test";
import { ComponentManifest, type PresencePeer, type TicketView } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { assigneeLabel, remoteRuns } from "./members";
import { createMockSdk } from "./mock";
import { TicketKeyLabel } from "./ticket-key";

const manifest = (reads: ("ticket" | "status")[]) =>
  ComponentManifest.parse({
    id: "probe",
    version: "1.0.0",
    kind: "widget",
    title: "Sonde",
    reads,
    writes: [],
  });
const lea: PresencePeer = {
  deviceId: "d2",
  self: false,
  userId: "u-lea",
  name: "Léa",
  pageId: "pg1",
  ticketId: "t1",
  runs: [{ ticketKey: "KIB-12", profile: "opus-dev-1", state: "running" }],
};

test("presence and sharing need the ticket read permission", async () => {
  const denied = createMockSdk(manifest(["status"]), { presence: [lea] });
  await expect(denied.sdk.presence.list()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  await expect(denied.sdk.sharing()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  expect(denied.violations).toEqual(["read presence", "read sharing"]);
  const allowed = createMockSdk(manifest(["ticket"]), { presence: [lea] });
  expect(await allowed.sdk.presence.list()).toEqual([lea]);
  expect(allowed.used).toContain("read:ticket");
});

test("a shared mock project creates tickets with a provisional key", async () => {
  const m = createMockSdk(manifest(["ticket"]), {
    shared: true,
    members: [{ userId: "u-lea", name: "Léa", role: "editor" }],
    seed: (run) => run({ method: "createTicket", title: "En attente" }),
  });
  const [ticket] = await m.sdk.list("ticket");
  expect(ticket?.key).toBeNull();
  expect(ticket?.keyLabel).toBe("KIB-…");
  expect((await m.sdk.sharing()).members).toEqual([{ userId: "u-lea", name: "Léa", role: "editor" }]);
  m.setAccess("read-only");
  expect((await m.sdk.sharing()).access).toBe("read-only");
});

test("presence changes reach the subscribers", async () => {
  const m = createMockSdk(manifest(["ticket"]));
  let calls = 0;
  const off = m.sdk.presence.subscribe(() => {
    calls += 1;
  });
  m.setPresence([lea]);
  off();
  m.setPresence([]);
  expect(calls).toBe(1);
  expect(await m.sdk.presence.list()).toEqual([]);
});

test("assignee names come from members, agents keep their profile", () => {
  const members = [{ userId: "u-lea", name: "Léa", role: "editor" as const }];
  expect(assigneeLabel({ kind: "human", ref: "u-lea" }, members)).toBe("Léa");
  expect(assigneeLabel({ kind: "human", ref: "adam" }, members)).toBe("adam");
  expect(assigneeLabel({ kind: "agent", ref: "opus-dev-1" }, members)).toBe("opus-dev-1");
});

test("remote runs are labelled with the colleague's name", () => {
  expect(remoteRuns([lea, { ...lea, self: true, name: "Adam" }], "KIB-12")).toEqual([
    { label: "opus-dev-1 · Léa", state: "running" },
  ]);
  expect(remoteRuns([lea], null)).toEqual([]);
});

test("a provisional key is shown in italics with an explanation", () => {
  const pending: Pick<TicketView, "key" | "keyLabel"> = { key: null, keyLabel: "KIB-…" };
  render(<TicketKeyLabel ticket={pending} />);
  const label = screen.getByText("KIB-…");
  expect(label.className).toContain("italic");
  expect(label.getAttribute("title")).toBe("Clé attribuée à la prochaine synchronisation");
  render(<TicketKeyLabel ticket={{ key: "KIB-12", keyLabel: "KIB-12" }} />);
  expect(screen.getByText("KIB-12").className).not.toContain("italic");
});
