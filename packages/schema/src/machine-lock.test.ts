import { expect, test } from "bun:test";
import { type MachineLock, machineLocks } from "./machine-lock";

const LOCK: MachineLock = {
  name: "heavy",
  max: 2,
  held: [{ ticket: "emis:EMIS-15", label: "gates", pid: 42, since: 1, cwd: "/tmp/x", alive: true }],
  waiting: [],
};

test("machine locks default to an empty list", () => {
  expect(machineLocks({})).toEqual([]);
  expect(machineLocks({ locks: [LOCK] })).toEqual([LOCK]);
});
