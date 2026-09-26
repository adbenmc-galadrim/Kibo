import { expect, test } from "bun:test";
import { parseIntegrationFlags } from "./bootstrap";

const ORIGIN = "api.github.com=http://127.0.0.1:4391";

test("test origins and memory secrets go together", () => {
  expect(parseIntegrationFlags({})).toEqual({ testOrigins: [], memorySecrets: false });
  expect(parseIntegrationFlags({ "test-origins": ORIGIN, "memory-secrets": true })).toEqual({
    testOrigins: [ORIGIN],
    memorySecrets: true,
  });
  expect(() => parseIntegrationFlags({ "memory-secrets": true })).toThrow("INVALID_INPUT");
  expect(() => parseIntegrationFlags({ "test-origins": ORIGIN })).toThrow("INVALID_INPUT");
});

test("a malformed test origin stops the daemon at startup", () => {
  expect(() =>
    parseIntegrationFlags({
      "test-origins": "api.github.com=https://api.github.com",
      "memory-secrets": true,
    }),
  ).toThrow("INVALID_INPUT");
  expect(() => parseIntegrationFlags({ "test-origins": "nope", "memory-secrets": true })).toThrow(
    "INVALID_INPUT",
  );
});
