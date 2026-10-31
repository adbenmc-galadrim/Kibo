import { splitRef } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Ban, Trash2 } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";

type Props = {
  projectId: string;
  instanceId: string;
  componentRef: string;
  editable: boolean;
  compact: boolean;
};

export function RetiredComponent({ projectId, instanceId, componentRef, editable, compact }: Props) {
  const t = fr.page.retired;
  const [error, setError] = useState<string | null>(null);
  const remove = () => {
    setError(null);
    client
      .rpc({ method: "command", projectId, command: { method: "removeInstance", instanceId } })
      .catch((e: unknown) => {
        console.error(e);
        setError(errorMessage(e));
      });
  };
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center text-sm ${compact ? "p-4" : "p-10"}`}
    >
      <Ban className="size-5 text-muted-foreground" aria-hidden />
      <p className="font-medium">{t.title}</p>
      <code className="font-mono text-xs text-muted-foreground">{componentRef}</code>
      {splitRef(componentRef).id === "notes" && <p className="text-xs text-muted-foreground">{t.notes}</p>}
      {editable && (
        <Button size="sm" variant="outline" onClick={remove}>
          <Trash2 aria-hidden />
          {t.remove}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
