import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

test("an empty Planning says what it is for and offers a first feature", async () => {
  const m = createMockSdk(manifest, {
    today: TODAY,
    seed: (run) => {
      run({ method: "createSprint", code: "S1", name: "Sprint 1", start: "2026-10-19", end: "2026-10-23" });
    },
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const empty = await screen.findByRole("status", { name: "Planning vide" });
  expect(empty.textContent).toContain(
    "Le Planning range les fonctionnalités dans les sprints : crée la première, puis glisse-la vers un sprint.",
  );
  await userEvent.setup().click(within(empty).getByRole("button", { name: "Fonctionnalité" }));
  const dialog = await screen.findByRole("dialog", { name: "Nouvelle fonctionnalité" });
  expect(within(dialog).getByLabelText<HTMLSelectElement>("Sprint").value).not.toBe("");
});
