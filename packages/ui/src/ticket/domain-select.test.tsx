import { expect, mock, test } from "bun:test";
import { Domain, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { kiboProject } from "../agents/fixtures";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({ client: { rpc: (req: RpcRequest) => Promise.resolve(void calls.push(req)) } }),
);
const { DomainSelect } = await import("./DomainSelect");

const inKibo = { scope: "project", projectId: "kibo" } as const;
const sync = Domain.parse({ id: "sync", name: "Sync", color: "#14B8A6", owner: inKibo });
const demon = Domain.parse({ id: "demon", name: "Démon", color: "#6366F1", owner: inKibo });
const secu = Domain.parse({ id: "secu", name: "Sécurité", color: "#B45309" });

const ticket = () => {
  const t = kiboProject().tickets[0];
  if (!t) throw new Error("fixture without ticket");
  return { ...t, domainId: "demon" };
};

test("the domain picker groups the project's domains then the workspace ones by name, none first", async () => {
  render(<DomainSelect project={kiboProject()} ticket={ticket()} domains={[sync, demon, secu]} />);
  const user = userEvent.setup();
  screen.getByRole("combobox", { name: "Domaine" }).focus();
  await user.keyboard("{Enter}");
  const list = within(await screen.findByRole("listbox"));
  expect(list.getAllByRole("option").map((o) => o.textContent)).toEqual([
    "Aucun",
    "Démon",
    "Sync",
    "Sécurité",
  ]);
  expect(list.getAllByRole("group")).toHaveLength(2);
  expect(list.getAllByText(/^Domaines /).map((label) => label.textContent)).toEqual([
    "Domaines de Kibo",
    "Domaines du workspace",
  ]);
  await user.click(list.getByRole("option", { name: "Sécurité" }));
  expect(calls).toEqual([
    {
      method: "command",
      projectId: "kibo",
      command: { method: "updateTicket", ticketId: ticket().id, domainId: "secu" },
    },
  ]);
});

test("a shared project only lists its own domains, without a workspace group", async () => {
  render(<DomainSelect project={kiboProject()} ticket={ticket()} domains={[sync, demon]} />);
  screen.getByRole("combobox", { name: "Domaine" }).focus();
  await userEvent.setup().keyboard("{Enter}");
  const list = within(await screen.findByRole("listbox"));
  expect(list.getAllByRole("group")).toHaveLength(1);
  expect(list.queryByText("Domaines du workspace")).toBeNull();
});
