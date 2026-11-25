import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";
import { NOW, TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(NOW)));
afterEach(() => {
  setSystemTime();
  cleanup();
});

const MAC_OFF = "Mac éteint";

const withFeature = (run: (cmd: ProjectCommand) => unknown) => {
  run({ method: "createSprint", code: "S1", name: "Sprint 1", start: "2026-10-19", end: "2026-10-23" });
  const root = run({ method: "createTicket", title: "Socle", parentId: null }) as Ticket;
  run({ method: "createTicket", title: "Connexion", parentId: root.id });
};

test("read-only, Pour commencer greys the folder and feature actions but keeps the copy", async () => {
  const m = createMockSdk(manifest, { today: TODAY, seed: withFeature, writeBlock: MAC_OFF });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const card = await screen.findByRole("region", { name: "Pour commencer" });
  for (const name of ["Choisir le dossier", "Nouvelle fonctionnalité"]) {
    const button = within(card).getByRole("button", { name });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.title).toBe(MAC_OFF);
  }
  const copy = within(card).getByRole("button", { name: /Copier/ });
  expect(copy.hasAttribute("disabled")).toBe(false);
});
