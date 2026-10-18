import { afterEach, expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { seed, trackingSeed } from "./test-seed";

afterEach(cleanup);

const setup = (
  config: Record<string, unknown> = {},
  seeded: (run: (cmd: ProjectCommand) => unknown) => void = trackingSeed,
  today = "2026-10-17",
) => {
  const m = createMockSdk(manifest, { seed: seeded, viewer: "adam", config, today });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const toggle = (name: string) => screen.getByRole("button", { name });
const pressed = (name: string) => toggle(name).getAttribute("aria-pressed");

test("« Tous » by default: every card, other people's too, each filter with its count", async () => {
  setup();
  expect(await screen.findByText("8 tickets · Tous")).toBeTruthy();
  expect(screen.getByRole("group", { name: "Tickets affichés" })).toBeTruthy();
  expect(pressed("Tous")).toBe("true");
  expect(within(toggle("Tous")).getByText("8")).toBeTruthy();
  expect(within(toggle("Sprint courant · S42")).getByText("4")).toBeTruthy();
  expect(within(toggle("Démarrable")).getByText("1")).toBeTruthy();
  expect(within(toggle("À reprendre")).getByText("1")).toBeTruthy();
  expect(screen.getByText("Hors filtre")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Moi/ })).toBeNull();
});

test("« Sprint courant » keeps the steps of S42, still current the day after it ends", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Sprint courant · S42" }));
  expect(await screen.findByText("4 tickets · Sprint courant · S42")).toBeTruthy();
  expect(pressed("Tous")).toBe("false");
  expect(screen.getByText("Conflits de saisie")).toBeTruthy();
  expect(screen.getByText("Lecture du fichier Excel")).toBeTruthy();
  expect(screen.queryByText("Écran d'import")).toBeNull();
  expect(screen.queryByText("Hors filtre")).toBeNull();
  await user.click(screen.getByRole("button", { name: "4 masqués · Tout afficher" }));
  expect(await screen.findByText("8 tickets · Tous")).toBeTruthy();
  expect(pressed("Sprint courant · S42")).toBe("false");
});

test("the filters add up, « Tous » clears them", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Sprint courant · S42" }));
  await user.click(toggle("Démarrable"));
  expect(await screen.findByText("0 ticket · Sprint courant · S42 + Démarrable")).toBeTruthy();
  expect(pressed("Sprint courant · S42")).toBe("true");
  expect(pressed("Démarrable")).toBe("true");
  expect(screen.queryByText("Démo · F1")).toBeNull();
  expect(screen.queryByText("Hors filtre")).toBeNull();
  await user.click(toggle("Sprint courant · S42"));
  expect(await screen.findByText("1 ticket · Démarrable")).toBeTruthy();
  expect(screen.getByText("Hors filtre")).toBeTruthy();
  await user.click(toggle("Tous"));
  expect(await screen.findByText("8 tickets · Tous")).toBeTruthy();
  expect(pressed("Démarrable")).toBe("false");
});

test("« Sprint courant » follows the date: on Monday the 19th it is S43", async () => {
  setup({}, trackingSeed, "2026-10-19");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Sprint courant · S43" }));
  expect(await screen.findByText("2 tickets · Sprint courant · S43")).toBeTruthy();
  expect(screen.getByText("Écran d'import")).toBeTruthy();
});

test("when the current sprint goes away, « Sprint courant » falls back to « Tous »", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Sprint courant · S42" }));
  expect(await screen.findByText("4 tickets · Sprint courant · S42")).toBeTruthy();
  act(() => {
    for (const s of m.snapshot().sprints) m.run({ method: "deleteSprint", sprintId: s.id });
  });
  expect(await screen.findByText("8 tickets · Tous")).toBeTruthy();
  expect(pressed("Tous")).toBe("true");
  expect(toggle("Sprint courant").hasAttribute("disabled")).toBe(true);
});

test("« À reprendre » keeps the tickets whose PR has changes requested or a broken CI", async () => {
  setup();
  await userEvent.setup().click(await screen.findByRole("button", { name: "À reprendre" }));
  expect(await screen.findByText("1 ticket · À reprendre")).toBeTruthy();
  expect(screen.getByText("Conflits de saisie")).toBeTruthy();
  expect(screen.queryByText("Route d'envoi des photos")).toBeNull();
  expect(screen.queryByText("Passage à Expo SDK 54")).toBeNull();
});

test("without any sprint, « Sprint courant » is offered but disabled", async () => {
  setup({}, (run) => run({ method: "createTicket", title: "Seul" }));
  expect(await screen.findByText("1 ticket · Tous")).toBeTruthy();
  const sprint = toggle("Sprint courant");
  expect(sprint.hasAttribute("disabled")).toBe(true);
  expect(within(sprint).getByText("0")).toBeTruthy();
});

test("an instance set to « mine » keeps narrowing the board and says so", async () => {
  setup({ filter: "mine-and-agents" }, seed);
  expect(await screen.findByText("5 tickets · Tous · Moi")).toBeTruthy();
  expect(screen.queryByText("Hors filtre")).toBeNull();
});

test("the counter gives way in a narrow widget: it truncates and keeps its full text as a title", async () => {
  setup();
  const counter = await screen.findByText("8 tickets · Tous");
  expect(counter.getAttribute("title")).toBe("8 tickets · Tous");
  expect(counter.className).toContain("truncate");
  expect(counter.className).toContain("min-w-0");
  expect(counter.className).not.toContain("shrink-0");
});

test("in a narrow widget the toolbar drops the counts, then the label text, never the names", async () => {
  setup();
  const all = await screen.findByRole("button", { name: "Tous" });
  expect(all.closest("header")?.className).toContain("@container/toolbar");
  expect(within(all).getByText("8").className).toContain("@max-[36rem]/toolbar:hidden");
  const label = screen.getByRole("button", { name: "Étiquette : toutes" });
  expect(within(label).getByText("Étiquette : toutes").className).toContain("@max-[48rem]/toolbar:sr-only");
});
