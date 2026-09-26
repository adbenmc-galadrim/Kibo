import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest, type RunState } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DRAFT_ID,
  draftFixture as details,
  burndownManifest as manifest,
  burndownPublish as publish,
  failingReport as report,
  uiDiff,
} from "./draft-fixtures";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
let runState: RunState = "running";
const aiReady = {
  available: true,
  reason: null,
  version: "2.1.283",
  loggedIn: true,
  profiles: { assistant: true, generateur: true },
};
let aiStatus: unknown = aiReady;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getAiStatus") return aiStatus;
      const out = answer(req);
      if (out instanceof Error) throw out;
      return out;
    },
    subscribeAi: () => () => {},
  },
}));
mock.module("../state/use-agents", () => ({
  useAgents: () => ({ runs: [{ id: "run-7", label: "generateur", profileName: "opus", state: runState }] }),
  useConfig: () => null,
  useNow: () => 0,
  useRunLog: () => [],
  useDaemonOnline: () => true,
}));
mock.module("../state/use-projects", () => ({ useProjects: () => [], useProject: () => null }));

const { AiDraftPanel } = await import("./AiDraftPanel");

beforeEach(() => {
  calls.length = 0;
  runState = "running";
  aiStatus = aiReady;
});

const stepLabels = () =>
  within(screen.getByRole("list", { name: "Créer un composant" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

const retryButton = async () => {
  const button = await screen.findByRole("button", { name: "Corriger avec l'agent" });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  return button;
};

test("step 2 shows the attempt and the run journal", async () => {
  answer = () => details({});
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  expect(await screen.findByText("Tentative 1 sur 3 · opus · En cours")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Journal de generateur" })).toBeTruthy();
  expect(
    screen.getByText(
      "L'agent ne peut écrire que dans le dossier brouillon ; kibo.component.json est réservé à Kibo.",
    ),
  ).toBeTruthy();
});

test("step 3 failure: report, incidents, retry; exhausted: code fallback only", async () => {
  answer = () =>
    details({
      status: "failed",
      failure: { kind: "validation", detail: null },
      report,
      incidents: [{ kind: "restored", path: "kibo.component.json" }],
    });
  const { unmount } = render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  expect(await screen.findByText("kibo.component.json restauré (fichier réservé à Kibo)")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(await retryButton());
  expect(calls.find((c) => c.method === "retryComponentDraft")).toEqual({
    method: "retryComponentDraft",
    draftId: DRAFT_ID,
  });
  unmount();
  answer = () =>
    details({ status: "failed", attempts: 3, failure: { kind: "validation", detail: null }, report });
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  expect(await screen.findByRole("button", { name: "Revalider" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ouvrir le dossier dans l'éditeur" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Corriger avec l'agent" })).toBeNull();
  expect(screen.getByRole("button", { name: "Abandonner" }).dataset.variant).toBe("ghost");
});

test("review (create) then permissions then finalize on the current page", async () => {
  let status: "review" | "permissions" = "review";
  answer = (req) => {
    if (req.method === "reviewComponentDraft") status = "permissions";
    if (req.method === "finalizeComponentDraft")
      return { publish: {}, version: { version: "0.1.0" }, instanceId: "i1" };
    return details({
      status,
      diff: [uiDiff],
      manifest,
      publish: { ...publish, hash: status === "permissions" ? "3f9a".padEnd(64, "0") : null },
    });
  };
  const onDone = mock(() => {});
  render(<AiDraftPanel draftId={DRAFT_ID} target={{ projectId: "p1", pageId: "pg1" }} onDone={onDone} />);
  const user = userEvent.setup();
  expect(await screen.findByText("export function Burndown() {}")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Abandonner" }).dataset.variant).toBe("ghost");
  await user.click(screen.getByRole("button", { name: "J'ai relu, continuer" }));
  expect(calls.find((c) => c.method === "reviewComponentDraft")).toEqual({
    method: "reviewComponentDraft",
    draftId: DRAFT_ID,
    version: "0.1.0",
    changes: [],
  });
  expect(await screen.findByText(/3f9a…0000/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Autoriser et ajouter" }));
  expect(calls.find((c) => c.method === "finalizeComponentDraft")).toEqual({
    method: "finalizeComponentDraft",
    draftId: DRAFT_ID,
    version: "0.1.0",
    hash: "3f9a".padEnd(64, "0"),
    trust: "sandboxed",
    strategy: "update-all",
    target: { projectId: "p1", pageId: "pg1" },
  });
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
});

test("review (modify) goes through the publish step with an editable version", async () => {
  answer = () =>
    details({
      mode: "modify",
      baseVersion: "0.1.0",
      status: "review",
      diff: [uiDiff],
      manifest,
      publish: { ...publish, from: "0.1.0", to: "0.2.0", status: "update", changes: ["Ajoute un titre"] },
    });
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "J'ai relu, continuer" }));
  const version = await screen.findByLabelText("Version");
  await user.clear(version);
  await user.type(version, "0.1.1");
  await user.click(screen.getByRole("button", { name: "Publier" }));
  expect(calls.find((c) => c.method === "reviewComponentDraft")).toEqual({
    method: "reviewComponentDraft",
    draftId: DRAFT_ID,
    version: "0.1.1",
    changes: ["Ajoute un titre"],
  });
});

test("step 3 failure names the problem count and the finished attempt", async () => {
  runState = "done";
  answer = () => details({ status: "failed", failure: { kind: "validation", detail: null }, report });
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  expect(await screen.findByText("Burndown · la validation a trouvé 1 problème.")).toBeTruthy();
  expect(screen.getByText("Tentative 1 sur 3 · opus · Terminé")).toBeTruthy();
});

test("exhausted attempts read as a failure of the agent", async () => {
  runState = "done";
  const twoProblems = { ...report, tests: { ok: false, passed: 5, failed: 1, output: "1 fail" } };
  answer = () =>
    details({
      status: "failed",
      attempts: 3,
      failure: { kind: "validation", detail: null },
      report: twoProblems,
    });
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  expect(
    await screen.findByText("Burndown · l'agent n'a pas réussi à faire passer la validation."),
  ).toBeTruthy();
  expect(screen.getByText("Tentative 3 sur 3 · opus · Échec")).toBeTruthy();
});

test("permissions without a hash explain the state instead of an empty step", async () => {
  answer = () => details({ status: "permissions", manifest, publish });
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  expect(
    await screen.findByText(
      "Empreinte ou manifeste manquant : abandonne le brouillon pour relancer la génération.",
    ),
  ).toBeTruthy();
});

test("abandoning does not reload a closed panel", async () => {
  answer = () => details({});
  let close = () => {};
  const view = render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => close()} />);
  close = view.unmount;
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Abandonner" }));
  await waitFor(() => expect(calls.some((c) => c.method === "abandonComponentDraft")).toBe(true));
  await new Promise((r) => setTimeout(r, 0));
  const abandonAt = calls.findIndex((c) => c.method === "abandonComponentDraft");
  expect(calls.slice(abandonAt + 1).some((c) => c.method === "getComponentDraft")).toBe(false);
});

test("an action failure is shown in French, never as the raw detail", async () => {
  answer = (req) =>
    req.method === "retryComponentDraft"
      ? new KiboError("INTERNAL", "ENOSPC: no space left on device")
      : details({ status: "failed", failure: { kind: "validation", detail: null }, report });
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  const user = userEvent.setup();
  await user.click(await retryButton());
  expect((await screen.findByRole("alert")).textContent).toBe("Erreur interne du démon.");
  expect(screen.queryByText(/ENOSPC/)).toBeNull();
});

test("a loading failure is shown in French", async () => {
  answer = () => new KiboError("NOT_FOUND", "draft 0b5c missing");
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  expect((await screen.findByRole("alert")).textContent).toBe("Brouillon introuvable.");
});

test("create mode shows five steps, ending on the page", async () => {
  answer = () => details({});
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  await screen.findByText("Tentative 1 sur 3 · opus · En cours");
  expect(stepLabels().at(-1)).toBe("5 · Ajouter à la page");
});

test("modify mode has no step 5: the draft updates the component", async () => {
  answer = () => details({ mode: "modify", baseVersion: "0.1.0" });
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  await screen.findByText("Tentative 1 sur 3 · opus · En cours");
  expect(stepLabels()).toHaveLength(4);
  expect(screen.queryByText("5 · Ajouter à la page")).toBeNull();
});

test("retry is disabled with the reason when the AI is unavailable", async () => {
  aiStatus = { ...aiReady, available: false, reason: "logged_out", loggedIn: false };
  answer = () => details({ status: "failed", failure: { kind: "validation", detail: null }, report });
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  expect(await screen.findByText("claude n'est pas connecté")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Corriger avec l'agent" }).hasAttribute("disabled")).toBe(true);
});
