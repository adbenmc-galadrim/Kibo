import type { McpToolInfo } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useId } from "react";
import { fr } from "../../i18n/fr";
import type { McpSourceDraft, SourceMode } from "./mcp-source-draft";

type Props = { draft: McpSourceDraft; tools: McpToolInfo[]; onChange(next: McpSourceDraft): void };
const t = fr.integrations.mcpSource;

function ModeOption({ value, label }: { value: SourceMode; label: string }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem id={id} value={value} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

export function TargetFields({ draft, tools, onChange }: Props) {
  const ids = { mode: useId(), target: useId() };
  const toolField =
    tools.length > 0 ? (
      <Select value={draft.tool} onValueChange={(tool) => onChange({ ...draft, tool })}>
        <SelectTrigger id={ids.target} className="w-full font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {tools.map((tool) => (
            <SelectItem key={tool.name} value={tool.name} className="font-mono">
              {tool.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <Input
        id={ids.target}
        className="font-mono"
        value={draft.tool}
        onChange={(e) => onChange({ ...draft, tool: e.target.value })}
      />
    );
  return (
    <>
      <div className="grid gap-2">
        <p id={ids.mode} className="text-sm font-medium">
          {t.mode}
        </p>
        <RadioGroup
          aria-labelledby={ids.mode}
          value={draft.mode}
          onValueChange={(v) => onChange({ ...draft, mode: v === "resource" ? "resource" : "tool" })}
          className="flex gap-4"
        >
          <ModeOption value="tool" label={t.tool} />
          <ModeOption value="resource" label={t.resource} />
        </RadioGroup>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={ids.target}>{draft.mode === "tool" ? t.tool : t.uri}</Label>
        {draft.mode === "tool" ? (
          toolField
        ) : (
          <Input
            id={ids.target}
            className="font-mono"
            value={draft.uri}
            onChange={(e) => onChange({ ...draft, uri: e.target.value })}
          />
        )}
      </div>
    </>
  );
}
