import { afterEach, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError, Question } from "@kibo/schema";
import { noteHashOf } from "../notes/note-hash";
import { type Harness, harness, readOnly } from "./fakes.test-helper";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});
const setup = () => {
  const h = harness();
  open.push(h);
  return h;
};

const codeOf = async (fn: () => unknown): Promise<string | null> => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : `unexpected ${String(e)}`;
  }
};

test("project returns the snapshot with the viewer; an unknown project is NOT_FOUND", async () => {
  const h = setup();
  h.ticket("Hooks");
  const snap = h.data.project(h.project.id);
  expect(snap.meta.key).toBe("EMIS");
  expect(snap.viewer).toBe("adam");
  expect(snap.tickets.map((t) => t.title)).toEqual(["Hooks"]);
  expect(h.data.projectName(h.project.id)).toBe("Emis");
  expect(h.data.projectFolder(h.project.id)).toBeNull();
  expect(h.data.viewer(h.project.id)).toBe("adam");
  expect(await codeOf(() => h.data.project("nope"))).toBe("NOT_FOUND");
});

test("notes list path, title and the sha256 of the content; readNote is null when absent", async () => {
  const h = setup();
  await h.data.writeNote(h.project.id, "a.md", "# Alpha\n", "create");
  await h.data.writeNote(h.project.id, "dossier/b.md", "# Beta\n", "create");
  const notes = await h.data.notes(h.project.id);
  expect(notes).toEqual([
    { path: "a.md", title: "Alpha", hash: noteHashOf("# Alpha\n") },
    { path: "dossier/b.md", title: "Beta", hash: noteHashOf("# Beta\n") },
  ]);
  expect(await h.data.readNote(h.project.id, "a.md")).toBe("# Alpha\n");
  expect(await h.data.readNote(h.project.id, "absente.md")).toBeNull();
});

test("writeNote create refuses an existing note, update rewrites it, an unsafe path is INVALID_INPUT", async () => {
  const h = setup();
  const dir = h.notes.info(h.project.id).dir;
  await h.data.writeNote(h.project.id, "agent-de-projet/memoire.md", "", "create");
  expect(existsSync(join(dir, "agent-de-projet", "memoire.md"))).toBe(true);
  expect(
    await codeOf(() => h.data.writeNote(h.project.id, "agent-de-projet/memoire.md", "x", "create")),
  ).toBe("CONFLICT");
  await h.data.writeNote(h.project.id, "agent-de-projet/memoire.md", "# Mémoire\n", "update");
  expect(readFileSync(join(dir, "agent-de-projet", "memoire.md"), "utf8")).toBe("# Mémoire\n");
  expect(await codeOf(() => h.data.writeNote(h.project.id, "absente.md", "x", "update"))).toBe("NOT_FOUND");
  for (const bad of ["../x.md", "x.txt", ".hidden/x.md"]) {
    expect(await codeOf(() => h.data.writeNote(h.project.id, bad, "x", "create"))).toBe("INVALID_INPUT");
    expect(await codeOf(() => h.data.readNote(h.project.id, bad))).toBe("INVALID_INPUT");
  }
});

test("runCommand goes through the user command path: the question actor becomes the human viewer", () => {
  const h = setup();
  const t = h.ticket("Hooks");
  const created = Question.parse(
    h.data.runCommand(h.project.id, {
      method: "createQuestion",
      ticketId: t.id,
      title: "Quel port ?",
      createdBy: { kind: "agent", ref: "project-agent" },
      runId: null,
    }),
  );
  expect(created.createdBy).toEqual({ kind: "human", ref: "adam" });
});

test("assertWritable and runCommand refuse a read-only project", async () => {
  const h = setup();
  h.data.assertWritable(h.project.id);
  readOnly(h);
  expect(await codeOf(() => h.data.assertWritable(h.project.id))).toBe("FORBIDDEN");
  expect(await codeOf(() => h.data.runCommand(h.project.id, { method: "createTicket", title: "x" }))).toBe(
    "FORBIDDEN",
  );
});

test("profiles, guidelines and the demo flag come from the injected dependencies", () => {
  const h = setup();
  expect(h.data.profiles().map((p) => p.id)).toEqual(["opus", "assistant"]);
  expect(h.data.guidelines(h.project.id)).toEqual([]);
  expect(h.data.isDemoProject(h.project.id)).toBe(false);
});
