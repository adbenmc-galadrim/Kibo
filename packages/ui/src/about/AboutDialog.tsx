import type { AppInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { frAbout as t } from "../i18n/fr-about";
import { LICENSE_URL, SOURCE_URL } from "../lib/kibo-links";
import { KiboLogo } from "../shell/KiboLogo";
import { inTauri } from "../shell/workspace-actions";
import { type AboutInfo, aboutText, systemLine, uptimeLabel } from "./about-text";

type Props = {
  open: boolean;
  info: AppInfo | null;
  port: number | null;
  shell?: AboutInfo["shell"];
  onClose(): void;
  onReleaseNotes(): void;
};

type CopyState = "idle" | "copied" | "failed";

function Details({ info, port }: { info: AboutInfo; port: number | null }) {
  return (
    <div className="grid min-w-0 gap-1 text-sm [overflow-wrap:anywhere]">
      <p className="font-medium">{t.version(info.version)}</p>
      <p className="text-muted-foreground">{systemLine(info)}</p>
      <p className="text-muted-foreground">{t.daemon(info.daemonPid, port, info.home)}</p>
      <p className="text-muted-foreground">{t.uptime(uptimeLabel(info.uptimeMs))}</p>
    </div>
  );
}

const linkClass = "text-sm underline underline-offset-2 hover:text-foreground";

export function AboutDialog({ open, info, port, shell = inTauri() ? "tauri" : "browser", ...p }: Props) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const about = info ? { ...info, shell } : null;
  const copyInfo = async () => {
    if (!about) return;
    try {
      await navigator.clipboard.writeText(aboutText(about, port));
      setCopy("copied");
    } catch (e) {
      console.error("clipboard write refused", e);
      setCopy("failed");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader className="items-center text-center sm:text-center">
          <KiboLogo className="size-14" />
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        {about ? (
          <Details info={about} port={port} />
        ) : (
          <p role="alert" className="text-sm text-muted-foreground">
            {t.unavailable}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <button type="button" className={linkClass} onClick={p.onReleaseNotes}>
            {t.releaseNotes}
          </button>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className={linkClass}>
            {t.source}
          </a>
          <a href={LICENSE_URL} target="_blank" rel="noreferrer" className={linkClass}>
            {t.license}
          </a>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={!about} onClick={() => void copyInfo()}>
            {copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copy === "copied" ? t.copied : copy === "failed" ? t.copyFailed : t.copy}
          </Button>
          <Button onClick={p.onClose}>{t.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
