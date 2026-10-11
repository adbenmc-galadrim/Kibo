export const MASKED = "‹masqué›";

type SecretRule = { pattern: RegExp; kept: (match: string, ...groups: string[]) => string };

const whole = (): string => "";
const firstGroup = (_match: string, kept: string): string => kept;

const RULES: readonly SecretRule[] = [
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|[\s\S]*$)/g,
    kept: whole,
  },
  { pattern: /(authorization:[ \t]*)[^\r\n]+/gi, kept: firstGroup },
  { pattern: /(\b[A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD)\s*=\s*)\S+/gi, kept: firstGroup },
  { pattern: /\bsk-[A-Za-z0-9_-]{16,}/g, kept: whole },
  { pattern: /\bghp_[A-Za-z0-9]{20,}/g, kept: whole },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/g, kept: whole },
  { pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, kept: whole },
  { pattern: /\bAKIA[0-9A-Z]{16}/g, kept: whole },
];

export const SECRET_PATTERNS: readonly RegExp[] = RULES.map((r) => r.pattern);

export function maskSecrets(text: string): string {
  return RULES.reduce(
    (masked, rule) =>
      masked.replace(
        rule.pattern,
        (match: string, ...groups: string[]) => `${rule.kept(match, ...groups)}${MASKED}`,
      ),
    text,
  );
}

export function hasSecret(text: string): boolean {
  return RULES.some((rule) =>
    [...text.matchAll(rule.pattern)].some(
      (m) => m[0].slice(rule.kept(m[0], ...m.slice(1)).length) !== MASKED,
    ),
  );
}

export function maskSecretsWithin(text: string, max: number): string {
  const masked = maskSecrets(text);
  if (masked.length <= max) return masked;
  const cut = masked.slice(0, max);
  if (!hasSecret(cut)) return cut;
  return maskSecrets(masked.slice(0, Math.max(0, max - MASKED.length)));
}
