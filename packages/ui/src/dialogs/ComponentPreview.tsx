import type { LucideIcon } from "lucide-react";

const COLUMNS = [
  { dot: "bg-zinc-400", cards: 2 },
  { dot: "bg-blue-500", cards: 3 },
  { dot: "bg-violet-500", cards: 1 },
  { dot: "bg-green-500", cards: 2 },
];
const NODES = [
  [20, 20],
  [110, 20],
  [110, 70],
  [190, 20],
];

const BAR_KEYS = ["b1", "b2", "b3", "b4", "b5"];

function Bars({ n }: { n: number }) {
  return (
    <>
      {BAR_KEYS.slice(0, n).map((k) => (
        <div key={k} className="h-5 rounded-sm bg-muted" />
      ))}
    </>
  );
}

export function ComponentPreview({ id, icon: Icon }: { id: string; icon: LucideIcon }) {
  if (id === "kanban") {
    return (
      <div aria-hidden className="grid h-36 grid-cols-4 gap-2 rounded-lg bg-muted/60 p-2">
        {COLUMNS.map((c) => (
          <div key={c.dot} className="grid content-start gap-1.5 rounded-md bg-background/60 p-1.5">
            <span className={`size-1.5 rounded-full ${c.dot}`} />
            <Bars n={c.cards} />
          </div>
        ))}
      </div>
    );
  }
  if (id === "tickets" || id === "notes") {
    return (
      <div aria-hidden className="grid h-36 content-start gap-1.5 rounded-lg bg-muted/60 p-3">
        <Bars n={5} />
      </div>
    );
  }
  if (id === "graph") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 240 110"
        className="h-36 w-full rounded-lg bg-muted/60 text-muted-foreground"
      >
        <path d="M60 30 H110 M60 30 L110 80 M150 30 H190" stroke="currentColor" fill="none" />
        {NODES.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="40" height="20" rx="4" className="fill-background" />
        ))}
      </svg>
    );
  }
  return (
    <div aria-hidden className="grid h-36 place-items-center rounded-lg bg-muted/60">
      <Icon className="size-8 text-muted-foreground" />
    </div>
  );
}
