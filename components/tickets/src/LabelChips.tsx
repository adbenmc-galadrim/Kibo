import { Badge } from "@kibo/sdk/ui/badge";

export function LabelChips({ labels }: { labels: readonly string[] }) {
  if (labels.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {labels.map((l) => (
        <Badge key={l} variant="outline" className="px-1 font-mono text-3xs">
          {l}
        </Badge>
      ))}
    </span>
  );
}
