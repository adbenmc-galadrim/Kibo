import { describe, expect, test } from "bun:test";
import { COMMAND_WRITES, EMPTY_TABS, KiboError, type ProjectCommand, RpcRequest } from "@kibo/schema";
import { assertRemoteAllowed, REMOTE_CALL_KINDS, REMOTE_COMMAND_KINDS, REMOTE_METHODS } from "./methods";

const TICKET = "01JAAAAAAAAAAAAAAAAAAAAAAA";
const EXCLUDED_COMMANDS = [
  "addPage",
  "deletePage",
  "renamePage",
  "movePage",
  "setPageLayout",
  "addInstance",
  "removeInstance",
  "setInstanceComponent",
  "setInstanceLayout",
  "addBinding",
  "removeBinding",
  "importExternalTicket",
];
const RPC_METHODS: ReadonlySet<string> = new Set(
  RpcRequest.options.map((option) => option.shape.method.value),
);
const METHODS: readonly string[] = REMOTE_METHODS;
const COMMAND_KINDS: readonly string[] = REMOTE_COMMAND_KINDS;
const CALL_KINDS: readonly string[] = REMOTE_CALL_KINDS;

const verdict = (raw: unknown): string => {
  try {
    assertRemoteAllowed(RpcRequest.parse(raw));
    return "allowed";
  } catch (error) {
    return error instanceof KiboError ? error.code : "not a KiboError";
  }
};
const command = (cmd: ProjectCommand) => ({ method: "command", projectId: "p1", command: cmd });
const call = (c: Record<string, unknown>) => ({
  method: "componentCall",
  projectId: "p1",
  instanceId: "i1",
  call: c,
});
const addPage: ProjectCommand = { method: "addPage", title: "Silo", kind: "view" };

describe("closed list of methods", () => {
  test("every REMOTE_METHOD exists in RpcRequest", () => {
    expect(METHODS).toEqual([
      "getSession",
      "listProjects",
      "getProject",
      "command",
      "fileTicket",
      "listProjectEvents",
      "listCiRuns",
      "getCiLog",
      "componentCall",
      "getProjectAgent",
      "getRunLog",
      "sendProjectAgentMessage",
      "decideBatch",
      "t3.status",
      "t3.preview",
      "t3.launch",
      "t3.threadOf",
      "t3.refresh",
    ]);
    for (const method of METHODS) expect(RPC_METHODS.has(method)).toBe(true);
  });

  test("assertRemoteAllowed refuses updateProject, deleteProject, saveTabs, resetProjectAgent, listSessions, previewPlan, getBackups", () => {
    const refused = [
      "updateProject",
      "deleteProject",
      "saveTabs",
      "resetProjectAgent",
      "listSessions",
      "previewPlan",
      "getBackups",
    ];
    for (const method of refused) {
      expect(RPC_METHODS.has(method)).toBe(true);
      expect(METHODS).not.toContain(method);
    }
    expect(verdict({ method: "updateProject", projectId: "p1", patch: { name: "Silo" } })).toBe("FORBIDDEN");
    expect(verdict({ method: "deleteProject", projectId: "p1" })).toBe("FORBIDDEN");
    expect(verdict({ method: "saveTabs", state: EMPTY_TABS })).toBe("FORBIDDEN");
    expect(verdict({ method: "resetProjectAgent", projectId: "p1" })).toBe("FORBIDDEN");
    expect(verdict({ method: "listSessions" })).toBe("FORBIDDEN");
    expect(verdict({ method: "getBackups" })).toBe("FORBIDDEN");
  });

  test("the refusal names the method", () => {
    expect(() => assertRemoteAllowed({ method: "deleteProject", projectId: "p1" })).toThrow(
      "deleteProject is not allowed from a phone",
    );
  });

  test("accepts the reading methods and the launch", () => {
    expect(verdict({ method: "getProject", projectId: "p1" })).toBe("allowed");
    expect(verdict({ method: "t3.launch", projectId: "p1", ticketKey: "SILO-45" })).toBe("allowed");
  });
});

describe("closed list of commands", () => {
  test("the command kinds are every project command but pages, layout and bindings", () => {
    const expected = Object.keys(COMMAND_WRITES).filter((kind) => !EXCLUDED_COMMANDS.includes(kind));
    expect([...COMMAND_KINDS].sort()).toEqual(expected.sort());
  });

  test("refuses command addPage, setPageLayout, addInstance, addBinding, importExternalTicket", () => {
    for (const kind of ["addPage", "setPageLayout", "addInstance", "addBinding", "importExternalTicket"]) {
      expect(COMMAND_KINDS).not.toContain(kind);
    }
    expect(verdict(command(addPage))).toBe("FORBIDDEN");
    expect(verdict(command({ method: "setPageLayout", pageId: TICKET, layouts: [] }))).toBe("FORBIDDEN");
  });

  test("accepts command setStatus, moveTicket, createQuestion, answerQuestion, removeQuestion, setHold, createSprint, setInstanceData, upsertExternalRef", () => {
    const kinds = [
      "setStatus",
      "moveTicket",
      "createQuestion",
      "answerQuestion",
      "removeQuestion",
      "setHold",
      "createSprint",
      "setInstanceData",
      "upsertExternalRef",
    ];
    for (const kind of kinds) expect(COMMAND_KINDS).toContain(kind);
    expect(verdict(command({ method: "setStatus", ticketId: TICKET, statusId: "done" }))).toBe("allowed");
    expect(verdict(command({ method: "moveTicket", ticketId: TICKET, parentId: null }))).toBe("allowed");
    expect(verdict(command({ method: "removeQuestion", questionId: TICKET }))).toBe("allowed");
    expect(verdict(command({ method: "setHold", ticketId: TICKET, reason: null }))).toBe("allowed");
    expect(verdict(command({ method: "setInstanceData", instanceId: "i1", key: "view", value: 1 }))).toBe(
      "allowed",
    );
  });

  test("the refused command is named in the error", () => {
    expect(() => assertRemoteAllowed({ method: "command", projectId: "p1", command: addPage })).toThrow(
      "command addPage is not allowed from a phone",
    );
  });
});

describe("closed list of component calls", () => {
  test("refuses componentCall fetch, action, assets.url, design.frame, notes.read, data.get", () => {
    for (const kind of ["fetch", "action", "assets.url", "design.frame", "notes.read", "data.get"]) {
      expect(CALL_KINDS).not.toContain(kind);
    }
    expect(verdict(call({ kind: "fetch", url: "https://silo.example.com", init: {} }))).toBe("FORBIDDEN");
    expect(verdict(call({ kind: "action", name: "sync", input: null }))).toBe("FORBIDDEN");
    expect(verdict(call({ kind: "assets.url", name: "logo.png" }))).toBe("FORBIDDEN");
    expect(verdict(call({ kind: "design.frame", url: "https://www.figma.com/design/abc" }))).toBe(
      "FORBIDDEN",
    );
    expect(verdict(call({ kind: "data.get", key: "view" }))).toBe("FORBIDDEN");
    expect(RpcRequest.safeParse(call({ kind: "notes.read", path: "a.md" })).success).toBe(false);
  });

  test("accepts componentCall run, list, config.set, questions.recipients, t3.launch", () => {
    const accepted = [
      { kind: "run", command: { method: "setStatus", ticketId: TICKET, statusId: "done" } },
      { kind: "list", entity: "ticket" },
      { kind: "config.set", patch: { columns: 3 } },
      { kind: "questions.recipients" },
      { kind: "t3.launch", ticketKey: "SILO-45" },
    ];
    for (const raw of accepted) expect(verdict(call(raw))).toBe("allowed");
  });

  test("a componentCall run obeys the closed list of commands", () => {
    expect(verdict(call({ kind: "run", command: addPage }))).toBe("FORBIDDEN");
  });
});
