import { cn } from "@kibo/sdk/lib/utils";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import type { Token } from "./highlight";

type CssVars = CSSProperties & Record<`--${string}`, string | undefined>;
type Props = { tokens: Token[][]; highlightLine: number | null; label: string };

function toRows(tokens: Token[][]) {
  return tokens.map((line, i) => {
    let offset = 0;
    const spans = line.map((token) => {
      const span = { key: offset, token };
      offset += token.content.length;
      return span;
    });
    return { n: i + 1, spans };
  });
}

export function CodeLines({ tokens, highlightLine, label }: Props) {
  const target = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => toRows(tokens), [tokens]);
  useEffect(() => {
    if (highlightLine !== null && rows.length > 0) target.current?.scrollIntoView?.({ block: "center" });
  }, [highlightLine, rows]);
  return (
    <section
      aria-label={label}
      className="min-h-0 min-w-0 flex-1 overflow-auto py-2 font-mono text-[13px] leading-5"
    >
      {rows.map((row) => {
        const current = row.n === highlightLine;
        return (
          <div
            key={row.n}
            ref={current ? target : undefined}
            data-line={row.n}
            aria-current={current ? "location" : undefined}
            className={cn("grid grid-cols-[4.5rem_1fr]", current && "bg-sky-500/10 dark:bg-sky-400/15")}
          >
            <span
              className={cn(
                "select-none pr-6 text-right text-muted-foreground tabular-nums",
                current && "font-medium text-foreground",
              )}
            >
              {row.n}
            </span>
            <code className="whitespace-pre pr-4">
              {row.spans.map(({ key, token }) => {
                const style: CssVars = { "--shiki-light": token.light, "--shiki-dark": token.dark };
                return (
                  <span key={key} className="shiki-token" style={style}>
                    {token.content}
                  </span>
                );
              })}
            </code>
          </div>
        );
      })}
    </section>
  );
}
