import { afterEach, beforeEach, expect, test } from "bun:test";
import type { TabTarget, TicketView } from "@kibo/schema";
import { act, cleanup, renderHook } from "@testing-library/react";
import { emisFeatureProject } from "./feature/fixture";
import { type SheetRef, useSheetAddress } from "./use-sheet-address";

afterEach(cleanup);

const tickets: readonly TicketView[] = emisFeatureProject().tickets;
const page: TabTarget = { kind: "page", projectId: "emis", pageId: "kanban" };
function ticketOf(key: string): TicketView {
  const ticket = tickets.find((t) => t.key === key);
  if (!ticket) throw new Error(`fixture without ${key}`);
  return ticket;
}
const e33 = ticketOf("EMIS-33");
const e34 = ticketOf("EMIS-34");
let closed = 0;

beforeEach(() => {
  closed = 0;
  history.replaceState(null, "", "#/p/emis/kanban");
});

type Props = { sheet: SheetRef | null };
const NO_SHEET: Props = { sheet: null };

const mount = () =>
  renderHook(
    ({ sheet }: Props) =>
      useSheetAddress(
        sheet,
        () => tickets,
        page,
        () => {
          closed += 1;
        },
      ),
    { initialProps: NO_SHEET },
  );

test("opening the sheet puts the ticket address by key without a new history entry, closing restores the page", () => {
  const length = history.length;
  const hook = mount();
  hook.rerender({ sheet: { projectId: "emis", ticketId: e33.id } });
  expect(location.hash).toBe("#/p/emis/t/EMIS-33");
  expect(history.length).toBe(length);
  expect(hook.result.current).toEqual(page);
  hook.rerender({ sheet: { projectId: "emis", ticketId: e34.id } });
  expect(location.hash).toBe("#/p/emis/t/EMIS-34");
  hook.rerender({ sheet: null });
  expect(location.hash).toBe("#/p/emis/kanban");
  expect(closed).toBe(0);
});

test("a route change from elsewhere closes the sheet, its own address does not", () => {
  const hook = mount();
  hook.rerender({ sheet: { projectId: "emis", ticketId: e33.id } });
  hook.rerender({ sheet: { projectId: "emis", ticketId: e33.id } });
  expect(closed).toBe(0);
  act(() => {
    history.replaceState(null, "", "#/p/emis/planning");
  });
  hook.rerender({ sheet: { projectId: "emis", ticketId: e33.id } });
  expect(closed).toBe(1);
  expect(location.hash).toBe("#/p/emis/planning");
});
