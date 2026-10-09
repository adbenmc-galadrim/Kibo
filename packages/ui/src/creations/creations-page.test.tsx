import { beforeEach, expect, mock, test } from "bun:test";
import { type AgentsState, type ComponentDraft, KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, runFixture } from "../agents/fixtures";
import { aiReady, draftFixture } from "../ai/draft-fixtures";
import { apiMock } from "../api-mock";

const MIN = 60_000;
const NOW = Date.UTC(2026, 9, 1, 10, 0);
const burndown = draftFixture({
  id: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
  title: "Burndown du sprint",
  status: "generating",
  runId: "r1",
  updatedAt: NOW - MIN,
});
const meteo = draftFixture({
  id: "1c6d2f4e-8b62-4e3b-8d2f-3a1e7a2c9b22",
  componentId: "meteo",
  title: "Météo",
  mode: "modify",
  baseVersion: "1.0.0",
  status: "generating",
  runId: "r2",
  attempts: 2,
  revisions: 1,
  updatedAt: NOW - 3 * MIN,
});
const hello = draftFixture({
  id: "2d7e3a5f-9c73-4f4c-9e3a-4b2f8b3d0c33",
  componentId: "hello",
  title: "Hello",
  status: "done",
  runId: "r3",
  updatedAt: NOW - 120 * MIN,
});

const agents = (): AgentsState => ({
  ...agentsFixture(),
  runs: [
    runFixture({ id: "r1", state: "running", label: "generateur-1" }),
    runFixture({ id: "r2", state: "queued", label: "generateur-2" }),
    runFixture({ id: "r3", state: "done", label: "generateur-3" }),
  ],
  queue: [
    { runId: "x", position: 1, reason: null },
    { runId: "r2", position: 2, reason: null },
  ],
});

const calls: RpcRequest[] = [];
let drafts: ComponentDraft[] = [];
let listError: KiboError | null = null;
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "listComponentDrafts") {
          if (listError) throw listError;
          return drafts;
        }
        if (req.method === "getRunLog") {
          if (req.runId === "r1") throw new KiboError("NOT_FOUND", "no log");
          return [];
        }
        if (req.method === "getAiStatus") return aiReady;
        if (req.method === "getComponentDraft")
          return [burndown, meteo, hello].find((d) => d.id === req.draftId) ?? null;
        return null;
      },
      subscribeAi: () => () => {},
      subscribeTopic: () => () => {},
    },
  }),
);

const { CreationsPage } = await import("./CreationsPage");

beforeEach(() => {
  calls.length = 0;
  drafts = [burndown, meteo, hello];
  listError = null;
});

test("screen 130: drafts are grouped, each row shows step, run state and actions; Journal and Abandonner work", async () => {
  const user = userEvent.setup();
  render(<CreationsPage agents={agents()} now={NOW} />);
  const active = await screen.findByRole("region", { name: /En cours \(2\)/ });
  const burndownRow = within(active).getByRole("row", { name: /Burndown du sprint/ });
  expect(burndownRow.textContent).toContain("2 · Générer (agent)");
  expect(burndownRow.textContent).toContain("Création");
  expect(burndownRow.textContent).toContain("il y a 1 min");
  await waitFor(() => expect(burndownRow.textContent).toContain("En cours"));
  const meteoRow = within(active).getByRole("row", { name: /Météo/ });
  expect(meteoRow.textContent).toContain("En file #2");
  expect(meteoRow.textContent).toContain("Modification");
  expect(meteoRow.textContent).toContain("2 tentatives");
  expect(meteoRow.textContent).toContain("1 révision");
  const finished = screen.getByRole("region", { name: /Terminées \(1\)/ });
  expect(finished.textContent).toContain("Publié");
  expect(within(finished).queryByRole("button", { name: /Abandonner/ })).toBeNull();

  const journal = within(active).getByRole("button", { name: "Journal de Burndown du sprint" });
  expect(journal.getAttribute("aria-expanded")).toBe("false");
  await user.click(journal);
  expect(journal.getAttribute("aria-expanded")).toBe("true");
  expect(await screen.findByText("Journal indisponible pour ce run.")).toBeTruthy();

  await user.click(within(active).getByRole("button", { name: "Abandonner Burndown du sprint" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Abandonner Burndown du sprint ?" });
  expect(confirm.textContent).toContain("Le brouillon et ses images sont supprimés");
  await user.click(within(confirm).getByRole("button", { name: "Annuler" }));
  expect(calls.some((c) => c.method === "abandonComponentDraft")).toBe(false);

  await user.click(within(active).getByRole("button", { name: "Abandonner Météo" }));
  await user.click(await screen.findByRole("button", { name: "Abandonner" }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === "abandonComponentDraft")).toEqual({
      method: "abandonComponentDraft",
      draftId: meteo.id,
    }),
  );
});

test("an empty journal of a running run is not reported missing; a finished one is", async () => {
  const user = userEvent.setup();
  drafts = [{ ...burndown, runId: "r2" }, hello];
  render(<CreationsPage agents={agents()} now={NOW} />);
  await user.click(await screen.findByRole("button", { name: "Journal de Burndown du sprint" }));
  await waitFor(() => expect(calls.some((c) => c.method === "getRunLog")).toBe(true));
  expect(screen.queryByText("Journal indisponible pour ce run.")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Journal de Hello" }));
  expect(await screen.findByText("Journal indisponible pour ce run.")).toBeTruthy();
});

test("Ouvrir mounts the create dialog or the modify dialog on the draft, not on a new description", async () => {
  const user = userEvent.setup();
  render(<CreationsPage agents={agents()} now={NOW} />);
  await user.click(await screen.findByRole("button", { name: "Ouvrir Burndown du sprint" }));
  const create = await screen.findByRole("dialog", { name: "Créer un composant" });
  expect(within(create).queryByLabelText("Ce que doit faire le composant")).toBeNull();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", { name: "Ouvrir Météo" }));
  const modify = await screen.findByRole("dialog", { name: "Modifier avec l'IA" });
  expect(within(modify).queryByLabelText("Ce qu'il faut changer")).toBeNull();
});

test("empty state offers Créer un composant", async () => {
  const user = userEvent.setup();
  drafts = [];
  render(<CreationsPage agents={agents()} now={NOW} />);
  expect(await screen.findByText("Aucune création pour l'instant.")).toBeTruthy();
  expect(screen.queryByRole("region", { name: /En cours/ })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Créer un composant" }));
  expect(await screen.findByRole("dialog", { name: "Créer un composant" })).toBeTruthy();
});

test("a refused list is said in an alert", async () => {
  listError = new KiboError("INTERNAL", "boom");
  render(<CreationsPage agents={agents()} now={NOW} />);
  expect((await screen.findByRole("alert")).textContent).toBeTruthy();
  expect(screen.queryByText("Aucune création pour l'instant.")).toBeNull();
});
