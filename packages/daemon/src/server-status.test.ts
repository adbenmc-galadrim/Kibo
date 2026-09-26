import { expect, test } from "bun:test";
import { STATUS } from "./http-response";

test("phase 7 codes map to HTTP statuses", () => {
  expect(STATUS).toMatchObject({
    UPDATE_REJECTED: 409,
    ACCESS_REVOKED: 403,
    INVITE_INVALID: 400,
    DEVICE_REVOKED: 401,
    TLS_REQUIRED: 400,
    SYNC_OFFLINE: 503,
    SIGNATURE_INVALID: 422,
    PUBLISHER_CHANGED: 409,
    REVOKED: 410,
    INDEX_ROLLBACK: 409,
  });
});

test("existing mappings are unchanged", () => {
  expect(STATUS).toMatchObject({
    NOT_FOUND: 404,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    RATE_LIMITED: 429,
    QUOTA_EXCEEDED: 413,
    SANDBOX_UNAVAILABLE: 503,
    AI_UNAVAILABLE: 503,
  });
});
