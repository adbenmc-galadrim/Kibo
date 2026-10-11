import { BellRing } from "lucide-react";
import { frMoments } from "../i18n/fr-moments";

export function ReminderMoment({ reminder }: { reminder: "plan" | "report" }) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <BellRing aria-hidden className="size-3.5" />
      {frMoments.reminders[reminder]}
    </p>
  );
}
