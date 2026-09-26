import { expect, test } from "bun:test";
import type { AiStatus } from "@kibo/schema";
import { parseToolVersion, readEnvironment } from "./environment";

const ai: AiStatus = {
  available: true,
  reason: null,
  version: "2.1.283",
  loggedIn: true,
  profiles: { assistant: true, generateur: true },
};

test("parseToolVersion keeps major.minor", () => {
  expect(parseToolVersion("git version 2.51.0")).toBe("2.51");
  expect(parseToolVersion("gh version 2.80.0 (2025-09-01)\nhttps://github.com/cli/cli")).toBe("2.80");
  expect(parseToolVersion("nope")).toBeNull();
});

test("readEnvironment gathers every check of screen 19", async () => {
  const env = await readEnvironment({
    daemon: { address: "127.0.0.1:47831", home: "/Users/adam/.kibo" },
    refreshAi: async () => ai,
    exec: async (argv) => (argv[0] === "git" ? { code: 0, stdout: "git version 2.51.0", stderr: "" } : null),
    gitBin: "git",
    ghBin: "gh",
    capacity: () => ({ cores: 8, ramGb: 16, hostSlots: 3 }),
    githubConnected: async () => false,
  });
  expect(env).toEqual({
    daemon: { address: "127.0.0.1:47831", home: "/Users/adam/.kibo" },
    ai,
    git: "2.51",
    gh: null,
    capacity: { cores: 8, ramGb: 16, hostSlots: 3 },
    github: { connected: false },
  });
});

test("readEnvironment treats a failing tool as missing", async () => {
  const env = await readEnvironment({
    daemon: { address: "127.0.0.1:1", home: "/h" },
    refreshAi: async () => ai,
    exec: async () => ({ code: 1, stdout: "git version 2.51.0", stderr: "" }),
    gitBin: "git",
    ghBin: "gh",
    capacity: () => ({ cores: 1, ramGb: 1, hostSlots: 1 }),
    githubConnected: async () => true,
  });
  expect([env.git, env.gh, env.github.connected]).toEqual([null, null, true]);
});
