import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanPublishHomes, hashOf, ID, publishedAi as published, setup } from "./testing/publish-setup";

cleanPublishHomes();

const OTHER = "22222222-2222-4222-8222-222222222222";
const finalizeOf = (draftId: string, version: string, dir: string) => ({
  draftId,
  version,
  hash: hashOf(dir),
  trust: "sandboxed" as const,
  strategy: "new-version" as const,
  target: null,
});

describe("two drafts of the same component", () => {
  test("a second active draft in the same store is refused", async () => {
    const s = await setup({ mode: "modify", status: "permissions" });
    await expect(s.addDraft(OTHER, "other", "0.1.1")).rejects.toThrow("CONFLICT");
    expect(s.store.active().map((d) => d.id)).toEqual([ID]);
  });

  for (const mode of ["create", "modify"] as const) {
    test(`${mode}: finalized together, one publishes and the other is CONFLICT`, async () => {
      const s = await setup({
        mode,
        status: "permissions",
        published: mode === "modify" ? { ...published, version: "0.0.9" } : null,
        publishDelayMs: 20,
      });
      const other = await s.addLegacyDraft(OTHER, "other", "0.1.1");
      const results = await Promise.allSettled([
        s.publisher.finalize(finalizeOf(ID, "0.1.0", s.paths.dir)),
        s.publisher.finalize(finalizeOf(OTHER, "0.1.1", other.dir)),
      ]);
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
      expect(String(results[1]?.status === "rejected" && results[1].reason)).toContain("CONFLICT");
      expect(s.published).toHaveLength(1);
      expect(s.sources).toEqual(["new"]);
      expect(readFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "utf8")).toBe("new");
      expect(readdirSync(s.srcRoot)).toEqual(["burndown"]);
      expect(s.store.get(OTHER).status).toBe("permissions");
      expect(existsSync(other.dir)).toBe(true);
      expect(s.publisher.isProcessing(OTHER)).toBe(false);
    });
  }

  test("the component is released after a failed finalize", async () => {
    const s = await setup({
      mode: "modify",
      status: "permissions",
      published: { ...published, version: "0.0.9" },
    });
    const other = await s.addLegacyDraft(OTHER, "other", "0.1.1");
    await expect(s.publisher.finalize(finalizeOf(ID, "0.2.0", s.paths.dir))).rejects.toThrow("INVALID_INPUT");
    await s.publisher.finalize(finalizeOf(OTHER, "0.1.1", other.dir));
    expect(s.sources).toEqual(["other"]);
    expect(s.store.get(OTHER).status).toBe("done");
  });

  test("the second draft finalized afterwards is CONFLICT and leaves the published source intact", async () => {
    const s = await setup({
      mode: "modify",
      status: "permissions",
      published: { ...published, version: "0.0.9" },
    });
    const other = await s.addLegacyDraft(OTHER, "other", "0.1.1");
    await s.publisher.finalize(finalizeOf(ID, "0.1.0", s.paths.dir));
    await expect(s.publisher.finalize(finalizeOf(OTHER, "0.1.1", other.dir))).rejects.toThrow("CONFLICT");
    expect(s.published).toHaveLength(1);
    expect(readFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "utf8")).toBe("new");
    expect(s.store.get(OTHER).status).toBe("permissions");
  });
});

describe("retry after a hash mismatch", () => {
  for (const mode of ["create", "modify"] as const) {
    test(`${mode}: the leftover ai version is VERSION_EXISTS, then a higher version publishes`, async () => {
      const s = await setup({
        mode,
        status: "permissions",
        published: mode === "modify" ? { ...published, version: "0.0.9" } : null,
        storedHash: "c".repeat(64),
      });
      await expect(s.publisher.finalize(finalizeOf(ID, "0.1.0", s.paths.dir))).rejects.toThrow(
        "HASH_MISMATCH",
      );
      const retry = s.publisher.finalize(finalizeOf(ID, "0.1.0", s.paths.dir));
      await expect(retry).rejects.toThrow("VERSION_EXISTS: 0.1.0 is already published with other sources");
      await expect(s.publisher.finalize(finalizeOf(ID, "0.1.0", s.paths.dir))).rejects.toThrow(
        "higher version",
      );
      expect(s.published).toHaveLength(1);
      expect(s.store.get(ID).status).toBe("permissions");
      await expect(s.publisher.review({ draftId: ID, version: "0.1.0", changes: [] })).rejects.toThrow(
        "INVALID_INPUT",
      );
      const reviewed = await s.publisher.review({ draftId: ID, version: "0.1.1", changes: ["Titre"] });
      expect(reviewed).toMatchObject({
        status: "permissions",
        publish: { to: "0.1.1", hash: hashOf(s.paths.dir) },
      });
      const result = await s.publisher.finalize(finalizeOf(ID, "0.1.1", s.paths.dir));
      expect(result.version.version).toBe("0.1.1");
      expect(s.store.get(ID).status).toBe("done");
    });
  }

  test("a leftover ai version with the reviewed hash is resumed, not refused", async () => {
    const s = await setup({ mode: "modify", status: "permissions", published, alreadyApproved: true });
    const result = await s.publisher.finalize(finalizeOf(ID, "0.1.0", s.paths.dir));
    expect(result.version.version).toBe("0.1.0");
  });

  test("a leftover ai version with another hash is refused before anything is installed", async () => {
    const s = await setup({
      mode: "modify",
      status: "permissions",
      published: { ...published, hash: "d".repeat(64) },
    });
    await expect(s.publisher.finalize(finalizeOf(ID, "0.1.0", s.paths.dir))).rejects.toThrow(
      "higher version",
    );
    expect(s.published).toEqual([]);
    expect(readFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "utf8")).toBe("old");
  });
});
