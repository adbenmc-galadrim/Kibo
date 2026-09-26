import { KiboError, type McpCallResult } from "@kibo/schema";
import { useEntities, useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { McpSourceConfig } from "./config";
import { type ExtractError, extractItems, type SourceItem } from "./extract";
import { fr } from "./fr";
import { SourceItemRow } from "./SourceItemRow";

type Loaded = { items: SourceItem[]; fetchedAt: number; truncated: boolean };
type Problem =
  | { kind: "unreachable" }
  | { kind: "tool"; message: string }
  | { kind: "extract"; error: ExtractError }
  | { kind: "other"; message: string };

const textOf = (r: McpCallResult) => r.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");

function problemMessage(p: Problem | null): string | null {
  if (p === null) return null;
  if (p.kind === "unreachable") return fr.unreachable;
  if (p.kind === "tool") return `${fr.toolError} ${p.message}`;
  if (p.kind === "extract") return fr.extract[p.error];
  return `${fr.failed} ${p.message}`;
}

export function McpSource() {
  const sdk = useSdk();
  const config = useMemo(() => McpSourceConfig.safeParse(sdk.config), [sdk.config]);
  const { data: tickets } = useEntities("ticket");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!config.success) return;
    const c = config.data;
    try {
      const result =
        c.mode === "tool"
          ? await sdk.mcp.call(c.server, c.tool ?? "", c.args)
          : await sdk.mcp.read(c.server, c.uri ?? "");
      if (result.isError) return setProblem({ kind: "tool", message: textOf(result).slice(0, 300) });
      const out = extractItems(result, c.mapping);
      if (out.error) return setProblem({ kind: "extract", error: out.error });
      const next = { items: out.items, fetchedAt: Date.now(), truncated: result.truncated };
      setLoaded(next);
      setProblem(null);
      await sdk.data.set("last", next);
    } catch (e) {
      setProblem(
        e instanceof KiboError && e.code === "MCP_UNAVAILABLE"
          ? { kind: "unreachable" }
          : { kind: "other", message: e instanceof Error ? e.message : String(e) },
      );
    }
  }, [sdk, config.success, config.data]);

  useEffect(() => {
    if (!config.success) return;
    let live = true;
    sdk.data
      .get<Loaded>("last")
      .then((cached) => live && cached && setLoaded((current) => current ?? cached))
      .catch((e: unknown) =>
        setProblem({ kind: "other", message: e instanceof Error ? e.message : String(e) }),
      );
    void load();
    const refresh = setInterval(() => void load(), config.data.refreshMinutes * 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      live = false;
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [sdk, load, config.success, config.data?.refreshMinutes]);

  if (!config.success) return <p className="p-4 text-sm text-muted-foreground">{fr.unconfigured}</p>;
  const server = config.data.server;
  const keyOf = (id: string) =>
    tickets.find((t) =>
      t.externalRefs.some((r) => r.kind === "mcp_item" && r.server === server && r.itemId === id),
    )?.key ?? null;
  const create = async (item: SourceItem) => {
    setBusy(item.id);
    try {
      await sdk.mcp.importItem(server, { itemId: item.id, title: item.title, url: item.url });
    } catch (e) {
      setProblem({ kind: "other", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };
  const openKey = (key: string) => {
    const t = tickets.find((x) => x.key === key);
    if (t) sdk.openTicket(t.id);
  };
  const message = problemMessage(problem);

  return (
    <div className="flex h-full flex-col">
      {message && (
        <p role="alert" className="border-b px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      )}
      {!loaded && !problem && (
        <output className="grid gap-2 p-3">
          <span className="sr-only">{fr.loading}</span>
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
        </output>
      )}
      {loaded && loaded.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">{fr.empty}</p>}
      {loaded && (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {loaded.items.map((item) => {
            const key = keyOf(item.id);
            return (
              <SourceItemRow
                key={item.id}
                item={item}
                ticketKey={key}
                busy={busy === item.id}
                onCreate={() => void create(item)}
                onOpen={() => key && openKey(key)}
              />
            );
          })}
        </ul>
      )}
      <footer className="flex items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span>{loaded ? fr.updated(fr.ago(Math.floor((now - loaded.fetchedAt) / 60_000))) : fr.never}</span>
        {loaded?.truncated && <span>· {fr.truncated}</span>}
        <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={() => void load()}>
          <RefreshCw aria-hidden className="size-3" />
          {fr.refresh}
        </Button>
      </footer>
    </div>
  );
}
