import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanPublishHomes, hashOf, ID, publishedAi as published, setup } from "./testing/publish-setup";

cleanPublishHomes();

const input = (hash: string) => ({
  draftId: ID,
  version: "0.1.0",
  hash,
  trust: "sandboxed" as const,
  strategy: "update-all" as const,
  target: { projectId: "p1", pageId: "pg1" },
});

describe("finalize", () => {
  test("installs the source without Kibo files, publishes as ai, approves the stored hash, adds the instance", async () => {
    const s = await setup({ status: "permissions" });
    const hash = hashOf(s.paths.dir);
    const result = await s.publisher.finalize(input(hash));
    expect(readFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "utf8")).toBe("new");
    expect(existsSync(join(s.srcRoot, "burndown", "CLAUDE.md"))).toBe(false);
    expect(s.published).toEqual(["burndown:update-all:ai"]);
    expect(s.approved).toEqual([{ id: "burndown", version: "0.1.0", hash, trust: "sandboxed" }]);
    expect(s.instances).toEqual(["burndown@0.1.0"]);
    expect(result).toMatchObject({
      version: { version: "0.1.0", trust: "sandboxed" },
      instanceId: "i1",
      publish: { needsApproval: true },
    });
    expect(s.store.get(ID).status).toBe("done");
    expect(existsSync(s.paths.dir)).toBe(false);
  });

  test("an already approved republication is not approved twice", async () => {
    const s = await setup({ status: "permissions", alreadyApproved: true });
    const result = await s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null });
    expect(s.approved).toEqual([]);
    expect(result).toMatchObject({ version: { trust: "sandboxed" }, instanceId: null });
  });

  test("a changed draft is HASH_MISMATCH and nothing is published", async () => {
    const s = await setup({ status: "permissions" });
    await expect(s.publisher.finalize(input("b".repeat(64)))).rejects.toThrow("HASH_MISMATCH");
    expect(s.published).toEqual([]);
  });

  test("a double click publishes once", async () => {
    const s = await setup({ status: "permissions" });
    const hash = hashOf(s.paths.dir);
    const results = await Promise.allSettled([
      s.publisher.finalize(input(hash)),
      s.publisher.finalize(input(hash)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(s.published).toHaveLength(1);
  });

  test("a missing page is refused before publishing", async () => {
    const s = await setup({ status: "permissions" });
    await expect(
      s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: { projectId: "p1", pageId: "gone" } }),
    ).rejects.toThrow("NOT_FOUND");
    expect(s.published).toEqual([]);
  });

  test("modify: a failed publication restores the previous source", async () => {
    const s = await setup({ mode: "modify", status: "permissions", published, publishFails: true });
    await expect(s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null })).rejects.toThrow(
      "build failed",
    );
    expect(readFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "utf8")).toBe("old");
    expect(s.store.get(ID).status).toBe("permissions");
  });

  test("modify: a source edited since the draft started is CONFLICT", async () => {
    const s = await setup({ mode: "modify", status: "permissions", published });
    writeFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "edited by hand");
    await expect(s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null })).rejects.toThrow(
      "CONFLICT",
    );
  });

  test("the same version published by the user is refused, never reused without the trust screen", async () => {
    for (const mode of ["create", "modify"] as const) {
      const s = await setup({ mode, status: "permissions", published: { ...published, origin: "user" } });
      const pending = s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null });
      await expect(pending).rejects.toThrow("INVALID_INPUT");
      expect(s.published).toEqual([]);
      expect(s.store.get(ID).status).toBe("permissions");
    }
  });

  test("a version below the published one is refused", async () => {
    const s = await setup({
      mode: "modify",
      status: "permissions",
      published: { ...published, version: "0.2.0" },
    });
    await expect(s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null })).rejects.toThrow(
      "INVALID_INPUT",
    );
    expect(s.published).toEqual([]);
  });
});

describe("finalize guards", () => {
  test("a stored hash other than the reviewed one is HASH_MISMATCH and the previous source is restored", async () => {
    const s = await setup({
      mode: "modify",
      status: "permissions",
      published: { ...published, version: "0.0.9" },
      storedHash: "c".repeat(64),
    });
    await expect(s.publisher.finalize(input(hashOf(s.paths.dir)))).rejects.toThrow("HASH_MISMATCH");
    expect(s.approved).toEqual([]);
    expect(s.instances).toEqual([]);
    expect(s.store.get(ID).status).toBe("permissions");
    expect(readFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "utf8")).toBe("old");
  });

  test("create: an unrelated components/src/<id> is CONFLICT and stays untouched", async () => {
    const s = await setup({ status: "permissions" });
    const dir = join(s.srcRoot, "burndown");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "kibo.component.json"), readFileSync(join(s.paths.dir, "kibo.component.json")));
    writeFileSync(join(dir, "ui.tsx"), "someone else");
    await expect(s.publisher.finalize(input(hashOf(s.paths.dir)))).rejects.toThrow("CONFLICT");
    expect(s.published).toEqual([]);
    expect(readFileSync(join(dir, "ui.tsx"), "utf8")).toBe("someone else");
  });

  test("a version other than the reviewed one is INVALID_INPUT", async () => {
    const s = await setup({ status: "permissions" });
    const pending = s.publisher.finalize({ ...input(hashOf(s.paths.dir)), version: "0.2.0" });
    await expect(pending).rejects.toThrow("INVALID_INPUT");
    expect(s.published).toEqual([]);
  });

  test("resuming after a crash republishes the same ai version already installed", async () => {
    const s = await setup({ mode: "modify", status: "permissions", published, alreadyApproved: true });
    writeFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "new");
    const result = await s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null });
    expect(result).toMatchObject({ version: { version: "0.1.0" }, instanceId: null });
    expect(s.published).toHaveLength(1);
    expect(s.approved).toEqual([]);
    expect(s.store.get(ID).status).toBe("done");
  });

  test("resuming applies the trust chosen on the trust screen", async () => {
    const s = await setup({ mode: "modify", status: "permissions", published, alreadyApproved: true });
    const hash = hashOf(s.paths.dir);
    const result = await s.publisher.finalize({ ...input(hash), trust: "trusted", target: null });
    expect(s.approved).toEqual([{ id: "burndown", version: "0.1.0", hash, trust: "trusted" }]);
    expect(result.version.trust).toBe("trusted");
  });

  test("the draft is reported as processing only while finalizing", async () => {
    const s = await setup({ status: "permissions" });
    const pending = s.publisher.finalize(input(hashOf(s.paths.dir)));
    expect(s.publisher.isProcessing(ID)).toBe(true);
    await pending;
    expect(s.publisher.isProcessing(ID)).toBe(false);
  });
});

describe("idle", () => {
  test("resolves at once when nothing is being processed", async () => {
    const s = await setup({ status: "permissions" });
    await s.publisher.idle();
    expect(s.published).toEqual([]);
  });

  test("waits for a finalization in progress to end", async () => {
    const s = await setup({ status: "permissions", publishDelayMs: 30 });
    const finalizing = s.publisher.finalize(input(hashOf(s.paths.dir)));
    await s.publisher.idle();
    expect(s.store.get(ID).status).toBe("done");
    expect(s.publisher.isProcessing(ID)).toBe(false);
    await finalizing;
  });

  test("resolves after a failed finalization without rethrowing it", async () => {
    const s = await setup({ status: "permissions", publishDelayMs: 30, publishFails: true });
    const finalizing = s.publisher.finalize(input(hashOf(s.paths.dir)));
    await s.publisher.idle();
    expect(s.publisher.isProcessing(ID)).toBe(false);
    await expect(finalizing).rejects.toThrow("build failed");
  });
});
