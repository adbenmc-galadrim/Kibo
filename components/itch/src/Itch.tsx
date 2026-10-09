import { EmbedFrame, useFocusMode, useSdk } from "@kibo/sdk";
import { useEffect } from "react";
import { fr } from "./fr";
import { GameHeader } from "./GameHeader";
import { GameProblem, type GameProblemKind } from "./GameProblem";
import { gamePageOf, gameTitleOf } from "./itch-embed";
import { type EmbedState, useEmbed } from "./use-embed";
import { useOnline } from "./use-online";

const textOf = (value: unknown): string | null => (typeof value === "string" ? value : null);

function problemOf(state: EmbedState): GameProblemKind | null {
  switch (state.status) {
    case "empty":
      return { kind: "empty" };
    case "invalid":
      return { kind: "invalid", problem: state.problem };
    case "offline":
      return { kind: "remote", problem: { kind: "offline", code: null } };
    case "failed":
      return { kind: "remote", problem: state.problem };
    default:
      return null;
  }
}

function linkedPage(state: EmbedState): string | null {
  return state.status === "ready" || state.status === "failed" ? state.embed.page : null;
}

export function Itch() {
  const sdk = useSdk();
  const focus = useFocusMode();
  const online = useOnline();
  const { state, retry } = useEmbed(textOf(sdk.config.embed), online);
  useEffect(() => {
    if (focus.available) sdk.capability("fullscreen");
  }, [sdk, focus.available]);
  const page = gamePageOf(textOf(sdk.config.page)) ?? linkedPage(state);
  const problem = problemOf(state);

  return (
    <section aria-label={fr.title} className="flex h-full min-h-0 flex-col">
      <GameHeader title={gameTitleOf(page) ?? fr.title} page={page} focus={focus} />
      <div className="flex min-h-0 flex-1 flex-col">
        {state.status === "ready" && <EmbedFrame view={state.view} title={fr.frame} onExpired={retry} />}
        {state.status === "loading" && (
          <output className="m-auto p-4 text-center text-sm text-muted-foreground">{fr.loading}</output>
        )}
        {problem && <GameProblem problem={problem} page={page} onRetry={retry} />}
      </div>
      {state.status === "ready" && focus.available && !focus.active && (
        <p className="truncate px-3 py-1.5 text-xs text-muted-foreground">{fr.fullscreenHint}</p>
      )}
    </section>
  );
}
