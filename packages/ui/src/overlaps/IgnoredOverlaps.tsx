import type { Actor, OverlapIgnore, OverlapKind } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Braces, Copy, FileText, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { frOverlaps } from "../i18n/fr-overlaps";

type Props = { projectId: string; disabled: boolean; labelledBy: string; describedBy: string };

const t = frOverlaps.settings;
const ICONS: Record<OverlapKind, LucideIcon> = { file: FileText, export: Braces, block: Copy };
const actorName = (by: Actor) => by.ref.charAt(0).toUpperCase() + by.ref.slice(1);

export function IgnoredOverlaps({ projectId, disabled, labelledBy, describedBy }: Props) {
  const [items, setItems] = useState<OverlapIgnore[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(
    () =>
      client.rpc({ method: "overlaps.ignored", projectId }).then(
        (list) => {
          setItems(list);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [projectId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const reactivate = async (item: OverlapIgnore) => {
    try {
      await client.rpc({ method: "overlaps.reactivate", projectId, kind: item.kind, key: item.key });
      await load();
    } catch {
      setFailed(true);
    }
  };
  if (failed) return <p className="text-xs text-destructive">{t.failed}</p>;
  if (items === null) return null;
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{t.none}</p>;
  return (
    <ul aria-labelledby={labelledBy} aria-describedby={describedBy} className="grid rounded-md border">
      {items.map((item) => {
        const Icon = ICONS[item.kind];
        return (
          <li
            key={`${item.kind}:${item.key}`}
            className="flex items-center gap-2 border-b px-3 py-2 text-xs last:border-b-0"
          >
            <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono">{item.label}</span>
            <Badge variant="outline" className="text-3xs font-normal text-muted-foreground">
              {t.kinds[item.kind]}
            </Badge>
            <span className="shrink-0 text-muted-foreground">{t.ignoredBy(item.at, actorName(item.by))}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7"
              disabled={disabled}
              aria-label={t.reactivateLabel(item.label)}
              onClick={() => void reactivate(item)}
            >
              {t.reactivate}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
