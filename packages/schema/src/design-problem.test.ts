import { expect, test } from "bun:test";
import { type DesignProvider, frameProblemOf, KiboError, type KiboErrorCode } from "./index";

const of = (code: KiboErrorCode, provider: DesignProvider = "penpot") =>
  frameProblemOf(new KiboError(code, "x"), provider);

test("each error code has one cause, by provider", () => {
  expect(of("NOT_CONNECTED")).toEqual({ kind: "notConnected", code: "NOT_CONNECTED" });
  expect(of("REMOTE_REJECTED")).toEqual({ kind: "tokenRefused", code: "REMOTE_REJECTED" });
  expect(of("TOKEN_IGNORED")).toEqual({ kind: "tokenRefused", code: "TOKEN_IGNORED" });
  expect(of("INVALID_INPUT")).toEqual({ kind: "otherInstance", code: "INVALID_INPUT" });
  expect(of("PERMISSION_DENIED")).toEqual({ kind: "otherInstance", code: "PERMISSION_DENIED" });
  expect(of("INVALID_INPUT", "figma")).toEqual({ kind: "unavailable", code: "INVALID_INPUT" });
  expect(of("REMOTE_NOT_FOUND")).toEqual({ kind: "notFound", code: "REMOTE_NOT_FOUND" });
  expect(of("REMOTE_NOT_RENDERED")).toEqual({ kind: "noThumbnail", code: "REMOTE_NOT_RENDERED" });
  expect(of("REMOTE_UNAVAILABLE").kind).toBe("unreachable");
  expect(of("TIMEOUT").kind).toBe("unreachable");
  expect(of("RATE_LIMITED").kind).toBe("rateLimited");
  expect(of("MCP_UNAVAILABLE", "figma").kind).toBe("mcpClosed");
  expect(of("INTERNAL")).toEqual({ kind: "unavailable", code: "INTERNAL" });
  expect(frameProblemOf(new Error("boom"), "figma")).toEqual({ kind: "unavailable", code: null });
});
