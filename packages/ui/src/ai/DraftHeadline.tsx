import type { ComponentDraftDetails } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { problemCount } from "./draft-flow";

function failureText(details: ComponentDraftDetails, exhausted: boolean): string | null {
  const failure = details.failure;
  if (!failure) return null;
  if (failure.kind !== "validation" || !details.report) return fr.ai.failure[failure.kind];
  return exhausted
    ? fr.ai.gaveUp(details.title)
    : fr.ai.problems(details.title, problemCount(details.report));
}

type Props = { details: ComponentDraftDetails; reviewed: boolean; exhausted: boolean };

export function DraftHeadline({ details, reviewed, exhausted }: Props) {
  const text =
    details.status === "generating"
      ? fr.ai.generating(details.title)
      : details.status === "validating"
        ? fr.ai.validating
        : details.status === "failed"
          ? failureText(details, exhausted)
          : details.status === "review" && !reviewed
            ? fr.ai.reviewHelp
            : null;
  if (!text) return null;
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
