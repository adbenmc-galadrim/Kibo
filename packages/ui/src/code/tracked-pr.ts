import { branchRefOf, type ExternalRef, type GithubPrRef, type PrInfo } from "@kibo/schema";

type WithRefs = { externalRefs: readonly ExternalRef[] };

const isFollowed = (ref: ExternalRef): ref is GithubPrRef =>
  ref.kind === "github_pr" && (ref.state === "open" || ref.state === "draft");

const toPrInfo = ({ number, url, state, base, head }: GithubPrRef): PrInfo => ({
  number,
  url,
  state,
  base,
  head,
});

export function trackedPr(found: PrInfo | null, tickets: readonly WithRefs[], branch: string | null) {
  if (found || !branch) return found;
  const followed = tickets.flatMap((t) => t.externalRefs.filter(isFollowed));
  const byHead = followed.find((ref) => ref.head === branch);
  const ticket = tickets.find((t) => branchRefOf(t.externalRefs)?.branch === branch);
  const ref = byHead ?? ticket?.externalRefs.find(isFollowed);
  return ref ? toPrInfo(ref) : null;
}
