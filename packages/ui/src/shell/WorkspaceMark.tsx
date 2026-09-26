import { cn } from "@kibo/sdk/lib/utils";

export function WorkspaceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 26" className={className} aria-hidden="true">
      <rect x="0" y="0" width="8" height="11" rx="1.5" fill="currentColor" />
      <rect x="0" y="14" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="10" y="0" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="10" y="11" width="8" height="15" rx="1.5" fill="#F97316" />
      <rect x="20" y="0" width="8" height="6" rx="1.5" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function WorkspaceTile({ size }: { size: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center border bg-card text-foreground",
        size === "md" ? "size-6 rounded-md" : "size-5 rounded-[5px]",
      )}
    >
      <WorkspaceMark className={size === "md" ? "size-3.5" : "size-3"} />
    </span>
  );
}
