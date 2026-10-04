import { isInbox, type ProjectAsset, type ProjectAssetKind } from "@kibo/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useEffect, useState } from "react";
import { client } from "../api";
import { frWidgets as t } from "../i18n/fr-widgets";

type Props = {
  id: string;
  projectId: string;
  kind: ProjectAssetKind;
  value: string | null;
  nullable: boolean;
  disabled: boolean;
  onChange(value: string | null): void;
};

const NONE = "__none__";

function useProjectAssets(projectId: string, kind: ProjectAssetKind) {
  const [assets, setAssets] = useState<ProjectAsset[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (isInbox(projectId)) {
      setAssets([]);
      return;
    }
    let live = true;
    client.rpc({ method: "listAssets", projectId }).then(
      (list) => live && setAssets(list.filter((a) => a.kind === kind)),
      (e: unknown) => {
        console.error(e);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [projectId, kind]);
  return { assets, failed };
}

export function AssetField({ id, projectId, kind, value, nullable, disabled, onChange }: Props) {
  const { assets, failed } = useProjectAssets(projectId, kind);
  if (failed)
    return (
      <p role="alert" className="text-xs text-destructive">
        {t.assetsFailed}
      </p>
    );
  const options = assets ?? [];
  const chosen = value === "" ? null : value;
  const missing = assets !== null && chosen !== null && !options.some((a) => a.name === chosen);
  return (
    <Select
      value={chosen ?? (nullable ? NONE : "")}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || assets === null}
    >
      <SelectTrigger id={id} className="w-64">
        <SelectValue placeholder={assets === null ? t.assetLoading : t.assetChoose} />
      </SelectTrigger>
      <SelectContent>
        {nullable && <SelectItem value={NONE}>{t.assetNone}</SelectItem>}
        {missing && <SelectItem value={chosen}>{t.assetMissing(chosen)}</SelectItem>}
        {options.map((a) => (
          <SelectItem key={a.name} value={a.name}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
