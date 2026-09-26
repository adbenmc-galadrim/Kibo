import { type FileRef, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { FileCode, Pencil, RotateCw, Save, SquareTerminal } from "lucide-react";
import { useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { CodeEditor } from "./CodeEditor";
import { CodeLines } from "./CodeLines";
import { splitPath } from "./file-path";
import { useExternalOpen } from "./use-external-open";
import { useFileContent } from "./use-file-content";

type Props = { fileRef: FileRef; startEditing: boolean };

export function FileTabView({ fileRef, startEditing }: Props) {
  const file = useFileContent(fileRef);
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const inFlight = useRef(false);
  const { dir, name } = splitPath(fileRef.path);
  const openExternal = useExternalOpen(fileRef, file.worktree?.path ?? null, file.setError);
  const c = file.content;

  const save = () => {
    if (inFlight.current || !c?.hash || c.content === null || !file.worktree) return;
    const next = draft ?? c.content;
    inFlight.current = true;
    setSaving(true);
    client
      .code({
        method: "writeFile",
        projectId: fileRef.projectId,
        worktree: file.worktree.path,
        path: fileRef.path,
        content: next,
        baseHash: c.hash,
      })
      .then(
        ({ hash }) => {
          file.replaceContent({ ...c, content: next, hash, dirty: true, lines: next.split("\n").length });
          setDraft((current) => (current === next ? null : current));
          setStale(false);
          file.setError(null);
        },
        (e: unknown) => {
          setStale(e instanceof KiboError && e.code === "FILE_CHANGED");
          file.setError(errorMessage(e));
        },
      )
      .finally(() => {
        inFlight.current = false;
        setSaving(false);
      });
  };

  const reload = () => {
    setStale(false);
    setDraft(null);
    file.reload();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <FileCode aria-hidden className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <h1 className="min-w-0 truncate font-mono text-sm">
          <span className="text-muted-foreground">{dir}</span>
          {name}
        </h1>
        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <Button size="sm" disabled={saving || draft === null} onClick={save}>
              <Save />
              {saving ? fr.file.saving : fr.file.save}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={c?.content == null}
            >
              <Pencil />
              {fr.file.edit}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={fr.file.external}
            title={fr.file.external}
            onClick={openExternal}
          >
            <SquareTerminal />
          </Button>
        </div>
      </header>
      {file.error && (
        <div role="alert" className="flex items-center gap-3 px-4 py-2 text-sm text-destructive">
          {file.error}
          {stale && (
            <Button variant="outline" size="sm" onClick={reload}>
              <RotateCw />
              {fr.changes.reload}
            </Button>
          )}
        </div>
      )}
      {c?.binary && <p className="p-6 text-sm text-muted-foreground">{fr.file.binary}</p>}
      {c?.tooLarge && <p className="p-6 text-sm text-muted-foreground">{fr.file.tooLarge}</p>}
      {editing && c && c.content !== null && (
        <CodeEditor
          initial={c.content}
          original={null}
          path={fileRef.path}
          layout="single"
          label={fileRef.path}
          onChange={setDraft}
          onSave={save}
        />
      )}
      {!editing && file.tokens && (
        <CodeLines tokens={file.tokens} highlightLine={fileRef.line} label={fileRef.path} />
      )}
    </div>
  );
}
