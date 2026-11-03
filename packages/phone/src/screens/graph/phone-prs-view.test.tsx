import { afterEach, expect, test } from "bun:test";
import { manifest } from "@kibo/component-graph";
import { PRS_SEED_COUNTER, seedPrGraph } from "@kibo/component-graph/seeds";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhonePrsView } from "./PhonePrsView";

afterEach(cleanup);

const setup = (seed = seedPrGraph) => {
  const m = createMockSdk(manifest, { seed, surface: "view", viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <PhonePrsView />
    </SdkProvider>,
  );
  return m;
};

test("the PR view lists the stacks of pr-stacks.ts, biggest first, top of the stack first", async () => {
  setup();
  const region = await screen.findByRole("region", { name: "PR ouvertes" });
  expect(within(region).getByText(PRS_SEED_COUNTER)).toBeTruthy();
  const stacks = within(region).getAllByRole("article");
  expect(stacks.map((s) => s.getAttribute("aria-label"))).toEqual([
    "3 PR empilées · F5 · Envoyer les photos d'un constat · #22 à #25",
    "1 PR · F4 · Saisir un constat hors ligne · #20",
    "1 PR · Hors fonctionnalité · #23",
  ]);
  const [first] = stacks;
  if (!first) throw new Error("no stack");
  const prs = within(first)
    .getAllByRole("button")
    .map((b) => b.getAttribute("data-pr"));
  expect(prs).toEqual(["25", "24", "22"]);
  expect(first.textContent).toContain("sur feat/envoi-hors-ligne");
  expect(first.textContent).toContain("sur feat/silo-32");
  expect(first.textContent).toContain("dev · branche de base");
  expect(first.textContent).toContain("CI en cours");
});

test("a PR with requested changes is outlined in red and says so", async () => {
  setup();
  const pr = await screen.findByRole("button", { name: /^PR #20 · Conflits de saisie/ });
  expect(pr.className).toContain("border-(--tracking-red)");
  expect(pr.textContent).toContain("changements demandés");
  expect(pr.textContent).toContain("CI rouge");
});

test("tapping a PR opens the ticket of its step", async () => {
  const m = setup();
  await userEvent.click(await screen.findByRole("button", { name: /^PR #22 · Route d'envoi des photos/ }));
  expect(m.opened).toHaveLength(1);
  const opened = m.snapshot().tickets.find((t) => t.id === m.opened[0]);
  expect(opened?.title).toBe("Route d'envoi des photos");
});

test("without an open PR the view says so", async () => {
  setup(() => undefined);
  expect(await screen.findByText("Aucune PR ouverte")).toBeTruthy();
});
