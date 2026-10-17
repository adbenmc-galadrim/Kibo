import type { ComponentDraftDetails } from "@kibo/schema";
import { frAi } from "../i18n/fr-ai";
import { problemCount } from "./draft-flow";

function failureText(details: ComponentDraftDetails, exhausted: boolean): string | null {
  const failure = details.failure;
  if (!failure) return null;
  if (failure.kind !== "validation" || !details.report) return frAi.ai.failure[failure.kind];
  return exhausted
    ? frAi.ai.gaveUp(details.title)
    : frAi.ai.problems(details.title, problemCount(details.report));
}

type Props = { details: ComponentDraftDetails; reviewed: boolean; exhausted: boolean };

export function DraftHeadline({ details, reviewed, exhausted }: Props) {
  const text =
    details.status === "generating"
      ? frAi.ai.generating(details.title)
      : details.status === "validating"
        ? frAi.ai.validating
        : details.status === "failed"
          ? failureText(details, exhausted)
          : details.status === "review" && !reviewed
            ? frAi.ai.reviewHelp
            : null;
  if (!text) return null;
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
