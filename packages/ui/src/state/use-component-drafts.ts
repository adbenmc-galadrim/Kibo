import { type ComponentDraft, KiboError } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";

export function useComponentDrafts(): {
  drafts: ComponentDraft[] | null;
  error: string | null;
  reload(): void;
} {
  const [drafts, setDrafts] = useState<ComponentDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const reload = useCallback(() => {
    const current = ++request.current;
    client.rpc({ method: "listComponentDrafts" }).then(
      (list) => {
        if (request.current !== current) return;
        setDrafts(list);
        setError(null);
      },
      (e: unknown) => {
        if (request.current !== current) return;
        if (e instanceof KiboError && e.code === "UNAUTHORIZED") return;
        setError(errorMessage(e));
      },
    );
  }, []);
  useEffect(() => {
    reload();
    const off = client.subscribeAi((e) => {
      if (e.type === "draft.changed") reload();
    });
    return () => {
      request.current++;
      off();
    };
  }, [reload]);
  return { drafts, error, reload };
}
