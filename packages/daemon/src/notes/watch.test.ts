import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { watchNotes } from "./watch";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});
const until = async (check: () => boolean, ms = 4_000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
  return check();
};

test("an external write is detected once, after the debounce", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-watch-"));
  roots.push(dir);
  let changes = 0;
  const w = watchNotes(
    dir,
    () => {
      changes += 1;
    },
    { pollMs: 300 },
  );
  await w.ready;
  writeFileSync(join(dir, "a.md"), "# A");
  writeFileSync(join(dir, "a.md"), "# A2");
  expect(await until(() => changes > 0)).toBe(true);
  await new Promise((r) => setTimeout(r, 700));
  expect(changes).toBe(1);
  w.close();
});

test("a write whose event never arrives is caught by the sweep", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-watch-"));
  roots.push(dir);
  let changes = 0;
  const w = watchNotes(
    dir,
    () => {
      changes += 1;
    },
    { pollMs: 50, watch: () => ({ close: () => undefined }) },
  );
  await w.ready;
  writeFileSync(join(dir, "a.md"), "# A");
  expect(await until(() => changes > 0)).toBe(true);
  expect(w.polling).toBe(false);
  w.close();
});

test("polling takes over when fs.watch is unavailable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-watch-"));
  roots.push(dir);
  let changes = 0;
  const logs: string[] = [];
  const w = watchNotes(
    dir,
    () => {
      changes += 1;
    },
    {
      pollMs: 50,
      watch: () => {
        throw new Error("ENOSYS");
      },
      log: (l) => logs.push(l),
    },
  );
  expect(w.polling).toBe(true);
  expect(logs[0]).toContain("ENOSYS");
  await new Promise((r) => setTimeout(r, 120));
  writeFileSync(join(dir, "b.md"), "# B");
  expect(await until(() => changes > 0)).toBe(true);
  w.close();
});

test("a watcher error at runtime switches to polling", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-watch-"));
  roots.push(dir);
  let changes = 0;
  let fail: (e: unknown) => void = () => undefined;
  let closed = false;
  const logs: string[] = [];
  const w = watchNotes(
    dir,
    () => {
      changes += 1;
    },
    {
      pollMs: 50,
      watch: (_dir, _onEvent, onError) => {
        fail = onError;
        return {
          close: () => {
            closed = true;
          },
        };
      },
      log: (l) => logs.push(l),
    },
  );
  expect(w.polling).toBe(false);
  fail(new Error("EMFILE"));
  expect(w.polling).toBe(true);
  expect(closed).toBe(true);
  expect(logs[0]).toContain("EMFILE");
  await new Promise((r) => setTimeout(r, 120));
  writeFileSync(join(dir, "c.md"), "# C");
  expect(await until(() => changes > 0)).toBe(true);
  w.close();
});

test("a folder that disappears while polling is one change, not a stream of errors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-watch-"));
  roots.push(dir);
  writeFileSync(join(dir, "a.md"), "# A");
  let changes = 0;
  const logs: string[] = [];
  const w = watchNotes(
    dir,
    () => {
      changes += 1;
    },
    {
      pollMs: 30,
      debounceMs: 10,
      watch: () => {
        throw new Error("ENOSYS");
      },
      log: (l) => logs.push(l),
    },
  );
  await new Promise((r) => setTimeout(r, 90));
  rmSync(dir, { recursive: true, force: true });
  expect(await until(() => changes > 0)).toBe(true);
  await new Promise((r) => setTimeout(r, 200));
  expect(changes).toBe(1);
  expect(logs).toHaveLength(1);
  w.close();
});
