import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SEED_TODAY, seedSprintGraph } from "./graph-sprints-seed";
import { Component, manifest } from "./index";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const setup = async () => {
  const m = createMockSdk(manifest, {
    seed: seedSprintGraph,
    surface: "view",
    viewer: "adam",
    today: SEED_TODAY,
    config: {},
    holds: [],
  });
  const view = render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByRole("region", { name: "Fonctionnalités par sprint" });
  return { m, view };
};

const frame = (key: string) => screen.getByRole("article", { name: new RegExp(`^${key} `) });
const folded = (key: string) => frame(key).getAttribute("data-folded") === "true";
const foldAll = () => userEvent.click(screen.getByRole("button", { name: "Tout voir" }));

test("Tout voir collapses every frame to 56 px and the button reads Déplier tout", async () => {
  await setup();
  await foldAll();
  for (const article of screen.getAllByRole("article")) {
    expect(article.style.height).toBe("56px");
    expect(within(article).queryAllByRole("listitem")).toHaveLength(0);
  }
  await userEvent.click(screen.getByRole("button", { name: "Déplier tout" }));
  expect(screen.getByRole("button", { name: "Tout voir" })).toBeTruthy();
  expect(folded("F5")).toBe(false);
  expect(within(frame("F5")).getAllByRole("listitem").length).toBeGreaterThan(0);
});

test("clicking a collapsed frame expands only that one ; clicking again collapses it", async () => {
  const { m } = await setup();
  await foldAll();
  await userEvent.click(within(frame("F5")).getByRole("button"));
  expect(folded("F5")).toBe(false);
  expect(folded("F4")).toBe(true);
  expect(within(frame("F5")).getAllByRole("listitem").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Déplier tout" })).toBeTruthy();
  const title = within(frame("F5")).getByRole("button", { expanded: true });
  await userEvent.click(title);
  expect(folded("F5")).toBe(true);
  expect(m.opened).toEqual([]);
});

test("a step of an unfolded frame still opens its ticket", async () => {
  const { m } = await setup();
  await foldAll();
  await userEvent.click(within(frame("F5")).getByRole("button"));
  const row = within(frame("F5")).getAllByRole("listitem")[0];
  if (row === undefined) throw new Error("missing step");
  await userEvent.click(within(row).getByRole("button"));
  expect(m.opened).toHaveLength(1);
});

test("the state resets when the component unmounts", async () => {
  const { view } = await setup();
  await foldAll();
  view.unmount();
  await setup();
  expect(screen.getByRole("button", { name: "Tout voir" })).toBeTruthy();
  expect(folded("F5")).toBe(false);
});

test("a truncated title keeps its full name for assistive technology and the pointer", async () => {
  await setup();
  await foldAll();
  const article = frame("F5");
  const name = article.getAttribute("aria-label")?.replace(/^F5 /, "") ?? "";
  expect(name.length).toBeGreaterThan(0);
  const button = within(article).getByRole("button", { name: new RegExp(name) });
  expect(button.getAttribute("title")).toBe(name);
});

test("the PRs view has no fold button", async () => {
  await setup();
  await userEvent.click(screen.getByRole("radio", { name: "PRs" }));
  await screen.findByRole("region", { name: "PR ouvertes" });
  expect(screen.queryByRole("button", { name: "Tout voir" })).toBeNull();
});

test("a late collapsed frame says so with an icon, not with its colour alone", async () => {
  await setup();
  await foldAll();
  for (const article of screen.getAllByRole("article"))
    if (article.getAttribute("data-late") === "true")
      expect(within(article).getByRole("img", { name: /^en retard/ })).toBeTruthy();
});
