import { expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { SprintTabs } from "./SprintTabs";
import { TODAY, trackingSeed } from "./test-seed";

const setup = (config: Record<string, unknown> = {}) => {
  const m = createMockSdk(manifest, { seed: trackingSeed(Date.now()), today: TODAY, config });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const tabs = async () => within(await screen.findByRole("tablist", { name: "Sprint affiché" }));

test("one tab per sprint between Tous les sprints and À planifier; the current one is chosen and marked", async () => {
  setup();
  const list = await tabs();
  expect(list.getAllByRole("tab").map((t) => t.textContent)).toEqual([
    "Tous les sprints",
    "S41",
    "S42",
    "S43",
    "À planifier",
  ]);
  const current = list.getByRole("tab", { name: "sprint en cours S42" });
  expect(current.getAttribute("aria-selected")).toBe("true");
  expect(list.getByRole("tab", { name: "S41" }).getAttribute("aria-selected")).toBe("false");
  expect(await screen.findByText("Écran d'envoi hors ligne")).toBeTruthy();
  expect(screen.queryByText("Lecture du fichier")).toBeNull();
});

test("choosing a tab narrows the rows and is remembered by the instance", async () => {
  const m = setup();
  await screen.findByText("Écran d'envoi hors ligne");
  await userEvent.setup().click((await tabs()).getByRole("tab", { name: "S43" }));
  expect(await screen.findByText("Lecture du fichier")).toBeTruthy();
  expect(screen.queryByText("Écran d'envoi hors ligne")).toBeNull();
  const s43 = m.snapshot().sprints.find((s) => s.code === "S43")?.id;
  expect(m.configPatches).toEqual([{ sprint: s43 }]);
});

test("a remembered choice wins over the current sprint", async () => {
  setup({ sprint: "none" });
  const list = await tabs();
  expect(list.getByRole("tab", { name: "À planifier" }).getAttribute("aria-selected")).toBe("true");
  expect(await screen.findByText("Gabarit PDF")).toBeTruthy();
});

test("a tab shows the sprint code, never its name", async () => {
  const sprint = (id: string, code: string, name: string, state: "done" | "current" | "planned") => ({
    id,
    code,
    name,
    start: "2026-10-12",
    end: "2026-10-16",
    state,
    features: [],
    delivered: 0,
    total: 0,
  });
  render(
    <SprintTabs
      sprints={[sprint("s41", "S41", "Accès", "done"), sprint("s42", "S42", "Terrain hors ligne", "current")]}
      value="s42"
      onChange={() => undefined}
    />,
  );
  const list = await tabs();
  expect(list.getAllByRole("tab").map((t) => t.textContent)).toEqual([
    "Tous les sprints",
    "S41",
    "S42",
    "À planifier",
  ]);
  expect(screen.queryByText("Terrain hors ligne")).toBeNull();
});

test("the menu of a sprint tab opens the sprint sheet", async () => {
  const m = setup();
  const tab = (await tabs()).getByRole("tab", { name: "S43" });
  fireEvent.contextMenu(tab);
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: "Fiche du sprint" }));
  const s43 = m.snapshot().sprints.find((s) => s.code === "S43")?.id;
  expect(m.openedSprints).toEqual([s43 ?? ""]);
});
