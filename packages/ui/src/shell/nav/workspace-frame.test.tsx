import { expect, test } from "bun:test";
import type { Tab, TabsState } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import { Ticket } from "lucide-react";
import { PageActionsProvider, PagePresenceSlot } from "../page-actions";
import { WorkspaceFrame } from "./WorkspaceFrame";

const tab = (id: string): Tab => ({
  id,
  target: { kind: "screen", screen: "mine" },
  pinned: false,
  preview: false,
});

const tabsOf = (tabs: Tab[]) => {
  const state: TabsState = { tabs, activeId: tabs[0]?.id ?? null, recents: [] };
  return {
    state,
    error: null,
    dispatch: () => undefined,
    open: () => undefined,
    closed: [],
    reopen: () => undefined,
  };
};

function renderFrame(tabs: Tab[]) {
  return render(
    <PageActionsProvider>
      <WorkspaceFrame
        tabs={tabsOf(tabs)}
        describe={() => ({ title: "Mes tickets", icon: Ticket, color: null, missing: false })}
        isDirty={() => false}
        onNewTab={() => undefined}
        presence={<span>présence</span>}
      >
        <section aria-label="En-tête de la page">
          <PagePresenceSlot />
        </section>
      </WorkspaceFrame>
    </PageActionsProvider>,
  );
}

test("with a single tab, the presence stays mounted in the page header", async () => {
  renderFrame([tab("a")]);
  expect(screen.queryByRole("tablist")).toBeNull();
  const header = screen.getByRole("region", { name: "En-tête de la page" });
  expect(await within(header).findByText("présence")).toBeTruthy();
});

test("with two tabs, the presence sits in the tab bar and not in the page header", async () => {
  renderFrame([tab("a"), tab("b")]);
  expect(await screen.findByText("présence")).toBeTruthy();
  const header = screen.getByRole("region", { name: "En-tête de la page" });
  expect(within(header).queryByText("présence")).toBeNull();
});
