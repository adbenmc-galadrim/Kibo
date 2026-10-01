import { expect, test } from "bun:test";
import { createProjectDoc, createTicket, listTickets } from "@kibo/core";
import { type ChangeMessage, INBOX_ID, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createFileTicket, type FileTicketDeps } from "./file-ticket";
import { INBOX_META } from "./inbox-doc";

const kibo = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function fixture(
  opts: {
    writable?: (id: string) => void;
    save?: (id: string | null) => void;
    restore?: (id: string) => void;
  } = {},
) {
  const docs = new Map<string, LoroDoc>([
    [INBOX_ID, createProjectDoc(INBOX_META)],
    ["p1", createProjectDoc(kibo)],
  ]);
  const log: string[] = [];
  const emitted: ChangeMessage[] = [];
  const deps: FileTicketDeps = {
    docs: {
      project(id) {
        log.push(`project ${id}`);
        const doc = docs.get(id);
        if (!doc) throw new KiboError("NOT_FOUND", `project ${id} not found`);
        return doc;
      },
      assertWritable(id) {
        log.push(`writable ${id}`);
        opts.writable?.(id);
      },
      save(id) {
        log.push(`save ${id}`);
        opts.save?.(id);
      },
      emit: (m) => emitted.push(m),
    },
    store: {
      transaction: (fn) => {
        log.push("begin");
        const out = fn();
        log.push("commit");
        return out;
      },
    },
    restore(id) {
      log.push(`restore ${id}`);
      opts.restore?.(id);
    },
  };
  const inbox = docs.get(INBOX_ID);
  if (!inbox) throw new Error("inbox missing");
  return { file: createFileTicket(deps), log, emitted, inbox, target: () => docs.get("p1") };
}

test("the checks run in the spec order before anything is written", () => {
  const f = fixture({
    writable: () => {
      throw new KiboError("FORBIDDEN", "read-only");
    },
  });
  const t = createTicket(f.inbox, { title: "T" });
  expect(() => f.file({ method: "fileTicket", ticketId: t.id, projectId: INBOX_ID })).toThrow(
    "INVALID_INPUT",
  );
  expect(f.log).toEqual([]);
  expect(() => f.file({ method: "fileTicket", ticketId: t.id, projectId: "ghost" })).toThrow("NOT_FOUND");
  expect(() => f.file({ method: "fileTicket", ticketId: t.id, projectId: "p1" })).toThrow("FORBIDDEN");
  expect(f.log).toEqual(["project ghost", "project p1", "writable p1"]);
  expect(f.emitted).toEqual([]);
});

test("a filing saves both docs inside one transaction, then announces the inbox before the project", () => {
  const f = fixture();
  const t = createTicket(f.inbox, { title: "T" });
  expect(f.file({ method: "fileTicket", ticketId: t.id, projectId: "p1" })).toMatchObject({ key: "KIB-1" });
  expect(f.log).toEqual([
    "project p1",
    "writable p1",
    `project ${INBOX_ID}`,
    "begin",
    `save ${INBOX_ID}`,
    "save p1",
    "commit",
  ]);
  expect(f.emitted).toEqual([{ projectId: INBOX_ID }, { projectId: "p1" }]);
});

test("any failure restores both docs and reports the cause, never an event", () => {
  const f = fixture({
    save: (id) => {
      if (id === "p1") throw new Error("disk full");
    },
  });
  const t = createTicket(f.inbox, { title: "T" });
  expect(() => f.file({ method: "fileTicket", ticketId: t.id, projectId: "p1" })).toThrow("disk full");
  expect(f.log.slice(-2)).toEqual([`restore ${INBOX_ID}`, "restore p1"]);
  expect(f.emitted).toEqual([]);
  const missing = fixture();
  expect(() => missing.file({ method: "fileTicket", ticketId: "9@9", projectId: "p1" })).toThrow("NOT_FOUND");
  expect(missing.log.slice(-2)).toEqual([`restore ${INBOX_ID}`, "restore p1"]);
  expect(listTickets(missing.target() ?? createProjectDoc(kibo))).toEqual([]);
});

test("a failed restore is reported together with the original error", () => {
  const f = fixture({
    save: () => {
      throw new Error("disk full");
    },
    restore: () => {
      throw new KiboError("STORE_CORRUPT", "unreadable");
    },
  });
  const t = createTicket(f.inbox, { title: "T" });
  let caught: unknown = null;
  try {
    f.file({ method: "fileTicket", ticketId: t.id, projectId: "p1" });
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(AggregateError);
  expect(caught instanceof AggregateError ? caught.errors.map(String) : []).toEqual([
    "Error: disk full",
    "KiboError: STORE_CORRUPT: unreadable",
  ]);
});
