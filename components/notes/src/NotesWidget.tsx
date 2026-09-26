import { useEntities, useSdk } from "@kibo/sdk";
import { useEffect, useState } from "react";
import { fr } from "./fr";

const firstLines = (markdown: string) =>
  markdown
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("```") && !l.startsWith("---"))
    .slice(0, 4)
    .map((l) => l.replace(/^[-*]\s+/, "• "));

export function NotesWidget() {
  const sdk = useSdk();
  const notes = useEntities("note");
  const pinned = typeof sdk.config.path === "string" ? sdk.config.path : null;
  const target = notes.data.find((n) => n.path === pinned) ?? notes.data[0] ?? null;
  const path = target?.path ?? null;
  const version = target?.mtime ?? null;
  const [lines, setLines] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (path === null || version === null) return;
    let live = true;
    sdk.notes.read(path).then(
      (c) => live && setLines(firstLines(c.markdown)),
      (e: unknown) => {
        console.error(e);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [sdk, path, version]);

  if (notes.error || failed) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  if (notes.loading) return <div className="h-full" />;
  if (!target) return <p className="p-4 text-sm text-muted-foreground">{fr.emptyWidget}</p>;
  return (
    <div className="grid content-start gap-2 p-3 text-sm">
      <h3 className="font-semibold">
        <button type="button" className="text-left hover:underline" onClick={() => sdk.openView("notes")}>
          {target.title}
        </button>
      </h3>
      <ul className="grid gap-1 text-xs text-muted-foreground">
        {lines.map((l, i) => (
          <li key={`${i}-${l}`} className="truncate">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
