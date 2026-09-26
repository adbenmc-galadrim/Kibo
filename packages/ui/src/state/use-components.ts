import { type ComponentSummary, type DraftSummary, KiboError } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

export type ComponentsState = {
  components: ComponentSummary[] | null;
  drafts: DraftSummary[] | null;
  error: boolean;
  reload(): void;
};

export function useComponents(): ComponentsState {
  const [components, setComponents] = useState<ComponentSummary[] | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(() => {
    Promise.all([client.rpc({ method: "listComponents" }), client.rpc({ method: "listDrafts" })]).then(
      ([c, d]) => {
        setComponents(c);
        setDrafts(d);
        setError(false);
      },
      (e: unknown) => {
        if (e instanceof KiboError && e.code === "UNAUTHORIZED") return;
        console.error(e);
        setError(true);
      },
    );
  }, []);
  useEffect(() => {
    reload();
    return client.subscribe((id) => {
      if (id === null) reload();
    });
  }, [reload]);
  return { components, drafts, error, reload };
}
