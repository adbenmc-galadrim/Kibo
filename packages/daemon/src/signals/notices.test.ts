import { expect, test } from "bun:test";
import { blockerNotice } from "./notices";

test("a blocker notice names the run, the ticket and the title", () => {
  expect(
    blockerNotice({ label: "opus-dev-3" }, { ticketKey: "KIB-16", title: "Attend le schéma Loro" }),
  ).toEqual({
    title: "Blocage signalé par opus-dev-3",
    body: "KIB-16 · Attend le schéma Loro",
  });
});
