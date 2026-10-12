import type { OverlapRpcResult, OverlapSide } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { useEffect, useState } from "react";
import { client } from "../api";
import { CodeEditor } from "../files/CodeEditor";
import { frOverlaps } from "../i18n/fr-overlaps";

export type OverlapFilesDialogProps = { overlapId: string; onClose(): void };

type Read = OverlapRpcResult["overlaps.read"];
type Loaded = { status: "loading" } | { status: "failed" } | { status: "ready"; read: Read };

export const WIDE_FILES_QUERY = "(min-width: 1100px)";

const t = frOverlaps.files;
const noop = () => {};

const isWide = (): boolean =>
  typeof window.matchMedia !== "function" || window.matchMedia(WIDE_FILES_QUERY).matches;

function useOverlapRead(overlapId: string): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setLoaded({ status: "loading" });
    client.rpc({ method: "overlaps.read", id: overlapId }).then(
      (read) => alive && setLoaded({ status: "ready", read }),
      () => alive && setLoaded({ status: "failed" }),
    );
    return () => {
      alive = false;
    };
  }, [overlapId]);
  return loaded;
}

function SideHeading({ side }: { side: OverlapSide }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <p className="truncate font-mono font-medium">{t.heading(side.runName, side.path)}</p>
      {side.content === null && (
        <p className="text-muted-foreground" title={side.reason ?? undefined}>
          {t.missing}
        </p>
      )}
    </div>
  );
}

function Files({ read }: { read: Read }) {
  const layout = isWide() ? "split" : "unified";
  return (
    <>
      <div className={layout === "split" ? "grid grid-cols-2 gap-3 text-xs" : "grid gap-1 text-xs"}>
        <SideHeading side={read.owner} />
        <SideHeading side={read.other} />
      </div>
      <div className="flex h-[28rem] min-h-0 flex-col overflow-hidden rounded-lg border">
        <CodeEditor
          initial={read.other.content ?? ""}
          original={read.owner.content ?? ""}
          path={read.other.path}
          layout={layout}
          label={t.title}
          wrap
          readOnly
          onChange={noop}
          onSave={noop}
        />
      </div>
    </>
  );
}

export function OverlapFilesDialog({ overlapId, onClose }: OverlapFilesDialogProps) {
  const loaded = useOverlapRead(overlapId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-[min(1100px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        {loaded.status === "loading" && <p className="text-sm text-muted-foreground">{t.loading}</p>}
        {loaded.status === "failed" && (
          <p role="alert" className="text-sm text-destructive">
            {t.failed}
          </p>
        )}
        {loaded.status === "ready" && <Files read={loaded.read} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
