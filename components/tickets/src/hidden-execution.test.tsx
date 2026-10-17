import { afterEach, expect, test } from "bun:test";
import type { AgentExecution, ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

afterEach(cleanup);

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const root = run({ method: "createTicket", title: "Arbre des pages" }) as Ticket;
  run({
    method: "createTicket",
    title: "Récepteur",
    parentId: root.id,
    statusId: "in_progress",
    assignee: { kind: "agent", ref: "full-delivery" },
    labels: ["urgent"],
  });
};

async function list(agentExecution: AgentExecution) {
  const m = createMockSdk(manifest, { seed, viewer: "adam", agentExecution });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText("Récepteur");
  const id = m.snapshot().tickets.find((t) => t.title === "Récepteur")?.id ?? "";
  act(() =>
    m.setRuns([{ ticketId: id, runId: "r1", label: "opus-dev-2", state: "running", position: null }]),
  );
  fireEvent.focus(screen.getByRole("button", { name: "Récepteur" }));
  const card = await waitFor(() => {
    const found = document.querySelector("[data-slot=hover-card-content]");
    if (!(found instanceof HTMLElement)) throw new Error("no hover card");
    return found;
  });
  return within(card);
}

test("hidden execution: the hover card of a row shows no agent profile nor run", async () => {
  const card = await list("hidden");
  expect(card.getByText("urgent")).toBeTruthy();
  expect(card.queryByText("full-delivery")).toBeNull();
  expect(card.queryByText("opus-dev-2")).toBeNull();
});

test("shown execution: the hover card of a row shows the agent run again", async () => {
  const card = await list("shown");
  expect(await card.findByRole("button", { name: "opus-dev-2" })).toBeTruthy();
});

async function assignees(agentExecution: AgentExecution): Promise<string[]> {
  const m = createMockSdk(manifest, { seed, viewer: "adam", agentExecution });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText("Récepteur");
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouverts" }));
  const items = await screen.findAllByRole("menuitemradio");
  return items.map((i) => i.textContent ?? "");
}

test("hidden execution: the assignee filter has no Agents choice", async () => {
  expect(await assignees("hidden")).toEqual(["Tous", "Moi", "Personne"]);
});

test("shown execution: the assignee filter offers Agents again", async () => {
  expect(await assignees("shown")).toEqual(["Tous", "Moi", "Agents", "Personne"]);
});

const seedWithLoose = (run: (cmd: ProjectCommand) => unknown) => {
  const root = run({ method: "createTicket", title: "Arbre des pages" }) as Ticket;
  run({
    method: "createTicket",
    title: "Récepteur",
    parentId: root.id,
    statusId: "in_progress",
    assignee: { kind: "agent", ref: "full-delivery" },
  });
  run({ method: "createTicket", title: "Ticket libre", parentId: root.id, statusId: "in_progress" });
};

async function agentsFilterThen(agentExecution: AgentExecution) {
  const m = createMockSdk(manifest, { seed: seedWithLoose, viewer: "adam", agentExecution: "shown" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText("Ticket libre");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ouverts" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Agents" }));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByText("Ticket libre")).toBeNull());
  act(() => m.setAgentExecution(agentExecution));
  return user;
}

test("hidden execution: an active Agents filter falls back to Tous", async () => {
  const user = await agentsFilterThen("hidden");
  expect(await screen.findByText("Ticket libre")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Ouverts" }));
  const checked = await screen.findByRole("menuitemradio", { checked: true });
  expect(checked.textContent).toBe("Tous");
});

test("shown execution: the Agents filter stays active", async () => {
  await agentsFilterThen("shown");
  expect(screen.queryByText("Ticket libre")).toBeNull();
});
