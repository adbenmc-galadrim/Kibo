import { RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

type Props = {
  value: string;
  icon: LucideIcon;
  title: string;
  disabled?: boolean;
  badge?: ReactNode;
  children?: ReactNode;
};

export function ChoicePanel({ value, icon: Icon, title, disabled, badge, children }: Props) {
  const id = useId();
  return (
    <div
      data-slot="choice-panel"
      className={`relative grid gap-2 rounded-lg border py-3 pr-9 pl-3 transition-colors has-[[data-state=checked]]:border-foreground/70 has-[[data-state=checked]]:bg-accent ${
        disabled ? "opacity-60" : "hover:bg-accent/60"
      }`}
    >
      <label
        htmlFor={id}
        className={`flex items-center gap-3 text-sm font-medium leading-none ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        {title}
        {badge}
      </label>
      <span className="absolute top-3 right-3 flex">
        <RadioGroupItem id={id} value={value} aria-label={title} disabled={disabled} />
      </span>
      {children ? <div className="-mr-6 pl-7">{children}</div> : null}
    </div>
  );
}
