import {
  type DesignFrame,
  type DesignFrameKey,
  KiboError,
  parseDesignUrl,
  type TicketView,
} from "@kibo/schema";
import { useEntities, useSdk } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fr } from "./fr";
import { linkedTickets } from "./linked-tickets";

type Problem = "loading" | "empty" | "notConnected" | "noThumbnail" | "failed";
type FrameView = { status: "ready"; frame: DesignFrame } | { status: Problem };
type Fit = "contain" | "width";

function problemOf(e: unknown, key: DesignFrameKey): Problem {
  if (!(e instanceof KiboError)) return "failed";
  if (e.code === "NOT_CONNECTED") return "notConnected";
  if (e.code === "REMOTE_NOT_FOUND" && key.provider === "penpot") return "noThumbnail";
  return "failed";
}

function useFrame(url: string | null, key: DesignFrameKey | null, refreshCount: number): FrameView {
  const sdk = useSdk();
  const [view, setView] = useState<FrameView>({ status: url ? "loading" : "empty" });
  useEffect(() => {
    if (!url || !key) {
      setView({ status: url ? "failed" : "empty" });
      return;
    }
    if (refreshCount === 0) setView({ status: "loading" });
    let alive = true;
    sdk.design.frame(url, { refresh: refreshCount > 0 }).then(
      (frame) => {
        if (alive) setView({ status: "ready", frame });
      },
      (e: unknown) => {
        if (!alive) return;
        const status = problemOf(e, key);
        if (status === "failed") console.error("[mockup] frame not loaded", e);
        setView({ status });
      },
    );
    return () => {
      alive = false;
    };
  }, [sdk, url, key, refreshCount]);
  return view;
}

function Message({ text, alert = false }: { text: string; alert?: boolean }) {
  return (
    <p role={alert ? "alert" : "status"} className="m-auto p-4 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

const MESSAGES: Record<Exclude<Problem, "failed">, string> = {
  loading: fr.loading,
  empty: fr.empty,
  notConnected: fr.notConnected,
  noThumbnail: fr.noThumbnail,
};

function FrameHeader({ frame, onRefresh }: { frame: DesignFrame; onRefresh: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-3 pt-2 pb-1">
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{frame.name}</p>
      <Badge variant="secondary">{fr.provider[frame.provider]}</Badge>
      {frame.stale && <Badge variant="outline">{fr.stale}</Badge>}
      {!frame.reachable && <Badge variant="outline">{fr.offline}</Badge>}
      <Button variant="ghost" size="icon-xs" aria-label={fr.refresh} title={fr.refresh} onClick={onRefresh}>
        <RefreshCw />
      </Button>
      <Button variant="ghost" size="icon-xs" asChild>
        <a
          href={frame.source}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={fr.open(frame.provider)}
          title={fr.open(frame.provider)}
        >
          <ExternalLink />
        </a>
      </Button>
    </div>
  );
}

function FrameImage({ frame, fit }: { frame: DesignFrame; fit: Fit }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-3">
      <img
        src={frame.url}
        alt={frame.name}
        crossOrigin="anonymous"
        className={fit === "contain" ? "size-full object-contain" : "h-auto w-full"}
      />
    </div>
  );
}

function LinkedTickets({ tickets }: { tickets: TicketView[] }) {
  const sdk = useSdk();
  return (
    <section aria-label={fr.linked} className="max-h-24 shrink-0 overflow-auto border-t px-3 py-2">
      <p className="mb-1 text-xs text-muted-foreground">{fr.linked}</p>
      {tickets.length === 0 ? (
        <p className="text-xs text-muted-foreground">{fr.noLinked}</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {tickets.map((t) => (
            <Button
              key={t.id}
              variant="outline"
              size="xs"
              className="max-w-full"
              onClick={() => sdk.openTicket(t.id)}
            >
              <span className="truncate">{fr.ticket(t.keyLabel, t.title)}</span>
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

function configuredUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function FramePanel({
  url,
  frameKey,
  fit,
}: {
  url: string | null;
  frameKey: DesignFrameKey | null;
  fit: Fit;
}) {
  const [refreshCount, setRefreshCount] = useState(0);
  const view = useFrame(url, frameKey, refreshCount);
  if (view.status === "ready") {
    return (
      <>
        <FrameHeader frame={view.frame} onRefresh={() => setRefreshCount((n) => n + 1)} />
        <FrameImage frame={view.frame} fit={fit} />
      </>
    );
  }
  if (view.status === "failed") return <Message text={fr.failed} alert />;
  return <Message text={MESSAGES[view.status]} />;
}

export function Mockup() {
  const sdk = useSdk();
  const url = configuredUrl(sdk.config.frame);
  const fit: Fit = sdk.config.fit === "width" ? "width" : "contain";
  const key = useMemo(() => (url ? (parseDesignUrl(url)?.key ?? null) : null), [url]);
  const { data: tickets } = useEntities("ticket");
  const linked = useMemo(() => (key ? linkedTickets(tickets, key) : []), [tickets, key]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <FramePanel key={url ?? ""} url={url} frameKey={key} fit={fit} />
      {key && <LinkedTickets tickets={linked} />}
    </div>
  );
}
