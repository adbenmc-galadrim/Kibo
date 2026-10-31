import { afterEach, expect, test } from "bun:test";
import { type ProjectCommand, Question } from "@kibo/schema";
import { type KiboSdk, SdkProvider } from "@kibo/sdk";
import { createMockSdk, type MockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { ADAM, openRow, Q14, Q16, seedSilo } from "./question-fixtures.test-helper";

afterEach(cleanup);

const HELP =
  "Suppression définitive, pour tous les membres du projet : la question, sa réponse et son historique. Pour la masquer sans la perdre, archive-la.";

const mount = (refused: ProjectCommand["method"] | null = null): MockSdk => {
  const m = createMockSdk(manifest, { seed: seedSilo, surface: "view", client: "Silo SA" });
  const sdk: KiboSdk = {
    ...m.sdk,
    run: (cmd) => (cmd.method === refused ? Promise.reject(new Error("refused")) : m.sdk.run(cmd)),
  };
  render(
    <SdkProvider sdk={sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const named = (m: MockSdk, title: string) => m.snapshot().questions.find((q) => q.title === title);

async function askRemoval(title: string, label: string) {
  const user = userEvent.setup();
  const card = await openRow(title);
  await user.click(within(card).getByRole("button", { name: `Actions de ${label}` }));
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
  return within(await screen.findByRole("alertdialog"));
}

test("« Supprimer » asks first and « Annuler » keeps the question", async () => {
  const m = mount();
  const dialog = await askRemoval(Q16, "Q2");
  expect(dialog.getByText(`Supprimer « ${Q16} » ?`)).toBeTruthy();
  expect(dialog.getByText(HELP)).toBeTruthy();
  await userEvent.setup().click(dialog.getByRole("button", { name: "Annuler" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(named(m, Q16)).toBeTruthy();
  expect(screen.getByRole("article", { name: Q16 })).toBeTruthy();
});

test("a removed question leaves the doc and the screen, its number is never given again", async () => {
  const m = mount();
  const dialog = await askRemoval(Q16, "Q2");
  await userEvent.setup().click(dialog.getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(named(m, Q16)).toBeUndefined());
  await waitFor(() => expect(screen.queryByRole("article", { name: Q16 })).toBeNull());
  expect(screen.queryByRole("alertdialog")).toBeNull();
  const ticketId = m.snapshot().tickets.find((t) => t.title === "Modèle du rapport")?.id ?? "";
  const next = Question.parse(
    m.run({ method: "createQuestion", ticketId, title: "Archiver les constats ?", createdBy: ADAM }),
  );
  expect(next.number).toBe(4);
});

test("removing the open blocking question unblocks its feature", async () => {
  const m = mount();
  const dialog = await askRemoval(Q14, "Q3");
  await userEvent.setup().click(dialog.getByRole("button", { name: "Supprimer" }));
  expect(await screen.findByRole("status", { name: "F1 débloquée" })).toBeTruthy();
  expect(named(m, Q14)).toBeUndefined();
});

test("an archived question is removed from « Archivées »", async () => {
  const m = mount();
  act(() => {
    m.run({ method: "archiveQuestion", questionId: named(m, Q16)?.id ?? "", by: ADAM });
  });
  await userEvent.setup().click(await screen.findByRole("radio", { name: "Archivées" }));
  const dialog = await askRemoval(Q16, "Q2");
  await userEvent.setup().click(dialog.getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(named(m, Q16)).toBeUndefined());
});

test("a refused removal says so in the dialog", async () => {
  const m = mount("removeQuestion");
  const dialog = await askRemoval(Q16, "Q2");
  await userEvent.setup().click(dialog.getByRole("button", { name: "Supprimer" }));
  expect(await dialog.findByText("Impossible de supprimer la question.")).toBeTruthy();
  expect(named(m, Q16)).toBeTruthy();
});
