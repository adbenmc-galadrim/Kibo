import type { Guideline } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { FileText, Plus } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { fr } from "../i18n/fr";

type Props = {
  title: string;
  files: Guideline[];
  selectedId: string | null;
  canAdd: boolean;
  onSelect: (id: string) => void;
  onAdd: (path: string) => Promise<boolean>;
};

export function GuidelineFiles({ title, files, selectedId, canAdd, onSelect, onAdd }: Props) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [path, setPath] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await onAdd(path.trim())) {
      setPath("");
      setAdding(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <ul aria-label={title} className="flex flex-wrap gap-2">
          {files.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                aria-pressed={g.id === selectedId}
                onClick={() => onSelect(g.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-2xs underline underline-offset-2",
                  g.id === selectedId && "bg-accent",
                )}
              >
                <FileText aria-hidden className="size-3.5" />
                {g.path}
              </button>
            </li>
          ))}
        </ul>
        <Button
          size="icon"
          variant="outline"
          className="size-7"
          aria-label={fr.domains.addFile}
          disabled={!canAdd}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      {adding && (
        <form onSubmit={submit} className="flex items-center gap-2 px-4 pt-3">
          <label htmlFor={id} className="sr-only">
            {fr.domains.filePath}
          </label>
          <Input
            id={id}
            value={path}
            placeholder={fr.domains.filePlaceholder}
            className="font-mono text-xs"
            onChange={(e) => setPath(e.target.value)}
            autoFocus
          />
          <Button type="submit" size="sm" disabled={!path.trim()}>
            {fr.domains.add}
          </Button>
        </form>
      )}
    </>
  );
}
