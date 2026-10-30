import type { TabTarget } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import { TabBar } from "../../tabs/TabBar";
import type { TabDescription } from "../../tabs/tab-title";
import type { TabsApi } from "../../tabs/use-tabs";
import { inTauri, openWindow } from "../workspace-actions";
import { showTabBar } from "./tab-bar";
import { useSidebarOpen } from "./use-narrow-screen";

const SIDEBAR_STYLE: CSSProperties & Record<"--sidebar-width", string> = {
  "--sidebar-width": "calc(var(--tracking-sidebar-w) + 1px)",
};

type Props = {
  tabs: TabsApi;
  describe(target: TabTarget): TabDescription;
  onNewTab(): void;
  children: ReactNode;
};

export function WorkspaceFrame({ tabs, describe, onNewTab, children }: Props) {
  const visible = showTabBar(tabs.state, tabs.error);
  const sidebar = useSidebarOpen();
  useEffect(() => {
    if (visible) return;
    const root = document.documentElement.style;
    root.setProperty("--tabbar-h", "0px");
    return () => {
      root.removeProperty("--tabbar-h");
    };
  }, [visible]);
  return (
    <div className={cn("flex h-svh flex-col", !visible && "[--tabbar-h:0px]")}>
      {visible && (
        <TabBar
          state={tabs.state}
          describe={describe}
          dispatch={tabs.dispatch}
          onNewTab={onNewTab}
          onOpenWindow={inTauri() ? null : openWindow}
          error={tabs.error}
        />
      )}
      <SidebarProvider
        className="min-h-0 flex-1"
        style={SIDEBAR_STYLE}
        open={sidebar.open}
        onOpenChange={sidebar.onOpenChange}
      >
        {children}
      </SidebarProvider>
    </div>
  );
}
