import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { manifest } from "@kibo/component-graph";
import { SEED_TODAY, seedPrGraph, seedSprintGraph } from "@kibo/component-graph/seeds";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk, type MockT3 } from "@kibo/sdk/mock";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneGraph } from "./GraphScreen";
import { COLUMN_WIDTH } from "./graph-columns";

const scrollIntoView = mock((_options?: ScrollIntoViewOptions) => undefined);
const original = Element.prototype.scrollIntoView;

beforeEach(() => {
  localStorage.clear();
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  Element.prototype.scrollIntoView = original;
});

const available = (): MockT3 => ({ status: { available: true, bin: "t3" }, launches: [] });

const setup = ({ seed = seedSprintGraph, writable = true, t3 = available() } = {}) => {
  const m = createMockSdk(manifest, {
    seed,
    surface: "view",
    viewer: "adam",
    today: SEED_TODAY,
    folder: "~/Documents/silo",
    t3,
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <PhoneGraph writable={writable} />
    </SdkProvider>,
  );
  return { m, t3 };
};

const columns = async () => {
  const region = await screen.findByRole("region", { name: "Fonctionnalités par sprint" });
  await within(region).findByRole("group", { name: "S42 Saisie hors ligne" });
  return within(region).getAllByRole("group");
};

const startableStep = async () => {
  await columns();
  const row = document.querySelector("li[data-startable=true]");
  const button = row?.querySelector("button");
  if (!(button instanceof HTMLElement)) throw new Error("no startable step");
  return button;
};

test('renders one column per sprint plus "À planifier", in sprint order, with the current sprint first in view', async () => {
  setup();
  const groups = await columns();
  expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual([
    "S41 Accès",
    "S42 Saisie hors ligne",
    "S43 Import et contrats",
    "S44 Rapports",
    "À planifier",
  ]);
  expect(groups[1]?.textContent).toContain("se termine aujourd'hui");
  expect(scrollIntoView.mock.contexts.at(-1)).toBe(groups[1]);
  expect(scrollIntoView.mock.calls.at(-1)).toEqual([{ inline: "start", block: "nearest" }]);
});

test("a column is 86 % wide and the next one peeks", async () => {
  setup();
  const groups = await columns();
  const scroller = screen.getByRole("region", { name: "Fonctionnalités par sprint" });
  for (const cls of [
    "snap-x",
    "snap-mandatory",
    "overflow-x-auto",
    "gap-4",
    "pl-[calc(16px+env(safe-area-inset-left))]",
    "pr-[calc(16px+env(safe-area-inset-right))]",
    "scroll-pl-[calc(16px+env(safe-area-inset-left))]",
  ])
    expect(scroller.className).toContain(cls);
  for (const g of groups) {
    expect(g.style.width).toBe(COLUMN_WIDTH);
    expect(g.className).toContain("snap-start");
    expect(g.className).not.toContain("overflow");
    expect(g.querySelector("[data-slot=column-scroll]")?.className).toContain("overflow-y-auto");
  }
});

test("a feature frame shows its segments and steps, startable steps in green", async () => {
  setup();
  await columns();
  const frame = screen.getByRole("article", { name: /Saisir un constat hors ligne/ });
  expect(frame.className).toContain("border-dashed");
  expect(frame.querySelectorAll("[data-slot=frame-segments] > span")).toHaveLength(5);
  const startable = frame.querySelector("li[data-startable=true]");
  expect(startable?.className).toContain("border-(--tracking-green)");
});

test("the Fonctionnalités / PRs switch shows PR stacks from pr-stacks.ts", async () => {
  const { m } = setup({ seed: seedPrGraph });
  await userEvent.click(await screen.findByRole("radio", { name: "PRs" }));
  const region = await screen.findByRole("region", { name: "PR ouvertes" });
  expect(within(region).getAllByRole("article")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Tout voir" })).toBeNull();
  expect(localStorage.getItem(`kibo.graph.view.${m.sdk.instanceId}`)).toBe("prs");
  await userEvent.click(screen.getByRole("radio", { name: "Fonctionnalités" }));
  expect(screen.getByRole("radio", { name: "Fonctionnalités" })).toHaveProperty("checked", true);
});

test("tapping a step opens the ticket route", async () => {
  const { m } = setup();
  const button = await startableStep();
  await userEvent.click(button);
  expect(m.opened).toHaveLength(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test('long-pressing a startable step shows "Lancer dans T3" and calls sdk.t3.launch after the confirmation', async () => {
  const { m, t3 } = setup();
  const button = await startableStep();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  const menu = await screen.findByRole("dialog", { name: /^KIB-\d+ / });
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(m.opened).toEqual([]);
  await userEvent.click(within(menu).getByRole("button", { name: "Lancer dans T3" }));
  const confirm = await screen.findByRole("dialog", { name: /^Lancer KIB-\d+ dans T3$/ });
  expect(await within(confirm).findByText(/t3 thread start/)).toBeTruthy();
  expect(t3.launches).toEqual([]);
  await userEvent.click(within(confirm).getByRole("button", { name: "Lancer" }));
  await waitFor(() => expect(t3.launches).toHaveLength(1));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(m.toasts.at(-1)).toMatch(/^KIB-\d+ lancé dans T3$/);
});

test("Mac off, the step menu keeps « Ouvrir la fiche » and greys « Lancer dans T3 »", async () => {
  const { m } = setup({ writable: false });
  fireEvent.contextMenu(await startableStep());
  const menu = await screen.findByRole("dialog", { name: /^KIB-\d+ / });
  const launch = within(menu).getByRole("button", { name: "Lancer dans T3 · indisponible, Mac éteint" });
  expect(launch.hasAttribute("disabled")).toBe(true);
  await userEvent.click(within(menu).getByRole("button", { name: "Ouvrir la fiche" }));
  expect(m.opened).toHaveLength(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("« Tout voir » folds every frame, a folded frame unfolds alone and its title folds it back", async () => {
  setup();
  await columns();
  expect(document.querySelectorAll("article[data-folded]")).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Tout voir" }));
  const all = document.querySelectorAll("article");
  expect(document.querySelectorAll("article[data-folded]")).toHaveLength(all.length);
  const frame = screen.getByRole("article", { name: /Saisir un constat hors ligne/ });
  await userEvent.click(within(frame).getByRole("button"));
  const open = screen.getByRole("article", { name: /Saisir un constat hors ligne/ });
  expect(open.hasAttribute("data-folded")).toBe(false);
  expect(document.querySelectorAll("article[data-folded]")).toHaveLength(all.length - 1);
  await userEvent.click(within(open).getByRole("button", { name: "Saisir un constat hors ligne" }));
  expect(document.querySelectorAll("article[data-folded]")).toHaveLength(all.length);
  await userEvent.click(screen.getByRole("button", { name: "Déplier tout" }));
  expect(document.querySelectorAll("article[data-folded]")).toHaveLength(0);
});

test("the legend opens as a bottom sheet and filters the columns by sprint", async () => {
  setup();
  await columns();
  await userEvent.click(screen.getByRole("button", { name: "Légende et sprints" }));
  const sheet = screen.getByRole("dialog", { name: "Légende et sprints" });
  expect(sheet.textContent).toContain("9 fonctionnalités");
  expect(sheet.textContent).toContain("Démarrable : appui long, Lancer dans T3");
  const chips = within(within(sheet).getByRole("region", { name: "Sprint affiché" })).getAllByRole("button");
  expect(chips.map((c) => c.textContent)).toEqual(["Tous", "S41", "S42", "S43", "S44", "À planifier"]);
  await userEvent.click(within(sheet).getByRole("button", { name: "S43" }));
  const region = screen.getByRole("region", { name: "Fonctionnalités par sprint" });
  expect(
    within(region)
      .getAllByRole("group")
      .map((g) => g.getAttribute("aria-label")),
  ).toEqual(["S43 Import et contrats"]);
  await userEvent.click(within(sheet).getByRole("button", { name: "OK" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the PR legend lists review and CI states", async () => {
  setup({ seed: seedPrGraph });
  await userEvent.click(await screen.findByRole("radio", { name: "PRs" }));
  await userEvent.click(screen.getByRole("button", { name: "Légende" }));
  const sheet = screen.getByRole("dialog", { name: "Légende" });
  for (const text of ["Brouillon", "Changements demandés", "CI rouge", "Toucher : fiche du ticket"])
    expect(sheet.textContent).toContain(text);
});

test("the release click of the long press does not close the sheet that opened under the finger", async () => {
  setup();
  const button = await startableStep();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  await screen.findByRole("dialog", { name: /^KIB-\d+ / });
  fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
  expect(screen.getByRole("dialog", { name: /^KIB-\d+ / })).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 350));
  fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("after a long press without a click, the next tap opens the ticket", async () => {
  const { m } = setup();
  const button = await startableStep();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  await screen.findByRole("dialog", { name: /^KIB-\d+ / });
  fireEvent.pointerUp(button);
  await new Promise((resolve) => setTimeout(resolve, 350));
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(button);
  expect(m.opened).toHaveLength(1);
});
