import { expect, test } from "bun:test";
import { createLoadSampler, parseMeminfo, parseMemoryPressure, readHostInfo } from "./host-load";

const LINUX_MEMINFO = [
  "MemTotal:       16318412 kB",
  "MemFree:          812344 kB",
  "MemAvailable:    4079603 kB",
  "Buffers:          402116 kB",
  "Cached:          3120480 kB",
  "SwapCached:            0 kB",
  "",
].join("\n");

test("parses macOS memory_pressure", () => {
  const out =
    "The system has 25769803776 (1572864 pages with a page size of 16384).\n" +
    "System-wide memory free percentage: 71%\n";
  expect(parseMemoryPressure(out)).toBe(29);
});

test("parses Linux /proc/meminfo with MemAvailable", () => {
  expect(
    parseMeminfo("MemTotal:       16000000 kB\nMemFree:  1000000 kB\nMemAvailable:    4000000 kB\n"),
  ).toBe(75);
  expect(parseMeminfo(LINUX_MEMINFO)).toBe(75);
});

test("unreadable memory output is an error, never a silent zero", () => {
  expect(() => parseMemoryPressure("")).toThrow("INTERNAL");
  expect(() => parseMeminfo("MemTotal: 10 kB\n")).toThrow("INTERNAL");
  expect(() => parseMeminfo("MemAvailable: 10 kB\n")).toThrow("INTERNAL");
});

test("cpu is the busy share since the previous sample", () => {
  const times = [
    { idle: 100, total: 200 },
    { idle: 150, total: 400 },
    { idle: 150, total: 400 },
  ];
  let i = 0;
  const sample = createLoadSampler({
    platform: "linux",
    cpuTimes: () => times[Math.min(i++, times.length - 1)] ?? { idle: 0, total: 0 },
    memoryPressure: () => "",
    meminfo: () => "MemTotal: 100 kB\nMemAvailable: 40 kB\n",
  });
  expect(sample()).toEqual({ cpu: 75, ram: 60 });
  expect(sample()).toEqual({ cpu: 0, ram: 60 });
});

test("darwin never uses os.freemem: memory comes from memory_pressure", () => {
  let asked = 0;
  const sample = createLoadSampler({
    platform: "darwin",
    cpuTimes: () => ({ idle: 0, total: 0 }),
    memoryPressure: () => {
      asked += 1;
      return "System-wide memory free percentage: 71%";
    },
    meminfo: () => {
      throw new Error("not on darwin");
    },
  });
  expect(sample().ram).toBe(29);
  expect(asked).toBe(1);
});

test("the real sampler and host info work on this machine", () => {
  const load = createLoadSampler()();
  expect(load.cpu).toBeGreaterThanOrEqual(0);
  expect(load.cpu).toBeLessThanOrEqual(100);
  expect(load.ram).toBeGreaterThan(0);
  expect(load.ram).toBeLessThan(100);
  const info = readHostInfo();
  expect(info.cores).toBeGreaterThan(0);
  expect(info.ramGb).toBeGreaterThan(0);
});
