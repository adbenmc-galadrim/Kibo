import { expect, test } from "bun:test";
import type { ProjectCommand, Spotlight } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

test("an intent for a new question opens the dialog on its ticket, once", async () => {
  let ids: Record<string, string> = {};
  const m = createMockSdk(manifest, {
    seed: (run: (cmd: ProjectCommand) => unknown) => {
      ids = seedDemo(run);
    },
    surface: "view",
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByRole("button", { name: /Nouvelle question/ });
  const intent: Spotlight = { kind: "newQuestion", ticketId: ids["KIB-12"] ?? "" };
  act(() => m.setSpotlight(intent));
  const dialog = await screen.findByRole("dialog", { name: "Nouvelle question" });
  expect(screen.getByRole("combobox", { name: "Ticket" }).textContent).toContain("KIB-12");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  act(() => m.setSpotlight(intent));
  expect(screen.queryByRole("dialog")).toBeNull();
});
