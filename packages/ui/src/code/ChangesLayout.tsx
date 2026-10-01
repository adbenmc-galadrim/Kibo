import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";

type Props = { files: ReactNode; diff: ReactNode; commit: ReactNode; filesTitle: string };

export function ChangesLayout({ files, diff, commit, filesTitle }: Props) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:grid lg:grid-cols-[272px_minmax(0,1fr)_340px] lg:grid-rows-1 lg:overflow-hidden">
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="flex min-h-0 flex-col border-b lg:border-b-0"
      >
        <CollapsibleTrigger className="group flex items-center gap-1.5 px-3 py-2 text-left text-sm font-medium hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none lg:hidden">
          <ChevronRight
            aria-hidden
            className="size-4 transition-transform group-data-[state=open]:rotate-90"
          />
          {filesTitle}
        </CollapsibleTrigger>
        <CollapsibleContent
          forceMount
          className="flex min-h-0 flex-1 flex-col max-lg:max-h-72 data-[state=closed]:max-lg:hidden"
        >
          {files}
        </CollapsibleContent>
      </Collapsible>
      <div className="flex min-h-96 min-w-0 flex-col lg:min-h-0">{diff}</div>
      {commit}
    </div>
  );
}
