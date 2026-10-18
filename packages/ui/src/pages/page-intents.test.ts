import { expect, test } from "bun:test";
import { createPageIntents } from "./page-intents";

test("an intent waits for its page, is taken once, and is heard", () => {
  const intents = createPageIntents();
  const heard: number[] = [];
  const stop = intents.subscribe(() => heard.push(1));
  intents.set("p1", { kind: "newQuestion", ticketId: "f5" });
  expect(intents.peek("p2")).toBeNull();
  expect(intents.peek("p1")).toEqual({ kind: "newQuestion", ticketId: "f5" });
  expect(intents.take("p1")).toEqual({ kind: "newQuestion", ticketId: "f5" });
  expect(intents.peek("p1")).toBeNull();
  expect(intents.take("p1")).toBeNull();
  stop();
  intents.set("p1", { kind: "newFeature" });
  expect(heard).toEqual([1, 1]);
});
