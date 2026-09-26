import type { ValidationReport } from "@kibo/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";

function Section({ name, ok, output }: { name: string; ok: boolean; output: string }) {
  const [open, setOpen] = useState(false);
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen} className="grid gap-2 px-3 py-2.5">
        <div className="flex items-center gap-3 text-sm">
          <Icon
            aria-hidden
            className={
              ok
                ? "size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                : "size-4 shrink-0 text-red-600 dark:text-red-400"
            }
          />
          <span className="grid flex-1 gap-0.5">
            <span className="font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{ok ? fr.ai.passed : fr.ai.failedSection}</span>
          </span>
          {output.length > 0 && (
            <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {open ? fr.ai.hideOutput : fr.ai.showOutput}
            </CollapsibleTrigger>
          )}
        </div>
        <CollapsibleContent>
          <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] whitespace-pre-wrap">
            {output}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function permissionsOutput(p: ValidationReport["permissions"]): string {
  return [
    p.missing.length > 0 ? fr.ai.missingPermissions(p.missing.join(", ")) : "",
    p.unused.length > 0 ? fr.ai.unusedPermissions(p.unused.join(", ")) : "",
    ...p.errors,
  ]
    .filter(Boolean)
    .join("\n");
}

export function ValidationReportView({ report }: { report: ValidationReport }) {
  const p = report.permissions;
  return (
    <ul className="divide-y rounded-lg border">
      {!report.manifest.ok && (
        <Section name={fr.ai.sections.manifest} ok={false} output={report.manifest.errors.join("\n")} />
      )}
      {!report.imports.ok && (
        <Section name={fr.ai.sections.imports} ok={false} output={report.imports.errors.join("\n")} />
      )}
      <Section
        name={fr.ai.sections.typecheck}
        ok={report.typecheck.ok}
        output={report.typecheck.errors.join("\n")}
      />
      <Section name={fr.ai.sections.tests} ok={report.tests.ok} output={report.tests.output} />
      <Section
        name={fr.ai.sections.conformance}
        ok={report.conformance.ok}
        output={report.conformance.errors.join("\n")}
      />
      <Section
        name={fr.ai.sections.permissions}
        ok={p.missing.length === 0 && p.errors.length === 0}
        output={permissionsOutput(p)}
      />
    </ul>
  );
}
