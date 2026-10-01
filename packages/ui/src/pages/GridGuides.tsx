import type { CellMetrics } from "../lib/format-grid";
import { gridArea } from "./DashboardGrid";
import type { Target } from "./layout-draft";

export function GridGuides({ metrics, ghost }: { metrics: CellMetrics; ghost: Target | null }) {
  const offset = 16 - metrics.gap / 2;
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in oklab, var(--muted-foreground) 40%, transparent) 1px, transparent 1.5px)",
          backgroundSize: `${metrics.column + metrics.gap}px ${metrics.row + metrics.gap}px`,
          backgroundPosition: `${offset}px ${offset}px`,
        }}
      />
      {ghost && (
        <div
          aria-hidden
          data-ghost={ghost.free ? "free" : "taken"}
          className={`pointer-events-none z-30 rounded-lg border-2 border-dashed ${ghost.free ? "border-ring bg-accent/40" : "border-destructive bg-destructive/10"}`}
          style={gridArea(ghost.layout)}
        />
      )}
    </>
  );
}
