import { type FileContent, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { RotateCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../api";
import { CodeEditor } from "../files/CodeEditor";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";

type Props = {
  projectId: string;
  worktree: string;
  path: string;
  layout: "unified" | "split";
  wrap: boolean;
  onSaved(): void;
};
type Versions = { original: FileContent; current: FileContent };

export function DiffEditorPane({ projectId, worktree, path, layout, wrap, onSaved }: Props) {
  const [files, setFiles] = useState<Versions | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (version < 0) return;
    let alive = true;
    const read = (revision: "index" | "worktree") =>
      client.code({ method: "readFile", projectId, worktree, path, revision });
    Promise.all([read("index"), read("worktree")]).then(
      ([original, current]) => {
        if (!alive) return;
        setFiles({ original, current });
        setDraft(null);
        setError(null);
        setStale(false);
      },
      (e: unknown) => {
        if (alive) setError(errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, path, version]);

  const save = () => {
    const current = files?.current;
    if (!current?.hash || draft === null || saving) return;
    setSaving(true);
    client
      .code({ method: "writeFile", projectId, worktree, path, content: draft, baseHash: current.hash })
      .then(
        () => {
          setVersion((v) => v + 1);
          onSaved();
        },
        (e: unknown) => {
          setStale(e instanceof KiboError && e.code === "FILE_CHANGED");
          setError(errorMessage(e));
        },
      )
      .finally(() => setSaving(false));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end gap-2 border-b px-4 py-1.5">
        {error && (
          <p role="alert" className="mr-auto flex items-center gap-2 text-sm text-destructive">
            {error}
            {stale && (
              <Button variant="outline" size="sm" onClick={() => setVersion((v) => v + 1)}>
                <RotateCw />
                {fr.changes.reload}
              </Button>
            )}
          </p>
        )}
        <Button size="sm" disabled={draft === null || saving} onClick={save}>
          <Save />
          {saving ? fr.changes.saving : fr.changes.save}
        </Button>
      </div>
      {files?.current.content != null && (
        <CodeEditor
          key={`${files.current.hash}:${version}`}
          initial={files.current.content}
          original={files.original.content ?? ""}
          path={path}
          layout={layout}
          label={path}
          wrap={wrap}
          onChange={setDraft}
          onSave={save}
        />
      )}
    </div>
  );
}
