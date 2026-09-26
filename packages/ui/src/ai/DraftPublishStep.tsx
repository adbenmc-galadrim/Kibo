import type { ComponentDraftDetails } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import {
  ChangesList,
  NEUTRAL_DOT,
  type Strategy,
  StrategyChoice,
  UsagesBox,
} from "../components-page/PublishSections";
import { fr } from "../i18n/fr";
import { useProjects } from "../state/use-projects";

type Props = {
  details: ComponentDraftDetails;
  busy: boolean;
  onSubmit: (input: { version: string; changes: string[]; strategy: Strategy }) => void;
};

export function DraftPublishStep({ details, busy, onSubmit }: Props) {
  const id = useId();
  const projects = useProjects() ?? [];
  const preview = details.publish;
  const [version, setVersion] = useState(preview?.to ?? "0.1.0");
  const [changes, setChanges] = useState((preview?.changes ?? []).join("\n"));
  const [strategy, setStrategy] = useState<Strategy>("update-all");
  if (!preview) return null;
  const lines = changes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const shown = { ...preview, to: version, changes: lines };
  const colorOf = (projectId: string) => projects.find((p) => p.id === projectId)?.color ?? NEUTRAL_DOT;
  const used = preview.usages.length > 0;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[8rem_1fr] items-start gap-3">
        <div className="grid content-start gap-1">
          <Label htmlFor={`${id}-version`}>{fr.ai.version}</Label>
          <Input
            id={`${id}-version`}
            className="font-mono"
            value={version}
            onChange={(e) => setVersion(e.target.value.trim())}
          />
        </div>
        <div className="grid content-start gap-1">
          <Label htmlFor={`${id}-changes`}>{fr.ai.changes}</Label>
          <Textarea
            id={`${id}-changes`}
            rows={2}
            value={changes}
            onChange={(e) => setChanges(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{fr.ai.changesHelp}</p>
        </div>
      </div>
      {used && <UsagesBox preview={shown} strategy={strategy} colorOf={colorOf} />}
      <ChangesList preview={shown} />
      {used && <StrategyChoice preview={shown} value={strategy} onChange={setStrategy} />}
      <Button
        className="justify-self-end"
        disabled={busy || !/^\d+\.\d+\.\d+$/.test(version)}
        onClick={() => onSubmit({ version, changes: lines, strategy })}
      >
        {fr.ai.publish}
      </Button>
    </div>
  );
}
