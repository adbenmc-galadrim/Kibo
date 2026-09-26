import { cn } from "@kibo/sdk/lib/utils";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import { formatTokens } from "../agents/format";
import { fr } from "../i18n/fr";

export function InjectionChain({ labels, tokens }: { labels: string[]; tokens: number }) {
  const id = useId();
  return (
    <footer className="flex items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <span id={id}>{fr.domains.injection}</span>
      <ol aria-labelledby={id} className="flex items-center gap-2">
        {labels.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <ChevronRight aria-hidden className="size-3" />}
            <span
              className={cn(
                "rounded border px-1.5 py-0.5",
                i === labels.length - 1 && "border-teal-500 text-foreground",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      <span className="flex-1" />
      <span className="font-mono">{fr.domains.tokens(formatTokens(tokens))}</span>
    </footer>
  );
}
