import { type DesignFrame, externalRefKey, KiboError, parseDesignUrl, type TicketView } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { frDesign } from "../../i18n/fr-design";
import { failureText } from "../../lib/remote-error";
import { type DesignRef, designRefs, refProvider } from "./design-refs";

const t = frDesign.sheet;

type Thumb =
  | { state: "loading" }
  | { state: "ready"; frame: DesignFrame }
  | { state: "failed"; text: string };

function frameError(e: unknown, kind: DesignRef["kind"]): string {
  if (e instanceof KiboError && e.code === "NOT_CONNECTED") return t.notConnected;
  if (e instanceof KiboError && e.code === "REMOTE_NOT_FOUND" && kind === "penpot_board")
    return t.noThumbnail;
  return t.unavailable;
}

function linkError(e: unknown): string {
  if (e instanceof KiboError && e.code === "INVALID_INPUT") return t.invalid;
  if (e instanceof KiboError && e.code === "NOT_CONNECTED") return t.notConnected;
  if (e instanceof KiboError && e.code === "MCP_UNAVAILABLE") return frDesign.connect.figma.unreachable.title;
  return failureText(e);
}

function useFrame(url: string, kind: DesignRef["kind"], refreshes: number): Thumb {
  const [thumb, setThumb] = useState<Thumb>({ state: "loading" });
  useEffect(() => {
    let live = true;
    setThumb({ state: "loading" });
    client
      .rpc({ method: "getDesignFrame", url, refresh: refreshes > 0 })
      .then((frame) => live && setThumb({ state: "ready", frame }))
      .catch((e: unknown) => live && setThumb({ state: "failed", text: frameError(e, kind) }));
    return () => {
      live = false;
    };
  }, [url, kind, refreshes]);
  return thumb;
}

const warning = "border-amber-500/50 text-amber-700 dark:text-amber-400";

function Thumbnail({ thumb, name }: { thumb: Thumb; name: string }) {
  if (thumb.state === "failed") return <p className="p-3 text-center text-muted-foreground">{thumb.text}</p>;
  if (thumb.state === "loading") return <Skeleton className="size-full rounded-none" />;
  const { frame } = thumb;
  return (
    <>
      <img src={frame.url} alt={name} crossOrigin="anonymous" className="size-full object-contain" />
      {(frame.stale || !frame.reachable) && (
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          {frame.stale && (
            <Badge variant="outline" className={`bg-background ${warning}`}>
              {frDesign.badges.stale}
            </Badge>
          )}
          {!frame.reachable && (
            <Badge variant="outline" className="bg-background">
              {frDesign.badges.offline}
            </Badge>
          )}
        </div>
      )}
    </>
  );
}

function LinkedFrame({
  projectId,
  ticketId,
  node,
}: {
  projectId: string;
  ticketId: string;
  node: DesignRef;
}) {
  const [refreshes, setRefreshes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const thumb = useFrame(node.url, node.kind, refreshes);
  const unlink = async () => {
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "removeExternalRef", ticketId, kind: node.kind, key: externalRefKey(node) },
      });
    } catch (e) {
      setError(failureText(e));
    }
  };
  return (
    <li className="grid gap-1.5">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-muted">
        <Thumbnail thumb={thumb} name={node.name} />
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate font-medium">{node.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7 shrink-0"
          aria-label={t.refresh}
          title={t.refresh}
          disabled={thumb.state === "loading"}
          onClick={() => setRefreshes((n) => n + 1)}
        >
          <RefreshCw aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" asChild>
          <a href={node.url} target="_blank" rel="noreferrer noopener">
            {t.open(refProvider(node))}
          </a>
        </Button>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => void unlink()}>
          {t.unlink}
        </Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
    </li>
  );
}

export function DesignSection({ projectId, ticket }: { projectId: string; ticket: TicketView }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nodes = designRefs(ticket);
  const link = async () => {
    if (parseDesignUrl(url) === null) {
      setError(t.invalid);
      return;
    }
    try {
      await client.rpc({ method: "linkDesignFrame", projectId, ticketId: ticket.id, url: url.trim() });
      setUrl("");
      setError(null);
    } catch (e) {
      setError(linkError(e));
    }
  };
  return (
    <section className="grid gap-2 px-4 pb-4 text-xs">
      <h3 className="font-medium">{t.mockups}</h3>
      {nodes.length > 0 && (
        <ul className="grid gap-3">
          {nodes.map((n) => (
            <LinkedFrame
              key={`${n.kind}:${externalRefKey(n)}`}
              projectId={projectId}
              ticketId={ticket.id}
              node={n}
            />
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void link();
        }}
      >
        <Input
          aria-label={t.link}
          placeholder={t.placeholder}
          value={url}
          spellCheck={false}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          aria-invalid={error !== null}
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" disabled={url.trim() === ""}>
          {t.link}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
