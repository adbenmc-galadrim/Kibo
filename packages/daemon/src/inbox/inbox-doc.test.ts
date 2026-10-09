import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createProjectDoc,
  createTicket,
  createWorkspaceDoc,
  getProjectMeta,
  listProjects,
  listTickets,
} from "@kibo/core";
import { INBOX_ID } from "@kibo/schema";
import { projectDocId, WORKSPACE_DOC_ID } from "../projects/doc-ids";
import { loadDoc, openStore } from "../store";
import { INBOX_META, loadInbox } from "./inbox-doc";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-inbox-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("the inbox doc is created once, persisted under project:inbox, and never registered", () => {
  const dir = tmp();
  const store = openStore(dir);
  const doc = loadInbox(store);
  expect(getProjectMeta(doc)).toEqual(INBOX_META);
  expect(store.load(projectDocId(INBOX_ID))).toBeNull();
  createTicket(doc, { title: "A" });
  store.save(projectDocId(INBOX_ID), doc.export({ mode: "snapshot" }));
  store.close();
  const again = openStore(dir);
  expect(listTickets(loadInbox(again)).map((t) => t.key)).toEqual(["INB-1"]);
  expect(listProjects(loadDoc(again, WORKSPACE_DOC_ID) ?? createWorkspaceDoc())).toEqual([]);
  again.close();
});

test("a stored inbox that describes another project is refused as corrupt", () => {
  const store = openStore(tmp());
  const other = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
  });
  store.save(projectDocId(INBOX_ID), other.export({ mode: "snapshot" }));
  expect(() => loadInbox(store)).toThrow("STORE_CORRUPT");
  store.close();
});
