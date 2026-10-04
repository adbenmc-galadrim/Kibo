import { useEffect, useRef } from "react";
import { showClosedTabToast } from "./closed-toast";
import type { TabsApi } from "./use-tabs";

export function useClosedTabToast(tabs: TabsApi): void {
  const previous = useRef(tabs.closed);
  const reopen = useRef(tabs.reopen);
  reopen.current = tabs.reopen;
  const { closed } = tabs;
  useEffect(() => {
    const latest = closed[0];
    if (latest && !previous.current.includes(latest)) void showClosedTabToast(() => reopen.current());
    previous.current = closed;
  }, [closed]);
}
