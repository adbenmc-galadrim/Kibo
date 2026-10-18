import { expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const feature = run({ method: "createTicket", title: "Arbre des pages" }) as Ticket;
  run({ method: "createTicket", title: "Déplacement", parentId: feature.id });
  run({ method: "createTicket", title: "Renommage", parentId: feature.id });
  run({ method: "createTicket", title: "Exports", feature: true });
  run({ method: "createTicket", title: "Sync" });
};

const setup = () => {
  const m = createMockSdk(manifest, { seed });
  const sent: ProjectCommand[] = [];
  const run = m.sdk.run.bind(m.sdk);
  m.sdk.run = (cmd) => {
    sent.push(cmd);
    return run(cmd);
  };
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return { m, sent };
};

const ticket = (m: ReturnType<typeof createMockSdk>, title: string) =>
  m.snapshot().tickets.find((t) => t.title === title);

test("Rattacher à une fonctionnalité moves a loose ticket to the end of the chosen feature", async () => {
  const { m, sent } = setup();
  const user = userEvent.setup();
  const sync = ticket(m, "Sync");
  await user.click(await screen.findByRole("button", { name: `Actions ${sync?.key}` }));
  await user.click(await screen.findByRole("menuitem", { name: "Rattacher à une fonctionnalité…" }));
  const dialog = await screen.findByRole("dialog", { name: `Rattacher ${sync?.key} à une fonctionnalité` });
  expect(
    within(dialog)
      .getAllByRole("button", { name: /^F\d+ · / })
      .map((b) => b.textContent),
  ).toEqual(["F1 · Arbre des pages", "F2 · Exports"]);
  await user.click(within(dialog).getByRole("button", { name: "F1 · Arbre des pages" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const feature = ticket(m, "Arbre des pages");
  expect(sent.at(-1)).toEqual({
    method: "moveTicket",
    ticketId: sync?.id ?? "",
    parentId: feature?.id ?? "",
    index: 2,
  });
  const children = m.snapshot().tickets.filter((t) => t.parentId === feature?.id);
  expect(children.map((t) => t.title)).toEqual(["Déplacement", "Renommage", "Sync"]);
});

test("a step or a feature cannot be attached", async () => {
  const { m } = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `Actions ${ticket(m, "Déplacement")?.key}` }));
  await screen.findByRole("menuitem", { name: "Ouvrir" });
  expect(screen.queryByRole("menuitem", { name: "Rattacher à une fonctionnalité…" })).toBeNull();
  await user.keyboard("{Escape}");
  await user.click(await screen.findByRole("button", { name: "Actions F2" }));
  await screen.findByRole("menuitem", { name: "Ouvrir" });
  expect(screen.queryByRole("menuitem", { name: "Rattacher à une fonctionnalité…" })).toBeNull();
});
