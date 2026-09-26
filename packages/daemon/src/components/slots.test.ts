import { expect, test } from "bun:test";
import { createSlots } from "./slots";

test("slots are handed over in order and never oversubscribed", async () => {
  const slots = createSlots(1);
  const order: number[] = [];
  await slots.acquire();
  const second = slots.acquire().then(() => order.push(2));
  const third = slots.acquire().then(() => order.push(3));
  expect(slots.busy).toBe(1);
  slots.release();
  await second;
  expect(slots.busy).toBe(1);
  slots.release();
  await third;
  slots.release();
  expect(order).toEqual([2, 3]);
  expect(slots.busy).toBe(0);
});

test("a bounded wait times out and leaves the queue", async () => {
  const slots = createSlots(1);
  await slots.acquire();
  await expect(slots.acquire(20)).rejects.toThrow("TIMEOUT");
  const next = slots.acquire(1_000);
  slots.release();
  await next;
  expect(slots.busy).toBe(1);
  slots.release();
  expect(slots.busy).toBe(0);
});
