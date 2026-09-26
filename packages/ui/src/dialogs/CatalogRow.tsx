import { RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

type Props = {
  value: string;
  icon: LucideIcon;
  title: string;
  description?: string | undefined;
  aside: ReactNode;
};

export function CatalogSection({ label }: { label: string }) {
  return (
    <p className="px-1 pt-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
  );
}

export function VersionPill({ version }: { version: string }) {
  return <span className="rounded border px-1.5 font-mono text-xs text-muted-foreground">{version}</span>;
}

export function CatalogRow({ value, icon: Icon, title, description, aside }: Props) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="relative flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60 has-[[data-state=checked]]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
    >
      <RadioGroupItem
        id={id}
        value={value}
        aria-label={title}
        className="absolute inset-0 z-10 aspect-auto size-auto cursor-pointer rounded-lg border-0 opacity-0 shadow-none"
      />
      <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-sm font-medium leading-none">{title}</span>
        {description && <span className="truncate text-xs text-muted-foreground">{description}</span>}
      </span>
      {aside}
    </label>
  );
}
