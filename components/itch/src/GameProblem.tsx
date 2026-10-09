import { Button } from "@kibo/sdk/ui/button";
import { fr } from "./fr";
import type { ItchEmbedProblem } from "./itch-embed";
import type { ItchProblem } from "./itch-problem";

export type GameProblemKind =
  | { kind: "empty" }
  | { kind: "invalid"; problem: ItchEmbedProblem }
  | { kind: "remote"; problem: ItchProblem };

type Props = { problem: GameProblemKind; page: string | null; onRetry(): void };

function textOf(p: GameProblemKind): string {
  if (p.kind === "empty") return fr.empty;
  if (p.kind === "invalid") return fr.invalid[p.problem];
  return fr.problem[p.problem.kind](p.problem.code);
}

export function GameProblem({ problem, page, onRetry }: Props) {
  const remote = problem.kind === "remote";
  const refused = remote && problem.problem.kind === "refused";
  return (
    <div
      role={problem.kind === "empty" ? "status" : "alert"}
      className="m-auto grid max-w-xs justify-items-center gap-2 p-4 text-center text-sm text-muted-foreground"
    >
      <p>{textOf(problem)}</p>
      {remote && (
        <div className="flex flex-wrap justify-center gap-2">
          {refused && page && (
            <Button variant="outline" size="xs" asChild>
              <a href={page} target="_blank" rel="noreferrer noopener">
                {fr.open}
              </a>
            </Button>
          )}
          <Button variant="outline" size="xs" onClick={onRetry}>
            {fr.retry}
          </Button>
        </div>
      )}
    </div>
  );
}
