import { githubIssueState, type TicketView } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { CircleCheck, CircleDot, Unlink } from "lucide-react";
import { fr } from "../../i18n/fr";

const t = fr.integrations.sheet;

export function GithubRefs({ ticket }: { ticket: TicketView }) {
  const Icon = ticket.statusId === "done" ? CircleCheck : CircleDot;
  const chips = ticket.externalRefs.flatMap((ref) => {
    if (ref.kind !== "github_issue" || ref.number === null) return [];
    if (githubIssueState(ref) === "broken" || ref.url === null) {
      return [
        <Badge key={ref.bindingId} variant="outline" className="text-muted-foreground" title={t.brokenHelp}>
          <Unlink aria-hidden />
          {t.broken}
        </Badge>,
      ];
    }
    return [
      <Badge key={ref.bindingId} variant="outline" asChild>
        <a href={ref.url} target="_blank" rel="noreferrer noopener" title={t.openOnGithub}>
          <Icon aria-hidden />
          <span>{t.issue(ref.number)}</span>
        </a>
      </Badge>,
    ];
  });
  if (chips.length === 0) return null;
  return (
    <>
      <dt className="text-muted-foreground">{t.issueProperty}</dt>
      <dd className="flex flex-wrap gap-1">{chips}</dd>
    </>
  );
}
