import { type FileVersion, type FileVersionKind, VERSIONS_PER_FILE } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { History, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../api";
import { CodeEditor } from "../files/CodeEditor";
import { frAgentsSkills } from "../i18n/fr-agents-skills";

type Props = {
  open: boolean;
  onClose(): void;
  title: string;
  kind: FileVersionKind;
  versionRef: string;
  file?: string;
  currentContent: string;
  currentHash: string | null;
  onRestore(id: string): Promise<boolean>;
};

type Layout = "split" | "unified";
type Picked = { version: FileVersion; content: string | null };

const t = frAgentsSkills.history;

export function versionWhen(at: number): string {
  const date = new Date(at);
  const day = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

function authorLine(v: FileVersion): string {
  const who = v.origin === "external" ? t.external : (v.by ?? "");
  return [who, v.note].filter((part) => part !== null && part !== "").join(" · ");
}

function VersionRow({
  v,
  current,
  active,
  onPick,
}: {
  v: FileVersion;
  current: boolean;
  active: boolean;
  onPick(): void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded-md px-2.5 py-2 text-left text-xs hover:bg-accent",
          active && "bg-accent",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[13px] font-medium">{versionWhen(v.at)}</span>
          <Badge variant="outline" className="text-[10px] font-normal">
            {t.origins[v.origin]}
          </Badge>
          {current && <Badge className="text-[10px]">{t.current}</Badge>}
        </span>
        <span />
        <span className="truncate text-muted-foreground">{authorLine(v)}</span>
        <span className="text-muted-foreground">{t.size(v.size)}</span>
      </button>
    </li>
  );
}

function DiffPane({
  picked,
  currentContent,
  onRestore,
}: {
  picked: Picked;
  currentContent: string;
  onRestore(): void;
}) {
  const [layout, setLayout] = useState<Layout>("unified");
  if (picked.content === null || picked.version.missing)
    return <p className="p-4 text-sm text-muted-foreground">{t.missing}</p>;
  return (
    <div className="grid min-w-0 content-start gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{t.compared(versionWhen(picked.version.at))}</p>
        <span className="flex-1" />
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={t.layout}
          value={layout}
          onValueChange={(v) => (v === "split" || v === "unified") && setLayout(v)}
        >
          <ToggleGroupItem value="split" className="px-2.5 text-xs">
            {t.split}
          </ToggleGroupItem>
          <ToggleGroupItem value="unified" className="px-2.5 text-xs">
            {t.unified}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex h-80 min-h-0 flex-col overflow-hidden rounded-lg border">
        <CodeEditor
          key={`${picked.version.id}-${layout}`}
          initial={currentContent}
          original={picked.content}
          path="version.md"
          layout={layout}
          label={t.compared(versionWhen(picked.version.at))}
          wrap
          readOnly
          onChange={() => {}}
          onSave={() => {}}
        />
      </div>
      <p className="text-2xs text-muted-foreground">{t.help}</p>
      <Button size="sm" className="w-fit justify-self-end" onClick={onRestore}>
        <RotateCcw />
        {t.restore}
      </Button>
    </div>
  );
}

export function VersionHistory({
  open,
  onClose,
  title,
  kind,
  versionRef,
  file,
  currentContent,
  currentHash,
  onRestore,
}: Props) {
  const [versions, setVersions] = useState<FileVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setFailed(false);
    client.rpc({ method: "fileVersions.list", kind, ref: versionRef, ...(file ? { file } : {}) }).then(
      (list) => alive && setVersions(list),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [open, kind, versionRef, file]);

  const pick = (v: FileVersion) => {
    client.rpc({ method: "fileVersions.read", id: v.id }).then(
      (r) => setPicked({ version: r.version, content: r.content }),
      () => setFailed(true),
    );
  };

  const restore = async (id: string) => {
    if (await onRestore(id)) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History aria-hidden className="size-4" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {versions ? t.subtitle(title, versions.length, VERSIONS_PER_FILE) : title}
          </DialogDescription>
        </DialogHeader>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t.failed}
          </p>
        )}
        {versions === null ? (
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
            <ul aria-label="Versions" className="grid max-h-96 content-start gap-0.5 overflow-auto">
              {versions.map((v) => (
                <VersionRow
                  key={v.id}
                  v={v}
                  current={v.hash === currentHash}
                  active={picked?.version.id === v.id}
                  onPick={() => pick(v)}
                />
              ))}
            </ul>
            {picked ? (
              <DiffPane
                picked={picked}
                currentContent={currentContent}
                onRestore={() => void restore(picked.version.id)}
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">{t.pick}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
