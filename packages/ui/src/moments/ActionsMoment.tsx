import type { FileRef, RunAction } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { ActionRow } from "./ActionRow";
import type { FileContext } from "./file-context";

type Props = {
  actions: RunAction[];
  summary: string;
  failed: boolean;
  files?: FileContext | null;
  onOpenFile?(ref: FileRef): void;
};

export function ActionsMoment({ actions, summary, failed, files, onOpenFile }: Props) {
  return (
    <Collapsible data-failed={failed} className="rounded-md bg-muted/50">
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
          failed ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90"
        />
        {summary}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="grid gap-1.5 px-3 pb-2">
          {actions.map((action, index) => (
            <ActionRow
              key={`${index}-${action.tool}`}
              action={action}
              files={files}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
