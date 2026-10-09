import { type GrantedPermissions, KiboError, type MarketSourceInfo, shortHash } from "@kibo/schema";
import { Alert, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { CircleX, Upload } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frMarket } from "../i18n/fr-market";
import { marketErrorText } from "../lib/market-errors";
import { permissionLines } from "../lib/permission-lines";
import { isRemoteView } from "../lib/remote-view";

export type PublishTarget = {
  id: string;
  title: string;
  version: string;
  hash: string;
  permissions: GrantedPermissions;
};
type Props = { target: PublishTarget; open: boolean; onOpenChange(open: boolean): void; remote?: boolean };
type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; serial: number }
  | { kind: "error"; text: string };

const publishErrors: Readonly<Record<string, string>> = frMarket.market.publishErrors;

const hostOf = (url: string | null): string | null => {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch (e) {
    if (e instanceof TypeError) return null;
    throw e;
  }
};

const errorText = (e: unknown): string =>
  e instanceof KiboError && Object.hasOwn(publishErrors, e.code)
    ? (publishErrors[e.code] ?? marketErrorText(e))
    : marketErrorText(e);

function useTeamSources(open: boolean, fail: (text: string) => void) {
  const [sources, setSources] = useState<MarketSourceInfo[] | null>(null);
  const [needsName, setNeedsName] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    Promise.all([
      client.rpc({ method: "listMarketSources" }),
      client.rpc({ method: "getSyncStatus" }),
      client.rpc({ method: "getMarketPublisher" }),
    ]).then(
      ([all, status, publisher]) => {
        if (!live) return;
        const host = hostOf(status.serverUrl);
        setSources(all.filter((s) => host !== null && hostOf(s.url) === host));
        setNeedsName(publisher === null);
      },
      (e: unknown) => live && fail(marketErrorText(e)),
    );
    return () => {
      live = false;
    };
  }, [open, fail]);
  return { sources, needsName };
}

function Summary({ target }: { target: PublishTarget }) {
  const t = frMarket.market;
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
      <p className="text-sm font-medium">{t.publishSummary}</p>
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-muted-foreground">{t.publishVersion}</dt>
        <dd className="font-mono">{target.version}</dd>
        <dt className="text-muted-foreground">{t.hash}</dt>
        <dd className="font-mono">{t.hashText(shortHash(target.hash))}</dd>
        <dt className="text-muted-foreground">{t.permissions}</dt>
        <dd className="grid gap-0.5">
          {permissionLines(target.permissions).map((line) => (
            <span key={line.title}>{line.title}</span>
          ))}
        </dd>
      </dl>
    </div>
  );
}

function SourceChoice(props: { sources: MarketSourceInfo[]; value: string; onChange(id: string): void }) {
  const t = frMarket.market;
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{t.publishSource}</Label>
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger id={id} className="w-full font-mono text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.sources.map((s) => (
            <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
              {t.sourceOption(s.name, s.url)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t.publishSourceHelp}</p>
    </div>
  );
}

export function PublishToMarketDialog({ target, open, onOpenChange, remote = isRemoteView() }: Props) {
  const t = frMarket.market;
  const nameId = useId();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [fail] = useState(() => (text: string) => setState({ kind: "error", text }));
  const { sources, needsName } = useTeamSources(open, fail);
  const [chosen, setChosen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const sourceId = chosen ?? sources?.[0]?.id ?? "";

  const publish = async () => {
    setState({ kind: "busy" });
    try {
      const { serial } = await client.rpc({
        method: "publishToMarket",
        id: target.id,
        version: target.version,
        sourceId,
        ...(needsName ? { publisherName: name.trim() } : {}),
      });
      setState({ kind: "done", serial });
    } catch (e) {
      if (!(e instanceof KiboError)) console.error(e);
      setState({ kind: "error", text: errorText(e) });
    }
  };

  const blocked =
    remote || state.kind === "busy" || state.kind === "done" || !sourceId || (needsName && !name.trim());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.publish}</DialogTitle>
          <DialogDescription>{t.publishSubtitle(target.title, target.version)}</DialogDescription>
        </DialogHeader>
        {sources?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.publishNoSource}</p>
        ) : (
          <div className="grid gap-4 text-sm">
            {sources && <SourceChoice sources={sources} value={sourceId} onChange={setChosen} />}
            {needsName && (
              <div className="grid gap-1.5">
                <Label htmlFor={nameId}>{t.publisherName}</Label>
                <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
                <p className="text-xs text-muted-foreground">{t.publisherNameHelp}</p>
              </div>
            )}
            <Summary target={target} />
          </div>
        )}
        {remote && <p className="text-sm text-muted-foreground">{t.errors.FORBIDDEN}</p>}
        {state.kind === "done" && (
          <output className="block text-sm text-emerald-700 dark:text-emerald-400">
            {t.published(state.serial)}
          </output>
        )}
        {state.kind === "error" && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <CircleX aria-hidden />
            <AlertTitle>{state.text}</AlertTitle>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {state.kind === "done" ? fr.common.close : fr.common.cancel}
          </Button>
          <Button onClick={() => void publish()} disabled={blocked}>
            <Upload aria-hidden />
            {state.kind === "busy" ? t.publishing : t.publishConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
