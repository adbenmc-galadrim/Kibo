import { afterAll, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listNoteFiles,
  readNoteFile,
  removeNoteFile,
  renameNoteFile,
  resolveNotePath,
  writeNoteFile,
} from "./notes-fs";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});
function folder() {
  const root = mkdtempSync(join(tmpdir(), "kibo-notes-"));
  roots.push(root);
  const dir = join(root, "notes");
  mkdirSync(dir);
  writeFileSync(join(root, "secret.md"), "secret");
  return { root, dir };
}

describe("confinement", () => {
  test("hostile paths are refused", async () => {
    const { root, dir } = folder();
    symlinkSync(join(root, "secret.md"), join(dir, "evil.md"));
    symlinkSync(root, join(dir, "linked"));
    for (const p of [
      "../secret.md",
      "a/../../secret.md",
      "/etc/passwd.md",
      ".obsidian/x.md",
      "notes.txt",
      "evil.md",
      "linked/secret.md",
    ]) {
      await expect(resolveNotePath(dir, p)).rejects.toThrow("PATH_OUTSIDE_PROJECT");
    }
    await expect(readNoteFile(dir, "evil.md")).rejects.toThrow("PATH_OUTSIDE_PROJECT");
    await expect(writeNoteFile(dir, "linked/new.md", "x", null)).rejects.toThrow("PATH_OUTSIDE_PROJECT");
    expect(readdirSync(root).sort()).toEqual(["notes", "secret.md"]);
  });
  test("listing skips hidden entries, symbolic links and non-Markdown files", async () => {
    const { root, dir } = folder();
    mkdirSync(join(dir, ".obsidian"));
    mkdirSync(join(dir, "projets"));
    writeFileSync(join(dir, ".obsidian", "app.md"), "x");
    writeFileSync(join(dir, "projets", "b.md"), "b");
    writeFileSync(join(dir, "a.md"), "a");
    writeFileSync(join(dir, "image.png"), "x");
    symlinkSync(join(root, "secret.md"), join(dir, "evil.md"));
    symlinkSync(root, join(dir, "linked"));
    expect(await listNoteFiles(dir)).toEqual(["a.md", "projets/b.md"]);
  });
});

describe("writes", () => {
  test("write is atomic, creates folders and reports the new mtime", async () => {
    const { dir } = folder();
    const first = await writeNoteFile(dir, "projets/a.md", "# A", null);
    expect(readFileSync(join(dir, "projets", "a.md"), "utf8")).toBe("# A");
    expect(readdirSync(join(dir, "projets"))).toEqual(["a.md"]);
    expect((await readNoteFile(dir, "projets/a.md")).mtime).toBe(first.mtime);
  });
  test("an external change since the read is a conflict; null forces the write", async () => {
    const { dir } = folder();
    const first = await writeNoteFile(dir, "a.md", "# A", null);
    writeFileSync(join(dir, "a.md"), "# changé ailleurs");
    utimesSync(join(dir, "a.md"), new Date(), new Date(first.mtime + 5_000));
    await expect(writeNoteFile(dir, "a.md", "# mine", first.mtime)).rejects.toThrow("CONFLICT");
    await writeNoteFile(dir, "a.md", "# mine", null);
    expect(readFileSync(join(dir, "a.md"), "utf8")).toBe("# mine");
    await expect(writeNoteFile(dir, "b.md", "# B", 123)).rejects.toThrow("CONFLICT");
  });
  test("rename refuses to overwrite, remove deletes, missing notes are NOT_FOUND", async () => {
    const { dir } = folder();
    await writeNoteFile(dir, "a.md", "# A", null);
    await writeNoteFile(dir, "b.md", "# B", null);
    await expect(renameNoteFile(dir, "a.md", "b.md")).rejects.toThrow("CONFLICT");
    await renameNoteFile(dir, "a.md", "archive/a.md");
    expect(await listNoteFiles(dir)).toEqual(["archive/a.md", "b.md"]);
    await removeNoteFile(dir, "b.md");
    await expect(readNoteFile(dir, "b.md")).rejects.toThrow("NOT_FOUND");
    await expect(removeNoteFile(dir, "b.md")).rejects.toThrow("NOT_FOUND");
  });
});
