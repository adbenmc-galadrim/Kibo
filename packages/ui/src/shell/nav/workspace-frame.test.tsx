import { expect, test } from "bun:test";
import type { Tab, TabsState } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import { Ticket } from "lucide-react";
import { PageActionsProvider, PagePresence, PagePresenceSlot } from "../page-actions";
import { WorkspaceFrame } from "./WorkspaceFrame";

type Place = "inline" | "page" | "none";

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

function Presence({ place }: { place: Place }) {
  const avatars = <span>présence</span>;
  return (
    <>
      <span data-testid="reporter">{place}</span>
      {place === "inline" && avatars}
      {place === "page" && <PagePresence>{avatars}</PagePresence>}
    </>
  );
}

function renderFrame(tabs: Tab[], pageShowsPresence = false) {
  return render(
    <PageActionsProvider>
      <WorkspaceFrame
        tabs={tabsOf(tabs)}
        describe={() => ({ title: "Mes tickets", icon: Ticket, color: null, missing: false })}
        isDirty={() => false}
        onNewTab={() => undefined}
        presence={(place) => <Presence place={place} />}
        pageShowsPresence={pageShowsPresence}
      >
        <section aria-label="En-tête de la page">
          <PagePresenceSlot />
        </section>
      </WorkspaceFrame>
    </PageActionsProvider>,
  );
}

const header = () => within(screen.getByRole("region", { name: "En-tête de la page" }));

test("with a single tab, the presence is drawn in the page header", async () => {
  renderFrame([tab("a")]);
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(await header().findByText("présence")).toBeTruthy();
  expect(screen.getAllByTestId("reporter").map((r) => r.textContent)).toEqual(["page"]);
});

test("with a single tab on a page that shows its presence, the presence only reports", () => {
  renderFrame([tab("a")], true);
  expect(screen.queryByText("présence")).toBeNull();
  expect(screen.getAllByTestId("reporter").map((r) => r.textContent)).toEqual(["none"]);
});

test("with two tabs, the presence sits in the tab bar and not in the page header", async () => {
  renderFrame([tab("a"), tab("b")], true);
  expect(await screen.findByText("présence")).toBeTruthy();
  expect(header().queryByText("présence")).toBeNull();
  expect(screen.getAllByTestId("reporter").map((r) => r.textContent)).toEqual(["inline"]);
});

test("a hidden tab bar collapses its height for the panels portalled out of the frame too", () => {
  const tabBarHeight = () => document.documentElement.style.getPropertyValue("--tabbar-h");
  const { unmount } = renderFrame([tab("a")]);
  expect(tabBarHeight()).toBe("0px");
  unmount();
  expect(tabBarHeight()).toBe("");
  renderFrame([tab("a"), tab("b")]);
  expect(tabBarHeight()).toBe("");
});
