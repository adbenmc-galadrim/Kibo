import { beforeEach, expect, mock, test } from "bun:test";
import { type ComponentDraft, KiboError, type RpcRequest } from "@kibo/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { draftFixture } from "./draft-fixtures";

const DRAFT = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
const ACTIVE = "5d2e8a41-3c7b-4f19-8e60-9a1b2c3d4e5f";
const calls: RpcRequest[] = [];
const ok = {
  available: true,
  reason: null,
  version: "2.1.283",
  loggedIn: true,
  profiles: { assistant: true, generateur: true },
};
let drafts: ComponentDraft[] = [];
let demoProject = false;
let start: () => Promise<unknown> = async () => ({ id: DRAFT, status: "generating" });

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getAiStatus") return ok;
        if (req.method === "listComponentDrafts") return drafts;
        if (req.method === "listProjects") return [{ id: "p", demo: demoProject }];
        if (req.method === "getComponentDraft")
          return draftFixture({ id: req.draftId, mode: "modify", baseVersion: "0.1.0", status: "review" });
        return start();
      },
      subscribeAi: () => () => {},
    },
  }),
);
const { ModifyWithAiDialog, modifiable } = await import("./ModifyWithAiDialog");
const panelOf = async (draftId: string) => {
  await screen.findByRole("button", { name: "J'ai relu, continuer" });
  await waitFor(() => expect(calls).toContainEqual({ method: "getComponentDraft", draftId }));
};
const target = { id: "burndown", title: "Burndown", version: "0.1.0", origin: "ai" } as const;

const draft = (patch: Partial<ComponentDraft>): ComponentDraft => ({
  id: ACTIVE,
  componentId: "burndown",
  mode: "modify",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  baseVersion: "0.1.0",
  description: "Ajoute un titre",
  runId: null,
  sessionId: null,
  status: "review",
  attempts: 1,
  failure: null,
  incidents: [],
  attachments: [],
  revisions: 0,
  template: "blank",
  projectId: null,
  createdAt: 1,
  updatedAt: 2,
  ...patch,
});

test("only user and ai components can be modified", () => {
  expect(["kibo", "user", "ai", "marketplace"].filter((o) => modifiable(o))).toEqual(["user", "ai"]);
});

beforeEach(() => {
  calls.length = 0;
  drafts = [];
  demoProject = false;
  start = async () => ({ id: DRAFT, status: "generating" });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

test("sends the change request then shows the draft panel", async () => {
  render(<ModifyWithAiDialog component={target} open onOpenChange={() => {}} />);
  expect(screen.getByText("Modifier « Burndown » avec l'IA")).toBeTruthy();
  expect(screen.getByText("Version actuelle 0.1.0 · Créé par l'IA")).toBeTruthy();
  const user = userEvent.setup();
  const launch = await screen.findByRole("button", { name: "Lancer l'agent" });
  expect(launch.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Ajoute un titre");
  await user.click(launch);
  expect(calls.find((c) => c.method === "startComponentDraft")).toEqual({
    method: "startComponentDraft",
    draft: { mode: "modify", id: "burndown", description: "Ajoute un titre", attachments: [] },
  });
  await panelOf(DRAFT);
});

test("offline disables the agent with the reason", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  render(<ModifyWithAiDialog component={{ ...target, origin: "user" }} open onOpenChange={() => {}} />);
  expect(screen.getByText("Version actuelle 0.1.0 · Créé par toi")).toBeTruthy();
  expect(await screen.findByText("Hors ligne")).toBeTruthy();
});

test("an active draft of the component is offered for resumption", async () => {
  drafts = [
    draft({ id: DRAFT, componentId: "pr-queue", title: "PR en attente" }),
    draft({ status: "abandoned", id: DRAFT }),
    draft({}),
  ];
  render(<ModifyWithAiDialog component={target} open onOpenChange={() => {}} />);
  expect(await screen.findByText("Brouillon en cours : Burndown")).toBeTruthy();
  expect(screen.queryByLabelText("Ce qu'il faut changer")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Reprendre" }));
  await panelOf(ACTIVE);
});

test("a conflict on start offers the draft that won the race", async () => {
  start = async () => {
    drafts = [draft({})];
    throw new KiboError("CONFLICT", "component burndown already has an active draft");
  };
  render(<ModifyWithAiDialog component={target} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Ajoute un titre");
  await user.click(await screen.findByRole("button", { name: "Lancer l'agent" }));
  expect(await screen.findByText("Brouillon en cours : Burndown")).toBeTruthy();
  expect(screen.queryByText(/already has an active draft/)).toBeNull();
});

test("a start failure is translated, never shown raw", async () => {
  start = async () => {
    throw new KiboError("AI_UNAVAILABLE", "claude exited with code 1");
  };
  render(<ModifyWithAiDialog component={target} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Ajoute un titre");
  await user.click(await screen.findByRole("button", { name: "Lancer l'agent" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "claude est indisponible : vérifie son installation et sa connexion.",
  );
});

test("a conflict without a draft to resume says the component is busy", async () => {
  start = async () => {
    throw new KiboError("CONFLICT", "component burndown already has an active draft");
  };
  render(<ModifyWithAiDialog component={target} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Ajoute un titre");
  await user.click(await screen.findByRole("button", { name: "Lancer l'agent" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Un brouillon est déjà en cours pour ce composant : réessaie dans un instant.",
  );
});

test("cancel is an outline button, as on the mockup", () => {
  render(<ModifyWithAiDialog component={target} open onOpenChange={() => {}} />);
  expect(screen.getByRole("button", { name: "Annuler" }).getAttribute("data-variant")).toBe("outline");
});

test("the change request carries the attached images, pasted or picked", async () => {
  render(<ModifyWithAiDialog component={target} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  expect(screen.getByRole("group", { name: "Maquettes (facultatif)" })).toBeTruthy();
  await user.upload(
    screen.getByLabelText("Ajouter des images"),
    new File([png], "Titre voulu.png", { type: "image/png" }),
  );
  fireEvent.paste(screen.getByLabelText("Ce qu'il faut changer"), {
    clipboardData: { files: [new File([png], "image.png", { type: "image/png" })], getData: () => "" },
  });
  expect(await screen.findByRole("img", { name: "image.png" })).toBeTruthy();
  await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Ajoute un titre");
  await user.click(await screen.findByRole("button", { name: "Lancer l'agent" }));
  const req = calls.find((c) => c.method === "startComponentDraft");
  expect(req?.method === "startComponentDraft" && req.draft.attachments.map((a) => a.name)).toEqual([
    "Titre-voulu.png",
    "image.png",
  ]);
});

test("a draft id opens its panel directly, even without the component", async () => {
  render(<ModifyWithAiDialog component={null} draftId={ACTIVE} open onOpenChange={() => {}} />);
  await panelOf(ACTIVE);
  expect(screen.getByRole("dialog", { name: "Modifier avec l'IA" })).toBeTruthy();
  expect(calls.some((c) => c.method === "listComponentDrafts")).toBe(false);
});

test("the change request carries the current project, and the demo project says no token is spent", async () => {
  demoProject = true;
  render(<ModifyWithAiDialog component={target} projectId="p" open onOpenChange={() => {}} />);
  expect(await screen.findByText("Agent de démonstration · aucun token consommé")).toBeTruthy();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Ajoute un titre");
  await user.click(screen.getByRole("button", { name: "Lancer l'agent" }));
  expect(calls.find((c) => c.method === "startComponentDraft")).toMatchObject({
    draft: { mode: "modify", id: "burndown", projectId: "p" },
  });
});
