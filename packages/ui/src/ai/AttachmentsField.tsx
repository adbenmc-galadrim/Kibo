import type { DraftAttachmentInput } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { ImagePlus, X } from "lucide-react";
import { type DragEvent, type RefObject, useEffect, useId, useRef, useState } from "react";
import { frCreations } from "../i18n/fr-creations";
import {
  type AttachmentRefusal,
  addAttachment,
  attachmentBytes,
  imageFiles,
  readAttachment,
} from "./attachments";

export type AttachmentsFieldProps = {
  value: DraftAttachmentInput[];
  onChange(next: DraftAttachmentInput[]): void;
  disabled?: boolean;
  pasteFrom?: RefObject<HTMLElement | null>;
};

type Problem = AttachmentRefusal | "unreadable" | null;

const t = frCreations.attachments;
const problemText = (p: Exclude<Problem, null>): string =>
  p === "unreadable" ? t.readFailed : t.refusals[p];

async function appendFiles(
  list: DraftAttachmentInput[],
  files: File[],
): Promise<{ list: DraftAttachmentInput[]; problem: Problem }> {
  let next = list;
  let problem: Problem = null;
  for (const file of files) {
    const read = await readAttachment(file);
    const added = read.ok ? addAttachment(next, read.item) : read;
    if (added.ok) next = added.list;
    else problem = added.refusal;
    if (problem === "count") break;
  }
  return { list: next, problem };
}

function Thumbnail({ item, onRemove }: { item: DraftAttachmentInput; onRemove(): void }) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-md border bg-card p-1.5 pr-1">
      <img
        alt={item.name}
        src={`data:${item.mime};base64,${item.data}`}
        className="size-10 shrink-0 rounded-sm border object-cover"
      />
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
        {`${item.name} · ${t.size(attachmentBytes(item))}`}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={t.remove(item.name)}
        onClick={onRemove}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}

export function AttachmentsField({ value, onChange, disabled = false, pasteFrom }: AttachmentsFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [dragging, setDragging] = useState(false);

  const add = async (files: File[]) => {
    if (disabled || files.length === 0) return;
    try {
      const result = await appendFiles(value, files);
      onChange(result.list);
      setProblem(result.problem);
    } catch (e) {
      console.error(e);
      setProblem("unreadable");
    }
  };
  const addRef = useRef(add);
  addRef.current = add;

  useEffect(() => {
    const target = pasteFrom?.current;
    if (!target) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = imageFiles(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      void addRef.current(files);
    };
    target.addEventListener("paste", onPaste);
    return () => target.removeEventListener("paste", onPaste);
  }, [pasteFrom]);

  const onDrop = (e: DragEvent<HTMLFieldSetElement>) => {
    e.preventDefault();
    setDragging(false);
    void add(imageFiles(e.dataTransfer));
  };
  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    setProblem(null);
  };

  return (
    <div className="grid gap-1.5">
      <fieldset
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "grid min-w-0 gap-2 rounded-md border border-dashed p-3 transition-colors",
          dragging && "border-foreground/60 bg-muted/60",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id={`${id}-label`} className="text-xs font-medium">
            {t.label}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <ImagePlus aria-hidden className="size-4" />
            {t.choose}
          </Button>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            tabIndex={-1}
            aria-label={t.pick}
            disabled={disabled}
            className="sr-only"
            onChange={(e) => {
              const files = imageFiles(e.currentTarget);
              e.currentTarget.value = "";
              void add(files);
            }}
          />
        </div>
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {t.help}
        </p>
        {value.length > 0 && (
          <ul aria-label={t.list} className="grid gap-1.5">
            {value.map((item, i) => (
              <Thumbnail key={item.name} item={item} onRemove={() => remove(i)} />
            ))}
          </ul>
        )}
      </fieldset>
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problemText(problem)}
        </p>
      )}
    </div>
  );
}
