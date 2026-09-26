import { GhLogin } from "@kibo/schema";

export function prCommandPreview(o: { remote: string; branch: string; draft: boolean }): string {
  return `git push -u ${o.remote} ${o.branch} && gh pr create${o.draft ? " --draft" : ""}`;
}

export function parseReviewers(input: string): { logins: string[]; invalid: string | null } {
  const logins = input
    .split(/[\s,]+/)
    .map((s) => s.replace(/^@/, ""))
    .filter(Boolean);
  return { logins, invalid: logins.find((l) => !GhLogin.safeParse(l).success) ?? null };
}
