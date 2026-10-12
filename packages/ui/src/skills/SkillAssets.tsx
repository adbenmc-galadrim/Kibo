import { type Skill, type SkillAsset, SkillFilePath } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { FileImage, FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frSkills } from "../i18n/fr-skills";
import { errorMessage } from "../lib/error-message";
import { AddAssetDialog } from "./AddAssetDialog";
import { SKILL_FILE } from "./skill-file-text";
import { skillAddress } from "./skill-sections";

type Props = { skill: Skill; current: string; onPick(file: string): void };

const t = frSkills.assets;

function useAssets(skill: Skill): { assets: SkillAsset[]; failed: boolean } {
  const [assets, setAssets] = useState<SkillAsset[]>(skill.files);
  const [failed, setFailed] = useState(false);
  const { id, source, projectId } = skill;
  const plugin = skill.plugin?.name ?? null;
  useEffect(() => {
    let alive = true;
    const address = skillAddress({
      id,
      source,
      projectId,
      plugin: plugin ? { name: plugin } : null,
    });
    const load = () =>
      client.rpc({ method: "skills.assets", ...address }).then(
        (list) => alive && setAssets(list),
        () => alive && setFailed(true),
      );
    void load();
    const off = client.subscribeTopic("skills", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [id, source, projectId, plugin]);
  return { assets, failed };
}

function FileRow({
  asset,
  active,
  removable,
  onPick,
  onRemove,
}: {
  asset: SkillAsset;
  active: boolean;
  removable: boolean;
  onPick(): void;
  onRemove(): void;
}) {
  const Icon = asset.text ? FileText : FileImage;
  const body = (
    <>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-mono">{asset.path}</span>
      {asset.size >= 0 && <span className="shrink-0 text-muted-foreground">{t.size(asset.size)}</span>}
    </>
  );
  return (
    <li className="group flex items-center gap-1">
      {asset.text ? (
        <button
          type="button"
          aria-current={active ? "true" : undefined}
          onClick={onPick}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
            active && "bg-accent",
          )}
        >
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          {body}
        </span>
      )}
      {removable && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 opacity-60 group-hover:opacity-100"
          aria-label={t.remove(asset.path)}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </li>
  );
}

export const isNewAssetPath = (path: string, assets: readonly SkillAsset[]): boolean =>
  SkillFilePath.safeParse(path).success && path !== SKILL_FILE && !assets.some((a) => a.path === path);

export function SkillAssets({ skill, current, onPick }: Props) {
  const { assets, failed } = useAssets(skill);
  const [adding, setAdding] = useState(false);
  const [doomed, setDoomed] = useState<string | null>(null);
  const address = skillAddress(skill);
  const writable = !skill.readOnly;
  const main: SkillAsset = { path: SKILL_FILE, size: -1, text: true };
  return (
    <section aria-label={t.title} className="grid content-start gap-2 rounded-lg border bg-card p-2">
      <h3 className="px-2 pt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {t.title}
      </h3>
      <ul className="grid gap-0.5">
        {[main, ...assets].map((asset) => (
          <FileRow
            key={asset.path}
            asset={asset}
            active={asset.path === current}
            removable={writable && asset.path !== SKILL_FILE}
            onPick={() => onPick(asset.path)}
            onRemove={() => setDoomed(asset.path)}
          />
        ))}
      </ul>
      {assets.some((a) => !a.text) && <p className="px-2 text-2xs text-muted-foreground">{t.binaryHelp}</p>}
      {failed && (
        <p role="alert" className="px-2 text-xs text-destructive">
          {t.failed}
        </p>
      )}
      {writable && (
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
          <Plus />
          {t.add}
        </Button>
      )}
      {adding && (
        <AddAssetDialog
          valid={(path) => isNewAssetPath(path, assets)}
          exists={(path) => path === SKILL_FILE || assets.some((a) => a.path === path)}
          onClose={() => setAdding(false)}
          onAdd={async (file) => {
            const result = await client.rpc({
              method: "skills.save",
              ...address,
              file,
              content: "",
              baseHash: null,
            });
            if (!result.ok) throw new Error(t.exists);
            setAdding(false);
            onPick(file);
          }}
        />
      )}
      <ConfirmDialog
        open={doomed !== null}
        onOpenChange={(o) => !o && setDoomed(null)}
        title={t.removeTitle(doomed ?? "")}
        description={t.removeHelp}
        confirmLabel={fr.common.delete}
        cancelLabel={fr.common.cancel}
        onConfirm={async () => {
          if (doomed === null) return;
          await client.rpc({ method: "skills.removeAsset", ...address, file: doomed });
          if (doomed === current) onPick(SKILL_FILE);
          setDoomed(null);
        }}
        describeError={errorMessage}
      />
    </section>
  );
}
