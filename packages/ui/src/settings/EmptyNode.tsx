import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  help?: string;
  action?: { label: string; primary: boolean; onClick(): void };
};

export function EmptyNode({ icon, title, help, action }: Props) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg border border-dashed px-6 py-6 text-center">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"
      >
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {action && (
        <Button
          size="sm"
          variant={action.primary ? "default" : "outline"}
          className="mt-1"
          onClick={action.onClick}
        >
          <Plus aria-hidden className="size-3.5" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
