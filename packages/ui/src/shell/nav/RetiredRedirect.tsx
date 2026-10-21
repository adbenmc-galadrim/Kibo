import type { TabTarget } from "@kibo/schema";
import { useEffect } from "react";
import { replaceRoute } from "../../route";
import { isRetiredTarget, retiredRoute } from "../retired-routes";

type Props = { target: TabTarget | null; onHome(): void };

export function RetiredRedirect({ target, onHome }: Props) {
  useEffect(() => {
    if (retiredRoute(location.hash) === null) return;
    replaceRoute(null);
    onHome();
  }, [onHome]);
  useEffect(() => {
    if (target !== null && isRetiredTarget(target)) onHome();
  }, [target, onHome]);
  return null;
}
