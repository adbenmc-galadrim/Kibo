import type { TabTarget } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { SidebarProvider } from "@kibo/sdk/ui/sidebar";
import type { CSSProperties, ReactNode } from "react";
import { TabBar } from "../../tabs/TabBar";
import type { TabDescription } from "../../tabs/tab-title";
import type { TabsApi } from "../../tabs/use-tabs";
import type { PresencePlace } from "../ProjectPresence";
import { inTauri, openWindow } from "../workspace-actions";
import { showTabBar } from "./tab-bar";

const SIDEBAR_STYLE: CSSProperties & Record<"--sidebar-width", string> = {
  "--sidebar-width": "calc(var(--tracking-sidebar-w) + 1px)",
};

type Props = {
  tabs: TabsApi;
  describe(target: TabTarget): TabDescription;
  isDirty(target: TabTarget): boolean;
  onNewTab(): void;
  presence(place: PresencePlace): ReactNode;
  pageShowsPresence: boolean;
  children: ReactNode;
};

export function WorkspaceFrame({
  tabs,
  describe,
  isDirty,
  onNewTab,
  presence,
  pageShowsPresence,
  children,
}: Props) {
  const visible = showTabBar(tabs.state, tabs.error);
  return (
    <div className={cn("flex h-svh flex-col", !visible && "[--tabbar-h:0px]")}>
      {visible && (
        <TabBar
          state={tabs.state}
          describe={describe}
          isDirty={isDirty}
          dispatch={tabs.dispatch}
          onNewTab={onNewTab}
          onOpenWindow={inTauri() ? null : openWindow}
          error={tabs.error}
          trailing={presence("inline")}
        />
      )}
      {!visible && presence(pageShowsPresence ? "none" : "page")}
      <SidebarProvider className="min-h-0 flex-1" style={SIDEBAR_STYLE}>
        {children}
      </SidebarProvider>
    </div>
  );
}
