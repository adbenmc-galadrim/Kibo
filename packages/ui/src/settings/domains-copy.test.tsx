import { beforeEach, expect, mock, test } from "bun:test";
import type { ProjectSnapshot, RpcRequest, WorkspaceConfig } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configFixture, kiboProject, projectsFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(null);
      },
    },
  }),
);

const { DomainsPage } = await import("./DomainsPage");

beforeEach(() => {
  calls.length = 0;
  localStorage.clear();
});

const kibo = { scope: "project", projectId: "kibo" } as const;

function securite() {
  const found = configFixture().domains.find((d) => d.id === "securite");
  if (!found) throw new Error("fixture without securite");
  return found;
}

const copy = () => ({ ...securite(), owner: kibo });
const withCopy = (): WorkspaceConfig => {
  const base = configFixture();
  return { ...base, domains: [...base.domains, copy()] };
};

const onSecurite = (s: ProjectSnapshot, id: string): ProjectSnapshot => ({
  ...s,
  meta: { ...s.meta, id },
  domains: id === "kibo" ? [copy()] : [],
  tickets: s.tickets.map((t, i) => (i === 0 ? { ...t, domainId: "securite" } : t)),
});

const show = () =>
  render(
    <DomainsPage
      config={withCopy()}
      projects={projectsFixture}
      snapshots={
        new Map([
          ["kibo", onSecurite(kiboProject(), "kibo")],
          ["fac", onSecurite(kiboProject(), "fac")],
        ])
      }
    />,
  );
const tree = () => within(screen.getByRole("tree", { name: "Dossiers" }));

test("an unused project copy of a workspace domain can be deleted, the workspace one cannot", async () => {
  show();
  const user = userEvent.setup();
  await user.click(tree().getByRole("treeitem", { name: "Kibo" }));
  const [, copy] = tree().getAllByRole("treeitem", { name: "Sécurité" });
  await user.click(copy as HTMLElement);
  expect(screen.getByText("domaine de Kibo")).toBeTruthy();
  expect(screen.getByText("utilisé par 0 ticket")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Supprimer le domaine Sécurité" }));
  expect(await screen.findByRole("alertdialog", { name: "Supprimer le domaine Sécurité ?" })).toBeTruthy();
});

test("the workspace domain counts its tickets and the projects without a copy", async () => {
  show();
  const user = userEvent.setup();
  const [workspace] = tree().getAllByRole("treeitem", { name: "Sécurité" });
  await user.click(workspace as HTMLElement);
  expect(screen.getByText("domaine du workspace")).toBeTruthy();
  expect(screen.getByText("utilisé par 3 tickets")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Supprimer le domaine Sécurité" }));
  expect(screen.getByRole("alert").textContent).toBe("Ce domaine est utilisé par des tickets.");
});
