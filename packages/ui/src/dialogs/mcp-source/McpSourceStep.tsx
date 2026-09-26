import { type McpSourceStoredConfig, parseArgs } from "@kibo/component-mcp-source";
import type { McpServerView } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { draftOf, type McpSourceDraft, newDraft, validStored } from "./mcp-source-draft";
import { PointerFields } from "./PointerFields";
import { TargetFields } from "./TargetFields";

type Props = { value: McpSourceStoredConfig | null; onChange(config: McpSourceStoredConfig | null): void };
const t = fr.integrations.mcpSource;
const firstTool = (s: McpServerView | undefined) => s?.tools[0]?.name ?? null;

function useEnabledServers(): { servers: McpServerView[] | null; error: string | null } {
  const [servers, setServers] = useState<McpServerView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    client
      .rpc({ method: "listMcpServers" })
      .then((all) => live && setServers(all.filter((s) => s.enabled)))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, []);
  return { servers, error };
}

export function McpSourceStep({ value, onChange }: Props) {
  const ids = { title: useId(), server: useId(), args: useId(), argsError: useId(), refresh: useId() };
  const { servers, error } = useEnabledServers();
  const [draft, setDraft] = useState<McpSourceDraft | null>(value ? draftOf(value) : null);

  const update = (next: McpSourceDraft) => {
    setDraft(next);
    onChange(validStored(next));
  };

  useEffect(() => {
    if (servers === null || draft !== null) return;
    const first = servers[0];
    if (!first) {
      onChange(null);
      return;
    }
    const initial = newDraft(first.id, firstTool(first));
    setDraft(initial);
    onChange(validStored(initial));
  }, [servers, draft, onChange]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (servers === null) return <p className="text-sm text-muted-foreground">{t.loading}</p>;
  if (servers.length === 0 || draft === null)
    return <p className="text-sm text-muted-foreground">{t.noServer}</p>;

  const server = servers.find((s) => s.id === draft.server);
  const argsValid = parseArgs(draft.args) !== null;
  const pickServer = (id: string) => {
    const picked = servers.find((s) => s.id === id);
    update({ ...draft, server: id, tool: firstTool(picked) ?? "" });
  };

  return (
    <section className="grid gap-4">
      <p className="font-medium">{t.title}</p>
      <div className="grid gap-2">
        <Label htmlFor={ids.title}>{t.widgetTitle}</Label>
        <Input
          id={ids.title}
          maxLength={80}
          value={draft.title}
          onChange={(e) => update({ ...draft, title: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={ids.server}>{t.server}</Label>
        <Select value={draft.server} onValueChange={pickServer}>
          <SelectTrigger id={ids.server} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {servers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {t.serverLabel(s.name, s.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TargetFields draft={draft} tools={server?.tools ?? []} onChange={update} />
      <div className="grid gap-2">
        <Label htmlFor={ids.args}>{t.args}</Label>
        <Textarea
          id={ids.args}
          className="font-mono"
          rows={3}
          value={draft.args}
          aria-invalid={!argsValid}
          aria-describedby={argsValid ? undefined : ids.argsError}
          onChange={(e) => update({ ...draft, args: e.target.value })}
        />
        {!argsValid && (
          <p id={ids.argsError} className="text-sm text-destructive">
            {t.argsInvalid}
          </p>
        )}
      </div>
      <PointerFields draft={draft} onChange={(key, v) => update({ ...draft, [key]: v })} />
      <div className="grid gap-2">
        <Label htmlFor={ids.refresh}>{t.refresh}</Label>
        <Input
          id={ids.refresh}
          type="number"
          min={5}
          max={1440}
          className="w-32"
          value={draft.refresh}
          onChange={(e) => update({ ...draft, refresh: e.target.value })}
        />
      </div>
    </section>
  );
}
