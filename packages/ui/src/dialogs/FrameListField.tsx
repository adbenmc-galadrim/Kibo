import { designUrlProblem, FRAME_LIST_MAX } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { frDesign } from "../i18n/fr-design";
import { frWidgets } from "../i18n/fr-widgets";

type Props = {
  id: string;
  label: string;
  value: string[];
  disabled: boolean;
  onChange(next: string[]): void;
};
type RowProps = {
  index: number;
  url: string;
  count: number;
  disabled: boolean;
  onEdit(url: string): void;
  onMove(to: number): void;
  onRemove(): void;
};

const t = frWidgets.frames;

const problemText = (url: string): string | null => {
  const problem = url.trim() === "" ? null : designUrlProblem(url);
  return problem ? frDesign.urlProblems[problem] : null;
};

export const frameListProblem = (value: unknown): string | null => {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const text = typeof item === "string" ? problemText(item) : null;
    if (text) return text;
  }
  return null;
};

const moved = <T,>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
};

function FrameRow({ index, url, count, disabled, onEdit, onMove, onRemove }: RowProps) {
  const problem = problemText(url);
  const n = index + 1;
  return (
    <li className="grid gap-1">
      <div className="flex items-center gap-1">
        <Input
          aria-label={t.item(n)}
          type="url"
          spellCheck={false}
          placeholder={frDesign.field.placeholder}
          value={url}
          disabled={disabled}
          aria-invalid={problem !== null}
          onChange={(e) => onEdit(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t.up(n)}
          title={t.up(n)}
          disabled={disabled || index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t.down(n)}
          title={t.down(n)}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t.remove(n)}
          title={t.remove(n)}
          disabled={disabled}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </li>
  );
}

export function FrameListField({ id, label, value, disabled, onChange }: Props) {
  const [ids, setIds] = useState<string[]>(() => value.map(() => crypto.randomUUID()));
  const rowIds = ids.length === value.length ? ids : value.map((_, i) => ids[i] ?? crypto.randomUUID());
  const update = (nextValue: string[], nextIds: string[]) => {
    setIds(nextIds);
    onChange(nextValue);
  };
  return (
    <fieldset id={id} aria-label={label} className="m-0 grid min-w-0 flex-1 gap-2 border-0 p-0">
      {value.length === 0 && <p className="text-xs text-muted-foreground">{t.empty}</p>}
      {value.length > 0 && (
        <ol className="grid gap-2">
          {value.map((url, i) => (
            <FrameRow
              key={rowIds[i]}
              index={i}
              url={url}
              count={value.length}
              disabled={disabled}
              onEdit={(next) => onChange(value.map((v, j) => (j === i ? next : v)))}
              onMove={(to) => update(moved(value, i, to), moved(rowIds, i, to))}
              onRemove={() =>
                update(
                  value.filter((_, j) => j !== i),
                  rowIds.filter((_, j) => j !== i),
                )
              }
            />
          ))}
        </ol>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={disabled || value.length >= FRAME_LIST_MAX}
        onClick={() => update([...value, ""], [...rowIds, crypto.randomUUID()])}
      >
        <Plus />
        {t.add}
      </Button>
    </fieldset>
  );
}
