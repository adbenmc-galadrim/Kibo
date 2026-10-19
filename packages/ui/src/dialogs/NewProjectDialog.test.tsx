import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
const DAEMON_TODAY = "2026-10-16";

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getAppInfo") return { today: DAEMON_TODAY };
        return answer(req);
      },
      subscribe: () => () => {},
      onConnection: () => () => {},
      online: () => true,
    },
  }),
);

afterEach(() => setSystemTime());

const { NewProjectDialog } = await import("./NewProjectDialog");

const created = (req: RpcRequest) =>
  req.method === "createProject"
    ? { id: "p9", name: req.name, key: req.key, folder: null, color: req.color }
    : null;
const createCalls = () => calls.filter((c) => c.method === "createProject");
const submitButton = () => screen.getByRole("button", { name: "Créer" });
const disabled = (el: HTMLElement) => el.hasAttribute("disabled");

beforeEach(() => {
  setSystemTime(new Date(2026, 9, 27, 10));
  calls.length = 0;
  answer = created;
  location.hash = "";
});

test("NewProjectDialog is a single step with the defaults of the next Monday", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} />);
  expect(await screen.findByDisplayValue("2026-10-19")).toBeTruthy();
  expect(screen.getByLabelText("Nombre de sprints").getAttribute("value")).toBe("6");
  expect(screen.getByRole("radio", { name: "1 semaine" }).getAttribute("data-state")).toBe("checked");
  expect(screen.getByText("6 sprints d'une semaine · du 19 oct. au 27 nov. 2026")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Continuer" })).toBeNull();
  expect(disabled(submitButton())).toBe(true);
});

test("NewProjectDialog preview follows the sprint fields", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} />);
  const user = userEvent.setup();
  const count = await screen.findByLabelText("Nombre de sprints");
  await user.clear(count);
  await user.type(count, "2");
  await user.click(screen.getByRole("radio", { name: "2 semaines" }));
  expect(screen.getByText("2 sprints de deux semaines · du 19 oct. au 13 nov. 2026")).toBeTruthy();
  await user.clear(count);
  await user.type(count, "53");
  expect(screen.getByText("De 1 à 52.")).toBeTruthy();
});

test("NewProjectDialog derives the key, keeps a typed one and refuses a taken one", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={["SILO"]} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Nom"), "Location de box");
  const key = screen.getByLabelText("Clé");
  expect(key.getAttribute("value")).toBe("LB");
  await user.clear(key);
  await user.type(key, "silo");
  expect(key.getAttribute("value")).toBe("SILO");
  expect(screen.getByText("Clé déjà prise")).toBeTruthy();
  expect(disabled(submitButton())).toBe(true);
  await user.type(key, "X");
  expect(screen.queryByText("Clé déjà prise")).toBeNull();
  expect(disabled(submitButton())).toBe(false);
});

test("NewProjectDialog refuses the key reserved for the inbox", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Nom"), "Courrier");
  const key = screen.getByLabelText("Clé");
  await user.clear(key);
  await user.type(key, "inb");
  expect(screen.getByText("La clé INB est réservée à la boîte de réception.")).toBeTruthy();
  expect(disabled(submitButton())).toBe(true);
});

test("NewProjectDialog creates the project with its setup and client, then opens it", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<NewProjectDialog open onOpenChange={onOpenChange} count={1} existingKeys={[]} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Nom"), "Silo");
  const key = screen.getByLabelText("Clé");
  await user.clear(key);
  await user.type(key, "SILO");
  await user.type(screen.getByLabelText("Client"), "Silo SA");
  await user.click(submitButton());
  expect(createCalls()).toEqual([
    {
      method: "createProject",
      name: "Silo",
      key: "SILO",
      client: "Silo SA",
      folder: null,
      color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
      setup: { sprintStart: "2026-10-19", sprintCount: 6, sprintWeeks: 1 },
    },
  ]);
  expect(calls.some((c) => c.method === "command")).toBe(false);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(location.hash).toContain("p9");
});

test("NewProjectDialog translates a refused creation, never shows it raw", async () => {
  answer = (req) => {
    if (req.method === "createProject") throw new KiboError("INVALID_INPUT", "project KIB already exists");
    if (req.method === "listProjects") return [];
    return null;
  };
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Nom"), "Kibo");
  await user.click(submitButton());
  expect(
    await screen.findByText("Projet refusé : cette clé est peut-être déjà prise, ou un champ est invalide."),
  ).toBeTruthy();
  expect(screen.queryByText(/already exists/)).toBeNull();
});

test("NewProjectDialog offers to open a project whose pages or sprints failed", async () => {
  answer = (req) => {
    if (req.method === "createProject") throw new KiboError("INTERNAL", "seed failed");
    if (req.method === "listProjects") return [{ id: "p9", key: "KIB", name: "Kibo" }];
    return null;
  };
  const onOpenChange = mock((_: boolean) => {});
  render(<NewProjectDialog open onOpenChange={onOpenChange} count={0} existingKeys={[]} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Nom"), "Kibo");
  await user.click(submitButton());
  expect(await screen.findByText("Projet créé, pages ou sprints incomplets.")).toBeTruthy();
  expect(onOpenChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Ouvrir" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(location.hash).toContain("p9");
  expect(createCalls()).toHaveLength(1);
});

test("NewProjectDialog falls back to the generic error for an unknown failure", async () => {
  answer = (req) => {
    if (req.method === "createProject") throw new Error("socket hang up");
    if (req.method === "listProjects") return [];
    return null;
  };
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Nom"), "Kibo");
  await user.click(submitButton());
  expect(await screen.findByText("Une erreur est survenue.")).toBeTruthy();
  expect(screen.queryByText(/socket hang up/)).toBeNull();
});

test("NewProjectDialog starts over when reopened", async () => {
  const view = render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Nom"), "Brouillon");
  view.rerender(<NewProjectDialog open={false} onOpenChange={() => {}} count={0} existingKeys={[]} />);
  view.rerender(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} />);
  expect((await screen.findByLabelText("Nom")).getAttribute("value")).toBe("");
});

test("NewProjectDialog focuses the folder when importing one", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} focusFolder />);
  const folder = await screen.findByLabelText("Dossier du dépôt");
  expect(document.activeElement).toBe(folder);
  expect(screen.getByText("Facultatif. Sans dossier, pas de suivi git.")).toBeTruthy();
});
