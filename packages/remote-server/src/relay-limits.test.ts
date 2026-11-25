import { describe, expect, test } from "bun:test";
import { createRelay } from "./relay";
import { sealedRequest } from "./testing/fixtures";

describe("relay limits", () => {
  test("at most 64 requests wait for the mac", async () => {
    const relay = createRelay({ deliver: () => true, timeoutMs: 60_000 });
    const waiting = Array.from({ length: 64 }, () => relay.send(sealedRequest()).catch((e: unknown) => e));
    await expect(relay.send(sealedRequest())).rejects.toMatchObject({ code: "RATE_LIMITED" });
    relay.failAll();
    for (const outcome of await Promise.all(waiting))
      expect(outcome).toMatchObject({ code: "REMOTE_UNAVAILABLE" });
  });
});
