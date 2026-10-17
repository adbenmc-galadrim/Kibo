import { cn } from "../lib/utils";
import { shortDate } from "./fr";
import type { TimelineColumn, TimelineGeometry } from "./timeline-model";

type Props = { columns: readonly TimelineColumn[]; height: number; g: TimelineGeometry };

export function TimelineHeader({ columns, height, g }: Props) {
  return (
    <>
      {columns.map((c) => (
        <div key={c.x} data-current={c.current || undefined}>
          {c.current && (
            <span
              aria-hidden
              className="absolute top-0 bg-(--tracking-muted)/50"
              style={{ left: c.x + 1, width: g.column - 1, height }}
            />
          )}
          <span
            aria-hidden
            className="absolute top-0 w-px bg-(--tracking-soft)"
            style={{ left: c.x, height }}
          />
          {g.header > 0 && (
            <span
              className="absolute flex items-center gap-[6px] text-[12px] leading-[15px]"
              style={{ left: c.x + g.pad, top: 9 }}
            >
              {c.label !== null && <span className="text-(--tracking-mfg)">{c.label}</span>}
              {c.code !== null && (
                <span
                  className={cn(
                    "font-mono font-semibold",
                    c.current ? "text-(--tracking-fg)" : "text-(--tracking-mfg)",
                  )}
                >
                  {c.code}
                </span>
              )}
              {c.start !== null && <span className="text-(--tracking-mfg)">{shortDate(c.start)}</span>}
            </span>
          )}
        </div>
      ))}
      {g.header > 0 && (
        <span
          aria-hidden
          className="absolute left-0 h-px w-full bg-(--tracking-soft)"
          style={{ top: g.header }}
        />
      )}
    </>
  );
}
