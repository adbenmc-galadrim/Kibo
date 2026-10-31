import { afterEach, expect, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import type { T3Thread, TicketView } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { manifest } from "./index";
import { KanbanCard } from "./KanbanCard";
import { seed } from "./test-seed";

afterEach(cleanup);

const STARTED_AT = Date.now() - 12 * 60_000;
const THREAD: T3Thread = {
  threadId: "thr_1",
  link: "t3-thread://v2/env/thr_1",
  title: "KIB-1 · titre",
  status: "running",
  startedAt: STARTED_AT,
  checkedAt: STARTED_AT,
};

const renderCard = (patch: Partial<TicketView>, launches: string[] = []) => {
  const m = createMockSdk(manifest, { seed, t3: { status: { available: true, bin: "t3" }, launches } });
  const base = m.snapshot().tickets.find((t) => t.keyLabel === "KIB-1");
  if (!base) throw new Error("no seeded ticket");
  render(
    <SdkProvider sdk={m.sdk}>
      <DndContext>
        <KanbanCard
          ticket={{ ...base, startable: false, ...patch }}
          group={null}
          blocked={false}
          blocking={null}
          selected={null}
          statuses={[]}
          project={{ id: "p1", hasFolder: true }}
          onOpen={() => {}}
          onMove={() => {}}
          onRemove={() => {}}
        />
      </DndContext>
    </SdkProvider>,
  );
  return screen.getByRole("article");
};

test("a startable card reveals Lancer dans T3 under the title on hover and on focus", async () => {
  const card = renderCard({ startable: true });
  const launch = await screen.findByRole("button", { name: "Lancer dans T3" });
  const reveal = launch.parentElement;
  expect(card.className).toContain("group/card");
  expect(card.className).toContain("hover:border-foreground/70");
  expect(reveal?.className).toContain("h-0");
  expect(reveal?.className).toContain("group-hover/card:h-auto");
  expect(reveal?.className).toContain("group-focus-within/card:h-auto");
});

test("the hidden launch button stays in the tab order, right after the title", async () => {
  const card = renderCard({ startable: true });
  const launch = await screen.findByRole("button", { name: "Lancer dans T3" });
  const stops = within(card).getAllByRole("button");
  expect(stops.at(-1)).toBe(launch);
  expect(launch.tabIndex).toBe(0);
});

test("a card that is not startable offers no launch", () => {
  renderCard({ startable: false });
  expect(screen.queryByRole("button", { name: "Lancer dans T3" })).toBeNull();
});

test("the button opens the shared LaunchDialog (sdk) and pressing it does not start a drag", async () => {
  renderCard({ startable: true });
  const launch = await screen.findByRole("button", { name: "Lancer dans T3" });
  expect(launch.closest("[data-dnd-ignore]")).not.toBeNull();
  await userEvent.click(launch);
  expect(await screen.findByRole("dialog", { name: "Lancer KIB-1 dans T3" })).toBeTruthy();
});

test("a launched card reads ● T3 · en cours depuis 12 min, with no button", () => {
  renderCard({ startable: true, thread: THREAD });
  const text = screen.getByText("T3 · en cours depuis 12 min");
  expect(text.className).toContain("--tracking-brand-text");
  expect(screen.queryByRole("button", { name: "Lancer dans T3" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Ouvrir dans T3" })).toBeNull();
});

test("a waiting card reads T3 · attend ta réponse in amber at the same place", () => {
  renderCard({ thread: { ...THREAD, status: "waiting" } });
  expect(screen.getByText("T3 · attend ta réponse").className).toContain("--tracking-amber");
});

test("a finished thread leaves no badge, and the card can be launched again", async () => {
  renderCard({ startable: true, thread: { ...THREAD, status: "done" } });
  expect(screen.queryByText(/^T3 ·/)).toBeNull();
  expect(await screen.findByRole("button", { name: "Lancer dans T3" })).toBeTruthy();
});

test("the tooltip of the card closes while its menu is open, so Escape closes the menu", async () => {
  renderCard({ labels: ["ux"] });
  const user = userEvent.setup();
  screen.getByRole("button", { name: /^Actions KIB-1/ }).focus();
  await waitFor(() => expect(document.querySelector('[data-slot="tooltip-rows"]')).not.toBeNull());
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("menu")).toBeTruthy();
  await waitFor(() => expect(document.querySelector('[data-slot="tooltip-rows"]')).toBeNull());
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
});
