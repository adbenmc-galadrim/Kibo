import type { PublishPreview, PublishResult } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import { fr } from "../i18n/fr";
import type { UpdateSummary } from "../lib/market-update";
import { permissionLabel } from "../lib/permission-lines";

export type Strategy = "update-all" | "new-version";

export const NEUTRAL_DOT = "#71717A";

const p = fr.publish;

export function validationErrors(preview: PublishPreview): string[] {
  const v = preview.validation;
  return [
    ...v.manifest.errors,
    ...v.imports.errors,
    ...v.typecheck.errors,
    ...v.conformance.errors,
    ...v.permissions.errors,
  ];
}

export function InvalidPreview({ id, errors }: { id: string; errors: string[] }) {
  return (
    <div role="alert" className="grid gap-1 text-sm text-destructive">
      <p>{p.invalid(id)}</p>
      {errors.map((line) => (
        <p key={line} className="font-mono text-xs">
          {line}
        </p>
      ))}
    </div>
  );
}

type UsagesProps = {
  preview: UpdateSummary;
  strategy: Strategy;
  colorOf(projectId: string): string;
  onUsages?: () => void;
};

export function UsagesBox({ preview, strategy, colorOf, onUsages }: UsagesProps) {
  const projects = new Set(preview.usages.map((u) => u.projectId)).size;
  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      {onUsages ? (
        <Button variant="link" className="h-auto justify-self-start p-0 font-medium" onClick={onUsages}>
          {p.usedIn(projects)}
        </Button>
      ) : (
        <p className="font-medium">{p.usedIn(projects)}</p>
      )}
      {preview.usages.map((u) => (
        <div key={u.instanceId} className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: colorOf(u.projectId) }}
          />
          <span>{u.projectName}</span>
          <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="flex-1 truncate text-muted-foreground">{u.pageTitle}</span>
          <span className="font-mono text-xs text-muted-foreground">{u.version}</span>
          <span className="text-xs text-muted-foreground">
            {strategy === "update-all" ? p.updateOne : p.keep}
          </span>
        </div>
      ))}
    </div>
  );
}

function Change({ mark, tone, text }: { mark: string; tone: string; text: string }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className={tone}>
        {mark}
      </span>
      <span>{text}</span>
    </li>
  );
}

export const hasChanges = (preview: UpdateSummary): boolean =>
  preview.changes.length > 0 || preview.newPermissions.length > 0 || preview.migration !== null;

export function ChangesList({ preview }: { preview: UpdateSummary }) {
  const { migration } = preview;
  return (
    <div className="grid gap-1.5 text-sm">
      <p className="font-medium">{p.changes}</p>
      <ul className="grid gap-1 text-muted-foreground">
        {preview.changes.map((c) => (
          <Change key={c} mark="+" tone="text-green-600 dark:text-green-400" text={c} />
        ))}
        {preview.newPermissions.map((perm) => (
          <Change
            key={perm}
            mark="+"
            tone="text-orange-600 dark:text-orange-400"
            text={permissionLabel(perm)}
          />
        ))}
        {migration && (
          <Change
            mark="~"
            tone="text-blue-600 dark:text-blue-400"
            text={p.migration(migration.from, migration.to)}
          />
        )}
      </ul>
    </div>
  );
}

function StrategyCard({ value, title, help }: { value: Strategy; title: string; help: string }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-orange-600 has-[[data-state=checked]]:bg-orange-50 dark:has-[[data-state=checked]]:bg-orange-950/60"
    >
      <RadioGroupItem id={id} value={value} aria-label={title} className="mt-0.5" />
      <span className="grid gap-1">
        <span className="text-sm font-medium leading-none">{title}</span>
        <span className="text-xs text-muted-foreground">{help}</span>
      </span>
    </label>
  );
}

type StrategyProps = { preview: UpdateSummary; value: Strategy; onChange(s: Strategy): void };

export function StrategyChoice({ preview, value, onChange }: StrategyProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v === "new-version" ? "new-version" : "update-all")}
      className="grid gap-2"
    >
      <StrategyCard
        value="update-all"
        title={p.updateAll}
        help={p.updateAllHelp(preview.usages.length, preview.to, preview.newPermissions.length > 0)}
      />
      <StrategyCard
        value="new-version"
        title={p.newVersion}
        help={p.newVersionHelp(preview.from ?? preview.to)}
      />
    </RadioGroup>
  );
}

export function PublishReport({ result, version }: { result: PublishResult; version: string }) {
  if (result.failed.length === 0)
    return <output className="block text-sm text-green-700 dark:text-green-400">{p.done(version)}</output>;
  return (
    <div role="alert" className="grid gap-1 text-sm text-destructive">
      <p>{p.partial(result.failed.length)}</p>
      {result.failed.map((f) => (
        <p key={f.instanceId}>{`${f.projectName} › ${f.pageTitle} — ${f.message}`}</p>
      ))}
    </div>
  );
}
