import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { seed, trackingSeed } from "./test-seed";

beforeEach(() => setSystemTime(new Date(2026, 9, 17, 10, 0)));
afterEach(() => {
  cleanup();
  setSystemTime();
});

const setup = (
  config: Record<string, unknown> = {},
  seeded: (run: (cmd: ProjectCommand) => unknown) => void = trackingSeed,
) => {
  const m = createMockSdk(manifest, { seed: seeded, viewer: "adam", config });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const mode = (name: string) => screen.getByRole("radio", { name });

test("« Tous » by default: every card, other people's too, each mode with its count", async () => {
  setup();
  expect(await screen.findByText("8 tickets · Tous")).toBeTruthy();
  expect(mode("Tous").getAttribute("aria-checked")).toBe("true");
  expect(within(mode("Tous")).getByText("8")).toBeTruthy();
  expect(within(mode("Sprint courant · S42")).getByText("4")).toBeTruthy();
  expect(within(mode("À reprendre")).getByText("1")).toBeTruthy();
  expect(screen.getByText("Hors filtre")).toBeTruthy();
  expect(screen.queryByRole("radio", { name: /^Moi/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Démarrables" })).toBeNull();
});

test("« Sprint courant » keeps the steps of S42, still current the day after it ends", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Sprint courant · S42" }));
  expect(await screen.findByText("4 tickets · Sprint courant · S42")).toBeTruthy();
  expect(screen.getByText("Conflits de saisie")).toBeTruthy();
  expect(screen.getByText("Lecture du fichier Excel")).toBeTruthy();
  expect(screen.queryByText("Écran d'import")).toBeNull();
  expect(screen.queryByText("Hors filtre")).toBeNull();
  await user.click(screen.getByRole("button", { name: "4 masqués · Tout afficher" }));
  expect(await screen.findByText("8 tickets · Tous")).toBeTruthy();
});

test("« Sprint courant » follows the date: on Monday the 19th it is S43", async () => {
  setSystemTime(new Date(2026, 9, 19, 9, 0));
  setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Sprint courant · S43" }));
  expect(await screen.findByText("2 tickets · Sprint courant · S43")).toBeTruthy();
  expect(screen.getByText("Écran d'import")).toBeTruthy();
});

test("« À reprendre » keeps the tickets whose PR has changes requested or a broken CI", async () => {
  setup();
  await userEvent.setup().click(await screen.findByRole("radio", { name: "À reprendre" }));
  expect(await screen.findByText("1 ticket · À reprendre")).toBeTruthy();
  expect(screen.getByText("Conflits de saisie")).toBeTruthy();
  expect(screen.queryByText("Route d'envoi des photos")).toBeNull();
  expect(screen.queryByText("Passage à Expo SDK 54")).toBeNull();
});

test("without any sprint, « Sprint courant » is offered but disabled", async () => {
  setup({}, (run) => run({ method: "createTicket", title: "Seul" }));
  expect(await screen.findByText("1 ticket · Tous")).toBeTruthy();
  const sprint = mode("Sprint courant");
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
