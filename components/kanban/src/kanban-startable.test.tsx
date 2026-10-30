import { expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";
import { seed } from "./test-seed";

const setup = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const card = async (key: string) => {
  const found = (await screen.findByText(key)).closest("article");
  if (!(found instanceof HTMLElement)) throw new Error(`no card ${key}`);
  return found;
};

test("screen 188k: no card carries a 'Démarrable' badge, the filter keeps the startable ones", async () => {
  setup();
  await card("KIB-1");
  for (const article of screen.getAllByRole("article"))
    expect(within(article).queryByText("Démarrable")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Démarrable" }));
  expect(await card("KIB-1")).toBeTruthy();
  expect(screen.queryByText("KIB-2")).toBeNull();
  expect(screen.queryByText("KIB-4")).toBeNull();
});
