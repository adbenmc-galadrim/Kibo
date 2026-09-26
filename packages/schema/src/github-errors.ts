import { KiboError } from "./errors";

function messageOf(status: number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof parsed.message === "string"
    ) {
      return `github ${status}: ${parsed.message.slice(0, 200)}`;
    }
    return `github ${status}`;
  } catch {
    return body ? `github ${status}: ${body.slice(0, 200)}` : `github ${status}`;
  }
}

export function githubError(
  status: number,
  header: (name: string) => string | null,
  body: string,
): KiboError {
  const message = messageOf(status, body);
  const exhausted = header("x-ratelimit-remaining") === "0" || header("retry-after") !== null;
  if ((status === 403 || status === 429) && exhausted) return new KiboError("RATE_LIMITED", message);
  if (status === 404 || status === 410) return new KiboError("REMOTE_NOT_FOUND", message);
  if (status === 409) return new KiboError("REMOTE_CONFLICT", message);
  if (status >= 500) return new KiboError("REMOTE_UNAVAILABLE", message);
  return new KiboError("REMOTE_REJECTED", message);
}

export function githubStatusOf(detail: string): number | null {
  const match = /^github (\d{3})\b/.exec(detail);
  return match ? Number(match[1]) : null;
}
