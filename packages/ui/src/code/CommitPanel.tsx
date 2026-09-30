import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Check, GitCommitHorizontal } from "lucide-react";
import { type ReactNode, type Ref, useId } from "react";
import { fr } from "../i18n/fr";

type Props = {
  branch: string | null;
  loading?: boolean;
  stagedCount: number;
  message: string;
  onMessageChange(message: string): void;
  prefilled: boolean;
  amend: boolean;
  onAmendChange(amend: boolean): void;
  canAmend: boolean;
  busy: boolean;
  onCommit(): void;
  banner?: ReactNode;
  messageRef?: Ref<HTMLTextAreaElement>;
};

export function CommitPanel(p: Props) {
  const id = useId();
  const branch = p.branch ?? fr.changes.detached;
  const canCommit = !p.loading && !p.busy && p.message.trim().length > 0 && (p.amend || p.stagedCount > 0);
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-md font-semibold">
          <GitCommitHorizontal aria-hidden className="size-4" />
          {fr.commit.title}
        </h2>
        <span className="text-2xs text-muted-foreground">{fr.commit.stagedCount(p.stagedCount)}</span>
      </header>
      {p.banner}
      <Label htmlFor={`${id}-message`}>{fr.commit.message}</Label>
      <Textarea
        id={`${id}-message`}
        ref={p.messageRef}
        className="min-h-32 font-mono text-sm"
        placeholder={fr.commit.placeholder}
        value={p.message}
        onChange={(e) => p.onMessageChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || !canCommit) return;
          e.preventDefault();
          p.onCommit();
        }}
      />
      <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
        <span>{p.prefilled ? fr.commit.prefilled : ""}</span>
      </div>
      <div className="flex items-center gap-2" title={p.canAmend ? undefined : fr.commit.amendDisabled}>
        <Checkbox
          id={`${id}-amend`}
          checked={p.amend}
          disabled={!p.canAmend || p.busy}
          onCheckedChange={(v) => p.onAmendChange(v === true)}
        />
        <Label htmlFor={`${id}-amend`} className="font-normal">
          {fr.commit.amend}
        </Label>
      </div>
      <Button onClick={p.onCommit} disabled={!canCommit}>
        <Check />
        {p.loading
          ? fr.commit.submitPending
          : p.amend
            ? fr.commit.submitAmend(branch)
            : fr.commit.submit(branch)}
        <kbd aria-hidden className="ml-1 text-xs opacity-60">
          ⌘↵
        </kbd>
      </Button>
      {!p.loading && p.stagedCount === 0 && !p.amend && (
        <p className="text-2xs text-muted-foreground">{fr.commit.nothingStaged}</p>
      )}
    </section>
  );
}
