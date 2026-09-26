import { cn } from "@kibo/sdk/lib/utils";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";

type Props = {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
};

export function LevelButton({ active, icon, label, count, onClick }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
        active && "bg-accent",
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>{" "}
      {count !== undefined && (
        <span className="font-mono text-xs text-muted-foreground">{fr.domains.count(count)}</span>
      )}
    </button>
  );
}
