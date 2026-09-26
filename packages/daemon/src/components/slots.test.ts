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
