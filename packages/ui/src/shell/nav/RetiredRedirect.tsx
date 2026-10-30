import type { TabTarget } from "@kibo/schema";
import { useEffect } from "react";
import { replaceRoute } from "../../route";
import { targetToHash } from "../../tabs/target-hash";
import { retiredRoute } from "../retired-routes";

type Props = { target: TabTarget | null; onHome(): void };

export function RetiredRedirect({ target, onHome }: Props) {
  useEffect(() => {
    const leaveRetired = () => {
      if (retiredRoute(location.hash) === null) return;
      replaceRoute(null);
      onHome();
    };
    leaveRetired();
    window.addEventListener("hashchange", leaveRetired);
    return () => window.removeEventListener("hashchange", leaveRetired);
  }, [onHome]);
  useEffect(() => {
    if (target !== null && retiredRoute(targetToHash(target)) !== null) onHome();
  }, [target, onHome]);
  return null;
}
