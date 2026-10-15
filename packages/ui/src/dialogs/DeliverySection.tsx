import type { ProjectDelivery, ProjectMeta, WorktreeSettings } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Download, Truck } from "lucide-react";
import { useId, useState } from "react";
import { useAgentList } from "../agents/catalog/use-agent-list";
import { frDeliverySettings } from "../i18n/fr-delivery-settings";
import { useHome } from "../lib/use-home";
import { DeliveryFields } from "./DeliveryFields";
import { DeliveryImportDialog } from "./DeliveryImportDialog";

type Props = {
  value: ProjectDelivery | null;
  worktree: WorktreeSettings | null;
  projectId: string;
  disabled: boolean;
  onChange(next: ProjectDelivery | null): void;
  onProblem(problem: string | null): void;
  onImported(meta: ProjectMeta): void;
};

const t = frDeliverySettings.section;

export function DeliverySection({
  value,
  worktree,
  projectId,
  disabled,
  onChange,
  onProblem,
  onImported,
}: Props) {
  const id = useId();
  const home = useHome();
  const list = useAgentList(projectId);
  const agents = list.failed ? [] : list.agents;
  const [importing, setImporting] = useState(false);
  return (
    <fieldset aria-labelledby={id} className="grid gap-3 border-t pt-4" disabled={disabled}>
      <legend className="float-left flex w-full items-center gap-2">
        <Truck aria-hidden className="size-4" />
        <span id={id} className="text-sm font-medium">
          {t.title}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={disabled || typeof home !== "string"}
          onClick={() => setImporting(true)}
        >
          <Download aria-hidden />
          {t.import}
        </Button>
      </legend>
      <p className="clear-left text-xs text-muted-foreground">{t.help}</p>
      {home === null ? (
        <p className="text-xs text-destructive">{frDeliverySettings.addDirs.noHome}</p>
      ) : typeof home === "string" && agents !== null ? (
        <DeliveryFields
          value={value}
          home={home}
          agents={agents}
          disabled={disabled}
          onChange={onChange}
          onProblem={onProblem}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{t.loading}</p>
      )}
      {importing && typeof home === "string" && (
        <DeliveryImportDialog
          projectId={projectId}
          home={home}
          current={{ worktree, delivery: value }}
          onClose={() => setImporting(false)}
          onImported={(meta) => {
            setImporting(false);
            onImported(meta);
          }}
        />
      )}
    </fieldset>
  );
}
