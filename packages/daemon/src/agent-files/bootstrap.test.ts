import { expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ChangeMessage } from "@kibo/schema";
import { startAgentFiles } from "./bootstrap";
import { open } from "./migration.test-helper";
import type { WatchPathsFn } from "./watch";

test("startup migrates the 0.21 profiles before the catalog reads the files, then creates the Kibo agents", async () => {
  const m = open();
  const emitted: ChangeMessage[] = [];
  let fire: () => void = () => {};
  const watch: WatchPathsFn = (_targets, onChange) => {
    fire = () => onChange(null);
    return { mode: () => "watch", close: () => undefined };
  };
  const files = await startAgentFiles({
    home: m.home,
    env: { CLAUDE_CONFIG_DIR: join(m.claudeHome) },
    userHome: "/nowhere",
    db: m.store.db,
    runs: m.runs,
    docs: {
      workspace: m.workspace,
      save: () => m.input.saveWorkspace(),
      emit: (message) => emitted.push(message),
    },
    activeRuns: () => 0,
    watch,
  });
  expect(files.roots.claudeHome).toBe(m.claudeHome);
  expect(readdirSync(m.agents)).toContain("sonnet-review.md");
  const scopes = files.service.list(null).agents.map((a) => [a.name, a.scope]);
  expect(scopes).toEqual(
    expect.arrayContaining([
      ["sonnet-review", "global"],
      ["kibo-demo", "system"],
    ]),
  );
  expect(m.runs.records().every((r) => /^(global|system):/.test(r.profileId))).toBe(true);
  emitted.length = 0;
  fire();
  for (let i = 0; i < 50 && emitted.length === 0; i++) await Bun.sleep(10);
  expect(emitted).toContainEqual({ topic: "agent-files" });
  files.stop();
  m.close();
});

test("an isolated daemon writes the Kibo agents under its own home, never in the Claude config", async () => {
  const m = open();
  const files = await startAgentFiles({
    home: m.home,
    env: { CLAUDE_CONFIG_DIR: m.claudeHome, KIBO_CLAUDE_ISOLATED: "1" },
    userHome: "/nowhere",
    db: m.store.db,
    runs: m.runs,
    docs: { workspace: m.workspace, save: () => m.input.saveWorkspace(), emit: () => undefined },
    activeRuns: () => 0,
    watch: () => ({ mode: () => "watch", close: () => undefined }),
  });
  expect(files.roots.claudeHome).toBe(join(m.home, "claude"));
  expect(readdirSync(join(m.home, "claude", "agents")).some((f) => f.startsWith("kibo-"))).toBe(true);
  expect(existsSync(m.claudeHome)).toBe(false);
  files.stop();
  m.close();
});
