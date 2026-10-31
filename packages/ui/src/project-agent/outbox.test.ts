import { expect, test } from "bun:test";
import type { RunLogEntry } from "@kibo/schema";
import fc from "fast-check";
import { NOW } from "../lib/fixtures";
import { buildConversation } from "./conversation";
import { CONVERSATION_LOG } from "./fixtures";
import { mergeOutbox, type OutboxItem, settleOutbox } from "./outbox";

const answered = (id: number, at: number, text: string): RunLogEntry => ({
  id,
  at,
  event: { type: "answered", text, rank: 0 },
});

test("a sending message is shown at the end, dropped once the log carries it, kept when it failed", () => {
  const items = buildConversation(CONVERSATION_LOG, [], null);
  const sending: OutboxItem = { id: "o1", text: "Et F5 ?", at: NOW, state: "sending" };
  const merged = mergeOutbox(items, [sending]);
  expect(merged.at(-1)).toMatchObject({ kind: "user", text: "Et F5 ?", pending: "sending" });
  expect(merged).toHaveLength(items.length + 1);
  const logged: RunLogEntry[] = [...CONVERSATION_LOG, answered(10, NOW + 1, "Et F5 ?")];
  expect(settleOutbox([sending], logged)).toEqual([]);
  expect(settleOutbox([sending], CONVERSATION_LOG)).toEqual([sending]);
  const failed: OutboxItem = { ...sending, state: "failed" };
  expect(settleOutbox([failed], logged)).toEqual([failed]);
  expect(mergeOutbox(items, [failed]).at(-1)).toMatchObject({ pending: "failed" });
  fc.assert(
    fc.property(fc.array(fc.string({ minLength: 1 }), { maxLength: 6 }), (texts) => {
      const out = texts.map((text, k): OutboxItem => ({ id: `o${k}`, text, at: NOW + k, state: "sending" }));
      const log = out.map((o, k) => answered(100 + k, o.at + 1, o.text));
      expect(settleOutbox(out, log)).toEqual([]);
      expect(mergeOutbox([], out).filter((i) => i.kind === "user")).toHaveLength(texts.length);
    }),
  );
});

test("an older message with the same text never settles a new one, and each logged message settles one", () => {
  const first: OutboxItem = { id: "o1", text: "Et F5 ?", at: NOW, state: "sending" };
  const second: OutboxItem = { ...first, id: "o2", at: NOW + 5 };
  expect(settleOutbox([first], [answered(1, NOW - 1, "Et F5 ?")])).toEqual([first]);
  expect(settleOutbox([first, second], [answered(1, NOW + 6, "Et F5 ?")])).toEqual([second]);
});
