import { expect, test } from "bun:test";
import { createSelectionBus } from "./selection-bus";

test("a page bus relays only to participants and logs the others", () => {
  const bus = createSelectionBus();
  const lines: string[] = [];
  const a = bus.api(true);
  const b = bus.api(true);
  const c = bus.api(false, (l) => lines.push(l));
  let hits = 0;
  let outsider = 0;
  b.subscribe(() => hits++);
  c.subscribe(() => outsider++);
  a.set({ kind: "ticket", ids: ["t1"] });
  expect(b.get()).toEqual({ kind: "ticket", ids: ["t1"] });
  expect(hits).toBe(1);
  expect(c.get()).toBeNull();
  expect(outsider).toBe(0);
  c.set({ kind: "ticket", ids: ["t2"] });
  expect(bus.current()).toEqual({ kind: "ticket", ids: ["t1"] });
  expect(lines).toEqual(["selection ignored: the component does not declare selection"]);
  a.set(null);
  expect(b.get()).toBeNull();
  expect(hits).toBe(2);
});

test("two pages never share a selection", () => {
  const one = createSelectionBus();
  const two = createSelectionBus();
  one.api(true).set({ kind: "ticket", ids: ["t1"] });
  expect(two.api(true).get()).toBeNull();
});
