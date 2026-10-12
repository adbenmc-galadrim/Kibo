import {
  AGENT_TEMPLATES,
  type Agent,
  type AgentTemplate,
  agentNameProblem,
  descriptionProblem,
  KiboError,
  type ProjectSummary,
  suggestAgentName,
} from "@kibo/schema";
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
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { FileText, Folder, Globe, Info } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { errorMessage } from "../../lib/error-message";
import { ClaudeCodeLine, ModelSelect } from "./AgentFields";

type Scope = "global" | "project";
type Form = {
  name: string;
  scope: Scope;
  projectId: string;
  description: string;
  model: string | null;
  template: AgentTemplate;
};
type Props = { projects: readonly ProjectSummary[]; onClose(): void; onCreated?(agent: Agent): void };

const t = frAgentsSkills.newAgent;
const TEMPLATE_OF: Record<string, AgentTemplate> = { livraison: "delivery", review: "review", seo: "seo" };
const isTemplate = (v: string): v is AgentTemplate => AGENT_TEMPLATES.some((x) => x === v);

function filePath(form: Form, projects: readonly ProjectSummary[]): string {
  const name = form.name || "…";
  const folder = projects.find((p) => p.id === form.projectId)?.folder;
  return form.scope === "project" && folder
    ? `${folder}/.claude/agents/${name}.md`
    : `~/.claude/agents/${name}.md`;
}

function TemplateField({ value, onChange }: { value: AgentTemplate; onChange(v: AgentTemplate): void }) {
  return (
    <RadioGroup
      aria-label={t.template}
      value={value}
      onValueChange={(v) => isTemplate(v) && onChange(v)}
      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
    >
      {AGENT_TEMPLATES.map((key) => (
        <Label
          key={key}
          className="grid cursor-pointer content-start gap-1 rounded-md border p-2.5 text-left font-normal has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-accent"
        >
          <span className="flex items-center gap-2">
            <RadioGroupItem value={key} className="sr-only" />
            <span className="text-sm font-medium">{frAgentsSkills.templates[key].name}</span>
          </span>
          <span className="text-xs text-muted-foreground">{frAgentsSkills.templates[key].help}</span>
        </Label>
      ))}
    </RadioGroup>
  );
}

export function NewAgentDialog({ projects, onClose, onCreated }: Props) {
  const id = useId();
  const firstFolder = projects.find((p) => p.folder !== null)?.id ?? "";
  const blank: Form = {
    name: "",
    scope: "global",
    projectId: firstFolder,
    description: "",
    model: null,
    template: "blank",
  };
  const [form, setForm] = useState<Form>(blank);
  const [missing, setMissing] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const suggestion = suggestAgentName(form.description);
  const nameProblem = form.name ? agentNameProblem(form.name) : null;
  const descProblem = form.description ? descriptionProblem(form.description) : null;
  const projectReady = form.scope === "global" || projects.some((p) => p.id === form.projectId && p.folder);
  const valid =
    form.name !== "" && form.description.trim() !== "" && !nameProblem && !descProblem && projectReady;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setFailure(null);
    try {
      const created = await client.rpc({
        method: "agents.create",
        scope: form.scope,
        ...(form.scope === "project" ? { projectId: form.projectId } : {}),
        name: form.name,
        description: form.description.trim(),
        ...(form.model ? { model: form.model } : {}),
        template: form.template,
      });
      onCreated?.(created.agent);
      if (created.missingSubagents.length > 0) setMissing(created.missingSubagents);
      else onClose();
    } catch (err) {
      setFailure(err instanceof KiboError && err.code === "CONFLICT" ? t.exists : errorMessage(err));
    }
  };

  const createMissing = (name: string) => {
    setMissing([]);
    setForm({
      ...blank,
      scope: form.scope,
      projectId: form.projectId,
      name,
      template: TEMPLATE_OF[name] ?? "blank",
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-name`}>{t.name}</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-name`}
                value={form.name}
                placeholder={suggestion || "review-pr"}
                className="font-mono"
                aria-invalid={nameProblem !== null}
                onChange={(e) => set({ name: e.target.value.trim() })}
              />
              {form.name === "" && suggestion !== "" && (
                <Button type="button" variant="outline" onClick={() => set({ name: suggestion })}>
                  {t.suggest(suggestion)}
                </Button>
              )}
            </div>
            <p className={nameProblem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {nameProblem ?? t.nameHelp}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>{t.scope}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                aria-label={t.scope}
                value={form.scope}
                onValueChange={(v) => (v === "global" || v === "project") && set({ scope: v })}
              >
                <ToggleGroupItem value="global" className="gap-1.5 px-3 text-xs">
                  <Globe aria-hidden />
                  {t.global}
                </ToggleGroupItem>
                <ToggleGroupItem value="project" className="gap-1.5 px-3 text-xs">
                  <Folder aria-hidden />
                  {t.project}
                </ToggleGroupItem>
              </ToggleGroup>
              {form.scope === "project" && (
                <Select value={form.projectId} onValueChange={(projectId) => set({ projectId })}>
                  <SelectTrigger aria-label={t.pickProject} size="sm" className="h-8 w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={p.folder === null}>
                        {p.folder === null ? t.noFolder(p.name) : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-description`}>{t.description}</Label>
            <Input
              id={`${id}-description`}
              value={form.description}
              aria-invalid={descProblem !== null}
              onChange={(e) => set({ description: e.target.value })}
            />
            <p className={descProblem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {descProblem ?? t.descriptionHelp}
            </p>
          </div>
          <div className="grid gap-1.5 sm:w-56">
            <Label htmlFor={`${id}-model`}>{t.model}</Label>
            <ModelSelect id={`${id}-model`} value={form.model} onChange={(model) => set({ model })} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t.template}</Label>
            <TemplateField value={form.template} onChange={(template) => set({ template })} />
          </div>
          {form.template === "conductor" && (
            <Alert>
              <Info aria-hidden />
              <AlertDescription>
                <p className="font-medium text-foreground">{t.conductor}</p>
                <p>{t.conductorHelp}</p>
              </AlertDescription>
            </Alert>
          )}
          <ClaudeCodeLine name={form.name || suggestion || "…"} description={form.description} />
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <FileText aria-hidden className="size-3.5 shrink-0" />
            {t.file}
            <code className="truncate font-mono text-foreground">{filePath(form, projects)}</code>
          </p>
          {missing.length > 0 && (
            <Alert>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                {t.missing(missing)}
                {missing.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => createMissing(name)}
                  >
                    {t.createMissing(name)}
                  </Button>
                ))}
              </AlertDescription>
            </Alert>
          )}
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {missing.length > 0 ? fr.common.close : fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!valid}>
              {t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
