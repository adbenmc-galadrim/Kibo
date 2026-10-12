import { type Agent, agentNameProblem, KiboError } from "@kibo/schema";
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
import { type FormEvent, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { errorMessage } from "../../lib/error-message";

type Props = { agent: Pick<Agent, "ref" | "name">; onClose(): void; onRenamed(agent: Agent): void };

const t = frAgentsSkills.sheet;

export function RenameAgentDialog({ agent, onClose, onRenamed }: Props) {
  const id = useId();
  const [name, setName] = useState(agent.name);
  const [failure, setFailure] = useState<string | null>(null);
  const problem = name === agent.name ? null : agentNameProblem(name);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem !== null || name === agent.name) return;
    setFailure(null);
    try {
      onRenamed(await client.rpc({ method: "agents.rename", ref: agent.ref, name }));
    } catch (err) {
      setFailure(
        err instanceof KiboError && err.code === "CONFLICT"
          ? frAgentsSkills.newAgent.exists
          : errorMessage(err),
      );
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.renameTitle(agent.name)}</DialogTitle>
            <DialogDescription>{t.renameHelp}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-name`}>{t.newName}</Label>
            <Input
              id={`${id}-name`}
              value={name}
              className="font-mono"
              aria-invalid={problem !== null}
              onChange={(e) => setName(e.target.value.trim())}
            />
            {problem && <p className="text-xs text-destructive">{problem}</p>}
          </div>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={problem !== null || name === agent.name}>
              {t.rename}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
