import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { GitBranch, GitPullRequest, SquareTerminal, TriangleAlert, User } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { parseReviewers, prCommandPreview } from "./pr-command";

export type PushPrInput = {
  title: string;
  body: string;
  base: string;
  draft: boolean;
  reviewers: string[];
  link: boolean;
};

type Props = {
  open: boolean;
  onOpenChange(open: boolean): void;
  branch: string;
  remote: string;
  bases: string[];
  base: string;
  onBaseChange(base: string): void;
  unpushedCount: number;
  fileCount: number;
  stagedCount: number;
  ticketKey: string | null;
  defaultTitle: string;
  defaultBody: string;
  onCommitFirst(): void;
  onSubmit(input: PushPrInput): Promise<void>;
  extraOptions?: ReactNode;
  ruleNote?: string | null;
};

export function PushPrDialog(p: Props) {
  const id = useId();
  const [title, setTitle] = useState(p.defaultTitle);
  const [body, setBody] = useState(p.defaultBody);
  const [reviewers, setReviewers] = useState("");
  const [draft, setDraft] = useState(true);
  const [link, setLink] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseReviewers(reviewers);

  useEffect(() => {
    if (!p.open) return;
    setTitle(p.defaultTitle);
    setBody(p.defaultBody);
    setError(null);
  }, [p.open, p.defaultTitle, p.defaultBody]);

  const changeOpen = (open: boolean) => {
    if (!busy) p.onOpenChange(open);
  };

  const submit = () => {
    setBusy(true);
    setError(null);
    const input = {
      title,
      body,
      base: p.base,
      draft,
      reviewers: parsed.logins,
      link: link && p.ticketKey !== null,
    };
    p.onSubmit(input).then(
      () => {
        setBusy(false);
        p.onOpenChange(false);
      },
      (e: unknown) => {
        setError(errorMessage(e));
        setBusy(false);
      },
    );
  };

  return (
    <Dialog open={p.open} onOpenChange={changeOpen}>
      <DialogContent className="gap-5 sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{fr.pr.title}</DialogTitle>
          <DialogDescription>
            {fr.pr.subtitle(p.branch, p.base, p.unpushedCount, p.fileCount)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-title`}>{fr.pr.prTitle}</Label>
          <Input
            id={`${id}-title`}
            disabled={busy}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-body`}>{fr.pr.description}</Label>
          <Textarea
            id={`${id}-body`}
            disabled={busy}
            className="max-h-80 min-h-60 font-mono text-[13px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-base`}>{fr.pr.base}</Label>
            <Select value={p.base} disabled={busy} onValueChange={p.onBaseChange}>
              <SelectTrigger id={`${id}-base`} className="w-full">
                <GitBranch aria-hidden className="text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {p.bases.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-reviewers`}>{fr.pr.reviewers}</Label>
            <div className="relative">
              <User aria-hidden className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id={`${id}-reviewers`}
                disabled={busy}
                className="pl-9"
                placeholder={fr.pr.reviewersPlaceholder}
                value={reviewers}
                onChange={(e) => setReviewers(e.target.value)}
                aria-invalid={parsed.invalid !== null}
              />
            </div>
            {parsed.invalid && (
              <p className="text-xs text-destructive">{fr.pr.invalidReviewer(parsed.invalid)}</p>
            )}
          </div>
        </div>
        {p.stagedCount > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-600/70 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert aria-hidden className="size-4 shrink-0 text-amber-500" />
            <span className="flex-1">{fr.pr.staged(p.stagedCount)}</span>
            <Button variant="outline" size="sm" onClick={p.onCommitFirst}>
              {fr.pr.commitFirst}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-draft`}
              disabled={busy}
              checked={draft}
              onCheckedChange={(v) => setDraft(v === true)}
            />
            <Label htmlFor={`${id}-draft`} className="font-normal">
              {fr.pr.draft}
            </Label>
          </div>
          {p.ticketKey && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${id}-link`}
                disabled={busy}
                checked={link}
                onCheckedChange={(v) => setLink(v === true)}
              />
              <Label htmlFor={`${id}-link`} className="font-normal">
                {fr.pr.link(p.ticketKey)}
              </Label>
            </div>
          )}
          {p.extraOptions}
        </div>
        {p.ruleNote && <p className="-mt-2 text-xs text-muted-foreground">{p.ruleNote}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="items-center gap-3 sm:justify-between">
          <code className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <SquareTerminal aria-hidden className="size-4 shrink-0" />
            <span className="truncate">
              {prCommandPreview({ remote: p.remote, branch: p.branch, draft })}
            </span>
          </code>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => p.onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button disabled={busy || parsed.invalid !== null || title.trim().length === 0} onClick={submit}>
              <GitPullRequest />
              {busy ? fr.pr.creating : fr.pr.submit}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
