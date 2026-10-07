import { Badge } from "@kibo/sdk/ui/badge";

type Props = { labels: readonly string[]; max?: number };

export function LabelChips({ labels, max = 2 }: Props) {
  if (labels.length === 0) return null;
  const shown = labels.slice(0, max);
  const rest = labels.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((l) => (
        <Badge key={l} variant="outline" className="px-1 font-mono text-3xs">
          {l}
        </Badge>
      ))}
      {rest > 0 && <span className="text-3xs text-muted-foreground">+{rest}</span>}
    </div>
  );
}
