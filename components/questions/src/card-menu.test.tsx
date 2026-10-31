import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { openRow, Q14, Q16, seedSilo } from "./question-fixtures.test-helper";

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

const menuItems = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

test("« Actions de Q3 » opens « Modifier », « Archiver », « Exporter cette question » then « Supprimer »", async () => {
  mount();
  const user = userEvent.setup();
  const card = await openRow(Q14);
  await user.click(within(card).getByRole("button", { name: "Actions de Q3" }));
  expect(menuItems()).toEqual(["Modifier", "Archiver", "Exporter cette question", "Supprimer"]);
  expect(screen.getByRole("menuitem", { name: "Supprimer" }).getAttribute("data-variant")).toBe(
    "destructive",
  );
  expect(within(card).queryByRole("button", { name: "Archiver" })).toBeNull();
});

test("a question the viewer may not archive offers no « Archiver »", async () => {
  const m = mount();
  const ticketId = m.snapshot().tickets.find((t) => t.title === "Modèle du rapport")?.id ?? "";
  act(() => {
    m.run({
      method: "createQuestion",
      ticketId,
      title: "Signer le rapport ?",
      createdBy: { kind: "agent", ref: "kibo" },
    });
  });
  const user = userEvent.setup();
  const card = await openRow("Signer le rapport ?");
  await user.click(within(card).getByRole("button", { name: "Actions de Q4" }));
  expect(menuItems()).toEqual(["Modifier", "Exporter cette question", "Supprimer"]);
});

test("an archived card keeps « Restaurer » in line and its menu only offers « Supprimer »", async () => {
  const m = mount();
  const q16 = m.snapshot().questions.find((q) => q.title === Q16);
  act(() => {
    m.run({ method: "archiveQuestion", questionId: q16?.id ?? "", by: { kind: "human", ref: "adam" } });
  });
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Archivées" }));
  const card = await openRow(Q16);
  expect(within(card).getByRole("button", { name: "Restaurer" })).toBeTruthy();
  await user.click(within(card).getByRole("button", { name: "Actions de Q2" }));
  expect(menuItems()).toEqual(["Supprimer"]);
});
