import type { RepoSlug } from "@kibo/schema";
import type { IntegrationHost } from "./types";

const PATTERNS = [
  /^git@github\.com:([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
  /^ssh:\/\/git@github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
  /^https:\/\/(?:[^@/]+@)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
];

export function parseGithubRemote(url: string | null): RepoSlug | null {
  if (url === null) return null;
  for (const re of PATTERNS) {
    const m = re.exec(url.trim());
    if (m?.[1] && m[2]) return `${m[1]}/${m[2]}`;
  }
  return null;
}

export async function githubRepoOf(host: IntegrationHost, projectId: string): Promise<RepoSlug | null> {
  return parseGithubRemote(await host.gitRemoteUrl(projectId));
}
