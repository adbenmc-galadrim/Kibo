import { expect, test } from "bun:test";
import type { ProjectEvent } from "@kibo/schema";
import { fr } from "./fr";
import { slippedFrom } from "./slipped-from";

const event = (id: number, ticketId: string, from: string | null, to: string | null): ProjectEvent => ({
  id,
  projectId: "p",
  at: id * 1000,
  kind: "sprint_set",
  ticketId,
  featureId: ticketId,
  source: "user",
  data: { from, to },
});

test("the last sprint_set of the feature says where it slipped from", () => {
  const events = [event(3, "f1", "S42", "S43"), event(1, "f1", null, "S42"), event(2, "f2", "S41", "S42")];
  expect(slippedFrom(events, "f1")).toBe("S42");
  expect(fr.slipped("S42")).toBe("glissée de S42");
});

test("a first planning or no event says nothing", () => {
  expect(slippedFrom([event(1, "f1", null, "S42")], "f1")).toBeNull();
  expect(slippedFrom([], "f1")).toBeNull();
  expect(slippedFrom([{ ...event(4, "f1", "S42", "S43"), kind: "status_changed" }], "f1")).toBeNull();
});

test("only the latest move counts, in any order", () => {
  expect(slippedFrom([event(1, "f1", "S41", "S42"), event(5, "f1", null, "S43")], "f1")).toBeNull();
});
