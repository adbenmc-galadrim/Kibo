import { useEffect, useRef } from "react";
import { showClosedTabToast } from "./closed-toast";
import type { TabsApi } from "./use-tabs";

export function useClosedTabToast(tabs: TabsApi): void {
  const seen = useRef(tabs.closures);
  const reopen = useRef(tabs.reopen);
  reopen.current = tabs.reopen;
  const { closures } = tabs;
  useEffect(() => {
    if (closures > seen.current) void showClosedTabToast(() => reopen.current());
    seen.current = closures;
  }, [closures]);
}
