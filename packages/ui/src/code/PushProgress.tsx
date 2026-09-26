import type { CommitInfo } from "@kibo/schema";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { fr } from "../i18n/fr";

type Props = { command: string; pending: CommitInfo[] };

function useElapsedSeconds(): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - start) / 1_000));
}

export function PushProgress({ command, pending }: Props) {
  const elapsed = useElapsedSeconds();
  return (
    <output className="grid gap-1.5 rounded-lg border bg-muted/40 p-3">
      <p className="flex items-center gap-2 font-mono text-xs">
        <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
        <span className="min-w-0 flex-1 truncate">{command}</span>
        <span className="shrink-0 text-muted-foreground">{fr.commit.elapsed(elapsed)}</span>
      </p>
      <p className="text-xs text-muted-foreground">{fr.commit.pushDetail(pending.map((c) => c.shortSha))}</p>
    </output>
  );
}
