import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  seedDemo(run);
};

runConformance({ manifest, Component }, seed);

const setup = (surface: "view" | "widget", seedFn: typeof seed | null = seed) => {
  const m = createMockSdk(manifest, { ...(seedFn && { seed: seedFn }), surface, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("screen 10: nodes, critical path summary, legend and zoom", async () => {
  const m = setup("view");
  expect(await screen.findByText("Chemin critique : 3 tickets · 1 bloqué")).toBeTruthy();
  const canvas = screen.getByRole("region", { name: "Graphe des dépendances" });
  const node = within(canvas).getByRole("button", { name: /KIB-21 Sandbox iframe des composants/ });
  expect(node.getAttribute("data-critical")).toBe("true");
  expect(
    within(canvas)
      .getByRole("button", { name: /KIB-12/ })
      .getAttribute("data-critical"),
  ).toBe("false");
  expect(within(canvas).getByRole("button", { name: /KIB-5 / }).className).toContain("opacity-45");
  expect(screen.getByText("Lié à")).toBeTruthy();
  await userEvent.setup().click(node);
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-21")?.id ?? ""]);
});

test("toolbar: hide done, critical path toggle, zoom", async () => {
  setup("view");
  const user = userEvent.setup();
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  expect(screen.getByRole("button", { name: "Hiérarchique" }).hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Masquer terminés" }));
  expect(screen.queryByRole("button", { name: /KIB-5 / })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Chemin critique" }));
  expect(screen.getByRole("button", { name: /KIB-21/ }).getAttribute("data-critical")).toBe("false");
  await user.click(screen.getByRole("button", { name: "Zoom avant" }));
  expect(screen.getByRole("button", { name: "Taille réelle" }).textContent).toBe("110 %");
  await user.click(screen.getByRole("button", { name: "Taille réelle" }));
  expect(screen.getByRole("button", { name: "Taille réelle" }).textContent).toBe("100 %");
});

test("screen 7 widget: chain, blocked reason and a link to the view", async () => {
  const m = setup("widget");
  expect(await screen.findByText("Chemin critique · 3 tickets")).toBeTruthy();
  const chain = screen.getByRole("list", { name: "Chemin critique" });
  expect(
    within(chain)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["KIB-11", "KIB-21", "KIB-22"]);
  expect(screen.getByText("KIB-21 bloqué : audit sécurité externe en attente")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir le graphe →" }));
  expect(m.openedViews).toEqual(["graph"]);
});

test("D9: empty states", async () => {
  setup("view", null);
  expect(await screen.findByText("Aucune dépendance entre les tickets affichés.")).toBeTruthy();
});

test("D9: empty widget", async () => {
  setup("widget", null);
  expect(await screen.findByText("Aucun chemin critique : aucun ticket bloquant.")).toBeTruthy();
});
