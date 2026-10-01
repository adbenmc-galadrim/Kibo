import { expect, test } from "bun:test";
import { ProjectCommand } from "./command";
import { INBOX_ID, INBOX_KEY, inboxAllows, isInbox, RESERVED_PROJECT_KEYS } from "./inbox";
import { RpcRequest } from "./rpc";

test("the inbox has a fixed id and key, and only ticket and link commands", () => {
  expect(isInbox(INBOX_ID)).toBe(true);
  expect(isInbox("p1")).toBe(false);
  expect(RESERVED_PROJECT_KEYS).toEqual([INBOX_KEY]);
  const allowed = [
    "createTicket",
    "updateTicket",
    "setStatus",
    "moveTicket",
    "deleteTicket",
    "addLink",
    "removeLink",
  ] as const;
  expect(allowed.every(inboxAllows)).toBe(true);
  const refused = [
    "addPage",
    "addInstance",
    "addBinding",
    "importExternalTicket",
    "upsertExternalRef",
    "setInstanceData",
  ] as const;
  expect(refused.some(inboxAllows)).toBe(false);
});

test("createTicket accepts a blocked reason and fileTicket is an RPC", () => {
  expect(
    ProjectCommand.parse({ method: "createTicket", title: "A", statusId: "blocked", blockedReason: "Audit" }),
  ).toMatchObject({ blockedReason: "Audit" });
  expect(RpcRequest.parse({ method: "fileTicket", ticketId: "1@1", projectId: "p1" })).toEqual({
    method: "fileTicket",
    ticketId: "1@1",
    projectId: "p1",
  });
  expect(RpcRequest.safeParse({ method: "fileTicket", ticketId: "1@1", projectId: "" }).success).toBe(false);
});
