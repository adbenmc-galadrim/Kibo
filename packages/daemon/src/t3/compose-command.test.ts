import { expect, test } from "bun:test";
import { composeThreadStart, displayFolder, displayThreadStart } from "./compose-command";

test("composeThreadStart builds the exact argv with the folder, /full-delivery KEY, the title and --json", () => {
  expect(composeThreadStart({ bin: "t3", folder: "/w/silo", key: "SILO-45", title: "Photos" })).toEqual([
    "t3",
    "thread",
    "start",
    "/w/silo",
    "/full-delivery SILO-45",
    "--title",
    "SILO-45 · Photos",
    "--json",
  ]);
});

test("displayThreadStart shows t3, the folder from home and the brief, as in the confirmation", () => {
  const input = { key: "SILO-45", home: "/Users/adam" };
  expect(displayThreadStart({ ...input, folder: "/Users/adam/Documents/silo" })).toBe(
    't3 thread start ~/Documents/silo "/full-delivery SILO-45"',
  );
  expect(displayThreadStart({ ...input, folder: "/w/silo" })).toBe(
    't3 thread start /w/silo "/full-delivery SILO-45"',
  );
  expect(displayThreadStart({ ...input, folder: '/w/a "b" $c' })).toBe(
    't3 thread start "/w/a \\"b\\" \\$c" "/full-delivery SILO-45"',
  );
  expect(displayThreadStart({ ...input, folder: "/Users/adam/Mes docs/silo" })).toBe(
    't3 thread start ~/"Mes docs/silo" "/full-delivery SILO-45"',
  );
});

test("displayFolder only shortens the home folder itself or what it contains", () => {
  expect(displayFolder("/Users/adam", "/Users/adam")).toBe("~");
  expect(displayFolder("/Users/adam/silo", "/Users/adam")).toBe("~/silo");
  expect(displayFolder("/Users/adamant/silo", "/Users/adam")).toBe("/Users/adamant/silo");
});
