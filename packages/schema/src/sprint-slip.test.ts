import { expect, test } from "bun:test";
import type { ProjectEvent } from "./project-event";
import { slippedFrom, sprintOrigins } from "./sprint-slip";

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
  expect(sprintOrigins(events, "f1")).toEqual(["S42"]);
});

test("a first planning, another kind or no event says nothing", () => {
  expect(slippedFrom([event(1, "f1", null, "S42")], "f1")).toBeNull();
  expect(slippedFrom([], "f1")).toBeNull();
  expect(slippedFrom([{ ...event(4, "f1", "S42", "S43"), kind: "status_changed" }], "f1")).toBeNull();
  expect(sprintOrigins([], "f1")).toEqual([]);
});

test("a feature that slipped twice keeps both origins, in order", () => {
  const events = [event(5, "f1", "S43", "S44"), event(1, "f1", null, "S42"), event(3, "f1", "S42", "S43")];
  expect(sprintOrigins(events, "f1")).toEqual(["S42", "S43"]);
  expect(slippedFrom(events, "f1")).toBe("S43");
});

test("planning again from no sprint forgets the earlier slips", () => {
  const events = [event(1, "f1", "S41", "S42"), event(5, "f1", null, "S43")];
  expect(sprintOrigins(events, "f1")).toEqual([]);
  expect(slippedFrom(events, "f1")).toBeNull();
});

test("an origin is listed once, and a non-text origin counts as none", () => {
  const events = [event(1, "f1", "S42", "S43"), event(2, "f1", "S43", "S42"), event(3, "f1", "S42", "S44")];
  expect(sprintOrigins(events, "f1")).toEqual(["S43", "S42"]);
  const odd = { ...event(4, "f1", "S42", "S43"), data: { from: 42, to: "S43" } };
  expect(sprintOrigins([odd], "f1")).toEqual([]);
});
