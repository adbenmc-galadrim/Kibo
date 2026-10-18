import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stepTitles } from "./NewFeatureDialog";
import { cardIn, setupPlanning } from "./planning-kit";
import { TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

test("steps are one per line, blank lines ignored", () => {
  expect(stepTitles("  Lire\n\nCoder \nDémo client\n")).toEqual(["Lire", "Coder", "Démo client"]);
});

const openDialog = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ajouter" }));
  await user.click(await screen.findByRole("menuitem", { name: "Nouvelle fonctionnalité" }));
  return { user, dialog: await screen.findByRole("dialog") };
};

test("a new feature is created with its steps in order, the last demo optional, in the chosen sprint", async () => {
  const { m, seeded } = setupPlanning();
  const { user, dialog } = await openDialog();
  await user.type(within(dialog).getByLabelText("Nom"), "Signer un PV");
  await user.type(within(dialog).getByLabelText("Résultat attendu"), "Le PV est signé sur la tablette.");
  await user.selectOptions(within(dialog).getByLabelText("Sprint"), seeded.sprints.s44.id);
  const steps = within(dialog).getByLabelText("Étapes, une par ligne");
  await user.clear(steps);
  await user.type(steps, "Écran de signature{Enter}Export PDF{Enter}Démo client");
  expect(
    within(dialog).getByRole("checkbox", { name: "Dernière étape facultative" }).getAttribute("data-state"),
  ).toBe("checked");
  await user.click(within(dialog).getByRole("button", { name: "Créer la fonctionnalité" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const tickets = m.snapshot().tickets;
  const root = tickets.find((t) => t.title === "Signer un PV");
  expect(root?.description).toBe("Le PV est signé sur la tablette.");
  expect([root?.key, root?.shortKey]).toEqual(["F10", "F10"]);
  expect(root?.sprintId).toBe(seeded.sprints.s44.id);
  const children = tickets.filter((t) => t.parentId === root?.id);
  expect(children.map((t) => [t.title, t.optional])).toEqual([
    ["Écran de signature", false],
    ["Export PDF", false],
    ["Démo client", true],
  ]);
  expect(await cardIn(/^S44 /, root?.shortKey ?? "")).toBeTruthy();
});

test("the feature is created as such: createTicket { title, feature: true }", async () => {
  const { m } = setupPlanning();
  const sent: ProjectCommand[] = [];
  const run = m.sdk.run.bind(m.sdk);
  m.sdk.run = (cmd) => {
    sent.push(cmd);
    return run(cmd);
  };
  const { user, dialog } = await openDialog();
  await user.type(within(dialog).getByLabelText("Nom"), "Signer un PV");
  await user.click(within(dialog).getByRole("button", { name: "Créer la fonctionnalité" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(sent[0]).toEqual({ method: "createTicket", title: "Signer un PV", description: "", feature: true });
  expect(await cardIn(/^S42 /, "F10")).toBeTruthy();
});

test("the last step stays mandatory when unchecked, and a feature needs a step", async () => {
  const { m } = setupPlanning();
  const { user, dialog } = await openDialog();
  await user.type(within(dialog).getByLabelText("Nom"), "Sans démo");
  const create = within(dialog).getByRole("button", { name: "Créer la fonctionnalité" });
  await user.clear(within(dialog).getByLabelText("Étapes, une par ligne"));
  expect(create.hasAttribute("disabled")).toBe(true);
  expect(within(dialog).getByRole("alert").textContent).toBe("Ajoute au moins une étape.");
  await user.type(within(dialog).getByLabelText("Étapes, une par ligne"), "Une seule");
  await user.click(within(dialog).getByRole("checkbox", { name: "Dernière étape facultative" }));
  await user.click(create);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const root = m.snapshot().tickets.find((t) => t.title === "Sans démo");
  const [only] = m.snapshot().tickets.filter((t) => t.parentId === root?.id);
  expect(only?.optional).toBe(false);
});

test("a retry after a partial failure finishes the same feature, without duplicates", async () => {
  const { m, seeded } = setupPlanning();
  const run = m.sdk.run.bind(m.sdk);
  let failures = 1;
  m.sdk.run = async (cmd) => {
    if (cmd.method === "createTicket" && cmd.title === "Export PDF" && failures-- > 0)
      throw new Error("REMOTE_UNAVAILABLE");
    return run(cmd);
  };
  const { user, dialog } = await openDialog();
  await user.type(within(dialog).getByLabelText("Nom"), "Signer un PV");
  await user.selectOptions(within(dialog).getByLabelText("Sprint"), seeded.sprints.s44.id);
  const steps = within(dialog).getByLabelText("Étapes, une par ligne");
  await user.clear(steps);
  await user.type(steps, "Écran de signature{Enter}Export PDF{Enter}Démo client");
  const create = within(dialog).getByRole("button", { name: "Créer la fonctionnalité" });
  await user.click(create);
  expect((await within(dialog).findByRole("alert")).textContent).toBe(
    "Impossible de créer la fonctionnalité.",
  );
  await user.click(create);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const tickets = m.snapshot().tickets;
  const roots = tickets.filter((t) => t.title === "Signer un PV");
  expect(roots).toHaveLength(1);
  expect(roots[0]?.sprintId).toBe(seeded.sprints.s44.id);
  expect(tickets.filter((t) => t.parentId === roots[0]?.id).map((t) => [t.title, t.optional])).toEqual([
    ["Écran de signature", false],
    ["Export PDF", false],
    ["Démo client", true],
  ]);
});

test("on the Saturday after S42, the lingering S42 stays the default sprint of a new feature", async () => {
  setSystemTime(new Date("2026-10-17T10:00:00"));
  const { seeded } = setupPlanning("2026-10-17");
  const { dialog } = await openDialog();
  expect(within(dialog).getByLabelText<HTMLSelectElement>("Sprint").value).toBe(seeded.sprints.s42.id);
});
