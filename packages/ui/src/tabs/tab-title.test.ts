import { expect, test } from "bun:test";
import { INBOX_ID, type ProjectSnapshot, type TabTarget } from "@kibo/schema";
import { kiboProject, projectsFixture } from "../agents/fixtures";
import { crumbsFor } from "../shell/Breadcrumb";
import { describeTarget } from "./tab-title";

const kibo = kiboProject();
const inbox: ProjectSnapshot = {
  ...kibo,
  meta: { id: INBOX_ID, key: "INB", name: "Inbox", folder: null, color: "#64748B" },
  tickets: (kibo.tickets[0] ? [kibo.tickets[0]] : []).map((t) => ({
    ...t,
    id: "i3",
    key: "INB-3",
    keyLabel: "INB-3",
  })),
};
const ctx = { projects: projectsFixture, snapshots: new Map([[INBOX_ID, inbox]]) };
const inboxTicket: TabTarget = { kind: "ticket", projectId: INBOX_ID, ticketId: "i3" };

test("an inbox ticket tab is titled after the inbox, never as a missing project", () => {
  const tab = describeTarget(inboxTicket, ctx);
  expect(tab.title).toBe("Boîte de réception · INB-3");
  expect(tab.missing).toBe(false);
});

test("the breadcrumb names the inbox in French", () => {
  const labels = (target: TabTarget, project: ProjectSnapshot | null) =>
    crumbsFor(target, { project, branch: null }).map((c) => c.label);
  expect(labels(inboxTicket, inbox)).toEqual(["Boîte de réception", "INB-3"]);
  expect(labels({ kind: "screen", screen: "inbox" }, null)).toEqual(["Boîte de réception"]);
});
