import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";
import { TRACKING_RPC_METHODS } from "./tracking-rpc";

const declare = (ref: unknown, ticketKey = "EMIS-12") =>
  RpcRequest.safeParse({ method: "declareTicketRef", projectId: "p1", ticketKey, ref }).success;

test("a branch or a pull request is declared on a ticket", () => {
  expect(TRACKING_RPC_METHODS).toContain("declareTicketRef");
  expect(declare({ kind: "git_branch", branch: "feat/emis-12", base: "main" })).toBe(true);
  expect(
    declare({
      kind: "github_pr",
      number: 20,
      state: "open",
      url: "https://github.com/galadrimteam/emis-suivi-chantier/pull/20",
    }),
  ).toBe(true);
  expect(declare({ kind: "git_branch", branch: "feat/f5", base: null }, "F5")).toBe(true);
  expect(declare({ kind: "import_ref", source: "plan", id: "C2-5" })).toBe(false);
  expect(declare({ kind: "git_branch", branch: "feat/x", base: null }, "emis-12")).toBe(false);
});
