import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { seed } from "./test-seed";

const setup = (config: Record<string, unknown> = {}, seeded = seed) => {
  const m = createMockSdk(manifest, { seed: seeded, viewer: "adam", config });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("screen 126: the default filter is named next to the counter, and hidden cards can be shown", async () => {
  setup();
  expect(await screen.findByText("5 / 6 · Moi + agents")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Moi + agents" }).getAttribute("aria-checked")).toBe("true");
  await userEvent.setup().click(screen.getByRole("button", { name: "1 masqué · Tout afficher" }));
  expect(await screen.findByText("6 / 6 · Tous")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Tous" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("button", { name: /Tout afficher/ })).toBeNull();
  expect(screen.getByText("Hors filtre")).toBeTruthy();
});

test("the hidden count is plural, and nothing hidden means no link", async () => {
  const lea = { kind: "human", ref: "lea" } as const;
  const others = (run: (cmd: ProjectCommand) => unknown) => {
    run({ method: "createTicket", title: "Un", assignee: lea });
    run({ method: "createTicket", title: "Deux", assignee: lea });
  };
  setup({}, others);
  expect(await screen.findByRole("button", { name: "2 masqués · Tout afficher" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("radio", { name: "Tous" }));
  expect(await screen.findByText("2 / 2 · Tous")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("radio", { name: "Moi + agents" }));
  expect(await screen.findByText("0 / 2 · Moi + agents")).toBeTruthy();
  cleanup();
  setup({}, (run) =>
    run({ method: "createTicket", title: "À moi", assignee: { kind: "human", ref: "adam" } }),
  );
  expect(await screen.findByText("1 / 1 · Moi + agents")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /masqué/ })).toBeNull();
});
