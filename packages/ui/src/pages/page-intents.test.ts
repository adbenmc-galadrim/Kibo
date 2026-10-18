import { expect, test } from "bun:test";
import { createPageIntents } from "./page-intents";

test("an intent waits for its page, is taken once, and is heard", () => {
  const intents = createPageIntents();
  const heard: number[] = [];
  const stop = intents.subscribe(() => heard.push(1));
  intents.request("p1", { kind: "newQuestion", ticketId: "f5" });
  expect(intents.take("p2")).toBeNull();
  expect(intents.take("p1")?.intent).toEqual({ kind: "newQuestion", ticketId: "f5" });
  expect(intents.take("p1")).toBeNull();
  stop();
  intents.request("p1", { kind: "newFeature" });
  expect(heard).toEqual([1]);
});

test("two equal requests get two tokens, and a request for another page drops the waiting one", () => {
  const intents = createPageIntents();
  intents.request("p1", { kind: "newFeature" });
  const first = intents.take("p1");
  intents.request("p1", { kind: "newFeature" });
  const second = intents.take("p1");
  expect(second?.token).not.toBe(first?.token);
  intents.request("p1", { kind: "newFeature" });
  intents.request("p2", { kind: "newQuestion", ticketId: "f5" });
  expect(intents.take("p1")).toBeNull();
  expect(intents.take("p2")?.intent).toEqual({ kind: "newQuestion", ticketId: "f5" });
});

test("clearing drops any waiting intent", () => {
  const intents = createPageIntents();
  intents.request("p1", { kind: "newFeature" });
  intents.clear();
  expect(intents.take("p1")).toBeNull();
});
