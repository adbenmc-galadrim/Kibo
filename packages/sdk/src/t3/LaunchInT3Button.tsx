import { isActiveT3Status, type T3Thread } from "@kibo/schema";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { frT3 as t } from "./fr-t3";
import { LaunchDialog } from "./LaunchDialog";
import { ThreadBadge } from "./ThreadBadge";
import { useT3 } from "./t3-context";
import { useT3Status } from "./use-t3-status";

export type LaunchInT3Props = {
  projectId: string;
  ticketKey: string;
  done: boolean;
  thread: T3Thread | null;
  folderMissing?: boolean;
  size?: "sm" | "default";
  variant?: "primary" | "inline";
};

const BADGE_REFRESH_MS = 60_000;
const SIZES = { sm: "h-[25px] text-xs", default: "" };

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), BADGE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function LaunchInT3Button({
  projectId,
  ticketKey,
  done,
  thread,
  folderMissing = false,
  size = "sm",
  variant = "primary",
}: LaunchInT3Props) {
  const { api, linkFolder } = useT3(projectId);
  const status = useT3Status(api.status);
  const now = useMinuteClock();
  const [confirming, setConfirming] = useState(false);
  if (thread && isActiveT3Status(thread.status)) return <ThreadBadge thread={thread} now={now} />;
  if (done) return null;
  const look = {
    variant: variant === "inline" ? "outline" : "default",
    size: "sm",
    className: SIZES[size],
  } as const;
  if (folderMissing)
    return (
      <Button
        {...look}
        aria-disabled
        title={t.noFolder}
        className={`${SIZES[size]} opacity-50`}
        onClick={linkFolder}
      >
        <Play aria-hidden />
        {t.launch}
      </Button>
    );
  if (status && !status.available)
    return (
      <span title={status.reason === "missing" ? t.missing : t.serverDown} className="inline-flex">
        <Button {...look} disabled>
          <Play aria-hidden />
          {t.launch}
        </Button>
      </span>
    );
  return (
    <>
      <Button {...look} onClick={() => setConfirming(true)}>
        <Play aria-hidden />
        {t.launch}
      </Button>
      {confirming && (
        <LaunchDialog projectId={projectId} ticketKey={ticketKey} onClose={() => setConfirming(false)} />
      )}
    </>
  );
}
