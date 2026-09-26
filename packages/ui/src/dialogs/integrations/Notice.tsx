import { cn } from "@kibo/sdk/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { CircleX, type LucideIcon, ShieldAlert, TriangleAlert } from "lucide-react";

export type NoticeTone = "error" | "warning" | "security";

const TONES: Record<NoticeTone, { icon: LucideIcon; role: "alert" | "note"; className: string }> = {
  error: {
    icon: CircleX,
    role: "alert",
    className:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400",
  },
  warning: {
    icon: TriangleAlert,
    role: "alert",
    className:
      "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600/70 dark:bg-amber-500/10 dark:text-amber-300",
  },
  security: {
    icon: ShieldAlert,
    role: "note",
    className:
      "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600/70 dark:bg-amber-500/10 dark:text-amber-300",
  },
};

type Props = { tone: NoticeTone; title: string; detail: string };

export function Notice({ tone, title, detail }: Props) {
  const { icon: Icon, role, className } = TONES[tone];
  return (
    <Alert role={role} data-tone={tone} className={cn(className)}>
      <Icon aria-hidden />
      <AlertTitle className="line-clamp-none">{title}</AlertTitle>
      <AlertDescription>{detail}</AlertDescription>
    </Alert>
  );
}
