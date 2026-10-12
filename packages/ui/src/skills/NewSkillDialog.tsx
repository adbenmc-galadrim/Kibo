import { KiboError, type ProjectSummary, type Skill, SkillName } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
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
import { TriangleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";
import { projectName } from "../agents/catalog/agent-labels";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frSkills } from "../i18n/fr-skills";
import { errorMessage } from "../lib/error-message";
import { type Destination, DestinationField } from "./DestinationField";
import { useSkills } from "./use-skills";

type Props = { projects: ProjectSummary[]; onClose(): void; onCreated(skill: Skill): void };

const t = frSkills.newSkill;

const inDestination = (s: Skill, to: Destination) =>
  to.source === "user" ? s.source === "user" : s.source === "project" && s.projectId === to.projectId;

export function shadowText(
  skills: readonly Skill[],
  name: string,
  to: Destination,
  projects: readonly ProjectSummary[],
): string | null {
  const same = skills.filter((s) => s.name === name && s.source !== "plugin" && !inDestination(s, to));
  if (to.source === "project") return same.some((s) => s.source === "user") ? t.shadowWarning(name) : null;
  const project = same.find((s) => s.source === "project");
  return project
    ? t.shadowsProject(name, frSkills.groups.project(projectName(project.projectId, projects)))
    : null;
}

function pathOf(to: Destination, name: string, projects: readonly ProjectSummary[]): string {
  const folder = to.source === "project" ? projects.find((p) => p.id === to.projectId)?.folder : "~";
  return `${folder ?? "~"}/.claude/skills/${name || "…"}/SKILL.md`;
}

export function NewSkillDialog({ projects, onClose, onCreated }: Props) {
  const id = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const { skills } = useSkills(null);
  const [to, setTo] = useState<Destination>({ source: "user" });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = SkillName.safeParse(name).success;
  const exists = (skills ?? []).some((s) => s.name === name && inDestination(s, to));
  const shadow = valid ? shadowText(skills ?? [], name, to, projects) : null;
  const ready = valid && !exists && description.trim() !== "" && !busy;
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const skill = await client.rpc({
        method: "skills.create",
        source: to.source,
        ...(to.source === "project" ? { projectId: to.projectId } : {}),
        name,
        description: description.trim(),
      });
      onCreated(skill);
    } catch (e) {
      setError(e instanceof KiboError && e.code === "CONFLICT" ? t.exists : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const rename = () => {
    nameInput.current?.focus();
    nameInput.current?.select();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <DestinationField label={t.destination} value={to} projects={projects} onChange={setTo} />
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>{t.name}</Label>
          <Input
            ref={nameInput}
            id={`${id}-name`}
            className={cn("font-mono", shadow && "border-brand ring-2 ring-brand/30")}
            value={name}
            aria-invalid={(name !== "" && !valid) || exists}
            aria-describedby={`${id}-name-help`}
            onChange={(e) => setName(e.target.value.trim())}
          />
          <p id={`${id}-name-help`} className="text-xs text-muted-foreground">
            {name !== "" && !valid ? t.nameProblem : exists ? t.exists : t.nameHelp}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-summary`}>{t.summary}</Label>
          <Input
            id={`${id}-summary`}
            value={description}
            placeholder={t.summaryHelp}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <p className="font-mono text-xs text-muted-foreground">{t.path(pathOf(to, name, projects))}</p>
        {shadow && (
          <Alert className="border-brand/50 text-brand-strong dark:text-brand">
            <TriangleAlert aria-hidden />
            <AlertDescription className="text-inherit">{shadow}</AlertDescription>
          </Alert>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {fr.common.cancel}
          </Button>
          {shadow && (
            <Button variant="outline" onClick={rename}>
              {t.rename}
            </Button>
          )}
          <Button disabled={!ready} onClick={() => void create()}>
            {shadow ? t.createAnyway : t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
