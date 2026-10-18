import { Button } from "@kibo/sdk/ui/button";
import { CircleCheck } from "lucide-react";
import { useEffect } from "react";

const VISIBLE_MS = 8_000;

type Props = {
  message: string;
  actionLabel: string;
  alert?: string | null;
  onAction(): void;
  onClose(): void;
};

export function ActionToast({ message, actionLabel, alert = null, onAction, onClose }: Props) {
  useEffect(() => {
    if (alert !== null) return;
    const timer = setTimeout(onClose, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [alert, onClose]);
  return (
    <output
      aria-label={message}
      className="fixed right-[calc(var(--project-agent-edge,0px)+2.5rem)] bottom-7 z-[60] flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-card-foreground shadow-md"
    >
      <CircleCheck aria-hidden className="size-4 text-emerald-500" />
      <span className="grid text-sm font-medium">
        {message}
        {alert !== null && (
          <span role="alert" className="text-xs font-normal text-destructive">
            {alert}
          </span>
        )}
      </span>
      <Button type="button" variant="outline" size="sm" className="h-6.5 px-2.5 text-xs" onClick={onAction}>
        {actionLabel}
      </Button>
    </output>
  );
}
