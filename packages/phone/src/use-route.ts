import { useCallback, useEffect, useState } from "react";
import { formatRoute, parseRoute, type Route } from "./route";

export type Navigate = (route: Route, options?: { replace?: boolean }) => void;

export function useHashRoute(): [Route, Navigate] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const follow = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  const navigate = useCallback<Navigate>((next, { replace = false } = {}) => {
    const hash = formatRoute(next);
    if (replace) window.history.replaceState(null, "", hash);
    else window.location.hash = hash;
    setRoute(next);
  }, []);
  return [route, navigate];
}
