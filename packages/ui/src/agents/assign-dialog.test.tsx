import { beforeEach, expect, mock, test } from "bun:test";
import { type AssignPreview, KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configFixture, kiboProject } from "./fixtures";

const calls: RpcRequest[] = [];
const QUEUED: AssignPreview = {
  position: 4,
  reason: { kind: "profile", profileName: "opus-dev", used: 2, total: 2 },
  guidelines: 6,
};
let preview: () => Promise<unknown> = () => Promise.resolve(QUEUED);
let assign: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return req.method === "previewAssign" ? preview() : assign();
    },
  },
}));

const { AssignDialog } = await import("./AssignDialog");

beforeEach(() => {
  calls.length = 0;
  preview = () => Promise.resolve(QUEUED);
  assign = () => Promise.resolve(null);
});

test("assigning a waiting ticket warns, previews the queue and enqueues the run", async () => {
  const onClose = mock(() => {});
  render(<AssignDialog project={kiboProject()} ticketId="t15" config={configFixture()} onClose={onClose} />);
  expect(screen.getByText("Assigner KIB-15 à un agent")).toBeTruthy();
  expect(screen.getByText("Kanban : drag & drop entre colonnes · domaine UI")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe(
    "KIB-15 attend KIB-12 (en cours). L'agent peut démarrer, mais son résultat dépendra de « Schéma Loro des tickets (LoroTree) ».",
  );
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("combobox", { name: "Profil" }).textContent).toBe(
    "opus-dev · Claude Opus 5.5 · worktree par ticket",
  );
  expect(
    await screen.findByText("attend un créneau opus-dev (2/2) · entrera en file en position #4"),
  ).toBeTruthy();
  expect(screen.getByText("nouveau worktree kib-15 (depuis main)")).toBeTruthy();
  expect(screen.getByLabelText("Brief (optionnel)").tagName).toBe("INPUT");
  expect(screen.getByText("acceptEdits")).toBeTruthy();
  expect(screen.getByText("workspace · projet Kibo · domaine UI (6 fichiers .md)")).toBeTruthy();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Brief (optionnel)"), "  Garder l'ordre dans le LoroTree. ");
  await user.click(screen.getByRole("button", { name: "Mettre en file" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(calls).toEqual([
    { method: "previewAssign", projectId: "kibo", ticketId: "t15", profileId: "opus" },
    {
      method: "assignAgent",
      projectId: "kibo",
      ticketId: "t15",
      profileId: "opus",
      brief: "Garder l'ordre dans le LoroTree.",
    },
  ]);
});

test("a free slot means the run starts at once", async () => {
  preview = () => Promise.resolve({ position: null, reason: null, guidelines: 2 });
  render(<AssignDialog project={kiboProject()} ticketId="t14" config={configFixture()} onClose={() => {}} />);
  expect(await screen.findByText("créneau libre · démarre tout de suite")).toBeTruthy();
  expect(screen.queryByText(/attend KIB/)).toBeNull();
});

test("a refused assignment is shown and the dialog stays open", async () => {
  assign = () => Promise.reject(new KiboError("NOT_FOUND", "profile opus not found"));
  const onClose = mock(() => {});
  render(<AssignDialog project={kiboProject()} ticketId="t14" config={configFixture()} onClose={onClose} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Mettre en file" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de mettre le run en file.");
  expect(onClose).not.toHaveBeenCalled();
});

test("a failed preview is said, and assignment stays possible", async () => {
  preview = () => Promise.reject(new KiboError("INTERNAL", "boom"));
  render(<AssignDialog project={kiboProject()} ticketId="t14" config={configFixture()} onClose={() => {}} />);
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'estimer la file d'attente.");
  expect(screen.getByRole("button", { name: "Mettre en file" }).hasAttribute("disabled")).toBe(false);
});

test("launching from the drawer picks the first open ticket", async () => {
  render(
    <AssignDialog project={kiboProject()} ticketId={null} config={configFixture()} onClose={() => {}} />,
  );
  expect(screen.getByText("Lancer un agent")).toBeTruthy();
  expect(screen.getByLabelText("Ticket")).toBeTruthy();
  await waitFor(() =>
    expect(calls).toEqual([
      { method: "previewAssign", projectId: "kibo", ticketId: "t12", profileId: "opus" },
    ]),
  );
});

test("without a profile or a project the dialog explains what to do", () => {
  const noProfile = { ...configFixture(), profiles: [] };
  const view = render(
    <AssignDialog project={kiboProject()} ticketId="t14" config={noProfile} onClose={() => {}} />,
  );
  expect(screen.getByText("Crée d'abord un profil d'agent dans la page Agents.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mettre en file" })).toBeNull();
  view.unmount();
  render(<AssignDialog project={null} ticketId={null} config={configFixture()} onClose={() => {}} />);
  expect(screen.getByText("Ouvre un projet pour lancer un agent.")).toBeTruthy();
  expect(calls).toEqual([]);
});

test("the worktree base branch can be given", async () => {
  render(
    <AssignDialog
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      baseBranch="develop"
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("nouveau worktree kib-14 (depuis develop)")).toBeTruthy();
  await waitFor(() => expect(calls.length).toBe(1));
});

test("without an open ticket the drawer launch explains what to do", () => {
  const project = kiboProject();
  const closed = { ...project, tickets: project.tickets.map((t) => ({ ...t, statusId: "done" as const })) };
  render(<AssignDialog project={closed} ticketId={null} config={configFixture()} onClose={() => {}} />);
  expect(screen.getByText("Aucun ticket ouvert : crée d'abord un ticket à confier à un agent.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mettre en file" })).toBeNull();
  expect(calls).toEqual([]);
});
