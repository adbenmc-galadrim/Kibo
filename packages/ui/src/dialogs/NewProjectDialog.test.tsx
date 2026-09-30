import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
const ok = {
  available: true,
  reason: null,
  version: "2.1.283",
  loggedIn: true,
  profiles: { assistant: true, generateur: true },
};
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getAiStatus") return ok;
      if (req.method === "listComponents" || req.method === "listDrafts") return [];
      return answer(req);
    },
    subscribe: () => () => {},
    subscribeAi: () => () => {},
    onRunChanged: () => () => {},
    onConnection: () => () => {},
    online: () => true,
  },
}));

const { NewProjectDialog } = await import("./NewProjectDialog");

const addedPages = () =>
  calls.flatMap((c) => (c.method === "command" && c.command.method === "addPage" ? [c.command.title] : []));
const addedInstances = () =>
  calls.flatMap((c) =>
    c.method === "command" && c.command.method === "addInstance" ? [c.command.component] : [],
  );

const creating = (req: RpcRequest) => {
  if (req.method === "createProject")
    return { id: "p9", name: req.name, key: req.key, folder: null, color: req.color };
  if (req.method === "command" && req.command.method === "addPage") {
    if (req.command.title === "Tickets") throw new Error("boom");
    return {
      id: `pg-${req.command.title}`,
      title: req.command.title,
      kind: req.command.kind,
      parentId: null,
    };
  }
  return { id: "i1" };
};

const checked = (name: string) => screen.getByRole("radio", { name }).getAttribute("data-state");

beforeEach(() => {
  calls.length = 0;
  answer = () => null;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

test("NewProjectDialog creates the project then the checked pages", async () => {
  answer = (req) => {
    if (req.method === "createProject")
      return { id: "p9", name: req.name, key: req.key, folder: null, color: req.color };
    if (req.method === "command" && req.command.method === "addPage")
      return {
        id: `pg-${req.command.title}`,
        title: req.command.title,
        kind: req.command.kind,
        parentId: null,
      };
    return { id: "i1" };
  };
  const onOpenChange = mock((_: boolean) => {});
  render(<NewProjectDialog open onOpenChange={onOpenChange} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Chef·fe de projet" }));
  await user.click(screen.getByLabelText("Inclure Graphe"));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  expect(screen.getByRole("radio", { name: "Pages conseillées" }).getAttribute("data-state")).toBe("checked");
  await user.type(screen.getByLabelText("Nom"), "Facturation");
  await user.click(screen.getByRole("button", { name: "Créer le projet" }));
  expect(addedPages()).toEqual(["Tableau de bord", "Tickets"]);
  expect(addedInstances()).toEqual(["kanban@1.0.0", "graph@1.0.0", "tickets@1.0.0"]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("NewProjectDialog Passer creates an empty project", async () => {
  answer = creating;
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Passer" }));
  expect(screen.getByRole("radio", { name: "Projet vide" }).getAttribute("data-state")).toBe("checked");
  expect(screen.getByRole("radio", { name: "Pages conseillées" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("radio", { name: /Depuis un projet/ })).toBeNull();
  await user.type(screen.getByLabelText("Nom"), "Vide");
  await user.click(screen.getByRole("button", { name: "Créer le projet" }));
  expect(calls.some((c) => c.method === "createProject")).toBe(true);
  expect(addedPages()).toEqual([]);
});

test("NewProjectDialog Retour goes back to the role step with its choice", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Designer" }));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.click(screen.getByRole("button", { name: "Retour" }));
  expect(screen.getByRole("radio", { name: "Designer" }).getAttribute("data-state")).toBe("checked");
  expect(screen.getByText("Mes tickets · Notes")).toBeTruthy();
});

test("NewProjectDialog keeps the dialog open on a partial creation", async () => {
  answer = creating;
  const onOpenChange = mock((_: boolean) => {});
  render(<NewProjectDialog open onOpenChange={onOpenChange} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Continuer" }));
  await user.type(screen.getByLabelText("Nom"), "Kibo");
  await user.click(screen.getByRole("button", { name: "Créer le projet" }));
  expect(
    await screen.findByText("Projet créé, mais certaines pages n'ont pas pu être ajoutées."),
  ).toBeTruthy();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(addedPages()).toEqual(["Tableau de bord", "Kanban", "Tickets", "Graphe", "Notes"]);
  await user.click(screen.getByRole("button", { name: "Ouvrir le projet" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(calls.filter((c) => c.method === "createProject")).toHaveLength(1);
});

test("NewProjectDialog starts over at the role step when reopened", async () => {
  const view = render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Continuer" }));
  view.rerender(<NewProjectDialog open={false} onOpenChange={() => {}} count={0} />);
  view.rerender(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  expect(await screen.findByRole("button", { name: "Continuer" })).toBeTruthy();
});

test("NewProjectDialog Passer then Retour brings the role preset back", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Passer" }));
  await user.click(screen.getByRole("button", { name: "Retour" }));
  expect(screen.getByLabelText("Inclure Tableau de bord").getAttribute("data-state")).toBe("checked");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  expect(checked("Pages conseillées")).toBe("checked");
});

test("NewProjectDialog importing a folder starts on an empty project", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} focusFolder />);
  await screen.findByLabelText("Dossier du projet");
  expect(checked("Projet vide")).toBe("checked");
});

test("NewProjectDialog translates a refused creation, never shows it raw", async () => {
  answer = (req) => {
    if (req.method === "createProject") throw new KiboError("INVALID_INPUT", "project KIB already exists");
    return null;
  };
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Passer" }));
  await user.type(screen.getByLabelText("Nom"), "Kibo");
  await user.click(screen.getByRole("button", { name: "Créer le projet" }));
  expect(
    await screen.findByText("Projet refusé : cette clé est peut-être déjà prise, ou un champ est invalide."),
  ).toBeTruthy();
  expect(screen.queryByText(/already exists/)).toBeNull();
});

test("NewProjectDialog falls back to the generic error for an unknown failure", async () => {
  answer = (req) => {
    if (req.method === "createProject") throw new Error("socket hang up");
    return null;
  };
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Passer" }));
  await user.type(screen.getByLabelText("Nom"), "Kibo");
  await user.click(screen.getByRole("button", { name: "Créer le projet" }));
  expect(await screen.findByText("Une erreur est survenue.")).toBeTruthy();
  expect(screen.queryByText(/socket hang up/)).toBeNull();
});
