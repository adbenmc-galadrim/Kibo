import { beforeEach, expect, test } from "bun:test";
import type { AgentSnapshot } from "@kibo/remote";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../../App";
import { type PhoneFixture, phoneFixture } from "../../app-test-kit";
import { putBlob } from "../../fake-server-api";
import type { Connectivity } from "../../remote-client";
import { sealJson } from "../../test-kit";
import { SPRINT_ANSWER, siloAgentProject, siloAgentSnapshot } from "./agent-test-kit";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/agent";
});

async function openAgent(
  agent: AgentSnapshot = siloAgentSnapshot(),
  connectivity: Connectivity = { macOnline: true, phoneOnline: true },
): Promise<PhoneFixture> {
  const fixture = await phoneFixture({ connectivity });
  putBlob(fixture.api, await sealJson(fixture.keys, "silo", "project", siloAgentProject()));
  putBlob(fixture.api, await sealJson(fixture.keys, "silo", "agent", agent));
  render(<App runtime={fixture.runtime} />);
  await screen.findByRole("heading", { name: "Agent de projet · Silo" });
  return fixture;
}

const conversation = () => screen.getByRole("main");

test("AgentScreen renders the conversation from the agent blob (view + logs) full screen", async () => {
  await openAgent();
  const main = conversation();
  expect(await within(main).findByText("Fais le point du jour")).toBeTruthy();
  expect(await within(main).findByText(/F3 est livrée : 3 fonctionnalités sur 9\./)).toBeTruthy();
  expect(within(main).getByRole("region", { name: "Lot n° 7" })).toBeTruthy();
  expect(screen.queryByRole("navigation", { name: "Écrans du projet" })).toBeNull();
  expect(screen.getByRole("button", { name: "Retour" })).toBeTruthy();
  expect(main.className).toContain("flex-1");
});

test("sending a message relays sendProjectAgentMessage and shows the outbox state", async () => {
  const { api } = await openAgent();
  let release: () => void = () => undefined;
  api.reply = () =>
    new Promise((resolve) => {
      release = () => resolve({ ok: true, result: null });
    });
  const box = await screen.findByRole("textbox", { name: "Message à l'agent de projet" });
  fireEvent.change(box, { target: { value: "Et F4 ?" } });
  fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
  expect(await screen.findByRole("listitem", { name: "Toi · envoi…" })).toBeTruthy();
  await waitFor(() =>
    expect(api.requests).toContainEqual({
      method: "sendProjectAgentMessage",
      projectId: "silo",
      text: "Et F4 ?",
    }),
  );
  await act(async () => release());
});

test("a failed send keeps the message with Réessayer", async () => {
  const { api } = await openAgent();
  api.reply = () => ({ ok: false, error: { code: "INTERNAL", message: "boom" } });
  const box = await screen.findByRole("textbox", { name: "Message à l'agent de projet" });
  fireEvent.change(box, { target: { value: "Et F4 ?" } });
  fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
  expect(await screen.findByRole("listitem", { name: "Toi · non envoyé" })).toBeTruthy();
});

test("a proposed batch can be validated with chosen actions through decideBatch", async () => {
  const { api } = await openAgent();
  const lot = await screen.findByRole("region", { name: "Lot n° 7" });
  expect(within(lot).getAllByRole("checkbox")).toHaveLength(3);
  const silo90 = within(lot)
    .getByText(/SILO-90/)
    .closest("li");
  const box = silo90 && within(silo90).getByRole("checkbox");
  if (!box) throw new Error("missing SILO-90 checkbox");
  fireEvent.click(box);
  fireEvent.click(within(lot).getByRole("button", { name: "Valider (2)" }));
  await waitFor(() => expect(api.requests).toHaveLength(1));
  expect(api.requests[0]).toMatchObject({
    method: "decideBatch",
    projectId: "silo",
    batchId: "b7",
    decision: "apply",
    actionIds: expect.arrayContaining([1, 3]),
  });
  expect(api.requests[0]).not.toMatchObject({ actionIds: expect.arrayContaining([2]) });
});

test("a proposed batch can be refused with a comment through decideBatch", async () => {
  const { api } = await openAgent();
  const lot = await screen.findByRole("region", { name: "Lot n° 7" });
  fireEvent.click(within(lot).getByRole("button", { name: "Refuser" }));
  fireEvent.change(within(lot).getByLabelText("Commentaire pour l'agent (facultatif)"), {
    target: { value: "Garde F5 en S42" },
  });
  fireEvent.click(within(lot).getByRole("button", { name: "Confirmer le refus" }));
  await waitFor(() =>
    expect(api.requests).toContainEqual({
      method: "decideBatch",
      projectId: "silo",
      batchId: "b7",
      decision: "reject",
      comment: "Garde F5 en S42",
    }),
  );
});

test('"Nouvel agent" is absent and memoryPath is not shown', async () => {
  const agent = siloAgentSnapshot();
  await openAgent({ ...agent, view: { ...agent.view, memoryPath: "notes/memoire-agent.md" } });
  await screen.findByText("Fais le point du jour");
  fireEvent.click(screen.getByRole("button", { name: "Liste des agents" }));
  await screen.findByRole("navigation", { name: "Agents" });
  expect(screen.queryByRole("button", { name: /Nouvel agent/ })).toBeNull();
  expect(document.body.textContent).not.toContain("memoire-agent");
});

test("past sessions are listed and openable (runId from the blob)", async () => {
  const { api } = await openAgent();
  fireEvent.click(await screen.findByRole("button", { name: "Liste des agents" }));
  const list = await screen.findByRole("navigation", { name: "Agents" });
  const rows = within(list).getAllByRole("button");
  expect(rows.map((r) => r.textContent)).toEqual([
    expect.stringContaining("Fais le point du jour"),
    expect.stringContaining("Point de sprint S41"),
    expect.stringContaining("Relances client"),
  ]);
  expect(rows[0]?.textContent).toContain("en cours");
  fireEvent.click(within(list).getByRole("button", { name: /Point de sprint S41/ }));
  expect(await screen.findByText(SPRINT_ANSWER)).toBeTruthy();
  expect(screen.queryByText(/F3 est livrée/)).toBeNull();
  expect(screen.getByText(/Ancien agent/)).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Message à l'agent de projet" })).toBeNull();
  expect(api.calls.filter((c) => c === "request")).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Retour à l'agent en cours" }));
  expect(await screen.findByText(/F3 est livrée/)).toBeTruthy();
});

test('while the mac is offline, the compose box is disabled with "Le Mac est éteint"', async () => {
  const { api } = await openAgent(siloAgentSnapshot(), { macOnline: false, phoneOnline: true });
  expect(await screen.findByText(/F3 est livrée/)).toBeTruthy();
  const box = screen.getByRole("textbox", { name: "Message à l'agent de projet" });
  expect(box.hasAttribute("disabled")).toBe(true);
  expect(box.getAttribute("placeholder")).toContain("Le Mac est éteint");
  expect(screen.getByRole("button", { name: "Envoyer" }).hasAttribute("disabled")).toBe(true);
  const lot = screen.getByRole("region", { name: "Lot n° 7" });
  expect(within(lot).queryByRole("button", { name: /Valider/ })).toBeNull();
  expect(api.calls.filter((c) => c === "request")).toEqual([]);
});
