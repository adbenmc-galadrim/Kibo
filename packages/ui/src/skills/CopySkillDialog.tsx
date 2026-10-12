import {
  type AgentRef,
  KiboError,
  type ProjectSummary,
  parseAgentRef,
  type Skill,
  SkillName,
} from "@kibo/schema";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frSkills } from "../i18n/fr-skills";
import { errorMessage } from "../lib/error-message";
import { useOptionalHost } from "../shell/Host";
import { type Destination, DestinationField } from "./DestinationField";

type Props = {
  skill: Skill;
  projects: readonly ProjectSummary[];
  onClose(): void;
  onCopied(copy: Skill): void;
};

const t = frSkills.copy;

export const agentNameOf = (ref: AgentRef): string => {
  const parsed = parseAgentRef(ref);
  return parsed.scope === "system" ? parsed.id : parsed.name;
};

const describe = (e: unknown) =>
  e instanceof KiboError && e.code === "CONFLICT" ? t.exists : errorMessage(e);

function CitedBy({ copy, citedBy, onDone }: { copy: Skill; citedBy: AgentRef[]; onDone(): void }) {
  const host = useOptionalHost();
  const names = citedBy.map(agentNameOf);
  return (
    <>
      <p className="text-sm">{t.copied(copy.id)}</p>
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertDescription className="grid gap-2">
          {t.citedBy(names)}
          <span className="flex flex-wrap gap-2">
            {names.map((name) => (
              <Button
                key={name}
                size="sm"
                variant="outline"
                className="font-mono"
                aria-label={t.openAgent(name)}
                onClick={() => host?.openTarget({ kind: "screen", screen: "agents" })}
              >
                {name}
              </Button>
            ))}
          </span>
        </AlertDescription>
      </Alert>
      <DialogFooter>
        <Button onClick={onDone}>{t.done}</Button>
      </DialogFooter>
    </>
  );
}

export function CopySkillDialog({ skill, projects, onClose, onCopied }: Props) {
  const id = useId();
  const [to, setTo] = useState<Destination>({ source: "user" });
  const [name, setName] = useState(`${skill.name}-perso`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ skill: Skill; citedBy: AgentRef[] } | null>(null);
  const valid = SkillName.safeParse(name).success;
  const copy = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await client.rpc({ method: "skills.copy", id: skill.id, to, name });
      if (result.citedBy.length === 0) onCopied(result.skill);
      else setDone(result);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        {done ? (
          <CitedBy copy={done.skill} citedBy={done.citedBy} onDone={() => onCopied(done.skill)} />
        ) : (
          <>
            <DestinationField label={t.destination} value={to} projects={projects} onChange={setTo} />
            <div className="grid gap-1.5">
              <Label htmlFor={id}>{t.name}</Label>
              <Input
                id={id}
                className="font-mono"
                value={name}
                aria-invalid={!valid}
                onChange={(e) => setName(e.target.value.trim())}
              />
              {!valid && <p className="text-xs text-destructive">{frSkills.newSkill.nameProblem}</p>}
            </div>
            <Alert className="border-brand/50 text-brand-strong dark:text-brand">
              <TriangleAlert aria-hidden />
              <AlertTitle>{t.newId}</AlertTitle>
              <AlertDescription className="text-inherit">{t.newIdHelp(name, skill.id)}</AlertDescription>
            </Alert>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {fr.common.cancel}
              </Button>
              <Button disabled={busy || !valid} onClick={() => void copy()}>
                {t.copy}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
