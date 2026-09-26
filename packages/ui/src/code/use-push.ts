import { useState } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";

type Handlers = { onStart(): void; onPushed(): void; onSettled(): void };

export function usePush(projectId: string, worktree: string, handlers: Handlers) {
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const push = () => {
    setPushing(true);
    setPushError(null);
    handlers.onStart();
    client
      .code({ method: "push", projectId, worktree })
      .then(handlers.onPushed, (e: unknown) => setPushError(errorMessage(e)))
      .finally(() => {
        setPushing(false);
        handlers.onSettled();
      });
  };
  return { pushing, pushError, push };
}
