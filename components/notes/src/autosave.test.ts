import { expect, test } from "bun:test";
import { KiboError, type NoteMeta } from "@kibo/schema";
import { createAutosave, type SaveState } from "./autosave";

function harness(save: (md: string, mtime: number | null) => Promise<NoteMeta>) {
  const timers: (() => void)[] = [];
  const states: SaveState[] = [];
  const errors: unknown[] = [];
  const auto = createAutosave({
    delayMs: 800,
    save,
    onState: (s) => states.push(s),
    onError: (e) => errors.push(e),
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout: (id) => {
      timers[Number(id) - 1] = () => undefined;
    },
  });
  return { auto, timers, states, errors };
}
const meta = (mtime: number): NoteMeta => ({
  path: "a.md",
  title: "A",
  mtime,
  size: 1,
  tickets: [],
  links: [],
});
const flush = () => new Promise((r) => setTimeout(r, 0));

test("typing debounces, then saves once with the base mtime", async () => {
  const saves: [string, number | null][] = [];
  const { auto, timers, states } = harness(async (md, m) => {
    saves.push([md, m]);
    return meta(20);
  });
  auto.setBase(10);
  auto.change("a");
  auto.change("ab");
  timers.at(-1)?.();
  await flush();
  expect(saves).toEqual([["ab", 10]]);
  expect(states).toEqual(["dirty", "dirty", "saving", "saved"]);
  auto.change("abc");
  timers.at(-1)?.();
  await flush();
  expect(saves.at(-1)).toEqual(["abc", 20]);
});

test("a conflict keeps the text; keepMine forces the write", async () => {
  let conflict = true;
  const saves: [string, number | null][] = [];
  const { auto, timers, states } = harness(async (md, m) => {
    saves.push([md, m]);
    if (conflict) throw new KiboError("CONFLICT", "changed");
    return meta(30);
  });
  auto.setBase(10);
  auto.change("mine");
  timers.at(-1)?.();
  await flush();
  expect(states.at(-1)).toBe("conflict");
  conflict = false;
  await auto.keepMine();
  expect(saves.at(-1)).toEqual(["mine", null]);
  expect(states.at(-1)).toBe("saved");
});

test("other failures are reported, not swallowed", async () => {
  const { auto, timers, states, errors } = harness(async () => {
    throw new KiboError("PATH_OUTSIDE_PROJECT", "nope");
  });
  auto.change("x");
  timers.at(-1)?.();
  await flush();
  expect(states.at(-1)).toBe("error");
  expect(errors).toHaveLength(1);
});

test("setBase after a reload drops the unsaved text", async () => {
  const saves: [string, number | null][] = [];
  const { auto, timers } = harness(async (md, m) => {
    saves.push([md, m]);
    throw new KiboError("CONFLICT", "changed");
  });
  auto.setBase(10);
  auto.change("mine");
  timers.at(-1)?.();
  await flush();
  auto.setBase(40);
  await auto.flush();
  expect(saves).toEqual([["mine", 10]]);
});
