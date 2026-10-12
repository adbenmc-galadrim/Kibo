import { type FileRef, type RunAction, SKILL_REVIEW_TOOL } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Ban, Check, X } from "lucide-react";
import { frMoments } from "../i18n/fr-moments";
import { type FileContext, fileRefOf } from "./file-context";

type Props = { action: RunAction; files?: FileContext | null; onOpenFile?(ref: FileRef): void };

const OUTCOME_ICON = { ok: Check, error: X, denied: Ban } as const;

export function phraseOf(action: RunAction): string | null {
  const t = frMoments.phrases;
  if (action.kind === "skill") return action.outcome === "denied" ? t.deniedSkill : t.skill;
  if (action.kind === "subagent" && action.outcome === "denied") return t.deniedSubagent;
  if (action.kind === "mcp" && action.tool === SKILL_REVIEW_TOOL) return action.label;
  return null;
}

export function Phrase({ action, phrase }: { action: RunAction; phrase: string }) {
  return (
    <span data-phrase className="min-w-0 truncate">
      {phrase}
      {action.target && (
        <>
          {" "}
          <code className="font-mono">{action.target}</code>
        </>
      )}
    </span>
  );
}

function Target({ action, files, onOpenFile }: Props) {
  const phrase = phraseOf(action);
  if (phrase !== null) return <Phrase action={action} phrase={phrase} />;
  if (!action.target) return <span className="min-w-0 truncate">{action.label}</span>;
  const ref = onOpenFile ? fileRefOf(files, action.kind, action.target) : null;
  if (!ref || !onOpenFile) return <span className="min-w-0 truncate font-mono">{action.target}</span>;
  return (
    <button
      type="button"
      className="min-w-0 truncate text-left font-mono underline-offset-2 hover:underline"
      onClick={() => onOpenFile(ref)}
    >
      {ref.path}
    </button>
  );
}

export function ActionRow({ action, files, onOpenFile }: Props) {
  const Icon = OUTCOME_ICON[action.outcome];
  const t = frMoments;
  return (
    <li data-outcome={action.outcome} className="grid gap-1 text-xs">
      <div className="grid grid-cols-[1rem_6rem_1fr_auto] items-center gap-2">
        <Icon
          role="img"
          aria-label={t.outcomes[action.outcome]}
          className={cn("size-3.5", action.outcome === "ok" ? "text-muted-foreground" : "text-destructive")}
        />
        <span className="text-muted-foreground">{t.kinds[action.kind]}</span>
        <Target action={action} files={files} onOpenFile={onOpenFile} />
        <span className="flex gap-2 font-mono">
          {action.patch && (
            <span className="text-green-600 dark:text-green-500">
              {t.patch(action.patch.added, action.patch.removed)}
            </span>
          )}
          {action.tests && (
            <span
              className={action.tests.failed > 0 ? "text-destructive" : "text-green-600 dark:text-green-500"}
            >
              {t.tests(action.tests.passed, action.tests.failed)}
            </span>
          )}
        </span>
      </div>
      {action.detail && (
        <details className="ml-6">
          <summary className="cursor-pointer text-muted-foreground">{t.detail}</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap">
            {action.detail}
          </pre>
        </details>
      )}
    </li>
  );
}
