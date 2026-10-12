import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";
import { projectsFixture } from "../fixtures";
import { agentFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let create: (req: RpcRequest) => Promise<unknown> = () =>
  Promise.resolve({ agent: agentFixture(), missingSubagents: [] });

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return req.method === "agents.create" ? create(req) : Promise.resolve(null);
      },
    },
  }),
);

const { NewAgentDialog } = await import("./NewAgentDialog");

beforeEach(() => {
  calls.length = 0;
  create = () => Promise.resolve({ agent: agentFixture(), missingSubagents: [] });
});

const show = () => {
  const onClose = mock(() => {});
  render(<NewAgentDialog projects={projectsFixture} onClose={onClose} />);
  return { dialog: within(screen.getByRole("dialog", { name: "Nouvel agent" })), onClose };
};
const DESCRIPTION = "Relit une PR en lecture seule et rend un verdict.";

test("screen 192b: the fields, the Claude Code preview and the file to be created", async () => {
  const { dialog } = show();
  const user = userEvent.setup();
  expect(dialog.getByRole("radio", { name: "Global" }).getAttribute("aria-checked")).toBe("true");
  expect(dialog.getByRole("combobox", { name: "Modèle" }).textContent).toBe("hérité (Sonnet)");
  expect(
    dialog.getAllByRole("radio", { name: /^(Vide|Livraison|Review|SEO|Chef d'orchestre)/ }),
  ).toHaveLength(5);
  await user.type(dialog.getByLabelText("Nom"), "review-pr");
  await user.type(dialog.getByLabelText("Description"), DESCRIPTION);
  expect(dialog.getByText(/^Dans Claude Code :/).textContent).toBe(
    `Dans Claude Code : review-pr — ${DESCRIPTION}`,
  );
  expect(dialog.getByText("~/.claude/agents/review-pr.md")).toBeTruthy();
  await user.click(dialog.getByRole("radio", { name: "Projet" }));
  expect(dialog.getByText("/Users/adam/goinfre/Kibo/.claude/agents/review-pr.md")).toBeTruthy();
});

test("an empty name suggests one from the description", async () => {
  const { dialog } = show();
  const user = userEvent.setup();
  await user.type(dialog.getByLabelText("Description"), DESCRIPTION);
  const name = dialog.getByLabelText("Nom");
  expect(name.getAttribute("placeholder")).toBe("relit-pr-lecture");
  await user.click(dialog.getByRole("button", { name: "Utiliser relit-pr-lecture" }));
  expect(name instanceof HTMLInputElement && name.value).toBe("relit-pr-lecture");
});

test("a vague name or a short description blocks the creation", async () => {
  const { dialog } = show();
  const user = userEvent.setup();
  await user.type(dialog.getByLabelText("Nom"), "agent-1");
  await user.type(dialog.getByLabelText("Description"), "Relit");
  expect(
    dialog.getByText("Nom peu parlant : dis ce que fait l'agent (review-pr, livraison-front)"),
  ).toBeTruthy();
  expect(dialog.getByText(/^Une phrase de 20 à 200 caractères/)).toBeTruthy();
  expect(dialog.getByRole("button", { name: "Créer l'agent" }).hasAttribute("disabled")).toBe(true);
});

test("a project without a local folder cannot hold agents", async () => {
  const { dialog } = show();
  const user = userEvent.setup();
  await user.click(dialog.getByRole("radio", { name: "Projet" }));
  dialog.getByRole("combobox", { name: "Projet de l'agent" }).focus();
  await user.keyboard("{Enter}");
  const option = await screen.findByRole("option", { name: "API Facturation · sans dossier local" });
  expect(option.getAttribute("aria-disabled")).toBe("true");
});

test("creating sends the agent, and a missing subagent can be created next", async () => {
  create = () =>
    Promise.resolve({ agent: agentFixture({ name: "chef-orchestre" }), missingSubagents: ["seo"] });
  const { dialog, onClose } = show();
  const user = userEvent.setup();
  await user.type(dialog.getByLabelText("Nom"), "chef-orchestre");
  await user.type(
    dialog.getByLabelText("Description"),
    "Enchaîne livraison, review puis seo et rend un compte rendu.",
  );
  await user.click(dialog.getByRole("radio", { name: /^Chef d'orchestre/ }));
  expect(dialog.getByText(/Sous-agents appelables posés/)).toBeTruthy();
  await user.click(dialog.getByRole("button", { name: "Créer l'agent" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "agents.create",
      scope: "global",
      name: "chef-orchestre",
      description: "Enchaîne livraison, review puis seo et rend un compte rendu.",
      template: "conductor",
    }),
  );
  expect(await dialog.findByText("Sous-agent manquant : seo")).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
  await user.click(dialog.getByRole("button", { name: "Créer seo" }));
  const name = dialog.getByLabelText("Nom");
  expect(name instanceof HTMLInputElement && name.value).toBe("seo");
  expect(dialog.getByRole("radio", { name: /^SEO/ }).getAttribute("aria-checked")).toBe("true");
});

test("a name already taken says so", async () => {
  create = () => Promise.reject(new KiboError("CONFLICT", "exists"));
  const { dialog, onClose } = show();
  const user = userEvent.setup();
  await user.type(dialog.getByLabelText("Nom"), "review-pr");
  await user.type(dialog.getByLabelText("Description"), DESCRIPTION);
  await user.click(dialog.getByRole("button", { name: "Créer l'agent" }));
  expect(await dialog.findByText("Un agent de ce nom existe déjà")).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});

test("a plain creation closes the dialog", async () => {
  const { dialog, onClose } = show();
  const user = userEvent.setup();
  await user.type(dialog.getByLabelText("Nom"), "review-pr");
  await user.type(dialog.getByLabelText("Description"), DESCRIPTION);
  await user.click(dialog.getByRole("button", { name: "Créer l'agent" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});
