import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { createFileHistory } from "./file-history";
import { contentHash } from "./guarded-write";
import { makeTestHome } from "./test-home.test-helper";
import { versionedWrite } from "./versioned-write";

const step = fc.record({ external: fc.array(fc.string(), { maxLength: 3 }), mine: fc.string() });

test("a save never overwrites a content written on the disk after the read", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), fc.array(step, { minLength: 1, maxLength: 6 }), async (initial, steps) => {
      const h = makeTestHome();
      const history = createFileHistory({ home: h.kiboHome, db: h.db });
      const path = join(h.claudeHome, "agents", "a.md");
      h.write(path, initial);
      const write = (content: string, baseHash: string) =>
        versionedWrite({
          history,
          kind: "agents",
          ref: "global:a",
          file: "agent.md",
          path,
          content,
          baseHash,
          mode: 0o644,
          origin: "kibo",
          by: "adam",
        });
      for (const { external, mine } of steps) {
        const baseHash = contentHash(readFileSync(path, "utf8"));
        for (const e of external) writeFileSync(path, e);
        const disk = readFileSync(path, "utf8");
        const result = await write(mine, baseHash);
        if (contentHash(disk) !== baseHash) {
          expect(result.kind).toBe("conflict");
          expect(readFileSync(path, "utf8")).toBe(disk);
          const forced = await write(mine, contentHash(disk));
          expect(forced.kind).toBe("written");
          expect(history.latest("agents", "global:a", "agent.md")).toMatchObject({
            origin: "kibo",
            hash: contentHash(mine),
          });
          expect(history.hasHash("agents", "global:a", "agent.md", contentHash(disk))).toBe(true);
        } else {
          expect(result.kind).toBe("written");
          expect(history.latest("agents", "global:a", "agent.md")).toMatchObject({
            origin: "kibo",
            hash: contentHash(mine),
          });
        }
        expect(readFileSync(path, "utf8")).toBe(mine);
      }
    }),
    { numRuns: 60 },
  );
});

test("a save on a deleted file is missing and creates nothing", async () => {
  const h = makeTestHome();
  const history = createFileHistory({ home: h.kiboHome, db: h.db });
  const path = join(h.claudeHome, "agents", "a.md");
  const result = await versionedWrite({
    history,
    kind: "agents",
    ref: "global:a",
    file: "agent.md",
    path,
    content: "x",
    baseHash: contentHash("old"),
    mode: 0o644,
    origin: "kibo",
    by: null,
  });
  expect(result).toEqual({ kind: "missing" });
  expect(history.list("agents", "global:a")).toEqual([]);
});
