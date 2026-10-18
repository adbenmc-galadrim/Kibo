import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cardIn, column, setupPlanning } from "./planning-kit";
import { TODAY } from "./test-seed";

const COLUMN_WIDTH = 214;
const COLUMN_STEP = 226;
const original = HTMLElement.prototype.getBoundingClientRect;

const rectOf = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;

const PREVIEW = '[data-slot="planning-drag-preview"]';

const overlayRect = (el: HTMLElement): DOMRect | null => {
  const holdsPreview = el.matches(PREVIEW) || el.firstElementChild?.matches(PREVIEW) === true;
  const dragged = document.querySelector<HTMLElement>("article.opacity-40");
  return holdsPreview && dragged ? dragged.getBoundingClientRect() : null;
};

function placeColumns() {
  HTMLElement.prototype.getBoundingClientRect = function place(this: HTMLElement) {
    const overlay = overlayRect(this);
    if (overlay) return overlay;
    const section = this.closest("section");
    const columns = Array.from(document.querySelectorAll("section"));
    const index = section ? columns.indexOf(section) : -1;
    if (index < 0) return rectOf(-5000, -5000, 10000, 10000);
    const left = index * COLUMN_STEP;
    return this === section ? rectOf(left, 0, COLUMN_WIDTH, 800) : rectOf(left + 10, 100, 194, 90);
  };
}

beforeEach(() => {
  setSystemTime(new Date(`${TODAY}T14:52:00`));
  placeColumns();
});
afterEach(() => {
  setSystemTime();
  HTMLElement.prototype.getBoundingClientRect = original;
});

const sprintOf = (m: ReturnType<typeof setupPlanning>["m"], id: string) =>
  m.snapshot().tickets.find((t) => t.id === id)?.sprintId;

test("dragging F9 from the backlog onto S44 plans it there, with a drop zone while hovering", async () => {
  const { m, seeded } = setupPlanning();
  const f9 = await cardIn("À planifier", "F9");
  f9.focus();
  const user = userEvent.setup();
  await user.keyboard("[Space]");
  for (let i = 0; i < 4; i += 1) await user.keyboard("[ArrowRight]");
  expect(await screen.findByText("Déposer pour planifier en S44")).toBeTruthy();
  expect(document.querySelector('[data-slot="planning-drag-preview"]')?.textContent).toContain(
    "Exporter le dossier client",
  );
  await user.keyboard("[Space]");
  await waitFor(() => expect(sprintOf(m, seeded.features.f9.root.id)).toBe(seeded.sprints.s44.id));
  expect(await cardIn(/^S44 /, "F9")).toBeTruthy();
});

test("a delivered feature can be dragged back to the backlog", async () => {
  const { m, seeded } = setupPlanning();
  const f1 = await cardIn(/^S41 /, "F1");
  f1.focus();
  const user = userEvent.setup();
  await user.keyboard("[Space]");
  await user.keyboard("[ArrowLeft]");
  await user.keyboard("[Space]");
  await waitFor(() => expect(sprintOf(m, seeded.features.f1.root.id)).toBeNull());
});

test("steps are not cards: nothing in a column can drag a child ticket", async () => {
  const { seeded } = setupPlanning();
  await column(/^S42 /);
  const stepIds = seeded.features.f5.steps.map((s) => s.id);
  const draggable = Array.from(document.querySelectorAll('[aria-roledescription="draggable"]'));
  expect(draggable.length).toBe(9);
  expect(screen.queryByRole("button", { name: new RegExp(stepIds.join("|")) })).toBeNull();
});
