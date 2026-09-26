import { ProjectKey, type Role } from "@kibo/schema";
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
import { useMemo, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { suggestProjectKey } from "../lib/project-key";
import { applyStarterPlan } from "../onboarding/apply-plan";
import { useStarterCatalog } from "../onboarding/catalog-refs";
import { chosenPages, presetFor, toSelection } from "../onboarding/presets";
import { RoleStep } from "../onboarding/RoleStep";
import { navigate } from "../route";
import { NewProjectForm, type ProjectFields, type ProjectStart } from "./NewProjectForm";

const COLORS = ["#14B8A6", "#6366F1", "#EC4899", "#84CC16", "#D946EF", "#64748B"];

type Props = { open: boolean; onOpenChange: (o: boolean) => void; count: number; focusFolder?: boolean };

export function NewProjectDialog({ open, onOpenChange, count, focusFolder = false }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <NewProjectSteps onOpenChange={onOpenChange} count={count} focusFolder={focusFolder} />
      </DialogContent>
    </Dialog>
  );
}

function NewProjectSteps({ onOpenChange, count, focusFolder }: Omit<Required<Props>, "open">) {
  const { refs, titles } = useStarterCatalog();
  const available = useMemo(() => new Set(refs.keys()), [refs]);
  const [step, setStep] = useState<1 | 2>(focusFolder ? 2 : 1);
  const [role, setRole] = useState<Role>("dev");
  const [selection, setSelection] = useState(() => toSelection(presetFor("dev", available)));
  const [start, setStart] = useState<ProjectStart>(focusFolder ? "suggested" : "empty");
  const [fields, setFields] = useState<ProjectFields>({ name: "", key: null, folder: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const pages = chosenPages(selection);
  const effectiveKey = fields.key ?? suggestProjectKey(fields.name);
  const valid = fields.name.trim().length > 0 && ProjectKey.safeParse(effectiveKey).success;

  const toForm = (next: typeof selection) => {
    setSelection(next);
    setStart(chosenPages(next).length > 0 ? "suggested" : "empty");
    setStep(2);
  };
  const openProject = (projectId: string) => {
    onOpenChange(false);
    navigate(projectId);
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await client.rpc({
        method: "createProject",
        name: fields.name.trim(),
        key: effectiveKey,
        folder: fields.folder.trim() || null,
        color: COLORS[count % COLORS.length] ?? "#64748B",
      });
      const failures = start === "suggested" ? await applyStarterPlan(client, p.id, pages, refs) : [];
      if (failures.length === 0) return openProject(p.id);
      console.error(failures);
      setCreated(p.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{fr.newProject.title}</DialogTitle>
        <DialogDescription>
          {step === 1 ? fr.onboarding.roleSubtitle : fr.newProject.subtitle}
        </DialogDescription>
      </DialogHeader>
      {created !== null ? (
        <>
          <Alert>
            <AlertDescription>{fr.onboarding.partial}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={() => openProject(created)}>{fr.onboarding.openProject}</Button>
          </DialogFooter>
        </>
      ) : (
        <>
          {step === 1 && (
            <div className="grid gap-4">
              <RoleStep
                available={available}
                titles={titles}
                selection={selection}
                onSelection={setSelection}
                role={role}
                onRole={setRole}
              />
              <DialogFooter className="items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">{fr.onboarding.step(1)}</span>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => toForm(selection.map((p) => ({ ...p, checked: false })))}
                  >
                    {fr.onboarding.skip}
                  </Button>
                  <Button type="button" onClick={() => toForm(selection)}>
                    {fr.onboarding.continue}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
          {step === 2 && (
            <NewProjectForm
              fields={fields}
              onFields={(patch) => setFields((f) => ({ ...f, ...patch }))}
              effectiveKey={effectiveKey}
              valid={valid}
              busy={busy}
              error={error}
              focusFolder={focusFolder}
              pageTitles={pages.map((p) => p.title)}
              start={start}
              onStart={setStart}
              onBack={() => setStep(1)}
              onCancel={() => onOpenChange(false)}
              onSubmit={submit}
            />
          )}
        </>
      )}
    </>
  );
}
