import { KiboError, type McpServerInput } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { FormError } from "./FormError";
import { McpServerFields } from "./McpServerFields";
import { type McpForm, slugId, toServerInput } from "./mcp-form";
import { Notice } from "./Notice";

const t = fr.integrations.mcpServer;

type Props = { open: boolean; onOpenChange(open: boolean): void; onAdded(): void; takenIds: string[] };
type Pending = { server: McpServerInput; secrets: Record<string, string>; commandLine: string };

const EMPTY: McpForm = {
  transport: "stdio",
  id: "",
  name: "",
  command: "",
  args: "",
  env: [],
  url: "",
  bearer: "",
};

const FIELD_LABELS: Record<string, string> = {
  id: t.id,
  name: t.name,
  command: t.command,
  args: t.args,
  envNames: t.env,
  url: t.url,
};

const message = (e: unknown) => (e instanceof KiboError ? e.detail : String(e));

function ConfirmStep({
  pending,
  error,
  onBack,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  error: string | null;
  onBack(): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.confirmTitle}</DialogTitle>
        <DialogDescription>
          {pending.server.transport === "stdio" ? t.confirmStdio : t.confirmHttp}
        </DialogDescription>
      </DialogHeader>
      <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap break-all">
        {pending.commandLine}
      </pre>
      {pending.server.transport === "stdio" && (
        <>
          <p className="text-sm text-muted-foreground">{t.environment(pending.server.envNames)}</p>
          <Notice tone="security" title={t.warningTitle} detail={t.warningBody} />
        </>
      )}
      <FormError message={error} />
      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden className="size-4" />
          {t.back}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            {fr.common.cancel}
          </Button>
          <Button onClick={onConfirm}>{t.confirm}</Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function McpServerDialog({ open, onOpenChange, onAdded, takenIds }: Props) {
  const [form, setForm] = useState<McpForm>(EMPTY);
  const [idTouched, setIdTouched] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = idTouched ? form.id : slugId(form.name);
  const set = (patch: Partial<McpForm>) => setForm((f) => ({ ...f, ...patch }));

  const next = async () => {
    setError(null);
    if (takenIds.includes(id)) return setError(t.idTaken);
    const out = toServerInput({ ...form, id });
    if ("error" in out) return setError(t.invalid(FIELD_LABELS[out.error] ?? out.error));
    try {
      const { commandLine } = await client.rpc({ method: "previewMcpServer", server: out.server });
      setPending({ ...out, commandLine });
    } catch (e) {
      setError(message(e));
    }
  };

  const confirm = async () => {
    if (!pending) return;
    setError(null);
    try {
      await client.rpc({
        method: "addMcpServer",
        server: pending.server,
        confirmedCommandLine: pending.commandLine,
        secrets: pending.secrets,
      });
      setForm(EMPTY);
      setPending(null);
      onAdded();
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        {pending ? (
          <ConfirmStep
            pending={pending}
            error={error}
            onBack={() => {
              setError(null);
              setPending(null);
            }}
            onCancel={() => onOpenChange(false)}
            onConfirm={() => void confirm()}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.title}</DialogTitle>
              <DialogDescription>{t.subtitle}</DialogDescription>
            </DialogHeader>
            <McpServerFields
              form={form}
              id={id}
              onChange={set}
              onIdChange={(value) => {
                setIdTouched(true);
                set({ id: value });
              }}
            />
            <FormError message={error} />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {fr.common.cancel}
              </Button>
              <Button onClick={() => void next()}>{t.next}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
