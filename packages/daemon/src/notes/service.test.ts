import { Database } from "bun:sqlite";
import { afterAll, describe, expect, spyOn, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NoteContent, NoteMeta, NotesInfo } from "@kibo/schema";
import { createNotesIndex, ensureNotesTables } from "./index";
import { MAX_NOTE_BYTES } from "./notes-fs";
import { createNotesService, type NotesProject } from "./service";
import { ensureSettingsTable } from "./settings";

const roots: string[] = [];
const services: { close(): void }[] = [];
afterAll(() => {
  for (const s of services) s.close();
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const watches = { opened: 0, closed: 0 };

function setup(folder: "repo" | null = "repo", onWatch: (dir: string) => void = () => undefined) {
  const root = mkdtempSync(join(tmpdir(), "kibo-notes-svc-"));
  roots.push(root);
  const repo = join(root, "users", "adam", "goinfre", "Kibo");
  mkdirSync(repo, { recursive: true });
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  ensureNotesTables(db);
  const changed: string[] = [];
  const projects: Record<string, NotesProject> = {
    p1: { id: "p1", key: "KIB", folder: folder === "repo" ? repo : null },
  };
  const svc = createNotesService({
    db,
    home: join(root, "kibo-home"),
    homeDir: join(root, "users", "adam"),
    project: (id) => {
      const p = projects[id];
      if (!p) throw new Error(`NOT_FOUND: ${id}`);
      return p;
    },
    onChange: (id) => changed.push(id),
    watch: (dir) => {
      watches.opened += 1;
      onWatch(dir);
      return {
        close: () => {
          watches.closed += 1;
        },
      };
    },
  });
  services.push(svc);
  return { root, repo, svc, changed, db };
}

describe("notes folder", () => {
  test("defaults to <folder>/notes, shown with ~ and relative to the project", () => {
    const { repo, svc } = setup();
    expect(svc.info("p1")).toEqual({
      dir: join(repo, "notes"),
      displayDir: "~/goinfre/Kibo/notes",
      obsidian: false,
      folderRelative: "notes",
    });
  });
  test("without a project folder, notes live under KIBO_HOME/notes/<KEY>", () => {
    const { root, svc } = setup(null);
    expect(svc.info("p1")).toMatchObject({
      dir: join(root, "kibo-home", "notes", "KIB"),
      folderRelative: null,
    });
  });
  test("an Obsidian vault is recognised in the folder or a parent up to the project", async () => {
    const { repo, svc } = setup();
    mkdirSync(join(repo, ".obsidian"));
    expect(svc.info("p1").obsidian).toBe(true);
  });
  test("setDir accepts an existing absolute folder only", async () => {
    const { root, svc } = setup();
    const vault = join(root, "vault");
    mkdirSync(join(vault, ".obsidian"), { recursive: true });
    await expect(svc.setDir("p1", "relative/path")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.setDir("p1", join(root, "absent"))).rejects.toThrow("INVALID_INPUT");
    const info: NotesInfo = await svc.setDir("p1", vault);
    expect(info).toMatchObject({ dir: vault, obsidian: true, folderRelative: null });
  });
});

describe("notes calls", () => {
  test("write, list, read, search, rename, remove, with change notifications", async () => {
    const { svc, changed } = setup();
    const a = (await svc.handle("p1", {
      kind: "notes.write",
      path: "a.md",
      markdown: "# A\n\nVoir KIB-12.",
      expectedMtime: null,
    })) as NoteMeta;
    await svc.handle("p1", {
      kind: "notes.write",
      path: "b.md",
      markdown: "# B\n\n[[a]]",
      expectedMtime: null,
    });
    expect(a.tickets).toEqual(["KIB-12"]);
    const list = (await svc.handle("p1", { kind: "list", entity: "note" })) as NoteMeta[];
    expect(list.map((n) => [n.path, n.links])).toEqual(
      expect.arrayContaining([
        ["b.md", ["a.md"]],
        ["a.md", []],
      ]),
    );
    const read = (await svc.handle("p1", { kind: "notes.read", path: "a.md" })) as NoteContent;
    expect(read.markdown).toBe("# A\n\nVoir KIB-12.");
    expect(
      ((await svc.handle("p1", { kind: "notes.search", query: "voir" })) as NoteMeta[]).map((n) => n.path),
    ).toEqual(["a.md"]);
    await svc.handle("p1", { kind: "notes.rename", from: "a.md", to: "archive/a.md" });
    await svc.handle("p1", { kind: "notes.remove", path: "b.md" });
    expect(
      ((await svc.handle("p1", { kind: "list", entity: "note" })) as NoteMeta[]).map((n) => n.path),
    ).toEqual(["archive/a.md"]);
    expect(changed.length).toBeGreaterThanOrEqual(4);
  });
  test("an external write is picked up by refresh and makes the old mtime conflict", async () => {
    const { repo, svc } = setup();
    const a = (await svc.handle("p1", {
      kind: "notes.write",
      path: "a.md",
      markdown: "# A",
      expectedMtime: null,
    })) as NoteMeta;
    writeFileSync(join(repo, "notes", "a.md"), "# Modifiée dans Obsidian");
    utimesSync(join(repo, "notes", "a.md"), new Date(), new Date(a.mtime + 5_000));
    await svc.refresh("p1");
    expect(((await svc.handle("p1", { kind: "list", entity: "note" })) as NoteMeta[])[0]?.title).toBe(
      "Modifiée dans Obsidian",
    );
    await expect(
      svc.handle("p1", { kind: "notes.write", path: "a.md", markdown: "# mine", expectedMtime: a.mtime }),
    ).rejects.toThrow("CONFLICT");
  });
  test("create writes a new note and refuses an existing one with CONFLICT", async () => {
    const { repo, svc } = setup();
    const meta = (await svc.handle("p1", {
      kind: "notes.create",
      path: "a.md",
      markdown: "# A\n",
    })) as NoteMeta;
    expect([meta.path, meta.title]).toEqual(["a.md", "A"]);
    await expect(svc.handle("p1", { kind: "notes.create", path: "a.md", markdown: "# B\n" })).rejects.toThrow(
      "CONFLICT",
    );
    expect(readFileSync(join(repo, "notes", "a.md"), "utf8")).toBe("# A\n");
  });
  test("a note written while the watch starts is indexed", async () => {
    const { repo, svc } = setup("repo", (dir) => writeFileSync(join(dir, "late.md"), "# Tardive"));
    mkdirSync(join(repo, "notes"));
    const list = (await svc.handle("p1", { kind: "list", entity: "note" })) as NoteMeta[];
    expect(list.map((n) => n.path)).toEqual(["late.md"]);
  });
  test("a missing folder lists nothing, and hostile paths never touch the disk", async () => {
    const { svc } = setup();
    expect(await svc.handle("p1", { kind: "list", entity: "note" })).toEqual([]);
    await expect(svc.handle("p1", { kind: "notes.read", path: "../x.md" })).rejects.toThrow(
      "PATH_OUTSIDE_PROJECT",
    );
  });
  test("a folder that disappears releases its watcher; the next write recreates both", async () => {
    const { repo, svc } = setup();
    await svc.handle("p1", { kind: "notes.write", path: "a.md", markdown: "# A", expectedMtime: null });
    const before = { ...watches };
    rmSync(join(repo, "notes"), { recursive: true, force: true });
    await svc.refresh("p1");
    await svc.refresh("p1");
    expect(watches.closed).toBe(before.closed + 1);
    expect(await svc.handle("p1", { kind: "list", entity: "note" })).toEqual([]);
    await svc.handle("p1", { kind: "notes.write", path: "b.md", markdown: "# B", expectedMtime: null });
    expect(watches.opened).toBe(before.opened + 1);
    expect(readdirSync(join(repo, "notes"))).toEqual(["b.md"]);
  });
  test("forget closes the watcher and empties the index of a project", async () => {
    const { svc, db } = setup();
    await svc.handle("p1", { kind: "notes.write", path: "a.md", markdown: "# A", expectedMtime: null });
    const before = { ...watches };
    svc.forget("p1");
    expect(watches.closed).toBe(before.closed + 1);
    expect(createNotesIndex(db).list("p1")).toEqual([]);
    svc.forget("p1");
    expect(watches.closed).toBe(before.closed + 1);
  });
  test("non-note calls are refused", async () => {
    const { svc } = setup();
    await expect(svc.handle("p1", { kind: "data.keys" })).rejects.toThrow("INTERNAL");
  });
});

describe("skipped notes", () => {
  const oversized = "#".repeat(MAX_NOTE_BYTES + 1);
  const skipLines = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map((c) => String(c[0])).filter((line) => line.includes("big.md skipped"));

  test("an oversized note is logged once until it becomes readable again", async () => {
    const { repo, svc } = setup();
    mkdirSync(join(repo, "notes"));
    const big = join(repo, "notes", "big.md");
    writeFileSync(big, oversized);
    const spy = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await svc.refresh("p1");
      await svc.refresh("p1");
      await svc.refresh("p1");
      expect(skipLines(spy)).toEqual([
        "[kibo-daemon] note big.md skipped: QUOTA_EXCEEDED: big.md is larger than 1 MiB",
      ]);
      writeFileSync(big, "# Petite");
      await svc.refresh("p1");
      expect(skipLines(spy)).toHaveLength(1);
      writeFileSync(big, oversized);
      await svc.refresh("p1");
      await svc.refresh("p1");
      expect(skipLines(spy)).toHaveLength(2);
    } finally {
      spy.mockRestore();
    }
  });
  test("forget lets a still skipped note be logged again", async () => {
    const { repo, svc } = setup();
    mkdirSync(join(repo, "notes"));
    writeFileSync(join(repo, "notes", "big.md"), oversized);
    const spy = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await svc.refresh("p1");
      svc.forget("p1");
      await svc.refresh("p1");
      expect(skipLines(spy)).toHaveLength(2);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("pasted images", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString("base64");

  test("attach stores base64 bytes under assets/ and asset reads them back, unlisted", async () => {
    const { repo, svc } = setup();
    const call = {
      kind: "notes.attach",
      notePath: "journal.md",
      name: "journal-20261004-101500.png",
    } as const;
    expect(await svc.handle("p1", { ...call, mime: "image/png", bytes: png })).toEqual({
      path: "assets/journal-20261004-101500.png",
    });
    expect(readdirSync(join(repo, "notes", "assets"))).toEqual(["journal-20261004-101500.png"]);
    expect(
      await svc.handle("p1", { kind: "notes.asset", path: "assets/journal-20261004-101500.png" }),
    ).toEqual({
      mime: "image/png",
      bytes: png,
    });
    expect(await svc.handle("p1", { kind: "list", entity: "note" })).toEqual([]);
  });

  test("attach refuses a lying type before touching the disk", async () => {
    const { repo, svc } = setup();
    const html = Buffer.from("<html>").toString("base64");
    await expect(
      svc.handle("p1", {
        kind: "notes.attach",
        notePath: "a.md",
        name: "a.png",
        mime: "image/png",
        bytes: html,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(readdirSync(join(repo, "notes"))).toEqual([]);
  });
});
