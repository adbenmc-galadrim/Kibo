import { expect, test } from "bun:test";
import { domainUsageOfProjects } from "./domain-usage";
import { createProjectDoc } from "./project";
import { upsertProjectDomain } from "./project-domains";
import { createTicket } from "./tickets";

const project = (id: string, shared = false) => {
  const doc = createProjectDoc({
    id,
    key: id.toUpperCase(),
    name: id,
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
  if (shared) doc.getMap("meta").set("keyAllocator", "server");
  return doc;
};

test("usage is counted per owner: the project copy and the workspace domain apart", () => {
  const copy = project("copy");
  upsertProjectDomain(copy, "secu", { name: "Sécurité", color: "#14B8A6" }, []);
  createTicket(copy, { title: "A", domainId: "secu" });
  createTicket(copy, { title: "B", domainId: "secu" });
  const plain = project("plain");
  createTicket(plain, { title: "C", domainId: "secu" });
  createTicket(plain, { title: "D" });
  const shared = project("shared", true);
  createTicket(shared, { title: "E", domainId: "secu" });
  expect(domainUsageOfProjects([copy, plain, shared])).toEqual({
    workspace: { secu: 1 },
    projects: { copy: { secu: 2 } },
  });
});
