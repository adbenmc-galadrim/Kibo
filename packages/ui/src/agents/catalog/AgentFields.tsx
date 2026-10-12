import { AgentModel, claudeCodePreview } from "@kibo/schema";
import { renderMarkdownLite } from "@kibo/sdk";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { SquareTerminal } from "lucide-react";
import { modelText } from "./agent-labels";

const INHERIT = "inherit";

export function ModelSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string | null;
  onChange(model: string | null): void;
  disabled?: boolean;
}) {
  const options = [
    INHERIT,
    ...AgentModel.options,
    ...(value && !AgentModel.safeParse(value).success ? [value] : []),
  ];
  return (
    <Select
      value={value ?? INHERIT}
      onValueChange={(v) => onChange(v === INHERIT ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((m) => (
          <SelectItem key={m} value={m}>
            {modelText(m === INHERIT ? null : m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ClaudeCodeLine({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <SquareTerminal aria-hidden className="size-3.5 shrink-0" />
      <div className="min-w-0 truncate [&_code]:text-foreground [&_p]:truncate">
        {renderMarkdownLite(claudeCodePreview(name, description.trim() || "…"))}
      </div>
    </div>
  );
}
