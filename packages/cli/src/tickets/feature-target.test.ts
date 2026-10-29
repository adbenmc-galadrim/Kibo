import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { fakeSnapshot } from "../commands/tickets-test-kit";
import { featureOf } from "./feature-target";

const snapshot = fakeSnapshot();

const failure = (raw: string): KiboError => {
  try {
    featureOf(snapshot, raw);
  } catch (e) {
    if (e instanceof KiboError) return e;
  }
  throw new Error(`featureOf(${raw}) did not fail`);
};

test("a short key gives its feature", () => {
  expect(featureOf(snapshot, "F5").key).toBe("SILO-30");
  expect(featureOf(snapshot, "f5").id).toBe("f5");
});

test("the key of a root ticket gives itself", () => {
  expect(featureOf(snapshot, "SILO-30").id).toBe("f5");
});

test("a step is refused with its feature named", () => {
  const e = failure("SILO-33");
  expect(e.code).toBe("INVALID_INPUT");
  expect(e.detail).toBe("SILO-33 is a step of F5: give the feature");
});

test("an unknown ticket is not found", () => {
  expect(failure("F9").code).toBe("NOT_FOUND");
});
