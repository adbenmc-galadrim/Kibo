import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cardIn, column, setupPlanning } from "./planning-kit";
import { TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

test("the header has a labelled Fonctionnalité button, and a Sprint one", async () => {
  setupPlanning();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Fonctionnalité" }));
  expect(await screen.findByRole("dialog", { name: "Nouvelle fonctionnalité" })).toBeTruthy();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Annuler" }));
  await user.click(screen.getByRole("button", { name: "Sprint" }));
  expect(await screen.findByRole("dialog", { name: "Nouveau sprint" })).toBeTruthy();
});

test("À planifier is a sticky pane on the left of the sprints", async () => {
  setupPlanning();
  const backlog = await column("À planifier");
  const regions = screen.getAllByRole("region");
  expect(regions[0]).toBe(backlog);
  expect(backlog.className).toContain("sticky");
  expect(backlog.className).toContain("left-0");
});

const planIn = async (open: () => void | Promise<void>, sprint: string) => {
  const user = userEvent.setup();
  await open();
  await user.click(await screen.findByRole("menuitem", { name: "Planifier dans" }));
  const item = await screen.findByRole("menuitem", { name: sprint });
  item.focus();
  await user.keyboard("{Enter}");
};

test("a right click on a card plans it in a sprint", async () => {
  const { m, seeded } = setupPlanning();
  const f9 = (await cardIn("À planifier", "F9")).closest("article");
  if (!f9) throw new Error("F9 card missing");
  await planIn(() => {
    fireEvent.contextMenu(f9);
  }, "S44 Rapports");
  await waitFor(() =>
    expect(m.snapshot().tickets.find((t) => t.id === seeded.features.f9.root.id)?.sprintId).toBe(
      seeded.sprints.s44.id,
    ),
  );
  expect(await cardIn(/^S44 /, "F9")).toBeTruthy();
});

test("the card menu plans it too, and can send it back to À planifier", async () => {
  const { m, seeded } = setupPlanning();
  const user = userEvent.setup();
  await planIn(
    async () => user.click(await screen.findByRole("button", { name: "Actions de F8" })),
    "À planifier",
  );
  await waitFor(() =>
    expect(m.snapshot().tickets.find((t) => t.id === seeded.features.f8.root.id)?.sprintId).toBeNull(),
  );
  await user.click(await screen.findByRole("button", { name: "Actions de F8" }));
  await user.click(await screen.findByRole("menuitem", { name: "Planifier dans" }));
  expect(screen.queryByRole("menuitem", { name: "À planifier" })).toBeNull();
});
