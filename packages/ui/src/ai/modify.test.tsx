import { beforeEach, expect, mock, test } from "bun:test";
import { type ComponentDraft, KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
let start: () => Promise<unknown> = async () => ({ id: DRAFT, status: "generating" });

mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getAiStatus") return ok;
      if (req.method === "listComponentDrafts") return drafts;
      return start();
    },
    subscribeAi: () => () => {},
  },
}));
mock.module("./AiDraftPanel", () => ({
  AiDraftPanel: ({ draftId }: { draftId: string }) => <p>panel {draftId}</p>,
}));
const { ModifyWithAiDialog, modifiable } = await import("./ModifyWithAiDialog");
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
  expect(calls.at(-1)).toEqual({
    method: "startComponentDraft",
    draft: { mode: "modify", id: "burndown", description: "Ajoute un titre", attachments: [] },
  });
  expect(await screen.findByText(`panel ${DRAFT}`)).toBeTruthy();
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
  expect(await screen.findByText(`panel ${ACTIVE}`)).toBeTruthy();
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
