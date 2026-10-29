import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type PendingAlert, pickAlerts } from "@kibo/core";
import type { HookPayload, HookReply, Overlap } from "@kibo/schema";
import type { HookSink } from "../runs/hook-route";
import { storeAlerts, withOverlapAlerts } from "./delivery";
import { type OverlapStore, openOverlapStore } from "./store";

const hook = (event: HookPayload["event"], tool: string | null = "Edit"): HookPayload => ({
  event,
  sessionId: "s",
  transcriptPath: null,
  tool,
  detail: null,
  question: null,
  agentId: null,
  toolUseId: null,
  ask: null,
  todos: null,
  stopHookActive: false,
});

const overlap: Overlap = {
  id: "o1",
  projectId: "P",
  kind: "export",
  key: "export:formatDate",
  ownerRunId: "r12",
  otherRunId: "r15",
  ownerWorkspace: "/wt/bou-12",
  otherWorkspace: "/wt/bou-15",
  detail: {
    kind: "export",
    name: "formatDate",
    ownerPath: "src/lib/format.ts",
    otherPath: "src/utils/date.ts",
  },
  firstSeenAt: 10,
  lastSeenAt: 10,
  status: "open",
  deliveredAt: null,
  ownerDeliveredAt: null,
  resolvedAt: null,
  ignoredBy: null,
  ignoredAt: null,
};
const alert: PendingAlert = {
  overlap,
  role: "other",
  withRunName: "bou · livraison · BOU-12",
  withTicketKey: "BOU-12",
};
const alertText = pickAlerts([alert]).text ?? "";

function setup(inner: HookReply | null, pending: PendingAlert[] = [alert]) {
  const log: string[] = [];
  const sink: HookSink = {
    verify: () => true,
    receive: () => {
      log.push("inner");
      return inner;
    },
  };
  const wrapped = withOverlapAlerts(sink, {
    pending: () => pending,
    delivered: (items, at) => log.push(`delivered ${JSON.stringify(items)} ${at}`),
    now: () => 42,
  });
  return { wrapped, log };
}

test("an alert waiting is added to an allow without reason, marked delivered before the reply", () => {
  const { wrapped, log } = setup(null);
  expect(wrapped.receive("r15", hook("PreToolUse"), null)).toEqual({
    kind: "permission",
    decision: "allow",
    reason: "",
    additionalContext: alertText,
  });
  expect(log).toEqual(["inner", `delivered ${JSON.stringify([{ overlapId: "o1", role: "other" }])} 42`]);
});

test("an inner context and the alerts are joined", () => {
  const { wrapped } = setup({
    kind: "permission",
    decision: "allow",
    reason: "ok",
    additionalContext: "rappel",
  });
  expect(wrapped.receive("r15", hook("PreToolUse"), null)).toEqual({
    kind: "permission",
    decision: "allow",
    reason: "ok",
    additionalContext: `rappel\n\n${alertText}`,
  });
});

test("a deny, a stop, another event or no alert leave the inner reply untouched", () => {
  const deny: HookReply = { kind: "permission", decision: "deny", reason: "no", additionalContext: null };
  const denied = setup(deny);
  expect(denied.wrapped.receive("r15", hook("PreToolUse"), null)).toBe(deny);
  expect(denied.log).toEqual(["inner"]);
  const stop: HookReply = { kind: "stop", reason: "fin" };
  expect(setup(stop).wrapped.receive("r15", hook("Stop", null), null)).toBe(stop);
  expect(setup(null).wrapped.receive("r15", hook("PostToolUse"), null)).toBeNull();
  const allow: HookReply = { kind: "permission", decision: "allow", reason: "", additionalContext: null };
  expect(setup(allow, []).wrapped.receive("r15", hook("PreToolUse"), null)).toBe(allow);
});

test("a failing pending lookup never breaks the hook", () => {
  const sink: HookSink = { verify: () => true, receive: () => null };
  const wrapped = withOverlapAlerts(sink, {
    pending: () => {
      throw new Error("db locked");
    },
    delivered: () => undefined,
    now: () => 1,
    log: () => undefined,
  });
  expect(wrapped.receive("r15", hook("PreToolUse"), null)).toBeNull();
});

const homes: string[] = [];
const stores: OverlapStore[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
});

function openStore(): OverlapStore {
  const home = mkdtempSync(join(tmpdir(), "kibo-delivery-"));
  homes.push(home);
  const store = openOverlapStore(home);
  stores.push(store);
  return store;
}

const names = { runName: (id: string) => `run ${id}`, ticketKey: (id: string) => `KEY-${id}` };

test("the store alerts name the other run and are never delivered twice per role", () => {
  const store = openStore();
  const { id: _id, firstSeenAt: _f, ...finding } = overlap;
  const created = store.create(finding, "P", 10);
  const alerts = storeAlerts(store, names);
  expect(alerts.pending("r15")).toMatchObject([
    { role: "other", withRunName: "run r12", withTicketKey: "KEY-r12" },
  ]);
  expect(alerts.pending("r12")).toMatchObject([
    { role: "owner", withRunName: "run r15", withTicketKey: "KEY-r15" },
  ]);
  alerts.delivered([{ overlapId: created.id, role: "other" }], 20);
  expect(alerts.pending("r15")).toEqual([]);
  expect(alerts.pending("r12")).toHaveLength(1);
});
