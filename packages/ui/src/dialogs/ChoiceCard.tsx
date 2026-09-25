import { RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

type Props = {
  value: string;
  icon: LucideIcon;
  title: string;
  description?: string | undefined;
  disabled?: boolean;
  badge?: ReactNode;
  aside?: ReactNode;
  stacked?: boolean;
};

export function ChoiceCard({
  value,
  icon: Icon,
  title,
  description,
  disabled,
  badge,
  aside,
  stacked,
}: Props) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`relative flex gap-3 rounded-lg border py-3 pr-9 pl-3 transition-colors has-[[data-state=checked]]:border-foreground/70 has-[[data-state=checked]]:bg-accent ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-accent/60"
      } ${stacked ? "flex-col" : "items-start"}`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="grid flex-1 content-start gap-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium leading-none">
          {title}
          {badge}
        </span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
      {aside}
      <span className="absolute top-3 right-3 flex">
        <RadioGroupItem id={id} value={value} aria-label={title} disabled={disabled} />
      </span>
    </label>
  );
}
