import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  listTickets,
  migrateForSharing,
  setStatus,
} from "@kibo/core";
import type { ConfigCommand, Domain, GuidelineOwner, ProjectMeta, Skill, Ticket } from "@kibo/schema";
import { call, createService } from "../service";
import { openStore } from "../store";
import { applyRules } from "./data-port";
import { memoryAgent, memoryAgentSource, NEUTRAL_SYSTEM_AGENTS } from "./neutral-agents";

const doc = () =>
  createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });

test("a finished run leaves its ticket in its status, and a started one moves it on", () => {
  const d = doc();
  const t = createTicket(d, { title: "A", statusId: "in_progress" });
  const todo = createTicket(d, { title: "B", statusId: "todo" });
  expect(applyRules(d, { kind: "run_done", ticketId: t.id })).toEqual([]);
  expect(applyRules(d, { kind: "run_started", ticketId: todo.id })).toEqual([
    { method: "setStatus", ticketId: todo.id, statusId: "in_progress" },
  ]);
  expect(applyRules(d, { kind: "run_done", ticketId: todo.id })).toEqual([]);
  expect(listTickets(d).map((x) => x.statusId)).toEqual(["in_progress", "in_progress"]);
});

test("the last child done closes its parent", () => {
  const d = doc();
  const parent = createTicket(d, { title: "P", statusId: "in_progress" });
  const a = createTicket(d, { title: "A", parentId: parent.id });
  const b = createTicket(d, { title: "B", parentId: parent.id });
  setStatus(d, a.id, "done");
  expect(applyRules(d, { kind: "status_changed", ticketId: a.id })).toEqual([]);
  setStatus(d, b.id, "done");
  applyRules(d, { kind: "status_changed", ticketId: b.id });
  expect(listTickets(d).find((x) => x.id === parent.id)?.statusId).toBe("done");
});

test("a chain of parents closes in the order the rules return", () => {
  const d = doc();
  const root = createTicket(d, { title: "R", statusId: "in_progress" });
  const mid = createTicket(d, { title: "M", parentId: root.id, statusId: "in_progress" });
  const leaf = createTicket(d, { title: "L", parentId: mid.id });
  setStatus(d, leaf.id, "done");
  expect(applyRules(d, { kind: "status_changed", ticketId: leaf.id })).toEqual([
    { method: "setStatus", ticketId: mid.id, statusId: "done" },
    { method: "setStatus", ticketId: root.id, statusId: "done" },
  ]);
  expect(listTickets(d).map((x) => x.statusId)).toEqual(["done", "done", "done"]);
});

test("a started run puts its todo ticket in progress", () => {
  const d = doc();
  const t = createTicket(d, { title: "A", statusId: "todo" });
  expect(applyRules(d, { kind: "run_started", ticketId: t.id })).toEqual([
    { method: "setStatus", ticketId: t.id, statusId: "in_progress" },
  ]);
});

test("a shared project takes its domains and domain guidelines from the project, not the workspace", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-port-"));
  const store = openStore(home);
  const s = createService(store, { user: "adam" });
  const meta: ProjectMeta = call(s, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const core = s.handle({
    method: "config",
    command: { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } },
  }) as Domain;
  const owner = { scope: "domain", domainId: core.id, projectId: null } as const;
  s.handle({
    method: "config",
    command: { method: "addGuideline", owner, path: "core.md", content: "Poste" },
  });
  s.handle({
    method: "config",
    command: { method: "addGuideline", owner: { scope: "workspace" }, path: "all.md", content: "Local" },
  });
  const ticket = s.handle({
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "A" },
  }) as Ticket;
  s.handle({
    method: "command",
    projectId: meta.id,
    command: { method: "updateTicket", ticketId: ticket.id, domainId: core.id },
  });
  const doc = s.docs.project(meta.id);
  const guidelines = [{ path: "core.md", content: "Partagé" }];
  migrateForSharing(doc, { localUser: "adam", userId: "u-adam", domains: [{ domain: core, guidelines }] });
  enableServerAllocation(doc);
  s.handle({
    method: "config",
    command: { method: "updateDomain", domainId: core.id, patch: { name: "Renommé localement" } },
  });
  expect(s.agentData.ticketContext(meta.id, ticket.id).domain?.name).toBe("Core");
  const contents = s.agentData.guidelines(meta.id).map((g) => `${g.owner.scope}:${g.content}`);
  expect(contents.sort()).toEqual(["domain:Partagé", "workspace:Local"]);
  store.close();
  rmSync(home, { recursive: true, force: true });
});

function twoScopes(shared: boolean) {
  const home = mkdtempSync(join(tmpdir(), "kibo-port-"));
  const store = openStore(home);
  const s = createService(store, { user: "adam" });
  const meta: ProjectMeta = call(s, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const config = <T>(command: ConfigCommand) => s.handle({ method: "config", command }) as T;
  const color = "#14B8A6";
  const securite = config<Domain>({ method: "createDomain", domain: { name: "Sécurité", color } });
  const sync = config<Domain>({
    method: "createDomain",
    domain: { name: "Sync", color },
    owner: { scope: "project", projectId: meta.id },
  });
  const file = (owner: GuidelineOwner, content: string) =>
    config({ method: "addGuideline", owner, path: "a.md", content });
  file({ scope: "workspace" }, "workspace");
  file({ scope: "domain", domainId: securite.id, projectId: null }, "workspace domain");
  file({ scope: "project", projectId: meta.id }, "project");
  file({ scope: "domain", domainId: sync.id, projectId: meta.id }, "project domain");
  const ticketIn = (domainId: string) => {
    const t = s.handle({
      method: "command",
      projectId: meta.id,
      command: { method: "createTicket", title: "T" },
    }) as Ticket;
    s.handle({
      method: "command",
      projectId: meta.id,
      command: { method: "updateTicket", ticketId: t.id, domainId },
    });
    return t.id;
  };
  const onSync = ticketIn(sync.id);
  const onSecurite = ticketIn(securite.id);
  if (shared) enableServerAllocation(s.docs.project(meta.id));
  const domainOf = (ticketId: string) => s.agentData.ticketContext(meta.id, ticketId).domain?.name ?? null;
  const contents = s.agentData
    .guidelines(meta.id)
    .map((g) => g.content)
    .sort();
  const result = { onSync: domainOf(onSync), onSecurite: domainOf(onSecurite), contents };
  store.close();
  rmSync(home, { recursive: true, force: true });
  return result;
}

test("a local project reads its domains then the workspace ones, and every guideline level", () => {
  expect(twoScopes(false)).toEqual({
    onSync: "Sync",
    onSecurite: "Sécurité",
    contents: ["project", "project domain", "workspace", "workspace domain"],
  });
});

test("a shared project never reads a workspace domain", () => {
  expect(twoScopes(true)).toEqual({
    onSync: "Sync",
    onSecurite: null,
    contents: ["project", "project domain", "workspace"],
  });
});

test("a local project copy of a workspace domain hides the workspace one", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-port-"));
  const store = openStore(home);
  const s = createService(store, { user: "adam" });
  const meta: ProjectMeta = call(s, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const core = s.handle({
    method: "config",
    command: { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } },
  }) as Domain;
  s.handle({
    method: "config",
    command: {
      method: "addGuideline",
      owner: { scope: "domain", domainId: core.id, projectId: null },
      path: "core.md",
      content: "Poste",
    },
  });
  const ticket = s.handle({
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "A" },
  }) as Ticket;
  s.handle({
    method: "command",
    projectId: meta.id,
    command: { method: "updateTicket", ticketId: ticket.id, domainId: core.id },
  });
  const doc = s.docs.project(meta.id);
  doc.getMap("projectDomains").set(core.id, {
    name: "Core du projet",
    color: "#14B8A6",
    guidelines: [{ path: "core.md", content: "Projet" }],
  });
  doc.commit();
  expect(s.agentData.ticketContext(meta.id, ticket.id).domain?.name).toBe("Core du projet");
  expect(s.agentData.guidelines(meta.id).map((g) => g.content)).toEqual(["Projet"]);
  store.close();
  rmSync(home, { recursive: true, force: true });
});

test("a run reads the local worktree settings of its project", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-port-"));
  try {
    const s = createService(openStore(dir), { user: "adam" });
    const meta = call(s, {
      method: "createProject",
      name: "Silo",
      key: "SILO",
      folder: null,
      color: "#F97316",
    }) as ProjectMeta;
    const worktree = { baseRef: "origin/dev", pathTemplate: "../silo-{slug}", setup: null, recipe: null };
    s.docs.updateProjectMeta(meta.id, { worktree }, true);
    const ticket = call(s, {
      method: "command",
      projectId: meta.id,
      command: { method: "createTicket", title: "A" },
    }) as Ticket;
    expect(s.agentData.ticketContext(meta.id, ticket.id).project.meta.worktree).toEqual(worktree);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const skill = (id: string, projectId: string | null): Skill => ({
  id,
  source: projectId === null ? "user" : "project",
  projectId,
  plugin: null,
  name: id,
  description: `Skill ${id}`,
  path: "",
  file: null,
  problem: null,
  hash: null,
  readOnly: false,
  shadowedBy: null,
  files: [],
  usage: { last: null, runs30d: 0 },
  reviews: { open: 0 },
  modifiedAt: null,
});

test("the port serves the agents and skills of a project from its sources, and the project key from the doc", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-port-"));
  try {
    const p2 = "22222222-2222-4222-8222-222222222222";
    const store = openStore(dir);
    const placeholder = createService(store, { user: "adam" });
    const meta = call(placeholder, {
      method: "createProject",
      name: "Boutique",
      key: "BOU",
      folder: null,
      color: "#F97316",
    }) as ProjectMeta;
    const own = memoryAgent({
      ref: `project:${meta.id}:review-pr`,
      scope: "project",
      name: "review-pr",
      projectId: meta.id,
    });
    const other = memoryAgent({ ref: `project:${p2}:seo`, scope: "project", name: "seo", projectId: p2 });
    const global = memoryAgent({ ref: "global:livraison", scope: "global", name: "livraison" });
    const source = memoryAgentSource(
      [...NEUTRAL_SYSTEM_AGENTS, global, own, other],
      [skill("deploy", null), skill("tests", meta.id), skill("x", p2)],
    );
    const s = createService(store, { user: "adam", agents: source });
    const refs = s.agentData.agents(meta.id).map((a) => a.ref);
    expect(refs).toContain("global:livraison");
    expect(refs).toContain("system:project-agent");
    expect(refs).toContain(own.ref);
    expect(refs).not.toContain(other.ref);
    expect(s.agentData.agents(null).map((a) => a.ref)).toContain(other.ref);
    expect(s.agentData.agentOf(own.ref)?.name).toBe("review-pr");
    expect(s.agentData.agentOf("global:absent")).toBeNull();
    expect(s.agentData.projectKey(meta.id)).toBe("BOU");
    expect(s.agentData.skills(meta.id).map((k) => k.id)).toEqual(["deploy", "tests"]);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
