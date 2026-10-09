import type { StorybookOrigin } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { fr } from "./fr";

type Props = { origins: readonly StorybookOrigin[]; current: string; onChange(origin: string): void };

const hostOf = (origin: string): string => (URL.canParse(origin) ? new URL(origin).host : origin);

export function OriginMenu({ origins, current, onChange }: Props) {
  const label = origins.find((o) => o.origin === current)?.label ?? hostOf(current);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="max-w-40 gap-1">
          <span className="truncate">{fr.origins.trigger(label)}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup value={current} onValueChange={onChange}>
          {origins.map((o) => (
            <DropdownMenuRadioItem key={o.origin} value={o.origin} className="gap-2 text-xs">
              <span className="truncate">{o.label}</span>
              <span className="font-mono text-2xs text-muted-foreground">{hostOf(o.origin)}</span>
              {!o.reachable && (
                <span className="ml-auto flex items-center gap-1 text-2xs text-muted-foreground">
                  <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
                  {fr.origins.unreachable}
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
