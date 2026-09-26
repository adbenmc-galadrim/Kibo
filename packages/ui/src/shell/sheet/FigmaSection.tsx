import {
  externalRefKey,
  type FigmaNodeRef,
  type FigmaPreview,
  KiboError,
  type TicketView,
} from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { figmaRefs } from "./figma-refs";

const t = fr.integrations.sheet;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function linkError(e: unknown): string {
  if (e instanceof KiboError && e.code === "INVALID_INPUT") return t.figmaInvalid;
  if (e instanceof KiboError && e.code === "NOT_CONNECTED") return t.figmaNotConnected;
  if (e instanceof KiboError && e.code === "MCP_UNAVAILABLE") return fr.integrations.figma.unreachable;
  return message(e);
}

function PreviewBadge({ preview }: { preview: FigmaPreview | null }) {
  if (!preview) return null;
  if (!preview.reachable) return <Badge variant="secondary">{t.figmaUnreachable}</Badge>;
  if (!preview.available) return <Badge variant="secondary">{t.previewUnavailable}</Badge>;
  return null;
}

function Thumbnail({
  projectId,
  ticketId,
  node,
}: {
  projectId: string;
  ticketId: string;
  node: FigmaNodeRef;
}) {
  const [preview, setPreview] = useState<FigmaPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    client
      .rpc({ method: "getFigmaPreview", fileKey: node.fileKey, nodeId: node.nodeId })
      .then((p) => {
        if (live) setPreview(p);
      })
      .catch((e: unknown) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [node.fileKey, node.nodeId]);
  const unlink = async () => {
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "removeExternalRef", ticketId, kind: "figma_node", key: externalRefKey(node) },
      });
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <figure className="grid gap-1">
      <div className="relative aspect-[16/10] overflow-hidden rounded-md border bg-muted">
        {preview?.png && (
          <img
            src={`data:image/png;base64,${preview.png}`}
            alt={node.name}
            className="size-full object-cover"
          />
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <PreviewBadge preview={preview} />
        </div>
      </div>
      <figcaption className="flex min-w-0 items-center gap-2">
        <a className="truncate hover:underline" href={node.url} target="_blank" rel="noreferrer noopener">
          {node.name}
        </a>
        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => void unlink()}>
          {t.unlink}
        </Button>
      </figcaption>
      {error && <p className="text-destructive">{error}</p>}
    </figure>
  );
}

export function FigmaSection({ projectId, ticket }: { projectId: string; ticket: TicketView }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nodes = figmaRefs(ticket);
  const link = async () => {
    try {
      await client.rpc({ method: "linkFigmaNode", projectId, ticketId: ticket.id, url: url.trim() });
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
        <div className="grid grid-cols-2 gap-3">
          {nodes.map((n) => (
            <Thumbnail key={externalRefKey(n)} projectId={projectId} ticketId={ticket.id} node={n} />
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void link();
        }}
      >
        <Input
          aria-label={t.linkFigma}
          placeholder={t.figmaPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" disabled={url.trim() === ""}>
          {t.linkFigma}
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
