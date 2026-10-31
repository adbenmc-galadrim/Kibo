import { expect, test } from "bun:test";
import { composeThreadStart, shellQuote } from "./compose-command";

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

test("shellQuote quotes arguments containing spaces only", () => {
  expect(shellQuote(["t3", "/full-delivery SILO-45", "--json"])).toBe('t3 "/full-delivery SILO-45" --json');
});

test("shellQuote keeps a quoted argument faithful to what is passed", () => {
  expect(shellQuote(['a "b" $c'])).toBe('"a \\"b\\" \\$c"');
});
