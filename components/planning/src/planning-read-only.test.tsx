import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cardIn, column, setupPlanning } from "./planning-kit";
import { seedPlanningHeld, TODAY } from "./test-seed";

beforeEach(() => {
  setSystemTime(new Date(`${TODAY}T14:52:00`));
  localStorage.clear();
});
afterEach(() => setSystemTime());

const MAC_OFF = "Mac éteint";
const disabled = (el: HTMLElement) =>
  el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";

test("read-only, the add and edit buttons are greyed with the reason", async () => {
  setupPlanning(TODAY, { writeBlock: MAC_OFF });
  await column("À planifier");
  for (const name of ["Fonctionnalité", "Sprint"]) {
    const button = screen.getByRole("button", { name });
    expect(disabled(button)).toBe(true);
    expect(button.title).toBe(MAC_OFF);
  }
  for (const edit of screen.getAllByRole("button", { name: "Modifier le sprint" })) {
    expect(disabled(edit)).toBe(true);
    expect(edit.title).toBe(MAC_OFF);
  }
});

test("read-only, a card cannot be dragged nor planned, but still opens and the layout still switches", async () => {
  const { m } = setupPlanning(TODAY, { writeBlock: MAC_OFF });
  const user = userEvent.setup();
  const f9 = await cardIn("À planifier", "F9");
  expect(f9.closest("article")?.getAttribute("aria-disabled")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Actions de F9" }));
  await user.click(await screen.findByRole("menuitem", { name: "Planifier dans" }));
  for (const item of await screen.findAllByRole("menuitem", { name: new RegExp(MAC_OFF) }))
    expect(item.getAttribute("aria-disabled")).toBe("true");
  await user.keyboard("{Escape}{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await user.click(screen.getByRole("button", { name: "Exporter le dossier client" }));
  expect(m.opened.length).toBe(1);
  const bands = screen.getByRole("button", { name: "Bandes" });
  await user.click(bands);
  expect(bands.getAttribute("aria-pressed")).toBe("true");
  expect(m.configPatches).toEqual([]);
});

test("read-only, Reprendre is greyed in the held band", async () => {
  setupPlanning(TODAY, { seedWith: seedPlanningHeld, writeBlock: MAC_OFF });
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions de KIB-21" }));
  const resume = await screen.findByRole("menuitem", { name: new RegExp(`Reprendre.*${MAC_OFF}`) });
  expect(resume.getAttribute("aria-disabled")).toBe("true");
});

test("writable, the header buttons carry no reason", async () => {
  setupPlanning();
  await column("À planifier");
  const feature = screen.getByRole("button", { name: "Fonctionnalité" });
  expect(disabled(feature)).toBe(false);
  expect(within(feature.parentElement ?? feature).queryByText(MAC_OFF)).toBeNull();
});
