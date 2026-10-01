import { expect, test } from "bun:test";
import { INBOX_ID, type ProjectSnapshot, type StatusId } from "@kibo/schema";
import { kiboProject, projectsFixture } from "../agents/fixtures";
import { displayName, inboxMeta, inboxSummary, newTicketProjects, openInboxCount, withInbox } from "./inbox";

function inboxSnapshot(statuses: StatusId[]): ProjectSnapshot {
  const kibo = kiboProject();
  const model = kibo.tickets[0];
  if (!model) throw new Error("fixture without ticket");
  return {
    ...kibo,
    meta: { id: INBOX_ID, key: "INB", name: "Inbox", folder: null, color: "#64748B" },
    tickets: statuses.map((statusId, i) => ({
      ...model,
      id: `i${i}`,
      key: `INB-${i + 1}`,
      keyLabel: `INB-${i + 1}`,
      statusId,
    })),
    links: [],
    nextTicketKey: `INB-${statuses.length + 1}`,
  };
}

test("withInbox puts the inbox first only when its snapshot is loaded, and counts open tickets", () => {
  const snapshots = new Map([[INBOX_ID, inboxSnapshot(["todo", "done"])]]);
  expect(withInbox(projectsFixture, new Map()).map((p) => p.id)).toEqual(projectsFixture.map((p) => p.id));
  const all = withInbox(projectsFixture, snapshots);
  expect(all[0]?.id).toBe(INBOX_ID);
  expect(all[0]?.name).toBe("Boîte de réception");
  expect(openInboxCount(snapshots.get(INBOX_ID))).toBe(1);
  expect(openInboxCount(undefined)).toBe(0);
  expect(displayName({ id: INBOX_ID, name: "Inbox" })).toBe("Boîte de réception");
  expect(displayName({ id: "p1", name: "Kibo" })).toBe("Kibo");
});

test("the inbox summary counts its tickets by status and carries the inbox identity", () => {
  const summary = inboxSummary(inboxSnapshot(["todo", "todo", "blocked", "done"]));
  expect(summary).toMatchObject({ id: INBOX_ID, key: "INB", name: "Boîte de réception", folder: null });
  expect(summary.counts).toEqual({ backlog: 0, todo: 2, in_progress: 0, in_review: 0, blocked: 1, done: 1 });
  expect(inboxMeta()).toEqual({
    id: INBOX_ID,
    key: "INB",
    name: "Boîte de réception",
    folder: null,
    color: "#64748B",
  });
});

test("a new ticket can go to the inbox first, then to the projects one can write to", () => {
  const kibo = kiboProject();
  const readOnly: ProjectSnapshot = {
    ...kibo,
    meta: { ...kibo.meta, id: "fac" },
    sync: { shared: true, keyAllocator: "server", role: "viewer", access: "read-only", members: [] },
  };
  const snapshots = new Map([
    ["kibo", kibo],
    ["fac", readOnly],
  ]);
  expect(newTicketProjects(projectsFixture, snapshots).map((p) => p.id)).toEqual([INBOX_ID, "kibo"]);
});
