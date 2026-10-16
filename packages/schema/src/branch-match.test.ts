import { expect, test } from "bun:test";
import { matchBranchToTicket, stripRemote } from "./branch-match";

const TICKETS = [
  { id: "t3", key: "EMIS-3" },
  { id: "t30", key: "EMIS-30" },
  { id: "t33", key: "EMIS-33" },
  { id: "pending", key: null },
];

test("a branch names a ticket by its key between word bounds, case ignored", () => {
  expect(matchBranchToTicket("feat/emis-33-envoi-hors-ligne", TICKETS)).toBe("t33");
  expect(matchBranchToTicket("fix/EMIS-33-bis", TICKETS)).toBe("t33");
  expect(matchBranchToTicket("EMIS-33", TICKETS)).toBe("t33");
  expect(matchBranchToTicket("feat/emis-3", TICKETS)).toBe("t3");
  expect(matchBranchToTicket("feat/emis-3-photos", TICKETS)).toBe("t3");
});

test("a key glued to other digits or letters does not match", () => {
  expect(matchBranchToTicket("feat/emis-330", TICKETS)).toBeNull();
  expect(matchBranchToTicket("feat/xemis-33", TICKETS)).toBeNull();
  expect(
    matchBranchToTicket("feat/emis-3", [
      { id: "t33", key: "EMIS-33" },
      { id: "t30", key: "EMIS-30" },
    ]),
  ).toBeNull();
  expect(matchBranchToTicket("main", TICKETS)).toBeNull();
});

test("a branch that names two tickets binds none", () => {
  expect(matchBranchToTicket("feat/emis-3-and-emis-33", TICKETS)).toBeNull();
});

test("the remote prefix is stripped", () => {
  expect(stripRemote("origin/feat/emis-33")).toBe("feat/emis-33");
  expect(stripRemote("feat/emis-33")).toBe("feat/emis-33");
  expect(stripRemote("refs/remotes/upstream/main")).toBe("main");
  expect(stripRemote("refs/heads/feat/emis-33")).toBe("feat/emis-33");
});
