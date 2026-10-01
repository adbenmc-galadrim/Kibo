import { cn } from "@kibo/sdk/lib/utils";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import type { FindMatch } from "./find-in-file";
import type { Token } from "./highlight";
import { type Piece, splitToken } from "./mark-pieces";

type CssVars = CSSProperties & Record<`--${string}`, string | undefined>;
type Props = {
  tokens: Token[][];
  highlightLine: number | null;
  label: string;
  wrap: boolean;
  matches?: readonly FindMatch[];
  matchLength?: number;
  highlight?: FindMatch | null;
};

const MARK = "rounded-[2px] bg-yellow-300/60 text-inherit dark:bg-yellow-400/35";
const CURRENT = "bg-yellow-400 ring-1 ring-yellow-600 dark:bg-yellow-500/70 dark:ring-yellow-300";

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

function columnsByLine(matches: readonly FindMatch[]): Map<number, number[]> {
  const byLine = new Map<number, number[]>();
  for (const m of matches) byLine.set(m.line, [...(byLine.get(m.line) ?? []), m.col]);
  return byLine;
}

export function CodeLines({
  tokens,
  highlightLine,
  label,
  wrap,
  matches = [],
  matchLength = 0,
  highlight = null,
}: Props) {
  const target = useRef<HTMLDivElement>(null);
  const currentMark = useRef<HTMLElement>(null);
  const rows = useMemo(() => toRows(tokens), [tokens]);
  const byLine = useMemo(() => columnsByLine(matches), [matches]);
  useEffect(() => {
    if (highlightLine !== null && rows.length > 0) target.current?.scrollIntoView?.({ block: "center" });
  }, [highlightLine, rows]);
  useEffect(() => {
    if (highlight) currentMark.current?.scrollIntoView?.({ block: "center" });
  }, [highlight]);
  const renderPiece = (piece: Piece, line: number) => {
    if (piece.col === null) return piece.text;
    const isCurrent = highlight?.line === line && highlight.col === piece.col;
    const anchor = isCurrent && piece.first;
    return (
      <mark
        key={piece.at}
        ref={anchor ? currentMark : undefined}
        aria-current={anchor ? "true" : undefined}
        className={cn(MARK, isCurrent && CURRENT)}
      >
        {piece.text}
      </mark>
    );
  };
  return (
    <section
      aria-label={label}
      className="min-h-0 min-w-0 flex-1 overflow-auto py-2 font-mono text-[13px] leading-5"
    >
      {rows.map((row) => {
        const current = row.n === highlightLine;
        const cols = byLine.get(row.n) ?? [];
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
            <code
              className={cn(
                "min-w-0 pr-4",
                wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "whitespace-pre",
              )}
            >
              {row.spans.map(({ key, token }) => {
                const style: CssVars = { "--shiki-light": token.light, "--shiki-dark": token.dark };
                return (
                  <span key={key} className="shiki-token" style={style}>
                    {cols.length === 0
                      ? token.content
                      : splitToken(token.content, key, cols, matchLength).map((p) => renderPiece(p, row.n))}
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
