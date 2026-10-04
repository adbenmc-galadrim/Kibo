import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhatsNewDialog } from "./WhatsNewDialog";

const LOG = `# Journal des versions

## Non publié

-

## 1.5.0 — 2026-10-05

- Sauvegardes automatiques de \`~/.kibo\`.
- Didacticiel par la pratique.

Merci à toutes et tous.

## 1.4.0 — 2026-10-04

- Composants en 3D.
`;

test("the dialog renders the installed version's section as a list", async () => {
  render(<WhatsNewDialog open version="1.5.0" changelog={LOG} onSeen={() => {}} />);
  const dialog = await screen.findByRole("dialog", { name: "Quoi de neuf dans Kibo 1.5.0" });
  const items = within(dialog)
    .getAllByRole("listitem")
    .map((li) => li.textContent);
  expect(items).toEqual(["Sauvegardes automatiques de ~/.kibo.", "Didacticiel par la pratique."]);
  expect(within(dialog).getByText("~/.kibo").tagName).toBe("CODE");
  expect(within(dialog).getByText("Merci à toutes et tous.")).toBeTruthy();
  expect(within(dialog).queryByText("Composants en 3D.")).toBeNull();
  const link = within(dialog).getByRole("link", { name: "Toutes les notes de version" });
  expect(link.getAttribute("href")).toBe("https://github.com/adbenmc-galadrim/Kibo/releases");
});

test("a version without a section says so and still links to the releases", async () => {
  render(<WhatsNewDialog open version="9.9.9" changelog={LOG} onSeen={() => {}} />);
  const dialog = await screen.findByRole("dialog", { name: "Quoi de neuf dans Kibo 9.9.9" });
  expect(within(dialog).getByText("Aucune note pour cette version.")).toBeTruthy();
  expect(within(dialog).queryAllByRole("listitem")).toEqual([]);
  expect(within(dialog).getByRole("link", { name: "Toutes les notes de version" })).toBeTruthy();
});

test("closing marks the version as seen", async () => {
  const seen: string[] = [];
  render(<WhatsNewDialog open version="1.5.0" changelog={LOG} onSeen={(v) => seen.push(v)} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Fermer" }));
  expect(seen).toEqual(["1.5.0"]);
});
