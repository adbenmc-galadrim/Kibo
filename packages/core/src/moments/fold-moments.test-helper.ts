import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RunAction } from "@kibo/schema";
import { emptyFold, type FoldContext, type Folded, flushActions, foldLines } from "./fold-moments";

export const fixtureLines = (name: string): string[] => {
  const parts = readFileSync(join(import.meta.dir, "fixtures", "transcripts", `${name}.jsonl`), "utf8").split(
    "\n",
  );
  parts.pop();
  return parts;
};

export const CTX: FoldContext = { stepId: "s2", now: 1_000 };

export const foldAll = (lines: readonly string[], ctx: FoldContext = CTX): Folded["moments"] => {
  const folded = foldLines(emptyFold(), lines, ctx);
  return [...folded.moments, ...flushActions(folded.state, ctx).moments];
};

export const actionsOf = (moments: Folded["moments"]): RunAction[] =>
  moments.flatMap((m) => (m.data.kind === "actions" ? m.data.actions : []));
