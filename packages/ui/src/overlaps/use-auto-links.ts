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

const NO_LINKS: AutoLink[] = [];

type Loaded = { projectId: string | null; links: AutoLink[]; error: KiboError | null };

export function useAutoLinks(projectId: string | null, linkIds?: string): AutoLinksState {
  const [loaded, setLoaded] = useState<Loaded>({ projectId: null, links: [], error: null });
  const load = useRef<() => Promise<void>>(() => Promise.resolve());
  useEffect(() => {
    if (!projectId || linkIds === "") return;
    let alive = true;
    load.current = () =>
      client.rpc({ method: "autoLinks.list", projectId }).then(
        (links) => {
          if (alive) setLoaded({ projectId, links, error: null });
        },
        (e: unknown) => {
          if (alive)
            setLoaded((prev) => ({
              projectId,
              links: prev.projectId === projectId ? prev.links : [],
              error: asKiboError(e),
            }));
        },
      );
    void load.current();
    const off = client.subscribeTopic("agents", () => void load.current());
    return () => {
      alive = false;
      load.current = () => Promise.resolve();
      off();
    };
  }, [projectId, linkIds]);
  const cancel = useCallback(async (id: string) => {
    await client.rpc({ method: "autoLinks.cancel", id });
    await load.current();
  }, []);
  const current = projectId !== null && linkIds !== "" && loaded.projectId === projectId;
  const links = current ? loaded.links : NO_LINKS;
  const error = current ? loaded.error : null;
  const byLinkId = useMemo(() => new Map(links.map((l) => [l.linkId, l])), [links]);
  const byId = useMemo(() => new Map(links.map((l) => [l.id, l])), [links]);
  return { links, byLinkId, byId, error, cancel };
}
