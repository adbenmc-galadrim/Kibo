import { EMBED_ATTRIBUTES, type EmbedKind } from "@kibo/schema";

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const escapeAttribute = (value: string): string => value.replace(/[&"'<>]/g, (c) => ENTITIES[c] ?? c);

export function relayHtml(input: { target: string; kind: EmbedKind; title: string }): string {
  const { sandbox, allow } = EMBED_ATTRIBUTES[input.kind];
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    "<style>html, body, iframe { height: 100%; width: 100%; margin: 0; border: 0 }</style></head><body>" +
    `<iframe src="${escapeAttribute(input.target)}" sandbox="${escapeAttribute(sandbox)}" ` +
    `allow="${escapeAttribute(allow)}" referrerpolicy="no-referrer" title="${escapeAttribute(input.title)}"></iframe>` +
    "</body></html>"
  );
}

export function relayAncestors(uiOrigins: readonly string[], devOrigins: readonly string[]): string[] {
  return [...uiOrigins, "'self'", ...devOrigins];
}

function permissionsPolicy(kind: EmbedKind, targetOrigin: string): string {
  return EMBED_ATTRIBUTES[kind].allow
    .split(";")
    .map((directive) => directive.trim().split(/\s+/))
    .map(([feature, value]) => `${feature}=${value === "'none'" ? "()" : `(self "${targetOrigin}")`}`)
    .join(", ");
}

export function relayHeaders(input: {
  targetOrigin: string;
  ancestors: readonly string[];
  kind: EmbedKind;
}): Record<string, string> {
  return {
    "content-security-policy":
      `default-src 'none'; style-src 'unsafe-inline'; frame-src ${input.targetOrigin}; ` +
      `frame-ancestors ${input.ancestors.join(" ")}; base-uri 'none'; form-action 'none'`,
    "permissions-policy": permissionsPolicy(input.kind, input.targetOrigin),
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-site",
    "cache-control": "no-store",
  };
}
