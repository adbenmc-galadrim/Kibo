import type { AutoLink, KiboError } from "@kibo/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { client } from "../api";
import { asKiboError } from "./use-overlaps";

export type AutoLinksState = {
  links: AutoLink[];
  byLinkId: Map<string, AutoLink>;
  byId: Map<string, AutoLink>;
  error: KiboError | null;
  cancel(id: string): Promise<void>;
};

export function useAutoLinks(projectId: string | null): AutoLinksState {
  const [links, setLinks] = useState<AutoLink[]>([]);
  const [error, setError] = useState<KiboError | null>(null);
  const load = useRef<() => Promise<void>>(() => Promise.resolve());
  useEffect(() => {
    setLinks([]);
    setError(null);
    if (!projectId) return;
    let alive = true;
    load.current = () =>
      client.rpc({ method: "autoLinks.list", projectId }).then(
        (next) => {
          if (!alive) return;
          setLinks(next);
          setError(null);
        },
        (e: unknown) => {
          if (alive) setError(asKiboError(e));
        },
      );
    void load.current();
    const off = client.subscribeTopic("agents", () => void load.current());
    return () => {
      alive = false;
      load.current = () => Promise.resolve();
      off();
    };
  }, [projectId]);
  const cancel = useCallback(async (id: string) => {
    await client.rpc({ method: "autoLinks.cancel", id });
    await load.current();
  }, []);
  const byLinkId = useMemo(() => new Map(links.map((l) => [l.linkId, l])), [links]);
  const byId = useMemo(() => new Map(links.map((l) => [l.id, l])), [links]);
  return { links, byLinkId, byId, error, cancel };
}
