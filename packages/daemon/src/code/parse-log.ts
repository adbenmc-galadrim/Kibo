import type { CommitInfo } from "@kibo/schema";

export const LOG_FORMAT = "%H%x00%h%x00%s%x00%b%x00%an%x00%at%x1e";

const FIELDS_AFTER_SHA = 5;

export function parseLog(raw: string, isPushed: (sha: string) => boolean): CommitInfo[] {
  const tokens = raw.split("\0");
  const commits: CommitInfo[] = [];
  let sha = (tokens[0] ?? "").trim();
  for (let i = 1; i + FIELDS_AFTER_SHA - 1 < tokens.length; i += FIELDS_AFTER_SHA) {
    const [shortSha = "", subject = "", body = "", author = "", tail = ""] = tokens.slice(
      i,
      i + FIELDS_AFTER_SHA,
    );
    const separator = tail.indexOf("\x1e");
    const at = separator === -1 ? tail : tail.slice(0, separator);
    commits.push({
      sha,
      shortSha,
      subject,
      body: body.trim(),
      author,
      time: Number(at) * 1000,
      pushed: isPushed(sha),
    });
    sha = separator === -1 ? "" : tail.slice(separator + 1).trim();
  }
  return commits;
}
