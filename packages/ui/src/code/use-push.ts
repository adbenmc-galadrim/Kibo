import { KiboError } from "@kibo/schema";
import { useState } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";

export type PushFailure = { message: string; output: string | null };

type Handlers = { onStart(): void; onPushed(): void; onSettled(): void };

const failureOf = (e: unknown): PushFailure => ({
  message: errorMessage(e),
  output: e instanceof KiboError && e.detail.trim() ? e.detail.trim() : null,
});

export function usePush(projectId: string, worktree: string, handlers: Handlers) {
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<PushFailure | null>(null);
  const push = () => {
    setPushing(true);
    setPushError(null);
    handlers.onStart();
    client
      .code({ method: "push", projectId, worktree })
      .then(handlers.onPushed, (e: unknown) => setPushError(failureOf(e)))
      .finally(() => {
        setPushing(false);
        handlers.onSettled();
      });
  };
  return { pushing, pushError, push };
}
