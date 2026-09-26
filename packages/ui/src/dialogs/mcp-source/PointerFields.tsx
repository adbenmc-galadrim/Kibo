import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useId } from "react";
import { fr } from "../../i18n/fr";
import { type McpSourceDraft, POINTER_KEYS, type PointerKey } from "./mcp-source-draft";

const t = fr.integrations.mcpSource;
const LABELS: Record<PointerKey, string> = {
  itemsPointer: t.items,
  idPointer: t.id,
  titlePointer: t.itemTitle,
  subtitlePointer: t.subtitle,
  urlPointer: t.url,
};

function PointerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
}) {
  const id = useId();
  return (
    <>
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Input id={id} className="font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
    </>
  );
}

type Props = { draft: McpSourceDraft; onChange(key: PointerKey, value: string): void };

export function PointerFields({ draft, onChange }: Props) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{t.mapping}</legend>
      <p className="text-xs text-muted-foreground">{t.pointerHelp}</p>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        {POINTER_KEYS.map((key) => (
          <PointerField key={key} label={LABELS[key]} value={draft[key]} onChange={(v) => onChange(key, v)} />
        ))}
      </div>
    </fieldset>
  );
}
