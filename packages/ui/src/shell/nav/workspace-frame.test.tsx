import { expect, test } from "bun:test";
import type { Tab, TabsState } from "@kibo/schema";
import { useSidebar } from "@kibo/sdk/ui/sidebar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Ticket } from "lucide-react";
import { PageActionsProvider } from "../page-actions";
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
        onNewTab={() => undefined}
      >
        <span />
      </WorkspaceFrame>
    </PageActionsProvider>,
  );
}

test("a hidden tab bar collapses its height for the panels portalled out of the frame too", () => {
  const tabBarHeight = () => document.documentElement.style.getPropertyValue("--tabbar-h");
  const { unmount } = renderFrame([tab("a")]);
  expect(tabBarHeight()).toBe("0px");
  unmount();
  expect(tabBarHeight()).toBe("");
  renderFrame([tab("a"), tab("b")]);
  expect(tabBarHeight()).toBe("");
});

const narrowViewport = (matches: boolean) => {
  const real = window.matchMedia;
  window.matchMedia = (media: string) =>
    Object.assign(new EventTarget(), {
      matches,
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    }) as unknown as MediaQueryList;
  return () => {
    window.matchMedia = real;
  };
};

function SidebarState() {
  const { state, toggleSidebar } = useSidebar();
  return (
    <button type="button" onClick={toggleSidebar}>
      {state}
    </button>
  );
}

const renderSidebarState = () =>
  render(
    <PageActionsProvider>
      <WorkspaceFrame
        tabs={tabsOf([tab("a")])}
        describe={() => ({ title: "Mes tickets", icon: Ticket, color: null, missing: false })}
        onNewTab={() => undefined}
      >
        <SidebarState />
      </WorkspaceFrame>
    </PageActionsProvider>,
  );

test("under 1180 px the sidebar starts folded and stays unfolded once opened", async () => {
  const restore = narrowViewport(true);
  localStorage.removeItem("kibo.sidebar.narrow-open");
  const first = renderSidebarState();
  await userEvent.setup().click(screen.getByRole("button", { name: "collapsed" }));
  expect(screen.getByRole("button", { name: "expanded" })).toBeTruthy();
  first.unmount();
  renderSidebarState();
  expect(screen.getByRole("button", { name: "expanded" })).toBeTruthy();
  localStorage.removeItem("kibo.sidebar.narrow-open");
  restore();
});

test("from 1180 px the sidebar starts unfolded", () => {
  const restore = narrowViewport(false);
  renderSidebarState();
  expect(screen.getByRole("button", { name: "expanded" })).toBeTruthy();
  restore();
});
