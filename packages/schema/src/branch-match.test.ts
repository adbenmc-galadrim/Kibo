import { expect, test } from "bun:test";
import { matchBranchToTicket, stripRemote } from "./branch-match";

const TICKETS = [
  { id: "t3", key: "SILO-3" },
  { id: "t30", key: "SILO-30" },
  { id: "t33", key: "SILO-33" },
  { id: "pending", key: null },
];

test("a branch names a ticket by its key between word bounds, case ignored", () => {
  expect(matchBranchToTicket("feat/silo-33-envoi-hors-ligne", TICKETS)).toBe("t33");
  expect(matchBranchToTicket("fix/SILO-33-bis", TICKETS)).toBe("t33");
  expect(matchBranchToTicket("SILO-33", TICKETS)).toBe("t33");
  expect(matchBranchToTicket("feat/silo-3", TICKETS)).toBe("t3");
  expect(matchBranchToTicket("feat/silo-3-photos", TICKETS)).toBe("t3");
});

test("a key glued to other digits or letters does not match", () => {
  expect(matchBranchToTicket("feat/silo-330", TICKETS)).toBeNull();
  expect(matchBranchToTicket("feat/xsilo-33", TICKETS)).toBeNull();
  expect(
    matchBranchToTicket("feat/silo-3", [
      { id: "t33", key: "SILO-33" },
      { id: "t30", key: "SILO-30" },
    ]),
  ).toBeNull();
  expect(matchBranchToTicket("main", TICKETS)).toBeNull();
});

test("a branch that names two tickets binds none", () => {
  expect(matchBranchToTicket("feat/silo-3-and-silo-33", TICKETS)).toBeNull();
});

test("the remote prefix is stripped", () => {
  expect(stripRemote("origin/feat/silo-33")).toBe("feat/silo-33");
  expect(stripRemote("feat/silo-33")).toBe("feat/silo-33");
  expect(stripRemote("refs/remotes/upstream/main")).toBe("main");
  expect(stripRemote("refs/heads/feat/silo-33")).toBe("feat/silo-33");
});
