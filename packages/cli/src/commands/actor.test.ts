import { describe, expect, test } from "bun:test";
import { cliActor } from "./actor";

describe("cliActor", () => {
  test("the viewer of the daemon writes as a human", () => {
    expect(cliActor({ viewer: "u-me" })).toEqual({ kind: "human", ref: "u-me" });
  });

  test("without a viewer the actor is cli", () => {
    expect(cliActor({})).toEqual({ kind: "human", ref: "cli" });
  });
});
