import type { DenialItem, Question, RunDenials, TicketRun } from "@kibo/schema";
import { agentTracesShown, useSdk } from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { CornerDownRight, Minus, Play, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { AGENT_ACCENT_SOLID, AllowResumeDialog } from "./AllowResumeDialog";
import { type Allowance, allowanceOf, canRelaunch, isAllowable, itemKey, tilde } from "./denial-logic";
import { fr } from "./fr";
import { useAnswer } from "./use-questions";

type Props = { question: Question; run: TicketRun | null; fallback: ReactNode };
type Loaded = { status: "loading" } | { status: "none" } | { status: "ready"; denials: RunDenials };

const t = fr.denials;

function useDenials(question: Question): Loaded {
  const sdk = useSdk();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const { runId, id } = question;
  useEffect(() => {
    if (runId === null) {
      setLoaded({ status: "none" });
      return;
    }
    let live = true;
    sdk.runs.denials(runId).then(
      (denials) => {
        if (!live) return;
        setLoaded(
          denials !== null && denials.questionId === id ? { status: "ready", denials } : { status: "none" },
        );
      },
      (e: unknown) => {
        console.error(e);
        if (live) setLoaded({ status: "none" });
      },
    );
    return () => {
      live = false;
    };
  }, [sdk, runId, id]);
  return loaded;
}

type ProposalLineProps = { item: DenialItem; checked: boolean; onToggle(): void };

function ProposalLine({ item, checked, onToggle }: ProposalLineProps) {
  const allowable = isAllowable(item);
  const label =
    item.rule !== null ? t.rule(item.rule) : item.addDir !== null ? t.dir(tilde(item.addDir)) : null;
  return (
    <li className="flex items-start gap-2.5 border-t py-2 first:border-t-0">
      {allowable && label !== null ? (
        <Checkbox aria-label={label} checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
      ) : (
        <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="grid min-w-0 flex-1 gap-0.5">
        {label !== null ? (
          <span className="text-xs">
            {item.rule !== null ? t.ruleWord : t.dirWord}
            <code className="rounded bg-muted px-1 font-mono">{item.rule ?? tilde(item.addDir ?? "")}</code>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{t.reason[item.reason]}</span>
        )}
        <span className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
          <CornerDownRight aria-hidden className="size-3 shrink-0" />
          <span className="min-w-0 break-all font-mono">{tilde(item.target || item.tool)}</span>
        </span>
      </div>
    </li>
  );
}

export function DenialProposals({ question, run, fallback }: Props) {
  const sdk = useSdk();
  const traces = agentTracesShown(useComponentSettings().agentExecution);
  const answer = useAnswer();
  const loaded = useDenials(question);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState<Allowance | null>(null);
  const [failed, setFailed] = useState(false);
  if (loaded.status === "loading") return null;
  if (loaded.status === "none") return fallback;
  const { items, runId } = loaded.denials;
  const allowable = items.filter(isAllowable);
  const checked = new Set(allowable.map(itemKey).filter((k) => !unchecked.has(k)));
  const allowance = allowanceOf(items, checked);
  const toggle = (key: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const ignore = async () => {
    setFailed(false);
    try {
      await answer(question, { kind: "text", text: t.ignored });
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  const relaunch = canRelaunch(run?.state ?? null);
  return (
    <section aria-label={t.title} className="grid gap-2">
      <div className="rounded-md border px-3 py-1">
        <header className="flex items-center gap-1.5 py-1.5">
          <Sparkles aria-hidden className="size-3 text-muted-foreground" />
          <h5 className="flex-1 text-xs font-semibold">{t.title}</h5>
          <span className="text-2xs text-muted-foreground">{t.count(allowable.length, items.length)}</span>
        </header>
        <ul className="border-t">
          {items.map((item) => (
            <ProposalLine
              key={itemKey(item)}
              item={item}
              checked={checked.has(itemKey(item))}
              onToggle={() => toggle(itemKey(item))}
            />
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {failed && (
          <span role="alert" className="text-xs text-destructive">
            {fr.answerFailed}
          </span>
        )}
        {traces && !relaunch && (
          <span className="flex-1 text-2xs text-muted-foreground">{t.notResumable}</span>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void ignore()}>
          {t.ignore}
        </Button>
        {traces && relaunch && (
          <Button
            size="sm"
            className={`h-7 text-xs ${AGENT_ACCENT_SOLID}`}
            disabled={allowance.rules.length + allowance.addDirs.length === 0}
            onClick={() => setConfirming(allowance)}
          >
            <Play aria-hidden />
            {t.allow}
          </Button>
        )}
      </div>
      <AllowResumeDialog
        allowance={confirming}
        runLabel={run?.label ?? runId}
        onOpenChange={(open) => !open && setConfirming(null)}
        onConfirm={(a) =>
          sdk.runs.allowAndResume({ runId, questionId: question.id, rules: a.rules, addDirs: a.addDirs })
        }
      />
    </section>
  );
}
