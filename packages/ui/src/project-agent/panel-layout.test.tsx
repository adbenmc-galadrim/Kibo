import { afterEach, beforeEach, expect, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockPanelApi, panel, resetHarness, rpcs, showPanel } from "./panel-harness";

mockPanelApi();
const { ProjectAgentPanel } = await import("./ProjectAgentPanel");

const root = document.documentElement.style;
const original = window.matchMedia;
const show = () => showPanel(ProjectAgentPanel);

const wideScreen = () => {
  window.matchMedia = (media: string): MediaQueryList =>
    Object.assign(new EventTarget(), {
      matches: false,
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    });
};

beforeEach(resetHarness);
afterEach(() => {
  window.matchMedia = original;
  root.removeProperty("--project-agent-w");
  root.removeProperty("--project-agent-edge");
});

test("Agrandir widens the panel to 720 px with the agent list on the left, Réduire comes back to the remembered width", async () => {
  localStorage.setItem("kibo.projectAgent.width", "400");
  show();
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Agrandir" }));
  expect(screen.getByRole("dialog").style.width).toBe("720px");
  expect(panel().getByRole("navigation", { name: "Agents" })).toBeTruthy();
  expect(panel().getByText("Fais le point du jour")).toBeTruthy();
  expect(panel().queryByRole("button", { name: "Redimensionner le panneau" })).toBeNull();
  expect(localStorage.getItem("kibo.projectAgent.wide")).toBe("1");
  await user.click(panel().getByRole("button", { name: "Masquer la liste" }));
  expect(panel().queryByRole("navigation", { name: "Agents" })).toBeNull();
  expect(localStorage.getItem("kibo.projectAgent.list")).toBe("0");
  await user.click(panel().getByRole("button", { name: "Afficher la liste" }));
  expect(panel().getByRole("navigation", { name: "Agents" })).toBeTruthy();
  await user.click(panel().getByRole("button", { name: "Réduire" }));
  expect(screen.getByRole("dialog").style.width).toBe("400px");
  expect(panel().queryByRole("navigation", { name: "Agents" })).toBeNull();
});

test("agrandi, the panel covers the page with a shadow and never squeezes it", async () => {
  wideScreen();
  show();
  await waitFor(() => expect(root.getPropertyValue("--project-agent-w")).toBe("341px"));
  await userEvent.setup().click(await panel().findByRole("button", { name: "Agrandir" }));
  expect(root.getPropertyValue("--project-agent-w")).toBe("");
  expect(root.getPropertyValue("--project-agent-edge")).toBe("721px");
  expect(screen.getByRole("dialog").dataset.overlay).toBe("true");
});

test("in the narrow panel the list opens over the conversation, a past agent is read-only with its date, Nouvel agent comes back", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Liste des agents" }));
  const list = within(panel().getByRole("navigation", { name: "Agents" }));
  expect(list.getByRole("button", { name: /^Fais le point du jour/ })).toBeTruthy();
  await user.click(list.getByRole("button", { name: /^Relances client/ }));
  expect(await panel().findByText("Ancien agent · 2 oct. 10:05")).toBeTruthy();
  expect(panel().queryByRole("navigation", { name: "Agents" })).toBeNull();
  expect(panel().queryByRole("textbox", { name: "Message à l'agent de projet" })).toBeNull();
  expect(rpcs("getProjectAgent").at(-1)).toMatchObject({ runId: "r1" });
  expect(await panel().findByText("Abandonné")).toBeTruthy();
  const [, renew] = panel().getAllByRole("button", { name: "Nouvel agent" });
  if (!renew) throw new Error("the past agent offers no Nouvel agent in place of the box");
  await user.click(renew);
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Nouvel agent" }));
  await waitFor(() => expect(rpcs("resetProjectAgent")).toHaveLength(1));
  expect(await panel().findByRole("textbox", { name: "Message à l'agent de projet" })).toBeTruthy();
});

test("Retour leaves a past agent for the current conversation; Fermer la liste closes the list", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Liste des agents" }));
  await user.click(panel().getByRole("button", { name: "Fermer la liste" }));
  expect(panel().queryByRole("navigation", { name: "Agents" })).toBeNull();
  await user.click(panel().getByRole("button", { name: "Liste des agents" }));
  await user.click(panel().getByRole("button", { name: /^Relances client/ }));
  await user.click(await panel().findByRole("button", { name: "Retour" }));
  expect(await panel().findByRole("textbox", { name: "Message à l'agent de projet" })).toBeTruthy();
  expect(panel().queryByText(/^Ancien agent/)).toBeNull();
});

test("in the narrow panel the open list makes the conversation inert, and closing it gives focus back to its button", async () => {
  show();
  const user = userEvent.setup();
  const toggle = await panel().findByRole("button", { name: "Liste des agents" });
  const box = await panel().findByRole("textbox", { name: "Message à l'agent de projet" });
  expect(box.closest("[inert]")).toBeNull();
  await user.click(toggle);
  expect(box.closest("[inert]")).not.toBeNull();
  expect(panel().getByRole("navigation", { name: "Agents" }).closest("[inert]")).toBeNull();
  await user.click(panel().getByRole("button", { name: "Fermer la liste" }));
  expect(document.activeElement).toBe(toggle);
  expect(box.closest("[inert]")).toBeNull();
  await user.click(toggle);
  await user.click(panel().getByRole("button", { name: /^Relances client/ }));
  expect(await panel().findByText("Ancien agent · 2 oct. 10:05")).toBeTruthy();
  expect(document.activeElement).toBe(panel().getByRole("button", { name: "Liste des agents" }));
});
