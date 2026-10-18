import { KiboError, type KiboErrorCode } from "@kibo/schema";
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
import { useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frNewProject as t } from "../i18n/fr-new-project";
import { PROJECT_COLORS } from "../lib/project-colors";
import { navigate } from "../route";
import { localDay } from "../shell/sprint/sprint-facts";
import { NewProjectForm } from "./NewProjectForm";
import { defaultFields, effectiveKey, type NewProjectFields, toRequest, validate } from "./new-project-model";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  existingKeys: readonly string[];
  focusFolder?: boolean;
};

type BodyProps = Omit<Required<Props>, "open"> & { today: string };

export function NewProjectDialog({ open, onOpenChange, count, existingKeys, focusFolder = false }: Props) {
  const today = useToday();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-[18px] overflow-y-auto rounded-[12px] p-6 sm:max-w-[520px]">
        <DialogHeader className="gap-[6px]">
          <DialogTitle className="text-[18px] leading-[22px]">{t.title}</DialogTitle>
          <DialogDescription className="text-[13px] leading-4">{t.subtitle}</DialogDescription>
        </DialogHeader>
        {today !== null && (
          <NewProjectBody
            today={today}
            onOpenChange={onOpenChange}
            count={count}
            existingKeys={existingKeys}
            focusFolder={focusFolder}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const settle = (fixedNow: string | null | undefined) => {
      const at = fixedNow ? Date.parse(fixedNow) : Number.NaN;
      if (alive) setToday(localDay(Number.isNaN(at) ? Date.now() : at));
    };
    client.rpc({ method: "getAppInfo" }).then(
      (info) => settle(info?.fixedNow),
      () => settle(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  return today;
}

const ERRORS: Partial<Record<KiboErrorCode, string>> = t.errors;

function errorMessage(err: unknown): string {
  const message = err instanceof KiboError ? ERRORS[err.code] : undefined;
  if (message) return message;
  console.error(err);
  return fr.common.error;
}

async function createdAnyway(key: string, existingKeys: readonly string[]): Promise<string | null> {
  if (existingKeys.includes(key)) return null;
  const projects = await client.rpc({ method: "listProjects" }).catch(() => []);
  return projects.find((p) => p.key === key)?.id ?? null;
}

function NewProjectBody({ today, onOpenChange, count, existingKeys, focusFolder }: BodyProps) {
  const [fields, setFields] = useState<NewProjectFields>(() => defaultFields(today));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const validation = validate(fields, existingKeys);

  const openProject = (projectId: string) => {
    onOpenChange(false);
    navigate(projectId);
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    const color = PROJECT_COLORS[count % PROJECT_COLORS.length] ?? "#64748B";
    try {
      const project = await client.rpc(toRequest(fields, color));
      openProject(project.id);
    } catch (err) {
      const partial =
        err instanceof KiboError && err.code === "INVALID_INPUT"
          ? null
          : await createdAnyway(effectiveKey(fields), existingKeys);
      if (partial === null) setError(errorMessage(err));
      else {
        console.error(err);
        setCreated(partial);
      }
    } finally {
      setBusy(false);
    }
  };

  if (created !== null)
    return (
      <>
        <Alert>
          <AlertDescription>{t.partial}</AlertDescription>
        </Alert>
        <DialogFooter>
          <Button onClick={() => openProject(created)}>{t.open}</Button>
        </DialogFooter>
      </>
    );
  return (
    <NewProjectForm
      fields={fields}
      onFields={(patch) => setFields((f) => ({ ...f, ...patch }))}
      validation={validation}
      busy={busy}
      error={error}
      focusFolder={focusFolder}
      onCancel={() => onOpenChange(false)}
      onSubmit={submit}
    />
  );
}
