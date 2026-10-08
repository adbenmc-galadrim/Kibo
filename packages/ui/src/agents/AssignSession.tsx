import type { SessionPreview } from "@kibo/schema";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Label } from "@kibo/sdk/ui/label";
import { useId } from "react";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { formatTokens } from "./format";

const t = frAgentsPage.assign.session;

function sessionText(session: SessionPreview | null): string {
  if (!session) return t.fresh("no_previous");
  if (session.resumable) return t.resume(session.label, session.turns, formatTokens(session.tokens));
  return t.fresh(session.reason ?? "no_previous");
}

type Props = { session: SessionPreview | null; fresh: boolean; onFreshChange(fresh: boolean): void };

export function AssignSession({ session, fresh, onFreshChange }: Props) {
  const id = useId();
  return (
    <>
      <dt className="text-muted-foreground">{t.label}</dt>
      <dd className="grid gap-1.5">
        <span>{sessionText(session)}</span>
        {session?.resumable && (
          <span className="flex items-center gap-2">
            <Checkbox id={id} checked={fresh} onCheckedChange={(v) => onFreshChange(v === true)} />
            <Label htmlFor={id} className="font-normal">
              {t.reset}
            </Label>
          </span>
        )}
      </dd>
    </>
  );
}
