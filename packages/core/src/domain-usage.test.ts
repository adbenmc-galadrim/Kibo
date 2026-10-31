import { expect, test } from "bun:test";
import { domainUsageOfProjects } from "./domain-usage";
import { createProjectDoc } from "./project";
import { upsertProjectDomain } from "./project-domains";
import { createTicket } from "./tickets";

const project = (id: string) =>
  createProjectDoc({
    id,
    key: id.toUpperCase(),
    name: id,
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });

test("usage is counted per owner: the project copy and the workspace domain apart", () => {
  const copy = project("copy");
  upsertProjectDomain(copy, "secu", { name: "Sécurité", color: "#14B8A6" }, []);
  createTicket(copy, { title: "A", domainId: "secu" });
  createTicket(copy, { title: "B", domainId: "secu" });
  const plain = project("plain");
  createTicket(plain, { title: "C", domainId: "secu" });
  createTicket(plain, { title: "D" });
  expect(domainUsageOfProjects([copy, plain])).toEqual({
    workspace: { secu: 1 },
    projects: { copy: { secu: 2 } },
  });
});
