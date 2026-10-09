import type { DesignFrameKey, FrameProblem as Problem } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { fr } from "./fr";
import { frProblems } from "./fr-problems";

const INFO: ReadonlySet<Problem["kind"]> = new Set(["notConnected", "noThumbnail"]);

function hostOf(key: DesignFrameKey | null): string {
  if (key?.provider === "penpot") return new URL(key.instance).host;
  if (key?.provider === "storybook") return new URL(key.origin).host;
  return "";
}

export function FrameProblem({
  problem,
  frameKey,
  onRetry,
}: {
  problem: Problem;
  frameKey: DesignFrameKey | null;
  onRetry(): void;
}) {
  const provider = frameKey?.provider ?? "figma";
  const host = hostOf(frameKey);
  const text = frProblems[problem.kind]({
    provider,
    name: fr.provider[provider],
    host,
    code: problem.code ?? "",
  });
  return (
    <div
      role={INFO.has(problem.kind) ? "status" : "alert"}
      className="m-auto grid max-w-xs justify-items-center gap-2 p-4 text-center text-sm text-muted-foreground"
    >
      <p>{text}</p>
      <Button variant="outline" size="xs" onClick={onRetry}>
        {fr.retry}
      </Button>
    </div>
  );
}
