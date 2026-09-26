import { expect, test } from "bun:test";
import { SYNC_PROTOCOL_VERSION } from "./index";

test("sync-server package is wired", () => {
  expect(SYNC_PROTOCOL_VERSION).toBe(1);
});
