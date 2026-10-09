import type { EmbedView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { useEffect, useMemo, useState } from "react";
import { type ItchEmbed, type ItchEmbedProblem, itchEmbedProblem, parseItchEmbed } from "./itch-embed";
import { type ItchProblem, itchProblemOf } from "./itch-problem";

export type EmbedState =
  | { status: "empty" }
  | { status: "invalid"; problem: ItchEmbedProblem }
  | { status: "offline" }
  | { status: "loading" }
  | { status: "ready"; view: EmbedView; embed: ItchEmbed }
  | { status: "failed"; problem: ItchProblem; embed: ItchEmbed };

type Remote = { request: string; state: EmbedState };
type Input = { status: "empty" } | { status: "invalid"; problem: ItchEmbedProblem } | { embed: ItchEmbed };

function inputOf(text: string | null): Input {
  const embed = text === null ? null : parseItchEmbed(text);
  if (embed) return { embed };
  const problem = text === null ? "empty" : (itchEmbedProblem(text) ?? "empty");
  return problem === "empty" ? { status: "empty" } : { status: "invalid", problem };
}

export function useEmbed(text: string | null, online: boolean): { state: EmbedState; retry(): void } {
  const sdk = useSdk();
  const input = useMemo(() => inputOf(text), [text]);
  const embed = "embed" in input ? input.embed : null;
  const [attempt, setAttempt] = useState(0);
  const [remote, setRemote] = useState<Remote | null>(null);
  const request = embed ? `${embed.url}#${attempt}` : "";

  useEffect(() => {
    if (!embed || !online) return;
    setRemote(null);
    let alive = true;
    sdk.embed.open(embed.url).then(
      (view) => {
        if (alive) setRemote({ request, state: { status: "ready", view, embed } });
      },
      (e: unknown) => {
        if (!alive) return;
        const problem = itchProblemOf(e);
        if (problem.kind === "unavailable") console.error("[itch] embed not opened", e);
        setRemote({ request, state: { status: "failed", problem, embed } });
      },
    );
    return () => {
      alive = false;
    };
  }, [sdk, embed, online, request]);

  const retry = () => setAttempt((n) => n + 1);
  if ("status" in input) return { state: input, retry };
  if (!online) return { state: { status: "offline" }, retry };
  const state = remote?.request === request ? remote.state : { status: "loading" as const };
  return { state, retry };
}
