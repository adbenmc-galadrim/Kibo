import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NoteContent, NoteMeta, NotesInfo } from "@kibo/schema";
import { ensureNotesTables } from "./index";
import { createNotesService, type NotesProject } from "./service";
import { ensureSettingsTable } from "./settings";

const roots: string[] = [];
const services: { close(): void }[] = [];
afterAll(() => {
  for (const s of services) s.close();
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const watches = { opened: 0, closed: 0 };

function setup(folder: "repo" | null = "repo") {
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
    watch: () => {
      watches.opened += 1;
      return {
        close: () => {
          watches.closed += 1;
        },
      };
    },
  });
  services.push(svc);
  return { root, repo, svc, changed };
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
  test("non-note calls are refused", async () => {
    const { svc } = setup();
    await expect(svc.handle("p1", { kind: "data.keys" })).rejects.toThrow("INTERNAL");
  });
});
