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
import { KiboError } from "@kibo/schema";
import {
  attachAssetFile,
  createNoteFile,
  listNoteFiles,
  readAssetFile,
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

test("createNoteFile writes a new file and refuses an existing one without touching it", async () => {
  const { dir } = folder();
  const created = await createNoteFile(dir, "idees.md", "# Idées\n");
  expect(created.markdown).toBe("# Idées\n");
  await expect(createNoteFile(dir, "idees.md", "# Autre\n")).rejects.toThrow(
    new KiboError("CONFLICT", "idees.md already exists"),
  );
  expect(readFileSync(join(dir, "idees.md"), "utf8")).toBe("# Idées\n");
});

test("createNoteFile creates missing folders and refuses a symlinked target", async () => {
  const { root, dir } = folder();
  await createNoteFile(dir, "projets/kibo.md", "# Kibo\n");
  expect(readFileSync(join(dir, "projets", "kibo.md"), "utf8")).toBe("# Kibo\n");
  const outsideDir = join(root, "ailleurs");
  mkdirSync(outsideDir);
  symlinkSync(join(outsideDir, "cible.md"), join(dir, "lien.md"));
  await expect(createNoteFile(dir, "lien.md", "# X\n")).rejects.toThrow("PATH_OUTSIDE_PROJECT");
  expect(readdirSync(outsideDir)).toEqual([]);
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const STAMPED = "note-20261004-101500.png";

describe("assets", () => {
  test("attach writes exclusively under assets/, suffixes a taken name and reads back", async () => {
    const { dir } = folder();
    expect(await attachAssetFile(dir, STAMPED, "image/png", PNG)).toBe(`assets/${STAMPED}`);
    expect(await attachAssetFile(dir, STAMPED, "image/png", PNG)).toBe("assets/note-20261004-101500-2.png");
    expect(await attachAssetFile(dir, STAMPED, "image/png", PNG)).toBe("assets/note-20261004-101500-3.png");
    const back = await readAssetFile(dir, `assets/${STAMPED}`);
    expect(back.mime).toBe("image/png");
    expect([...back.bytes]).toEqual([...PNG]);
    expect(await listNoteFiles(dir)).toEqual([]);
  });

  test("attach refuses a lying mime, a file over 2 MiB and a bad name, writing nothing", async () => {
    const { dir } = folder();
    await expect(
      attachAssetFile(dir, "x.png", "image/png", new TextEncoder().encode("<html>")),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(attachAssetFile(dir, "x.jpg", "image/jpeg", PNG)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    const big = new Uint8Array(2 * 1024 * 1024 + 1).fill(0x89);
    big.set(PNG);
    await expect(attachAssetFile(dir, "x.png", "image/png", big)).rejects.toMatchObject({
      code: "TOO_LARGE",
    });
    await expect(attachAssetFile(dir, "../x.png", "image/png", PNG)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(attachAssetFile(dir, "x.svg", "image/png", PNG)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(readdirSync(dir)).toEqual([]);
  });

  test("attach refuses an assets folder that is a symlink", async () => {
    const { root, dir } = folder();
    const outsideDir = join(root, "ailleurs");
    mkdirSync(outsideDir);
    symlinkSync(outsideDir, join(dir, "assets"));
    await expect(attachAssetFile(dir, "x.png", "image/png", PNG)).rejects.toMatchObject({
      code: "PATH_OUTSIDE_PROJECT",
    });
    expect(readdirSync(outsideDir)).toEqual([]);
  });

  test("attach never follows a dangling symlink at the target name", async () => {
    const { root, dir } = folder();
    mkdirSync(join(dir, "assets"));
    symlinkSync(join(root, "cible.png"), join(dir, "assets", "x.png"));
    await expect(attachAssetFile(dir, "x.png", "image/png", PNG)).rejects.toMatchObject({
      code: "PATH_OUTSIDE_PROJECT",
    });
    expect(readdirSync(root).includes("cible.png")).toBe(false);
  });

  test("asset reads stay confined to assets/ and refuse symlinks and non images", async () => {
    const { root, dir } = folder();
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(root, "photo.png"), PNG);
    symlinkSync(join(root, "photo.png"), join(dir, "assets", "link.png"));
    writeFileSync(join(dir, "assets", "page.png"), "<html>");
    await expect(readAssetFile(dir, "assets/../photo.png")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(readAssetFile(dir, "secret.md")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(readAssetFile(dir, "assets/missing.png")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readAssetFile(dir, "assets/link.png")).rejects.toMatchObject({
      code: "PATH_OUTSIDE_PROJECT",
    });
    await expect(readAssetFile(dir, "assets/page.png")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("asset reads refuse a file over 2 MiB and a folder", async () => {
    const { dir } = folder();
    mkdirSync(join(dir, "assets", "dir.png"), { recursive: true });
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    writeFileSync(join(dir, "assets", "big.png"), big);
    await expect(readAssetFile(dir, "assets/big.png")).rejects.toMatchObject({ code: "TOO_LARGE" });
    await expect(readAssetFile(dir, "assets/dir.png")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
