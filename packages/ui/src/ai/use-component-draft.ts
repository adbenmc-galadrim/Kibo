import type { ComponentDraftDetails } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

export function useComponentDraft(draftId: string): {
  details: ComponentDraftDetails | null;
  error: string | null;
  reload: () => void;
} {
  const [details, setDetails] = useState<ComponentDraftDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const reload = useCallback(() => {
    const current = ++request.current;
    client.rpc({ method: "getComponentDraft", draftId }).then(
      (d) => {
        if (request.current !== current) return;
        setDetails(d);
        setError(null);
      },
      (e: unknown) => {
        if (request.current === current) setError(e instanceof Error ? e.message : fr.common.error);
      },
    );
  }, [draftId]);
  useEffect(() => {
    reload();
    return () => {
      request.current++;
    };
  }, [reload]);
  useEffect(
    () =>
      client.subscribeAi((e) => {
        if (e.type === "draft.changed" && e.draftId === draftId) reload();
      }),
    [draftId, reload],
  );
  return { details, error, reload };
}
