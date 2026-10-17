import type { ProjectSnapshot } from "./rpc";

export type ProjectInfo = {
  id: string;
  key: string;
  name: string;
  color: string;
  description: string | null;
  repo: string | null;
};

const PR_REPO = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/pull\/\d+/;

const repoOfPr = (url: string): string | null => PR_REPO.exec(url)?.[1] ?? null;

export function projectRepo(snapshot: Pick<ProjectSnapshot, "bindings" | "tickets">): string | null {
  const bound = snapshot.bindings.find((b) => b.adapter === "github-issues");
  if (bound !== undefined) return bound.config.repo;
  const urls = snapshot.tickets.flatMap((t) =>
    t.externalRefs.flatMap((r) => (r.kind === "github_pr" ? [r.url] : [])),
  );
  return urls.map(repoOfPr).find((repo) => repo !== null) ?? null;
}

export const projectInfo = (
  snapshot: Pick<ProjectSnapshot, "meta" | "bindings" | "tickets">,
): ProjectInfo => ({
  id: snapshot.meta.id,
  key: snapshot.meta.key,
  name: snapshot.meta.name,
  color: snapshot.meta.color,
  description: snapshot.meta.description,
  repo: projectRepo(snapshot),
});
