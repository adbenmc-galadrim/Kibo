import { expect, test } from "bun:test";
import fc from "fast-check";
import {
  lookupStory,
  PortEnvName,
  parseEnvPort,
  STORYBOOK_DEFAULTS,
  StorybookIndex,
  StorybookSettings,
  worktreeOrigin,
} from "./storybook";

test("storybook settings default to localhost:6006 and validate each field", () => {
  expect(StorybookSettings.parse(STORYBOOK_DEFAULTS)).toEqual({
    origin: "http://localhost:6006",
    portEnv: "STORYBOOK_PORT",
  });
  expect(StorybookSettings.safeParse({ origin: "https://sb.example.com", portEnv: "SB" }).success).toBe(true);
  expect(StorybookSettings.safeParse({ origin: "http://192.168.1.10:6006", portEnv: "SB" }).success).toBe(
    false,
  );
  expect(StorybookSettings.safeParse({ origin: "https://sb.example.com/x", portEnv: "SB" }).success).toBe(
    false,
  );
  expect(PortEnvName.safeParse("storybook-port").success).toBe(false);
  expect(PortEnvName.safeParse("1PORT").success).toBe(false);
  expect(PortEnvName.safeParse("STORYBOOK_PORT").success).toBe(true);
});

test("parseEnvPort reads the first NAME=value definition", () => {
  expect(parseEnvPort("STORYBOOK_PORT=6007\n", "STORYBOOK_PORT")).toBe(6007);
  expect(parseEnvPort('export STORYBOOK_PORT="6008"', "STORYBOOK_PORT")).toBe(6008);
  expect(parseEnvPort("STORYBOOK_PORT='6009'", "STORYBOOK_PORT")).toBe(6009);
  expect(parseEnvPort("  STORYBOOK_PORT = 6010  ", "STORYBOOK_PORT")).toBe(6010);
  expect(parseEnvPort("STORYBOOK_PORT=80", "STORYBOOK_PORT")).toBeNull();
  expect(parseEnvPort("STORYBOOK_PORT=abc", "STORYBOOK_PORT")).toBeNull();
  expect(parseEnvPort("STORYBOOK_PORT=70000", "STORYBOOK_PORT")).toBeNull();
  expect(parseEnvPort("STORYBOOK_PORT=6007.5", "STORYBOOK_PORT")).toBeNull();
  expect(parseEnvPort("# STORYBOOK_PORT=6007", "STORYBOOK_PORT")).toBeNull();
  expect(parseEnvPort("MY_STORYBOOK_PORT=6007", "STORYBOOK_PORT")).toBeNull();
  expect(parseEnvPort("A=1\nSTORYBOOK_PORT=6011\nSTORYBOOK_PORT=6012", "STORYBOOK_PORT")).toBe(6011);
  expect(parseEnvPort("STORYBOOK_PORT=abc\nSTORYBOOK_PORT=6011", "STORYBOOK_PORT")).toBeNull();
  expect(parseEnvPort("", "STORYBOOK_PORT")).toBeNull();
});

test("any accepted port is an integer from 1024 to 65535 read from a NAME= line (property)", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 200 }), (text) => {
      const port = parseEnvPort(text, "SB_PORT");
      if (port === null) return;
      expect(Number.isInteger(port)).toBe(true);
      expect(port).toBeGreaterThanOrEqual(1024);
      expect(port).toBeLessThanOrEqual(65535);
      expect(text.split(/\r?\n/).some((line) => /^\s*(export\s+)?SB_PORT\s*=/.test(line))).toBe(true);
    }),
  );
  fc.assert(
    fc.property(fc.integer({ min: 1024, max: 65535 }), (port) => {
      expect(parseEnvPort(`A=1\nSB_PORT=${port}\n`, "SB_PORT")).toBe(port);
    }),
  );
});

test("a worktree origin keeps the configured protocol and hostname", () => {
  expect(worktreeOrigin("http://localhost:6006", 6007)).toBe("http://localhost:6007");
  expect(worktreeOrigin("http://127.0.0.1:6006", 6007)).toBe("http://127.0.0.1:6007");
  expect(worktreeOrigin("https://sb.example.com", 6007)).toBe("https://sb.example.com:6007");
});

test("lookupStory names a story, reports it missing, or unknown without index", () => {
  const index = StorybookIndex.parse({
    v: 5,
    entries: {
      "screens-home--default": {
        id: "screens-home--default",
        title: "Screens/Home",
        name: "Default",
        type: "story",
      },
    },
  });
  expect(lookupStory(index, "screens-home--default")).toEqual({
    kind: "named",
    name: "Screens/Home / Default",
  });
  expect(lookupStory(index, "screens-home--other")).toEqual({ kind: "missing" });
  expect(lookupStory(null, "screens-home--default")).toEqual({ kind: "unknown" });
});
