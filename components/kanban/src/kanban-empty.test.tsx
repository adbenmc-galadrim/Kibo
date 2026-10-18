import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { seed } from "./test-seed";

afterEach(cleanup);

test("an empty Kanban says what it is for and offers « Nouveau ticket »", async () => {
  const m = createMockSdk(manifest, { viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("Les étapes avancent seules avec git et les PR.")).toBeTruthy();
  expect(screen.getByRole("region", { name: "À faire" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Nouveau ticket" }));
  expect(m.newTicketRequests).toHaveLength(1);
});

test("a Kanban with tickets shows its columns, without the empty state", async () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByRole("region", { name: "À faire" })).toBeTruthy();
  expect(screen.queryByText("Les étapes avancent seules avec git et les PR.")).toBeNull();
});
