import { afterEach, expect, test } from "bun:test";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listSubagentMetas,
  readSubagentMeta,
  readSubagentSlice,
  skipLongSubagentLine,
  subagentMetaPath,
  subagentTracePath,
} from "./trace";

const dirs: string[] = [];
const tmp = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "kibo-subagents-")));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function project() {
  const root = join(tmp(), "projects");
  const transcriptPath = join(root, "proj", "sess-1.jsonl");
  const dir = join(root, "proj", "sess-1", "subagents");
  mkdirSync(dir, { recursive: true });
  return { root, transcriptPath, dir };
}

test("the transcript of a subagent sits beside the session transcript", () => {
  expect(
    subagentTracePath({ transcriptPath: "/h/.claude/projects/p/s1.jsonl", sessionId: "s1", agentId: "a1" }),
  ).toBe("/h/.claude/projects/p/s1/subagents/agent-a1.jsonl");
  expect(
    subagentMetaPath({ transcriptPath: "/h/.claude/projects/p/s1.jsonl", sessionId: "s1", agentId: "a1" }),
  ).toBe("/h/.claude/projects/p/s1/subagents/agent-a1.meta.json");
});

test("an agent id that would leave the folder is refused", () => {
  expect(() =>
    subagentTracePath({ transcriptPath: "/p/s1.jsonl", sessionId: "s1", agentId: "../../x" }),
  ).toThrow(expect.objectContaining({ code: "PATH_OUTSIDE_PROJECT" }));
});

test("a missing subagent transcript reads as empty", () => {
  const { root, dir } = project();
  expect(readSubagentSlice(root, join(dir, "agent-a1.jsonl"), 0, 1024)).toEqual({
    lines: [],
    offset: 0,
    more: false,
  });
});

test("a transcript whose real path leaves the projects folder is refused", () => {
  const { root, dir } = project();
  const outside = join(tmp(), "secret.jsonl");
  writeFileSync(outside, "{}\n");
  symlinkSync(outside, join(dir, "agent-a1.jsonl"));
  expect(() => readSubagentSlice(root, join(dir, "agent-a1.jsonl"), 0, 1024)).toThrow(
    expect.objectContaining({ code: "PATH_OUTSIDE_PROJECT" }),
  );
});

test("a slice is read from an offset within the budget", () => {
  const { root, dir } = project();
  const path = join(dir, "agent-a1.jsonl");
  writeFileSync(path, "un\ndeux\ntrois\n");
  expect(readSubagentSlice(root, path, 3, 6)).toEqual({ lines: ["deux"], offset: 8, more: true });
});

test("a line longer than the budget is skipped", () => {
  const { root, dir } = project();
  const path = join(dir, "agent-a1.jsonl");
  writeFileSync(path, `${"x".repeat(100)}\nsuite\n`);
  expect(skipLongSubagentLine(root, path, 0)).toBe(101);
});

test("the meta file of a subagent is read and listed", () => {
  const { root, dir } = project();
  copyFileSync(join(import.meta.dir, "fixtures", "agent-meta.json"), join(dir, "agent-a1.meta.json"));
  writeFileSync(join(dir, "agent-bad.meta.json"), "pas du json");
  writeFileSync(join(dir, "notes.txt"), "");
  expect(listSubagentMetas(root, dir).sort()).toEqual(["a1", "bad"]);
  expect(readSubagentMeta(root, join(dir, "agent-a1.meta.json"), "a1")).toEqual({
    agentId: "a1",
    agentType: "ecc:code-reviewer",
    description: "Porte qualité — correctness",
    toolUseId: "toolu_01AbCdEfGhIjKlMnOpQrStUv",
    spawnDepth: 1,
    model: "opus",
  });
  expect(readSubagentMeta(root, join(dir, "agent-bad.meta.json"), "bad")).toBeNull();
  expect(readSubagentMeta(root, join(dir, "agent-none.meta.json"), "none")).toBeNull();
  expect(listSubagentMetas(root, join(dir, "absent"))).toEqual([]);
});
