import { describe, expect, test } from "bun:test";
import type { ExternalRef } from "@kibo/schema";
import { runTicketsCommand } from "./tickets";
import { fakeDaemon, fakeTicket } from "./tickets-test-kit";

const BRANCH: ExternalRef = { kind: "git_branch", branch: "feat/envoi-hors-ligne", base: "dev" };

async function set(args: string[], tickets = [fakeTicket({ id: "a", key: "EMIS-33" })]) {
  const d = fakeDaemon(tickets);
  const code = await runTicketsCommand(["set", "EMIS-33", ...args], { project: "EMIS" }, d.io, d.connect);
  return { ...d, code };
}

describe("kibo tickets set branch=", () => {
  test("declares the branch of a ticket", async () => {
    const d = await set(["branch=feat/envoi-hors-ligne"]);
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([
      {
        method: "upsertExternalRef",
        ticketId: "a",
        ref: { kind: "git_branch", branch: "feat/envoi-hors-ligne", base: null },
      },
    ]);
    expect(d.out).toEqual(["✓ EMIS-33 : branch=feat/envoi-hors-ligne"]);
  });

  test("records the base when given", async () => {
    const d = await set(["branch=feat/envoi-hors-ligne", "base=dev"]);
    expect(d.commands()).toEqual([{ method: "upsertExternalRef", ticketId: "a", ref: BRANCH }]);
    expect(d.out).toEqual(["✓ EMIS-33 : branch=feat/envoi-hors-ligne base=dev"]);
  });

  test("refuses an invalid branch name before reaching the daemon", async () => {
    const d = await set(["branch=feat/x y"]);
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Erreur INVALID_INPUT : invalid branch: feat/x y"]);
    expect(d.calls).toEqual([]);
    expect((await set(["branch=feat/x", "base=dev..main"])).code).toBe(1);
  });

  test("needs branch= to accept base=", async () => {
    const d = await set(["base=dev"]);
    expect(d.code).toBe(2);
    expect(d.calls).toEqual([]);
  });

  test("writes the status before the branch", async () => {
    const d = await set(["branch=feat/envoi-hors-ligne", "status=wip"]);
    expect(d.commands().map((c) => c.method)).toEqual(["setStatus", "upsertExternalRef"]);
    expect(d.out).toEqual(["✓ EMIS-33 : status=wip branch=feat/envoi-hors-ligne"]);
  });

  test("leaves a branch already declared as it is", async () => {
    const d = await set(
      ["branch=feat/envoi-hors-ligne", "base=dev"],
      [fakeTicket({ id: "a", key: "EMIS-33", refs: [BRANCH] })],
    );
    expect(d.commands()).toEqual([]);
    expect(d.out).toEqual(["✓ EMIS-33 : déjà à jour"]);
  });
});
