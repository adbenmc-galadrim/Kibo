import { expect, test } from "bun:test";
import { sampleGlb } from "./fixtures";

test("the sample glb is a binary gltf of version 2 whose header gives its length", () => {
  const bytes = sampleGlb();
  expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("glTF");
  expect(new DataView(bytes.buffer).getUint32(4, true)).toBe(2);
  expect(new DataView(bytes.buffer).getUint32(8, true)).toBe(bytes.byteLength);
});
