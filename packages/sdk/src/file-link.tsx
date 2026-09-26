import { cn } from "./lib/utils";

export type FileRefText = { path: string; line: number | null; column: number | null };
export type TextSegment =
  | { kind: "text"; text: string; start: number }
  | { kind: "file"; text: string; start: number; ref: FileRefText };
type OpenRef = { path: string; line: number | null };

const KNOWN_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "md",
  "css",
  "html",
  "rs",
  "toml",
  "yaml",
  "yml",
  "py",
  "go",
  "sql",
  "sh",
  "txt",
  "lock",
  "svg",
]);
const FILE_REF =
  /(?<![\w./:@-])((?:[\w@.-]+\/)*[\w.-]+\.([A-Za-z][A-Za-z0-9]{0,9}))(?::(\d+))?(?::(\d+))?(?![\w/])/g;

const toNumber = (value: string | undefined) => (value ? Number(value) : null);

export function linkifyPaths(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let cursor = 0;
  for (const m of text.matchAll(FILE_REF)) {
    const [whole, path = "", ext = ""] = m;
    const start = m.index;
    if (!path.includes("/") && !KNOWN_EXTENSIONS.has(ext.toLowerCase())) continue;
    if (start > cursor) out.push({ kind: "text", text: text.slice(cursor, start), start: cursor });
    out.push({
      kind: "file",
      text: whole,
      start,
      ref: { path, line: toNumber(m[3]), column: toNumber(m[4]) },
    });
    cursor = start + whole.length;
  }
  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor), start: cursor });
  return out;
}

export function parseFileRef(text: string): FileRefText | null {
  const [only, ...rest] = linkifyPaths(text.trim());
  return only?.kind === "file" && rest.length === 0 ? only.ref : null;
}

export function FileLink({
  path,
  line = null,
  label,
  onOpen,
  className,
}: {
  path: string;
  line?: number | null;
  label?: string;
  onOpen(ref: OpenRef): void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("font-mono text-sky-700 underline-offset-2 hover:underline dark:text-sky-400", className)}
      onClick={() => onOpen({ path, line })}
    >
      {label ?? (line ? `${path}:${line}` : path)}
    </button>
  );
}

export function LinkifiedText({ text, onOpen }: { text: string; onOpen(ref: OpenRef): void }) {
  return (
    <>
      {linkifyPaths(text).map((s) =>
        s.kind === "text" ? (
          <span key={s.start}>{s.text}</span>
        ) : (
          <FileLink key={s.start} path={s.ref.path} line={s.ref.line} label={s.text} onOpen={onOpen} />
        ),
      )}
    </>
  );
}
