import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editorCommand, openInEditor } from "./editor";

test("allowed editors receive the line in their own syntax", () => {
  expect(editorCommand("/r/a.ts", 42, { VISUAL: "/usr/local/bin/code --wait" }, "darwin")).toEqual([
    "/usr/local/bin/code",
    "--goto",
    "/r/a.ts:42",
  ]);
  expect(editorCommand("/r/a.ts", 42, { EDITOR: "zed" }, "linux")).toEqual(["zed", "/r/a.ts:42"]);
  expect(editorCommand("/r/a.ts", 7, { EDITOR: "webstorm" }, "linux")).toEqual([
    "webstorm",
    "--line",
    "7",
    "/r/a.ts",
  ]);
  expect(editorCommand("/r/a.ts", null, { EDITOR: "subl" }, "linux")).toEqual(["subl", "/r/a.ts"]);
});

test("VISUAL wins over EDITOR", () => {
  expect(editorCommand("/r/a.ts", null, { VISUAL: "cursor", EDITOR: "zed" }, "linux")).toEqual([
    "cursor",
    "/r/a.ts",
  ]);
});

test("unknown or terminal editors fall back to the system opener", () => {
  expect(editorCommand("/r/a.ts", 3, { EDITOR: "vim" }, "darwin")).toEqual(["open", "/r/a.ts"]);
  expect(editorCommand("/r/a.ts", 3, { VISUAL: "sh -c 'rm -rf /'" }, "linux")).toEqual([
    "xdg-open",
    "/r/a.ts",
  ]);
  expect(editorCommand("/r/a.ts", 3, {}, "linux")).toEqual(["xdg-open", "/r/a.ts"]);
  expect(() => editorCommand("/r/a.ts", 3, {}, "win32")).toThrow(
    expect.objectContaining({ code: "EDITOR_UNAVAILABLE" }),
  );
});

test("a relative file is refused", () => {
  expect(() => editorCommand("-rf", null, { EDITOR: "code" }, "linux")).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
});

let dir: string;
beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-editor-")));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function installFakeEditor(): { path: string; log: string } {
  const path = join(dir, "code");
  const log = join(dir, "code.log");
  writeFileSync(
    path,
    `#!/usr/bin/env bun\nrequire("node:fs").appendFileSync(process.env.FAKE_BIN_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");\n`,
  );
  chmodSync(path, 0o755);
  return { path, log };
}

async function waitForFile(path: string): Promise<void> {
  for (let i = 0; i < 100 && !existsSync(path); i++) await Bun.sleep(30);
}

test("openInEditor spawns the command detached, without a shell", async () => {
  const bin = installFakeEditor();
  openInEditor([bin.path, "--goto", "/r/a.ts:42; touch pwned"], { FAKE_BIN_LOG: bin.log });
  await waitForFile(bin.log);
  const calls = readFileSync(bin.log, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  expect(calls).toEqual([["--goto", "/r/a.ts:42; touch pwned"]]);
  expect(() => openInEditor([join(dir, "missing-editor")])).toThrow(
    expect.objectContaining({ code: "EDITOR_UNAVAILABLE" }),
  );
});
