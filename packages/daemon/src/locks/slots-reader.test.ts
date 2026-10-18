import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processAlive, readMachineLocks, readSlotsDir, slotsDirOf, slotsLabelOf } from "./slots-reader";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "fixtures", name), "utf8");
const DIR = "/slots";

function fakeFs(files: Record<string, string>) {
  const writes: string[] = [];
  const has = (path: string) => Object.keys(files).some((f) => f === path || f.startsWith(`${path}/`));
  return {
    writes,
    writeFile: (path: string) => writes.push(path),
    exists: has,
    readdir: (path: string) => {
      if (!has(path)) throw new Error(`ENOENT ${path}`);
      const names = Object.keys(files)
        .filter((f) => f.startsWith(`${path}/`))
        .map((f) => f.slice(path.length + 1).split("/")[0] ?? "");
      return [...new Set(names)];
    },
    readFile: (path: string) => {
      const content = files[path];
      if (content === undefined) throw new Error(`ENOENT ${path}`);
      return content;
    },
  };
}

const heavy = {
  [`${DIR}/heavy/max`]: "2\n",
  [`${DIR}/heavy/held/1760000000000000-4101.json`]: fixture("held-gates.json"),
  [`${DIR}/heavy/held/1760000060000000-4102.json`]: fixture("held-build.json"),
  [`${DIR}/heavy/wait/1760000120000000-4999.json`]: fixture("wait-dead.json"),
};

const reader = (fs: ReturnType<typeof fakeFs>, dead: number[] = []) => ({
  dir: DIR,
  exists: fs.exists,
  readdir: fs.readdir,
  readFile: fs.readFile,
  alive: (pid: number) => !dead.includes(pid),
});

test("a fabricated slots folder becomes machine locks, a dead pid is marked", () => {
  const fs = fakeFs(heavy);
  expect(readMachineLocks(reader(fs, [4999]))).toEqual([
    {
      name: "heavy",
      max: 2,
      held: [
        {
          ticket: "1760000000000000-4101",
          label: "silo:SILO-15 gates",
          pid: 4101,
          since: 1_760_000_000_000,
          cwd: "/home/dev/projects/silo/silo-feat-compte",
          alive: true,
        },
        {
          ticket: "1760000060000000-4102",
          label: "nimbus:W12 build",
          pid: 4102,
          since: 1_760_000_060_000,
          cwd: "/home/dev/projects/nimbus/nimbus-w12",
          alive: true,
        },
      ],
      waiting: [
        {
          ticket: "1760000120000000-4999",
          label: "silo:SILO-16 e2e",
          pid: 4999,
          since: 1_760_000_120_000,
          cwd: "/home/dev/projects/silo/silo-feat-export",
          alive: false,
        },
      ],
    },
  ]);
  expect(fs.writes).toEqual([]);
});

test("a missing slots folder gives no lock and no error", () => {
  expect(readMachineLocks(reader(fakeFs({})))).toEqual([]);
});

test("locks are sorted by name and an empty lock keeps its max", () => {
  const fs = fakeFs({
    ...heavy,
    [`${DIR}/e2e/max`]: "1",
    [`${DIR}/e2e/held/.keep`]: "",
  });
  const locks = readMachineLocks(reader(fs));
  expect(locks.map((l) => [l.name, l.max, l.held.length, l.waiting.length])).toEqual([
    ["e2e", 1, 0, 0],
    ["heavy", 2, 2, 1],
  ]);
});

test("an unreadable ticket or max is ignored and logged", () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const fs = fakeFs({
      ...heavy,
      [`${DIR}/heavy/held/broken.json`]: "{not json",
      [`${DIR}/heavy/wait/partial.json`]: JSON.stringify({ pid: "x", label: 3 }),
      [`${DIR}/review/max`]: "beaucoup",
    });
    const locks = readMachineLocks(reader(fs));
    expect(locks.map((l) => l.name)).toEqual(["heavy"]);
    expect(locks[0]?.held.map((t) => t.pid)).toEqual([4101, 4102]);
    expect(locks[0]?.waiting.map((t) => t.pid)).toEqual([4999]);
    expect(errors).toHaveBeenCalled();
  } finally {
    errors.mockRestore();
  }
});

test("labels and folders are masked and bounded before they are shown", () => {
  const fs = fakeFs({
    [`${DIR}/heavy/max`]: "1",
    [`${DIR}/heavy/held/t.json`]: JSON.stringify({
      pid: 1,
      since: 1,
      label: `deploy GITHUB_TOKEN=ghp_${"a".repeat(36)} ${"x".repeat(300)}`,
      cwd: `/w/${"d".repeat(600)}`,
      ticket: "t",
    }),
  });
  const [ticket] = readMachineLocks(reader(fs))[0]?.held ?? [];
  expect(ticket?.label).not.toContain("ghp_");
  expect(ticket?.label.length).toBeLessThanOrEqual(200);
  expect(ticket?.cwd.length).toBeLessThanOrEqual(500);
});

test("the slots folder comes from DELIVERY_SLOTS or the home folder", () => {
  expect(slotsDirOf({ DELIVERY_SLOTS: "/tmp/s" }, "/home/dev")).toBe("/tmp/s");
  expect(slotsDirOf({}, "/home/dev")).toBe("/home/dev/.delivery/slots");
});

test("the slots folder is shown from the home, never as an absolute path", () => {
  expect(slotsLabelOf("/home/dev/.delivery/slots", "/home/dev")).toBe("~/.delivery/slots");
  expect(slotsLabelOf("/home/dev/locks", "/home/dev")).toBe("~/locks");
  expect(slotsLabelOf("/home/developer/locks", "/home/dev")).toBe("$DELIVERY_SLOTS");
  expect(slotsLabelOf("/tmp/s", "/home/dev")).toBe("$DELIVERY_SLOTS");
  expect(slotsLabelOf("relative/s", "/home/dev")).toBe("$DELIVERY_SLOTS");
});

let made: string | null = null;
afterEach(() => {
  if (made) rmSync(made, { recursive: true, force: true });
  made = null;
});

test("the disk reader reads a real folder without writing to it", () => {
  made = mkdtempSync(join(tmpdir(), "kibo-slots-"));
  mkdirSync(join(made, "heavy", "held"), { recursive: true });
  mkdirSync(join(made, "heavy", "wait"), { recursive: true });
  writeFileSync(join(made, "heavy", "max"), "2\n");
  writeFileSync(join(made, "heavy", "held", "a.json"), fixture("held-gates.json"));
  const before = readFileSync(join(made, "heavy", "held", "a.json"), "utf8");
  const locks = readSlotsDir(made, { alive: () => true });
  expect(locks.map((l) => [l.name, l.held.map((t) => t.pid)])).toEqual([["heavy", [4101]]]);
  expect(readFileSync(join(made, "heavy", "held", "a.json"), "utf8")).toBe(before);
  expect(readSlotsDir(join(made, "absent"), { alive: () => true })).toEqual([]);
});

test("a process is alive while it runs", () => {
  expect(processAlive(process.pid)).toBe(true);
  expect(processAlive(2_147_483_646)).toBe(false);
});
