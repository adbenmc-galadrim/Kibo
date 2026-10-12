import { renderMarkdownLite } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import type { ReactNode } from "react";
import { CodeEditor } from "../files/CodeEditor";
import { frAgentsSkills } from "../i18n/fr-agents-skills";

export type PaneMode = "edit" | "preview" | "split";
const MODES: readonly PaneMode[] = ["edit", "preview", "split"];
const isMode = (v: string): v is PaneMode => MODES.some((m) => m === v);

type Props = {
  value: string;
  onChange(value: string): void;
  mode: PaneMode;
  onMode(mode: PaneMode): void;
  original?: string | null;
  readOnly?: boolean;
  label: string;
  title?: ReactNode;
  docKey?: string | number;
  path?: string;
  onSave?(): void;
  className?: string;
};

function Preview({ value }: { value: string }) {
  return (
    <div
      data-testid="markdown-preview"
      className="grid min-h-0 content-start gap-2 overflow-auto p-4 text-sm leading-relaxed"
    >
      {renderMarkdownLite(value)}
    </div>
  );
}

export function MarkdownPane({
  value,
  onChange,
  mode,
  onMode,
  original = null,
  readOnly = false,
  label,
  title,
  docKey,
  path = "SPEC.md",
  onSave = () => {},
  className,
}: Props) {
  const t = frAgentsSkills.modes;
  const editor = (
    <CodeEditor
      key={docKey}
      initial={value}
      original={original}
      path={path}
      layout={original === null ? "single" : "split"}
      label={label}
      wrap
      readOnly={readOnly}
      onChange={onChange}
      onSave={onSave}
    />
  );
  return (
    <section aria-label={label} className={cn("grid min-w-0 gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {title}
        <span className="flex-1" />
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={t.label}
          value={mode}
          onValueChange={(v) => isMode(v) && onMode(v)}
        >
          {MODES.map((m) => (
            <ToggleGroupItem key={m} value={m} className="px-2.5 text-xs">
              {t[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div
        className={cn(
          "grid h-[28rem] min-h-0 overflow-hidden rounded-lg border bg-background",
          mode === "split" && "grid-cols-2 divide-x",
        )}
      >
        {mode !== "preview" && <div className="flex min-h-0 min-w-0 flex-col">{editor}</div>}
        {mode !== "edit" && <Preview value={value} />}
      </div>
    </section>
  );
}
