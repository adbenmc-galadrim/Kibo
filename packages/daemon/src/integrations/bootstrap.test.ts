import { expect, test } from "bun:test";
import { parseIntegrationFlags } from "./bootstrap";

test("memory secrets require test origins", () => {
  expect(parseIntegrationFlags({})).toEqual({ testOrigins: [], memorySecrets: false });
  expect(parseIntegrationFlags({ "test-origins": "api.github.com=http://127.0.0.1:4391" })).toEqual({
    testOrigins: ["api.github.com=http://127.0.0.1:4391"],
    memorySecrets: false,
  });
  expect(() => parseIntegrationFlags({ "memory-secrets": true })).toThrow("INVALID_INPUT");
});

test("a malformed test origin stops the daemon at startup", () => {
  expect(() => parseIntegrationFlags({ "test-origins": "api.github.com=https://api.github.com" })).toThrow(
    "INVALID_INPUT",
  );
  expect(() => parseIntegrationFlags({ "test-origins": "nope" })).toThrow("INVALID_INPUT");
});
