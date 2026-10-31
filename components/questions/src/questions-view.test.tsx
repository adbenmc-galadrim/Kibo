import { afterEach, expect, test } from "bun:test";
import { PageActionsProvider, PageActionsSlot, SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "./fr";
import { Component, manifest } from "./index";
import { Q14, seedSilo } from "./question-fixtures.test-helper";

afterEach(cleanup);

const mount = () => {
  const m = createMockSdk(manifest, { seed: seedSilo, surface: "view", client: "Silo SA" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const exportButtons = () => screen.getAllByRole("button", { name: /^Exporter/ });

test("a single Exporter button in the header ; the row menu has Exporter cette question", async () => {
  mount();
  const user = userEvent.setup();
  const row = await screen.findByRole("article", { name: Q14 });
  await user.click(within(row).getByRole("button", { name: Q14 }));
  expect(exportButtons().map((b) => b.textContent)).toEqual([fr.exporting.forClient(2)]);
  await user.click(within(row).getByRole("button", { name: "Actions de Q3" }));
  expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
    fr.edit.open,
    fr.archive,
    fr.exporting.single,
    fr.remove,
  ]);
  await user.click(screen.getByRole("menuitem", { name: fr.exporting.single }));
  expect((await screen.findByText(/^Questions pour Silo SA/)).textContent).toContain(Q14);
  await screen.findByRole("status", { name: fr.exporting.marked(1) });
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.getByText(fr.exporting.preview)).toBeTruthy();
});

test("the export and the new question live in the page header of the shell", async () => {
  const m = createMockSdk(manifest, { seed: seedSilo, surface: "view", client: "Silo SA" });
  render(
    <PageActionsProvider>
      <header data-testid="header">
        <PageActionsSlot />
      </header>
      <SdkProvider sdk={m.sdk}>
        <Component />
      </SdkProvider>
    </PageActionsProvider>,
  );
  await screen.findByRole("article", { name: Q14 });
  const header = within(screen.getByTestId("header"));
  await waitFor(() => expect(header.getByRole("button", { name: fr.newQuestion })).toBeTruthy());
  expect(header.getByRole("button", { name: fr.exporting.forClient(2) })).toBeTruthy();
});

test("no internal id is rendered", async () => {
  const m = mount();
  const user = userEvent.setup();
  const row = await screen.findByRole("article", { name: Q14 });
  await user.click(within(row).getByRole("button", { name: Q14 }));
  const q = m.snapshot().questions.find((x) => x.title === Q14);
  expect(document.body.textContent).not.toContain(q?.id ?? "?");
  expect(document.body.textContent).not.toContain(q?.ticketId ?? "?");
});
