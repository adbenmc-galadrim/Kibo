import { expect, test } from "bun:test";
import { sha256Hex } from "./hash";

test("sha256Hex gives the hexadecimal SHA-256 of a text", () => {
  expect(sha256Hex("a")).toBe("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
  expect(sha256Hex("é")).toHaveLength(64);
});
