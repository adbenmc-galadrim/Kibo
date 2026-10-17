import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { column, setupPlanning } from "./planning-kit";
import { TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

const setDate = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });

test("a new sprint gets a unique code, a name and dates, reversed dates are refused", async () => {
  const { m } = setupPlanning();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ajouter" }));
  await user.click(await screen.findByRole("menuitem", { name: "Nouveau sprint" }));
  const dialog = await screen.findByRole("dialog", { name: "Nouveau sprint" });
  const create = within(dialog).getByRole("button", { name: "Créer le sprint" });
  await user.type(within(dialog).getByLabelText("Nom"), "Exports");
  setDate(dialog, "Début", "2026-11-02");
  setDate(dialog, "Fin", "2026-11-06");
  expect(create.hasAttribute("disabled")).toBe(true);
  await user.type(within(dialog).getByLabelText("Code"), "S42");
  await user.click(create);
  expect((await within(dialog).findByRole("alert")).textContent).toBe(
    "Ce code est déjà pris par un autre sprint.",
  );
  await user.clear(within(dialog).getByLabelText("Code"));
  await user.type(within(dialog).getByLabelText("Code"), "S45");
  setDate(dialog, "Début", "2026-11-06");
  setDate(dialog, "Fin", "2026-11-02");
  expect(create.hasAttribute("disabled")).toBe(true);
  expect(within(dialog).getByRole("alert").textContent).toBe("La fin doit suivre le début.");
  setDate(dialog, "Début", "2026-11-02");
  setDate(dialog, "Fin", "2026-11-06");
  await user.click(create);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(m.snapshot().sprints.map((s) => s.name)).toContain("Exports");
  expect(await column("S45 Exports")).toBeTruthy();
});

const pencil = async (name: string) =>
  within(await column(name)).getByRole("button", { name: "Modifier le sprint" });

test("the sprint name opens its sheet, the pencil next to it opens the dialog", async () => {
  const { m, seeded } = setupPlanning();
  const user = userEvent.setup();
  await user.click(
    within(await column("S44 Rapports")).getByRole("button", { name: "Fiche du sprint S44 Rapports" }),
  );
  expect(m.openedSprints).toEqual([seeded.sprints.s44.id]);
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(await pencil("S44 Rapports"));
  expect(await screen.findByRole("dialog", { name: "Modifier le sprint S44" })).toBeTruthy();
  expect(m.openedSprints).toHaveLength(1);
});

test("a reader opens the sheet from the name but has no pencil", async () => {
  const { m, seeded } = setupPlanning(TODAY, { shared: true });
  act(() => m.setAccess("read-only"));
  const s43 = within(await column("S43 Import et soudures"));
  await waitFor(() => expect(s43.queryByRole("button", { name: "Modifier le sprint" })).toBeNull());
  await userEvent.setup().click(s43.getByRole("button", { name: "Fiche du sprint S43 Import et soudures" }));
  expect(m.openedSprints).toEqual([seeded.sprints.s43.id]);
});

test("a sprint is edited from its column header", async () => {
  const { m, seeded } = setupPlanning();
  const user = userEvent.setup();
  await user.click(await pencil("S44 Rapports"));
  const dialog = await screen.findByRole("dialog", { name: "Modifier le sprint S44" });
  const name = within(dialog).getByLabelText("Nom");
  await user.clear(name);
  await user.type(name, "Rapports et exports");
  await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() =>
    expect(m.snapshot().sprints.find((s) => s.id === seeded.sprints.s44.id)?.name).toBe(
      "Rapports et exports",
    ),
  );
});

test("deleting a sprint asks first and sends its features back to the backlog", async () => {
  const { m, seeded } = setupPlanning();
  const user = userEvent.setup();
  await user.click(await pencil("S43 Import et soudures"));
  const dialog = await screen.findByRole("dialog", { name: "Modifier le sprint S43" });
  await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer le sprint S43 ?" });
  expect(within(confirm).getByText("2 fonctionnalités repassent À planifier.")).toBeTruthy();
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(m.snapshot().sprints.map((s) => s.id)).not.toContain(seeded.sprints.s43.id));
  const backlog = await column("À planifier");
  await waitFor(() => expect(within(backlog).getByRole("button", { name: /^F6 / })).toBeTruthy());
  expect(within(backlog).getByRole("button", { name: /^F8 / })).toBeTruthy();
});
