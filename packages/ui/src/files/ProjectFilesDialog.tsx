import { KiboError, type ProjectAsset } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { FolderOpen, Upload } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { client } from "../api";
import { frFiles as t } from "../i18n/fr-files";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { FilesDirDialog } from "./FilesDirDialog";
import { FilesBody } from "./FilesList";
import { SendingList } from "./SendingList";
import { useImport, useProjectFiles } from "./use-project-files";

type Props = { projectId: string; onClose(): void };

const ACCEPT = ".glb,.png,.jpg,.jpeg,.webp,.gif,.mp3,.ogg,.wav";

export function ProjectFilesDialog({ projectId, onClose }: Props) {
  const { assets, info, failed, reload } = useProjectFiles(projectId);
  const { sending, problems, importFiles, markShown } = useImport(projectId, reload);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [doomed, setDoomed] = useState<ProjectAsset | null>(null);
  const [changingDir, setChangingDir] = useState(false);
  const onDrop = (e: DragEvent<HTMLFieldSetElement>) => {
    e.preventDefault();
    setDragging(false);
    void importFiles(Array.from(e.dataTransfer.files));
  };
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.help}</DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 truncate text-xs text-muted-foreground" title={info?.displayDir}>
              {info ? t.folder(info.displayDir, info.used) : t.folderLoading}
            </p>
            <Button variant="outline" size="sm" onClick={() => setChangingDir(true)}>
              <FolderOpen aria-hidden className="size-4" />
              {t.change}
            </Button>
          </div>
          <fieldset
            aria-label={t.drop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3 transition-colors",
              dragging && "border-foreground/60 bg-muted/60",
            )}
          >
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t.drop}</p>
            <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
              <Upload aria-hidden className="size-4" />
              {t.import}
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT}
              tabIndex={-1}
              aria-label={t.pick}
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.currentTarget.files ?? []);
                e.currentTarget.value = "";
                void importFiles(files);
              }}
            />
          </fieldset>
          <SendingList sending={sending} onShown={markShown} />
          {problems.map((p) => (
            <p key={p} role="alert" className="text-sm text-destructive">
              {p}
            </p>
          ))}
          <div className="max-h-80 min-h-0 overflow-auto">
            <FilesBody assets={assets} failed={failed} onRemove={setDoomed} />
          </div>
        </DialogContent>
      </Dialog>
      {doomed && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDoomed(null)}
          title={t.removeTitle(doomed.name)}
          description={t.removeHelp}
          confirmLabel={t.remove}
          cancelLabel={t.cancel}
          onConfirm={async () => {
            await client.rpc({ method: "removeAsset", projectId, name: doomed.name });
            await reload();
          }}
          describeError={(e) => {
            if (!(e instanceof KiboError)) console.error(e);
            return t.removeFailed;
          }}
        />
      )}
      {changingDir && (
        <FilesDirDialog
          projectId={projectId}
          onClose={() => setChangingDir(false)}
          onSaved={() => void reload()}
        />
      )}
    </>
  );
}
