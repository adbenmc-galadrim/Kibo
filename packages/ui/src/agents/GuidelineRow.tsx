import { Button } from "@kibo/sdk/ui/button";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { FileText, X } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";

export type GuidelineDraft = { id: string; path: string; content: string };

type Props = {
  guideline: GuidelineDraft;
  onSave: (content: string) => Promise<boolean>;
  onRemove: () => void;
};

export function GuidelineRow({ guideline, onSave, onRemove }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(guideline.content);

  const toggle = () => {
    setContent(guideline.content);
    setOpen((o) => !o);
  };

  const save = async () => {
    if (await onSave(content)) setOpen(false);
  };

  return (
    <li className="grid rounded-md border text-sm">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <FileText aria-hidden className="size-4 text-muted-foreground" />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-editor`}
          className="flex-1 truncate text-left hover:underline"
          onClick={toggle}
        >
          {guideline.path}
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6"
          aria-label={fr.profile.removeGuideline(guideline.path)}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {open && (
        <div id={`${id}-editor`} className="grid gap-2 border-t p-2.5">
          <Label htmlFor={`${id}-content`} className="sr-only">
            {fr.profile.guidelineContent}
          </Label>
          <Textarea
            id={`${id}-content`}
            value={content}
            rows={6}
            className="resize-none border-0 bg-muted/50 font-mono text-xs shadow-none md:text-xs dark:bg-muted/30"
            onChange={(e) => setContent(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit justify-self-end"
            aria-label={fr.profile.saveGuideline(guideline.path)}
            onClick={() => void save()}
          >
            {fr.profile.save}
          </Button>
        </div>
      )}
    </li>
  );
}
