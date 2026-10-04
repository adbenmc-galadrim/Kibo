import { externalRefKey, type FigmaNodeRef, KiboError, type TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { failureText } from "../../lib/remote-error";
import { figmaRefs } from "./figma-refs";

const t = fr.integrations.sheet;

function linkError(e: unknown): string {
  if (e instanceof KiboError && e.code === "INVALID_INPUT") return t.figmaInvalid;
  if (e instanceof KiboError && e.code === "NOT_CONNECTED") return t.figmaNotConnected;
  if (e instanceof KiboError && e.code === "MCP_UNAVAILABLE") return fr.integrations.figma.unreachable.title;
  return failureText(e);
}

function LinkedFrame({
  projectId,
  ticketId,
  node,
}: {
  projectId: string;
  ticketId: string;
  node: FigmaNodeRef;
}) {
  const [error, setError] = useState<string | null>(null);
  const unlink = async () => {
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "removeExternalRef", ticketId, kind: "figma_node", key: externalRefKey(node) },
      });
    } catch (e) {
      setError(failureText(e));
    }
  };
  return (
    <li className="grid gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <a className="truncate hover:underline" href={node.url} target="_blank" rel="noreferrer noopener">
          {node.name}
        </a>
        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => void unlink()}>
          {t.unlink}
        </Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
    </li>
  );
}

export function FigmaSection({ projectId, ticket }: { projectId: string; ticket: TicketView }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nodes = figmaRefs(ticket);
  const link = async () => {
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
        <ul className="grid gap-1">
          {nodes.map((n) => (
            <LinkedFrame key={externalRefKey(n)} projectId={projectId} ticketId={ticket.id} node={n} />
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
          aria-label={t.linkFigma}
          placeholder={t.figmaPlaceholder}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          aria-invalid={error !== null}
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
