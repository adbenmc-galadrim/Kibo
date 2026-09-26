import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { matchesSource, readSource } from "./source";

const ticket = (refs: TicketView["externalRefs"]): TicketView => ({
  id: "1@1",
  key: "KIB-1",
  title: "A",
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: refs,
  progress: { done: 0, total: 0 },
  waitingOn: [],
});

test("a synced instance only shows tickets of its binding", () => {
  const source = readSource({ source: { bindingId: "b1" } });
  expect(source).toEqual({ bindingId: "b1" });
  const linked = ticket([
    {
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: 1,
      nodeId: "I",
      url: "https://github.com/adam/kibo/issues/1",
    },
  ]);
  const other = ticket([
    {
      kind: "github_issue",
      bindingId: "b2",
      repo: "adam/kibo",
      number: 2,
      nodeId: "J",
      url: "https://github.com/adam/kibo/issues/2",
    },
  ]);
  expect(matchesSource(linked, source)).toBe(true);
  expect(matchesSource(other, source)).toBe(false);
  expect(matchesSource(ticket([]), source)).toBe(false);
  expect(matchesSource(ticket([]), null)).toBe(true);
  expect(readSource({ source: { bindingId: 3 } })).toBeNull();
  expect(readSource({})).toBeNull();
});
