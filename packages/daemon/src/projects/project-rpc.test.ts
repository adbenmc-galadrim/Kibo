import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listProjects } from "@kibo/core";
import { type ChangeMessage, INBOX_ID } from "@kibo/schema";
import { createService } from "../service";
import { openStore } from "../store";
import { WORKSPACE_DOC_ID } from "./doc-ids";
import { handleProjectRequest, NOT_HANDLED, type ProjectRpcDeps } from "./project-rpc";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-project-rpc-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup() {
  const store = openStore(tmp());
  const service = createService(store, { user: "adam" });
  const adopted: string[] = [];
  const filed: string[] = [];
  const deps: ProjectRpcDeps = {
    workspace: service.docs.workspace,
    docs: service.docs,
    icons: service.icons,
    collab: () => null,
    adopt: (id) => adopted.push(id),
    fileTicket: (req) => {
      filed.push(req.ticketId);
      return { ticketId: req.ticketId, key: null };
    },
  };
  return { store, service, deps, adopted, filed };
}

test("project methods are answered here and every other method is left to the service", () => {
  const { deps, filed } = setup();
  expect(handleProjectRequest(deps, { method: "getTabs" })).toBe(NOT_HANDLED);
  expect(handleProjectRequest(deps, { method: "listProjects" })).toEqual([]);
  expect(handleProjectRequest(deps, { method: "fileTicket", ticketId: "1@1", projectId: "p1" })).toEqual({
    ticketId: "1@1",
    key: null,
  });
  expect(filed).toEqual(["1@1"]);
});

test("the reserved inbox key is refused before anything is registered", () => {
  const { store, service, deps, adopted } = setup();
  const seen: ChangeMessage[] = [];
  service.onChange((m) => seen.push(m));
  const workspaceBefore = store.load(WORKSPACE_DOC_ID);
  const req = { method: "createProject", name: "Boîte", key: "INB", folder: null, color: "#F97316" } as const;
  expect(() => handleProjectRequest(deps, req)).toThrow("project key INB is reserved");
  expect([adopted, seen, listProjects(service.docs.workspace)]).toEqual([[], [], []]);
  expect(store.load(WORKSPACE_DOC_ID)).toEqual(workspaceBefore);
});

test("a command aimed at an inbox instance is refused", () => {
  const { deps } = setup();
  const req = {
    method: "command",
    projectId: INBOX_ID,
    instanceId: "i1",
    command: { method: "createTicket", title: "T" },
  } as const;
  expect(() => handleProjectRequest(deps, req)).toThrow("the inbox has no component instances");
});
