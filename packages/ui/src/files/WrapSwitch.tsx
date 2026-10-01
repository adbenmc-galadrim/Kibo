import { cn } from "@kibo/sdk/lib/utils";
import { Switch } from "@kibo/sdk/ui/switch";
import { useId } from "react";
import { frFileTools } from "../i18n/fr-file-tools";

type Props = { wrap: boolean; onWrap(on: boolean): void; className?: string };

export function WrapSwitch({ wrap, onWrap, className }: Props) {
  const id = useId();
  return (
    <span className={cn("flex shrink-0 items-center gap-2 text-muted-foreground", className)}>
      <Switch id={id} aria-label={frFileTools.wrap} checked={wrap} onCheckedChange={onWrap} />
      <label htmlFor={id} className="cursor-pointer">
        {frFileTools.wrap}
      </label>
    </span>
  );
}
