import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listProjectDomains, upsertProjectDomain } from "@kibo/core";
import { listDomains } from "@kibo/core/agent-config";
import { createWorkspaceDoc } from "@kibo/core/workspace";
import {
  type ConfigCommand,
  type Domain,
  KiboError,
  type ProjectMeta,
  RpcRequest,
  type Ticket,
} from "@kibo/schema";
import type { Docs } from "./docs";
import { call, createService } from "./service";
import { openStore } from "./store";
import { runConfigCommand } from "./workspace-config";

function docsWith(): Docs {
  const unused = () => {
    throw new KiboError("INTERNAL", "not used");
  };
  return {
    workspace: createWorkspaceDoc(),
    project: unused,
    projectIds: () => [],
    save: () => {},
    emit: () => {},
    run: unused,
    trigger: unused,
    replaceProject: unused,
    addProject: unused,
    removeProject: unused,
    onProjectRemoved: unused,
    imported: unused,
    onProjectDoc: unused,
    assertWritable: unused,
    setWriteGuard: unused,
    projectMeta: unused,
    updateProjectMeta: unused,
    identity: unused,
    setIdentity: unused,
    activity: unused,
    today: unused,
  };
}

test("the profile commands are refused before reaching the workspace", () => {
  for (const method of ["createProfile", "updateProfile", "deleteProfile"]) {
    const req = { method: "config", command: { method, profileId: "assistant", profile: {}, patch: {} } };
    expect(RpcRequest.safeParse(req).success).toBe(false);
  }
});

test("a workspace command still runs", () => {
  const docs = docsWith();
  const result = runConfigCommand(docs, { method: "updateWorkspace", patch: { name: "Maison" } });
  expect(result).toEqual({ name: "Maison", description: null });
});

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

function service() {
  const home = mkdtempSync(join(tmpdir(), "kibo-config-"));
  homes.push(home);
  const s = createService(openStore(home), { user: "adam" });
  const project = (name: string, key: string): ProjectMeta =>
    call(s, { method: "createProject", name, key, folder: null, color: "#F97316" });
  const config = <T>(command: ConfigCommand) => s.handle({ method: "config", command }) as T;
  const ticket = (projectId: string, domainId: string | null) => {
    const t = s.handle({
      method: "command",
      projectId,
      command: { method: "createTicket", title: "T" },
    }) as Ticket;
    s.handle({ method: "command", projectId, command: { method: "updateTicket", ticketId: t.id, domainId } });
    return t;
  };
  return { s, project, config, ticket };
}

const color = "#14B8A6";

test("readConfig lists the workspace and project domains with their owner and guidelines", () => {
  const { s, project, config, ticket } = service();
  const kibo = project("Kibo", "KIB");
  const inKibo = { scope: "project", projectId: kibo.id } as const;
  const securite = config<Domain>({ method: "createDomain", domain: { name: "Sécurité", color } });
  const sync = config<Domain>({ method: "createDomain", domain: { name: "Sync", color }, owner: inKibo });
  const owner = { scope: "domain", domainId: sync.id, projectId: kibo.id } as const;
  config({ method: "addGuideline", owner, path: "sync.md", content: "# Sync" });
  ticket(kibo.id, sync.id);
  ticket(kibo.id, securite.id);
  const read = call(s, { method: "getConfig" });
  expect(read.domains).toEqual([securite, { ...sync, owner: inKibo }]);
  expect(read.guidelines).toEqual([{ id: `${sync.id}:sync.md`, owner, path: "sync.md", content: "# Sync" }]);
  expect(read.domainUsage).toEqual({ [securite.id]: 1 });
  expect(read.projectDomainUsage).toEqual({ [kibo.id]: { [sync.id]: 1 } });
  expect(call(s, { method: "getProject", projectId: kibo.id }).domains).toEqual([sync]);
});

test("a project domain command runs in its project, emits config, and respects the write guard", () => {
  const { s, project, config } = service();
  const kibo = project("Kibo", "KIB");
  const inKibo = { scope: "project", projectId: kibo.id } as const;
  const topics: unknown[] = [];
  s.onChange((m) => topics.push("topic" in m ? m.topic : null));
  const ui = config<Domain>({ method: "createDomain", domain: { name: "UI", color }, owner: inKibo });
  expect(listProjectDomains(s.docs.project(kibo.id))).toEqual([ui]);
  expect(listDomains(s.docs.workspace)).toEqual([]);
  expect(topics).toContain("config");
  s.docs.setWriteGuard((id) => {
    throw new KiboError("FORBIDDEN", `project ${id} is read-only`);
  });
  expect(() => config({ method: "createDomain", domain: { name: "CI", color }, owner: inKibo })).toThrow(
    "FORBIDDEN",
  );
  expect(() => config({ method: "deleteDomain", domainId: ui.id, owner: inKibo })).toThrow("FORBIDDEN");
  expect(listProjectDomains(s.docs.project(kibo.id))).toEqual([ui]);
});

test("a project domain cannot be deleted while its tickets use it", () => {
  const { s, project, config, ticket } = service();
  const kibo = project("Kibo", "KIB");
  const inKibo = { scope: "project", projectId: kibo.id } as const;
  const ui = config<Domain>({ method: "createDomain", domain: { name: "UI", color }, owner: inKibo });
  const t = ticket(kibo.id, ui.id);
  expect(() => config({ method: "deleteDomain", domainId: ui.id, owner: inKibo })).toThrow("INVALID_INPUT");
  s.handle({
    method: "command",
    projectId: kibo.id,
    command: { method: "updateTicket", ticketId: t.id, domainId: null },
  });
  config({ method: "deleteDomain", domainId: ui.id, owner: inKibo });
  expect(listProjectDomains(s.docs.project(kibo.id))).toEqual([]);
});

test("a workspace domain cannot be deleted while any project uses it", () => {
  const { project, config, ticket } = service();
  const portail = project("Portail", "POR");
  const securite = config<Domain>({ method: "createDomain", domain: { name: "Sécurité", color } });
  ticket(portail.id, securite.id);
  expect(() => config({ method: "deleteDomain", domainId: securite.id })).toThrow("INVALID_INPUT");
});

test("readConfig returns the same order on every read: workspace then projects, each by name", () => {
  const { s, project, config } = service();
  const kibo = project("Kibo", "KIB");
  const portail = project("Portail", "POR");
  const inProject = (projectId: string) => ({ scope: "project", projectId }) as const;
  const create = (name: string, owner?: ReturnType<typeof inProject>) =>
    config<Domain>({ method: "createDomain", domain: { name, color }, owner });
  for (const name of ["Sync", "Auth", "Écrans"]) create(name);
  for (const name of ["Zeta", "Alpha", "Mid"]) create(name, inProject(kibo.id));
  for (const name of ["Ops", "Docs"]) create(name, inProject(portail.id));
  const first = call(s, { method: "getConfig" });
  const second = call(s, { method: "getConfig" });
  expect(second.domains).toEqual(first.domains);
  expect(second.guidelines).toEqual(first.guidelines);
  const [a, b] = [kibo.id, portail.id].sort();
  const names: Record<string, string[]> = {
    [kibo.id]: ["Alpha", "Mid", "Zeta"],
    [portail.id]: ["Docs", "Ops"],
  };
  expect(first.domains.map((d) => d.name)).toEqual([
    "Auth",
    "Écrans",
    "Sync",
    ...(names[a ?? ""] ?? []),
    ...(names[b ?? ""] ?? []),
  ]);
});

function withSharedCopy() {
  const { s, project, config, ticket } = service();
  const kibo = project("Kibo", "KIB");
  const portail = project("Portail", "POR");
  const securite = config<Domain>({ method: "createDomain", domain: { name: "Sécurité", color } });
  upsertProjectDomain(s.docs.project(kibo.id), securite.id, { name: "Sécurité", color }, []);
  s.docs.save(kibo.id);
  ticket(kibo.id, securite.id);
  ticket(kibo.id, securite.id);
  const onPortail = ticket(portail.id, securite.id);
  const copy = { scope: "project", projectId: kibo.id } as const;
  return { s, kibo, portail, securite, copy, onPortail, config };
}

test("a workspace domain and its project copy count their own tickets", () => {
  const { s, kibo, securite } = withSharedCopy();
  const read = call(s, { method: "getConfig" });
  expect(read.domainUsage).toEqual({ [securite.id]: 1 });
  expect(read.projectDomainUsage).toEqual({ [kibo.id]: { [securite.id]: 2 } });
});

test("deleting the workspace domain ignores the tickets of a project holding its copy", () => {
  const { s, portail, securite, copy, onPortail, config } = withSharedCopy();
  expect(() => config({ method: "deleteDomain", domainId: securite.id })).toThrow("INVALID_INPUT");
  expect(() => config({ method: "deleteDomain", domainId: securite.id, owner: copy })).toThrow(
    "INVALID_INPUT",
  );
  s.handle({
    method: "command",
    projectId: portail.id,
    command: { method: "updateTicket", ticketId: onPortail.id, domainId: null },
  });
  config({ method: "deleteDomain", domainId: securite.id });
  expect(listDomains(s.docs.workspace)).toEqual([]);
});
