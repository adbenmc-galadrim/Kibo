import { cn } from "@kibo/sdk/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { Bot, ChevronRight, Folder, Info, LayoutGrid } from "lucide-react";
import { useId } from "react";
import { frDomains } from "../i18n/fr-domains";
import { usePref } from "../lib/local-pref";

const t = frDomains.help;
const ICONS = [
  <LayoutGrid key="w" aria-hidden className="size-3.5" />,
  <Folder key="p" aria-hidden className="size-3.5" />,
  <span key="d" aria-hidden className="size-1.5 rounded-full bg-foreground" />,
  <Bot key="a" aria-hidden className="size-3.5" />,
];

export function HowAgentsAreConfigured() {
  const [pref, setPref] = usePref("domains.help", "open");
  const open = pref === "open";
  const orderId = useId();
  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setPref(next ? "open" : "closed")}
      className="rounded-lg border bg-card px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <CollapsibleTrigger className="flex items-center gap-2 rounded text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <ChevronRight aria-hidden className={cn("size-4 transition-transform", open && "rotate-90")} />
          <Info aria-hidden className="size-4 text-muted-foreground" />
          {t.title}
        </CollapsibleTrigger>
        <span className="flex-1" />
        {!open && <span className="text-xs text-muted-foreground">{t.summary}</span>}
      </div>
      <CollapsibleContent className="grid gap-2 pt-3 pl-6">
        <span id={orderId} className="sr-only">
          {t.order}
        </span>
        <ol aria-labelledby={orderId} className="flex flex-wrap items-center gap-2 text-xs">
          {t.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              {i > 0 && <ChevronRight aria-hidden className="size-3 text-muted-foreground" />}
              <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium">
                <span className="font-mono text-2xs text-muted-foreground">{i + 1}</span>
                {ICONS[i]}
                {step}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">{t.text}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <a href="#/agents" className="font-medium underline underline-offset-2">
            {t.agents}
          </a>
          <a href="#/agents/skills" className="font-medium underline underline-offset-2">
            {t.skills}
          </a>
          <span className="flex-1" />
          <span className="text-muted-foreground">{t.injection}</span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
