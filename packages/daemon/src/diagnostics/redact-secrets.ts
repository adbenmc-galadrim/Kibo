const REDACTED = "[redacted]";
const HEADER = /\b(authorization|set-cookie|cookie)(\s*:\s*)[^\n]*/gi;
const BEARER = /\bBearer\s+[^\s"',;]+/g;
const ASSIGNMENT =
  /\b([A-Za-z_]*(?:token|secret|password|passwd|apikey|api_key|pair|session|cookie)[A-Za-z_]*)("?\s*[=:]\s*"?)[^\s"',;&]+/gi;
const URL_PARAMETERS = /\b(https?:\/\/[^\s?#"']*)[?#][^\s"']*/g;
const GITHUB_TOKEN = /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}/g;

export function redactSecrets(text: string): string {
  return text
    .replace(URL_PARAMETERS, `$1?${REDACTED}`)
    .replace(HEADER, `$1$2${REDACTED}`)
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(GITHUB_TOKEN, REDACTED)
    .replace(ASSIGNMENT, `$1$2${REDACTED}`);
}
