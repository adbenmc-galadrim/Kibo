import { useCallback, useMemo, useState } from "react";
import { columnOf } from "./file-path";
import { type FindMatch, type FindState, findMatches, parseGoTo, stepMatch } from "./find-in-file";

type Position = { line: number; col: number };
type KeyInput = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault(): void;
};

export type FileFind = {
  find: FindState | null;
  goTo: number | null;
  current: FindMatch | null;
  position: Position;
  open(query: string): void;
  step(delta: 1 | -1): void;
  close(): void;
  onKeyDown(e: KeyInput): void;
};

const isFindShortcut = (e: KeyInput) =>
  (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "f";

export function useFileFind(text: string | null, targetLine: number | null, enabled = true): FileFind {
  const [search, setSearch] = useState<{ query: string; index: number } | null>(null);
  const lines = useMemo(() => (text ?? "").split("\n"), [text]);
  const query = enabled ? (search?.query ?? null) : null;
  const matches = useMemo(
    () => (query && parseGoTo(query) === null ? findMatches(lines, query) : []),
    [lines, query],
  );
  const find: FindState | null =
    query === null || !search
      ? null
      : { query, matches, index: Math.min(search.index, Math.max(matches.length - 1, 0)) };
  const parsed = find ? parseGoTo(find.query) : null;
  const goTo = parsed === null ? null : Math.min(parsed, lines.length);
  const current = find?.matches[find.index] ?? null;
  const line = goTo ?? targetLine;
  const position = current ?? { line: line ?? 1, col: columnOf(text, line) };
  const onKeyDown = useCallback(
    (e: KeyInput) => {
      if (!enabled || !isFindShortcut(e)) return;
      e.preventDefault();
      setSearch((s) => s ?? { query: "", index: 0 });
    },
    [enabled],
  );

  return {
    find,
    goTo,
    current,
    position,
    open: (next) => setSearch({ query: next, index: 0 }),
    step: (delta) => {
      if (find) setSearch({ query: find.query, index: stepMatch(find, delta).index });
    },
    close: () => setSearch(null),
    onKeyDown,
  };
}
