import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentHash, type DiskContent, readWithHash, writeGuarded } from "./guarded-write";
import { tempDir } from "./test-home.test-helper";

const setup = () => {
  const path = join(tempDir("kibo-guarded-"), "a.md");
  writeFileSync(path, "disque");
  return path;
};
const write = (path: string, baseHash: string | null, lastSeen: string | null = baseHash) =>
  writeGuarded({ path, content: "mienne", baseHash, lastSeen, mode: 0o644 });

test("reading gives the content, its sha256 and its modification time", async () => {
  const path = setup();
  const read = await readWithHash(path);
  expect(read?.content).toBe("disque");
  expect(read?.hash).toBe(contentHash("disque"));
  expect(read?.modifiedAt).toBeGreaterThan(0);
  expect(await readWithHash(join(path, "..", "absent.md"))).toBeNull();
});

test("the base hash matches the disk: the content is written", async () => {
  const path = setup();
  const result = await write(path, contentHash("disque"));
  expect(result).toMatchObject({ kind: "written", hash: contentHash("mienne") });
  expect(readFileSync(path, "utf8")).toBe("mienne");
});

test("the base hash is stale: a conflict with the disk content, nothing written", async () => {
  const path = setup();
  const result = await write(path, contentHash("ancien"));
  expect(result).toMatchObject({
    kind: "conflict",
    current: { content: "disque", hash: contentHash("disque") },
  });
  expect(readFileSync(path, "utf8")).toBe("disque");
});

test("the file vanished: missing", async () => {
  const path = join(tempDir("kibo-guarded-"), "a.md");
  expect(await write(path, contentHash("disque"))).toEqual({ kind: "missing" });
});

test("a creation over an existing file is a conflict", async () => {
  const path = setup();
  expect((await write(path, null)).kind).toBe("conflict");
  expect(readFileSync(path, "utf8")).toBe("disque");
});

test("a creation writes a new file", async () => {
  const path = join(tempDir("kibo-guarded-"), "agents", "a.md");
  expect((await write(path, null)).kind).toBe("written");
  expect(readFileSync(path, "utf8")).toBe("mienne");
});

test("the disk differs from what the caller saw last: onExternal gets it before the write", async () => {
  const path = setup();
  const seen: DiskContent[] = [];
  const result = await writeGuarded({
    path,
    content: "mienne",
    baseHash: contentHash("disque"),
    lastSeen: contentHash("vu par kibo"),
    mode: 0o644,
    onExternal: async (current) => {
      seen.push(current);
      expect(readFileSync(path, "utf8")).toBe("disque");
    },
  });
  expect(result.kind).toBe("written");
  expect(seen.map((s) => s.content)).toEqual(["disque"]);
});

test("the disk is what the caller saw last: onExternal is not called", async () => {
  const path = setup();
  let calls = 0;
  await writeGuarded({
    path,
    content: "mienne",
    baseHash: contentHash("disque"),
    lastSeen: contentHash("disque"),
    mode: 0o644,
    onExternal: async () => {
      calls += 1;
    },
  });
  expect(calls).toBe(0);
});
