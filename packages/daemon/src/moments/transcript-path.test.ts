import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptedTranscriptPath, transcriptRootOf } from "./transcript-path";

const dirs: string[] = [];
const tmp = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "kibo-path-")));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function layout() {
  const root = join(tmp(), "projects");
  const project = join(root, "-Users-adam-kibo");
  mkdirSync(project, { recursive: true });
  const path = join(project, "sess-1.jsonl");
  writeFileSync(path, "{}\n");
  return { root, project, path };
}

test("a transcript named after the session under the root is accepted", () => {
  const { root, path } = layout();
  expect(acceptedTranscriptPath(root, "sess-1", path)).toBe(path);
});

test("a path outside the root is rejected", () => {
  const { root } = layout();
  const outside = join(tmp(), "sess-1.jsonl");
  writeFileSync(outside, "{}\n");
  expect(acceptedTranscriptPath(root, "sess-1", outside)).toBeNull();
  expect(acceptedTranscriptPath(root, "sess-1", "/tmp/x.jsonl")).toBeNull();
  expect(acceptedTranscriptPath(root, "sess-1", `${root}/../sess-1.jsonl`)).toBeNull();
});

test("a symbolic link that leaves the root is rejected", () => {
  const { root, project } = layout();
  const outside = join(tmp(), "secret.jsonl");
  writeFileSync(outside, "{}\n");
  const link = join(project, "sess-2.jsonl");
  symlinkSync(outside, link);
  expect(acceptedTranscriptPath(root, "sess-2", link)).toBeNull();
  const away = tmp();
  writeFileSync(join(away, "sess-3.jsonl"), "{}\n");
  symlinkSync(away, join(root, "away"));
  expect(acceptedTranscriptPath(root, "sess-3", join(root, "away", "sess-3.jsonl"))).toBeNull();
});

test("a name other than the session, a null path or a missing file is rejected", () => {
  const { root, project, path } = layout();
  expect(acceptedTranscriptPath(root, "sess-9", path)).toBeNull();
  expect(acceptedTranscriptPath(root, "sess-1", null)).toBeNull();
  expect(acceptedTranscriptPath(root, "sess-4", join(project, "sess-4.jsonl"))).toBeNull();
  expect(acceptedTranscriptPath(join(tmp(), "absent"), "sess-1", path)).toBeNull();
});

test("the root follows CLAUDE_CONFIG_DIR, else ~/.claude", () => {
  expect(transcriptRootOf({ CLAUDE_CONFIG_DIR: "/cfg" }, "/home/adam")).toBe("/cfg/projects");
  expect(transcriptRootOf({}, "/home/adam")).toBe("/home/adam/.claude/projects");
  expect(transcriptRootOf({ CLAUDE_CONFIG_DIR: "" }, "/home/adam")).toBe("/home/adam/.claude/projects");
});
