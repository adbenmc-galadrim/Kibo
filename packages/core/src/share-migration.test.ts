import { expect, test } from "bun:test";
import type { Binding } from "@kibo/schema";
import {
  addBinding,
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  getProjectMeta,
  getTicket,
  listBindings,
  listProjectDomainGuidelines,
  listProjectDomains,
  migrateForSharing,
  migrateForUnsharing,
  type ShareMigrationInput,
} from "./index";

const input: ShareMigrationInput = {
  localUser: "adam",
  userId: "u-adam",
  domains: [
    {
      domain: { id: "core", name: "Core", color: "#0EA5E9" },
      guidelines: [{ path: "core.md", content: "# Core\nTests d'abord." }],
    },
    { domain: { id: "design", name: "Design", color: "#A855F7" }, guidelines: [] },
  ],
};

const binding = (id: string, user: string): Binding => ({
  id,
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: user,
  runner: user,
});

function localProject() {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: "/Users/adam/kibo",
    color: "#F97316",
    worktree: null,
    storybook: null,
  });
  const mine = createTicket(doc, {
    title: "Mien",
    assignee: { kind: "human", ref: "adam" },
    domainId: "core",
  });
  const lea = createTicket(doc, { title: "Léa", assignee: { kind: "human", ref: "lea" } });
  const agent = createTicket(doc, { title: "Agent", assignee: { kind: "agent", ref: "adam" } });
  addBinding(doc, binding("b1", "adam"));
  addBinding(doc, binding("b2", "lea"));
  return { doc, mine, lea, agent };
}

test("removes the local folder from the doc and returns it", () => {
  const { doc } = localProject();
  expect(migrateForSharing(doc, input)).toEqual({ folder: "/Users/adam/kibo" });
  expect(doc.getMap("meta").get("folder")).toBeUndefined();
  expect(getProjectMeta(doc).folder).toBeNull();
});

test("rewrites only the local user's human assignments", () => {
  const { doc, mine, lea, agent } = localProject();
  migrateForSharing(doc, input);
  expect(getTicket(doc, mine.id).assignee).toEqual({ kind: "human", ref: "u-adam" });
  expect(getTicket(doc, lea.id).assignee).toEqual({ kind: "human", ref: "lea" });
  expect(getTicket(doc, agent.id).assignee).toEqual({ kind: "agent", ref: "adam" });
});

test("copies only the domains used by a ticket, with their guidelines", () => {
  const { doc } = localProject();
  migrateForSharing(doc, input);
  expect(doc.getMap("projectDomains").toJSON()).toEqual({
    core: {
      name: "Core",
      color: "#0EA5E9",
      guidelines: [{ path: "core.md", content: "# Core\nTests d'abord." }],
    },
  });
});

test("moves the local user's bindings to the account id", () => {
  const { doc } = localProject();
  migrateForSharing(doc, input);
  expect(listBindings(doc)).toEqual([
    { ...binding("b1", "adam"), createdBy: "u-adam", runner: "u-adam" },
    binding("b2", "lea"),
  ]);
});

test("refuses a project that is already shared", () => {
  const { doc } = localProject();
  migrateForSharing(doc, input);
  enableServerAllocation(doc);
  expect(() => migrateForSharing(doc, input)).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
});

test("reads the domains copied into the project, with their guidelines", () => {
  const { doc } = localProject();
  expect(listProjectDomains(doc)).toEqual([]);
  migrateForSharing(doc, input);
  doc.getMap("projectDomains").set("broken", { name: 42 });
  doc.commit();
  expect(listProjectDomains(doc)).toEqual([{ id: "core", name: "Core", color: "#0EA5E9" }]);
  expect(listProjectDomainGuidelines(doc)).toEqual([
    {
      id: "core:core.md",
      owner: { scope: "domain", domainId: "core" },
      path: "core.md",
      content: "# Core\nTests d'abord.",
    },
  ]);
});

test("unsharing gives the account's assignments and bindings back to the local user", () => {
  const { doc, mine, lea, agent } = localProject();
  migrateForSharing(doc, input);
  migrateForUnsharing(doc, { localUser: "adam", userId: "u-adam" });
  expect(getTicket(doc, mine.id).assignee).toEqual({ kind: "human", ref: "adam" });
  expect(getTicket(doc, lea.id).assignee).toEqual({ kind: "human", ref: "lea" });
  expect(getTicket(doc, agent.id).assignee).toEqual({ kind: "agent", ref: "adam" });
  const bindings = Object.fromEntries(listBindings(doc).map((b) => [b.id, [b.runner, b.createdBy]]));
  expect(bindings).toEqual({ b1: ["adam", "adam"], b2: ["lea", "lea"] });
});
