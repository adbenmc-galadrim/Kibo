const REDACTED = "[redacted]";
const KEY_NAMES =
  "token|secret|password|passwd|api[-_]?key|access[-_]?key|private[-_]?key|credential|auth|pair|session|cookie";
const KEY = `(?<![A-Za-z0-9_-])([A-Za-z0-9_-]*(?:${KEY_NAMES})[A-Za-z0-9_-]*)`;
const HEADER = /\b(authorization|set-cookie|cookie)(\s*:\s*)[^\n]*/gi;
const PASSWORD = /(?<![A-Za-z0-9_-])([A-Za-z0-9_-]*(?:password|passwd)[A-Za-z0-9_-]*)("?\s*[=:]\s*)[^\n]*/gi;
const ASSIGNMENT = new RegExp(`${KEY}("?\\s*[=:]\\s*"?)[^\\s"',;&]+`, "gi");
const BEARER = /\bBearer\s+[^\s"',;]+/g;
const LONG_SCHEME = /\b(Basic|Token)\s+[A-Za-z0-9+/=._~-]{16,}/gi;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi;
const URL_PARAMETERS = /\b(https?:\/\/[^\s?#"']*)[?#][^\s"']*/g;
const GITHUB_TOKEN = /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}/g;
const PROVIDER_KEY = /\bsk-[A-Za-z0-9_-]{20,}/g;

export function redactSecrets(text: string): string {
  return text
    .replace(URL_CREDENTIALS, `$1${REDACTED}@`)
    .replace(URL_PARAMETERS, `$1?${REDACTED}`)
    .replace(HEADER, `$1$2${REDACTED}`)
    .replace(PASSWORD, `$1$2${REDACTED}`)
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(LONG_SCHEME, `$1 ${REDACTED}`)
    .replace(GITHUB_TOKEN, REDACTED)
    .replace(PROVIDER_KEY, REDACTED)
    .replace(ASSIGNMENT, `$1$2${REDACTED}`);
}
