import { expect, test } from "bun:test";
import { capacityTone } from "./capacity-tone";

const S41 = { id: "s41" };
const S42 = { id: "s42" };
const S43 = { id: "s43" };
const S44 = { id: "s44" };

test("amber only for the current or next sprint when over; neutral otherwise", () => {
  expect(capacityTone(S42, S42, S43, true)).toBe("amber");
  expect(capacityTone(S43, S42, S43, true)).toBe("amber");
  expect(capacityTone(S41, S42, S43, true)).toBe("neutral");
  expect(capacityTone(S44, S42, S43, true)).toBe("neutral");
  expect(capacityTone(S42, S42, S43, false)).toBe("neutral");
  expect(capacityTone(S43, null, null, true)).toBe("neutral");
});
