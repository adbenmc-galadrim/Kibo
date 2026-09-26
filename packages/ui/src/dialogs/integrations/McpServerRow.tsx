import type { McpServerView } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Switch } from "@kibo/sdk/ui/switch";
import { Plug } from "lucide-react";
import { fr } from "../../i18n/fr";
import { FormError } from "./FormError";

const t = fr.integrations.mcpServers;

type Props = {
  server: McpServerView;
  error: string | null;
  onToggle(enabled: boolean): void;
  onRemove(): void;
};

function stateOf(server: McpServerView): { label: string; dot: string } {
  if (!server.enabled) return { label: t.disabled, dot: "bg-muted-foreground/60" };
  if (server.state === "error") return { label: t.failed, dot: "bg-red-500" };
  if (server.state === "connected") return { label: t.active, dot: "bg-emerald-500" };
  return { label: t.active, dot: "bg-muted-foreground/60" };
}

const kindOf = (server: McpServerView) =>
  server.transport === "stdio" ? fr.integrations.mcpServer.stdio : fr.integrations.mcpServer.http;

export function McpServerRow({ server, error, onToggle, onRemove }: Props) {
  const state = stateOf(server);
  return (
    <li className="grid gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <Plug aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="flex items-baseline gap-2 text-sm font-medium">
            <span className="truncate">{server.name}</span>
            <span className="font-mono text-xs font-normal text-muted-foreground">{server.id}</span>
          </p>
          <p className="text-xs text-muted-foreground">{`${kindOf(server)} · ${t.tools(server.tools.length)}`}</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className={cn("size-1.5 rounded-full", state.dot)} />
          {state.label}
        </span>
        <Switch
          checked={server.enabled}
          aria-label={`${t.enabled} ${server.name}`}
          onCheckedChange={onToggle}
        />
        <Button variant="ghost" size="sm" onClick={onRemove}>
          {t.remove}
        </Button>
      </div>
      {server.enabled && server.state === "error" && server.error && (
        <p className="pl-7 text-xs text-destructive">{server.error}</p>
      )}
      <FormError message={error} />
    </li>
  );
}
