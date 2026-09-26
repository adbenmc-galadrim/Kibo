import { cn } from "@kibo/sdk/lib/utils";

export function SlotMeter({ used, total, className }: { used: number; total: number; className?: string }) {
  const slots = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <span aria-hidden="true" className={cn("inline-flex items-center gap-0.5", className)}>
      {slots.map((slot) => (
        <span
          key={slot}
          className={cn("h-3 w-1.5 rounded-[2px]", slot <= used ? "bg-blue-500" : "bg-muted-foreground/30")}
        />
      ))}
    </span>
  );
}
