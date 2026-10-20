import { designUrlProblem, externalRefKey, type TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { useState } from "react";
import { client } from "../../api";
import { frDesign } from "../../i18n/fr-design";
import { linkErrorText } from "./design-errors";
import { designRefs } from "./design-refs";
import { LinkedFrame } from "./LinkedFrame";
import { FrameFullscreen } from "./lazy-fullscreen";
import { useDesignThumbs } from "./use-design-thumbs";

const t = frDesign.sheet;

export function DesignSection({ projectId, ticket }: { projectId: string; ticket: TicketView }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const nodes = designRefs(ticket);
  const { thumbs, refresh, refreshing } = useDesignThumbs(nodes.map((n) => n.url));
  const loaded = nodes.flatMap((n) => {
    const thumb = thumbs.get(n.url);
    return thumb?.state === "ready" ? [{ url: n.url, frame: thumb.frame }] : [];
  });
  const index = loaded.findIndex((f) => f.url === opened);
  const link = async () => {
    const problem = designUrlProblem(url);
    if (problem) {
      setError(frDesign.urlProblems[problem]);
      return;
    }
    try {
      await client.rpc({ method: "linkDesignFrame", projectId, ticketId: ticket.id, url: url.trim() });
      setUrl("");
      setError(null);
    } catch (e) {
      setError(linkErrorText(e, url));
    }
  };
  return (
    <section aria-label={t.mockups} className="grid gap-2 px-4 pb-4 text-xs">
      {nodes.length > 0 && (
        <ul className="grid gap-3">
          {nodes.map((n) => (
            <LinkedFrame
              key={`${n.kind}:${externalRefKey(n)}`}
              projectId={projectId}
              ticketId={ticket.id}
              node={n}
              thumb={thumbs.get(n.url) ?? { state: "loading" }}
              refreshing={refreshing(n.url)}
              onRefresh={() => refresh(n.url)}
              onFullscreen={() => setOpened(n.url)}
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
      {index >= 0 && (
        <FrameFullscreen
          open
          frames={loaded}
          index={index}
          context={ticket.keyLabel}
          onIndexChange={(i) => setOpened(loaded[i]?.url ?? null)}
          onOpenChange={(open) => {
            if (!open) setOpened(null);
          }}
          onRefresh={refresh}
          refreshing={refreshing(loaded[index]?.url ?? "")}
        />
      )}
    </section>
  );
}
