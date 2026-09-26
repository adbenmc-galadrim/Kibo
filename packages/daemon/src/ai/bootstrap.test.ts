import { expect, test } from "bun:test";
import { createAiStop } from "./bootstrap";
import { cleanPublishHomes, hashOf, ID, setup } from "./testing/publish-setup";

cleanPublishHomes();

test("stop aborts the AI work, then waits for a finalization in progress to end", async () => {
  const s = await setup({ status: "permissions", publishDelayMs: 30 });
  const shutdown = new AbortController();
  const stop = createAiStop(shutdown, [s.publisher]);
  const finalizing = s.publisher.finalize({
    draftId: ID,
    version: "0.1.0",
    hash: hashOf(s.paths.dir),
    trust: "sandboxed",
    strategy: "update-all",
    target: null,
  });
  await stop();
  expect(shutdown.signal.aborted).toBe(true);
  expect(s.store.get(ID).status).toBe("done");
  expect(s.publisher.isProcessing(ID)).toBe(false);
  await finalizing;
});
