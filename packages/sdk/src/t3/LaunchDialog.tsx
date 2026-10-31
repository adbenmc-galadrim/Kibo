import { KiboError, type T3Preview } from "@kibo/schema";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { emitToast } from "../toast-bus";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { frT3 as t } from "./fr-t3";
import { ThreadOpenLink } from "./ThreadBadge";
import { useT3 } from "./t3-context";

type ActiveThread = { link: string };
type Props = { projectId: string; ticketKey: string; onClose(): void };

const messageOf = (e: unknown): string => (e instanceof KiboError ? e.detail : String(e));
const ROW = "flex items-center gap-2.5 text-[12.5px]";
const LABEL = "w-[90px] shrink-0 text-muted-foreground";

function useLaunch({ projectId, ticketKey, onClose }: Props) {
  const { api } = useT3(projectId);
  const [preview, setPreview] = useState<T3Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveThread | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    let alive = true;
    api.preview(ticketKey).then(
      (next) => {
        if (alive) setPreview(next);
      },
      (e: unknown) => {
        if (alive) setError(messageOf(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [api, ticketKey]);
  const activeLink = async (): Promise<ActiveThread> => {
    try {
      return { link: (await api.threadOf(ticketKey))?.link ?? "" };
    } catch (e) {
      console.warn("[kibo] t3.threadOf failed", e);
      return { link: "" };
    }
  };
  const launch = async () => {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    try {
      await api.launch(ticketKey);
      onClose();
    } catch (e) {
      if (e instanceof KiboError && e.code === "T3_THREAD_ACTIVE") setActive(await activeLink());
      else emitToast(t.failed(ticketKey, messageOf(e)));
      started.current = false;
      setBusy(false);
    }
  };
  return { preview, error, active, busy, launch };
}

export function LaunchDialog(props: Props) {
  const { preview, error, active, busy, launch } = useLaunch(props);
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent
        showCloseButton={false}
        className="grid w-[520px] max-w-[520px] gap-3.5 rounded-xl p-5 sm:max-w-[520px]"
      >
        <DialogTitle className="text-base leading-5 font-semibold">
          {t.dialogTitle(props.ticketKey)}
        </DialogTitle>
        <DialogDescription className="text-[13px] leading-4 text-muted-foreground">
          {t.dialogHelp}
        </DialogDescription>
        {error && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        )}
        {preview && (
          <>
            <code className="block rounded-lg border bg-background px-3 py-2.5 font-mono text-xs leading-[15px] wrap-anywhere">
              {preview.command}
            </code>
            {preview.warning && (
              <p className="text-[12.5px] font-medium text-(--tracking-amber)">{preview.warning}</p>
            )}
            <p className={ROW}>
              <span className={LABEL}>{t.project}</span>
              <span className="min-w-0 font-mono wrap-anywhere">{preview.folder}</span>
            </p>
            <p className={ROW}>
              <span className={LABEL}>{t.model}</span>
              <span>{t.defaultModel}</span>
            </p>
          </>
        )}
        {active && !active.link && (
          <output className="block text-[12.5px] text-muted-foreground">{t.activeNoLink}</output>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-[25px] gap-1.5 px-2.5 text-xs [&_svg]:size-[13px]"
            onClick={props.onClose}
          >
            {t.cancel}
          </Button>
          {active?.link && <ThreadOpenLink link={active.link} />}
          {!active && (
            <Button
              size="sm"
              className="h-[25px] gap-1.5 px-2.5 text-xs [&_svg]:size-[13px]"
              disabled={busy || !preview}
              onClick={() => void launch()}
            >
              <Play aria-hidden />
              {t.confirm}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
