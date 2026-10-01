import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import {
  assertInboxCommand,
  assertNotInbox,
  assertNotInboxForAgents,
  assertProjectKeyAllowed,
} from "./inbox-rules";

const codeOf = (fn: () => void): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.message : String(e);
  }
};

test("the inbox accepts ticket and link commands only", () => {
  expect(codeOf(() => assertInboxCommand({ method: "createTicket", title: "A" }))).toBeNull();
  expect(codeOf(() => assertInboxCommand({ method: "removeLink", linkId: "l" }))).toBeNull();
  expect(codeOf(() => assertInboxCommand({ method: "addPage", title: "P", kind: "dashboard" }))).toBe(
    "INVALID_INPUT: the inbox only holds tickets",
  );
  expect(codeOf(() => assertInboxCommand({ method: "removeBinding", bindingId: "b" }))).toBe(
    "INVALID_INPUT: the inbox only holds tickets",
  );
});

test("project operations are refused on the inbox only", () => {
  expect(codeOf(() => assertNotInbox("inbox", "sharing"))).toBe(
    "INVALID_INPUT: sharing is not available for the inbox",
  );
  expect(codeOf(() => assertNotInbox("p1", "sharing"))).toBeNull();
  expect(codeOf(() => assertNotInboxForAgents("inbox"))).toBe(
    "INVALID_INPUT: inbox tickets cannot be assigned to an agent",
  );
  expect(codeOf(() => assertNotInboxForAgents("p1"))).toBeNull();
});

test("the inbox key is reserved for new projects", () => {
  expect(codeOf(() => assertProjectKeyAllowed("INB"))).toBe("INVALID_INPUT: project key INB is reserved");
  expect(codeOf(() => assertProjectKeyAllowed("KIB"))).toBeNull();
});
